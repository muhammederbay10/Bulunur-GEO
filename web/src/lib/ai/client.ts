import "server-only";

import { getServerEnv } from "@/lib/env/server";
import {
  geoAnalysisOutputSchema,
  geoImprovementOutputSchema,
  productInputSchema,
} from "@/lib/validation/ai-contract";
import type {
  GeoAnalysisOutput,
  GeoImprovementOutput,
  ProductInput,
} from "@/types/ai-contract";

const AI_REQUEST_TIMEOUT_MS = 60_000;

export class AiServiceError extends Error {
  code: string;
  status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.name = "AiServiceError";
    this.code = params.code;
    this.status = params.status;
  }
}

function summarizeAiErrorPayload(payload: unknown) {
  if (typeof payload === "string") {
    return payload.slice(0, 500);
  }

  if (payload && typeof payload === "object") {
    return payload;
  }

  return null;
}

function logAiJsonResponse(label: string, payload: unknown) {
  try {
    console.log(
      `[ai-service] ${label} response json\n${JSON.stringify(payload, null, 2)}`,
    );
  } catch {
    console.log(`[ai-service] ${label} response json`, payload);
  }
}

function logAiJsonRequest(path: string, url: string, payload: unknown) {
  try {
    console.log(
      `[ai-service] request json\nPOST ${url}\nAuthorization: Bearer <AI_SERVICE_SECRET>\nContent-Type: application/json\n\n${JSON.stringify(payload, null, 2)}`,
    );
  } catch {
    console.log("[ai-service] request json", {
      path,
      url,
      payload,
    });
  }
}

function debugLog(label: string, details: Record<string, unknown>) {
  console.log(`[ai-service-debug] ${label}`, {
    at: new Date().toISOString(),
    ...details,
  });
}

export function getAiServiceConfig() {
  const env = getServerEnv();

  return {
    serviceUrl: env.AI_SERVICE_URL,
    hasServiceSecret: Boolean(env.AI_SERVICE_SECRET),
  };
}

function getRequiredAiServiceConfig() {
  const env = getServerEnv();

  if (!env.AI_SERVICE_URL || !env.AI_SERVICE_SECRET) {
    throw new AiServiceError({
      code: "ai_service_not_configured",
      message:
        "AI servis ayarlari eksik. AI_SERVICE_URL ve AI_SERVICE_SECRET degerlerini ekleyin.",
      status: 503,
    });
  }

  return {
    serviceUrl: env.AI_SERVICE_URL,
    serviceSecret: env.AI_SERVICE_SECRET,
  };
}

function buildAiUrl(serviceUrl: string, path: string) {
  const baseUrl = serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`;

  return new URL(path.replace(/^\//, ""), baseUrl).toString();
}

async function postToAiService(params: {
  path: string;
  body: unknown;
}): Promise<unknown> {
  const config = getRequiredAiServiceConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  const url = buildAiUrl(config.serviceUrl, params.path);
  const startedAt = Date.now();
  const requestBody = JSON.stringify(params.body);

  debugLog("request:start", {
    path: params.path,
    url,
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });
  logAiJsonRequest(params.path, url, params.body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceSecret}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
      signal: controller.signal,
      cache: "no-store",
    });
    const responseElapsedMs = Date.now() - startedAt;

    debugLog("request:response", {
      path: params.path,
      status: response.status,
      ok: response.ok,
      elapsedMs: responseElapsedMs,
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      console.error("[ai-service] request failed", {
        path: params.path,
        status: response.status,
        elapsedMs: responseElapsedMs,
        detail: summarizeAiErrorPayload(payload),
      });

      throw new AiServiceError({
        code: "ai_service_request_failed",
        message: "AI servisi isteği kabul etmedi.",
        status: response.status,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof AiServiceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      debugLog("request:timeout", {
        path: params.path,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
      });

      throw new AiServiceError({
        code: "ai_service_timeout",
        message: "AI isteği zaman aşımına uğradı. Birazdan tekrar deneyin.",
        status: 504,
      });
    }

    debugLog("request:unreachable", {
      path: params.path,
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : undefined,
    });

    throw new AiServiceError({
      code: "ai_service_unreachable",
      message: "AI servisine ulasilamadi.",
      status: 502,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeProduct(
  productInput: ProductInput,
): Promise<GeoAnalysisOutput> {
  debugLog("analysis:input-parse:start", {
    productId: productInput.productId,
    source: productInput.source,
    url: productInput.url,
    crawlStatus: productInput.crawlMetadata?.crawlStatus,
  });
  const parsedInput = productInputSchema.parse(productInput);
  debugLog("analysis:input-parse:success", {
    productId: parsedInput.productId,
    source: parsedInput.source,
    crawlStatus: parsedInput.crawlMetadata.crawlStatus,
  });
  const payload = await postToAiService({
    path: "/ai/analyze-product",
    body: parsedInput,
  });
  logAiJsonResponse("analysis", payload);
  const parsedOutput = geoAnalysisOutputSchema.safeParse(payload);

  if (!parsedOutput.success) {
    console.error("[ai-service-debug] analysis:output-parse:failed", {
      at: new Date().toISOString(),
      productId: parsedInput.productId,
      issues: parsedOutput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      topLevelKeys:
        payload && typeof payload === "object" ? Object.keys(payload) : [],
    });

    throw new AiServiceError({
      code: "invalid_ai_analysis_response",
      message: "AI analiz cevabı beklenen sözleşmeye uymuyor.",
      status: 502,
    });
  }

  debugLog("analysis:output-parse:success", {
    productId: parsedInput.productId,
    overallScore: parsedOutput.data.overallScore,
    recommendedAction: parsedOutput.data.recommendedAction,
  });

  return parsedOutput.data;
}

function normalizeImprovementValidation(
  improvement: GeoImprovementOutput,
): GeoImprovementOutput {
  const validationWarnings = [
    ...improvement.validation.warnings,
    ...improvement.validation.errors,
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ...improvement,
    validation: {
      ...improvement.validation,
      passed: true,
      warnings: Array.from(new Set(validationWarnings)),
      errors: [],
    },
  };
}

export async function improveProduct(
  params: {
    productInput: ProductInput;
    analysis: GeoAnalysisOutput;
    userFacts?: Record<string, unknown>;
  },
): Promise<GeoImprovementOutput> {
  const parsedInput = productInputSchema.parse(params.productInput);
  const parsedAnalysis = geoAnalysisOutputSchema.parse(params.analysis);
  const payload = await postToAiService({
    path: "/ai/improve-product",
    body: {
      product: parsedInput,
      analysis: parsedAnalysis,
      userFacts: params.userFacts ?? null,
    },
  });
  logAiJsonResponse("optimization", payload);
  const parsedOutput = geoImprovementOutputSchema.safeParse(payload);

  if (!parsedOutput.success) {
    console.error("[ai-service] invalid improvement response", {
      issues: parsedOutput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      topLevelKeys:
        payload && typeof payload === "object" ? Object.keys(payload) : [],
    });

    throw new AiServiceError({
      code: "invalid_ai_improvement_response",
      message: "AI iyileştirme cevabı beklenen sözleşmeye uymuyor.",
      status: 502,
    });
  }

  return normalizeImprovementValidation(parsedOutput.data);
}

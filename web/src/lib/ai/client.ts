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

const AI_REQUEST_TIMEOUT_MS = 30_000;

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

  try {
    const response = await fetch(buildAiUrl(config.serviceUrl, params.path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.body),
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new AiServiceError({
        code: "ai_service_request_failed",
        message: "AI servisi istegi kabul etmedi.",
        status: response.status,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof AiServiceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AiServiceError({
        code: "ai_service_timeout",
        message: "AI istegi zaman asimina ugradi. Birazdan tekrar deneyin.",
        status: 504,
      });
    }

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
  const parsedInput = productInputSchema.parse(productInput);
  const payload = await postToAiService({
    path: "/ai/analyze-product",
    body: parsedInput,
  });
  const parsedOutput = geoAnalysisOutputSchema.safeParse(payload);

  if (!parsedOutput.success) {
    throw new AiServiceError({
      code: "invalid_ai_analysis_response",
      message: "AI analiz cevabi beklenen sozlesmeye uymuyor.",
      status: 502,
    });
  }

  return parsedOutput.data;
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
      product_input: parsedInput,
      analysis: parsedAnalysis,
      user_facts: params.userFacts ?? null,
    },
  });
  const parsedOutput = geoImprovementOutputSchema.safeParse(payload);

  if (!parsedOutput.success) {
    throw new AiServiceError({
      code: "invalid_ai_improvement_response",
      message: "AI iyilestirme cevabi beklenen sozlesmeye uymuyor.",
      status: 502,
    });
  }

  return parsedOutput.data;
}

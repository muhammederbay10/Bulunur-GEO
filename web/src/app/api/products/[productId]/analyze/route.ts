import { after, NextResponse } from "next/server";
import { z } from "zod";

import { AiServiceError, analyzeProduct } from "@/lib/ai/client";
import {
  getLatestProductAnalysis,
  saveProductAnalysisFailure,
  saveProductAnalysisSuccess,
  startProductAnalysisRun,
} from "@/lib/db/analysis-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";
import { canStartAnalysis } from "@/lib/usage-limits";
import type {
  AnalyzeProductApiResponse,
  AnalyzeProductStatusApiResponse,
} from "@/types/analysis";
import type { ProductInput } from "@/types/ai-contract";

export const maxDuration = 60;

const paramsSchema = z.object({
  productId: z.uuid(),
});

type RouteContext = {
  params: Promise<{
    productId?: string | string[];
  }>;
};

function failureResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
      message,
    } satisfies AnalyzeProductApiResponse,
    { status },
  );
}

function analysisDebug(label: string, details: Record<string, unknown>) {
  console.log(`[analysis-debug] ${label}`, {
    at: new Date().toISOString(),
    ...details,
  });
}

async function runProductAnalysisInBackground(params: {
  profileId: string;
  storeId: string;
  productId: string;
  analysisId: string;
  productInput: ProductInput;
}) {
  const startedAt = Date.now();

  analysisDebug("background:start", {
    profileId: params.profileId,
    storeId: params.storeId,
    productId: params.productId,
    analysisId: params.analysisId,
    source: params.productInput.source,
    crawlStatus: params.productInput.crawlMetadata.crawlStatus,
  });

  try {
    analysisDebug("background:ai-call:start", {
      productId: params.productId,
      analysisId: params.analysisId,
    });
    const analysis = await analyzeProduct(params.productInput);
    analysisDebug("background:ai-call:success", {
      productId: params.productId,
      analysisId: params.analysisId,
      elapsedMs: Date.now() - startedAt,
      overallScore: analysis.overallScore,
    });
    analysisDebug("background:db-save:start", {
      productId: params.productId,
      analysisId: params.analysisId,
    });
    const saveResult = await saveProductAnalysisSuccess({
      profileId: params.profileId,
      storeId: params.storeId,
      productId: params.productId,
      analysisId: params.analysisId,
      analysis,
    });

    if (!saveResult.ok) {
      analysisDebug("background:db-save:failed", {
        productId: params.productId,
        analysisId: params.analysisId,
        code: saveResult.code,
        message: saveResult.message,
        elapsedMs: Date.now() - startedAt,
      });
      await saveProductAnalysisFailure({
        profileId: params.profileId,
        storeId: params.storeId,
        productId: params.productId,
        analysisId: params.analysisId,
        errorCode: saveResult.code ?? "analysis_save_failed",
        errorMessage: saveResult.message,
      });
      analysisDebug("background:failure-saved", {
        productId: params.productId,
        analysisId: params.analysisId,
        code: saveResult.code ?? "analysis_save_failed",
      });
      return;
    }

    analysisDebug("background:db-save:success", {
      productId: params.productId,
      analysisId: params.analysisId,
      elapsedMs: Date.now() - startedAt,
      status: saveResult.data.status,
      overallScore: saveResult.data.overallScore,
    });
  } catch (error) {
    const serviceError =
      error instanceof AiServiceError
        ? error
        : new AiServiceError({
            code: "analysis_failed",
            message: "Analiz tamamlanamadı.",
            status: 500,
          });

    analysisDebug("background:failed", {
      productId: params.productId,
      analysisId: params.analysisId,
      code: serviceError.code,
      status: serviceError.status,
      message: serviceError.message,
      elapsedMs: Date.now() - startedAt,
    });

    await saveProductAnalysisFailure({
      profileId: params.profileId,
      storeId: params.storeId,
      productId: params.productId,
      analysisId: params.analysisId,
      errorCode: serviceError.code,
      errorMessage: serviceError.message,
    });
    analysisDebug("background:failure-saved", {
      productId: params.productId,
      analysisId: params.analysisId,
      code: serviceError.code,
    });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return failureResponse("unauthorized", "Oturum gerekli.", 401);
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return failureResponse(
      "invalid_product_id",
      "Geçersiz ürün kimliği.",
      400,
    );
  }

  analysisDebug("poll:start", {
    profileId: user.id,
    productId: params.data.productId,
  });

  const analysisResult = await getLatestProductAnalysis({
    profileId: user.id,
    productId: params.data.productId,
  });

  if (!analysisResult.ok) {
    analysisDebug("poll:lookup:failed", {
      profileId: user.id,
      productId: params.data.productId,
      code: analysisResult.code,
      message: analysisResult.message,
    });
    return failureResponse(
      analysisResult.code ?? "analysis_lookup_failed",
      analysisResult.message,
      analysisResult.status ?? 400,
    );
  }

  analysisDebug("poll:lookup:success", {
    profileId: user.id,
    productId: params.data.productId,
    status: analysisResult.data?.status ?? null,
    analysisId: analysisResult.data?.id ?? null,
  });

  return NextResponse.json({
    ok: true,
    productId: params.data.productId,
    analysis: analysisResult.data,
  } satisfies AnalyzeProductStatusApiResponse);
}

export async function POST(_request: Request, context: RouteContext) {
  const requestStartedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return failureResponse("unauthorized", "Oturum gerekli.", 401);
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return failureResponse(
      "invalid_product_id",
      "Geçersiz ürün kimliği.",
      400,
    );
  }

  analysisDebug("post:start", {
    profileId: user.id,
    productId: params.data.productId,
  });

  const creditResult = await canStartAnalysis(user.id);

  if (!creditResult.ok) {
    return failureResponse(
      creditResult.code,
      creditResult.message,
      creditResult.status,
    );
  }

  const productResult = await getProductAnalysisContextForProfile({
    profileId: user.id,
    productId: params.data.productId,
  });

  if (!productResult.ok) {
    analysisDebug("post:product-context:failed", {
      profileId: user.id,
      productId: params.data.productId,
      code: productResult.code,
      message: productResult.message,
    });
    return failureResponse(
      productResult.code ?? "product_lookup_failed",
      productResult.message,
      productResult.code === "product_not_found" ? 404 : 400,
    );
  }

  const { product, productInput } = productResult.data;

  if (!productInput) {
    analysisDebug("post:product-input:unavailable", {
      profileId: user.id,
      productId: params.data.productId,
      message: productResult.data.analysisUnavailableMessage,
    });
    return failureResponse(
      "analysis_unavailable",
      productResult.data.analysisUnavailableMessage ??
        "AI analizi için ürün URL adresi ve tarama bilgisi gerekli.",
      422,
    );
  }

  analysisDebug("post:product-input:ready", {
    profileId: user.id,
    productId: product.id,
    storeId: product.storeId,
    source: productInput.source,
    url: productInput.url,
    crawlStatus: productInput.crawlMetadata.crawlStatus,
  });

  const runResult = await startProductAnalysisRun({
    profileId: user.id,
    storeId: product.storeId,
    productId: product.id,
    snapshot: {
      title: product.title,
      description: product.description,
      descriptionHtml: product.descriptionHtml,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      tags: product.tags,
      rawPayload: productInput,
    },
  });

  if (!runResult.ok) {
    analysisDebug("post:run-start:failed", {
      profileId: user.id,
      productId: product.id,
      storeId: product.storeId,
      code: runResult.code,
      message: runResult.message,
    });
    return failureResponse(
      runResult.code ?? "analysis_start_failed",
      runResult.message,
      runResult.status ?? 500,
    );
  }

  analysisDebug("post:run-start:success", {
    profileId: user.id,
    productId: product.id,
    storeId: product.storeId,
    analysisId: runResult.data.analysisId,
    elapsedMs: Date.now() - requestStartedAt,
  });

  after(() =>
    runProductAnalysisInBackground({
      profileId: user.id,
      storeId: product.storeId,
      productId: product.id,
      analysisId: runResult.data.analysisId,
      productInput,
    }),
  );

  analysisDebug("post:after-scheduled", {
    profileId: user.id,
    productId: product.id,
    analysisId: runResult.data.analysisId,
    elapsedMs: Date.now() - requestStartedAt,
  });

  return NextResponse.json(
    {
      ok: true,
      productId: product.id,
      analysisId: runResult.data.analysisId,
      status: "running",
      message: "Analiz başlatıldı.",
    } satisfies AnalyzeProductApiResponse,
    { status: 202 },
  );
}

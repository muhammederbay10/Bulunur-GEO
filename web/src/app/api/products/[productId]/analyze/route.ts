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

async function runProductAnalysisInBackground(params: {
  profileId: string;
  storeId: string;
  productId: string;
  analysisId: string;
  productInput: ProductInput;
}) {
  try {
    const analysis = await analyzeProduct(params.productInput);
    const saveResult = await saveProductAnalysisSuccess({
      profileId: params.profileId,
      storeId: params.storeId,
      productId: params.productId,
      analysisId: params.analysisId,
      analysis,
    });

    if (!saveResult.ok) {
      await saveProductAnalysisFailure({
        profileId: params.profileId,
        storeId: params.storeId,
        productId: params.productId,
        analysisId: params.analysisId,
        errorCode: saveResult.code ?? "analysis_save_failed",
        errorMessage: saveResult.message,
      });
    }
  } catch (error) {
    const serviceError =
      error instanceof AiServiceError
        ? error
        : new AiServiceError({
            code: "analysis_failed",
            message: "Analiz tamamlanamadı.",
            status: 500,
          });

    await saveProductAnalysisFailure({
      profileId: params.profileId,
      storeId: params.storeId,
      productId: params.productId,
      analysisId: params.analysisId,
      errorCode: serviceError.code,
      errorMessage: serviceError.message,
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

  const analysisResult = await getLatestProductAnalysis({
    profileId: user.id,
    productId: params.data.productId,
  });

  if (!analysisResult.ok) {
    return failureResponse(
      analysisResult.code ?? "analysis_lookup_failed",
      analysisResult.message,
      analysisResult.status ?? 400,
    );
  }

  return NextResponse.json({
    ok: true,
    productId: params.data.productId,
    analysis: analysisResult.data,
  } satisfies AnalyzeProductStatusApiResponse);
}

export async function POST(_request: Request, context: RouteContext) {
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

  const productResult = await getProductAnalysisContextForProfile({
    profileId: user.id,
    productId: params.data.productId,
  });

  if (!productResult.ok) {
    return failureResponse(
      productResult.code ?? "product_lookup_failed",
      productResult.message,
      productResult.code === "product_not_found" ? 404 : 400,
    );
  }

  const { product, productInput } = productResult.data;

  if (!productInput) {
    return failureResponse(
      "analysis_unavailable",
      productResult.data.analysisUnavailableMessage ??
        "AI analizi için ürün URL adresi ve tarama bilgisi gerekli.",
      422,
    );
  }

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
    return failureResponse(
      runResult.code ?? "analysis_start_failed",
      runResult.message,
      runResult.status ?? 500,
    );
  }

  after(() =>
    runProductAnalysisInBackground({
      profileId: user.id,
      storeId: product.storeId,
      productId: product.id,
      analysisId: runResult.data.analysisId,
      productInput,
    }),
  );

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

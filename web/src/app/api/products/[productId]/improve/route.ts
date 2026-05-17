import { NextResponse } from "next/server";
import { z } from "zod";

import { AiServiceError, improveProduct } from "@/lib/ai/client";
import { getLatestProductAnalysis } from "@/lib/db/analysis-repository";
import {
  normalizeUserFacts,
  saveOptimizationFailure,
  saveOptimizationResult,
  startProductOptimizationAttempt,
} from "@/lib/db/optimization-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";
import type { ImproveProductApiResponse } from "@/types/analysis";

const paramsSchema = z.object({
  productId: z.uuid(),
});

const improveRequestSchema = z.object({
  userFacts: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
});

type RouteContext = {
  params: Promise<{
    productId?: string | string[];
  }>;
};

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function failureResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
      message,
    } satisfies ImproveProductApiResponse,
    { status },
  );
}

export async function POST(request: Request, context: RouteContext) {
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

  const parsedBody = improveRequestSchema.safeParse(await readJsonBody(request));

  if (!parsedBody.success) {
    return failureResponse(
      "invalid_improve_request",
      "Geçersiz optimizasyon isteği.",
      400,
    );
  }

  const [productResult, analysisResult] = await Promise.all([
    getProductAnalysisContextForProfile({
      profileId: user.id,
      productId: params.data.productId,
    }),
    getLatestProductAnalysis({
      profileId: user.id,
      productId: params.data.productId,
    }),
  ]);

  if (!productResult.ok) {
    return failureResponse(
      productResult.code ?? "product_lookup_failed",
      productResult.message,
      productResult.code === "product_not_found" ? 404 : 400,
    );
  }

  if (!analysisResult.ok) {
    return failureResponse(
      analysisResult.code ?? "analysis_lookup_failed",
      analysisResult.message,
      analysisResult.status ?? 400,
    );
  }

  if (!analysisResult.data?.rawOutput || analysisResult.data.status !== "succeeded") {
    return failureResponse(
      "analysis_required",
      "Optimizasyon için önce başarılı bir analiz gerekli.",
      409,
    );
  }

  const { product, productInput } = productResult.data;
  const normalizedUserFacts = normalizeUserFacts(parsedBody.data.userFacts);
  const userFacts =
    Object.keys(normalizedUserFacts).length > 0 ? normalizedUserFacts : undefined;
  const startResult = await startProductOptimizationAttempt({
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
      rawPayload: {
        productInput,
        analysis: analysisResult.data.rawOutput,
        userFacts: userFacts ?? null,
      },
    },
  });

  if (!startResult.ok) {
    return failureResponse(
      startResult.code ?? "optimization_start_failed",
      startResult.message,
      startResult.status ?? 500,
    );
  }

  try {
    const improvement = await improveProduct({
      productInput,
      analysis: analysisResult.data.rawOutput,
      userFacts,
    });
    const saveResult = await saveOptimizationResult({
      profileId: user.id,
      storeId: product.storeId,
      productId: product.id,
      analysisId: analysisResult.data.id,
      improvement,
    });

    if (!saveResult.ok) {
      return failureResponse(
        saveResult.code ?? "optimization_save_failed",
        saveResult.message,
        saveResult.status ?? 500,
      );
    }

    return NextResponse.json({
      ok: true,
      productId: product.id,
      optimizationResultId: saveResult.data.id,
      status: saveResult.data.status,
      improvement,
    } satisfies ImproveProductApiResponse);
  } catch (error) {
    const serviceError =
      error instanceof AiServiceError
        ? error
        : new AiServiceError({
            code: "optimization_failed",
            message: "Optimizasyon tamamlanamadı.",
            status: 500,
          });

    await saveOptimizationFailure({
      profileId: user.id,
      storeId: product.storeId,
      productId: product.id,
      analysisId: analysisResult.data.id,
      errorCode: serviceError.code,
      errorMessage: serviceError.message,
    });

    return failureResponse(
      serviceError.code,
      serviceError.message,
      serviceError.status,
    );
  }
}

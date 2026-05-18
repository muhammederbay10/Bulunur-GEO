import { after, NextResponse } from "next/server";
import { z } from "zod";

import { AiServiceError, improveProduct } from "@/lib/ai/client";
import { getLatestProductAnalysis } from "@/lib/db/analysis-repository";
import {
  getLatestOptimizationResult,
  mergeUserFacts,
  normalizeUserFacts,
  saveOptimizationFailure,
  saveOptimizationResult,
  startProductOptimizationAttempt,
} from "@/lib/db/optimization-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";
import type {
  GeoAnalysisOutput,
  GeoImprovementOutput,
  ProductInput,
  UserFactQuestion,
} from "@/types/ai-contract";
import type {
  ImproveProductApiResponse,
  ImproveProductStatusApiResponse,
  ProductAnalysisDetail,
} from "@/types/analysis";

export const maxDuration = 60;

const paramsSchema = z.object({
  productId: z.uuid(),
});

const improveRequestSchema = z.object({
  userFacts: z.record(z.string(), z.unknown()).optional(),
});

const availabilityValues = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "backorder",
  "unknown",
];

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

function questionInputType(question: UserFactQuestion) {
  return question.field === "availability" ? "select" : question.inputType;
}

function questionOptionValues(question: UserFactQuestion) {
  if (question.field === "availability") {
    return availabilityValues;
  }

  return question.options.map((option) => option.value);
}

function validateUserFactsForQuestions(params: {
  userFacts?: Record<string, unknown>;
  questions: UserFactQuestion[];
}):
  | { ok: true }
  | { ok: false; message: string; status: number; code: string } {
  if (!params.userFacts) {
    return { ok: true };
  }

  const availabilityAnswer = params.userFacts.availability;

  if (
    availabilityAnswer !== undefined &&
    availabilityAnswer !== null &&
    (typeof availabilityAnswer !== "string" ||
      !availabilityValues.includes(availabilityAnswer))
  ) {
    return {
      ok: false,
      code: "invalid_user_fact_answer",
      message: "Stok durumu icin gecerli bir secenek secin.",
      status: 400,
    };
  }

  for (const question of params.questions) {
    const answer = params.userFacts[question.field];

    if (answer === undefined || answer === null) {
      continue;
    }

    if (questionInputType(question) !== "select") {
      continue;
    }

    const allowedValues = questionOptionValues(question);

    if (typeof answer !== "string" || !allowedValues.includes(answer)) {
      return {
        ok: false,
        code: "invalid_user_fact_answer",
        message:
          question.field === "availability"
            ? "Stok durumu iÃ§in geÃ§erli bir seÃ§enek seÃ§in."
            : "Eksik bilgi sorusu iÃ§in geÃ§erli bir seÃ§enek seÃ§in.",
        status: 400,
      };
    }
  }

  return { ok: true };
}

function withAnalysisBeforeScore(params: {
  improvement: GeoImprovementOutput;
  analysis: GeoAnalysisOutput;
}): GeoImprovementOutput {
  const beforeScore = params.analysis.overallScore;
  const scoreEstimate = params.improvement.scoreEstimate;
  const afterScore = scoreEstimate?.after;

  if (
    params.improvement.needsUserInput.length > 0 ||
    !scoreEstimate ||
    typeof beforeScore !== "number" ||
    typeof afterScore !== "number"
  ) {
    return params.improvement;
  }

  return {
    ...params.improvement,
    scoreEstimate: {
      ...scoreEstimate,
      before: beforeScore,
    },
  };
}

async function runProductOptimizationInBackground(params: {
  profileId: string;
  product: ProductAnalysisDetail;
  productInput: ProductInput;
  analysisId: string;
  analysis: GeoAnalysisOutput;
  userFacts?: Record<string, unknown>;
}) {
  try {
    const improvement = await improveProduct({
      productInput: params.productInput,
      analysis: params.analysis,
      userFacts: params.userFacts,
    });
    const improvementWithBeforeScore = withAnalysisBeforeScore({
      improvement,
      analysis: params.analysis,
    });
    const saveResult = await saveOptimizationResult({
      profileId: params.profileId,
      storeId: params.product.storeId,
      productId: params.product.id,
      analysisId: params.analysisId,
      improvement: improvementWithBeforeScore,
    });

    if (!saveResult.ok) {
      await saveOptimizationFailure({
        profileId: params.profileId,
        storeId: params.product.storeId,
        productId: params.product.id,
        analysisId: params.analysisId,
        errorCode: saveResult.code ?? "optimization_save_failed",
        errorMessage: saveResult.message,
      });
    }
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
      profileId: params.profileId,
      storeId: params.product.storeId,
      productId: params.product.id,
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

  const [productResult, optimizationResult] = await Promise.all([
    getProductAnalysisContextForProfile({
      profileId: user.id,
      productId: params.data.productId,
    }),
    getLatestOptimizationResult({
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

  if (!optimizationResult.ok) {
    return failureResponse(
      optimizationResult.code ?? "optimization_lookup_failed",
      optimizationResult.message,
      optimizationResult.status ?? 400,
    );
  }

  return NextResponse.json({
    ok: true,
    productId: params.data.productId,
    workflowStatus: productResult.data.product.workflowStatus,
    optimization: optimizationResult.data,
  } satisfies ImproveProductStatusApiResponse);
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

  const [productResult, analysisResult, optimizationResult] = await Promise.all([
    getProductAnalysisContextForProfile({
      profileId: user.id,
      productId: params.data.productId,
    }),
    getLatestProductAnalysis({
      profileId: user.id,
      productId: params.data.productId,
    }),
    getLatestOptimizationResult({
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

  if (!optimizationResult.ok) {
    return failureResponse(
      optimizationResult.code ?? "optimization_lookup_failed",
      optimizationResult.message,
      optimizationResult.status ?? 400,
    );
  }

  if (!analysisResult.data?.rawOutput || analysisResult.data.status !== "succeeded") {
    return failureResponse(
      "analysis_required",
      "Optimizasyon için önce başarılı bir analiz gerekli.",
      409,
    );
  }

  const latestAnalysis = analysisResult.data;
  const { product, productInput } = productResult.data;

  if (!productInput) {
    return failureResponse(
      "optimization_unavailable",
      productResult.data.analysisUnavailableMessage ??
        "Optimizasyon için AI uyumlu ürün URL adresi ve tarama bilgisi gerekli.",
      422,
    );
  }

  const userFactValidation = validateUserFactsForQuestions({
    userFacts: parsedBody.data.userFacts,
    questions: optimizationResult.data?.needsUserInput ?? [],
  });

  if (!userFactValidation.ok) {
    return failureResponse(
      userFactValidation.code,
      userFactValidation.message,
      userFactValidation.status,
    );
  }

  const normalizedUserFacts = normalizeUserFacts(parsedBody.data.userFacts);
  const mergedUserFacts = mergeUserFacts(
    optimizationResult.data?.userConfirmedFacts,
    normalizedUserFacts,
  );
  const userFacts =
    Object.keys(mergedUserFacts).length > 0 ? mergedUserFacts : undefined;
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
        analysis: latestAnalysis.rawOutput,
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

  after(() =>
    runProductOptimizationInBackground({
      profileId: user.id,
      product,
      productInput,
      analysisId: latestAnalysis.id,
      analysis: latestAnalysis.rawOutput as GeoAnalysisOutput,
      userFacts,
    }),
  );

  return NextResponse.json(
    {
      ok: true,
      productId: product.id,
      status: "optimization_running",
      message: "Optimizasyon başlatıldı.",
    } satisfies ImproveProductApiResponse,
    { status: 202 },
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getLatestOptimizationResult,
  saveReviewActions,
} from "@/lib/db/optimization-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";
import { getShopifyPublishableFieldCandidates } from "@/lib/publishing/fields";
import type { ShopifyPublishableField } from "@/types/shopify";

const shopifyPublishFieldSchema = z.enum([
  "title",
  "descriptionHtml",
  "tags",
  "seo.title",
  "seo.description",
]);

const paramsSchema = z.object({
  productId: z.uuid(),
});

const reviewActionsRequestSchema = z.object({
  approvedFields: z.array(shopifyPublishFieldSchema).max(5),
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
    },
    { status },
  );
}

function isReviewableStatus(status: string) {
  return status === "ready_for_review" || status === "approved";
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
      "GeÃ§ersiz Ã¼rÃ¼n kimliÄŸi.",
      400,
    );
  }

  const parsedBody = reviewActionsRequestSchema.safeParse(
    await readJsonBody(request),
  );

  if (!parsedBody.success) {
    return failureResponse(
      "invalid_review_request",
      "Onay alanlarÄ± geÃ§erli deÄŸil.",
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

  if (!optimizationResult.data) {
    return failureResponse(
      "optimization_required",
      "Onaylamak iÃ§in Ã¶nce kayÄ±tlÄ± optimizasyon sonucu gerekli.",
      409,
    );
  }

  if (!isReviewableStatus(optimizationResult.data.status)) {
    return failureResponse(
      "optimization_not_ready",
      "YalnÄ±zca incelemeye hazÄ±r optimizasyon sonuÃ§larÄ± onaylanabilir.",
      409,
    );
  }

  const product = productResult.data.product;

  if (product.source !== "shopify") {
    return failureResponse(
      "shopify_only",
      "Alan onayÄ± sadece Shopify Ã¼rÃ¼nleri iÃ§in kullanÄ±labilir.",
      400,
    );
  }

  const candidates = getShopifyPublishableFieldCandidates(
    optimizationResult.data,
  );

  if (candidates.length === 0) {
    return failureResponse(
      "no_publishable_fields",
      "Shopify iÃ§in onaylanabilir gÃ¼venli alan bulunamadÄ±.",
      409,
    );
  }

  const selectedFields = new Set<ShopifyPublishableField>(
    parsedBody.data.approvedFields,
  );
  const reviewResult = await saveReviewActions({
    profileId: user.id,
    storeId: product.storeId,
    productId: product.id,
    optimizationResultId: optimizationResult.data.id,
    actions: candidates.map((candidate) => ({
      fieldPath: candidate.field,
      decision: selectedFields.has(candidate.field) ? "approved" : "rejected",
      approvedValue: selectedFields.has(candidate.field)
        ? candidate.value
        : undefined,
    })),
  });

  if (!reviewResult.ok) {
    return failureResponse(
      reviewResult.code ?? "review_save_failed",
      reviewResult.message,
      reviewResult.status ?? 500,
    );
  }

  return NextResponse.json({
    ok: true,
    productId: product.id,
    optimizationResultId: optimizationResult.data.id,
    approvedFields: parsedBody.data.approvedFields,
    savedCount: reviewResult.data.savedCount,
  });
}

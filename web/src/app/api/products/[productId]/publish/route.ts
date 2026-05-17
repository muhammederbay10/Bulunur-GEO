import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getLatestOptimizationResult,
  saveReviewActions,
} from "@/lib/db/optimization-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";
import { getShopifyPublishableFieldCandidates } from "@/lib/publishing/fields";
import { publishApprovedFields } from "@/lib/publishing/service";
import type { PublishProductApiResponse } from "@/types/analysis";

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

const publishRequestSchema = z.object({
  approvedFields: z.array(shopifyPublishFieldSchema).min(1).max(5),
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
    } satisfies PublishProductApiResponse,
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

  const parsedBody = publishRequestSchema.safeParse(
    await readJsonBody(request),
  );

  if (!parsedBody.success) {
    return failureResponse(
      "invalid_publish_request",
      "Yayınlamak için en az bir güvenli alan seçin.",
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
      "Yayınlama için önce kayıtlı optimizasyon sonucu gerekli.",
      409,
    );
  }

  if (
    optimizationResult.data.status !== "ready_for_review" &&
    optimizationResult.data.status !== "approved"
  ) {
    return failureResponse(
      "optimization_not_ready",
      "Yalnızca hazır optimizasyon sonuçları yayınlanabilir.",
      409,
    );
  }

  const product = productResult.data.product;

  if (product.source !== "shopify") {
    return failureResponse(
      "shopify_only",
      "Yayınlama sadece Shopify ürünleri için kullanılabilir.",
      400,
    );
  }

  const candidates = getShopifyPublishableFieldCandidates(
    optimizationResult.data,
  );
  const selectedFields = new Set(parsedBody.data.approvedFields);
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

  const publishResult = await publishApprovedFields({
    profileId: user.id,
    product,
    optimization: optimizationResult.data,
    approvedFieldPaths: parsedBody.data.approvedFields,
  });

  if (!publishResult.ok) {
    return failureResponse(
      publishResult.code,
      publishResult.message,
      publishResult.status,
    );
  }

  return NextResponse.json({
    ok: true,
    productId: product.id,
    publishJobId: publishResult.data.publishJobId,
    publishedFields: publishResult.data.publishedFields,
  } satisfies PublishProductApiResponse);
}

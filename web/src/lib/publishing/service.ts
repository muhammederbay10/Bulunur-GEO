import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOwnedShopifySyncContext,
  getShopifyConnectionSecret,
} from "@/lib/db/shopify-repository";
import { decryptShopifyAccessToken } from "@/lib/shopify/encryption";
import { updateShopifyProduct } from "@/lib/shopify/products";
import { syncShopifyProductsForConnection } from "@/lib/shopify/service";
import { getShopifyPublishableFieldCandidates } from "@/lib/publishing/fields";
import type {
  OptimizationResultRecord,
  ProductAnalysisDetail,
} from "@/types/analysis";
import type {
  ShopifyProductUpdateInput,
  ShopifyPublishableField,
} from "@/types/shopify";

export type ApprovedPublishField = {
  field: ShopifyPublishableField;
  value: string | string[] | null;
};

type PublishApprovedFieldsResult =
  | {
      ok: true;
      data: {
        publishJobId: string;
        publishedFields: ShopifyPublishableField[];
      };
    }
  | { ok: false; message: string; code: string; status: number };

function publishingStorageSetupMessage() {
  return "Yayınlama tabloları hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function isMissingPublishingTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("publish_jobs") ||
    message.includes("publish_logs") ||
    message.includes("product_snapshots")
  );
}

function safePublishError(error: unknown) {
  if (error instanceof Error && error.name === "MissingShopifyConfigError") {
    return {
      code: "missing_shopify_config",
      message: "Shopify sunucu ayarlari eksik.",
      status: 503,
    };
  }

  return {
    code: "shopify_publish_failed",
    message: "Shopify yayınlama işlemi tamamlanamadı.",
    status: 502,
  };
}

async function writePublishLog(params: {
  profileId: string;
  publishJobId: string;
  level: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();

  await supabase.from("publish_logs").insert({
    profile_id: params.profileId,
    publish_job_id: params.publishJobId,
    level: params.level,
    message: params.message,
    details: params.details ?? {},
  });
}

function createShopifyProductUpdate(params: {
  product: ProductAnalysisDetail;
  fields: ApprovedPublishField[];
}): ShopifyProductUpdateInput {
  if (!params.product.externalId?.startsWith("gid://shopify/Product/")) {
    throw new Error("Geçersiz Shopify ürün ID'si.");
  }

  const update: ShopifyProductUpdateInput = {
    id: params.product.externalId,
  };
  const seo: NonNullable<ShopifyProductUpdateInput["seo"]> = {};

  for (const field of params.fields) {
    if (field.field === "title" && typeof field.value === "string") {
      update.title = field.value;
    }

    if (
      field.field === "descriptionHtml" &&
      typeof field.value === "string"
    ) {
      update.descriptionHtml = field.value;
    }

    if (field.field === "tags" && Array.isArray(field.value)) {
      update.tags = field.value;
    }

    if (field.field === "seo.title" && typeof field.value === "string") {
      seo.title = field.value;
    }

    if (
      field.field === "seo.description" &&
      typeof field.value === "string"
    ) {
      seo.description = field.value;
    }
  }

  if (Object.keys(seo).length > 0) {
    update.seo = seo;
  }

  if (Object.keys(update).length === 1) {
    throw new Error("No approved Shopify fields.");
  }

  return update;
}

async function createRollbackSnapshot(params: {
  profileId: string;
  product: ProductAnalysisDetail;
  rawPayload: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_snapshots")
    .insert({
      profile_id: params.profileId,
      store_id: params.product.storeId,
      product_id: params.product.id,
      snapshot_type: "before_publish",
      title: params.product.title,
      description: params.product.description ?? null,
      description_html: params.product.descriptionHtml ?? null,
      seo_title: params.product.seoTitle ?? null,
      seo_description: params.product.seoDescription ?? null,
      tags: params.product.tags,
      raw_payload: params.rawPayload,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    return {
      ok: false as const,
      message: error && isMissingPublishingTable(error)
        ? publishingStorageSetupMessage()
        : "Yayınlama öncesi geri alma yedeği kaydedilemedi.",
      code: error?.code ?? "rollback_snapshot_failed",
      status: 500,
    };
  }

  return { ok: true as const, data };
}

async function createPublishJob(params: {
  profileId: string;
  product: ProductAnalysisDetail;
  optimizationResultId: string;
  approvedFields: ApprovedPublishField[];
  rollbackSnapshotId: string;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("publish_jobs")
    .insert({
      profile_id: params.profileId,
      store_id: params.product.storeId,
      product_id: params.product.id,
      optimization_result_id: params.optimizationResultId,
      target: "shopify_publish",
      status: "running",
      approved_fields: params.approvedFields,
      rollback_snapshot_id: params.rollbackSnapshotId,
      started_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    return {
      ok: false as const,
      message: error && isMissingPublishingTable(error)
        ? publishingStorageSetupMessage()
        : "Yayınlama kaydı başlatılamadı.",
      code: error?.code ?? "publish_job_failed",
      status: 500,
    };
  }

  return { ok: true as const, data };
}

async function finishPublishJob(params: {
  profileId: string;
  publishJobId: string;
  status: "succeeded" | "failed";
}) {
  const supabase = createAdminClient();

  await supabase
    .from("publish_jobs")
    .update({
      status: params.status,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.publishJobId)
    .eq("profile_id", params.profileId);
}

async function markPublished(params: {
  profileId: string;
  product: ProductAnalysisDetail;
  optimization: OptimizationResultRecord;
  update: ShopifyProductUpdateInput;
}) {
  const supabase = createAdminClient();
  const productUpdate: Record<string, unknown> = {
    workflow_status: "published",
  };

  if (typeof params.update.title === "string") {
    productUpdate.title = params.update.title;
  }

  if (typeof params.update.descriptionHtml === "string") {
    productUpdate.description_html = params.update.descriptionHtml;
  }

  if (Array.isArray(params.update.tags)) {
    productUpdate.tags = params.update.tags;
  }

  if (params.update.seo) {
    if (typeof params.update.seo.title === "string") {
      productUpdate.seo_title = params.update.seo.title;
    }

    if (typeof params.update.seo.description === "string") {
      productUpdate.seo_description = params.update.seo.description;
    }
  }

  await Promise.all([
    supabase
      .from("products")
      .update(productUpdate)
      .eq("id", params.product.id)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.product.storeId)
      .eq("source", "shopify"),
    supabase
      .from("optimization_results")
      .update({ status: "published" })
      .eq("id", params.optimization.id)
      .eq("profile_id", params.profileId)
      .eq("product_id", params.product.id),
  ]);
}

export async function publishApprovedFields(params: {
  profileId: string;
  product: ProductAnalysisDetail;
  optimization: OptimizationResultRecord;
  approvedFieldPaths: ShopifyPublishableField[];
}): Promise<PublishApprovedFieldsResult> {
  if (params.product.source !== "shopify") {
    return {
      ok: false,
      message: "Yayınlama sadece Shopify ürünleri için kullanılabilir.",
      code: "shopify_only",
      status: 400,
    };
  }

  const candidates = getShopifyPublishableFieldCandidates(params.optimization);
  const approvedFields = candidates
    .filter((candidate) => params.approvedFieldPaths.includes(candidate.field))
    .map((candidate) => ({
      field: candidate.field,
      value: candidate.value,
    }));

  if (approvedFields.length === 0) {
    return {
      ok: false,
      message: "Yayınlamak için en az bir güvenli alan seçilmeli.",
      code: "no_approved_fields",
      status: 400,
    };
  }

  const shopifyContext = await getOwnedShopifySyncContext(
    params.profileId,
    params.product.storeId,
  );

  if (!shopifyContext.ok) {
    return {
      ok: false,
      message: shopifyContext.message,
      code: shopifyContext.code ?? "shopify_connection_not_found",
      status: 400,
    };
  }

  if (shopifyContext.data.connection.status !== "connected") {
    return {
      ok: false,
      message: "Shopify bağlantısı aktif değil. Yeniden bağlanın.",
      code: "shopify_connection_not_connected",
      status: 409,
    };
  }

  if (!shopifyContext.data.connection.shopDomain) {
    return {
      ok: false,
      message: "Shopify mağaza alan adı bulunamadı. Yeniden bağlanın.",
      code: "missing_shop_domain",
      status: 409,
    };
  }

  if (!shopifyContext.data.connection.scopes.includes("write_products")) {
    return {
      ok: false,
      message:
        "Shopify bağlantısında ürün yazma izni yok. write_products izniyle yeniden bağlanın.",
      code: "missing_write_products_scope",
      status: 409,
    };
  }

  const secret = await getShopifyConnectionSecret(
    params.profileId,
    shopifyContext.data.connection.id,
  );

  if (!secret.ok || !secret.data.accessTokenCiphertext) {
    return {
      ok: false,
      message: secret.ok
        ? "Shopify erişim anahtarı bulunamadı. Yeniden bağlanın."
        : secret.message,
      code: secret.ok ? "missing_shopify_token" : secret.code ?? "secret_error",
      status: 409,
    };
  }

  const update = createShopifyProductUpdate({
    product: params.product,
    fields: approvedFields,
  });
  const rollback = await createRollbackSnapshot({
    profileId: params.profileId,
    product: params.product,
    rawPayload: {
      approvedFields,
      optimizationResultId: params.optimization.id,
    },
  });

  if (!rollback.ok) {
    return rollback;
  }

  const job = await createPublishJob({
    profileId: params.profileId,
    product: params.product,
    optimizationResultId: params.optimization.id,
    approvedFields,
    rollbackSnapshotId: rollback.data.id,
  });

  if (!job.ok) {
    return job;
  }

  await writePublishLog({
    profileId: params.profileId,
    publishJobId: job.data.id,
    level: "info",
    message: "Shopify yayınlama başlatıldı.",
    details: {
      fields: approvedFields.map((field) => field.field),
    },
  });

  try {
    const accessToken = decryptShopifyAccessToken(
      secret.data.accessTokenCiphertext,
    );
    const result = await updateShopifyProduct({
      shop: shopifyContext.data.connection.shopDomain,
      accessToken,
      product: update,
    });

    if (result.userErrors.length > 0) {
      await writePublishLog({
        profileId: params.profileId,
        publishJobId: job.data.id,
        level: "error",
        message: "Shopify alanları reddetti.",
        details: { userErrors: result.userErrors },
      });
      await finishPublishJob({
        profileId: params.profileId,
        publishJobId: job.data.id,
        status: "failed",
      });

      return {
        ok: false,
        message: "Shopify yayınlama isteğini reddetti.",
        code: "shopify_user_errors",
        status: 422,
      };
    }

    await markPublished({
      profileId: params.profileId,
      product: params.product,
      optimization: params.optimization,
      update,
    });
    const syncResult = await syncShopifyProductsForConnection({
      profileId: params.profileId,
      storeId: params.product.storeId,
    });

    if (!syncResult.ok) {
      await writePublishLog({
        profileId: params.profileId,
        publishJobId: job.data.id,
        level: "warning",
        message: "Yayınlama başarılı oldu ama yeniden senkronizasyon tamamlanamadı.",
        details: { code: syncResult.code },
      });
    }

    await writePublishLog({
      profileId: params.profileId,
      publishJobId: job.data.id,
      level: "info",
      message: "Shopify yayınlama tamamlandı.",
      details: { productId: result.product?.id ?? params.product.externalId },
    });
    await finishPublishJob({
      profileId: params.profileId,
      publishJobId: job.data.id,
      status: "succeeded",
    });

    return {
      ok: true,
      data: {
        publishJobId: job.data.id,
        publishedFields: approvedFields.map((field) => field.field),
      },
    };
  } catch (error) {
    const safeError = safePublishError(error);

    await writePublishLog({
      profileId: params.profileId,
      publishJobId: job.data.id,
      level: "error",
      message: safeError.message,
      details: { code: safeError.code },
    });
    await finishPublishJob({
      profileId: params.profileId,
      publishJobId: job.data.id,
      status: "failed",
    });

    return {
      ok: false,
      ...safeError,
    };
  }
}

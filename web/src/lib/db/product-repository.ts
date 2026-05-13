import "server-only";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopifyProductUpsert } from "@/lib/shopify/product-mapper";
import type { ProductSummary } from "@/types/product";

type ProductRow = {
  id: string;
  external_id?: string | null;
  store_id: string;
  source: "shopify" | "native" | "woocommerce";
  title: string;
  url: string | null;
  image_urls: string[] | null;
  price_display: string | null;
  availability: string | null;
  latest_score: number | null;
  workflow_status: ProductSummary["workflowStatus"];
  updated_at: string;
};

type ProductRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; isMissingTable?: boolean };

const productSummarySelect =
  "id,store_id,source,title,url,image_urls,price_display,availability,latest_score,workflow_status,updated_at";

const shopifyProductSyncSelect = "id,external_id";

function productStorageSetupMessage() {
  return "Urun tablolari hazir degil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasini calistir.";
}

function isMissingProductTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return error.code === "42P01" || message.includes("products");
}

function mapProductSummary(row: ProductRow): ProductSummary {
  return {
    id: row.id,
    storeId: row.store_id,
    source: row.source,
    title: row.title,
    url: row.url ?? undefined,
    imageUrl: row.image_urls?.[0],
    priceDisplay: row.price_display ?? undefined,
    availability: row.availability ?? undefined,
    latestScore: row.latest_score ?? undefined,
    workflowStatus: row.workflow_status,
    updatedAt: row.updated_at,
  };
}

export async function listProductsForCurrentUser(): Promise<ProductSummary[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const result = await listProductsForProfile(user.id);

  if (!result.ok) {
    return [];
  }

  return result.data;
}

export async function upsertShopifyProducts(
  products: ShopifyProductUpsert[],
): Promise<ProductRepositoryResult<{ syncedCount: number }>> {
  if (products.length === 0) {
    return { ok: true, data: { syncedCount: 0 } };
  }

  const supabase = createAdminClient();
  const externalIds = products.map((product) => product.external_id);
  const { data: existingProducts, error: lookupError } = await supabase
    .from("products")
    .select(shopifyProductSyncSelect)
    .eq("store_id", products[0].store_id)
    .eq("source", "shopify")
    .in("external_id", externalIds)
    .returns<Array<{ id: string; external_id: string | null }>>();

  if (lookupError) {
    const isMissingTable = isMissingProductTable(lookupError);

    console.error("[shopify-sync] product lookup failed", {
      code: lookupError.code,
      message: lookupError.message,
    });

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Shopify urunleri okunamadi.",
      code: lookupError.code,
      isMissingTable,
    };
  }

  const existingByExternalId = new Map(
    (existingProducts ?? [])
      .filter((product) => product.external_id)
      .map((product) => [product.external_id as string, product.id]),
  );
  const toUpdate = products
    .map((product) => ({
      product,
      id: existingByExternalId.get(product.external_id),
    }))
    .filter(
      (entry): entry is { product: ShopifyProductUpsert; id: string } =>
        Boolean(entry.id),
    );
  const toInsert = products.filter(
    (product) => !existingByExternalId.has(product.external_id),
  );

  for (const { product, id } of toUpdate) {
    const { error } = await supabase
      .from("products")
      .update(product)
      .eq("id", id)
      .eq("profile_id", product.profile_id)
      .eq("store_id", product.store_id)
      .eq("source", "shopify");

    if (error) {
      console.error("[shopify-sync] product update failed", {
        code: error.code,
        message: error.message,
      });

      return {
        ok: false,
        message: "Shopify urunu guncellenemedi.",
        code: error.code,
        isMissingTable: isMissingProductTable(error),
      };
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products").insert(toInsert);

    if (error) {
      console.error("[shopify-sync] product insert failed", {
        code: error.code,
        message: error.message,
      });

      return {
        ok: false,
        message: "Shopify urunleri kaydedilemedi.",
        code: error.code,
        isMissingTable: isMissingProductTable(error),
      };
    }
  }

  return {
    ok: true,
    data: {
      syncedCount: products.length,
    },
  };
}

export async function listProductsForProfile(
  profileId: string,
): Promise<ProductRepositoryResult<ProductSummary[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(productSummarySelect)
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<ProductRow[]>();

  if (error) {
    const isMissingTable = isMissingProductTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Urunler okunamadi.",
      code: error.code,
      isMissingTable,
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(mapProductSummary),
  };
}

export async function markShopifyProductsSourceDisconnected(params: {
  profileId: string;
  storeId: string;
}): Promise<ProductRepositoryResult<{ affectedCount: number }>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      availability: "source_disconnected",
    })
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId)
    .eq("source", "shopify")
    .select("id");

  if (error) {
    return {
      ok: false,
      message: "Shopify urunleri baglanti kesildi olarak isaretlenemedi.",
      code: error.code,
      isMissingTable: isMissingProductTable(error),
    };
  }

  return {
    ok: true,
    data: {
      affectedCount: data?.length ?? 0,
    },
  };
}

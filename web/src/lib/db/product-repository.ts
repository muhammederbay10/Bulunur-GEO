import "server-only";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopifyProductUpsert } from "@/lib/shopify/product-mapper";
import type { ProductSummary } from "@/types/product";

type ProductRow = {
  id: string;
  store_id: string;
  source: "shopify" | "native" | "woocommerce";
  title: string;
  url: string | null;
  image_urls: string[] | null;
  price_display: string | null;
  latest_score: number | null;
  workflow_status: ProductSummary["workflowStatus"];
  updated_at: string;
};

type ProductRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; isMissingTable?: boolean };

const productSummarySelect =
  "id,store_id,source,title,url,image_urls,price_display,latest_score,workflow_status,updated_at";

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
  const { data, error } = await supabase
    .from("products")
    .upsert(products, {
      onConflict: "store_id,source,external_id",
    })
    .select("id");

  if (error) {
    const isMissingTable = isMissingProductTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Shopify urunleri kaydedilemedi.",
      code: error.code,
      isMissingTable,
    };
  }

  return {
    ok: true,
    data: {
      syncedCount: data?.length ?? products.length,
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

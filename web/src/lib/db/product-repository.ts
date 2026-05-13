import "server-only";

import type { ScrapePreviewRow } from "@/lib/db/scrape-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopifyProductUpsert } from "@/lib/shopify/product-mapper";
import type { NativeFallbackImportItem } from "@/types/native-url-import";
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
const nativeProductImportSelect = "id,url";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNormalizedPayload(row: ScrapePreviewRow): Record<string, unknown> {
  const rawExtracted = row.raw_extracted ?? {};
  const normalized = rawExtracted.normalized;

  return isRecord(normalized) ? normalized : rawExtracted;
}

function fallbackImages(row: ScrapePreviewRow, normalized: Record<string, unknown>) {
  const normalizedImages = asStringArray(normalized.images);

  if (normalizedImages.length > 0) {
    return normalizedImages;
  }

  return row.image_urls ?? [];
}

function buildNativeProductPayload(params: {
  profileId: string;
  storeId: string;
  language: string;
  market: string;
  preview: ScrapePreviewRow;
}) {
  const normalized = getNormalizedPayload(params.preview);
  const productUrl = params.preview.product_url;
  const title =
    params.preview.title ??
    asString(normalized.title) ??
    asString(normalized.seoTitle) ??
    productUrl;
  const categories = asStringArray(normalized.categories);
  const extractionConfidence =
    asNumber(normalized.extractionConfidence) ??
    params.preview.confidence_score ??
    null;

  return {
    profile_id: params.profileId,
    store_id: params.storeId,
    source: "native",
    external_id: productUrl,
    external_handle: null,
    url: productUrl,
    language: params.language,
    market: params.market,
    title,
    description:
      asString(normalized.plainDescription) ??
      asString(normalized.shortDescription),
    description_html: asString(normalized.descriptionHtml),
    short_description: asString(normalized.shortDescription),
    seo_title: asString(normalized.seoTitle),
    seo_description: asString(normalized.seoDescription),
    tags: asStringArray(normalized.tags),
    vendor: asString(normalized.brand),
    product_type: categories[0] ?? null,
    price_display:
      params.preview.price_display ?? asString(normalized.priceDisplay),
    currency: asString(normalized.currency),
    availability: asString(normalized.stockDisplay),
    brand: asString(normalized.brand),
    category: categories[0] ?? null,
    image_urls: fallbackImages(params.preview, normalized),
    attributes: {
      sku: asString(normalized.sku),
      extractionConfidence,
      confidenceStatus: params.preview.confidence_status,
      warnings: asStringArray(normalized.warnings),
      extractionMethods: asStringArray(normalized.extractionMethods),
    },
    raw_source_payload: params.preview.raw_extracted ?? {},
    raw_extracted: params.preview.raw_extracted ?? {},
    crawl_metadata: params.preview.crawl_metadata ?? {},
    workflow_status: "not_analyzed",
  };
}

function buildNativeFallbackProductPayload(params: {
  profileId: string;
  storeId: string;
  language: string;
  market: string;
  item: NativeFallbackImportItem;
}) {
  return {
    profile_id: params.profileId,
    store_id: params.storeId,
    source: "native",
    external_id: params.item.productUrl,
    external_handle: null,
    url: params.item.productUrl,
    language: params.language,
    market: params.market,
    title: params.item.title,
    description: params.item.description,
    description_html: params.item.description,
    short_description: params.item.description,
    seo_title: params.item.title,
    seo_description: params.item.description,
    tags: params.item.tags,
    vendor: params.item.brand,
    product_type: params.item.category,
    price_display: params.item.priceDisplay,
    currency: params.item.currency,
    availability: null,
    brand: params.item.brand,
    category: params.item.category,
    image_urls: params.item.imageUrls,
    attributes: {
      sku: params.item.sku,
      fallbackSourceType: params.item.sourceType,
    },
    raw_source_payload: params.item.rawSourcePayload,
    raw_extracted: {
      normalized: {
        title: params.item.title,
        productUrl: params.item.productUrl,
        brand: params.item.brand,
        sku: params.item.sku,
        shortDescription: params.item.description,
        descriptionHtml: params.item.description,
        plainDescription: params.item.description,
        images: params.item.imageUrls,
        seoTitle: params.item.title,
        seoDescription: params.item.description,
        priceDisplay: params.item.priceDisplay,
        currency: params.item.currency,
        stockDisplay: null,
        tags: params.item.tags,
        categories: params.item.category ? [params.item.category] : [],
        extractionMethods: [`fallback_${params.item.sourceType}`],
        extractionConfidence: 100,
        confidenceStatus: "ready",
        warnings: [],
      },
      fallbackSourceType: params.item.sourceType,
      rawSourcePayload: params.item.rawSourcePayload,
    },
    crawl_metadata: {
      fallback: true,
      sourceType: params.item.sourceType,
      importedAt: new Date().toISOString(),
    },
    workflow_status: "not_analyzed",
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

export async function upsertNativeProductsFromPreviewItems(params: {
  profileId: string;
  storeId: string;
  language: string;
  market: string;
  previewItems: ScrapePreviewRow[];
}): Promise<
  ProductRepositoryResult<{
    importedCount: number;
    importedItems: Array<{ previewItemId: string; productId: string }>;
  }>
> {
  if (params.previewItems.length === 0) {
    return {
      ok: true,
      data: {
        importedCount: 0,
        importedItems: [],
      },
    };
  }

  const supabase = createAdminClient();
  const productUrls = params.previewItems.map((item) => item.product_url);
  const { data: existingProducts, error: lookupError } = await supabase
    .from("products")
    .select(nativeProductImportSelect)
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId)
    .eq("source", "native")
    .in("url", productUrls)
    .returns<Array<{ id: string; url: string | null }>>();

  if (lookupError) {
    const isMissingTable = isMissingProductTable(lookupError);

    console.error("[native-url-import] native product lookup failed", {
      code: lookupError.code,
      message: lookupError.message,
    });

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Native urunler okunamadi.",
      code: lookupError.code,
      isMissingTable,
    };
  }

  const existingByUrl = new Map(
    (existingProducts ?? [])
      .filter((product) => product.url)
      .map((product) => [product.url as string, product.id]),
  );
  const importedItems: Array<{ previewItemId: string; productId: string }> = [];

  for (const preview of params.previewItems) {
    const productPayload = buildNativeProductPayload({
      profileId: params.profileId,
      storeId: params.storeId,
      language: params.language,
      market: params.market,
      preview,
    });
    const existingProductId = existingByUrl.get(preview.product_url);

    if (existingProductId) {
      const { data, error } = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", existingProductId)
        .eq("profile_id", params.profileId)
        .eq("store_id", params.storeId)
        .eq("source", "native")
        .select("id")
        .single<{ id: string }>();

      if (error || !data?.id) {
        console.error("[native-url-import] native product update failed", {
          code: error?.code,
          message: error?.message,
        });

        return {
          ok: false,
          message: "Native urun guncellenemedi.",
          code: error?.code,
          isMissingTable: error ? isMissingProductTable(error) : false,
        };
      }

      importedItems.push({
        previewItemId: preview.id,
        productId: data.id,
      });

      continue;
    }

    const { data, error } = await supabase
      .from("products")
      .insert(productPayload)
      .select("id")
      .single<{ id: string }>();

    if (error || !data?.id) {
      console.error("[native-url-import] native product insert failed", {
        code: error?.code,
        message: error?.message,
      });

      return {
        ok: false,
        message: "Native urun kaydedilemedi.",
        code: error?.code,
        isMissingTable: error ? isMissingProductTable(error) : false,
      };
    }

    importedItems.push({
      previewItemId: preview.id,
      productId: data.id,
    });
  }

  return {
    ok: true,
    data: {
      importedCount: importedItems.length,
      importedItems,
    },
  };
}

export async function upsertNativeProductsFromFallbackItems(params: {
  profileId: string;
  storeId: string;
  language: string;
  market: string;
  items: NativeFallbackImportItem[];
}): Promise<ProductRepositoryResult<{ importedCount: number; productIds: string[] }>> {
  if (params.items.length === 0) {
    return {
      ok: true,
      data: {
        importedCount: 0,
        productIds: [],
      },
    };
  }

  const supabase = createAdminClient();
  const itemUrls = params.items
    .map((item) => item.productUrl)
    .filter((url): url is string => Boolean(url));
  const existingByUrl = new Map<string, string>();

  if (itemUrls.length > 0) {
    const { data: existingProducts, error: lookupError } = await supabase
      .from("products")
      .select(nativeProductImportSelect)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId)
      .eq("source", "native")
      .in("url", itemUrls)
      .returns<Array<{ id: string; url: string | null }>>();

    if (lookupError) {
      const isMissingTable = isMissingProductTable(lookupError);

      console.error("[native-fallback-import] product lookup failed", {
        code: lookupError.code,
        message: lookupError.message,
      });

      return {
        ok: false,
        message: isMissingTable
          ? productStorageSetupMessage()
          : "Native urunler okunamadi.",
        code: lookupError.code,
        isMissingTable,
      };
    }

    for (const product of existingProducts ?? []) {
      if (product.url) {
        existingByUrl.set(product.url, product.id);
      }
    }
  }

  const productIds: string[] = [];

  for (const item of params.items) {
    const productPayload = buildNativeFallbackProductPayload({
      profileId: params.profileId,
      storeId: params.storeId,
      language: params.language,
      market: params.market,
      item,
    });
    const existingProductId = item.productUrl
      ? existingByUrl.get(item.productUrl)
      : undefined;

    if (existingProductId) {
      const { data, error } = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", existingProductId)
        .eq("profile_id", params.profileId)
        .eq("store_id", params.storeId)
        .eq("source", "native")
        .select("id")
        .single<{ id: string }>();

      if (error || !data?.id) {
        return {
          ok: false,
          message: "Native urun guncellenemedi.",
          code: error?.code,
          isMissingTable: error ? isMissingProductTable(error) : false,
        };
      }

      productIds.push(data.id);
      continue;
    }

    const { data, error } = await supabase
      .from("products")
      .insert(productPayload)
      .select("id")
      .single<{ id: string }>();

    if (error || !data?.id) {
      return {
        ok: false,
        message: "Native urun kaydedilemedi.",
        code: error?.code,
        isMissingTable: error ? isMissingProductTable(error) : false,
      };
    }

    productIds.push(data.id);
  }

  return {
    ok: true,
    data: {
      importedCount: productIds.length,
      productIds,
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

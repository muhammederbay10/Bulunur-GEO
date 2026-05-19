import "server-only";

import type { ScrapePreviewRow } from "@/lib/db/scrape-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopifyProductUpsert } from "@/lib/shopify/product-mapper";
import { productInputSchema } from "@/lib/validation/ai-contract";
import type { ProductAnalysisContext, ProductAnalysisDetail } from "@/types/analysis";
import type { NativeFallbackImportItem } from "@/types/native-url-import";
import type {
  CatalogDashboardSummary,
  ProductListFilters,
  ProductListSourceFilter,
  ProductListStatusFilter,
  ProductSourceSummary,
  ProductSource,
  ProductSummary,
} from "@/types/product";
import type { ProductInput } from "@/types/ai-contract";

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
  latest_analysis_id: string | null;
  latest_optimization_result_id: string | null;
  last_analyzed_at: string | null;
  last_optimized_at: string | null;
  updated_at: string;
};

type ProductAnalysisRow = {
  id: string;
  external_id: string | null;
  external_handle: string | null;
  store_id: string;
  source: ProductSource;
  url: string | null;
  language: string | null;
  market: string | null;
  title: string;
  description: string | null;
  description_html: string | null;
  short_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  tags: string[] | null;
  vendor: string | null;
  product_type: string | null;
  price_display: string | null;
  currency: string | null;
  availability: string | null;
  brand: string | null;
  category: string | null;
  image_urls: string[] | null;
  attributes: Record<string, unknown> | null;
  raw_source_payload: Record<string, unknown> | null;
  raw_extracted: Record<string, unknown> | null;
  crawl_metadata: Record<string, unknown> | null;
  workflow_status: ProductSummary["workflowStatus"];
  latest_analysis_id: string | null;
  latest_optimization_result_id: string | null;
  latest_score: number | null;
  last_analyzed_at: string | null;
  last_optimized_at: string | null;
  updated_at: string;
};

type ProductRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; isMissingTable?: boolean };

type SourceSummaryRow = {
  id: string;
  name: string;
  source_type: ProductSourceSummary["sourceType"];
  status: string;
  last_sync_at: string | null;
  updated_at: string;
};

const productSummarySelect =
  "id,store_id,source,title,url,image_urls,price_display,availability,latest_score,workflow_status,latest_analysis_id,latest_optimization_result_id,last_analyzed_at,last_optimized_at,updated_at";
const productAnalysisSelect =
  "id,external_id,external_handle,store_id,source,url,language,market,title,description,description_html,short_description,seo_title,seo_description,tags,vendor,product_type,price_display,currency,availability,brand,category,image_urls,attributes,raw_source_payload,raw_extracted,crawl_metadata,workflow_status,latest_analysis_id,latest_optimization_result_id,latest_score,last_analyzed_at,last_optimized_at,updated_at";

const sourceSummarySelect =
  "id,name,source_type,status,last_sync_at,updated_at";
const shopifyProductSyncSelect = "id,external_id";
const nativeProductImportSelect = "id,url";
const defaultCatalogMetrics = {
  totalProducts: 0,
  analyzedProducts: 0,
  optimizedProducts: 0,
  waitingProducts: 0,
  lowScoreProducts: 0,
};

function productStorageSetupMessage() {
  return "Ürün tablolari hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function isMissingProductTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return error.code === "42P01" || message.includes("products");
}

function resolveProductWorkflowStatus(row: {
  workflow_status: ProductSummary["workflowStatus"];
  latest_analysis_id?: string | null;
  latest_optimization_result_id?: string | null;
  latest_score?: number | null;
  last_analyzed_at?: string | null;
  last_optimized_at?: string | null;
}): ProductSummary["workflowStatus"] {
  if (
    row.workflow_status === "analysis_running" ||
    row.workflow_status === "optimization_running" ||
    row.workflow_status === "published" ||
    row.workflow_status === "failed"
  ) {
    return row.workflow_status;
  }

  if (
    row.workflow_status === "optimized" ||
    row.latest_optimization_result_id ||
    row.last_optimized_at
  ) {
    return "optimized";
  }

  if (
    row.workflow_status === "analyzed" ||
    row.latest_analysis_id ||
    row.last_analyzed_at ||
    typeof row.latest_score === "number"
  ) {
    return "analyzed";
  }

  return row.workflow_status;
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
    workflowStatus: resolveProductWorkflowStatus(row),
    updatedAt: row.updated_at,
  };
}

function mapSourceSummary(row: SourceSummaryRow): ProductSourceSummary {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    status: row.status,
    lastSyncAt: row.last_sync_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

function normalizeStatusFilter(
  value?: ProductListStatusFilter,
): ProductListStatusFilter {
  if (
    value === "waiting" ||
    value === "analyzed" ||
    value === "optimized" ||
    value === "low_score"
  ) {
    return value;
  }

  return "all";
}

function normalizeSourceFilter(
  value?: ProductListSourceFilter,
): ProductListSourceFilter {
  if (value === "shopify" || value === "native" || value === "woocommerce") {
    return value;
  }

  return "all";
}

function normalizedProductFilters(filters?: ProductListFilters) {
  return {
    source: normalizeSourceFilter(filters?.source),
    status: normalizeStatusFilter(filters?.status),
  };
}

function statusFilterValues(status: ProductListStatusFilter) {
  if (status === "analyzed") {
    return ["analyzed", "optimization_running"];
  }

  if (status === "optimized") {
    return ["optimized", "published"];
  }

  return [];
}

function productMatchesStatusFilter(
  product: ProductSummary,
  status: ProductListStatusFilter,
) {
  if (status === "all") {
    return true;
  }

  if (status === "waiting") {
    return product.workflowStatus === "not_analyzed";
  }

  if (status === "analyzed") {
    return (
      product.workflowStatus === "analyzed" ||
      product.workflowStatus === "optimization_running"
    );
  }

  if (status === "optimized") {
    return (
      product.workflowStatus === "optimized" ||
      product.workflowStatus === "published"
    );
  }

  if (status === "low_score") {
    return typeof product.latestScore === "number" && product.latestScore < 60;
  }

  return true;
}

async function countProductsForProfile(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  filters?: ProductListFilters,
): Promise<ProductRepositoryResult<number>> {
  const { source, status } = normalizedProductFilters(filters);
  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (source !== "all") {
    query = query.eq("source", source);
  }

  if (status === "low_score") {
    query = query.not("latest_score", "is", null).lt("latest_score", 60);
  }

  const { count, error } = await query;

  if (error) {
    const isMissingTable = isMissingProductTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Katalog özeti okunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  return { ok: true, data: count ?? 0 };
}

function latestTimestamp(values: Array<string | undefined>) {
  let latest: string | undefined;
  let latestTime = 0;

  for (const value of values) {
    if (!value) continue;

    const time = new Date(value).getTime();

    if (Number.isFinite(time) && time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }

  return latest;
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

function asOptionalUrl(value: unknown): string | undefined {
  const stringValue = asString(value);

  if (!stringValue) return undefined;

  try {
    return new URL(stringValue).toString();
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord);
}

function asHeadings(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, asStringArray(item)] as const)
      .filter(([, items]) => items.length > 0),
  );
}

function asKnownCrawlStatus(value: unknown) {
  const status = asString(value);

  if (
    status === "success" ||
    status === "partial" ||
    status === "failed" ||
    status === "blocked" ||
    status === "timeout"
  ) {
    return status;
  }

  return null;
}

function normalizeAiSource(source: ProductSource): "shopify" | "native" | null {
  if (source === "shopify" || source === "native") {
    return source;
  }

  return null;
}

function normalizeCurrency(value: unknown): string | null {
  const currency = asString(value);

  if (!currency) return null;

  const normalized = currency.trim().toUpperCase();

  if (normalized === "TL" || normalized === "TRY" || normalized === "₺") {
    return "TRY";
  }

  if (normalized === "$") {
    return "USD";
  }

  if (normalized === "€") {
    return "EUR";
  }

  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function normalizeAvailability(value: unknown): {
  status: "in_stock" | "out_of_stock" | "preorder" | "backorder" | "unknown";
  rawText?: string;
} {
  const rawText = asString(value);

  if (!rawText) {
    return { status: "unknown" };
  }

  const normalized = rawText.toLocaleLowerCase("tr-TR");

  if (
    normalized.includes("ön sipariş") ||
    normalized.includes("on siparis") ||
    normalized.includes("preorder")
  ) {
    return { status: "preorder", rawText };
  }

  if (
    normalized.includes("tedarik") ||
    normalized.includes("backorder") ||
    normalized.includes("bekleyen stok")
  ) {
    return { status: "backorder", rawText };
  }

  if (
    normalized.includes("tükendi") ||
    normalized.includes("stok yok") ||
    normalized.includes("mevcut değil") ||
    normalized.includes("out of stock") ||
    normalized.includes("sold out")
  ) {
    return { status: "out_of_stock", rawText };
  }

  if (
    normalized.includes("stokta") ||
    normalized.includes("mevcut") ||
    normalized.includes("satışta") ||
    normalized.includes("available") ||
    normalized.includes("in stock") ||
    /\bson\s+\d+\s+adet\b/u.test(normalized)
  ) {
    return { status: "in_stock", rawText };
  }

  return { status: "unknown", rawText };
}

function firstValidDateString(values: unknown[]) {
  for (const value of values) {
    const dateValue = asString(value);

    if (!dateValue) continue;

    const date = new Date(dateValue);

    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

const aiTextLimits = {
  description: 4_000,
  shortDescription: 1_200,
  seoDescription: 500,
  bodyText: 6_000,
  structuredDataJson: 4_000,
};
const maxAiImageUrls = 5;
const maxAiDetectedSchemaItems = 3;

function stripHtml(value: string) {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function compactAiText(value: string | null | undefined, maxLength: number) {
  if (!value) return undefined;

  const cleaned = decodeBasicHtmlEntities(stripHtml(value))
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;

  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength).trimEnd()}...`
    : cleaned;
}

function isLikelyDecorativeImage(url: string) {
  const normalized = url.toLocaleLowerCase("en-US");

  return (
    normalized.endsWith(".svg") ||
    normalized.includes("logo") ||
    normalized.includes("payment") ||
    normalized.includes("payments") ||
    normalized.includes("paypal") ||
    normalized.includes("visa") ||
    normalized.includes("mastercard") ||
    normalized.includes("worldwide")
  );
}

function isHttpImageUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function compactAiImageUrls(imageUrls: string[]) {
  const deduped = Array.from(new Set(imageUrls.filter(isHttpImageUrl)));
  const productLike = deduped.filter((url) => !isLikelyDecorativeImage(url));
  const selected = productLike.length > 0 ? productLike : deduped;

  return selected.slice(0, maxAiImageUrls);
}

function compactDetectedSchemaForAi(
  detectedSchema: Array<Record<string, unknown>>,
) {
  return detectedSchema
    .slice(0, maxAiDetectedSchemaItems)
    .map((item) => {
      const compactItem = JSON.stringify(item);

      if (compactItem.length <= aiTextLimits.structuredDataJson) {
        return item;
      }

      return {
        compacted: true,
        preview: compactAiText(compactItem, aiTextLimits.structuredDataJson),
      };
    });
}

function mapProductAnalysisDetail(row: ProductAnalysisRow): ProductAnalysisDetail {
  return {
    id: row.id,
    externalId: row.external_id ?? undefined,
    storeId: row.store_id,
    source: row.source,
    title: row.title,
    url: row.url ?? undefined,
    language: row.language ?? "tr",
    market: row.market ?? "TR",
    description: row.description ?? undefined,
    descriptionHtml: row.description_html ?? undefined,
    shortDescription: row.short_description ?? undefined,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    priceDisplay: row.price_display ?? undefined,
    currency: row.currency ?? undefined,
    availability: row.availability ?? undefined,
    brand: row.brand ?? undefined,
    category: row.category ?? undefined,
    imageUrls: row.image_urls ?? [],
    tags: row.tags ?? [],
    vendor: row.vendor ?? undefined,
    productType: row.product_type ?? undefined,
    workflowStatus: resolveProductWorkflowStatus(row),
    latestScore: row.latest_score ?? undefined,
    lastAnalyzedAt: row.last_analyzed_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

function buildProductInput(
  row: ProductAnalysisRow,
): ProductRepositoryResult<ProductInput> {
  const source = normalizeAiSource(row.source);

  if (!source) {
    return {
      ok: false,
      code: "unsupported_ai_product_source",
      message: "AI analizi bu urun kaynagi icin henuz desteklenmiyor.",
    };
  }

  const attributes = asRecord(row.attributes);
  const rawExtracted = asRecord(row.raw_extracted);
  const crawlMetadata = asRecord(row.crawl_metadata);
  const nestedRobots = asRecord(crawlMetadata.robots);
  const camelDetectedSchema = asRecordArray(rawExtracted.detectedSchema);
  const snakeDetectedSchema = asRecordArray(rawExtracted.detected_schema);
  const detectedSchema =
    camelDetectedSchema.length > 0 ? camelDetectedSchema : snakeDetectedSchema;
  const compactDetectedSchema = compactDetectedSchemaForAi(detectedSchema);
  const pageTitle =
    asString(rawExtracted.pageTitle) ??
    asString(rawExtracted.page_title) ??
    row.seo_title ??
    row.title;
  const metaDescription =
    asString(rawExtracted.metaDescription) ??
    asString(rawExtracted.meta_description) ??
    row.seo_description;
  const headings = asHeadings(rawExtracted.headings ?? crawlMetadata.headings);
  const bodyText =
    asString(rawExtracted.bodyText) ??
    asString(rawExtracted.body_text) ??
    asString(rawExtracted.plainDescription) ??
    row.description ??
    row.description_html ??
    row.short_description ??
    undefined;
  const compactDescription =
    compactAiText(row.description, aiTextLimits.description) ??
    compactAiText(row.description_html, aiTextLimits.description);
  const compactShortDescription = compactAiText(
    row.short_description,
    aiTextLimits.shortDescription,
  );
  const compactMetaDescription = compactAiText(
    metaDescription,
    aiTextLimits.seoDescription,
  );
  const compactBodyText = compactAiText(bodyText, aiTextLimits.bodyText);
  const requestedUrl =
    asOptionalUrl(crawlMetadata.requestedUrl) ??
    asOptionalUrl(crawlMetadata.requested_url) ??
    asOptionalUrl(row.url);
  const finalUrl =
    asOptionalUrl(crawlMetadata.finalUrl) ??
    asOptionalUrl(crawlMetadata.final_url);
  const canonicalUrl =
    asOptionalUrl(crawlMetadata.canonicalUrl) ??
    asOptionalUrl(crawlMetadata.canonical_url) ??
    finalUrl ??
    requestedUrl;
  const productUrl =
    asOptionalUrl(crawlMetadata.productUrl) ??
    asOptionalUrl(crawlMetadata.product_url) ??
    finalUrl ??
    requestedUrl;
  const url = productUrl ?? canonicalUrl;

  if (!url && source !== "shopify") {
    return {
      ok: false,
      code: "ai_product_url_required",
      message: "AI analizi icin urun URL adresi gerekli.",
    };
  }

  const httpStatusCode =
    asNumber(crawlMetadata.httpStatusCode) ??
    asNumber(crawlMetadata.http_status_code) ??
    asNumber(crawlMetadata.httpStatus);
  const robotsAllowed =
    asBoolean(crawlMetadata.robotsAllowed) ??
    asBoolean(crawlMetadata.robots_allowed) ??
    asBoolean(nestedRobots.allowed) ??
    undefined;
  const errorCode = asString(crawlMetadata.errorCode ?? crawlMetadata.error_code);
  const explicitlyBlocked =
    asBoolean(crawlMetadata.blocked) ??
    (robotsAllowed === false ||
    errorCode === "robots_disallowed" ||
    errorCode === "blocked_status");
  const blocked = Boolean(explicitlyBlocked);
  const accessible =
    asBoolean(crawlMetadata.accessible) ??
    (!blocked &&
      (typeof httpStatusCode === "number"
        ? httpStatusCode >= 200 && httpStatusCode < 400
        : Boolean(url)));
  const extracted =
    asBoolean(crawlMetadata.contentExtracted) ??
    asBoolean(crawlMetadata.content_extracted) ??
    Boolean(row.title || row.description || row.description_html || bodyText);
  const contentExtracted = accessible ? extracted : false;
  const wasFetched = Boolean(
    httpStatusCode ||
      asString(crawlMetadata.fetchedAt) ||
      asString(crawlMetadata.fetched_at) ||
      asString(crawlMetadata.crawledAt) ||
      asString(crawlMetadata.crawled_at),
  );
  const timedOut =
    errorCode === "timeout" ||
    asKnownCrawlStatus(crawlMetadata.crawlStatus) === "timeout";
  let crawlStatus =
    asKnownCrawlStatus(crawlMetadata.crawlStatus) ??
    asKnownCrawlStatus(crawlMetadata.crawl_status);

  if (!crawlStatus) {
    if (timedOut) {
      crawlStatus = "timeout";
    } else if (blocked) {
      crawlStatus = "blocked";
    } else if (wasFetched && accessible && contentExtracted) {
      crawlStatus = "success";
    } else if (url) {
      crawlStatus = "partial";
    } else {
      crawlStatus = "failed";
    }
  }

  if (crawlStatus === "success" && (!accessible || !contentExtracted)) {
    crawlStatus = accessible ? "partial" : "failed";
  }

  if (blocked && !["blocked", "failed", "partial"].includes(crawlStatus)) {
    crawlStatus = "blocked";
  }

  const imageUrls = compactAiImageUrls(
    (row.image_urls ?? [])
      .map(asOptionalUrl)
      .filter((url): url is string => Boolean(url)),
  );
  const availability = normalizeAvailability(row.availability);
  const currency = normalizeCurrency(row.currency);
  const enrichedAttributes = {
    ...attributes,
    externalId: row.external_id,
    externalHandle: row.external_handle,
    vendor: row.vendor,
    productType: row.product_type,
    seoTitle: row.seo_title,
    seoDescription: compactAiText(
      row.seo_description,
      aiTextLimits.seoDescription,
    ),
    tags: row.tags ?? [],
    rawAvailabilityText: availability.rawText,
    nativeImportMethod:
      source === "native"
        ? asString(attributes.fallbackSourceType) ??
          asString(crawlMetadata.sourceType) ??
          asString(crawlMetadata.source_type) ??
          (crawlMetadata.fallback ? "manual" : "url")
        : undefined,
    contentType: asString(crawlMetadata.contentType),
  };
  const rawExtractedPayload = {
    pageTitle,
    metaDescription: compactMetaDescription,
    headings,
    bodyText: compactBodyText,
    detectedSchema: compactDetectedSchema,
  };
  const crawlMetadataPayload = {
    crawlStatus,
    crawledAt: firstValidDateString([
      crawlMetadata.crawledAt,
      crawlMetadata.crawled_at,
      crawlMetadata.fetchedAt,
      crawlMetadata.fetched_at,
      crawlMetadata.importedAt,
      crawlMetadata.imported_at,
      row.updated_at,
    ]),
    accessible,
    blocked,
    contentExtracted,
    productUrl,
    httpStatusCode: httpStatusCode ?? undefined,
    canonicalUrl,
    robotsAllowed,
    indexable: asBoolean(crawlMetadata.indexable) ?? undefined,
    pageTitle,
    metaDescription: compactMetaDescription,
    headings,
    detectedStructuredData:
      asRecordArray(crawlMetadata.detectedStructuredData).length > 0
        ? compactDetectedSchemaForAi(
            asRecordArray(crawlMetadata.detectedStructuredData),
          )
        : compactDetectedSchema,
    imageUrls,
    imagesAccessible:
      asBoolean(crawlMetadata.imagesAccessible) ??
      asBoolean(crawlMetadata.images_accessible) ??
      (imageUrls.length > 0 ? true : undefined),
  };
  const parsedInput = productInputSchema.safeParse({
    productId: row.id,
    storeId: row.store_id,
    source,
    url,
    language: "tr",
    market: "TR",
    title: row.title,
    description: compactDescription,
    shortDescription: compactShortDescription,
    price: row.price_display ?? undefined,
    currency,
    availability: availability.status,
    brand: row.brand ?? row.vendor ?? undefined,
    category: row.category ?? row.product_type ?? undefined,
    imageUrls,
    attributes: enrichedAttributes,
    rawExtracted: rawExtractedPayload,
    crawlMetadata: crawlMetadataPayload,
  });

  if (!parsedInput.success) {
    console.warn("[ai-contract] product input validation failed", {
      productId: row.id,
      storeId: row.store_id,
      source: row.source,
      hasUrl: Boolean(url),
      crawlStatus,
      issues: parsedInput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });

    return {
      ok: false,
      code: "invalid_ai_product_input",
      message: "Urun AI analiz sozlesmesine hazir degil.",
    };
  }

  return {
    ok: true,
    data: parsedInput.data,
  };
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

export async function listProductsForCurrentUser(
  filters?: ProductListFilters,
): Promise<ProductSummary[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const result = await listProductsForProfile(user.id, filters);

  if (!result.ok) {
    return [];
  }

  return result.data;
}

export async function getCatalogDashboardForCurrentUser(): Promise<CatalogDashboardSummary> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      metrics: defaultCatalogMetrics,
      recentProducts: [],
      attentionProducts: [],
      sources: [],
    };
  }

  const result = await getCatalogDashboardForProfile(user.id);

  if (!result.ok) {
    return {
      metrics: defaultCatalogMetrics,
      recentProducts: [],
      attentionProducts: [],
      sources: [],
      errorMessage: result.message,
      isMissingTable: result.isMissingTable,
    };
  }

  return result.data;
}

export async function listProductSourceSummariesForProfile(
  profileId: string,
): Promise<ProductRepositoryResult<ProductSourceSummary[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select(sourceSummarySelect)
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(6)
    .returns<SourceSummaryRow[]>();

  if (error) {
    const isMissingTable = isMissingProductTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Kaynak özeti okunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(mapSourceSummary),
  };
}

export async function getProductAnalysisContextForCurrentUser(
  productId: string,
): Promise<ProductRepositoryResult<ProductAnalysisContext>> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      message: "Oturum gerekli.",
      code: "unauthorized",
    };
  }

  return getProductAnalysisContextForProfile({
    profileId: user.id,
    productId,
  });
}

export async function getProductAnalysisContextForProfile(params: {
  profileId: string;
  productId: string;
}): Promise<ProductRepositoryResult<ProductAnalysisContext>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(productAnalysisSelect)
    .eq("id", params.productId)
    .eq("profile_id", params.profileId)
    .maybeSingle<ProductAnalysisRow>();

  if (error) {
    const isMissingTable = isMissingProductTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Ürün analiz verisi okunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  if (!data) {
    return {
      ok: false,
      message: "Ürün bulunamadı veya bu hesaba ait değil.",
      code: "product_not_found",
    };
  }

  const productInputResult = buildProductInput(data);

  return {
    ok: true,
    data: {
      product: mapProductAnalysisDetail(data),
      productInput: productInputResult.ok ? productInputResult.data : undefined,
      analysisUnavailableMessage: productInputResult.ok
        ? undefined
        : productInputResult.message,
    },
  };
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
        : "Shopify ürünleri okunamadı.",
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
    const { workflow_status: _workflowStatus, ...syncUpdate } = product;
    void _workflowStatus;

    const { error } = await supabase
      .from("products")
      .update(syncUpdate)
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
        message: "Shopify ürünü güncellenemedi.",
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
        message: "Shopify ürünleri kaydedilemedi.",
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
        : "Native ürünler okunamadı.",
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
          message: "Native ürün güncellenemedi.",
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
        message: "Native ürün kaydedilemedi.",
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
          : "Native ürünler okunamadı.",
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
          message: "Native ürün güncellenemedi.",
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
        message: "Native ürün kaydedilemedi.",
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
  filters?: ProductListFilters,
): Promise<ProductRepositoryResult<ProductSummary[]>> {
  const supabase = createAdminClient();
  const { source, status } = normalizedProductFilters(filters);
  let query = supabase
    .from("products")
    .select(productSummarySelect)
    .eq("profile_id", profileId);

  if (source !== "all") {
    query = query.eq("source", source);
  }

  if (status === "waiting") {
    query = query.eq("workflow_status", "not_analyzed");
  } else if (status === "analyzed" || status === "optimized") {
    query = query.in("workflow_status", statusFilterValues(status));
  } else if (status === "low_score") {
    query = query.not("latest_score", "is", null).lt("latest_score", 60);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<ProductRow[]>();

  if (error) {
    const isMissingTable = isMissingProductTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Ürünler okunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  const products = (data ?? []).map(mapProductSummary);

  return {
    ok: true,
    data: products.filter((product) =>
      productMatchesStatusFilter(product, status),
    ),
  };
}

export async function getCatalogDashboardForProfile(
  profileId: string,
): Promise<ProductRepositoryResult<CatalogDashboardSummary>> {
  const supabase = createAdminClient();
  const [
    totalProducts,
    analyzedProducts,
    optimizedProducts,
    waitingProducts,
    lowScoreProducts,
    recentProductsResult,
    attentionProductsResult,
    sourcesResult,
  ] = await Promise.all([
    countProductsForProfile(supabase, profileId),
    countProductsForProfile(supabase, profileId, { status: "analyzed" }),
    countProductsForProfile(supabase, profileId, { status: "optimized" }),
    countProductsForProfile(supabase, profileId, { status: "waiting" }),
    countProductsForProfile(supabase, profileId, { status: "low_score" }),
    supabase
      .from("products")
      .select(productSummarySelect)
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<ProductRow[]>(),
    supabase
      .from("products")
      .select(productSummarySelect)
      .eq("profile_id", profileId)
      .eq("workflow_status", "not_analyzed")
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<ProductRow[]>(),
    supabase
      .from("stores")
      .select(sourceSummarySelect)
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(6)
      .returns<SourceSummaryRow[]>(),
  ]);

  const countResults = [
    totalProducts,
    analyzedProducts,
    optimizedProducts,
    waitingProducts,
    lowScoreProducts,
  ];
  const failedCount = countResults.find((result) => !result.ok);

  if (failedCount && !failedCount.ok) {
    return failedCount;
  }

  if (recentProductsResult.error) {
    const isMissingTable = isMissingProductTable(recentProductsResult.error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Son ürünler okunamadı.",
      code: recentProductsResult.error.code,
      isMissingTable,
    };
  }

  if (attentionProductsResult.error) {
    const isMissingTable = isMissingProductTable(attentionProductsResult.error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Dikkat isteyen ürünler okunamadı.",
      code: attentionProductsResult.error.code,
      isMissingTable,
    };
  }

  if (sourcesResult.error) {
    const isMissingTable = isMissingProductTable(sourcesResult.error);

    return {
      ok: false,
      message: isMissingTable
        ? productStorageSetupMessage()
        : "Kaynak özeti okunamadı.",
      code: sourcesResult.error.code,
      isMissingTable,
    };
  }

  const sources = (sourcesResult.data ?? []).map(mapSourceSummary);
  const recentProducts = (recentProductsResult.data ?? []).map(mapProductSummary);
  const attentionProducts = (attentionProductsResult.data ?? []).map(mapProductSummary);

  return {
    ok: true,
    data: {
      metrics: {
        totalProducts: totalProducts.ok ? totalProducts.data : 0,
        analyzedProducts: analyzedProducts.ok ? analyzedProducts.data : 0,
        optimizedProducts: optimizedProducts.ok ? optimizedProducts.data : 0,
        waitingProducts: waitingProducts.ok ? waitingProducts.data : 0,
        lowScoreProducts: lowScoreProducts.ok ? lowScoreProducts.data : 0,
      },
      recentProducts,
      attentionProducts,
      sources,
      lastCatalogActivityAt: latestTimestamp([
        recentProducts[0]?.updatedAt,
        ...sources.map((source) => source.lastSyncAt ?? source.updatedAt),
      ]),
    },
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
      message: "Shopify ürünleri bağlantı kesildi olarak işaretlenemedi.",
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

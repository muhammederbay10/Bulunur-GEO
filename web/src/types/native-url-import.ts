export type NativeUrlImportStatus =
  | "ready"
  | "partial"
  | "needs_review"
  | "failed"
  | "excluded"
  | "imported";

export type ScrapeJobDbStatus =
  | "queued"
  | "running"
  | "preview_ready"
  | "imported"
  | "failed"
  | "cancelled";

export type ScanResponseStatus = ScrapeJobDbStatus | "blocked";

export type SourceType =
  | "native_upload"
  | "native_url_scrape"
  | "shopify"
  | "woocommerce";

export type NativeUrlImportErrorCode =
  | "invalid_url"
  | "unsafe_url"
  | "unsafe_redirect"
  | "dns_lookup_failed"
  | "dns_private_ip"
  | "timeout"
  | "blocked_status"
  | "http_error"
  | "file_download"
  | "non_html"
  | "too_large"
  | "empty_html"
  | "fetch_failed"
  | "too_many_redirects"
  | "no_product_links"
  | "all_products_failed"
  | "robots_disallowed"
  | "robots_unavailable"
  | "partial_product_failures"
  | "unauthorized"
  | "native_source_not_found"
  | "native_source_conflict"
  | "native_source_lookup_failed"
  | "native_source_schema_missing"
  | "invalid_scan_request"
  | "scrape_storage_schema_missing"
  | "scrape_job_create_failed"
  | "scrape_job_update_failed"
  | "scrape_preview_persist_failed"
  | "unexpected_error";

export type NativeRobotsCheck = {
  checked: boolean;
  allowed: boolean;
  url: string | null;
  status: "allowed" | "disallowed" | "not_found" | "unavailable";
  httpStatus?: number;
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type NativeCrawlMetadata = {
  requestedUrl: string;
  finalUrl: string | null;
  fetchedAt: string | null;
  httpStatus: number | null;
  contentType: string | null;
  robots: NativeRobotsCheck | null;
};

export type UrlValidationResult = {
  isValid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type SafeFetchResult = {
  ok: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  contentType?: string | null;
  html?: string;
  crawlMetadata?: NativeCrawlMetadata;
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type NativeUrlImportSourceContext = {
  storeId: string;
  storeName: string;
  websiteUrl: string | null;
  market: string;
  language: string;
};

export type DetectedProductLink = {
  url: string;
  source: "json_ld" | "anchor_heuristic" | "card_heuristic" | "manual";
  confidenceHint?: number;
};

export type ExtractedProductData = {
  title: string | null;
  productUrl: string;
  shortDescription: string | null;
  descriptionHtml: string | null;
  plainDescription: string | null;
  images: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  priceDisplay: string | null;
  stockDisplay: string | null;
  tags: string[];
  categories: string[];
  rawPayload: Record<string, unknown>;
  extractionMethods: string[];
};

export type ConfidenceScoreResult = {
  score: number;
  status: NativeUrlImportStatus;
  warnings: string[];
};

export type ScrapePreviewItem = {
  id: string;
  productUrl: string;
  title: string | null;
  imageUrl: string | null;
  shortDescription: string | null;
  descriptionHtml: string | null;
  plainDescription: string | null;
  priceDisplay: string | null;
  stockDisplay: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  categories: string[];
  extractionConfidence: number;
  status: NativeUrlImportStatus;
  warnings: string[];
  rawPayload: Record<string, unknown>;
  crawlMetadata: NativeCrawlMetadata;
};

export type ScrapePreviewFailure = {
  id: string;
  productUrl: string;
  status: "failed" | "blocked";
  error: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type ScanRequest = {
  url?: string;
  urls?: string[];
};

export type ScanResponse = {
  success: boolean;
  sourceUrl: string;
  normalizedUrl?: string;
  scrapeJobId?: string;
  source?: NativeUrlImportSourceContext;
  detectedCount: number;
  previewItems: ScrapePreviewItem[];
  failedItems?: ScrapePreviewFailure[];
  status: ScanResponseStatus;
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type ValidateUrlRequest = {
  url: string;
};

export type ValidateUrlPreflight = {
  ok: boolean;
  status: number | null;
  contentType: string | null;
  finalUrl: string | null;
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type ValidateUrlResponse = {
  success: boolean;
  result: UrlValidationResult;
  source?: NativeUrlImportSourceContext;
  preflight?: ValidateUrlPreflight;
};

export type LocalImportedProduct = {
  id: string;
  platform: "native";
  sourceType: "native_url_scrape";
  sourceUrl: string;
  productUrl: string;
  title: string;
  shortDescription: string | null;
  descriptionHtml: string | null;
  plainDescription: string | null;
  images: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  priceDisplay: string | null;
  stockDisplay: string | null;
  tags: string[];
  categories: string[];
  extractionConfidence: number;
  rawPayload: Record<string, unknown>;
  lastSyncedAt: string;
};

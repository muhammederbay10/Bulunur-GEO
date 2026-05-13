export type NativeUrlImportStatus =
  | "ready"
  | "partial"
  | "needs_review"
  | "failed"
  | "excluded"
  | "imported";

export type ScrapeJobStatus =
  | "idle"
  | "validating"
  | "scanning"
  | "preview_ready"
  | "imported"
  | "failed"
  | "blocked";

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
  | "unexpected_error";

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
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
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
};

export type ScanRequest = {
  url?: string;
  urls?: string[];
};

export type ScanResponse = {
  success: boolean;
  sourceUrl: string;
  normalizedUrl?: string;
  detectedCount: number;
  previewItems: ScrapePreviewItem[];
  status: ScrapeJobStatus;
  error?: string;
  errorCode?: NativeUrlImportErrorCode;
};

export type ValidateUrlRequest = {
  url: string;
};

export type ValidateUrlResponse = {
  success: boolean;
  result: UrlValidationResult;
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

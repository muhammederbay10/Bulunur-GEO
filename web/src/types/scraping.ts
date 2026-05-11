export type ScrapePreviewStatus = "ready" | "partial" | "needs_review" | "failed";

export type ScrapePreviewItem = {
  id: string;
  url: string;
  title?: string;
  imageUrl?: string;
  priceDisplay?: string;
  confidenceScore: number;
  status: ScrapePreviewStatus;
  warnings: string[];
};

export type NativeImportLimits = {
  maxProducts: number;
  maxConcurrency: number;
  timeoutMs: number;
  maxResponseBytes: number;
};

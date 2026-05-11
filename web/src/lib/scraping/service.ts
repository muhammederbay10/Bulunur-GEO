import "server-only";

import type { NativeImportLimits, ScrapePreviewItem } from "@/types/scraping";

export const nativeImportLimits: NativeImportLimits = {
  maxProducts: 20,
  maxConcurrency: 3,
  timeoutMs: 10000,
  maxResponseBytes: 1_500_000,
};

export async function previewNativeImport(): Promise<ScrapePreviewItem[]> {
  throw new Error("Native import implementation starts in Phase 5.");
}

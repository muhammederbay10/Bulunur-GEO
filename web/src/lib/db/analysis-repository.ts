import "server-only";

import type { GeoAnalysisOutput } from "@/types/ai-contract";

export async function saveProductAnalysis(
  analysis: GeoAnalysisOutput,
): Promise<void> {
  void analysis;
  throw new Error("Analysis repository implementation starts in Phase 7.");
}

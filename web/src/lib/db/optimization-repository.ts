import "server-only";

import type { GeoImprovementOutput } from "@/types/ai-contract";

export async function saveOptimizationResult(
  result: GeoImprovementOutput,
): Promise<void> {
  void result;
  throw new Error("Optimization repository implementation starts in Phase 8.");
}

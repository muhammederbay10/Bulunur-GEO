import "server-only";

import { getServerEnv } from "@/lib/env/server";
import type {
  GeoAnalysisOutput,
  GeoImprovementOutput,
  ProductInput,
} from "@/types/ai-contract";

export function getAiServiceConfig() {
  const env = getServerEnv();

  return {
    serviceUrl: env.AI_SERVICE_URL,
    hasServiceSecret: Boolean(env.AI_SERVICE_SECRET),
  };
}

export async function analyzeProduct(
  productInput: ProductInput,
): Promise<GeoAnalysisOutput> {
  void productInput;
  throw new Error("AI analysis integration starts in Phase 7.");
}

export async function improveProduct(
  productInput: ProductInput,
): Promise<GeoImprovementOutput> {
  void productInput;
  throw new Error("AI optimization integration starts in Phase 8.");
}

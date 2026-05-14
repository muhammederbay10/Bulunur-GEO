import type { GeoAnalysisOutput, ProductInput } from "@/types/ai-contract";
import type { ProductSource, ProductWorkflowStatus } from "@/types/product";

export type ProductAnalysisStatus = "queued" | "running" | "succeeded" | "failed";

export type ProductAnalysisRecord = {
  id: string;
  status: ProductAnalysisStatus;
  overallScore?: number;
  retrievalScore?: number;
  machineUnderstandingScore?: number;
  rerankingStrengthScore?: number;
  aiAnswerReadinessScore?: number;
  detectedCategory?: string;
  buyerIntentVariants: string[];
  knownFacts: Record<string, unknown>;
  missingFacts: string[];
  mainProblems: string[];
  recommendedAction?: string;
  rawOutput?: GeoAnalysisOutput;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type ProductAnalysisDetail = {
  id: string;
  storeId: string;
  source: ProductSource;
  title: string;
  url?: string;
  language: string;
  market: string;
  description?: string;
  descriptionHtml?: string;
  shortDescription?: string;
  seoTitle?: string;
  seoDescription?: string;
  priceDisplay?: string;
  currency?: string;
  availability?: string;
  brand?: string;
  category?: string;
  imageUrls: string[];
  tags: string[];
  vendor?: string;
  productType?: string;
  workflowStatus: ProductWorkflowStatus;
  latestScore?: number;
  lastAnalyzedAt?: string;
  updatedAt: string;
};

export type ProductAnalysisContext = {
  product: ProductAnalysisDetail;
  productInput: ProductInput;
};

export type AnalyzeProductApiResponse =
  | {
      ok: true;
      productId: string;
      analysisId: string;
      analysis: GeoAnalysisOutput;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

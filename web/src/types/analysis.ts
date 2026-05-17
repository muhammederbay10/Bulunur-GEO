import type {
  GeoAnalysisOutput,
  GeoImprovementOutput,
  ProductInput,
  UserFactQuestion,
} from "@/types/ai-contract";
import type { ProductSource, ProductWorkflowStatus } from "@/types/product";
import type { ShopifyPublishableField } from "@/types/shopify";

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
  externalId?: string;
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
  productInput?: ProductInput;
  analysisUnavailableMessage?: string;
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

export type OptimizationResultStatus =
  | "draft"
  | "needs_user_input"
  | "ready_for_review"
  | "approved"
  | "exported"
  | "published"
  | "failed";

export type OptimizationResultRecord = {
  id: string;
  analysisId: string;
  status: OptimizationResultStatus;
  selectedStrategies: Array<{ name: string; reason: string }>;
  needsUserInput: UserFactQuestion[];
  userConfirmedFacts: Record<string, unknown>;
  generated: Record<string, unknown>;
  validation: Record<string, unknown>;
  scoreEstimate: Record<string, unknown>;
  beforeAfter: Record<string, unknown>;
  rawOutput?: GeoImprovementOutput;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type ImproveProductApiResponse =
  | {
      ok: true;
      productId: string;
      optimizationResultId: string;
      status: OptimizationResultStatus;
      improvement: GeoImprovementOutput;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

export type ReviewDecision = "approved" | "rejected";

export type ReviewActionRecord = {
  fieldPath: ShopifyPublishableField;
  decision: ReviewDecision;
  approvedValue?: unknown;
  reason?: string;
};

export type PublishProductApiResponse =
  | {
      ok: true;
      productId: string;
      publishJobId: string;
      publishedFields: ShopifyPublishableField[];
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

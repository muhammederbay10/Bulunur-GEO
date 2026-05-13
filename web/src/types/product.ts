export type ProductSource = "shopify" | "native" | "woocommerce";

export type ProductWorkflowStatus =
  | "not_analyzed"
  | "analysis_running"
  | "analyzed"
  | "optimization_running"
  | "optimized"
  | "published"
  | "failed";

export type ProductSummary = {
  id: string;
  storeId: string;
  source: ProductSource;
  title: string;
  url?: string;
  imageUrl?: string;
  priceDisplay?: string;
  availability?: string;
  latestScore?: number;
  workflowStatus: ProductWorkflowStatus;
  updatedAt: string;
};

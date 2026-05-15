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

export type ProductListStatusFilter =
  | "all"
  | "waiting"
  | "analyzed"
  | "optimized"
  | "low_score";

export type ProductListSourceFilter = "all" | ProductSource;

export type ProductListFilters = {
  status?: ProductListStatusFilter;
  source?: ProductListSourceFilter;
};

export type ProductDashboardMetric = {
  totalProducts: number;
  analyzedProducts: number;
  optimizedProducts: number;
  waitingProducts: number;
  lowScoreProducts: number;
};

export type ProductSourceSummary = {
  id: string;
  name: string;
  sourceType: ProductSource;
  status: string;
  lastSyncAt?: string;
  updatedAt: string;
};

export type CatalogDashboardSummary = {
  metrics: ProductDashboardMetric;
  recentProducts: ProductSummary[];
  attentionProducts: ProductSummary[];
  sources: ProductSourceSummary[];
  lastCatalogActivityAt?: string;
  errorMessage?: string;
  isMissingTable?: boolean;
};

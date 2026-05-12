export type StoreSourceType = "shopify" | "native" | "woocommerce";

export type StoreStatus =
  | "setup_pending"
  | "active"
  | "syncing"
  | "error"
  | "disconnected";

export type StoreConnectionStatus =
  | "pending"
  | "connected"
  | "error"
  | "revoked"
  | "disconnected";

export type StoreConnectionSummary = {
  id: string;
  storeId: string;
  platform: StoreSourceType;
  shopDomain: string | null;
  scopes: string[];
  status: StoreConnectionStatus;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceStore = {
  id: string;
  profileId: string;
  name: string;
  sourceType: StoreSourceType;
  websiteUrl: string | null;
  market: string;
  language: string;
  status: StoreStatus;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  connection: StoreConnectionSummary | null;
};

export type SourceSetupLookupResult = {
  stores: SourceStore[];
  errorMessage?: string;
  isMissingTable?: boolean;
};

export type NativeSourceInput = {
  storeName: string;
  websiteUrl?: string;
};

export type ShopifySourceInput = {
  shopDomain: string;
};

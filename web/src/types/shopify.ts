export type ShopifyConnectionStatus =
  | "not_connected"
  | "oauth_pending"
  | "connected"
  | "syncing"
  | "error"
  | "disconnected";

export type ShopifyProductSummary = {
  gid: string;
  title: string;
  handle: string;
  description?: string | null;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  imageUrls: string[];
  priceDisplay?: string | null;
  currency?: string | null;
  availability?: string | null;
  status?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: string | null;
};

export type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  descriptionHtml: string | null;
  status: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  updatedAt: string | null;
  totalInventory: number | null;
  seo: {
    title: string | null;
    description: string | null;
  } | null;
  priceRangeV2: {
    minVariantPrice: ShopifyMoney;
    maxVariantPrice: ShopifyMoney;
  } | null;
};

export type ShopifyPublishableField =
  | "title"
  | "descriptionHtml"
  | "tags"
  | "seo.title"
  | "seo.description";

export type ShopifyProductUpdateInput = {
  id: string;
  title?: string;
  descriptionHtml?: string;
  tags?: string[];
  seo?: {
    title?: string | null;
    description?: string | null;
  };
};

export type ShopifyProductUpdateResult = {
  product: {
    id: string;
    title: string;
    descriptionHtml: string | null;
    handle: string;
    status: string | null;
    vendor: string | null;
    productType: string | null;
    tags: string[];
    seo: {
      title: string | null;
      description: string | null;
    } | null;
  } | null;
  userErrors: Array<{
    field: string[] | null;
    message: string;
  }>;
};

export type ShopifyConnectionSummary = {
  id: string;
  profileId: string;
  storeId: string;
  shopDomain: string | null;
  externalShopId: string | null;
  scopes: string[];
  status: "pending" | "connected" | "error" | "revoked" | "disconnected";
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShopifyConnectionSecret = {
  connectionId: string;
  profileId: string;
  accessTokenCiphertext: string | null;
  tokenReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShopifyProductSyncResult = {
  storeId: string;
  shopDomain: string;
  fetchedCount: number;
  syncedCount: number;
  hasNextPage: boolean;
  lastCursor: string | null;
};

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
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  imageUrls: string[];
  seoTitle?: string;
  seoDescription?: string;
};

export type ShopifyPublishableField =
  | "title"
  | "descriptionHtml"
  | "tags"
  | "seo.title"
  | "seo.description";

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

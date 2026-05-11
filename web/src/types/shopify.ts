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

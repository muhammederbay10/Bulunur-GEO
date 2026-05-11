import "server-only";

import type {
  ShopifyConnectionStatus,
  ShopifyProductSummary,
} from "@/types/shopify";

export function getInitialShopifyConnectionStatus(): ShopifyConnectionStatus {
  return "not_connected";
}

export async function syncShopifyProducts(): Promise<ShopifyProductSummary[]> {
  throw new Error("Shopify product sync starts in Phase 4.");
}

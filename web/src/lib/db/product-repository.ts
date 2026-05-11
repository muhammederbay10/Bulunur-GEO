import "server-only";

import type { ProductSummary } from "@/types/product";

export async function listProductsForCurrentUser(): Promise<ProductSummary[]> {
  throw new Error("Product repository implementation starts in Phase 2.");
}

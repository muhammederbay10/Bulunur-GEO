import "server-only";

import type { ShopifyPublishableField } from "@/types/shopify";

export type ApprovedPublishField = {
  field: ShopifyPublishableField;
  value: string;
};

export async function publishApprovedFields(
  fields: ApprovedPublishField[],
): Promise<void> {
  void fields;
  throw new Error("Publish/apply implementation starts in Phase 9.");
}

import { z } from "zod";

import { normalizeShopDomain, isValidShopDomain } from "@/lib/shopify/validation";

export const shopifyShopDomainSchema = z
  .string()
  .trim()
  .min(1, "Shopify mağaza alan adını gir.")
  .transform(normalizeShopDomain)
  .refine(
    (value) => isValidShopDomain(value),
    "Shopify alan adı örn: magazam.myshopify.com olmalı.",
  );

export const shopifyOAuthCallbackSchema = z.object({
  code: z.string().min(1),
  hmac: z.string().min(1),
  shop: shopifyShopDomainSchema,
  state: z.string().min(1),
  timestamp: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
});

export type ShopifyOAuthCallbackInput = z.infer<
  typeof shopifyOAuthCallbackSchema
>;

export const shopifyProductSyncSchema = z.object({
  storeId: z.string().uuid(),
});

export type ShopifyProductSyncInput = z.infer<
  typeof shopifyProductSyncSchema
>;

import "server-only";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const shopifyConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.string().min(1),
  appUrl: z.string().url(),
  redirectUri: z.string().url(),
  apiVersion: z.string().regex(/^\d{4}-\d{2}$/),
  tokenEncryptionKey: z.string().refine(isValidTokenEncryptionKey, {
    message: "Must be a 32-byte base64 or hex key.",
  }),
  testShopDomain: optionalNonEmptyString,
});

export type ShopifyConfig = z.infer<typeof shopifyConfigSchema>;

export class MissingShopifyConfigError extends Error {
  constructor() {
    super("Shopify server environment variables are not configured.");
    this.name = "MissingShopifyConfigError";
  }
}

function isValidTokenEncryptionKey(value: string) {
  return (
    Buffer.from(value, "base64").length === 32 ||
    Buffer.from(value, "hex").length === 32
  );
}

export function getShopifyConfig(): ShopifyConfig {
  const result = shopifyConfigSchema.safeParse({
    clientId: process.env.SHOPIFY_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
    scopes: process.env.SHOPIFY_SCOPES,
    appUrl: process.env.SHOPIFY_APP_URL,
    redirectUri: process.env.SHOPIFY_REDIRECT_URI,
    apiVersion: process.env.SHOPIFY_API_VERSION,
    tokenEncryptionKey: process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY,
    testShopDomain: process.env.SHOPIFY_TEST_SHOP_DOMAIN,
  });

  if (!result.success) {
    throw new MissingShopifyConfigError();
  }

  return result.data;
}

export function hasShopifyConfig() {
  return shopifyConfigSchema.safeParse({
    clientId: process.env.SHOPIFY_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
    scopes: process.env.SHOPIFY_SCOPES,
    appUrl: process.env.SHOPIFY_APP_URL,
    redirectUri: process.env.SHOPIFY_REDIRECT_URI,
    apiVersion: process.env.SHOPIFY_API_VERSION,
    tokenEncryptionKey: process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY,
    testShopDomain: process.env.SHOPIFY_TEST_SHOP_DOMAIN,
  }).success;
}

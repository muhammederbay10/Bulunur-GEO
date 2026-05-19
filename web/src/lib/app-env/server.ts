import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  AI_SERVICE_URL: optionalUrl,
  AI_SERVICE_SECRET: optionalNonEmptyString,
  SHOPIFY_CLIENT_ID: optionalNonEmptyString,
  SHOPIFY_CLIENT_SECRET: optionalNonEmptyString,
  SHOPIFY_APP_URL: optionalUrl,
  SHOPIFY_REDIRECT_URI: optionalUrl,
  SHOPIFY_SCOPES: optionalNonEmptyString,
  SHOPIFY_API_VERSION: optionalNonEmptyString,
  SHOPIFY_TOKEN_ENCRYPTION_KEY: optionalNonEmptyString,
  SHOPIFY_TEST_SHOP_DOMAIN: optionalNonEmptyString,
  SUPABASE_SECRET_KEY: optionalNonEmptyString,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    AI_SERVICE_URL: process.env.AI_SERVICE_URL,
    AI_SERVICE_SECRET: process.env.AI_SERVICE_SECRET,
    SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    SHOPIFY_REDIRECT_URI: process.env.SHOPIFY_REDIRECT_URI,
    SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    SHOPIFY_TOKEN_ENCRYPTION_KEY: process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY,
    SHOPIFY_TEST_SHOP_DOMAIN: process.env.SHOPIFY_TEST_SHOP_DOMAIN,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    throw new Error("Server environment variables are invalid.");
  }

  return result.data;
}

export function getSupabaseElevatedKey() {
  const value =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return value || undefined;
}

export function hasSupabaseElevatedKey() {
  return Boolean(getSupabaseElevatedKey());
}

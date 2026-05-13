import "server-only";

import { getShopifyConfig } from "@/lib/shopify/config";
import { validateShopDomain } from "@/lib/shopify/validation";

const SHOPIFY_REQUEST_TIMEOUT_MS = 15_000;

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
};

export async function shopifyAdminGraphqlRequest<T>({
  shop,
  accessToken,
  query,
  variables,
}: {
  shop: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const config = getShopifyConfig();
  const response = await fetch(
    `https://${validateShopDomain(shop)}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: AbortSignal.timeout(SHOPIFY_REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  const data = (await response.json()) as ShopifyGraphQLResponse<T>;

  if (!response.ok) {
    console.error("[shopify] Admin API request failed", {
      status: response.status,
      statusText: response.statusText,
    });

    throw new Error("Shopify Admin API request failed.");
  }

  if (data.errors?.length) {
    console.error("[shopify] Admin API GraphQL errors", {
      errors: data.errors.map((error) => error.message),
    });

    throw new Error("Shopify Admin API returned a GraphQL error.");
  }

  if (!data.data) {
    throw new Error("Shopify Admin API response did not include data.");
  }

  return data.data;
}

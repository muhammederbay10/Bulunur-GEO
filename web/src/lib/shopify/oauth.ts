import "server-only";

import { getShopifyConfig } from "@/lib/shopify/config";
import { validateShopDomain } from "@/lib/shopify/validation";

const SHOPIFY_REQUEST_TIMEOUT_MS = 15_000;

type BuildShopifyAuthorizationUrlInput = {
  shop: string;
  nonce: string;
};

type ExchangeCodeForAccessTokenInput = {
  shop: string;
  code: string;
};

type ShopifyAccessTokenResponse = {
  access_token?: string;
  scope?: string;
};

export type ShopifyAccessToken = {
  accessToken: string;
  scope: string;
};

export function buildShopifyAuthorizationUrl({
  shop,
  nonce,
}: BuildShopifyAuthorizationUrlInput) {
  const config = getShopifyConfig();
  const url = new URL(`https://${validateShopDomain(shop)}/admin/oauth/authorize`);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", nonce);

  return url.toString();
}

export async function exchangeCodeForAccessToken({
  shop,
  code,
}: ExchangeCodeForAccessTokenInput): Promise<ShopifyAccessToken> {
  const config = getShopifyConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
  });

  const response = await fetch(
    `https://${validateShopDomain(shop)}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(SHOPIFY_REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error("Shopify token exchange failed.");
  }

  const data = (await response.json()) as ShopifyAccessTokenResponse;

  if (!data.access_token || !data.scope) {
    throw new Error("Shopify token exchange response was incomplete.");
  }

  return {
    accessToken: data.access_token,
    scope: data.scope,
  };
}

export function assertRequiredScopesGranted(grantedScope: string) {
  const requiredScopes = getShopifyConfig().scopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const grantedScopes = new Set(
    grantedScope
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
  const missingScopes = requiredScopes.filter((requiredScope) => {
    if (grantedScopes.has(requiredScope)) {
      return false;
    }

    if (requiredScope.startsWith("read_")) {
      return !grantedScopes.has(requiredScope.replace("read_", "write_"));
    }

    return true;
  });

  if (missingScopes.length > 0) {
    throw new Error("Shopify did not grant all required scopes.");
  }
}

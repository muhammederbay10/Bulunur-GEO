import "server-only";

import crypto from "node:crypto";

import { getShopifyConfig } from "@/lib/shopify/config";
import { validateShopDomain } from "@/lib/shopify/validation";

export const SHOPIFY_OAUTH_STATE_COOKIE = "shopify_oauth_state";

export type ShopifyOAuthStatePayload = {
  nonce: string;
  shop: string;
  profileId: string;
  storeId: string;
  issuedAt: string;
  returnTo?: string;
};

export function createOAuthNonce() {
  return crypto.randomBytes(24).toString("hex");
}

function signPayload(payload: string) {
  return crypto
    .createHmac("sha256", getShopifyConfig().clientSecret)
    .update(payload)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createSignedOAuthStateCookie(
  payload: Omit<ShopifyOAuthStatePayload, "shop" | "issuedAt"> & {
    shop: string;
    issuedAt?: string;
  },
) {
  const statePayload: ShopifyOAuthStatePayload = {
    ...payload,
    shop: validateShopDomain(payload.shop),
    issuedAt: payload.issuedAt ?? new Date().toISOString(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(statePayload), "utf8").toString(
    "base64url",
  );
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySignedOAuthStateCookie(
  cookieValue: string | undefined,
  expectedNonce: string,
  expectedShop: string,
) {
  if (!cookieValue) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!safeEqual(signature, signPayload(encodedPayload))) {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as ShopifyOAuthStatePayload;

    const shop = validateShopDomain(decodedPayload.shop);

    if (
      decodedPayload.nonce !== expectedNonce ||
      shop !== validateShopDomain(expectedShop)
    ) {
      return null;
    }

    return {
      ...decodedPayload,
      shop,
    };
  } catch {
    return null;
  }
}

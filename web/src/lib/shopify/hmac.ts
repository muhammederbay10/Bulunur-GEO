import "server-only";

import crypto from "node:crypto";

import { getShopifyConfig } from "@/lib/shopify/config";

function timingSafeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) {
    return false;
  }

  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyShopifyOAuthHmac(searchParams: URLSearchParams) {
  const hmac = searchParams.get("hmac");

  if (!hmac) {
    return false;
  }

  const params = new URLSearchParams(searchParams);
  params.delete("hmac");
  params.delete("signature");

  const message = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const generatedHmac = crypto
    .createHmac("sha256", getShopifyConfig().clientSecret)
    .update(message)
    .digest("hex");

  return timingSafeEqualHex(generatedHmac, hmac);
}

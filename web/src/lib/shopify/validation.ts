const SHOPIFY_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopDomain(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  let host = trimmed;

  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return trimmed;
    }
  }

  host = host.split("/")[0]?.trim() ?? "";

  if (host && !host.includes(".")) {
    return `${host}.myshopify.com`;
  }

  return host;
}

export function isValidShopDomain(value: string) {
  return SHOPIFY_DOMAIN_PATTERN.test(normalizeShopDomain(value));
}

export function validateShopDomain(value: string | null | undefined) {
  if (!value) {
    throw new Error("Missing Shopify shop domain.");
  }

  const shop = normalizeShopDomain(value);

  if (!isValidShopDomain(shop)) {
    throw new Error("Invalid Shopify shop domain.");
  }

  return shop;
}

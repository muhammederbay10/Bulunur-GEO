import "server-only";

import type { ShopifyProduct } from "@/types/shopify";

export type ShopifyProductUpsert = {
  profile_id: string;
  store_id: string;
  source: "shopify";
  external_id: string;
  external_handle: string | null;
  url: string | null;
  language: string;
  market: string;
  title: string;
  description: string | null;
  description_html: string | null;
  seo_title: string | null;
  seo_description: string | null;
  tags: string[];
  vendor: string | null;
  product_type: string | null;
  price_display: string | null;
  currency: string | null;
  availability: string | null;
  image_urls: string[];
  attributes: Record<string, unknown>;
  raw_source_payload: ShopifyProduct;
  external_updated_at: string | null;
  workflow_status: "not_analyzed";
};

export function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  );
}

function getImageUrls(product: ShopifyProduct) {
  return uniqueNonEmpty([
    product.featuredMedia?.image?.url,
    ...(product.media?.nodes.map((media) => media.image?.url) ?? []),
  ]).slice(0, 10);
}

function getPriceDisplay(product: ShopifyProduct) {
  const minPrice = product.priceRangeV2?.minVariantPrice;
  const maxPrice = product.priceRangeV2?.maxVariantPrice;

  if (!minPrice || !maxPrice) {
    return {
      priceDisplay: null,
      currency: null,
    };
  }

  if (
    minPrice.amount === maxPrice.amount &&
    minPrice.currencyCode === maxPrice.currencyCode
  ) {
    return {
      priceDisplay: `${minPrice.amount} ${minPrice.currencyCode}`,
      currency: minPrice.currencyCode,
    };
  }

  return {
    priceDisplay: `${minPrice.amount}-${maxPrice.amount} ${minPrice.currencyCode}`,
    currency: minPrice.currencyCode,
  };
}

function mapAvailability(product: ShopifyProduct) {
  if (product.status === "ACTIVE" && (product.totalInventory ?? 0) > 0) {
    return "in_stock";
  }

  if (product.status === "ACTIVE") {
    return "active";
  }

  return product.status?.toLowerCase() ?? null;
}

export function mapShopifyProductToUpsert({
  product,
  profileId,
  storeId,
  language,
  market,
}: {
  product: ShopifyProduct;
  profileId: string;
  storeId: string;
  language: string;
  market: string;
}): ShopifyProductUpsert {
  const price = getPriceDisplay(product);

  return {
    profile_id: profileId,
    store_id: storeId,
    source: "shopify",
    external_id: product.id,
    external_handle: product.handle || null,
    url: null,
    language,
    market,
    title: product.title,
    description: product.description,
    description_html: product.descriptionHtml,
    seo_title: product.seo?.title ?? null,
    seo_description: product.seo?.description ?? null,
    tags: product.tags,
    vendor: product.vendor,
    product_type: product.productType,
    price_display: price.priceDisplay,
    currency: price.currency,
    availability: mapAvailability(product),
    image_urls: getImageUrls(product),
    attributes: {
      shopifyStatus: product.status,
      totalInventory: product.totalInventory,
    },
    raw_source_payload: product,
    external_updated_at: product.updatedAt,
    workflow_status: "not_analyzed",
  };
}

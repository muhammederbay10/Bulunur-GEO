import * as cheerio from "cheerio";

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdObject
  | JsonLdValue[];

type JsonLdObject = {
  [key: string]: JsonLdValue;
};

export type JsonLdProductData = {
  title: string | null;
  description: string | null;
  images: string[];
  priceDisplay: string | null;
  currency: string | null;
  stockDisplay: string | null;
  brand: string | null;
  sku: string | null;
  categories: string[];
  rawProductSchema: JsonLdObject | null;
};

function isObject(value: unknown): value is JsonLdObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function normalizeType(type: unknown): string[] {
  if (typeof type === "string") {
    return [type.toLowerCase()];
  }

  if (Array.isArray(type)) {
    return type
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toLowerCase());
  }

  return [];
}

function isProductSchema(value: unknown): value is JsonLdObject {
  if (!isObject(value)) return false;

  const types = normalizeType(value["@type"]);

  return types.includes("product");
}

function normalizeImages(imageValue: unknown): string[] {
  if (!imageValue) return [];

  if (typeof imageValue === "string") {
    return [imageValue];
  }

  if (Array.isArray(imageValue)) {
    return imageValue
      .map((item) => {
        if (typeof item === "string") return item;

        if (isObject(item)) {
          return asString(item.url) ?? asString(item.contentUrl);
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  if (isObject(imageValue)) {
    const imageUrl =
      asString(imageValue.url) ?? asString(imageValue.contentUrl);
    return imageUrl ? [imageUrl] : [];
  }

  return [];
}

function extractOffer(product: JsonLdObject): JsonLdObject | null {
  const offers = product.offers;

  if (!offers) return null;

  if (Array.isArray(offers)) {
    return offers.find(isObject) ?? null;
  }

  if (isObject(offers)) {
    return offers;
  }

  return null;
}

function extractPriceDisplay(offer: JsonLdObject | null): string | null {
  if (!offer) return null;

  const price =
    asString(offer.price) ??
    asString(offer.lowPrice) ??
    asString(offer.highPrice);

  const currency = asString(offer.priceCurrency);

  if (price && currency) {
    return `${price} ${currency}`;
  }

  return price;
}

function extractStockDisplay(offer: JsonLdObject | null): string | null {
  if (!offer) return null;

  const availability = asString(offer.availability);

  if (!availability) return null;

  return (
    availability
      .split("/")
      .pop()
      ?.replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim() ?? null
  );
}

function extractBrand(product: JsonLdObject): string | null {
  const brand = product.brand;

  if (typeof brand === "string") {
    return brand.trim() || null;
  }

  if (isObject(brand)) {
    return asString(brand.name);
  }

  return null;
}

function extractCategories(product: JsonLdObject): string[] {
  const category = product.category;

  if (!category) return [];

  if (typeof category === "string") {
    return category
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Array.isArray(category)) {
    return category
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
  }

  return [];
}

function findProductSchemas(value: unknown): JsonLdObject[] {
  const products: JsonLdObject[] = [];

  function walk(node: unknown) {
    if (isProductSchema(node)) {
      products.push(node);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (isObject(node)) {
      if (Array.isArray(node["@graph"])) {
        node["@graph"].forEach(walk);
      }

      Object.values(node).forEach(walk);
    }
  }

  walk(value);

  return products;
}

export function extractJsonLdProduct(html: string): JsonLdProductData | null {
  const $ = cheerio.load(html);
  const products: JsonLdObject[] = [];

  $('script[type="application/ld+json"]').each((_, script) => {
    const rawJson = $(script).text().trim();

    if (!rawJson) return;

    try {
      const parsedJson = JSON.parse(rawJson) as unknown;
      products.push(...findProductSchemas(parsedJson));
    } catch {
      // Some websites have invalid JSON-LD. Ignore and continue with fallbacks.
    }
  });

  const product = products[0];

  if (!product) return null;

  const offer = extractOffer(product);

  return {
    title: asString(product.name),
    description: asString(product.description),
    images: normalizeImages(product.image),
    priceDisplay: extractPriceDisplay(offer),
    currency: offer ? asString(offer.priceCurrency) : null,
    stockDisplay: extractStockDisplay(offer),
    brand: extractBrand(product),
    sku: asString(product.sku),
    categories: extractCategories(product),
    rawProductSchema: product,
  };
}

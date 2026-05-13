import * as cheerio from "cheerio";

import type { ExtractedProductData } from "@/types/native-url-import";

import { extractJsonLdProduct } from "./extract-json-ld";

const PRICE_TEXT_PATTERN =
  /(?:₺|tl|try)\s*\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})?|\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})?\s*(?:₺|tl|try)|\b\d+[,.]\d{2}\s*(?:₺|tl|try)?/i;

const TURKISH_STOCK_HINTS = [
  { match: "stokta var", display: "Stokta Var" },
  { match: "stok var", display: "Stokta Var" },
  { match: "stokta yok", display: "Stokta Yok" },
  { match: "stok yok", display: "Stokta Yok" },
  { match: "tükendi", display: "Tükendi" },
  { match: "aynı gün kargo", display: "Aynı Gün Kargo" },
  { match: "kargo", display: "Kargo" },
];

const TURKISH_CHAR_FOLD_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value.replace(/\s+/g, " ").trim();

  return cleaned.length > 0 ? cleaned : null;
}

function cleanHtml(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function resolveUrl(
  value: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıiöşü]/g, (character) => TURKISH_CHAR_FOLD_MAP[character])
    .replace(/\s+/g, " ")
    .trim();
}

function getMetaContent(
  $: cheerio.CheerioAPI,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const content = cleanText($(selector).first().attr("content"));

    if (content) return content;
  }

  return null;
}

function getFirstText(
  $: cheerio.CheerioAPI,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const text = cleanText($(selector).first().text());

    if (text) return text;
  }

  return null;
}

function getFirstHtml(
  $: cheerio.CheerioAPI,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const html = cleanHtml($(selector).first().html());

    if (html) return html;
  }

  return null;
}

function extractPriceFromText(value: string | null | undefined): string | null {
  const text = cleanText(value);

  if (!text) return null;

  return cleanText(text.match(PRICE_TEXT_PATTERN)?.[0]);
}

function extractStockFromText(value: string | null | undefined): string | null {
  const text = cleanText(value);

  if (!text) return null;

  const normalizedText = normalizeSearchText(text);

  const stockHint = TURKISH_STOCK_HINTS.find((hint) =>
    normalizedText.includes(normalizeSearchText(hint.match)),
  );

  return stockHint?.display ?? null;
}

function extractImages($: cheerio.CheerioAPI, productUrl: string): string[] {
  const imageCandidates: string[] = [];

  const metaImage = getMetaContent($, [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ]);

  if (metaImage) {
    const resolvedMetaImage = resolveUrl(metaImage, productUrl);
    if (resolvedMetaImage) imageCandidates.push(resolvedMetaImage);
  }

  $("img").each((_, image) => {
    const src =
      $(image).attr("src") ??
      $(image).attr("data-src") ??
      $(image).attr("data-original") ??
      $(image).attr("data-lazy-src");

    const resolvedSrc = resolveUrl(src, productUrl);

    if (resolvedSrc) {
      imageCandidates.push(resolvedSrc);
    }

    const srcset = $(image).attr("srcset");

    if (srcset) {
      const firstSrcsetUrl = srcset
        .split(",")
        .map((item) => item.trim().split(" ")[0])
        .find(Boolean);

      const resolvedSrcsetUrl = resolveUrl(firstSrcsetUrl, productUrl);

      if (resolvedSrcsetUrl) {
        imageCandidates.push(resolvedSrcsetUrl);
      }
    }
  });

  return uniqueStrings(imageCandidates).slice(0, 10);
}

function extractPrice($: cheerio.CheerioAPI): string | null {
  const dataPrice = cleanText($("[data-price]").first().attr("data-price"));

  if (dataPrice) return dataPrice;

  const selectedPriceText = getFirstText($, [
    '[itemprop="price"]',
    ".price",
    ".fiyat",
    ".urun-fiyat",
    ".urun__fiyat",
    ".product-price",
    ".product__price",
    ".woocommerce-Price-amount",
    ".amount",
    "[data-price]",
    "[class*='price']",
    "[class*='fiyat']",
  ]);

  return (
    extractPriceFromText(selectedPriceText) ??
    selectedPriceText ??
    extractPriceFromText($("main").first().text()) ??
    extractPriceFromText($("body").first().text())
  );
}

function extractStock($: cheerio.CheerioAPI): string | null {
  const dataStock = cleanText($("[data-stock]").first().attr("data-stock"));

  if (dataStock) return dataStock;

  const selectedStockText = getFirstText($, [
    '[itemprop="availability"]',
    ".stock",
    ".stok",
    ".stok-durumu",
    ".availability",
    ".product-stock",
    ".urun-stok",
    "[class*='stock']",
    "[class*='stok']",
    "[class*='availability']",
    "[class*='tukendi']",
    "[class*='kargo']",
  ]);

  return (
    extractStockFromText(selectedStockText) ??
    selectedStockText ??
    extractStockFromText($("main").first().text()) ??
    extractStockFromText($("body").first().text())
  );
}

function extractBrand($: cheerio.CheerioAPI): string | null {
  return getMetaContent($, [
    'meta[property="product:brand"]',
    'meta[name="brand"]',
  ]) ?? getFirstText($, [
    '[itemprop="brand"]',
    ".brand",
    ".marka",
    ".product-brand",
    ".urun-marka",
    "[class*='brand']",
    "[class*='marka']",
  ]);
}

function extractSku($: cheerio.CheerioAPI): string | null {
  return cleanText($("[data-sku]").first().attr("data-sku")) ??
    getMetaContent($, ['meta[property="product:retailer_item_id"]']) ??
    getFirstText($, [
      '[itemprop="sku"]',
      ".sku",
      ".stok-kodu",
      ".urun-kodu",
      ".product-sku",
      "[class*='sku']",
      "[class*='stok-kodu']",
      "[class*='urun-kodu']",
    ]);
}

function extractCurrency(value: string | null | undefined): string | null {
  const text = cleanText(value)?.toLocaleUpperCase("tr-TR");

  if (!text) return null;

  if (text.includes("TRY") || text.includes("TL") || text.includes("₺")) {
    return "TRY";
  }

  if (text.includes("USD") || text.includes("$")) return "USD";
  if (text.includes("EUR") || text.includes("€")) return "EUR";

  return null;
}

function extractTags($: cheerio.CheerioAPI): string[] {
  const tagCandidates: string[] = [];

  $('meta[property="article:tag"]').each((_, element) => {
    const tag = cleanText($(element).attr("content"));
    if (tag) tagCandidates.push(tag);
  });

  $(".tag, .tags a, .product-tags a, a[rel='tag']").each((_, element) => {
    const tag = cleanText($(element).text());
    if (tag) tagCandidates.push(tag);
  });

  $(".etiket, .etiketler a, .urun-etiketleri a").each((_, element) => {
    const tag = cleanText($(element).text());
    if (tag) tagCandidates.push(tag);
  });

  return uniqueStrings(tagCandidates);
}

function extractCategories($: cheerio.CheerioAPI): string[] {
  const categoryCandidates: string[] = [];

  $(
    ".category, .categories a, .product-categories a, a[rel='category tag']",
  ).each((_, element) => {
    const category = cleanText($(element).text());
    if (category) categoryCandidates.push(category);
  });

  $(".kategori, .kategoriler a, .urun-kategorileri a").each((_, element) => {
    const category = cleanText($(element).text());
    if (category) categoryCandidates.push(category);
  });

  return uniqueStrings(categoryCandidates);
}

function extractDescriptionHtml($: cheerio.CheerioAPI): string | null {
  return getFirstHtml($, [
    '[itemprop="description"]',
    ".product-description",
    ".description",
    ".urun-aciklama",
    ".urun-detay",
    ".product__description",
    "#description",
    ".woocommerce-product-details__short-description",
    ".entry-content",
    "[class*='aciklama']",
  ]);
}

function extractPlainDescription($: cheerio.CheerioAPI): string | null {
  return getFirstText($, [
    '[itemprop="description"]',
    ".product-description",
    ".description",
    ".urun-aciklama",
    ".urun-detay",
    ".product__description",
    "#description",
    ".woocommerce-product-details__short-description",
    ".entry-content",
    "[class*='aciklama']",
  ]);
}

export function extractProductDetail(
  html: string,
  productUrl: string,
): ExtractedProductData {
  const $ = cheerio.load(html);
  const jsonLdProduct = extractJsonLdProduct(html);

  const seoTitle =
    getMetaContent($, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[property="twitter:title"]',
    ]) ?? cleanText($("title").first().text());

  const seoDescription = getMetaContent($, [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="twitter:description"]',
  ]);

  const domTitle = getFirstText($, [
    "h1",
    ".product-title",
    ".product__title",
    ".urun-adi",
    ".urun-baslik",
    ".entry-title",
    "[class*='product'][class*='title']",
    "[class*='urun'][class*='adi']",
    "[class*='urun'][class*='baslik']",
  ]);

  const descriptionHtml = extractDescriptionHtml($);
  const plainDescription = extractPlainDescription($);

  const domImages = extractImages($, productUrl);

  const title = jsonLdProduct?.title ?? domTitle ?? seoTitle;
  const finalPlainDescription =
    jsonLdProduct?.description ?? plainDescription ?? seoDescription;
  const finalDescriptionHtml = descriptionHtml ?? finalPlainDescription;

  const images = uniqueStrings([
    ...((jsonLdProduct?.images ?? [])
      .map((image) => resolveUrl(image, productUrl))
      .filter(Boolean) as string[]),
    ...domImages,
  ]);

  const priceDisplay = jsonLdProduct?.priceDisplay ?? extractPrice($);
  const stockDisplay = jsonLdProduct?.stockDisplay ?? extractStock($);
  const brand = jsonLdProduct?.brand ?? extractBrand($);
  const sku = jsonLdProduct?.sku ?? extractSku($);
  const currency = jsonLdProduct?.currency ?? extractCurrency(priceDisplay);

  const tags = extractTags($);

  const categories = uniqueStrings([
    ...(jsonLdProduct?.categories ?? []),
    ...extractCategories($),
  ]);

  const extractionMethods: string[] = [];

  if (jsonLdProduct) extractionMethods.push("json_ld_product_schema");
  if (seoTitle || seoDescription) extractionMethods.push("meta_tags");
  if (domTitle || plainDescription || domImages.length > 0) {
    extractionMethods.push("dom_heuristics");
  }

  return {
    title,
    productUrl,
    brand,
    sku,
    shortDescription: finalPlainDescription,
    descriptionHtml: finalDescriptionHtml,
    plainDescription: finalPlainDescription,
    images,
    seoTitle,
    seoDescription,
    priceDisplay,
    currency,
    stockDisplay,
    tags,
    categories,
    rawPayload: {
      jsonLdProduct,
      brand,
      sku,
      currency,
      seoTitle,
      seoDescription,
      domTitle,
      descriptionHtml,
      plainDescription,
      domImages,
      extractionMethods,
    },
    extractionMethods,
  };
}

import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import type { DetectedProductLink } from "@/types/native-url-import";

const MAX_PRODUCT_LINKS = 20;

const PRODUCT_PATH_PATTERNS = [
  /\/product\//i,
  /\/products\//i,
  /\/shop\/.+/i,
  /\/item\//i,
  /\/items\//i,
  /\/p\//i,
  /\/collections\/.+\/products\//i,
  /\/urun\//i,
  /\/urunler\//i,
  /\/urun-detay/i,
  /\/urun\/.+-\d+/i,
  /\/kategori\/.+/i,
  /\/magaza\/.+/i,
];

const PRODUCT_CONTAINER_HINTS = [
  "product",
  "product-card",
  "product-item",
  "product-grid",
  "grid__item",
  "card",
  "item",
  "woocommerce-loop-product",
  "collection",
  "urun",
  "urun-karti",
  "urun-listesi",
  "urun-grid",
  "urun-item",
  "woocommerce",
  "add-to-cart",
  "sepete-ekle",
  "kategori",
];

const BLOCKED_FILE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".pdf",
  ".zip",
  ".rar",
  ".mp4",
  ".mp3",
  ".css",
  ".js",
];

const PRODUCT_ACTION_TEXT_HINTS = [
  "sepete ekle",
  "satın al",
  "hemen al",
  "ürünü incele",
  "urun incele",
  "incele",
  "detay",
  "detaylı incele",
  "favorilere ekle",
  "add to cart",
  "buy now",
  "view product",
];

const BAD_LINK_TEXT_HINTS = [
  "anasayfa",
  "iletişim",
  "hakkımızda",
  "giriş",
  "hesabım",
  "sepet",
  "sepetim",
  "favorilerim",
  "kvkk",
  "blog",
  "teslimat",
  "iade",
  "kategori",
  "tümünü gör",
  "tumunu gor",
];

const PRICE_TEXT_PATTERN =
  /(₺|tl|try|\$|€|eur|usd)\s?\d|\d{1,3}([.\s]\d{3})*(,\d{2})?\s?(₺|tl|try)|(\d{1,3}([.,]\d{3})*|\d+)[.,]\d{2}/i;

const SLUG_WITH_ID_PATTERN = /\/[a-z0-9-]+-\d{3,}\/?$/i;

const TURKISH_CHAR_FOLD_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıiöşü]/g, (character) => TURKISH_CHAR_FOLD_MAP[character])
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalizedPathname(url: URL): string {
  try {
    return normalizeSearchText(decodeURIComponent(url.pathname));
  } catch {
    return normalizeSearchText(url.pathname);
  }
}

function hasTextHint(text: string, hints: string[]): boolean {
  const normalizedText = normalizeSearchText(text);

  return hints.some((hint) =>
    normalizedText.includes(normalizeSearchText(hint)),
  );
}

function isBlockedHref(href: string): boolean {
  const normalizedHref = href.trim().toLowerCase();

  return (
    !normalizedHref ||
    normalizedHref.startsWith("#") ||
    normalizedHref.startsWith("mailto:") ||
    normalizedHref.startsWith("tel:") ||
    normalizedHref.startsWith("javascript:")
  );
}

function hasBlockedFileExtension(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();

  return BLOCKED_FILE_EXTENSIONS.some((extension) =>
    pathname.endsWith(extension),
  );
}

function normalizeSameDomainUrl(href: string, baseUrl: string): string | null {
  if (isBlockedHref(href)) return null;

  try {
    const base = new URL(baseUrl);
    const resolvedUrl = new URL(href, base);

    if (resolvedUrl.hostname !== base.hostname) {
      return null;
    }

    if (!["http:", "https:"].includes(resolvedUrl.protocol)) {
      return null;
    }

    if (hasBlockedFileExtension(resolvedUrl)) {
      return null;
    }

    resolvedUrl.hash = "";

    return resolvedUrl.toString();
  } catch {
    return null;
  }
}

function hasProductPathSignal(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const normalizedPathname = getNormalizedPathname(parsedUrl);

    return PRODUCT_PATH_PATTERNS.some((pattern) =>
      pattern.test(normalizedPathname),
    );
  } catch {
    return false;
  }
}

function getElementHints($element: cheerio.Cheerio<Element>): string {
  const className = $element.attr("class") ?? "";
  const id = $element.attr("id") ?? "";

  return normalizeSearchText(`${className} ${id}`);
}

function hasProductContainerSignal(
  $: cheerio.CheerioAPI,
  anchor: Element,
): boolean {
  const $anchor = $(anchor);

  const selfHints = getElementHints($anchor);

  if (PRODUCT_CONTAINER_HINTS.some((hint) => selfHints.includes(hint))) {
    return true;
  }

  const parentHints = $anchor
    .parents()
    .slice(0, 4)
    .toArray()
    .map((parent) => getElementHints($(parent)))
    .join(" ");

  return PRODUCT_CONTAINER_HINTS.some((hint) => parentHints.includes(hint));
}

function hasVisualProductSignal(
  $: cheerio.CheerioAPI,
  anchor: Element,
): boolean {
  const $anchor = $(anchor);

  const hasImage = $anchor.find("img").length > 0;
  const text = normalizeSearchText($anchor.text());

  return hasImage || (text.length >= 3 && text.length <= 150);
}

function getNearbyText($: cheerio.CheerioAPI, anchor: Element): string {
  const $anchor = $(anchor);

  const ownText = normalizeSearchText($anchor.text());

  const nearbyText = $anchor
    .parents()
    .slice(0, 4)
    .map((_, parent) => normalizeSearchText($(parent).text()))
    .get()
    .join(" ");

  return `${ownText} ${nearbyText}`.replace(/\s+/g, " ").trim();
}

function hasPriceSignal(text: string): boolean {
  return PRICE_TEXT_PATTERN.test(normalizeSearchText(text));
}

function hasActionSignal(text: string): boolean {
  return hasTextHint(text, PRODUCT_ACTION_TEXT_HINTS);
}

function hasBadLinkText(text: string): boolean {
  return hasTextHint(text, BAD_LINK_TEXT_HINTS);
}

function hasSlugWithIdSignal(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return SLUG_WITH_ID_PATTERN.test(getNormalizedPathname(parsedUrl));
  } catch {
    return false;
  }
}

function hasProductLikeAnchorText(
  $: cheerio.CheerioAPI,
  anchor: Element,
): boolean {
  const text = normalizeSearchText($(anchor).text());

  if (text.length < 4 || text.length > 120) return false;
  if (hasBadLinkText(text) && !hasActionSignal(text)) return false;

  return true;
}

function calculateLinkScore({
  $,
  anchor,
  url,
}: {
  $: cheerio.CheerioAPI;
  anchor: Element;
  url: string;
}): number {
  let score = 0;

  const nearbyText = getNearbyText($, anchor);
  const anchorText = normalizeSearchText($(anchor).text());

  if (hasBadLinkText(anchorText) && !hasActionSignal(anchorText)) {
    score -= 40;
  }

  if (hasProductPathSignal(url)) {
    score += 60;
  }

  if (hasSlugWithIdSignal(url)) {
    score += 45;
  }

  if (hasProductContainerSignal($, anchor)) {
    score += 25;
  }

  if (hasVisualProductSignal($, anchor)) {
    score += 15;
  }

  if (hasPriceSignal(nearbyText)) {
    score += 35;
  }

  if (hasActionSignal(nearbyText)) {
    score += 25;
  }

  if (hasProductLikeAnchorText($, anchor)) {
    score += 20;
  }

  return score;
}

export function detectProductLinks(
  html: string,
  listingUrl: string,
  limit = MAX_PRODUCT_LINKS,
): DetectedProductLink[] {
  const $ = cheerio.load(html);
  const candidates = new Map<string, DetectedProductLink>();

  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");

    if (!href) return;

    const normalizedUrl = normalizeSameDomainUrl(href, listingUrl);

    if (!normalizedUrl) return;

    const score = calculateLinkScore({
      $,
      anchor,
      url: normalizedUrl,
    });

    if (score < 55) return;

    const existingCandidate = candidates.get(normalizedUrl);

    if (!existingCandidate || score > (existingCandidate.confidenceHint ?? 0)) {
      candidates.set(normalizedUrl, {
        url: normalizedUrl,
        source: hasProductPathSignal(normalizedUrl)
          ? "anchor_heuristic"
          : "card_heuristic",
        confidenceHint: score,
      });
    }
  });

  return Array.from(candidates.values())
    .sort((first, second) => {
      return (second.confidenceHint ?? 0) - (first.confidenceHint ?? 0);
    })
    .slice(0, limit);
}

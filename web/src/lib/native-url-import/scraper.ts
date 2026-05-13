import { randomUUID } from "node:crypto";

import pLimit from "p-limit";

import type {
  NativeUrlImportErrorCode,
  ScanResponse,
  ScrapePreviewItem,
} from "@/types/native-url-import";

import { calculateProductConfidence } from "./confidence-score";
import { detectProductLinks } from "./detect-product-links";
import { extractProductDetail } from "./extract-product-detail";
import { safeFetchHtml } from "./safe-fetch";

const MAX_PRODUCTS_TO_SCAN = 20;
const PRODUCT_PAGE_CONCURRENCY = 3;

function createFailedPreviewItem(
  productUrl: string,
  error: string,
  errorCode?: NativeUrlImportErrorCode,
): ScrapePreviewItem {
  return {
    id: randomUUID(),
    productUrl,
    title: null,
    imageUrl: null,
    shortDescription: null,
    descriptionHtml: null,
    plainDescription: null,
    priceDisplay: null,
    stockDisplay: null,
    seoTitle: null,
    seoDescription: null,
    tags: [],
    categories: [],
    extractionConfidence: 0,
    status: "failed",
    warnings: [error],
    rawPayload: {
      error,
      errorCode,
    },
  };
}

async function scrapeSingleProduct(
  productUrl: string,
): Promise<ScrapePreviewItem> {
  const fetchResult = await safeFetchHtml(productUrl);

  if (!fetchResult.ok || !fetchResult.html) {
    return createFailedPreviewItem(
      productUrl,
      fetchResult.error ?? "Failed to fetch product page.",
      fetchResult.errorCode,
    );
  }

  const product = extractProductDetail(fetchResult.html, productUrl);
  const confidence = calculateProductConfidence(product);

  return {
    id: randomUUID(),
    productUrl,
    title: product.title,
    imageUrl: product.images[0] ?? null,
    shortDescription: product.shortDescription,
    descriptionHtml: product.descriptionHtml,
    plainDescription: product.plainDescription,
    priceDisplay: product.priceDisplay,
    stockDisplay: product.stockDisplay,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    tags: product.tags,
    categories: product.categories,
    extractionConfidence: confidence.score,
    status: confidence.status,
    warnings: confidence.warnings,
    rawPayload: {
      ...product.rawPayload,
      productUrl: product.productUrl,
      images: product.images,
      extractionMethods: product.extractionMethods,
    },
  };
}

export async function scanNativeProductListing(
  sourceUrl: string,
): Promise<ScanResponse> {
  const listingFetchResult = await safeFetchHtml(sourceUrl);

  if (!listingFetchResult.ok || !listingFetchResult.html) {
    return {
      success: false,
      sourceUrl,
      normalizedUrl: listingFetchResult.finalUrl ?? listingFetchResult.url,
      detectedCount: 0,
      previewItems: [],
      status:
        listingFetchResult.errorCode === "blocked_status" ||
        listingFetchResult.status === 401 ||
        listingFetchResult.status === 403 ||
        listingFetchResult.status === 429
          ? "blocked"
          : "failed",
      error:
        listingFetchResult.error ??
        "Could not safely fetch the product listing page.",
      errorCode: listingFetchResult.errorCode,
    };
  }

  const listingUrl = listingFetchResult.finalUrl ?? listingFetchResult.url;

  const detectedProductLinks = detectProductLinks(
    listingFetchResult.html,
    listingUrl,
    MAX_PRODUCTS_TO_SCAN,
  );

  if (detectedProductLinks.length === 0) {
    return {
      success: false,
      sourceUrl,
      normalizedUrl: listingUrl,
      detectedCount: 0,
      previewItems: [],
      status: "failed",
      error:
        "No product links were detected on this page. Try a shop, products, collection, or category page.",
      errorCode: "no_product_links",
    };
  }

  const limit = pLimit(PRODUCT_PAGE_CONCURRENCY);

  const previewItems = await Promise.all(
    detectedProductLinks.map((link) =>
      limit(() => scrapeSingleProduct(link.url)),
    ),
  );

  const usablePreviewItems = previewItems.filter(
    (item) => item.status !== "failed",
  );

  if (usablePreviewItems.length === 0) {
    return {
      success: false,
      sourceUrl,
      normalizedUrl: listingUrl,
      detectedCount: detectedProductLinks.length,
      previewItems,
      status: "failed",
      error:
        "Product links were found, but none of the product pages could be parsed successfully.",
      errorCode: "all_products_failed",
    };
  }

  return {
    success: true,
    sourceUrl,
    normalizedUrl: listingUrl,
    detectedCount: detectedProductLinks.length,
    previewItems,
    status: "preview_ready",
  };
}

export async function scanNativeProductUrls(
  productUrls: string[],
): Promise<ScanResponse> {
  const uniqueProductUrls = Array.from(
    new Set(productUrls.map((productUrl) => productUrl.trim()).filter(Boolean)),
  ).slice(0, MAX_PRODUCTS_TO_SCAN);

  if (uniqueProductUrls.length === 0) {
    return {
      success: false,
      sourceUrl: "manual_product_urls",
      detectedCount: 0,
      previewItems: [],
      status: "failed",
      error: "Please paste at least one product URL.",
      errorCode: "invalid_url",
    };
  }

  const limit = pLimit(PRODUCT_PAGE_CONCURRENCY);

  const previewItems = await Promise.all(
    uniqueProductUrls.map((productUrl) =>
      limit(() => scrapeSingleProduct(productUrl)),
    ),
  );

  const usablePreviewItems = previewItems.filter(
    (item) => item.status !== "failed",
  );

  if (usablePreviewItems.length === 0) {
    return {
      success: false,
      sourceUrl: "manual_product_urls",
      detectedCount: uniqueProductUrls.length,
      previewItems,
      status: "failed",
      error:
        "Product URLs were provided, but none of the product pages could be parsed successfully.",
      errorCode: "all_products_failed",
    };
  }

  return {
    success: true,
    sourceUrl: "manual_product_urls",
    detectedCount: uniqueProductUrls.length,
    previewItems,
    status: "preview_ready",
  };
}

import { randomUUID } from "node:crypto";

import pLimit from "p-limit";

import type {
  NativeCrawlMetadata,
  NativeUrlImportErrorCode,
  ScanResponse,
  ScrapePreviewFailure,
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
): ScrapePreviewFailure {
  return {
    id: randomUUID(),
    productUrl,
    status:
      errorCode === "blocked_status" ||
      errorCode === "robots_disallowed" ||
      errorCode === "robots_unavailable"
        ? "blocked"
        : "failed",
    error,
    errorCode,
  };
}

function createFallbackCrawlMetadata(productUrl: string): NativeCrawlMetadata {
  return {
    requestedUrl: productUrl,
    finalUrl: productUrl,
    fetchedAt: null,
    httpStatus: null,
    contentType: null,
    robots: null,
  };
}

function isScrapePreviewItem(
  item: ScrapePreviewItem | ScrapePreviewFailure,
): item is ScrapePreviewItem {
  return item.status !== "failed" && item.status !== "blocked";
}

async function scrapeSingleProduct(
  productUrl: string,
): Promise<ScrapePreviewItem | ScrapePreviewFailure> {
  const fetchResult = await safeFetchHtml(productUrl);

  if (!fetchResult.ok || !fetchResult.html) {
    return createFailedPreviewItem(
      productUrl,
      fetchResult.error ?? "Failed to fetch product page.",
      fetchResult.errorCode,
    );
  }

  const finalProductUrl = fetchResult.finalUrl ?? fetchResult.url;
  const product = extractProductDetail(fetchResult.html, finalProductUrl);
  const confidence = calculateProductConfidence(product);

  return {
    id: randomUUID(),
    productUrl: finalProductUrl,
    title: product.title,
    brand: product.brand,
    sku: product.sku,
    imageUrl: product.images[0] ?? null,
    shortDescription: product.shortDescription,
    descriptionHtml: product.descriptionHtml,
    plainDescription: product.plainDescription,
    priceDisplay: product.priceDisplay,
    currency: product.currency,
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
      normalized: {
        title: product.title,
        productUrl: product.productUrl,
        brand: product.brand,
        sku: product.sku,
        shortDescription: product.shortDescription,
        descriptionHtml: product.descriptionHtml,
        plainDescription: product.plainDescription,
        images: product.images,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        priceDisplay: product.priceDisplay,
        currency: product.currency,
        stockDisplay: product.stockDisplay,
        tags: product.tags,
        categories: product.categories,
        extractionMethods: product.extractionMethods,
        extractionConfidence: confidence.score,
        confidenceStatus: confidence.status,
        warnings: confidence.warnings,
      },
      productUrl: product.productUrl,
      images: product.images,
      extractionMethods: product.extractionMethods,
    },
    crawlMetadata:
      fetchResult.crawlMetadata ?? createFallbackCrawlMetadata(finalProductUrl),
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
    const directProductFallback = await scrapeSingleProduct(listingUrl);

    if (
      isScrapePreviewItem(directProductFallback) &&
      directProductFallback.title &&
      directProductFallback.extractionConfidence >= 50
    ) {
      return {
        success: true,
        sourceUrl,
        normalizedUrl: listingUrl,
        detectedCount: 1,
        previewItems: [
          {
            ...directProductFallback,
            warnings: [
              ...directProductFallback.warnings,
              "No listing links were detected, so this URL was scanned as a direct product page.",
            ],
          },
        ],
        status: "preview_ready",
      };
    }

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

  const scanItems = await Promise.all(
    detectedProductLinks.map((link) =>
      limit(() => scrapeSingleProduct(link.url)),
    ),
  );

  const previewItems = scanItems.filter(
    (item): item is ScrapePreviewItem => isScrapePreviewItem(item),
  );

  const failedItems = scanItems.filter(
    (item): item is ScrapePreviewFailure =>
      item.status === "failed" || item.status === "blocked",
  );

  if (previewItems.length === 0) {
    return {
      success: false,
      sourceUrl,
      normalizedUrl: listingUrl,
      detectedCount: detectedProductLinks.length,
      previewItems: [],
      failedItems,
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
    failedItems,
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

  const scanItems = await Promise.all(
    uniqueProductUrls.map((productUrl) =>
      limit(() => scrapeSingleProduct(productUrl)),
    ),
  );

  const previewItems = scanItems.filter(
    (item): item is ScrapePreviewItem => isScrapePreviewItem(item),
  );

  const failedItems = scanItems.filter(
    (item): item is ScrapePreviewFailure =>
      item.status === "failed" || item.status === "blocked",
  );

  if (previewItems.length === 0) {
    return {
      success: false,
      sourceUrl: "manual_product_urls",
      detectedCount: uniqueProductUrls.length,
      previewItems: [],
      failedItems,
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
    failedItems,
    status: "preview_ready",
  };
}

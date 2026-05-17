import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/db/profile-repository";
import {
  completeScrapeJob,
  createRunningScrapeJob,
  persistScrapePreviewItems,
} from "@/lib/db/scrape-repository";
import { getActiveNativeSourceForUser } from "@/lib/db/source-repository";
import {
  scanNativeProductListing,
  scanNativeProductUrls,
} from "@/lib/native-url-import/scraper";
import { validateProductListingUrl } from "@/lib/native-url-import/validate-url";
import type {
  NativeUrlImportSourceContext,
  ScanResponse,
} from "@/types/native-url-import";

const scanUrlSchema = z
  .object({
    url: z.string().trim().min(1).optional(),
    urls: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  .superRefine((value, context) => {
    const hasListingUrl = Boolean(value.url?.trim());
    const hasProductUrls = Boolean(
      value.urls?.some((productUrl) => productUrl.trim()),
    );

    if (!hasListingUrl && !hasProductUrls) {
      context.addIssue({
        code: "custom",
        message: "URL is required.",
      });
    }

    if (hasListingUrl && hasProductUrls) {
      context.addIssue({
        code: "custom",
        message: "Provide either a listing URL or product URLs, not both.",
      });
    }
  });

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function mapNativeSourceContext(
  store: {
    id: string;
    name: string;
    websiteUrl: string | null;
    market: string;
    language: string;
  },
): NativeUrlImportSourceContext {
  return {
    storeId: store.id,
    storeName: store.name,
    websiteUrl: store.websiteUrl,
    market: store.market,
    language: store.language,
  };
}

function withSource(
  scanResult: ScanResponse,
  source: NativeUrlImportSourceContext,
  scrapeJobId?: string,
): ScanResponse {
  return {
    ...scanResult,
    source,
    scrapeJobId,
  };
}

function scanStorageFailureResponse(params: {
  sourceUrl: string;
  source: NativeUrlImportSourceContext;
  scrapeJobId?: string;
  error: string;
  errorCode: ScanResponse["errorCode"];
}): ScanResponse {
  return {
    success: false,
    sourceUrl: params.sourceUrl,
    scrapeJobId: params.scrapeJobId,
    source: params.source,
    detectedCount: 0,
    previewItems: [],
    status: "failed",
    error: params.error,
    errorCode: params.errorCode,
  };
}

async function persistScanSession(params: {
  profileId: string;
  storeId: string;
  scrapeJobId: string;
  source: NativeUrlImportSourceContext;
  sourceUrl: string;
  normalizedUrl?: string | null;
  scanResult: ScanResponse;
}): Promise<{ body: ScanResponse; status: number }> {
  if (params.scanResult.previewItems.length > 0) {
    const persistResult = await persistScrapePreviewItems({
      profileId: params.profileId,
      storeId: params.storeId,
      scrapeJobId: params.scrapeJobId,
      previewItems: params.scanResult.previewItems,
    });

    if (!persistResult.ok) {
      await completeScrapeJob({
        profileId: params.profileId,
        scrapeJobId: params.scrapeJobId,
        status: "failed",
        normalizedUrl: params.scanResult.normalizedUrl ?? params.normalizedUrl,
        errorCode: persistResult.code,
        errorMessage: persistResult.message,
      });

      return {
        body: scanStorageFailureResponse({
          sourceUrl: params.sourceUrl,
          source: params.source,
          scrapeJobId: params.scrapeJobId,
          error: persistResult.message,
          errorCode: persistResult.code,
        }),
        status: persistResult.status,
      };
    }
  }

  const failedCount = params.scanResult.failedItems?.length ?? 0;
  const completeResult = await completeScrapeJob({
    profileId: params.profileId,
    scrapeJobId: params.scrapeJobId,
    status: params.scanResult.success ? "preview_ready" : "failed",
    normalizedUrl: params.scanResult.normalizedUrl ?? params.normalizedUrl,
    errorCode: params.scanResult.success
      ? failedCount > 0
        ? "partial_product_failures"
        : null
      : (params.scanResult.errorCode ?? "unexpected_error"),
    errorMessage: params.scanResult.success
      ? failedCount > 0
        ? `${failedCount} ürün sayfası taranamadı.`
        : null
      : (params.scanResult.error ?? "Web sitesi taraması başarısız oldu."),
  });

  if (!completeResult.ok) {
    return {
      body: scanStorageFailureResponse({
        sourceUrl: params.sourceUrl,
        source: params.source,
        scrapeJobId: params.scrapeJobId,
        error: completeResult.message,
        errorCode: completeResult.code,
      }),
      status: completeResult.status,
    };
  }

  return {
    body: withSource(params.scanResult, params.source, params.scrapeJobId),
    status: params.scanResult.success ? 200 : 422,
  };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          sourceUrl: "",
          detectedCount: 0,
          previewItems: [],
          status: "failed",
          error: "Oturum gerekli.",
          errorCode: "unauthorized",
        } satisfies ScanResponse,
        { status: 401 },
      );
    }

    const parsedBody = scanUrlSchema.safeParse(await readJsonBody(request));

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          sourceUrl: "",
          detectedCount: 0,
          previewItems: [],
          status: "failed",
          error: parsedBody.error.issues[0]?.message ?? "Geçersiz istek gövdesi.",
          errorCode: "invalid_scan_request",
        } satisfies ScanResponse,
        { status: 400 },
      );
    }

    const nativeSource = await getActiveNativeSourceForUser(user.id);

    if (!nativeSource.ok) {
      return NextResponse.json(
        {
          success: false,
          sourceUrl: parsedBody.data.url ?? "manual_product_urls",
          detectedCount: 0,
          previewItems: [],
          status: "failed",
          error: nativeSource.message,
          errorCode: nativeSource.code,
        } satisfies ScanResponse,
        { status: nativeSource.status },
      );
    }

    const source = mapNativeSourceContext(nativeSource.store);

    if (parsedBody.data.urls) {
      const jobResult = await createRunningScrapeJob({
        profileId: user.id,
        storeId: nativeSource.store.id,
        inputUrl: "manual_product_urls",
        normalizedUrl: null,
      });

      if (!jobResult.ok) {
        return NextResponse.json(
          scanStorageFailureResponse({
            sourceUrl: "manual_product_urls",
            source,
            error: jobResult.message,
            errorCode: jobResult.code,
          }),
          { status: jobResult.status },
        );
      }

      const scanResult = await scanNativeProductUrls(parsedBody.data.urls);
      const persistedScan = await persistScanSession({
        profileId: user.id,
        storeId: nativeSource.store.id,
        scrapeJobId: jobResult.data.scrapeJobId,
        source,
        sourceUrl: "manual_product_urls",
        normalizedUrl: null,
        scanResult,
      });

      return NextResponse.json(persistedScan.body, {
        status: persistedScan.status,
      });
    }

    const sourceUrl = parsedBody.data.url ?? "";
    const validationResult = validateProductListingUrl(sourceUrl);

    if (!validationResult.isValid || !validationResult.normalizedUrl) {
      return NextResponse.json(
        {
          success: false,
          sourceUrl,
          detectedCount: 0,
          previewItems: [],
          status: "failed",
          error: validationResult.error ?? "Geçersiz URL.",
          errorCode: validationResult.errorCode ?? "invalid_url",
          source,
        } satisfies ScanResponse,
        { status: 400 },
      );
    }

    const jobResult = await createRunningScrapeJob({
      profileId: user.id,
      storeId: nativeSource.store.id,
      inputUrl: sourceUrl,
      normalizedUrl: validationResult.normalizedUrl,
    });

    if (!jobResult.ok) {
      return NextResponse.json(
        scanStorageFailureResponse({
          sourceUrl,
          source,
          error: jobResult.message,
          errorCode: jobResult.code,
        }),
        { status: jobResult.status },
      );
    }

    const scanResult = await scanNativeProductListing(
      validationResult.normalizedUrl,
    );
    const persistedScan = await persistScanSession({
      profileId: user.id,
      storeId: nativeSource.store.id,
      scrapeJobId: jobResult.data.scrapeJobId,
      source,
      sourceUrl,
      normalizedUrl: validationResult.normalizedUrl,
      scanResult,
    });

    return NextResponse.json(persistedScan.body, {
      status: persistedScan.status,
    });
  } catch (error) {
    console.error("[native-url-import/scan]", error);

    return NextResponse.json(
      {
        success: false,
        sourceUrl: "",
        detectedCount: 0,
        previewItems: [],
        status: "failed",
        error: "Unexpected error while scanning the website.",
        errorCode: "unexpected_error",
      } satisfies ScanResponse,
      { status: 500 },
    );
  }
}

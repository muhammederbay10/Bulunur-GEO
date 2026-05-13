import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { upsertNativeProductsFromPreviewItems } from "@/lib/db/product-repository";
import {
  completeScrapeJob,
  loadOwnedScrapePreviewItems,
  markScrapePreviewItemsImported,
} from "@/lib/db/scrape-repository";
import { getActiveNativeSourceForUser } from "@/lib/db/source-repository";
import type {
  NativeUrlImportResponse,
  NativeUrlImportSourceContext,
} from "@/types/native-url-import";

const importRequestSchema = z.object({
  scrapeJobId: z.uuid(),
  previewItemIds: z.array(z.uuid()).min(1).max(20),
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

function importFailureResponse(params: {
  scrapeJobId?: string;
  source?: NativeUrlImportSourceContext;
  error: string;
  errorCode: NativeUrlImportResponse["errorCode"];
}): NativeUrlImportResponse {
  return {
    success: false,
    scrapeJobId: params.scrapeJobId,
    source: params.source,
    importedCount: 0,
    productIds: [],
    error: params.error,
    errorCode: params.errorCode,
  };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        importFailureResponse({
          error: "Oturum gerekli.",
          errorCode: "unauthorized",
        }),
        { status: 401 },
      );
    }

    const parsedBody = importRequestSchema.safeParse(
      await readJsonBody(request),
    );

    if (!parsedBody.success) {
      return NextResponse.json(
        importFailureResponse({
          error:
            parsedBody.error.issues[0]?.message ?? "Invalid import request.",
          errorCode: "invalid_import_request",
        }),
        { status: 400 },
      );
    }

    const nativeSource = await getActiveNativeSourceForUser(user.id);

    if (!nativeSource.ok) {
      return NextResponse.json(
        importFailureResponse({
          scrapeJobId: parsedBody.data.scrapeJobId,
          error: nativeSource.message,
          errorCode: nativeSource.code,
        }),
        { status: nativeSource.status },
      );
    }

    const source = mapNativeSourceContext(nativeSource.store);
    const uniquePreviewItemIds = Array.from(
      new Set(parsedBody.data.previewItemIds),
    );

    const previewResult = await loadOwnedScrapePreviewItems({
      profileId: user.id,
      storeId: nativeSource.store.id,
      scrapeJobId: parsedBody.data.scrapeJobId,
      previewItemIds: uniquePreviewItemIds,
    });

    if (!previewResult.ok) {
      return NextResponse.json(
        importFailureResponse({
          scrapeJobId: parsedBody.data.scrapeJobId,
          source,
          error: previewResult.message,
          errorCode: previewResult.code,
        }),
        { status: previewResult.status },
      );
    }

    const importResult = await upsertNativeProductsFromPreviewItems({
      profileId: user.id,
      storeId: nativeSource.store.id,
      language: nativeSource.store.language,
      market: nativeSource.store.market,
      previewItems: previewResult.data,
    });

    if (!importResult.ok) {
      return NextResponse.json(
        importFailureResponse({
          scrapeJobId: parsedBody.data.scrapeJobId,
          source,
          error: importResult.message,
          errorCode: "native_product_import_failed",
        }),
        { status: 500 },
      );
    }

    const markPreviewResult = await markScrapePreviewItemsImported({
      profileId: user.id,
      storeId: nativeSource.store.id,
      scrapeJobId: parsedBody.data.scrapeJobId,
      importedItems: importResult.data.importedItems,
    });

    if (!markPreviewResult.ok) {
      return NextResponse.json(
        importFailureResponse({
          scrapeJobId: parsedBody.data.scrapeJobId,
          source,
          error: markPreviewResult.message,
          errorCode: markPreviewResult.code,
        }),
        { status: markPreviewResult.status },
      );
    }

    const completeResult = await completeScrapeJob({
      profileId: user.id,
      scrapeJobId: parsedBody.data.scrapeJobId,
      status: "imported",
    });

    if (!completeResult.ok) {
      return NextResponse.json(
        importFailureResponse({
          scrapeJobId: parsedBody.data.scrapeJobId,
          source,
          error: completeResult.message,
          errorCode: completeResult.code,
        }),
        { status: completeResult.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        scrapeJobId: parsedBody.data.scrapeJobId,
        source,
        importedCount: importResult.data.importedCount,
        productIds: importResult.data.importedItems.map((item) => item.productId),
      } satisfies NativeUrlImportResponse,
    );
  } catch (error) {
    console.error("[native-url-import/import]", error);

    return NextResponse.json(
      importFailureResponse({
        error: "Unexpected error while importing native products.",
        errorCode: "unexpected_error",
      }),
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/db/profile-repository";
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
): ScanResponse {
  return {
    ...scanResult,
    source,
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
          error: parsedBody.error.issues[0]?.message ?? "Invalid request body.",
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
      const scanResult = await scanNativeProductUrls(parsedBody.data.urls);
      const responseStatus = scanResult.success ? 200 : 422;

      return NextResponse.json(withSource(scanResult, source), {
        status: responseStatus,
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
          error: validationResult.error ?? "Invalid URL.",
          errorCode: validationResult.errorCode ?? "invalid_url",
          source,
        } satisfies ScanResponse,
        { status: 400 },
      );
    }

    const scanResult = await scanNativeProductListing(
      validationResult.normalizedUrl,
    );

    const responseStatus = scanResult.success ? 200 : 422;

    return NextResponse.json(withSource(scanResult, source), {
      status: responseStatus,
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

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  scanNativeProductListing,
  scanNativeProductUrls,
} from "@/lib/native-url-import/scraper";
import { validateProductListingUrl } from "@/lib/native-url-import/validate-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scanUrlSchema = z
  .object({
    url: z.string().optional(),
    urls: z.array(z.string().min(1)).max(20).optional(),
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
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = scanUrlSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          sourceUrl: "",
          detectedCount: 0,
          previewItems: [],
          status: "failed",
          error: parsedBody.error.issues[0]?.message ?? "Invalid request body.",
          errorCode: "invalid_url",
        },
        { status: 400 },
      );
    }

    if (parsedBody.data.urls) {
      const scanResult = await scanNativeProductUrls(parsedBody.data.urls);
      const responseStatus = scanResult.success ? 200 : 422;

      return NextResponse.json(scanResult, { status: responseStatus });
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
        },
        { status: 400 },
      );
    }

    const scanResult = await scanNativeProductListing(
      validationResult.normalizedUrl,
    );

    const responseStatus = scanResult.success ? 200 : 422;

    return NextResponse.json(scanResult, { status: responseStatus });
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
      },
      { status: 500 },
    );
  }
}

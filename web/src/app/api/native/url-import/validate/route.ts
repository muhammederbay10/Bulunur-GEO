import { NextResponse } from "next/server";
import { z } from "zod";

import { safeFetchHtml } from "@/lib/native-url-import/safe-fetch";
import { validateProductListingUrl } from "@/lib/native-url-import/validate-url";

export const runtime = "nodejs";

const validateUrlSchema = z.object({
  url: z.string().min(1, "URL is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = validateUrlSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          result: {
            isValid: false,
            error:
              parsedBody.error.issues[0]?.message ?? "Invalid request body.",
            errorCode: "invalid_url",
          },
        },
        { status: 400 },
      );
    }

    const validationResult = validateProductListingUrl(parsedBody.data.url);

    if (!validationResult.isValid || !validationResult.normalizedUrl) {
      return NextResponse.json(
        {
          success: false,
          result: validationResult,
        },
        { status: 400 },
      );
    }

    const fetchResult = await safeFetchHtml(validationResult.normalizedUrl);

    if (!fetchResult.ok) {
      return NextResponse.json(
        {
          success: false,
          result: validationResult,
          preflight: {
            ok: false,
            status: fetchResult.status ?? null,
            contentType: fetchResult.contentType ?? null,
            finalUrl: fetchResult.finalUrl ?? null,
            error: fetchResult.error ?? "Website could not be reached safely.",
            errorCode: fetchResult.errorCode ?? "fetch_failed",
          },
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      result: validationResult,
      preflight: {
        ok: true,
        status: fetchResult.status ?? null,
        contentType: fetchResult.contentType ?? null,
        finalUrl: fetchResult.finalUrl ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        result: {
          isValid: false,
          error: "Invalid JSON request body.",
          errorCode: "invalid_url",
        },
      },
      { status: 400 },
    );
  }
}

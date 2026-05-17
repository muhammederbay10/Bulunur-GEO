import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { getActiveNativeSourceForUser } from "@/lib/db/source-repository";
import { safeFetchHtml } from "@/lib/native-url-import/safe-fetch";
import { validateProductListingUrl } from "@/lib/native-url-import/validate-url";
import type {
  NativeUrlImportSourceContext,
  ValidateUrlResponse,
} from "@/types/native-url-import";

const validateUrlSchema = z.object({
  url: z.string().trim().min(1, "URL is required."),
});

async function readJsonBody(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        result: {
          isValid: false,
          error: "Oturum gerekli.",
          errorCode: "unauthorized",
        },
      } satisfies ValidateUrlResponse,
      { status: 401 },
    );
  }

  try {
    const parsedBody = validateUrlSchema.safeParse(await readJsonBody(request));

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          result: {
            isValid: false,
            error:
              parsedBody.error.issues[0]?.message ?? "Geçersiz istek gövdesi.",
            errorCode: "invalid_url",
          },
        } satisfies ValidateUrlResponse,
        { status: 400 },
      );
    }

    const nativeSource = await getActiveNativeSourceForUser(user.id);

    if (!nativeSource.ok) {
      return NextResponse.json(
        {
          success: false,
          result: {
            isValid: false,
            error: nativeSource.message,
            errorCode: nativeSource.code,
          },
        } satisfies ValidateUrlResponse,
        { status: nativeSource.status },
      );
    }

    const source = mapNativeSourceContext(nativeSource.store);
    const validationResult = validateProductListingUrl(parsedBody.data.url);

    if (!validationResult.isValid || !validationResult.normalizedUrl) {
      return NextResponse.json(
        {
          success: false,
          result: validationResult,
          source,
        } satisfies ValidateUrlResponse,
        { status: 400 },
      );
    }

    const fetchResult = await safeFetchHtml(validationResult.normalizedUrl);

    if (!fetchResult.ok) {
      return NextResponse.json(
        {
          success: false,
          result: validationResult,
          source,
          preflight: {
            ok: false,
            status: fetchResult.status ?? null,
            contentType: fetchResult.contentType ?? null,
            finalUrl: fetchResult.finalUrl ?? null,
            error: fetchResult.error ?? "Web sitesine güvenli şekilde ulaşılamadı.",
            errorCode: fetchResult.errorCode ?? "fetch_failed",
          },
        } satisfies ValidateUrlResponse,
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: validationResult,
        source,
        preflight: {
          ok: true,
          status: fetchResult.status ?? null,
          contentType: fetchResult.contentType ?? null,
          finalUrl: fetchResult.finalUrl ?? null,
        },
      } satisfies ValidateUrlResponse,
    );
  } catch {
    console.error("[native-url-import/validate] unexpected validation failure");

    return NextResponse.json(
      {
        success: false,
        result: {
          isValid: false,
          error: "URL doğrulanırken beklenmeyen bir hata oluştu.",
          errorCode: "unexpected_error",
        },
      } satisfies ValidateUrlResponse,
      { status: 500 },
    );
  }
}

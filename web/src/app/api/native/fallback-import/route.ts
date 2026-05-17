import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { upsertNativeProductsFromFallbackItems } from "@/lib/db/product-repository";
import { getActiveNativeSourceForUser } from "@/lib/db/source-repository";
import {
  buildManualFallbackItem,
  parseCsvText,
  parseXlsxBuffer,
} from "@/lib/native-url-import/fallback-import";
import type {
  NativeFallbackImportItem,
  NativeUrlImportResponse,
  NativeUrlImportSourceContext,
} from "@/types/native-url-import";

const manualImportSchema = z.object({
  title: z.string().trim().min(1),
  productUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
  priceDisplay: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  imageUrls: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  category: z.string().trim().optional(),
  tags: z.string().trim().optional(),
});

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

function splitList(value: string | null | undefined) {
  if (!value) return [];

  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fallbackResponse(params: {
  success: boolean;
  source?: NativeUrlImportSourceContext;
  importedCount?: number;
  productIds?: string[];
  error?: string;
  errorCode?: NativeUrlImportResponse["errorCode"];
}): NativeUrlImportResponse {
  return {
    success: params.success,
    source: params.source,
    importedCount: params.importedCount ?? 0,
    productIds: params.productIds ?? [],
    error: params.error,
    errorCode: params.errorCode,
  };
}

async function readFileItems(file: File): Promise<NativeFallbackImportItem[]> {
  const fileName = file.name.toLocaleLowerCase("tr-TR");

  if (fileName.endsWith(".xlsx")) {
    return parseXlsxBuffer(Buffer.from(await file.arrayBuffer()));
  }

  if (
    fileName.endsWith(".csv") ||
    fileName.endsWith(".tsv") ||
    file.type.includes("csv") ||
    file.type.includes("text")
  ) {
    return parseCsvText(await file.text(), "csv");
  }

  throw new Error("Unsupported file type.");
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        fallbackResponse({
          success: false,
          error: "Oturum gerekli.",
          errorCode: "unauthorized",
        }),
        { status: 401 },
      );
    }

    const nativeSource = await getActiveNativeSourceForUser(user.id);

    if (!nativeSource.ok) {
      return NextResponse.json(
        fallbackResponse({
          success: false,
          error: nativeSource.message,
          errorCode: nativeSource.code,
        }),
        { status: nativeSource.status },
      );
    }

    const source = mapNativeSourceContext(nativeSource.store);
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "");
    let items: NativeFallbackImportItem[] = [];

    if (mode === "manual") {
      const parsedManual = manualImportSchema.safeParse({
        title: formData.get("title"),
        productUrl: formData.get("productUrl"),
        description: formData.get("description"),
        priceDisplay: formData.get("priceDisplay"),
        currency: formData.get("currency"),
        imageUrls: formData.get("imageUrls"),
        brand: formData.get("brand"),
        sku: formData.get("sku"),
        category: formData.get("category"),
        tags: formData.get("tags"),
      });

      if (!parsedManual.success) {
        return NextResponse.json(
          fallbackResponse({
            success: false,
            source,
            error: "Ürün adi zorunludur.",
            errorCode: "invalid_import_request",
          }),
          { status: 400 },
        );
      }

      items = [
        buildManualFallbackItem({
          ...parsedManual.data,
          imageUrls: splitList(parsedManual.data.imageUrls),
          tags: splitList(parsedManual.data.tags),
        }),
      ];
    } else if (mode === "file") {
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          fallbackResponse({
            success: false,
            source,
            error: "CSV veya Excel dosyasi secilmedi.",
            errorCode: "fallback_file_invalid",
          }),
          { status: 400 },
        );
      }

      try {
        items = await readFileItems(file);
      } catch {
        return NextResponse.json(
          fallbackResponse({
            success: false,
            source,
            error: "Dosya okunamadı. CSV veya basit XLSX dosyası yükleyin.",
            errorCode: "fallback_file_invalid",
          }),
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        fallbackResponse({
          success: false,
          source,
          error: "Geçersiz yedek içe aktarma modu.",
          errorCode: "invalid_import_request",
        }),
        { status: 400 },
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        fallbackResponse({
          success: false,
          source,
          error: "Aktarılacak geçerli ürün bulunamadı.",
          errorCode: "fallback_file_invalid",
        }),
        { status: 422 },
      );
    }

    const importResult = await upsertNativeProductsFromFallbackItems({
      profileId: user.id,
      storeId: nativeSource.store.id,
      language: nativeSource.store.language,
      market: nativeSource.store.market,
      items,
    });

    if (!importResult.ok) {
      return NextResponse.json(
        fallbackResponse({
          success: false,
          source,
          error: importResult.message,
          errorCode: "fallback_import_failed",
        }),
        { status: 500 },
      );
    }

    return NextResponse.json(
      fallbackResponse({
        success: true,
        source,
        importedCount: importResult.data.importedCount,
        productIds: importResult.data.productIds,
      }),
    );
  } catch (error) {
    console.error("[native-fallback-import]", error);

    return NextResponse.json(
      fallbackResponse({
        success: false,
        error: "Fallback import sirasinda beklenmeyen bir hata oluştu.",
        errorCode: "unexpected_error",
      }),
      { status: 500 },
    );
  }
}

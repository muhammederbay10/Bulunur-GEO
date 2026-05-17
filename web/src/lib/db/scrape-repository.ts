import "server-only";

import { createAdminClient, MissingSupabaseElevatedKeyError } from "@/lib/supabase/admin";
import type {
  NativeUrlImportErrorCode,
  ScrapeJobDbStatus,
  ScrapePreviewItem,
} from "@/types/native-url-import";

type ScrapeJobRow = {
  id: string;
  status: ScrapeJobDbStatus;
};

export type ScrapeMutationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      message: string;
      code: NativeUrlImportErrorCode;
      status: number;
      isMissingTable?: boolean;
      isMissingServiceRole?: boolean;
    };

type CreateScrapeJobInput = {
  profileId: string;
  storeId: string;
  inputUrl: string;
  normalizedUrl?: string | null;
};

type CompleteScrapeJobInput = {
  profileId: string;
  scrapeJobId: string;
  status: Extract<
    ScrapeJobDbStatus,
    "preview_ready" | "imported" | "failed" | "cancelled"
  >;
  normalizedUrl?: string | null;
  errorCode?: NativeUrlImportErrorCode | null;
  errorMessage?: string | null;
};

type PersistPreviewItemsInput = {
  profileId: string;
  storeId: string;
  scrapeJobId: string;
  previewItems: ScrapePreviewItem[];
};

export type ScrapePreviewRow = {
  id: string;
  profile_id: string;
  store_id: string;
  scrape_job_id: string;
  product_url: string;
  title: string | null;
  image_urls: string[] | null;
  price_display: string | null;
  confidence_score: number | null;
  confidence_status: "ready" | "partial" | "needs_review" | "blocked";
  raw_extracted: Record<string, unknown> | null;
  crawl_metadata: Record<string, unknown> | null;
  imported_product_id: string | null;
};

type LoadPreviewItemsInput = {
  profileId: string;
  storeId: string;
  scrapeJobId: string;
  previewItemIds: string[];
};

type MarkPreviewItemsImportedInput = {
  profileId: string;
  storeId: string;
  scrapeJobId: string;
  importedItems: Array<{
    previewItemId: string;
    productId: string;
  }>;
};

const scrapeJobSelect = "id,status";
const scrapePreviewItemSelect =
  "id,profile_id,store_id,scrape_job_id,product_url,title,image_urls,price_display,confidence_score,confidence_status,raw_extracted,crawl_metadata,imported_product_id";

function scrapeStorageSetupMessage() {
  return "Kazıma tabloları hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function serviceRoleMessage() {
  return "Kazıma önizleme kayıtları için sunucu tarafında güvenli Supabase anahtarı gerekli. Bu anahtar tarayıcıya açılmamalı.";
}

function isMissingScrapeTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("scrape_jobs") ||
    message.includes("scrape_preview_items")
  );
}

function getPreviewImageUrls(item: ScrapePreviewItem): string[] {
  const rawImages = item.rawPayload.images;

  if (Array.isArray(rawImages)) {
    const imageUrls = rawImages.filter(
      (imageUrl): imageUrl is string =>
        typeof imageUrl === "string" && imageUrl.trim().length > 0,
    );

    if (imageUrls.length > 0) {
      return imageUrls;
    }
  }

  return item.imageUrl ? [item.imageUrl] : [];
}

function mapConfidenceStatus(
  status: ScrapePreviewItem["status"],
): "ready" | "partial" | "needs_review" | "blocked" {
  if (status === "ready" || status === "partial" || status === "needs_review") {
    return status;
  }

  return "needs_review";
}

function mutationError(params: {
  message: string;
  error?: { code?: string; message?: string };
  code: NativeUrlImportErrorCode;
}): ScrapeMutationResult<never> {
  const isMissingTable = params.error ? isMissingScrapeTable(params.error) : false;

  return {
    ok: false,
    message: isMissingTable ? scrapeStorageSetupMessage() : params.message,
    code: isMissingTable ? "scrape_storage_schema_missing" : params.code,
    status: 500,
    isMissingTable,
  };
}

export async function createRunningScrapeJob(
  input: CreateScrapeJobInput,
): Promise<ScrapeMutationResult<{ scrapeJobId: string }>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("scrape_jobs")
      .insert({
        profile_id: input.profileId,
        store_id: input.storeId,
        input_url: input.inputUrl,
        normalized_url: input.normalizedUrl ?? null,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select(scrapeJobSelect)
      .single<ScrapeJobRow>();

    if (error || !data?.id) {
      console.error("[native-url-import] scrape job create failed", {
        code: error?.code,
        message: error?.message,
      });

      return mutationError({
        message: "Kazıma isi başlatilamadi. Lütfen tekrar dene.",
        error: error ?? undefined,
        code: "scrape_job_create_failed",
      });
    }

    return {
      ok: true,
      data: {
        scrapeJobId: data.id,
      },
    };
  } catch (error) {
    if (error instanceof MissingSupabaseElevatedKeyError) {
      return {
        ok: false,
        message: serviceRoleMessage(),
        code: "scrape_job_create_failed",
        status: 500,
        isMissingServiceRole: true,
      };
    }

    throw error;
  }
}

export async function completeScrapeJob(
  input: CompleteScrapeJobInput,
): Promise<ScrapeMutationResult<{ scrapeJobId: string }>> {
  const supabase = createAdminClient();
  const updatePayload: {
    normalized_url?: string | null;
    status: CompleteScrapeJobInput["status"];
    error_code: NativeUrlImportErrorCode | null;
    error_message: string | null;
    completed_at: string;
  } = {
    status: input.status,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    completed_at: new Date().toISOString(),
  };

  if (input.normalizedUrl !== undefined) {
    updatePayload.normalized_url = input.normalizedUrl;
  }

  const { data, error } = await supabase
    .from("scrape_jobs")
    .update(updatePayload)
    .eq("id", input.scrapeJobId)
    .eq("profile_id", input.profileId)
    .select(scrapeJobSelect)
    .single<ScrapeJobRow>();

  if (error || !data?.id) {
    console.error("[native-url-import] scrape job update failed", {
      code: error?.code,
      message: error?.message,
    });

    return mutationError({
      message: "Kazıma isi durumu güncellenemedi.",
      error: error ?? undefined,
      code: "scrape_job_update_failed",
    });
  }

  return {
    ok: true,
    data: {
      scrapeJobId: data.id,
    },
  };
}

export async function persistScrapePreviewItems(
  input: PersistPreviewItemsInput,
): Promise<ScrapeMutationResult<{ persistedCount: number }>> {
  if (input.previewItems.length === 0) {
    return {
      ok: true,
      data: {
        persistedCount: 0,
      },
    };
  }

  const supabase = createAdminClient();
  const rows = input.previewItems.map((item) => ({
    id: item.id,
    profile_id: input.profileId,
    store_id: input.storeId,
    scrape_job_id: input.scrapeJobId,
    product_url: item.productUrl,
    title: item.title,
    image_urls: getPreviewImageUrls(item),
    price_display: item.priceDisplay,
    confidence_score: item.extractionConfidence,
    confidence_status: mapConfidenceStatus(item.status),
    raw_extracted: item.rawPayload,
    crawl_metadata: item.crawlMetadata,
  }));

  const { error } = await supabase.from("scrape_preview_items").insert(rows);

  if (error) {
    console.error("[native-url-import] scrape preview insert failed", {
      code: error.code,
      message: error.message,
    });

    return mutationError({
      message: "Ürün önizlemeleri kaydedilemedi.",
      error,
      code: "scrape_preview_persist_failed",
    });
  }

  return {
    ok: true,
    data: {
      persistedCount: rows.length,
    },
  };
}

export async function loadOwnedScrapePreviewItems(
  input: LoadPreviewItemsInput,
): Promise<ScrapeMutationResult<ScrapePreviewRow[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("scrape_preview_items")
    .select(scrapePreviewItemSelect)
    .eq("profile_id", input.profileId)
    .eq("store_id", input.storeId)
    .eq("scrape_job_id", input.scrapeJobId)
    .in("id", input.previewItemIds)
    .returns<ScrapePreviewRow[]>();

  if (error) {
    console.error("[native-url-import] scrape preview lookup failed", {
      code: error.code,
      message: error.message,
    });

    return mutationError({
      message: "Ürün önizlemeleri okunamadı.",
      error,
      code: "scrape_preview_not_found",
    });
  }

  if ((data?.length ?? 0) !== input.previewItemIds.length) {
    return {
      ok: false,
      message: "Seçilen ürün önizlemeleri bulunamadı veya bu hesaba ait değil.",
      code: "scrape_preview_not_found",
      status: 404,
    };
  }

  return {
    ok: true,
    data: data ?? [],
  };
}

export async function markScrapePreviewItemsImported(
  input: MarkPreviewItemsImportedInput,
): Promise<ScrapeMutationResult<{ updatedCount: number }>> {
  const supabase = createAdminClient();

  for (const item of input.importedItems) {
    const { error } = await supabase
      .from("scrape_preview_items")
      .update({
        imported_product_id: item.productId,
      })
      .eq("id", item.previewItemId)
      .eq("profile_id", input.profileId)
      .eq("store_id", input.storeId)
      .eq("scrape_job_id", input.scrapeJobId);

    if (error) {
      console.error("[native-url-import] scrape preview update failed", {
        code: error.code,
        message: error.message,
      });

      return mutationError({
        message: "Aktarilan önizleme satirlari güncellenemedi.",
        error,
        code: "scrape_preview_update_failed",
      });
    }
  }

  return {
    ok: true,
    data: {
      updatedCount: input.importedItems.length,
    },
  };
}

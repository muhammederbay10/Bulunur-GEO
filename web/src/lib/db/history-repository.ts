import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductSource } from "@/types/product";

export type ActivityHistoryEventKind = "analysis" | "optimization" | "publish";

export type ActivityHistoryEvent = {
  id: string;
  kind: ActivityHistoryEventKind;
  productId: string;
  productTitle: string;
  productSource: ProductSource;
  status: string;
  scoreBefore?: number;
  scoreAfter?: number;
  note: string;
  happenedAt: string;
  href: string;
};

export type ActivityHistorySummary = {
  totalEvents: number;
  analysisEvents: number;
  optimizationEvents: number;
  publishEvents: number;
  latestActivityAt?: string;
};

export type ActivityHistoryResult =
  | {
      ok: true;
      data: {
        events: ActivityHistoryEvent[];
        summary: ActivityHistorySummary;
      };
    }
  | {
      ok: false;
      message: string;
      code?: string;
      isMissingTable?: boolean;
    };

type ProductHistoryRow = {
  id: string;
  source: ProductSource;
  title: string;
};

type AnalysisHistoryRow = {
  id: string;
  product_id: string;
  status: string;
  overall_score: number | null;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
};

type OptimizationHistoryRow = {
  id: string;
  product_id: string;
  status: string;
  score_estimate: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type PublishJobHistoryRow = {
  id: string;
  product_id: string;
  optimization_result_id: string;
  target: string;
  status: string;
  approved_fields: unknown;
  completed_at: string | null;
  created_at: string;
};

const productSelect = "id,source,title";

function historyStorageSetupMessage() {
  return "Geçmiş için gerekli tablolar hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function isMissingHistoryTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("products") ||
    message.includes("product_analyses") ||
    message.includes("optimization_results") ||
    message.includes("publish_jobs")
  );
}

function asScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, value));
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }

  return undefined;
}

function approvedFieldCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function getProduct(
  productsById: Map<string, ProductHistoryRow>,
  productId: string,
) {
  return (
    productsById.get(productId) ?? {
      id: productId,
      source: "native" as ProductSource,
      title: "Ürün kaydı yok",
    }
  );
}

function statusNote(kind: ActivityHistoryEventKind, status: string) {
  if (kind === "analysis") {
    if (status === "succeeded") return "AI görünürlük analizi tamamlandı.";
    if (status === "failed") return "Analiz tamamlanamadı.";
    return "Analiz işlemi devam ediyor.";
  }

  if (kind === "optimization") {
    if (status === "ready_for_review") return "İyileştirme taslağı hazır.";
    if (status === "published") return "İyileştirme yayınlandı.";
    if (status === "failed") return "Optimizasyon tamamlanamadı.";
    if (status === "needs_user_input") return "Eksik bilgi gerekiyor.";
    return "Optimizasyon kaydı oluşturuldu.";
  }

  if (status === "succeeded") return "Onaylanan alanlar Shopify'a gönderildi.";
  if (status === "failed") return "Yayınlama tamamlanamadı.";
  return "Yayınlama kaydı oluşturuldu.";
}

export async function getActivityHistoryForProfile(
  profileId: string,
): Promise<ActivityHistoryResult> {
  const supabase = createAdminClient();
  const [
    productsResult,
    analysesResult,
    optimizationsResult,
    publishJobsResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(productSelect)
      .eq("profile_id", profileId)
      .returns<ProductHistoryRow[]>(),
    supabase
      .from("product_analyses")
      .select("id,product_id,status,overall_score,error_message,completed_at,created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<AnalysisHistoryRow[]>(),
    supabase
      .from("optimization_results")
      .select("id,product_id,status,score_estimate,error_message,created_at,updated_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<OptimizationHistoryRow[]>(),
    supabase
      .from("publish_jobs")
      .select("id,product_id,optimization_result_id,target,status,approved_fields,completed_at,created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<PublishJobHistoryRow[]>(),
  ]);

  const error =
    productsResult.error ??
    analysesResult.error ??
    optimizationsResult.error ??
    publishJobsResult.error;

  if (error) {
    const isMissingTable = isMissingHistoryTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? historyStorageSetupMessage()
        : "Geçmiş kayıtları okunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product]),
  );

  const analysisEvents = (analysesResult.data ?? []).map((analysis) => {
    const product = getProduct(productsById, analysis.product_id);

    return {
      id: analysis.id,
      kind: "analysis" as const,
      productId: product.id,
      productTitle: product.title,
      productSource: product.source,
      status: analysis.status,
      scoreAfter: analysis.overall_score ?? undefined,
      note: analysis.error_message ?? statusNote("analysis", analysis.status),
      happenedAt: analysis.completed_at ?? analysis.created_at,
      href: `/products/${product.id}`,
    };
  });

  const optimizationEvents = (optimizationsResult.data ?? []).map(
    (optimization) => {
      const product = getProduct(productsById, optimization.product_id);
      const scoreEstimate = optimization.score_estimate ?? {};

      return {
        id: optimization.id,
        kind: "optimization" as const,
        productId: product.id,
        productTitle: product.title,
        productSource: product.source,
        status: optimization.status,
        scoreBefore: asScore(scoreEstimate.before),
        scoreAfter: asScore(scoreEstimate.after),
        note:
          optimization.error_message ??
          statusNote("optimization", optimization.status),
        happenedAt: optimization.updated_at ?? optimization.created_at,
        href: `/products/${product.id}/optimization`,
      };
    },
  );

  const publishEvents = (publishJobsResult.data ?? []).map((job) => {
    const product = getProduct(productsById, job.product_id);
    const fieldCount = approvedFieldCount(job.approved_fields);
    const note =
      fieldCount > 0
        ? `${fieldCount} güvenli alan için yayın kaydı.`
        : statusNote("publish", job.status);

    return {
      id: job.id,
      kind: "publish" as const,
      productId: product.id,
      productTitle: product.title,
      productSource: product.source,
      status: job.status,
      note,
      happenedAt: job.completed_at ?? job.created_at,
      href: `/products/${product.id}/optimization`,
    };
  });

  const events = [...analysisEvents, ...optimizationEvents, ...publishEvents]
    .sort(
      (a, b) =>
        new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
    )
    .slice(0, 40);

  return {
    ok: true,
    data: {
      events,
      summary: {
        totalEvents: events.length,
        analysisEvents: analysisEvents.length,
        optimizationEvents: optimizationEvents.length,
        publishEvents: publishEvents.length,
        latestActivityAt: events[0]?.happenedAt,
      },
    },
  };
}

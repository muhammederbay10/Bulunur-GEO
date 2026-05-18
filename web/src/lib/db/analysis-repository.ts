import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { GeoAnalysisOutput } from "@/types/ai-contract";
import type {
  ProductAnalysisRecord,
  ProductAnalysisStatus,
} from "@/types/analysis";

type AnalysisRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; status?: number };

type ProductAnalysisRow = {
  id: string;
  status: ProductAnalysisStatus;
  overall_score: number | null;
  retrieval_score: number | null;
  machine_understanding_score: number | null;
  reranking_strength_score: number | null;
  ai_answer_readiness_score: number | null;
  detected_category: string | null;
  buyer_intent_variants: unknown;
  known_facts: Record<string, unknown> | null;
  missing_facts: unknown;
  main_problems: unknown;
  recommended_action: string | null;
  raw_output: GeoAnalysisOutput | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const analysisSelect =
  "id,status,overall_score,retrieval_score,machine_understanding_score,reranking_strength_score,ai_answer_readiness_score,detected_category,buyer_intent_variants,known_facts,missing_facts,main_problems,recommended_action,raw_output,error_code,error_message,started_at,completed_at,created_at";

function analysisStorageSetupMessage() {
  return "Analiz tabloları hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function isMissingAnalysisTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("product_analyses") ||
    message.includes("product_snapshots")
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function toScoreInteger(value: number) {
  if (!Number.isFinite(value)) return null;

  return Math.min(100, Math.max(0, Math.round(value)));
}

function mapAnalysisRow(row: ProductAnalysisRow): ProductAnalysisRecord {
  return {
    id: row.id,
    status: row.status,
    overallScore: row.overall_score ?? undefined,
    retrievalScore: row.retrieval_score ?? undefined,
    machineUnderstandingScore: row.machine_understanding_score ?? undefined,
    rerankingStrengthScore: row.reranking_strength_score ?? undefined,
    aiAnswerReadinessScore: row.ai_answer_readiness_score ?? undefined,
    detectedCategory: row.detected_category ?? undefined,
    buyerIntentVariants: toStringArray(row.buyer_intent_variants),
    knownFacts: row.known_facts ?? {},
    missingFacts: toStringArray(row.missing_facts),
    mainProblems: toStringArray(row.main_problems),
    recommendedAction: row.recommended_action ?? undefined,
    rawOutput: row.raw_output ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getLatestProductAnalysis(params: {
  profileId: string;
  productId: string;
}): Promise<AnalysisRepositoryResult<ProductAnalysisRecord | null>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_analyses")
    .select(analysisSelect)
    .eq("profile_id", params.profileId)
    .eq("product_id", params.productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ProductAnalysisRow>();

  if (error) {
    return {
      ok: false,
      message: isMissingAnalysisTable(error)
        ? analysisStorageSetupMessage()
        : "Son analiz okunamadı.",
      code: error.code,
      status: isMissingAnalysisTable(error) ? 500 : 400,
    };
  }

  return {
    ok: true,
    data: data ? mapAnalysisRow(data) : null,
  };
}

export async function startProductAnalysisRun(params: {
  profileId: string;
  storeId: string;
  productId: string;
  snapshot: {
    title: string;
    description?: string;
    descriptionHtml?: string;
    seoTitle?: string;
    seoDescription?: string;
    tags: string[];
    rawPayload: Record<string, unknown>;
  };
}): Promise<AnalysisRepositoryResult<{ analysisId: string }>> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error: snapshotError } = await supabase
    .from("product_snapshots")
    .insert({
      profile_id: params.profileId,
      store_id: params.storeId,
      product_id: params.productId,
      snapshot_type: "before_analysis",
      title: params.snapshot.title,
      description: params.snapshot.description ?? null,
      description_html: params.snapshot.descriptionHtml ?? null,
      seo_title: params.snapshot.seoTitle ?? null,
      seo_description: params.snapshot.seoDescription ?? null,
      tags: params.snapshot.tags,
      raw_payload: params.snapshot.rawPayload,
    });

  if (snapshotError) {
    return {
      ok: false,
      message: isMissingAnalysisTable(snapshotError)
        ? analysisStorageSetupMessage()
        : "Analiz öncesi ürün yedeği kaydedilemedi.",
      code: snapshotError.code,
      status: 500,
    };
  }

  const { data, error } = await supabase
    .from("product_analyses")
    .insert({
      profile_id: params.profileId,
      store_id: params.storeId,
      product_id: params.productId,
      status: "running",
      started_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    return {
      ok: false,
      message: error && isMissingAnalysisTable(error)
        ? analysisStorageSetupMessage()
        : "Analiz kaydı başlatilamadi.",
      code: error?.code,
      status: 500,
    };
  }

  const { error: productError } = await supabase
    .from("products")
    .update({ workflow_status: "analysis_running" })
    .eq("id", params.productId)
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId);

  if (productError) {
    return {
      ok: false,
      message: "Ürün analiz durumu güncellenemedi.",
      code: productError.code,
      status: 500,
    };
  }

  return {
    ok: true,
    data: { analysisId: data.id },
  };
}

export async function saveProductAnalysisSuccess(params: {
  profileId: string;
  storeId: string;
  productId: string;
  analysisId: string;
  analysis: GeoAnalysisOutput;
}): Promise<AnalysisRepositoryResult<ProductAnalysisRecord>> {
  const supabase = createAdminClient();
  const completedAt = new Date().toISOString();
  const analysisPayload = {
    status: "succeeded",
    overall_score: toScoreInteger(params.analysis.overallScore),
    retrieval_score: toScoreInteger(params.analysis.scores.retrieval.score),
    machine_understanding_score:
      toScoreInteger(params.analysis.scores.machineUnderstanding.score),
    reranking_strength_score: toScoreInteger(
      params.analysis.scores.rerankingStrength.score,
    ),
    ai_answer_readiness_score:
      toScoreInteger(params.analysis.scores.aiAnswerReadiness.score),
    detected_category: params.analysis.detectedCategory ?? null,
    buyer_intent_variants: params.analysis.buyerIntentVariants,
    known_facts: params.analysis.knownFacts,
    missing_facts: params.analysis.missingFacts,
    main_problems: params.analysis.mainProblems,
    recommended_action: params.analysis.recommendedAction ?? null,
    raw_output: params.analysis,
    error_code: null,
    error_message: null,
    completed_at: completedAt,
  };
  const [analysisResult, productResult] = await Promise.all([
    supabase
      .from("product_analyses")
      .update(analysisPayload)
      .eq("id", params.analysisId)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId)
      .eq("product_id", params.productId)
      .select(analysisSelect)
      .single<ProductAnalysisRow>(),
    supabase
      .from("products")
      .update({
        workflow_status: "analyzed",
        latest_analysis_id: params.analysisId,
        latest_score: toScoreInteger(params.analysis.overallScore),
        last_analyzed_at: completedAt,
      })
      .eq("id", params.productId)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId),
  ]);

  if (analysisResult.error || !analysisResult.data) {
    if (analysisResult.error) {
      console.error("[analysis] save result failed", {
        code: analysisResult.error.code,
        message: analysisResult.error.message,
        details: analysisResult.error.details,
        hint: analysisResult.error.hint,
        analysisId: params.analysisId,
        productId: params.productId,
      });
    }

    return {
      ok: false,
      message: analysisResult.error?.message ?? "Analiz sonucu kaydedilemedi.",
      code: analysisResult.error?.code,
      status: 500,
    };
  }

  if (productResult.error) {
    console.error("[analysis] product summary update failed", {
      code: productResult.error.code,
      message: productResult.error.message,
      details: productResult.error.details,
      hint: productResult.error.hint,
      analysisId: params.analysisId,
      productId: params.productId,
    });

    return {
      ok: false,
      message: "Ürün analiz ozeti güncellenemedi.",
      code: productResult.error.code,
      status: 500,
    };
  }

  return {
    ok: true,
    data: mapAnalysisRow(analysisResult.data),
  };
}

export async function saveProductAnalysisFailure(params: {
  profileId: string;
  storeId: string;
  productId: string;
  analysisId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const completedAt = new Date().toISOString();

  await Promise.all([
    supabase
      .from("product_analyses")
      .update({
        status: "failed",
        error_code: params.errorCode,
        error_message: params.errorMessage,
        completed_at: completedAt,
      })
      .eq("id", params.analysisId)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId)
      .eq("product_id", params.productId),
    supabase
      .from("products")
      .update({ workflow_status: "failed" })
      .eq("id", params.productId)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId),
  ]);
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { GeoImprovementOutput } from "@/types/ai-contract";
import type {
  OptimizationResultRecord,
  OptimizationResultStatus,
  ReviewActionRecord,
} from "@/types/analysis";
import type { ShopifyPublishableField } from "@/types/shopify";

type OptimizationRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; status?: number };

type OptimizationResultRow = {
  id: string;
  analysis_id: string;
  status: OptimizationResultStatus;
  selected_strategies: unknown;
  needs_user_input: unknown;
  user_confirmed_facts: Record<string, unknown> | null;
  generated: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  score_estimate: Record<string, unknown> | null;
  before_after: Record<string, unknown> | null;
  raw_output: GeoImprovementOutput | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewActionRow = {
  field_path: ShopifyPublishableField;
  decision: "approved" | "rejected";
  approved_value: unknown;
  reason: string | null;
};

const optimizationSelect =
  "id,analysis_id,status,selected_strategies,needs_user_input,user_confirmed_facts,generated,validation,score_estimate,before_after,raw_output,error_code,error_message,created_at,updated_at";
const reviewActionSelect = "field_path,decision,approved_value,reason";

function optimizationStorageSetupMessage() {
  return "Optimizasyon tablolari hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function isMissingOptimizationTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("optimization_results") ||
    message.includes("product_snapshots")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStrategyArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const name = typeof item.name === "string" ? item.name : null;
      const reason = typeof item.reason === "string" ? item.reason : null;

      return name && reason ? { name, reason } : null;
    })
    .filter((item): item is { name: string; reason: string } => Boolean(item));
}

function toQuestionArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const field = typeof item.field === "string" ? item.field : null;
      const question = typeof item.question === "string" ? item.question : null;
      const reason = typeof item.reason === "string" ? item.reason : null;
      const requiredFor = Array.isArray(item.requiredFor)
        ? item.requiredFor.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [];

      return field && question && reason
        ? { field, question, reason, requiredFor }
        : null;
    })
    .filter(
      (
        item,
      ): item is {
        field: string;
        question: string;
        reason: string;
        requiredFor: string[];
      } => Boolean(item),
    );
}

function mapOptimizationRow(row: OptimizationResultRow): OptimizationResultRecord {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    status: row.status,
    selectedStrategies: toStrategyArray(row.selected_strategies),
    needsUserInput: toQuestionArray(row.needs_user_input),
    userConfirmedFacts: row.user_confirmed_facts ?? {},
    generated: row.generated ?? {},
    validation: row.validation ?? {},
    scoreEstimate: row.score_estimate ?? {},
    beforeAfter: row.before_after ?? {},
    rawOutput: row.raw_output ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function resolveOptimizationStatus(
  improvement: GeoImprovementOutput,
): OptimizationResultStatus {
  return improvement.needsUserInput.length > 0
    ? "needs_user_input"
    : "ready_for_review";
}

export async function getLatestOptimizationResult(params: {
  profileId: string;
  productId: string;
}): Promise<OptimizationRepositoryResult<OptimizationResultRecord | null>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("optimization_results")
    .select(optimizationSelect)
    .eq("profile_id", params.profileId)
    .eq("product_id", params.productId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<OptimizationResultRow>();

  if (error) {
    return {
      ok: false,
      message: isMissingOptimizationTable(error)
        ? optimizationStorageSetupMessage()
        : "Son optimizasyon sonucu okunamadı.",
      code: error.code,
      status: isMissingOptimizationTable(error) ? 500 : 400,
    };
  }

  return {
    ok: true,
    data: data ? mapOptimizationRow(data) : null,
  };
}

export async function getReviewActionsForOptimization(params: {
  profileId: string;
  optimizationResultId: string;
}): Promise<OptimizationRepositoryResult<ReviewActionRecord[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("review_actions")
    .select(reviewActionSelect)
    .eq("profile_id", params.profileId)
    .eq("optimization_result_id", params.optimizationResultId)
    .returns<ReviewActionRow[]>();

  if (error) {
    return {
      ok: false,
      message: "Onay durumları okunamadı.",
      code: error.code,
      status: 400,
    };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      fieldPath: row.field_path,
      decision: row.decision,
      approvedValue: row.approved_value,
      reason: row.reason ?? undefined,
    })),
  };
}

export async function startProductOptimizationAttempt(params: {
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
}): Promise<OptimizationRepositoryResult<{ ok: true }>> {
  const supabase = createAdminClient();
  const { error: snapshotError } = await supabase
    .from("product_snapshots")
    .insert({
      profile_id: params.profileId,
      store_id: params.storeId,
      product_id: params.productId,
      snapshot_type: "before_optimization",
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
      message: isMissingOptimizationTable(snapshotError)
        ? optimizationStorageSetupMessage()
        : "Optimizasyon öncesi ürün yedeği kaydedilemedi.",
      code: snapshotError.code,
      status: 500,
    };
  }

  const { error: productError } = await supabase
    .from("products")
    .update({ workflow_status: "optimization_running" })
    .eq("id", params.productId)
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId);

  if (productError) {
    return {
      ok: false,
      message: "Ürün optimizasyon durumu güncellenemedi.",
      code: productError.code,
      status: 500,
    };
  }

  return {
    ok: true,
    data: { ok: true },
  };
}

export async function saveOptimizationResult(params: {
  profileId: string;
  storeId: string;
  productId: string;
  analysisId: string;
  improvement: GeoImprovementOutput;
}): Promise<OptimizationRepositoryResult<OptimizationResultRecord>> {
  const supabase = createAdminClient();
  const status = resolveOptimizationStatus(params.improvement);
  const { data, error } = await supabase
    .from("optimization_results")
    .insert({
      profile_id: params.profileId,
      store_id: params.storeId,
      product_id: params.productId,
      analysis_id: params.analysisId,
      status,
      selected_strategies: params.improvement.selectedStrategies,
      needs_user_input: params.improvement.needsUserInput,
      user_confirmed_facts: params.improvement.userConfirmedFacts,
      generated: asRecord(params.improvement.generated),
      validation: asRecord(params.improvement.validation),
      score_estimate: params.improvement.scoreEstimate ?? {},
      before_after: params.improvement.beforeAfter ?? {},
      raw_output: params.improvement,
    })
    .select(optimizationSelect)
    .single<OptimizationResultRow>();

  if (error || !data?.id) {
    if (error) {
      console.error("[optimization] save result failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        analysisId: params.analysisId,
        productId: params.productId,
      });
    }

    return {
      ok: false,
      message: error && isMissingOptimizationTable(error)
        ? optimizationStorageSetupMessage()
        : error?.message ?? "Optimizasyon sonucu kaydedilemedi.",
      code: error?.code,
      status: 500,
    };
  }

  const productUpdate =
    status === "ready_for_review"
      ? {
          workflow_status: "optimized",
          latest_optimization_result_id: data.id,
          last_optimized_at: new Date().toISOString(),
        }
      : {
          workflow_status: "analyzed",
        };

  const { error: productError } = await supabase
    .from("products")
    .update(productUpdate)
    .eq("id", params.productId)
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId);

  if (productError) {
    return {
      ok: false,
      message: "Ürün optimizasyon ozeti güncellenemedi.",
      code: productError.code,
      status: 500,
    };
  }

  return {
    ok: true,
    data: mapOptimizationRow(data),
  };
}

export async function saveOptimizationFailure(params: {
  profileId: string;
  storeId: string;
  productId: string;
  analysisId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  const supabase = createAdminClient();

  await Promise.all([
    supabase.from("optimization_results").insert({
      profile_id: params.profileId,
      store_id: params.storeId,
      product_id: params.productId,
      analysis_id: params.analysisId,
      status: "failed",
      error_code: params.errorCode,
      error_message: params.errorMessage,
    }),
    supabase
      .from("products")
      .update({ workflow_status: "failed" })
      .eq("id", params.productId)
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId),
  ]);
}

export function normalizeUserFacts(
  value: unknown,
): Record<string, string | null> {
  if (!isRecord(value)) return {};

  const normalized: Record<string, string | null> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (entry === null) {
      normalized[key] = null;
      continue;
    }

    if (typeof entry !== "string") continue;

    const trimmedValue = entry.trim();

    if (trimmedValue) {
      normalized[key] = trimmedValue;
    }
  }

  return normalized;
}

export async function saveReviewActions(params: {
  profileId: string;
  storeId: string;
  productId: string;
  optimizationResultId: string;
  actions: ReviewActionRecord[];
}): Promise<OptimizationRepositoryResult<{ savedCount: number }>> {
  if (params.actions.length === 0) {
    return {
      ok: false,
      message: "Yayınlamak için en az bir alan onaylanmalı.",
      code: "no_approved_fields",
      status: 400,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("review_actions").upsert(
    params.actions.map((action) => ({
      profile_id: params.profileId,
      store_id: params.storeId,
      product_id: params.productId,
      optimization_result_id: params.optimizationResultId,
      field_path: action.fieldPath,
      decision: action.decision,
      approved_value: action.approvedValue ?? null,
      reason: action.reason ?? null,
    })),
    { onConflict: "optimization_result_id,field_path" },
  );

  if (error) {
    return {
      ok: false,
      message: "Alan onaylari kaydedilemedi.",
      code: error.code,
      status: 500,
    };
  }

  const hasApprovedFields = params.actions.some(
    (action) => action.decision === "approved",
  );
  const { error: statusError } = await supabase
    .from("optimization_results")
    .update({ status: hasApprovedFields ? "approved" : "ready_for_review" })
    .eq("id", params.optimizationResultId)
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId)
    .eq("product_id", params.productId);

  if (statusError) {
    return {
      ok: false,
      message: "Optimizasyon onay durumu güncellenemedi.",
      code: statusError.code,
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      savedCount: params.actions.length,
    },
  };
}

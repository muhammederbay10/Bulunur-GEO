import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const dailyUsageLimits = {
  analysis: 10,
  optimization: 10,
};

type UsageCounter = {
  used: number;
  limit: number;
};

export type DailyUsageMetrics = {
  analysis: UsageCounter;
  optimization: UsageCounter;
};

type ProductIdRow = {
  product_id: string | null;
};

function startOfToday() {
  const now = new Date();
  const start = new Date(now);

  start.setHours(0, 0, 0, 0);

  return start;
}

function startOfTomorrow(start: Date) {
  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return end;
}

export function usageWindow() {
  const today = startOfToday();

  return {
    today,
    tomorrow: startOfTomorrow(today),
  };
}

function countOrZero(count: number | null) {
  return typeof count === "number" ? count : 0;
}

function productIdSet(rows: ProductIdRow[] | null) {
  return new Set(
    (rows ?? [])
      .map((row) => row.product_id)
      .filter((productId): productId is string => Boolean(productId)),
  );
}

async function listChargedOptimizationProductIds(profileId: string) {
  const supabase = createAdminClient();
  const { today, tomorrow } = usageWindow();

  return supabase
    .from("product_snapshots")
    .select("product_id")
    .eq("profile_id", profileId)
    .eq("snapshot_type", "before_optimization")
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString())
    .returns<ProductIdRow[]>();
}

export async function getDailyUsageMetrics(
  profileId: string,
): Promise<
  | { ok: true; data: DailyUsageMetrics }
  | { ok: false; message: string; code?: string; status: number }
> {
  const supabase = createAdminClient();
  const { today, tomorrow } = usageWindow();
  const [analysisResult, optimizationResult] = await Promise.all([
    supabase
      .from("product_analyses")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
    listChargedOptimizationProductIds(profileId),
  ]);

  if (analysisResult.error || optimizationResult.error) {
    return {
      ok: false,
      message: "Kullanım sayaçları okunamadı.",
      code: analysisResult.error?.code ?? optimizationResult.error?.code,
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      analysis: {
        used: countOrZero(analysisResult.count),
        limit: dailyUsageLimits.analysis,
      },
      optimization: {
        used: productIdSet(optimizationResult.data).size,
        limit: dailyUsageLimits.optimization,
      },
    },
  };
}

export async function canStartAnalysis(profileId: string): Promise<
  | { ok: true }
  | { ok: false; message: string; code: string; status: number }
> {
  const metricsResult = await getDailyUsageMetrics(profileId);

  if (!metricsResult.ok) {
    return {
      ok: false,
      code: metricsResult.code ?? "usage_metrics_unavailable",
      message: metricsResult.message,
      status: metricsResult.status,
    };
  }

  if (metricsResult.data.analysis.used >= metricsResult.data.analysis.limit) {
    return {
      ok: false,
      code: "analysis_credits_exhausted",
      message: "Analiz krediniz bitti. Yeni analiz başlatamazsınız.",
      status: 429,
    };
  }

  return { ok: true };
}

export async function canStartOptimization(params: {
  profileId: string;
  productId: string;
}): Promise<
  | { ok: true }
  | { ok: false; message: string; code: string; status: number }
> {
  const { data, error } = await listChargedOptimizationProductIds(
    params.profileId,
  );

  if (error) {
    return {
      ok: false,
      code: error.code ?? "usage_metrics_unavailable",
      message: "Kullanım sayaçları okunamadı.",
      status: 500,
    };
  }

  const chargedProductIds = productIdSet(data);

  if (chargedProductIds.has(params.productId)) {
    return { ok: true };
  }

  if (chargedProductIds.size >= dailyUsageLimits.optimization) {
    return {
      ok: false,
      code: "optimization_credits_exhausted",
      message: "Optimizasyon krediniz bitti. Yeni optimizasyon başlatamazsınız.",
      status: 429,
    };
  }

  return { ok: true };
}

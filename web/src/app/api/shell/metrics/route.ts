import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { createAdminClient } from "@/lib/supabase/admin";

const dailyLimits = {
  analysis: 10,
  optimization: 10,
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

function countOrZero(count: number | null) {
  return typeof count === "number" ? count : 0;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Oturum gerekli.",
      },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const today = startOfToday();
  const tomorrow = startOfTomorrow(today);
  const [analysisResult, optimizationResult] = await Promise.all([
    supabase
      .from("product_analyses")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
    supabase
      .from("product_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("snapshot_type", "before_optimization")
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
  ]);

  if (analysisResult.error || optimizationResult.error) {
    return NextResponse.json(
      {
        ok: false,
        error: "shell_metrics_unavailable",
        message: "Kullanim sayaÃ§lari okunamadÄ±.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      metrics: {
        analysis: {
          used: countOrZero(analysisResult.count),
          limit: dailyLimits.analysis,
        },
        optimization: {
          used: countOrZero(optimizationResult.count),
          limit: dailyLimits.optimization,
        },
      },
      refreshedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

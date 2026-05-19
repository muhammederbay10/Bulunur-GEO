import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { getDailyUsageMetrics } from "@/lib/usage-limits";

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

  const metricsResult = await getDailyUsageMetrics(user.id);

  if (!metricsResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "shell_metrics_unavailable",
        message: metricsResult.message,
      },
      { status: metricsResult.status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      metrics: metricsResult.data,
      refreshedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

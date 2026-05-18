"use client";

import { useEffect, useState } from "react";

type UsageCounter = {
  used: number;
  limit: number;
};

type ShellMetrics = {
  analysis: UsageCounter;
  optimization: UsageCounter;
};

type ShellMetricsResponse =
  | {
      ok: true;
      metrics: ShellMetrics;
      refreshedAt: string;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

const fallbackMetrics: ShellMetrics = {
  analysis: { used: 0, limit: 10 },
  optimization: { used: 0, limit: 10 },
};

const counterRows = [
  {
    key: "analysis",
    label: "Analiz",
  },
  {
    key: "optimization",
    label: "Optimizasyon",
  },
] as const;

function remainingCount(counter: UsageCounter) {
  return Math.max(0, counter.limit - counter.used);
}

function usagePercent(counter: UsageCounter) {
  if (counter.limit <= 0) return 0;

  return Math.min(100, Math.max(0, (remainingCount(counter) / counter.limit) * 100));
}

function barColor(percent: number) {
  if (percent <= 20) return "bg-destructive";
  if (percent <= 30) return "bg-yellow-500";

  return "bg-primary";
}

export function SidebarUsageCounters() {
  const [metrics, setMetrics] = useState<ShellMetrics>(fallbackMetrics);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function loadMetrics() {
      try {
        const response = await fetch("/api/shell/metrics", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ShellMetricsResponse;

        if (!isMounted) return;

        if (payload.ok) {
          setMetrics(payload.metrics);
        }
      } catch {
        // Keep the last known counters visible if a refresh misses.
      } finally {
        if (!isMounted) return;

        setHasLoaded(true);
        timeoutId = setTimeout(loadMetrics, 10_000);
      }
    }

    loadMetrics();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div className="grid gap-2.5" aria-busy={!hasLoaded}>
      {counterRows.map((item) => {
        const counter = metrics[item.key];
        const remaining = remainingCount(counter);
        const percent = usagePercent(counter);

        return (
          <div key={item.key} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">
                {hasLoaded ? `${remaining}/${counter.limit} kalan` : "--/-- kalan"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barColor(percent)}`}
                style={{ width: `${hasLoaded ? percent : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Activity, CircleAlert, Package, Sparkles } from "lucide-react";

const metrics = [
  { label: "Products", value: "0", note: "Waiting for first source", icon: Package },
  { label: "Analyzed", value: "0", note: "Phase 7 will connect AI", icon: Activity },
  { label: "Optimized", value: "0", note: "Approval flow comes later", icon: Sparkles },
  { label: "Needs attention", value: "0", note: "Low-score view placeholder", icon: CircleAlert },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="industrial-panel p-6">
        <p className="font-mono text-xs uppercase text-primary">
          Catalog command center
        </p>
        <div className="mt-4 max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
            Dashboard foundation
          </h1>
          <p className="leading-7 text-muted-foreground">
            This screen is the Phase 0 shell for the catalog overview. Later
            phases will attach Supabase-owned stores, imported products,
            analysis results, and optimization history.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="industrial-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-3 text-4xl font-semibold">{metric.value}</p>
              </div>
              <metric.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{metric.note}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

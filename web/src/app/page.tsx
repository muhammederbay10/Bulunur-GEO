import Link from "next/link";
import { ArrowRight, Gauge, PackageSearch, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasRequiredPublicEnv } from "@/lib/env/public";

const foundationSignals = [
  {
    icon: Gauge,
    title: "GEO analysis loop",
    body: "One selected product moves from catalog to score, issues, and recommended action.",
  },
  {
    icon: PackageSearch,
    title: "Source-ready structure",
    body: "Shopify and native import boundaries are prepared for server-side services.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval first",
    body: "Optimization output is treated as a draft until the seller approves fields.",
  },
];

export default function Home() {
  return (
    <main className="industrial-grid min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
        <header className="flex items-center justify-between border-b border-border/70 pb-4">
          <Link href="/" className="font-mono text-sm uppercase text-primary">
            Bulunur
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/auth/login"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Start setup</Link>
            </Button>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground md:text-6xl">
                AI visibility workflow for Turkish e-commerce products.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Phase 0 establishes the Next.js platform shell, project
                structure, design tokens, env validation pattern, and internal
                service boundaries for the Bulunur MVP.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link href="/dashboard">
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/onboarding">Preview onboarding route</Link>
              </Button>
            </div>
          </div>

          <div className="industrial-panel scanline p-5">
            <div className="border-b border-border/70 pb-4">
              <p className="font-mono text-xs uppercase text-muted-foreground">
                Foundation status
              </p>
              <p className="mt-2 text-2xl font-semibold">
                Phase 0 scaffold is active
              </p>
            </div>
            <div className="grid gap-3 pt-5">
              {foundationSignals.map((signal) => (
                <div
                  key={signal.title}
                  className="flex gap-4 border border-border/60 bg-background/35 p-4"
                >
                  <signal.icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h2 className="text-sm font-semibold">{signal.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {signal.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border/70 pt-4 font-mono text-xs text-muted-foreground">
              Supabase env: {hasRequiredPublicEnv ? "ready" : "not configured"}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

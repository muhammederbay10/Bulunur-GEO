import Link from "next/link";

import { SidebarAccountCard } from "@/components/sidebar-account-card";
import { SidebarNav } from "@/components/sidebar-nav";
import type { ProductSourceSummary } from "@/types/product";

const sourceLabels = {
  shopify: "Shopify",
  native: "Web sitesi",
  woocommerce: "WooCommerce",
};

const sourceStatusLabels: Record<string, string> = {
  setup_pending: "Kurulum",
  active: "Aktif",
  syncing: "Senkron",
  error: "Hata",
  disconnected: "Kapali",
};

function SourceStatusPill({ source }: { source: ProductSourceSummary }) {
  const isHealthy = source.status === "active";
  const isWorking = source.status === "syncing";

  return (
    <Link
      href="/sources"
      className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:border-primary/50 hover:bg-muted"
    >
      <span
        className={
          isHealthy
            ? "h-2 w-2 shrink-0 rounded-full bg-primary"
            : isWorking
              ? "h-2 w-2 shrink-0 rounded-full bg-yellow-500"
              : "h-2 w-2 shrink-0 rounded-full bg-destructive"
        }
      />
      <span className="truncate font-medium">{source.name}</span>
      <span className="shrink-0 text-muted-foreground">
        {sourceLabels[source.sourceType]} /{" "}
        {sourceStatusLabels[source.status] ?? source.status}
      </span>
    </Link>
  );
}

function SourceStatusHeader({
  sources,
}: {
  sources: ProductSourceSummary[];
}) {
  if (sources.length === 0) {
    return (
      <Link
        href="/sources"
        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
      >
        Kaynak ekle
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2">
      {sources.slice(0, 2).map((source) => (
        <SourceStatusPill key={source.id} source={source} />
      ))}
      {sources.length > 2 ? (
        <Link
          href="/sources"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          +{sources.length - 2}
        </Link>
      ) : null}
    </div>
  );
}

export function AppShell({
  children,
  sources = [],
}: Readonly<{
  children: React.ReactNode;
  sources?: ProductSourceSummary[];
}>) {
  return (
    <main className="h-screen overflow-hidden bg-background">
      <div className="flex h-full w-full">
        <aside className="hidden h-screen w-64 shrink-0 overflow-hidden border-r border-border/70 bg-muted/70 p-5 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              AI
            </div>
            <div>
              <p className="text-xl font-semibold text-primary">
                AI Gorunurluk
              </p>
              <p className="mono-label mt-1 text-muted-foreground">
                E-ticaret paneli
              </p>
            </div>
          </Link>

          <SidebarNav />

          <div className="mt-auto pt-5">
            <SidebarAccountCard />
          </div>
        </aside>

        <section className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border/70 bg-background/95 px-5 py-3 backdrop-blur lg:px-10">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Satici calisma alani
                </p>
                <p className="text-sm text-muted-foreground">
                  Urunlerinizi iceri alin, analiz edin ve guvenle iyilestirin.
                </p>
              </div>
              <SourceStatusHeader sources={sources} />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-10 lg:py-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Clock3,
  Package,
  Sparkles,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CatalogDashboardSummary,
  ProductSummary,
} from "@/types/product";

const sourceLabels = {
  shopify: "Shopify",
  native: "Web sitesi",
  woocommerce: "WooCommerce",
};

const workflowLabels = {
  not_analyzed: "Analiz bekliyor",
  analysis_running: "Analiz ediliyor",
  analyzed: "Analiz edildi",
  optimization_running: "Iyilestiriliyor",
  optimized: "Optimize edildi",
  published: "Yayinda",
  failed: "Hata var",
};

function formatDate(value?: string) {
  if (!value) return "Henuz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function scoreTone(score?: number) {
  if (typeof score !== "number") return "bg-muted text-muted-foreground";
  if (score >= 75) return "bg-primary/10 text-primary";
  if (score >= 50) return "bg-yellow-500/10 text-yellow-600";

  return "bg-destructive/10 text-destructive";
}

function ProductThumb({ product }: { product: ProductSummary }) {
  if (!product.imageUrl) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <Package className="h-5 w-5" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt=""
      className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
      loading="lazy"
    />
  );
}

function DashboardProductCard({ product }: { product: ProductSummary }) {
  const score = product.latestScore;
  const scoreWidth = typeof score === "number" ? Math.min(Math.max(score, 0), 100) : 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group grid gap-3 rounded-lg border border-border bg-background/70 p-3 transition hover:border-primary/50 hover:bg-muted/60"
    >
      <div className="flex min-w-0 items-start gap-3">
        <ProductThumb product={product} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-primary">
              {product.title}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${scoreTone(score)}`}
            >
              {typeof score === "number" ? score : "-"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{sourceLabels[product.source]}</Badge>
            <Badge variant="outline">{workflowLabels[product.workflowStatus]}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${scoreWidth}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">
            {product.priceDisplay ?? product.availability ?? "Detay bekliyor"}
          </span>
          <span className="shrink-0">{formatDate(product.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function ProductCardGroup({
  title,
  actionLabel,
  actionHref,
  products,
  emptyText,
}: {
  title: string;
  actionLabel: string;
  actionHref: string;
  products: ProductSummary[];
  emptyText: string;
}) {
  return (
    <section className="seller-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button asChild variant="outline" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
      {products.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {products.slice(0, 4).map((product) => (
            <DashboardProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export function CatalogDashboard({
  summary,
}: {
  summary: CatalogDashboardSummary;
}) {
  const metrics = [
    {
      label: "Toplam urun",
      value: summary.metrics.totalProducts,
      note: "Katalogdaki urunler.",
      icon: Package,
      href: "/products",
    },
    {
      label: "Analiz edilen",
      value: summary.metrics.analyzedProducts,
      note: "Skoru olusan urunler.",
      icon: Activity,
      href: "/products?status=analyzed",
    },
    {
      label: "Optimize edilen",
      value: summary.metrics.optimizedProducts,
      note: "Taslagi hazir urunler.",
      icon: Sparkles,
      href: "/products?status=optimized",
    },
    {
      label: "Dikkat isteyen",
      value: summary.metrics.waitingProducts + summary.metrics.lowScoreProducts,
      note: "Bekleyen veya dusuk skor.",
      icon: CircleAlert,
      href: "/products?status=waiting",
    },
  ];

  return (
    <div className="page-enter flex flex-col gap-5">
      {summary.errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
          {summary.errorMessage}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="seller-surface group relative overflow-hidden p-4 transition hover:border-primary/50 hover:shadow-primary-soft"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-2xl opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-muted-foreground">{metric.label}</p>
                <p className="mt-3 text-4xl font-bold leading-none">
                  {metric.value}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-2.5 text-primary">
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-5 text-muted-foreground">
              {metric.note}
            </p>
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          Son hareket: {formatDate(summary.lastCatalogActivityAt)}
        </span>
        <span className="inline-flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          {summary.sources.length} kaynak
        </span>
        <Button asChild size="sm" className="gap-2">
          <Link href="/products">
            Katalog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ProductCardGroup
          title="Analiz bekleyenler"
          actionLabel="Tumunu gor"
          actionHref="/products?status=waiting"
          products={summary.attentionProducts}
          emptyText="Analiz bekleyen urun yok."
        />
        <ProductCardGroup
          title="Son urun hareketleri"
          actionLabel="Katalog"
          actionHref="/products"
          products={summary.recentProducts}
          emptyText="Henuz urun hareketi yok."
        />
      </section>
    </div>
  );
}

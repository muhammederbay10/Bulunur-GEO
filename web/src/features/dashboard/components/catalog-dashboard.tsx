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

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/features/products/components/product-card";
import type {
  CatalogDashboardSummary,
  ProductSummary,
} from "@/types/product";

function formatDate(value?: string) {
  if (!value) return "Henüz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {products.slice(0, 4).map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="compact"
              href={`/products/${product.id}`}
              animationIndex={index}
            />
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
      label: "Toplam ürün",
      value: summary.metrics.totalProducts,
      note: "Katalogdaki ürünler.",
      icon: Package,
      href: "/products",
    },
    {
      label: "Analiz edilen",
      value: summary.metrics.analyzedProducts,
      note: "Skoru oluşan ürünler.",
      icon: Activity,
      href: "/products?status=analyzed",
    },
    {
      label: "Optimize edilen",
      value: summary.metrics.optimizedProducts,
      note: "Taslağı hazır ürünler.",
      icon: Sparkles,
      href: "/products?status=optimized",
    },
    {
      label: "Dikkat isteyen",
      value: summary.metrics.waitingProducts + summary.metrics.lowScoreProducts,
      note: "Bekleyen veya düşük skor.",
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
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 opacity-0 blur-2xl transition group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-muted-foreground">
                  {metric.label}
                </p>
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
          actionLabel="Tümünü gör"
          actionHref="/products?status=waiting"
          products={summary.attentionProducts}
          emptyText="Analiz bekleyen ürün yok."
        />
        <ProductCardGroup
          title="Son ürün hareketleri"
          actionLabel="Katalog"
          actionHref="/products"
          products={summary.recentProducts}
          emptyText="Henüz ürün hareketi yok."
        />
      </section>
    </div>
  );
}

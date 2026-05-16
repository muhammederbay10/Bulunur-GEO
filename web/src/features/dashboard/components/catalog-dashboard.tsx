import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Clock3,
  Package,
  RefreshCw,
  Sparkles,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CatalogDashboardSummary,
  ProductSourceSummary,
  ProductSummary,
} from "@/types/product";

const sourceLabels = {
  shopify: "Shopify",
  native: "Web sitesi",
  woocommerce: "WooCommerce",
};

const sourceStatusLabels: Record<string, string> = {
  setup_pending: "Kurulum bekliyor",
  active: "Aktif",
  syncing: "Senkronize ediliyor",
  error: "Hata var",
  disconnected: "Baglanti kesildi",
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

function ProductMiniRow({ product }: { product: ProductSummary }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/70 px-4 py-3 transition hover:bg-muted">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{product.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{sourceLabels[product.source]}</span>
          <span>{workflowLabels[product.workflowStatus]}</span>
          {typeof product.latestScore === "number" ? (
            <span>{product.latestScore}/100</span>
          ) : null}
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={`/products/${product.id}`}>Ac</Link>
      </Button>
    </li>
  );
}

function SourceRow({ source }: { source: ProductSourceSummary }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/70 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{source.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceLabels[source.sourceType]} - Son hareket:{" "}
          {formatDate(source.lastSyncAt ?? source.updatedAt)}
        </p>
      </div>
      <Badge variant={source.status === "active" ? "secondary" : "outline"}>
        {sourceStatusLabels[source.status] ?? source.status}
      </Badge>
    </li>
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
      note: "Katalogda kayitli Shopify ve web sitesi urunleri.",
      icon: Package,
      href: "/products",
    },
    {
      label: "Analiz edilen",
      value: summary.metrics.analyzedProducts,
      note: "AI gorunurluk analizi tamamlanan urunler.",
      icon: Activity,
      href: "/products?status=analyzed",
    },
    {
      label: "Optimize edilen",
      value: summary.metrics.optimizedProducts,
      note: "Iyilestirme sonucu hazirlanan veya yayinlanan urunler.",
      icon: Sparkles,
      href: "/products?status=optimized",
    },
    {
      label: "Dikkat isteyen",
      value: summary.metrics.waitingProducts + summary.metrics.lowScoreProducts,
      note: "Analiz bekleyen veya dusuk skorlu urunler.",
      icon: CircleAlert,
      href: "/products?status=waiting",
    },
  ];
  const hasProducts = summary.metrics.totalProducts > 0;

  return (
    <div className="page-enter flex flex-col gap-8">
      {summary.errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
          {summary.errorMessage}
        </section>
      ) : null}

      <section className="seller-surface overflow-hidden p-6 md:p-8">
        <p className="mono-label text-primary">
          Katalog kontrol merkezi
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold leading-tight tracking-normal md:text-5xl">
              Bugun hangi urune odaklanalim?
            </h1>
            <p className="mt-3 leading-7 text-muted-foreground">
              Urunlerinizi kaynak, analiz durumu ve son katalog hareketine gore
              takip edin. Siradaki en guvenli adim urun listesinden bir urun
              secmek ve analiz akisina hazirlanmak.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/sources">
                <RefreshCw className="h-4 w-4" />
                Kaynaklar
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href={hasProducts ? "/products" : "/sources"}>
                {hasProducts ? "Urunleri Gor" : "Urun Iceri Aktar"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            Son katalog hareketi: {formatDate(summary.lastCatalogActivityAt)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Store className="h-4 w-4" />
            {summary.sources.length} kaynak
          </span>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="seller-surface group relative overflow-hidden p-5 transition hover:border-primary/50 hover:shadow-primary-soft"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-2xl opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-muted-foreground">{metric.label}</p>
                <p className="mt-4 text-5xl font-bold leading-none">
                  {metric.value}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-primary">
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {metric.note}
            </p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="seller-surface p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Analiz bekleyenler</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Katalogda siradaki calisma adaylari.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/products?status=waiting">Tumunu gor</Link>
            </Button>
          </div>
          {summary.attentionProducts.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {summary.attentionProducts.map((product) => (
                <ProductMiniRow key={product.id} product={product} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground">
              Analiz bekleyen urun bulunmuyor. Yeni urun iceri aldiginizda
              burada gorunur.
            </p>
          )}
        </div>

        <div className="seller-surface p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Son urun hareketleri</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                En son senkronize edilen veya guncellenen urunler.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/products">Katalog</Link>
            </Button>
          </div>
          {summary.recentProducts.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {summary.recentProducts.map((product) => (
                <ProductMiniRow key={product.id} product={product} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground">
              Henuz urun hareketi yok. Kaynak ekleyerek katalog olusturun.
            </p>
          )}
        </div>
      </section>

      <section className="seller-surface p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Kaynak durumu</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shopify ve web sitesi kaynaklarinizin son durumu.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/sources">Yonet</Link>
          </Button>
        </div>
        {summary.sources.length > 0 ? (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {summary.sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground">
            Henuz kaynak yok. Shopify baglayin veya web sitenizden urun ekleyin.
          </p>
        )}
      </section>
    </div>
  );
}

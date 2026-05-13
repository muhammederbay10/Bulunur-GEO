import Link from "next/link";
import { ArrowRight, Package, RefreshCw, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/types/product";

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
  optimized: "Hazir",
  published: "Yayinda",
  failed: "Hata var",
};

const availabilityLabels: Record<string, string> = {
  source_disconnected: "Bagli kaynak yok",
  in_stock: "Stokta",
  active: "Aktif",
  draft: "Taslak",
  archived: "Arsiv",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function ProductImage({ product }: { product: ProductSummary }) {
  if (!product.imageUrl) {
    return (
      <div className="flex aspect-square w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <Package className="h-6 w-6" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt=""
      className="aspect-square w-16 shrink-0 rounded-md border border-border object-cover"
      loading="lazy"
    />
  );
}

export function ProductList({ products }: { products: ProductSummary[] }) {
  if (!products.length) {
    return (
      <section className="seller-surface p-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">
            Henuz urun iceri alinmadi
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Shopify baglantisini tamamladiktan sonra urunler otomatik olarak
            burada listelenir. Baglanti kurulduysa kaynak ekranindan tekrar
            senkronize edebilirsiniz.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/sources">
              <RefreshCw className="h-4 w-4" />
              Kaynaklara git
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      {products.map((product) => (
        <article
          key={product.id}
          className={
            product.availability === "source_disconnected"
              ? "rounded-lg border border-border bg-muted/40 p-4"
              : "rounded-lg border border-border bg-card p-4"
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <ProductImage product={product} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-base font-semibold">
                    {product.title}
                  </h2>
                  <Badge variant="secondary">{sourceLabels[product.source]}</Badge>
                  <Badge variant="outline">
                    {workflowLabels[product.workflowStatus]}
                  </Badge>
                  {product.availability ? (
                    <Badge
                      variant={
                        product.availability === "source_disconnected"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {availabilityLabels[product.availability] ??
                        product.availability}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Store className="h-4 w-4" />
                    {product.priceDisplay ?? "Fiyat bilgisi yok"}
                  </span>
                  <span>Guncellendi: {formatDate(product.updatedAt)}</span>
                  {typeof product.latestScore === "number" ? (
                    <span>Skor: {product.latestScore}/100</span>
                  ) : (
                    <span>Skor bekliyor</span>
                  )}
                  {product.availability === "source_disconnected" ? (
                    <span>Shopify API islemleri kapali</span>
                  ) : null}
                </div>
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/products/${product.id}`}>
                Detay
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

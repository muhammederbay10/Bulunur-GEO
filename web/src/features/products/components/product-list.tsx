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
  optimization_running: "İyileştiriliyor",
  optimized: "Hazır",
  published: "Yayında",
  failed: "Hata var",
};

const workflowActionLabels = {
  not_analyzed: "Analiz Et",
  analysis_running: "Analizi Gor",
  analyzed: "Analizi Gor",
  optimization_running: "Sonucu Gor",
  optimized: "Sonucu Gor",
  published: "Sonucu Gor",
  failed: "Detay",
};

const availabilityLabels: Record<string, string> = {
  source_disconnected: "Bağlı kaynak yok",
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-primary">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">
            Bu filtrede ürün bulunmuyor
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Kaynaklar ekranından Shopify senkronizasyonu yapabilir, web sitesi
            URLi taratabilir ya da dosya/manual ürün aktarımı kullanabilirsiniz.
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
    <section className="seller-surface overflow-hidden">
      <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/80 px-4 py-3 mono-label text-muted-foreground md:grid">
        <div className="col-span-5">Ürün</div>
        <div className="col-span-2">Kaynak</div>
        <div className="col-span-2 text-center">Durum</div>
        <div className="col-span-1 text-center">Skor</div>
        <div className="col-span-2 text-right">Eylem</div>
      </div>
      <div className="divide-y divide-border">
        {products.map((product) => (
          <article
            key={product.id}
            className={
              product.availability === "source_disconnected"
                ? "bg-muted/40 px-4 py-4"
                : "bg-card px-4 py-4 transition hover:bg-muted/60"
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-center">
              <div className="flex min-w-0 items-center gap-4 md:col-span-5">
              <ProductImage product={product} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 md:block">
                  <h2 className="break-words text-base font-semibold transition group-hover:text-primary">
                    {product.title}
                  </h2>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Store className="h-4 w-4" />
                    {product.priceDisplay ?? "Fiyat bilgisi yok"}
                  </span>
                  <span>Güncellendi: {formatDate(product.updatedAt)}</span>
                  {product.availability === "source_disconnected" ? (
                    <span>Shopify API işlemleri kapali</span>
                  ) : null}
                </div>
              </div>
            </div>

              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Badge variant="secondary">{sourceLabels[product.source]}</Badge>
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

              <div className="md:col-span-2 md:flex md:justify-center">
                <Badge variant="outline">
                  {workflowLabels[product.workflowStatus]}
                </Badge>
              </div>

              <div className="md:col-span-1 md:flex md:justify-center">
                {typeof product.latestScore === "number" ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-12 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${product.latestScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {product.latestScore}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>

              <div className="md:col-span-2 md:flex md:justify-end">
                <Button asChild variant="outline" size="sm" className="w-full gap-2 md:w-auto">
              <Link href={`/products/${product.id}`}>
                {workflowActionLabels[product.workflowStatus]}
                <ArrowRight className="h-4 w-4" />
              </Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

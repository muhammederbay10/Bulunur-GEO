import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Package, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  analysis_running: "Analizi Gör",
  analyzed: "Analizi Gör",
  optimization_running: "Sonucu Gör",
  optimized: "Sonucu Gör",
  published: "Sonucu Gör",
  failed: "Detay",
};

const availabilityLabels: Record<string, string> = {
  source_disconnected: "Bağlı kaynak yok",
  in_stock: "Stokta",
  active: "Aktif",
  draft: "Taslak",
  archived: "Arşiv",
};

type ProductCardVariant = "catalog" | "compact";

type ProductCardProps = {
  product: ProductSummary;
  variant?: ProductCardVariant;
  href?: string;
  className?: string;
  animationIndex?: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function scoreTone(score?: number) {
  if (typeof score !== "number") return "bg-muted text-muted-foreground";
  if (score >= 75) return "bg-primary/10 text-primary";
  if (score >= 50) return "bg-yellow-500/10 text-yellow-700";

  return "bg-destructive/10 text-destructive";
}

function clampScore(score?: number) {
  if (typeof score !== "number") return 0;

  return Math.min(Math.max(score, 0), 100);
}

function ProductImage({
  product,
  variant,
}: {
  product: ProductSummary;
  variant: ProductCardVariant;
}) {
  const imageClassName =
    variant === "compact"
      ? "h-14 w-14 rounded-lg"
      : "h-24 w-24 rounded-xl sm:h-28 sm:w-28";

  if (!product.imageUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground",
          imageClassName,
        )}
      >
        <Package className={variant === "compact" ? "h-5 w-5" : "h-7 w-7"} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt=""
      className={cn("shrink-0 border border-border object-cover", imageClassName)}
      loading="lazy"
    />
  );
}

export function getProductActionHref(product: ProductSummary) {
  if (
    product.workflowStatus === "optimization_running" ||
    product.workflowStatus === "optimized" ||
    product.workflowStatus === "published"
  ) {
    return `/products/${product.id}/optimization`;
  }

  return `/products/${product.id}`;
}

export function getProductActionLabel(product: ProductSummary) {
  return workflowActionLabels[product.workflowStatus];
}

function ProductCardInner({
  product,
  variant,
  showAction,
  href,
}: {
  product: ProductSummary;
  variant: ProductCardVariant;
  showAction: boolean;
  href: string;
}) {
  const score = product.latestScore;
  const scoreWidth = clampScore(score);

  return (
    <>
      <div className="flex min-w-0 items-start gap-4">
        <ProductImage product={product} variant={variant} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className={cn(
                  "line-clamp-2 break-words font-semibold leading-5 transition group-hover:text-primary",
                  variant === "compact" ? "text-sm" : "text-base",
                )}
              >
                {product.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            </div>

            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                scoreTone(score),
              )}
            >
              {typeof score === "number" ? score : "-"}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${scoreWidth}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Store className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {product.priceDisplay ?? "Fiyat bilgisi yok"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDate(product.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {product.availability === "source_disconnected" ? (
        <p className="mt-4 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Shopify API işlemleri kapalı. Kaynak yeniden bağlanana kadar bu ürün
          kayıtlı katalog verisi olarak görünür.
        </p>
      ) : null}

      {showAction ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Sıradaki adım: {getProductActionLabel(product)}
          </p>
          <Button asChild size="sm" className="shrink-0 gap-2">
            <Link href={href}>
              {getProductActionLabel(product)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function ProductCard({
  product,
  variant = "catalog",
  href = getProductActionHref(product),
  className,
  animationIndex = 0,
}: ProductCardProps) {
  const animationStyle = {
    animationDelay: `${Math.min(animationIndex, 8) * 45}ms`,
  } satisfies CSSProperties;
  const baseClassName = cn(
    "group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-primary-soft motion-reduce:transform-none",
    product.availability === "source_disconnected"
      ? "border-dashed border-border bg-muted/40"
      : "border-border/80",
    variant === "compact" ? "p-3" : "p-4 sm:p-5",
    "animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none",
    className,
  );

  if (variant === "compact") {
    return (
      <Link
        href={href}
        className={baseClassName}
        style={animationStyle}
      >
        <ProductCardInner
          product={product}
          variant={variant}
          showAction={false}
          href={href}
        />
      </Link>
    );
  }

  return (
    <article className={baseClassName} style={animationStyle}>
      <ProductCardInner
        product={product}
        variant={variant}
        showAction
        href={href}
      />
    </article>
  );
}

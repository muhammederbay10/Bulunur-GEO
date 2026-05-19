import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Package } from "lucide-react";

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
  if (typeof score !== "number") return "bg-card/95 text-muted-foreground";
  if (score >= 75) return "bg-primary text-primary-foreground";
  if (score >= 50) return "bg-yellow-500 text-white";

  return "bg-destructive text-destructive-foreground";
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
  const iconSize = variant === "compact" ? "h-7 w-7" : "h-9 w-9";

  if (!product.imageUrl) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
        <Package className={iconSize} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt=""
      className="aspect-[4/3] w-full object-cover"
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
  const actionLabel = getProductActionLabel(product);

  return (
    <>
      <div className="relative overflow-hidden bg-muted">
        <ProductImage product={product} variant={variant} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="bg-card/95 backdrop-blur">
            {sourceLabels[product.source]}
          </Badge>
          <Badge variant="outline" className="bg-card/95 backdrop-blur">
            {workflowLabels[product.workflowStatus]}
          </Badge>
        </div>
        <span
          className={cn(
            "absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm",
            scoreTone(score),
          )}
        >
          {typeof score === "number" ? score : "-"}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col",
          variant === "compact" ? "p-3" : "p-4",
        )}
      >
        <div className="min-w-0">
          <h2
            className={cn(
              "line-clamp-2 break-words font-semibold leading-tight transition group-hover:text-primary",
              variant === "compact" ? "text-sm" : "text-base",
            )}
          >
            {product.title}
          </h2>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p
              className={cn(
                "line-clamp-1 font-semibold text-primary",
                variant === "compact" ? "text-sm" : "text-lg",
              )}
            >
              {product.priceDisplay ?? "Fiyat bilgisi yok"}
            </p>
            {product.availability ? (
              <Badge
                variant={
                  product.availability === "source_disconnected"
                    ? "outline"
                    : "secondary"
                }
                className="shrink-0"
              >
                {availabilityLabels[product.availability] ??
                  product.availability}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${scoreWidth}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDate(product.updatedAt)}
              </span>
              <span>Skor {typeof score === "number" ? `${score}/100` : "yok"}</span>
            </div>
          </div>
        </div>

        {product.availability === "source_disconnected" ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Shopify API işlemleri kapalı. Kaynak yeniden bağlanana kadar bu ürün
            kayıtlı katalog verisi olarak görünür.
          </p>
        ) : null}

        {showAction ? (
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Sıradaki adım: {actionLabel}
            </p>
            <Button asChild size="sm" className="shrink-0 gap-2">
              <Link href={href}>
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
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
    "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-primary-soft motion-reduce:transform-none",
    product.availability === "source_disconnected"
      ? "border-dashed border-border bg-muted/40"
      : "border-border/80",
    "animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none",
    className,
  );

  if (variant === "compact") {
    return (
      <Link href={href} className={baseClassName} style={animationStyle}>
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

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gauge,
  Package,
  Search,
  ShieldAlert,
  Tags,
  WandSparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyzeProductButton } from "@/features/analysis/components/analyze-product-button";
import {
  ImproveProductButton,
  MissingFactsForm,
} from "@/features/optimization/components/improve-product-controls";
import { ShopifyPublishControls } from "@/features/publishing/components/shopify-publish-controls";
import { getShopifyPublishableFieldCandidates } from "@/lib/publishing/fields";
import type {
  OptimizationResultRecord,
  ProductAnalysisDetail,
  ProductAnalysisRecord,
} from "@/types/analysis";

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
  optimized: "Optimize edildi",
  published: "Yayında",
  failed: "Analiz hatasi",
};

const scoreLabels = [
  {
    key: "retrievalScore",
    label: "Bulunabilirlik",
    note: "Sayfanin erisilebilirligi ve temel tarama sinyalleri.",
    icon: Search,
  },
  {
    key: "machineUnderstandingScore",
    label: "Ürün Bilgisi Kalitesi",
    note: "Başlık, açıklama, özellik ve yapısal veri netliği.",
    icon: Tags,
  },
  {
    key: "rerankingStrengthScore",
    label: "Karşılaştırma Gücü",
    note: "Ürünün alternatiflerle kıyaslanabilir kanıtları.",
    icon: Gauge,
  },
  {
    key: "aiAnswerReadinessScore",
    label: "Cevap Hazırlığı",
    note: "Cevaplarda güvenle kullanılabilecek bilgiler.",
    icon: FileText,
  },
] as const;

function formatDate(value?: string) {
  if (!value) return "Henüz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ScoreBar({ value }: { value?: number }) {
  const score = typeof value === "number" ? value : 0;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
      />
    </div>
  );
}

export function ScoreRing({ value }: { value?: number }) {
  const score =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(Math.max(value, 0), 100)
      : 0;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(hsl(var(--primary)) ${score * 3.6}deg, hsl(var(--muted)) 0deg)`,
        }}
      />
      <div className="absolute inset-3 rounded-full bg-card shadow-inner" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold leading-none">{score || "--"}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ScoreLayerCard({
  label,
  note,
  value,
  icon: Icon,
}: {
  label: string;
  note: string;
  value?: number;
  icon: typeof Search;
}) {
  return (
    <div className="seller-surface p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold">{label}</p>
          </div>
          <span className="text-lg font-semibold text-primary">
            {typeof value === "number" ? value : "--"}
            <span className="text-sm text-muted-foreground">/100</span>
          </span>
        </div>
        <div className="mt-3">
          <ScoreBar value={value} />
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {note}
        </p>
    </div>
  );
}

export function ProductImage({ product }: { product: ProductAnalysisDetail }) {
  const imageUrl = product.imageUrls[0];

  if (!imageUrl) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
        <Package className="h-10 w-10" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      className="aspect-square w-full rounded-lg border border-border object-cover"
      loading="lazy"
    />
  );
}

function AnalysisStatusPanel({
  analysis,
}: {
  analysis: ProductAnalysisRecord | null;
}) {
  if (!analysis) {
    return (
      <section className="seller-surface p-4">
        <p className="mono-label text-primary">Analiz</p>
        <h2 className="mt-2 text-xl font-semibold">Ilk skor bekleniyor</h2>
      </section>
    );
  }

  if (analysis.status === "failed") {
    return (
      <section className="seller-surface p-4">
        <div className="flex items-center gap-2 text-primary">
          <AlertTriangle className="h-5 w-5" />
          <p className="mono-label">Analiz tamamlanamadı</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {analysis.errorMessage ??
            "Beklenen analiz sonucu alınamadı."}
        </p>
      </section>
    );
  }

  const overallScore = analysis.overallScore ?? analysis.rawOutput?.overallScore;

  return (
    <section className="grid gap-3">
      <div className="seller-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mono-label text-primary">
              Görünürlük skoru
            </p>
            <h2 className="mt-2 text-5xl font-bold leading-none text-primary">
              {typeof overallScore === "number" ? overallScore : "--"}
              <span className="text-xl text-muted-foreground">/100</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-5 text-muted-foreground">
              {analysis.recommendedAction ??
                "Zayif sinyaller ve sıradaki güvenli adım."}
            </p>
          </div>
          <ScoreRing value={overallScore} />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {scoreLabels.map((item) => {
          const value = analysis[item.key];

          return (
            <ScoreLayerCard
              key={item.key}
              icon={item.icon}
              label={item.label}
              note={item.note}
              value={value}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProductPreviewPanel({ product }: { product: ProductAnalysisDetail }) {
  const visibleFacts = [
    product.brand ? `Marka: ${product.brand}` : null,
    product.category ? `Kategori: ${product.category}` : null,
    product.productType ? `Tip: ${product.productType}` : null,
    product.availability ? `Stok: ${product.availability}` : null,
  ].filter((item): item is string => Boolean(item));
  const visibleTags = product.tags.slice(0, 6);

  return (
    <aside className="seller-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ürün sayfasi</h2>
        <Badge variant="secondary">{sourceLabels[product.source]}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-[120px_1fr] gap-3">
        <ProductImage product={product} />
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold leading-tight">
            {product.title}
          </h3>
          {product.priceDisplay ? (
            <p className="mt-2 text-lg font-semibold text-primary">
              {product.priceDisplay}
            </p>
          ) : null}
          <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
            {visibleFacts.map((fact) => (
              <span key={fact} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {fact}
              </span>
            ))}
          </div>
          {product.url ? (
            <Button asChild variant="outline" size="sm" className="mt-3 gap-2">
              <Link href={product.url} target="_blank" rel="noreferrer">
                Sayfayi ac
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">Ürün açıklaması</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted-foreground">
          {product.description ??
            product.shortDescription ??
            "Bu ürün için açıklama kaydı henüz bulunmuyor."}
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2">
          {visibleTags.length > 0 ? (
            visibleTags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Etiket yok</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Son analiz: {formatDate(product.lastAnalyzedAt)}
        </p>
      </div>
    </aside>
  );
}

function AnalysisActionPanel({
  product,
}: {
  product: ProductAnalysisDetail;
}) {
  return (
    <section className="seller-surface p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <LabelLikeText>Analiz</LabelLikeText>
          <h2 className="mt-1 text-lg font-semibold">Ürün sayfasi</h2>
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-background/70 px-3 py-2">
            <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm text-muted-foreground">
              {product.url ?? "Ürün kaydı URL olmadan analiz edilecek"}
            </span>
          </div>
        </div>
        <AnalyzeProductButton
          productId={product.id}
          disabled={product.workflowStatus === "analysis_running"}
        />
      </div>
    </section>
  );
}

function LabelLikeText({ children }: { children: React.ReactNode }) {
  return <p className="mono-label text-primary">{children}</p>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function OptimizationPanel({
  product,
  analysis,
  optimization,
}: {
  product: ProductAnalysisDetail;
  analysis: ProductAnalysisRecord | null;
  optimization: OptimizationResultRecord | null;
}) {
  const canOptimize = analysis?.status === "succeeded" && Boolean(analysis.rawOutput);
  const reviewableOptimization =
    optimization &&
    ["ready_for_review", "approved", "exported", "published"].includes(
      optimization.status,
    );

  if (optimization?.status === "needs_user_input") {
    return (
      <section className="seller-surface p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Eksik bilgi gerekiyor</h2>
        </div>
        <div className="mt-4">
          <MissingFactsForm
            productId={product.id}
            questions={optimization.needsUserInput}
          />
        </div>
      </section>
    );
  }

  if (optimization?.status === "failed") {
    return (
      <section className="seller-surface p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mono-label text-primary">Optimizasyon</p>
            <h2 className="mt-1 text-lg font-semibold">
              Son optimizasyon tamamlanamadı
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {optimization.errorMessage ??
                "Tekrar deneyebilirsiniz; ürün otomatik değiştirilmez."}
            </p>
          </div>
          <ImproveProductButton
            productId={product.id}
            disabled={!canOptimize}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="seller-surface p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mono-label text-primary">Optimizasyon</p>
          <h2 className="mt-1 text-lg font-semibold">
            {reviewableOptimization
              ? "Optimize edilmiş taslak hazır"
              : "İyileştirme taslağı oluştur"}
          </h2>
        </div>
        <ImproveProductButton
          productId={product.id}
          disabled={!canOptimize || product.workflowStatus === "optimization_running"}
          hasOptimization={Boolean(reviewableOptimization)}
          isOptimizationRunning={product.workflowStatus === "optimization_running"}
          reviewHref={`/products/${product.id}/optimization`}
        />
      </div>
    </section>
  );
}

export function StrategyRail({
  optimization,
}: {
  optimization: OptimizationResultRecord | null;
}) {
  if (!optimization || optimization.selectedStrategies.length === 0) return null;

  return (
    <section className="seller-surface p-5 md:p-6">
      <div className="flex items-center gap-2">
        <WandSparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Seçilen stratejiler</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {optimization.selectedStrategies.map((strategy) => (
          <div
            key={`${strategy.name}-${strategy.reason}`}
            className="rounded-lg border border-border bg-background/70 p-4"
          >
            <p className="text-sm font-medium">{strategy.name}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {strategy.reason}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function pickGeneratedText(
  records: Record<string, unknown>,
  keys: string[],
  fallback?: string,
) {
  for (const key of keys) {
    const value = asText(records[key]);

    if (value) return value;
  }

  return fallback;
}

export function getBeforeAfterText(
  beforeAfter: Record<string, unknown>,
  field: string,
  side: "before" | "after",
) {
  const value = beforeAfter[field];

  if (!isRecord(value)) return null;

  return asText(value[side]);
}

function asScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, value));
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }

  return undefined;
}

function formatScoreValue(value?: number) {
  return typeof value === "number" ? String(Math.round(value)) : "--";
}

function getScoreEstimateRecord(optimization: OptimizationResultRecord) {
  return isRecord(optimization.scoreEstimate) ? optimization.scoreEstimate : {};
}

function getScoreLayerRecord(
  optimization: OptimizationResultRecord,
  key: string,
) {
  const scoreEstimate = getScoreEstimateRecord(optimization);
  const layers = isRecord(scoreEstimate.layers) ? scoreEstimate.layers : {};
  const layer = layers[key];

  return isRecord(layer) ? layer : {};
}

function getAfterLayerScore(optimization: OptimizationResultRecord, key: string) {
  return asScore(getScoreLayerRecord(optimization, key).score);
}

function getBeforeAfterTextFromFields(
  beforeAfter: Record<string, unknown>,
  fields: string[],
  side: "before" | "after",
) {
  for (const field of fields) {
    const value = getBeforeAfterText(beforeAfter, field, side);

    if (value) return value;
  }

  return null;
}

function describeStructuredValue(value: unknown) {
  const text = asText(value);

  if (text) return text;

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} kayıt` : null;
  }

  if (isRecord(value)) {
    return "Hazır";
  }

  return null;
}

function getBeforeAfterStructuredText(
  beforeAfter: Record<string, unknown>,
  field: string,
  side: "before" | "after",
) {
  const value = beforeAfter[field];

  if (!isRecord(value)) return null;

  return describeStructuredValue(value[side]);
}

function getGeneratedValue(
  generated: Record<string, unknown>,
  keys: string[],
  fallback?: string | null,
) {
  for (const key of keys) {
    const value = describeStructuredValue(generated[key]);

    if (value) return value;
  }

  return fallback ?? null;
}

const scoreComparisonRows = [
  {
    label: "Genel skor",
    beforeKey: "overallScore",
    layerKey: null,
  },
  {
    label: "Bulunabilirlik",
    beforeKey: "retrievalScore",
    layerKey: "retrieval",
  },
  {
    label: "Ürün bilgisi kalitesi",
    beforeKey: "machineUnderstandingScore",
    layerKey: "machineUnderstanding",
  },
  {
    label: "Karşılaştırma gücü",
    beforeKey: "rerankingStrengthScore",
    layerKey: "rerankingStrength",
  },
  {
    label: "AI cevap hazırlığı",
    beforeKey: "aiAnswerReadinessScore",
    layerKey: "aiAnswerReadiness",
  },
] as const;

function ScoreMiniMeter({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: number;
  highlight?: boolean;
}) {
  const width = typeof value === "number" ? value : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={highlight ? "font-semibold text-primary" : "font-semibold"}>
          {formatScoreValue(value)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={
            highlight
              ? "h-full rounded-full bg-primary"
              : "h-full rounded-full bg-muted-foreground/45"
          }
          style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function ScoreComparisonAccordion({
  product,
  analysis,
  optimization,
}: {
  product: ProductAnalysisDetail;
  analysis: ProductAnalysisRecord | null;
  optimization: OptimizationResultRecord;
}) {
  const scoreEstimate = getScoreEstimateRecord(optimization);
  const beforeScore =
    asScore(scoreEstimate.before) ??
    analysis?.overallScore ??
    product.latestScore;
  const afterScore = asScore(scoreEstimate.after);

  return (
    <details className="group border-b border-border bg-muted/35">
      <summary className="grid cursor-pointer list-none gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="mono-label text-primary">Skor</p>
          <h2 className="mt-1 text-base font-semibold">
            Eski ve yeni GEO skorları
          </h2>
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border text-center text-sm">
            <div className="min-w-20 border-r border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Önce</p>
              <p className="text-lg font-semibold">
                {formatScoreValue(beforeScore)}
              </p>
            </div>
            <div className="min-w-20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Sonra</p>
              <p className="text-lg font-semibold text-primary">
                {formatScoreValue(afterScore)}
              </p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 text-primary transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t border-border p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {scoreComparisonRows.map((row) => {
            const beforeValue =
              row.layerKey === null
                ? beforeScore
                : analysis?.[row.beforeKey];
            const afterValue =
              row.layerKey === null
                ? afterScore
                : getAfterLayerScore(optimization, row.layerKey);

            return (
              <div
                key={row.label}
                className="rounded-lg border border-border bg-background/70 p-3"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {row.label}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ScoreMiniMeter label="Önce" value={beforeValue} />
                  <ScoreMiniMeter label="Sonra" value={afterValue} highlight />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function StorefrontInfo({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/75 p-3">
      <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm leading-5">
        {value || "Yok"}
      </p>
    </div>
  );
}

function StorefrontNoteList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "muted" | "primary";
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={
        tone === "primary"
          ? "rounded-lg border border-primary/25 bg-primary/10 p-3"
          : "rounded-lg border border-border bg-background/75 p-3"
      }
    >
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-2 grid gap-1 text-sm leading-5 text-muted-foreground">
        {items.slice(0, 3).map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="line-clamp-2">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StorefrontProductCard({
  product,
  mode,
  title,
  shortDescription,
  description,
  seoTitle,
  metaDescription,
  faqSummary,
  schemaSummary,
  score,
  notes,
}: {
  product: ProductAnalysisDetail;
  mode: "before" | "after";
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  faqSummary?: string | null;
  schemaSummary?: string | null;
  score?: number;
  notes: string[];
}) {
  const isAfter = mode === "after";

  return (
    <article
      className={
        isAfter
          ? "overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm"
          : "overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Badge variant={isAfter ? "secondary" : "outline"}>
          {isAfter ? "Yeni ürün kartı" : "Mevcut ürün kartı"}
        </Badge>
        <Badge variant={isAfter ? "secondary" : "outline"}>
          Skor {formatScoreValue(score)}/100
        </Badge>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[190px_1fr]">
        <ProductImage product={product} />
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-2xl font-semibold leading-tight">
            {title}
          </h3>
          {product.priceDisplay ? (
            <p className="mt-2 text-xl font-semibold text-primary">
              {product.priceDisplay}
            </p>
          ) : null}
          {shortDescription ? (
            <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm leading-6">
              {shortDescription}
            </p>
          ) : null}
          <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {description || "Açıklama kaydı yok."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
        <StorefrontInfo label="SEO başlığı" value={seoTitle} />
        <StorefrontInfo label="Meta açıklama" value={metaDescription} />
        <StorefrontInfo label="FAQ" value={faqSummary} />
        <StorefrontInfo label="Schema" value={schemaSummary} />
      </div>

      <div className="px-4 pb-4">
        <StorefrontNoteList
          title={isAfter ? "Satıcı için anlamı" : "Geliştirilecek noktalar"}
          items={notes}
          tone={isAfter ? "primary" : "muted"}
        />
      </div>
    </article>
  );
}

export function BeforeAfterPanel({
  product,
  analysis,
  optimization,
}: {
  product: ProductAnalysisDetail;
  analysis?: ProductAnalysisRecord | null;
  optimization: OptimizationResultRecord | null;
}) {
  if (
    !optimization ||
    !["ready_for_review", "approved", "exported", "published"].includes(
      optimization.status,
    )
  ) {
    return null;
  }
  const validationWarnings = Array.isArray(optimization.validation.warnings)
    ? optimization.validation.warnings.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const validationErrors = Array.isArray(optimization.validation.errors)
    ? optimization.validation.errors.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const reviewWarnings = Array.from(
    new Set([...validationWarnings, ...validationErrors]),
  );
  const scoreEstimate = getScoreEstimateRecord(optimization);
  const beforeScore =
    asScore(scoreEstimate.before) ??
    analysis?.overallScore ??
    product.latestScore;
  const afterScore = asScore(scoreEstimate.after);
  const beforeTitle =
    getBeforeAfterText(optimization.beforeAfter, "title", "before") ?? product.title;
  const afterTitle =
    getBeforeAfterText(optimization.beforeAfter, "title", "after") ??
    pickGeneratedText(optimization.generated, ["title", "seoTitle"], product.title);
  const beforeShortDescription =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["shortDescription", "short_description"],
      "before",
    ) ??
    product.shortDescription ??
    null;
  const afterShortDescription =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["shortDescription", "short_description"],
      "after",
    ) ??
    getGeneratedValue(
      optimization.generated,
      ["shortDescription", "short_description"],
      beforeShortDescription,
    );
  const beforeDescription =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["longDescription", "description", "descriptionHtml", "description_html"],
      "before",
    ) ??
    product.description ??
    product.shortDescription ??
    "Açıklama kaydı yok.";
  const afterDescription =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["longDescription", "description", "descriptionHtml", "description_html"],
      "after",
    ) ??
    getGeneratedValue(
      optimization.generated,
      ["longDescription", "description", "descriptionHtml", "description_html"],
      beforeDescription,
    );
  const beforeSeoTitle =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["seoTitle", "seo_title"],
      "before",
    ) ??
    product.seoTitle ??
    null;
  const afterSeoTitle =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["seoTitle", "seo_title"],
      "after",
    ) ??
    getGeneratedValue(optimization.generated, ["seoTitle", "seo_title"], beforeSeoTitle);
  const beforeMetaDescription =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["metaDescription", "seoDescription", "seo_description"],
      "before",
    ) ??
    product.seoDescription ??
    null;
  const afterMetaDescription =
    getBeforeAfterTextFromFields(
      optimization.beforeAfter,
      ["metaDescription", "seoDescription", "seo_description"],
      "after",
    ) ??
    getGeneratedValue(
      optimization.generated,
      ["metaDescription", "seoDescription", "seo_description"],
      beforeMetaDescription,
    );
  const beforeSchema =
    getBeforeAfterStructuredText(optimization.beforeAfter, "schemaJsonLd", "before") ??
    null;
  const afterSchema =
    getBeforeAfterStructuredText(optimization.beforeAfter, "schemaJsonLd", "after") ??
    getGeneratedValue(optimization.generated, ["schemaJsonLd", "schema_json_ld"]);
  const beforeFaq =
    getBeforeAfterStructuredText(optimization.beforeAfter, "faq", "before") ?? null;
  const afterFaq =
    getBeforeAfterStructuredText(optimization.beforeAfter, "faq", "after") ??
    getGeneratedValue(optimization.generated, ["faq"]);
  const beforeNotes =
    reviewWarnings.length > 0
      ? reviewWarnings
      : optimization.selectedStrategies.map((strategy) => strategy.reason);
  const afterNotes = optimization.selectedStrategies.map(
    (strategy) => strategy.name,
  );

  return (
    <section className="seller-surface overflow-hidden">
      <ScoreComparisonAccordion
        product={product}
        analysis={analysis ?? null}
        optimization={optimization}
      />

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
        <StorefrontProductCard
          product={product}
          mode="before"
          title={beforeTitle}
          shortDescription={beforeShortDescription}
          description={beforeDescription}
          seoTitle={beforeSeoTitle}
          metaDescription={beforeMetaDescription}
          faqSummary={beforeFaq}
          schemaSummary={beforeSchema}
          score={beforeScore}
          notes={beforeNotes}
        />

        <div className="hidden items-center justify-center xl:flex">
          <div className="rounded-full border border-primary/30 bg-primary/10 p-2 text-primary shadow-primary-soft">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
        </div>

        <StorefrontProductCard
          product={product}
          mode="after"
          title={afterTitle ?? beforeTitle}
          shortDescription={afterShortDescription}
          description={afterDescription}
          seoTitle={afterSeoTitle}
          metaDescription={afterMetaDescription}
          faqSummary={afterFaq}
          schemaSummary={afterSchema}
          score={afterScore}
          notes={afterNotes}
        />
      </div>
    </section>
  );
}

export function ShopifyReviewPublishPanel({
  product,
  optimization,
}: {
  product: ProductAnalysisDetail;
  optimization: OptimizationResultRecord | null;
}) {
  if (
    product.source !== "shopify" ||
    !optimization ||
    (optimization.status !== "ready_for_review" &&
      optimization.status !== "approved" &&
      optimization.status !== "published")
  ) {
    return null;
  }

  const fields = getShopifyPublishableFieldCandidates(optimization);

  return (
    <section className="seller-surface p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Shopify yayin onayi</h2>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Tek onayla guvenli alanlar Shopify&apos;a gonderilir. Fiyat, stok,
        SKU, varyant, kargo, vergi ve medya alanlari degistirilmez.
      </p>
      <div className="mt-4">
        <ShopifyPublishControls
          productId={product.id}
          fields={fields}
        />
      </div>
    </section>
  );
}

export function GeneratedContentPanel({
  optimization,
}: {
  optimization: OptimizationResultRecord | null;
}) {
  if (
    !optimization ||
    !["ready_for_review", "approved", "exported", "published"].includes(
      optimization.status,
    )
  ) {
    return null;
  }

  const generatedEntries = Object.entries(optimization.generated).filter(
    ([, value]) => asText(value) || Array.isArray(value) || isRecord(value),
  );

  if (generatedEntries.length === 0) return null;

  return (
    <section className="seller-surface p-5 md:p-6">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Üretilen taslak alanlar</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {generatedEntries.map(([field, value]) => (
          <div
            key={field}
            className="rounded-lg border border-border bg-background/70 p-4"
          >
            <p className="text-sm font-medium">{field}</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {asText(value) ?? JSON.stringify(value, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductAnalysisPage({
  product,
  analysis,
  optimization,
  errorMessage,
  optimizationErrorMessage,
}: {
  product: ProductAnalysisDetail;
  analysis: ProductAnalysisRecord | null;
  optimization: OptimizationResultRecord | null;
  errorMessage?: string;
  optimizationErrorMessage?: string;
}) {
  return (
    <div className="page-enter grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Ürünlere dön
          </Link>
        </Button>
        <Badge variant="outline">{workflowLabels[product.workflowStatus]}</Badge>
      </div>

      {errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          {errorMessage}
        </section>
      ) : null}
      {optimizationErrorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          {optimizationErrorMessage}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
        <div className="grid gap-3">
          <AnalysisActionPanel product={product} />
          <AnalysisStatusPanel analysis={analysis} />
          <OptimizationPanel
            product={product}
            analysis={analysis}
            optimization={optimization}
          />
        </div>
        <ProductPreviewPanel product={product} />
      </section>
    </div>
  );
}


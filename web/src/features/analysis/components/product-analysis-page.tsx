import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Package,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyzeProductButton } from "@/features/analysis/components/analyze-product-button";
import type { ProductAnalysisDetail, ProductAnalysisRecord } from "@/types/analysis";

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
  failed: "Analiz hatasi",
};

const scoreLabels = [
  {
    key: "retrievalScore",
    label: "Bulunabilirlik",
    note: "Sayfanin erisilebilirligi ve temel tarama sinyalleri.",
  },
  {
    key: "machineUnderstandingScore",
    label: "Urun Bilgisi Kalitesi",
    note: "Baslik, aciklama, ozellik ve yapisal veri netligi.",
  },
  {
    key: "rerankingStrengthScore",
    label: "Karsilastirma Gucu",
    note: "Urunun alternatiflerle kiyaslanabilir kanitlari.",
  },
  {
    key: "aiAnswerReadinessScore",
    label: "AI Cevap Hazirligi",
    note: "AI cevaplarinda guvenle kullanilabilecek bilgiler.",
  },
] as const;

function formatDate(value?: string) {
  if (!value) return "Henuz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ScoreBar({ value }: { value?: number }) {
  const score = typeof value === "number" ? value : 0;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#3a2a1c]">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
      />
    </div>
  );
}

function ProductImage({ product }: { product: ProductAnalysisDetail }) {
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
      <section className="ai-engine-panel p-6">
        <p className="text-sm font-medium text-primary">AI analiz hazir</p>
        <h2 className="mt-3 text-2xl font-semibold">Ilk skor bekleniyor</h2>
        <p className="mt-3 text-sm leading-6 text-[#d8d1c8]">
          Bu urun icin henuz analiz yok. Analiz baslatildiginda backend,
          urunun normalize edilmis verisini API sozlesmesindeki ProductInput
          sekliyle AI servisine gonderecek.
        </p>
      </section>
    );
  }

  if (analysis.status === "failed") {
    return (
      <section className="ai-engine-panel p-6">
        <div className="flex items-center gap-2 text-primary">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm font-medium">Analiz tamamlanamadi</p>
        </div>
        <h2 className="mt-3 text-2xl font-semibold">Tekrar denenebilir</h2>
        <p className="mt-3 text-sm leading-6 text-[#d8d1c8]">
          {analysis.errorMessage ??
            "AI servisi beklenen analiz sonucunu dondurmedi."}
        </p>
      </section>
    );
  }

  const overallScore = analysis.overallScore ?? analysis.rawOutput?.overallScore;

  return (
    <section className="ai-engine-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            AI gorunurluk skoru
          </p>
          <h2 className="mt-3 text-5xl font-semibold">
            {typeof overallScore === "number" ? overallScore : "--"}
            <span className="text-2xl text-[#d8d1c8]">/100</span>
          </h2>
        </div>
        <Badge variant="secondary">
          {analysis.status === "running" ? "Calisiyor" : "Kaydedildi"}
        </Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#d8d1c8]">
        {analysis.recommendedAction ??
          "Analiz sonucu urunu yeniden yazmaz; sadece zayif sinyalleri ve siradaki guvenli adimi gosterir."}
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {scoreLabels.map((item) => {
          const value = analysis[item.key];

          return (
            <div
              key={item.key}
              className="rounded-md border border-[#4b3828] bg-[#24180f] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{item.label}</p>
                <span className="text-sm text-primary">
                  {typeof value === "number" ? `${value}/100` : "--"}
                </span>
              </div>
              <div className="mt-3">
                <ScoreBar value={value} />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#d8d1c8]">
                {item.note}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnalysisList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: string[];
}) {
  return (
    <section className="seller-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-md border border-border bg-background p-3 text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export function ProductAnalysisPage({
  product,
  analysis,
  errorMessage,
}: {
  product: ProductAnalysisDetail;
  analysis: ProductAnalysisRecord | null;
  errorMessage?: string;
}) {
  const latestOutput = analysis?.rawOutput;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Urunlere don
          </Link>
        </Button>
        <Badge variant="outline">{workflowLabels[product.workflowStatus]}</Badge>
      </div>

      {errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          {errorMessage}
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="seller-surface p-4">
          <ProductImage product={product} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">{sourceLabels[product.source]}</Badge>
            {product.priceDisplay ? (
              <Badge variant="outline">{product.priceDisplay}</Badge>
            ) : null}
          </div>
          <h1 className="mt-4 break-words text-2xl font-semibold">
            {product.title}
          </h1>
          <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
            <span>Son guncelleme: {formatDate(product.updatedAt)}</span>
            <span>Son analiz: {formatDate(product.lastAnalyzedAt)}</span>
            {product.url ? (
              <Link
                href={product.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary"
              >
                Urun sayfasini ac
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5">
          <AnalysisStatusPanel analysis={analysis} />
          <section className="seller-surface p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">
                  Tek urun analizi
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  ProductInput hazir, analiz servisine bagli
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Buton, backend uzerinden server-to-server olarak AI servisine
                  gider. Tarayici AI secret veya ham servis adresi gormez.
                </p>
              </div>
              <AnalyzeProductButton
                productId={product.id}
                disabled={product.workflowStatus === "analysis_running"}
              />
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AnalysisList
          title="Ana sorunlar"
          emptyText="Analiz sonucu ana sorun dondurmediyse burada bilgi gosterilmez."
          items={analysis?.mainProblems ?? latestOutput?.mainProblems ?? []}
        />
        <AnalysisList
          title="Eksik bilgiler"
          emptyText="Eksik kritik bilgi gorunmuyor."
          items={analysis?.missingFacts ?? latestOutput?.missingFacts ?? []}
        />
      </section>

      <section className="seller-surface p-5">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Alim niyeti varyantlari</h2>
        </div>
        {(analysis?.buyerIntentVariants ?? latestOutput?.buyerIntentVariants ?? [])
          .length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {(analysis?.buyerIntentVariants ??
              latestOutput?.buyerIntentVariants ??
              []).map((intent) => (
              <Badge key={intent} variant="secondary">
                {intent}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
            Analizden sonra AI tarafindan gorulen arama/alim niyetleri burada
            listelenir.
          </p>
        )}
      </section>
    </div>
  );
}

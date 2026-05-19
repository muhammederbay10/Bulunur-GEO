import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  History,
  Package,
  Send,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ActivityHistoryEvent,
  ActivityHistoryEventKind,
  ActivityHistorySummary,
} from "@/lib/db/history-repository";
import { cn } from "@/lib/utils";

const sourceLabels = {
  shopify: "Shopify",
  native: "Web sitesi",
  woocommerce: "WooCommerce",
};

const kindLabels = {
  analysis: "Analiz",
  optimization: "Optimizasyon",
  publish: "Yayın",
};

const statusLabels: Record<string, string> = {
  queued: "Sırada",
  running: "İşleniyor",
  succeeded: "Tamamlandı",
  failed: "Hata",
  draft: "Taslak",
  needs_user_input: "Bilgi gerekiyor",
  ready_for_review: "İncelemeye hazır",
  approved: "Onaylandı",
  exported: "Dışa aktarıldı",
  published: "Yayında",
  cancelled: "İptal",
};

function formatDate(value?: string) {
  if (!value) return "Henüz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function scoreText(event: ActivityHistoryEvent) {
  if (
    typeof event.scoreBefore === "number" &&
    typeof event.scoreAfter === "number"
  ) {
    const delta = event.scoreAfter - event.scoreBefore;
    const sign = delta > 0 ? "+" : "";

    return `${event.scoreBefore} → ${event.scoreAfter} (${sign}${delta})`;
  }

  if (typeof event.scoreAfter === "number") {
    return `${event.scoreAfter}/100`;
  }

  return "Skor yok";
}

function EventIcon({ kind }: { kind: ActivityHistoryEventKind }) {
  const Icon =
    kind === "analysis" ? CheckCircle2 : kind === "optimization" ? Sparkles : Send;

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note: string;
}) {
  return (
    <div className="seller-surface p-4">
      <p className="mono-label text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-bold leading-none">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function EmptyHistory() {
  return (
    <section className="seller-surface p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <History className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Henüz geçmiş kaydı yok</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Bir ürünü analiz ettiğinde, optimize ettiğinde veya Shopify&apos;a
        yayınladığında kayıtlar burada sade bir zaman çizelgesi olarak görünür.
      </p>
      <Button asChild className="mt-4">
        <Link href="/products">Ürünlere git</Link>
      </Button>
    </section>
  );
}

function HistoryRow({ event }: { event: ActivityHistoryEvent }) {
  const isPositive =
    typeof event.scoreBefore === "number" &&
    typeof event.scoreAfter === "number" &&
    event.scoreAfter >= event.scoreBefore;

  return (
    <Link
      href={event.href}
      className="grid gap-3 border-t border-border p-4 transition hover:bg-muted/60 lg:grid-cols-[minmax(0,1.5fr)_120px_150px_140px_120px] lg:items-center"
    >
      <div className="flex min-w-0 items-start gap-3">
        <EventIcon kind={event.kind} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-1 font-semibold">
              {event.productTitle}
            </h3>
            <Badge variant="outline">{kindLabels[event.kind]}</Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {event.note}
          </p>
        </div>
      </div>

      <Badge variant="outline" className="w-fit">
        {sourceLabels[event.productSource]}
      </Badge>

      <span
        className={cn(
          "w-fit rounded-full border px-3 py-1 font-mono text-xs font-semibold",
          isPositive
            ? "border-primary/25 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground",
        )}
      >
        {scoreText(event)}
      </span>

      <span className="text-sm text-muted-foreground">
        {statusLabels[event.status] ?? event.status}
      </span>

      <span className="inline-flex items-center justify-between gap-2 text-sm text-muted-foreground lg:justify-end">
        {formatDate(event.happenedAt)}
        <ArrowRight className="h-4 w-4 text-primary" />
      </span>
    </Link>
  );
}

export function ActivityHistoryPage({
  events,
  summary,
  errorMessage,
}: {
  events: ActivityHistoryEvent[];
  summary: ActivityHistorySummary;
  errorMessage?: string;
}) {
  return (
    <div className="page-enter grid gap-5">
      {errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          {errorMessage}
        </section>
      ) : null}

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label text-primary">Geçmiş</p>
          <h1 className="mt-2 text-2xl font-semibold">
            Analiz, optimizasyon ve yayın geçmişi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ürün bazında önemli hareketleri gösterir. Teknik loglar ve ham
            hata detayları burada ana deneyimi kalabalıklaştırmaz.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/products">
            Ürünler
            <Package className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Toplam kayıt"
          value={summary.totalEvents}
          note="Son iş akışı hareketleri."
        />
        <MetricCard
          label="Analiz"
          value={summary.analysisEvents}
          note="Kaydedilen analiz denemeleri."
        />
        <MetricCard
          label="Optimizasyon"
          value={summary.optimizationEvents}
          note="Kaydedilen iyileştirme sonuçları."
        />
        <MetricCard
          label="Son hareket"
          value={formatDate(summary.latestActivityAt)}
          note="En yeni kayıt zamanı."
        />
      </section>

      {events.length === 0 ? (
        <EmptyHistory />
      ) : (
        <section className="seller-surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Son hareketler</h2>
            </div>
            <Badge variant="outline">{events.length} kayıt</Badge>
          </div>
          <div>
            {events.map((event) => (
              <HistoryRow key={`${event.kind}-${event.id}`} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

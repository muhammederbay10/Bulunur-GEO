import Link from "next/link";
import {
  ArrowRight,
  Database,
  Package,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/profile";
import type { CatalogDashboardSummary } from "@/types/product";
import type { SourceStore } from "@/types/source";

const sourceLabels = {
  shopify: "Shopify",
  native: "Web sitesi",
  woocommerce: "WooCommerce",
};

const storeStatusLabels: Record<string, string> = {
  setup_pending: "Kurulum bekliyor",
  active: "Aktif",
  syncing: "Senkronize ediliyor",
  error: "Hata",
  disconnected: "Bağlantı kesildi",
};

const connectionStatusLabels: Record<string, string> = {
  pending: "Bekliyor",
  connected: "Bağlı",
  error: "Hata",
  revoked: "Yetki iptal",
  disconnected: "Bağlantı kesildi",
};

function formatDate(value?: string | null) {
  if (!value) return "Henüz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function FieldLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value || "Henüz yok"}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Settings;
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="seller-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono-label text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-bold leading-none">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

function SourceCard({ source }: { source: SourceStore }) {
  const connectionStatus = source.connection?.status;

  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{source.name}</h3>
            <Badge variant="outline">{sourceLabels[source.sourceType]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {source.connection?.shopDomain ?? source.websiteUrl ?? "Adres yok"}
          </p>
        </div>
        <Badge
          variant={source.status === "active" ? "secondary" : "outline"}
        >
          {storeStatusLabels[source.status] ?? source.status}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <FieldLine label="Pazar" value={source.market} />
        <FieldLine label="Son senkron" value={formatDate(source.lastSyncAt)} />
        <FieldLine
          label="Bağlantı"
          value={
            connectionStatus
              ? connectionStatusLabels[connectionStatus] ?? connectionStatus
              : source.sourceType === "native"
                ? "Yerel kaynak"
                : "Bağlantı yok"
          }
        />
      </div>

      {source.connection?.lastErrorMessage ? (
        <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-muted-foreground">
          {source.connection.lastErrorMessage}
        </p>
      ) : null}
    </div>
  );
}

function SafetyItem({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}

export function AccountSettingsPage({
  profile,
  sources,
  catalog,
  errorMessage,
}: {
  profile: UserProfile | null;
  sources: SourceStore[];
  catalog: CatalogDashboardSummary;
  errorMessage?: string;
}) {
  const activeSources = sources.filter((source) => source.status === "active");

  return (
    <div className="page-enter grid gap-5">
      {errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          {errorMessage}
        </section>
      ) : null}

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label text-primary">Ayarlar</p>
          <h1 className="mt-2 text-2xl font-semibold">
            Hesap, kaynaklar ve güvenli kullanım
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Bu ekran çalışma alanının özetini gösterir. Gizli anahtarlar,
            servis tokenları ve Shopify erişim bilgileri tarayıcıya açılmaz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/sources">Kaynaklar</Link>
          </Button>
          <Button asChild>
            <Link href="/products">
              Ürünler
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={UserRound}
          label="Profil"
          value={profile?.onboardingCompleted ? "Hazır" : "Eksik"}
          note={profile?.businessName ?? "İşletme bilgisi bekleniyor."}
        />
        <SummaryCard
          icon={Store}
          label="Kaynak"
          value={activeSources.length}
          note={`${sources.length} toplam kaynak kaydı.`}
        />
        <SummaryCard
          icon={Package}
          label="Katalog"
          value={catalog.metrics.totalProducts}
          note={`${catalog.metrics.optimizedProducts} optimize edilmiş ürün.`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
        <div className="seller-surface p-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">İşletme profili</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FieldLine label="Ad soyad" value={profile?.fullName} />
            <FieldLine label="E-posta" value={profile?.email} />
            <FieldLine label="İşletme" value={profile?.businessName} />
            <FieldLine label="Kategori" value={profile?.businessCategory} />
            <FieldLine label="Pazar odağı" value={profile?.marketFocus} />
            <FieldLine
              label="Tercih edilen kaynak"
              value={
                profile?.preferredProductSource
                  ? sourceLabels[profile.preferredProductSource]
                  : null
              }
            />
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Katalog durumu</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <FieldLine
              label="Analiz edilen"
              value={String(catalog.metrics.analyzedProducts)}
            />
            <FieldLine
              label="Dikkat isteyen"
              value={String(
                catalog.metrics.waitingProducts +
                  catalog.metrics.lowScoreProducts,
              )}
            />
            <FieldLine
              label="Son katalog hareketi"
              value={formatDate(catalog.lastCatalogActivityAt)}
            />
          </div>
        </div>
      </section>

      <section className="seller-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Kaynaklar</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/sources">Yönet</Link>
          </Button>
        </div>
        {sources.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground">
            Henüz kaynak kaydı yok. Ürünleri içeri almak için kaynak ekle.
          </p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SafetyItem
          title="Gizli bilgiler korunur"
          note="Shopify tokenları, servis anahtarları ve Supabase gizli anahtarları bu ekranda gösterilmez."
        />
        <SafetyItem
          title="Yayın manuel kalır"
          note="Optimizasyon sonucu Shopify'a ancak kullanıcı açıkça onay verip yayınladığında gönderilir."
        />
        <SafetyItem
          title="Rol modeli sade"
          note="MVP'de temel sahip kullanıcı modeli kullanılır; ekip, ajans ve admin rolleri henüz tanımlı değildir."
        />
      </section>
    </div>
  );
}

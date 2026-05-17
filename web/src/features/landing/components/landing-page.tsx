import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  FileCheck2,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import shopifyLogo from "@/app/shopify-logo.png";

const capabilityCards = [
  {
    icon: Search,
    title: "Görünürlük skoru",
    body: "Her ürün; bulunabilirlik, ürün bilgisi kalitesi, karşılaştırma gücü ve cevap hazırlığı katmanlarıyla puanlanır.",
  },
  {
    icon: Code2,
    title: "Ürün schema hazırlığı",
    body: "Başlık, açıklama, özellikler, fiyat, stok ve schema sinyalleri tek ürün sayfasında toparlanır.",
  },
  {
    icon: FileCheck2,
    title: "Önce / sonra review",
    body: "Optimize edilen içerik mevcut ürünle yan yana incelenir. Satıcı onaylamadan Shopify ürünü değişmez.",
  },
  {
    icon: Store,
    title: "Shopify akışı",
    body: "Shopify mağazasından ürün çekme, analiz etme, taslak hazırlama ve uygun alanları yayınlama akışı tek panelde ilerler.",
  },
];

function ShopifyMark() {
  return (
    <div className="landing-hover inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-background/90">
        <Image
          src={shopifyLogo}
          alt=""
          width={22}
          height={22}
          className="h-8 w-8 object-contain"
          aria-hidden="true"
        />
      </span>
      Shopifya kolay integrasyon
    </div>
  );
}

function HeroSignalStrip() {
  const signals = [
    ["Ürün skoru", "87/100"],
    ["Shopify", "bağlı"],
    ["Review", "hazır"],
  ];

  return (
    <div className="mx-auto mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
      {signals.map(([label, value]) => (
        <div
          key={label}
          className="landing-hover rounded-xl border border-border bg-card/85 px-4 py-3 text-left shadow-sm"
        >
          <p className="mono-label text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-semibold text-primary">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ScoreRing() {
  return (
    <div className="relative h-24 w-24 shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(hsl(var(--primary)) 313deg, hsl(var(--muted)) 0deg)",
        }}
      />
      <div className="absolute inset-2 rounded-full bg-card" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none">87</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function SystemPreview() {
  const scores = [
    ["Bulunabilirlik", 74],
    ["Ürün bilgisi", 68],
    ["Karsilastirma", 61],
    ["Cevap hazırlığı", 87],
  ];

  return (
    <div className="landing-hover seller-surface overflow-hidden bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        </div>
        <Badge variant="secondary">Ürün analizi</Badge>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3">
          <div className="rounded-lg border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="mono-label text-primary">Görünürlük skoru</p>
                <p className="mt-2 text-5xl font-bold text-primary">87</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Yayına hazır ürün taslağı
                </p>
              </div>
              <ScoreRing />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {scores.map(([label, score]) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-background/70 p-3 transition hover:border-primary/40 hover:bg-muted/60"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="font-semibold text-primary">{score}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/70 p-4 transition hover:border-primary/40">
          <div className="landing-preview-image aspect-[4/3] rounded-lg border border-border bg-muted" />
          <h3 className="mt-4 line-clamp-2 text-lg font-semibold">
            Akilli Kahve Makinesi Pro 2.0
          </h3>
          <p className="mt-2 text-sm text-primary">3.299,00 TL</p>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              FAQ ve schema taslağı hazır
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Shopify review adımina uygun
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-6xl items-center justify-center overflow-hidden px-5 py-16 text-center">
      <div className="pointer-events-none absolute inset-x-6 top-16 h-64 rounded-full border border-primary/10 bg-primary/5 blur-3xl" />
      <div className="landing-reveal relative z-10 mx-auto max-w-4xl">
        <Badge variant="secondary">Türkçe e-ticaret ürün görünürlüğü</Badge>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
          Ürün sayfalarını arama ve cevap motorları için anlaşılır hale getirin.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          Bulunur; Shopify veya web sitenizden gelen ürünleri analiz eder, eksik
          sinyalleri gösterir ve yayına hazır iyileştirme taslakları oluşturur.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href="/auth/sign-up">
              Kuruluma başla
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">Giriş yap</Link>
          </Button>
        </div>

        <div className="mt-8">
          <ShopifyMark />
        </div>

        <HeroSignalStrip />
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="landing-reveal">
          <SystemPreview />
        </div>
        <div className="landing-reveal landing-delay-2">
          <p className="mono-label text-primary">Sistem ekrani</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
            Tek üründe skor, eksik bilgi ve optimize taslağı aynı akışta.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Panel, satıcının teknik detaylarda kaybolmadan karar vermesi için
            tasarlandı: önce ürün skoru, sonra sinyal kartları, sonra kontrollü
            önce/sonra review.
          </p>
          <div className="mt-6 grid gap-3">
            {[
              "Kaynak, stok, fiyat ve ürün metni tek kartta görünür.",
              "Skor katmanları ürünün neden zayıf kaldığını ayırır.",
              "Shopify ürünleri için onay ve yayınlama ayrıca kontrol edilir.",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16">
      <div className="max-w-2xl">
        <p className="mono-label text-primary">Yetenekler</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
          E-ticaret ürünleri için doğru sinyallere odaklanır.
        </h2>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {capabilityCards.map((card) => (
          <article
            key={card.title}
            className="landing-hover landing-reveal seller-surface p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <card.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">{card.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AvatarCard({
  name,
  role,
  initials,
  body,
}: {
  name: string;
  role: string;
  initials: string;
  body: string;
}) {
  return (
    <article className="landing-hover landing-reveal seller-surface grid gap-5 p-5 sm:grid-cols-[120px_1fr]">
      <div className="flex aspect-square items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-3xl font-semibold text-primary">
        {initials}
      </div>
      <div>
        <p className="text-xl font-semibold">{name}</p>
        <p className="mt-1 text-sm font-medium text-primary">{role}</p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}

function AboutSection() {
  return (
    <section className="border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <p className="mono-label text-primary">Ekip</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
            Satıcı deneyimi ve yapay zeka mühendisliği aynı masada.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Proje, e-ticaret satıcılarının ürün içeriğini daha güvenli ve
            anlaşılır şekilde iyileştirmesine odaklanan iki kişilik bir ekip
            tarafından geliştiriliyor.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <AvatarCard
            name="Kurucu"
            role="Ürün ve frontend"
            initials="K"
            body="Satıcı akışını, onboarding deneyimini ve panel tasarımını sade tutmaya odaklanır."
          />
          <AvatarCard
            name="AI Engineer"
            role="Yapay zeka mühendisi"
            initials="AI"
            body="Analiz, ürün sinyalleri, optimizasyon çıktısı ve güvenli backend akışları üzerinde çalışır."
          />
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              B
            </span>
            <span className="text-lg font-semibold text-primary">Bulunur</span>
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Giriş</Link>
            </Button>
          </nav>
        </div>
      </header>

      <HeroSection />
      <ProductSection />
      <CapabilitiesSection />
      <AboutSection />

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <span>Bulunur</span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Onay olmadan yayın yok
          </span>
        </div>
      </footer>
    </main>
  );
}

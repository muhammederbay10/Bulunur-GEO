import Link from "next/link";
import type { CSSProperties } from "react";

import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  CirclePlay,
  Code2,
  Cpu,
  FileCheck2,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BulunurLogo } from "@/components/bulunur-logo";
import { Button } from "@/components/ui/button";
import { ShopifyMark } from "@/components/shopify-mark";
import { ThemeSwitcher } from "@/components/theme-switcher";
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
const heroNodes = [
  {
    icon: BrainCircuit,
    className: "left-[6%] top-[18%] hidden md:flex",
    style: {
      "--hero-float-x": "22px",
      "--hero-float-y": "-18px",
      "--hero-duration": "10s",
      "--hero-delay": "-2s",
    },
  },
  {
    icon: Bot,
    className: "right-[9%] top-[20%]",
    style: {
      "--hero-float-x": "-18px",
      "--hero-float-y": "20px",
      "--hero-duration": "11s",
      "--hero-delay": "-5s",
    },
  },
  {
    icon: Search,
    className: "left-[13%] bottom-[20%]",
    style: {
      "--hero-float-x": "18px",
      "--hero-float-y": "22px",
      "--hero-duration": "12s",
      "--hero-delay": "-4s",
    },
  },
  {
    icon: Cpu,
    className: "right-[15%] bottom-[18%] hidden sm:flex",
    style: {
      "--hero-float-x": "-24px",
      "--hero-float-y": "-16px",
      "--hero-duration": "9s",
      "--hero-delay": "-1s",
    },
  },
  {
    icon: Network,
    className: "left-[28%] top-[10%] hidden lg:flex",
    style: {
      "--hero-float-x": "-16px",
      "--hero-float-y": "18px",
      "--hero-duration": "13s",
      "--hero-delay": "-7s",
    },
  },
  {
    icon: Sparkles,
    className: "right-[27%] bottom-[10%] hidden lg:flex",
    style: {
      "--hero-float-x": "20px",
      "--hero-float-y": "-20px",
      "--hero-duration": "10.5s",
      "--hero-delay": "-3s",
    },
  },
] as const;

function HeroAmbientNetwork() {
  return (
    <div className="hero-ai-background pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="hero-network-lines absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M7 25 C 24 10, 41 13, 53 30 S 78 51, 92 24" />
        <path d="M12 77 C 27 57, 40 60, 50 43 S 73 26, 88 44" />
        <path d="M20 18 C 25 40, 30 63, 44 74 S 68 84, 82 70" />
        <path d="M6 50 C 21 39, 37 42, 48 54 S 69 71, 94 59" />
      </svg>
      <div className="hero-grid-layer absolute inset-0" />
      {heroNodes.map(({ icon: Icon, className, style }, index) => (
        <span
          key={index}
          className={`hero-ai-node absolute ${className}`}
          style={style as CSSProperties}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5 md:h-6 md:w-6" />
        </span>
      ))}
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[calc(100vh-76px)] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_12%,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.28)_48%,hsl(var(--background)))] px-5 py-16 text-center">
      <HeroAmbientNetwork />
      <div className="landing-reveal relative z-10 mx-auto w-full max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 font-mono text-[15px] font-semibold tracking-wider text-primary">
          <Zap className="h-3.5 w-3.5" />
          Yapay Zeka Destekli Görünürlük Motoru
        </div>

        <h1 className="mx-auto mt-7 max-w-3xl text-4xl font-bold leading-[1.08] tracking-normal text-foreground md:text-5xl">
          E-Ticaret Ürünlerinizi
          <br />
          <span className="text-primary">Yapay Zeka Çağına</span> Hazırlayın.
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          Shopify ve web mağazalarınızdaki ürünleri LLM’lerin (Büyük Dil
          Modelleri) ve arama motorlarının tam olarak anlayabileceği şekilde
          optimize edin. Satışlarınızı organik olarak artırın.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="h-11 min-w-36 rounded-sm px-6">
            <Link href="/auth/sign-up">Şimdi Keşfedin</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-11 min-w-40 rounded-sm px-6"
          >
            <Link href="#nasil-calisir">
              <CirclePlay className="h-4 w-4" />
              Nasıl Çalışır?
            </Link>
          </Button>
        </div>
        <div className="mt-8">
          <ShopifyMark />
        </div>
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="nasil-calisir" className="border-y border-border bg-muted/40">
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

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-24 w-full max-w-6xl items-center justify-between gap-4 px-5 ">
          <BulunurLogo
            href="/"
            className="h-16 w-52 md:h-20 md:w-64 mt-2"
            priority
          />
          <nav className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button
              asChild
              variant="default"
              size="sm"
              className="normal-case tracking-normal"
            >
              <Link href="/auth/login">Giriş</Link>
            </Button>
          </nav>
        </div>
      </header>

      <HeroSection />
      <ProductSection />
      <CapabilitiesSection />

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <BulunurLogo href="/" className="h-10 w-32" />
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Onay olmadan yayın yok
          </span>
        </div>
      </footer>
    </main>
  );
}

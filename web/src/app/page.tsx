import Link from "next/link";
import { ArrowRight, CheckCircle2, PackageSearch, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasRequiredPublicEnv } from "@/lib/env/public";

const foundationSignals = [
  {
    icon: PackageSearch,
    title: "Ürünlerinizi tek yerden yönetin",
    body: "Shopify veya web sitenizden gelen ürünler için sade bir çalışma alanı hazırlanıyor.",
  },
  {
    icon: CheckCircle2,
    title: "Anlaşılır AI görünürlük akışı",
    body: "Her ürün için neyin eksik olduğunu, hangi adımın güvenli olduğunu ve sıradaki aksiyonu net gösterir.",
  },
  {
    icon: ShieldCheck,
    title: "Yayınlamadan önce onay",
    body: "AI önerileri siz onaylamadan mağazanıza uygulanmaz veya yayınlanmaz.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
        <header className="flex items-center justify-between border-b border-border/70 pb-4">
          <Link href="/" className="text-sm font-semibold text-foreground">
            AI Görünürlük
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/auth/login"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Giriş yap
            </Link>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Kuruluma başla</Link>
            </Button>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <p className="text-sm font-medium text-primary">
                Türkçe e-ticaret satıcıları için
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground md:text-6xl">
                Ürünlerinizi AI aramalarında daha anlaşılır hale getirin.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Ürünlerinizi içeri alın, görünürlük sinyallerini tek ürün
                üzerinden analiz edin ve önerilen iyileştirmeleri yayınlamadan
                önce güvenle inceleyin.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link href="/dashboard">
                  Panele git
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/onboarding">Onboarding sayfasına devam et</Link>
              </Button>
            </div>
          </div>

          <div className="seller-surface p-5">
            <div className="border-b border-border/70 pb-4">
              <p className="text-sm font-medium text-primary">
                Satıcı dostu temel hazır
              </p>
              <p className="mt-2 text-2xl font-semibold">
                Hafif arayüz, kontrollü AI iş akışı
              </p>
            </div>
            <div className="grid gap-3 pt-5">
              {foundationSignals.map((signal) => (
                <div
                  key={signal.title}
                  className="flex gap-4 rounded-md border border-border/60 bg-background/70 p-4"
                >
                  <signal.icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h2 className="text-sm font-semibold">{signal.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {signal.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border/70 pt-4 text-xs text-muted-foreground">
              Supabase ortamı:{" "}
              {hasRequiredPublicEnv ? "hazır" : "yapılandırılmadı"}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

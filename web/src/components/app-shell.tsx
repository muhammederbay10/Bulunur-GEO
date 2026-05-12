import Link from "next/link";
import { Suspense } from "react";
import {
  History,
  LayoutDashboard,
  Package,
  Settings,
  Store,
} from "lucide-react";

import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/features/auth/components/auth-button";
import { hasRequiredPublicEnv } from "@/lib/env/public";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/products", label: "Ürünler", icon: Package },
  { href: "/sources", label: "Kaynaklar", icon: Store },
  { href: "/history", label: "Geçmiş", icon: History },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-border/70 bg-card/80 p-5 lg:border-b-0 lg:border-r">
          <Link href="/" className="block">
            <p className="text-sm font-semibold text-foreground">
              AI Görünürlük
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Türkçe e-ticaret ürünleri için
            </p>
          </Link>

          <nav className="mt-8 grid gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition hover:border-border hover:bg-background hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-border/70 bg-background/90 px-5 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Satıcı çalışma alanı
              </p>
              <p className="text-sm text-muted-foreground">
                Ürünlerinizi içeri alın, analiz edin ve güvenle iyileştirin.
              </p>
            </div>
            {hasRequiredPublicEnv ? (
              <Suspense>
                <AuthButton />
              </Suspense>
            ) : (
              <EnvVarWarning />
            )}
          </header>
          <div className="flex-1 px-5 py-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

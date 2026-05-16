import Link from "next/link";

import { SidebarAccountCard } from "@/components/sidebar-account-card";
import { SidebarNav } from "@/components/sidebar-nav";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="h-screen overflow-hidden bg-background">
      <div className="flex h-full w-full">
        <aside className="hidden h-screen w-64 shrink-0 overflow-hidden border-r border-border/70 bg-muted/70 p-5 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              AI
            </div>
            <div>
              <p className="text-xl font-semibold text-primary">
                AI Gorunurluk
              </p>
              <p className="mono-label mt-1 text-muted-foreground">
                E-ticaret paneli
              </p>
            </div>
          </Link>

          <SidebarNav />

          <div className="mt-auto pt-5">
            <SidebarAccountCard />
          </div>
        </aside>

        <section className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border/70 bg-background/95 px-5 py-3 backdrop-blur lg:px-10">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Satici calisma alani
                </p>
                <p className="text-sm text-muted-foreground">
                  Urunlerinizi iceri alin, analiz edin ve guvenle iyilestirin.
                </p>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-10 lg:py-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

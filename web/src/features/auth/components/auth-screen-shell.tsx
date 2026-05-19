import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BulunurLogo } from "@/components/bulunur-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

type AuthScreenShellProps = {
  children: React.ReactNode;
  wide?: boolean;
};

export function AuthScreenShell({ children, wide = false }: AuthScreenShellProps) {
  return (
    <main className="relative flex h-svh w-full items-center justify-center overflow-hidden bg-background p-4 text-foreground md:p-6">
      <div className="absolute left-4 top-4 z-20 md:left-6 md:top-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Ana sayfa
        </Link>
      </div>
      <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
        <ThemeSwitcher />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className={wide ? "relative z-10 w-full max-w-6xl" : "relative z-10 w-full max-w-[440px]"}>
        <div
          className={
            wide
              ? "mb-5 flex flex-col items-center text-center"
              : "mb-8 flex flex-col items-center text-center"
          }
        >
          <BulunurLogo
            href="/"
            className={wide ? "h-14 w-48" : "h-16 w-56"}
            priority
          />
          <p className="mono-label mt-3 text-muted-foreground">
            E-ticaret görünürlük motoru
          </p>
        </div>

        {children}
      </div>
    </main>
  );
}

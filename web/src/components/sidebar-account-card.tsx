import { Gauge } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { hasRequiredPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

const dailyLimits = [
  {
    label: "Analiz",
    used: 0,
    limit: 10,
  },
  {
    label: "Optimizasyon",
    used: 0,
    limit: 10,
  },
];

function DailyLimitRows() {
  return (
    <div className="grid gap-2.5">
      {dailyLimits.map((item) => {
        const remaining = item.limit - item.used;
        const percent = item.limit > 0 ? (remaining / item.limit) * 100 : 0;
        const barColor =
          percent <= 20
            ? "bg-destructive"
            : percent <= 30
              ? "bg-yellow-500"
              : "bg-primary";

        return (
          <div key={item.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">
                {remaining}/{item.limit} kalan
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function AccountSummary() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    return (
      <div className="grid gap-2">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href="/auth/login">Giris yap</Link>
        </Button>
        <Button asChild size="sm" className="w-full">
          <Link href="/auth/sign-up">Kayit ol</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Merhaba</p>
        <p className="truncate text-sm font-semibold text-foreground">
          {user.email}
        </p>
      </div>
      <LogoutButton variant="outline" size="sm" className="w-full" />
    </div>
  );
}

export function SidebarAccountCard() {
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gauge className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Hesap ve limitler</p>
          <p className="mono-label mt-1 text-muted-foreground">Gunluk kullanim</p>
        </div>
      </div>

      {hasRequiredPublicEnv ? (
        <Suspense>
          <AccountSummary />
        </Suspense>
      ) : (
        <EnvVarWarning />
      )}

      <div className="my-3 h-px bg-border" />

      <DailyLimitRows />

      <div className="mt-3">
        <ThemeSwitcher />
      </div>
    </section>
  );
}

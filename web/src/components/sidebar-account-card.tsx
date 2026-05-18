import { Gauge } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EnvVarWarning } from "@/components/env-var-warning";
import { SidebarUsageCounters } from "@/components/sidebar-usage-counters";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { hasRequiredPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

async function AccountSummary() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    return (
      <div className="grid gap-2">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href="/auth/login">Giriş yap</Link>
        </Button>
        <Button asChild size="sm" className="w-full">
          <Link href="/auth/sign-up">Kayıt ol</Link>
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

      <SidebarUsageCounters />

      <div className="mt-3">
        <ThemeSwitcher />
      </div>
    </section>
  );
}

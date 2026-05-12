import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
} from "@/lib/db/profile-repository";

function ProtectedAreaFallback() {
  return (
    <main className="industrial-grid min-h-screen bg-background p-5">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center">
        <div className="industrial-panel max-w-xl p-6">
          <p className="font-mono text-xs uppercase text-primary">Faz 1</p>
          <h1 className="mt-3 text-2xl font-semibold">Oturum kontrol ediliyor</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Korumalı uygulama alanı açılmadan önce Supabase oturumu ve
            onboarding durumu doğrulanıyor.
          </p>
        </div>
      </div>
    </main>
  );
}

async function ProtectedDashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { profile } = await getProfileForUser(user.id);

  if (!hasCompletedOnboarding(profile)) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}

export default function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<ProtectedAreaFallback />}>
      <ProtectedDashboardShell>{children}</ProtectedDashboardShell>
    </Suspense>
  );
}

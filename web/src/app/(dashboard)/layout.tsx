import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
  hasCompletedSourceSetup,
} from "@/lib/db/profile-repository";
import { listProductSourceSummariesForProfile } from "@/lib/db/product-repository";

function ProtectedAreaFallback() {
  return (
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center">
        <div className="seller-surface max-w-xl p-6">
          <p className="text-sm font-medium text-primary">Güvenli alan</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Çalışma alanınız hazırlanıyor
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Panele geçmeden önce oturumunuz ve onboarding durumunuz kontrol
            ediliyor.
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

  if (!hasCompletedSourceSetup(profile)) {
    redirect("/sources?setup=1");
  }

  const sourcesResult = await listProductSourceSummariesForProfile(user.id);

  return (
    <AppShell sources={sourcesResult.ok ? sourcesResult.data : []}>
      {children}
    </AppShell>
  );
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

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SourceSetupPanel } from "@/features/sources/components/source-setup-panel";
import { getCurrentUser, getProfileForUser } from "@/lib/db/profile-repository";
import { getSourceSetupForUser } from "@/lib/db/source-repository";
import { hasSupabaseServiceRoleKey } from "@/lib/env/server";

type SourcesPageProps = {
  searchParams?: Promise<{
    setup?: string;
  }>;
};

function SourcesFallback() {
  return (
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-5xl py-10">
        <div className="seller-surface p-6">
          <p className="text-sm font-medium text-primary">Ürün kaynağı</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Kaynak durumu hazırlanıyor
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Mağaza ve bağlantı kayıtlarınız güvenli şekilde okunuyor.
          </p>
        </div>
      </div>
    </main>
  );
}

async function SourcesContent({
  searchParams,
}: {
  searchParams?: Promise<{
    setup?: string;
  }>;
}) {
  const params = await searchParams;
  const setupRequested = params?.setup === "1";
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [profileResult, sourceResult] = await Promise.all([
    getProfileForUser(user.id),
    getSourceSetupForUser(user.id),
  ]);

  const profile = profileResult.profile;

  if (!profile?.onboardingCompleted) {
    redirect("/onboarding");
  }

  const setupMode = setupRequested || !profile.sourceSetupCompleted;
  const panel = (
    <SourceSetupPanel
      profile={profile}
      stores={sourceResult.stores}
      databaseReady={!profileResult.isMissingTable && !sourceResult.isMissingTable}
      canWriteSources={hasSupabaseServiceRoleKey()}
      setupMessage={profileResult.errorMessage ?? sourceResult.errorMessage}
      setupMode={setupMode}
    />
  );

  if (!setupMode) {
    return <AppShell>{panel}</AppShell>;
  }

  return (
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-5xl py-10">{panel}</div>
    </main>
  );
}

export default function SourcesPage({ searchParams }: SourcesPageProps) {
  return (
    <Suspense fallback={<SourcesFallback />}>
      <SourcesContent searchParams={searchParams} />
    </Suspense>
  );
}

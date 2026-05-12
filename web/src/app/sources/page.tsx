import { Suspense } from "react";
import { redirect } from "next/navigation";

import { SourceSetupPanel } from "@/features/sources/components/source-setup-panel";
import { getCurrentUser, getProfileForUser } from "@/lib/db/profile-repository";
import { getSourceSetupForUser } from "@/lib/db/source-repository";
import { hasSupabaseServiceRoleKey } from "@/lib/env/server";

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

async function SourcesContent() {
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

  return (
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-5xl py-10">
        <SourceSetupPanel
          profile={profile}
          stores={sourceResult.stores}
          databaseReady={
            !profileResult.isMissingTable && !sourceResult.isMissingTable
          }
          canWriteSources={hasSupabaseServiceRoleKey()}
          setupMessage={profileResult.errorMessage ?? sourceResult.errorMessage}
        />
      </div>
    </main>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<SourcesFallback />}>
      <SourcesContent />
    </Suspense>
  );
}

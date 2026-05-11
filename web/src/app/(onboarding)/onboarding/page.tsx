import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
} from "@/lib/db/profile-repository";

function OnboardingFallback() {
  return (
    <div className="industrial-panel p-6">
      <p className="font-mono text-xs uppercase text-primary">Faz 1</p>
      <h1 className="mt-3 text-2xl font-semibold">Onboarding hazırlanıyor</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Supabase oturumu ve mevcut profil bilgileri kontrol ediliyor.
      </p>
    </div>
  );
}

async function OnboardingContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profileResult = await getProfileForUser(user.id);

  if (hasCompletedOnboarding(profileResult.profile)) {
    redirect("/dashboard");
  }

  return (
    <OnboardingForm
      profile={profileResult.profile}
      databaseReady={!profileResult.isMissingTable}
      setupMessage={profileResult.errorMessage}
    />
  );
}

export default function OnboardingPage() {
  return (
    <main className="industrial-grid min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-7xl py-10">
        <Suspense fallback={<OnboardingFallback />}>
          <OnboardingContent />
        </Suspense>
      </div>
    </main>
  );
}

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
    <div className="seller-surface p-6">
      <p className="text-sm font-medium text-primary">Onboarding</p>
      <h1 className="mt-3 text-2xl font-semibold">Bilgiler hazırlanıyor</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Oturumunuz ve mevcut işletme bilgileriniz kontrol ediliyor.
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
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-7xl py-10">
        <Suspense fallback={<OnboardingFallback />}>
          <OnboardingContent />
        </Suspense>
      </div>
    </main>
  );
}

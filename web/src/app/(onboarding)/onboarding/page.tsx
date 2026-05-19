import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BulunurLogo } from "@/components/bulunur-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
  hasCompletedSourceSetup,
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
    if (!hasCompletedSourceSetup(profileResult.profile)) {
      redirect("/sources?setup=1");
    }

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
    <main className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="z-40 flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 py-2 backdrop-blur md:px-8">
        <div>
          <BulunurLogo href="/" className="h-12 w-40" />
          <p className="mono-label text-muted-foreground">Onboarding</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LogoutButton variant="outline" size="sm" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-5 py-4">
        <Suspense fallback={<OnboardingFallback />}>
          <OnboardingContent />
        </Suspense>
      </div>
    </main>
  );
}

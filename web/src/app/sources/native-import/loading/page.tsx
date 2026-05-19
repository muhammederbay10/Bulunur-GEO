import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BulunurLogo } from "@/components/bulunur-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { NativeSetupImportRunner } from "@/features/native-import/components/native-setup-import-runner";
import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
} from "@/lib/db/profile-repository";

type NativeImportLoadingSearchParams = {
  url?: string | string[];
};

type NativeImportLoadingPageProps = {
  searchParams?: Promise<NativeImportLoadingSearchParams>;
};

function NativeImportLoadingFallback() {
  return (
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-2xl py-12">
        <section className="seller-surface p-6">
          <p className="text-sm font-medium text-primary">Native import</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Aktarım ekranı hazırlanıyor
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ürün liste bağlantısı okunuyor.
          </p>
        </section>
      </div>
    </main>
  );
}

function getSingleUrl(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function NativeImportLoadingContent({
  searchParams,
}: {
  searchParams?: Promise<NativeImportLoadingSearchParams>;
}) {
  const params = await searchParams;
  const importUrl = getSingleUrl(params?.url).trim();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { profile } = await getProfileForUser(user.id);

  if (!profile || !hasCompletedOnboarding(profile)) {
    redirect("/onboarding");
  }

  if (!importUrl) {
    redirect("/sources?setup=1");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 py-3 backdrop-blur md:px-10">
        <div>
          <BulunurLogo href="/" className="h-12 w-40" />
          <p className="mono-label text-muted-foreground">E-ticaret paneli</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LogoutButton variant="outline" size="sm" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 py-12 md:py-20">
        <NativeSetupImportRunner initialUrl={importUrl} />
      </div>
    </main>
  );
}

export default function NativeImportLoadingPage({
  searchParams,
}: NativeImportLoadingPageProps) {
  return (
    <Suspense fallback={<NativeImportLoadingFallback />}>
      <NativeImportLoadingContent searchParams={searchParams} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { SourceSetupPanel } from "@/features/sources/components/source-setup-panel";
import { getCurrentUser, getProfileForUser } from "@/lib/db/profile-repository";
import { getSourceSetupForUser } from "@/lib/db/source-repository";
import { hasSupabaseElevatedKey } from "@/lib/env/server";

type SourcesSearchParams = {
  setup?: string;
  shopify_connected?: string;
  shopify_sync?: string;
  shopify_error?: string;
  product_count?: string;
  shop?: string;
};

type SourcesPageProps = {
  searchParams?: Promise<SourcesSearchParams>;
};

function SourcesFallback() {
  return (
    <main className="min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-5xl py-10">
        <div className="seller-surface p-6">
          <p className="text-sm font-medium text-primary">Urun kaynagi</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Kaynak durumu hazirlaniyor
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Magaza ve baglanti kayitlariniz guvenli sekilde okunuyor.
          </p>
        </div>
      </div>
    </main>
  );
}

function getShopifyNotice(params?: SourcesSearchParams) {
  if (params?.shopify_error) {
    return {
      kind: "error" as const,
      message:
        "Shopify baglantisi tamamlanamadi. Magaza alan adini ve Shopify uygulama ayarlarini kontrol edip tekrar deneyin.",
    };
  }

  if (params?.shopify_connected === "1" && params.shopify_sync === "failed") {
    return {
      kind: "warning" as const,
      message:
        "Shopify baglantisi kuruldu, ancak urun senkronizasyonu tamamlanamadi. Kaynak kartindan tekrar senkronize edebilirsiniz.",
    };
  }

  if (params?.shopify_connected === "1") {
    const productCount = Number(params.product_count ?? "0");

    return {
      kind: "success" as const,
      message:
        productCount > 0
          ? `Shopify baglantisi kuruldu ve ${productCount} urun iceri alindi.`
          : "Shopify baglantisi kuruldu. Bu magazada senkronize edilecek urun bulunamadi.",
    };
  }

  return undefined;
}

async function SourcesContent({
  searchParams,
}: {
  searchParams?: Promise<SourcesSearchParams>;
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
      canWriteSources={hasSupabaseElevatedKey()}
      setupMessage={profileResult.errorMessage ?? sourceResult.errorMessage}
      setupMode={setupMode}
      shopifyNotice={getShopifyNotice(params)}
    />
  );

  if (!setupMode) {
    return (
      <AppShell
        sources={sourceResult.stores.map((store) => ({
          id: store.id,
          name: store.name,
          sourceType: store.sourceType,
          status: store.status,
          lastSyncAt: store.lastSyncAt ?? undefined,
          updatedAt: store.updatedAt,
        }))}
      >
        {panel}
      </AppShell>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 py-3 backdrop-blur md:px-10">
        <div>
          <p className="text-xl font-semibold text-primary">AI Gorunurluk</p>
          <p className="mono-label text-muted-foreground">E-ticaret paneli</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LogoutButton variant="outline" size="sm" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 py-12 md:py-20">
        {panel}
      </div>
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

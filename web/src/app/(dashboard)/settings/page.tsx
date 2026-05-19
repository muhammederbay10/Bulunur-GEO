import { Suspense } from "react";
import { notFound } from "next/navigation";

import { AccountSettingsPage } from "@/features/settings/components/account-settings-page";
import {
  getCurrentUser,
  getProfileForUser,
} from "@/lib/db/profile-repository";
import { getCatalogDashboardForProfile } from "@/lib/db/product-repository";
import { getSourceSetupForUser } from "@/lib/db/source-repository";

const emptyCatalog = {
  metrics: {
    totalProducts: 0,
    analyzedProducts: 0,
    optimizedProducts: 0,
    waitingProducts: 0,
    lowScoreProducts: 0,
  },
  recentProducts: [],
  attentionProducts: [],
  sources: [],
};

function SettingsFallback() {
  return (
    <section className="seller-surface p-6">
      <p className="mono-label text-primary">Ayarlar</p>
      <h1 className="mt-3 text-2xl font-semibold">Ayarlar hazırlanıyor</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Profil, kaynak ve katalog bilgileri okunuyor.
      </p>
    </section>
  );
}

async function SettingsContent() {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const [profileResult, sourceResult, catalogResult] = await Promise.all([
    getProfileForUser(user.id),
    getSourceSetupForUser(user.id),
    getCatalogDashboardForProfile(user.id),
  ]);
  const catalog = catalogResult.ok ? catalogResult.data : emptyCatalog;
  const errorMessage =
    profileResult.errorMessage ??
    sourceResult.errorMessage ??
    (catalogResult.ok ? undefined : catalogResult.message);

  return (
    <AccountSettingsPage
      profile={profileResult.profile}
      sources={sourceResult.stores}
      catalog={catalog}
      errorMessage={errorMessage}
    />
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent />
    </Suspense>
  );
}

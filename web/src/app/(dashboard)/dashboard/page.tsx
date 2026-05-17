import { Suspense } from "react";

import { CatalogDashboard } from "@/features/dashboard/components/catalog-dashboard";
import { getCatalogDashboardForCurrentUser } from "@/lib/db/product-repository";

function DashboardFallback() {
  return (
    <section className="seller-surface p-6">
      <p className="text-sm font-medium text-primary">
        Katalog kontrol merkezi
      </p>
      <h1 className="mt-3 text-2xl font-semibold">Panel hazırlanıyor</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Katalog ozeti, kaynak durumu ve son ürün hareketleri okunuyor.
      </p>
    </section>
  );
}

async function DashboardContent() {
  const summary = await getCatalogDashboardForCurrentUser();

  return <CatalogDashboard summary={summary} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

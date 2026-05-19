import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ActivityHistoryPage } from "@/features/history/components/activity-history-page";
import { getActivityHistoryForProfile } from "@/lib/db/history-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";

function HistoryFallback() {
  return (
    <section className="seller-surface p-6">
      <p className="mono-label text-primary">Geçmiş</p>
      <h1 className="mt-3 text-2xl font-semibold">Kayıtlar hazırlanıyor</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Analiz, optimizasyon ve yayın hareketleri okunuyor.
      </p>
    </section>
  );
}

async function HistoryContent() {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const result = await getActivityHistoryForProfile(user.id);

  if (!result.ok) {
    return (
      <ActivityHistoryPage
        events={[]}
        summary={{
          totalEvents: 0,
          analysisEvents: 0,
          optimizationEvents: 0,
          publishEvents: 0,
        }}
        errorMessage={result.message}
      />
    );
  }

  return (
    <ActivityHistoryPage
      events={result.data.events}
      summary={result.data.summary}
    />
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryFallback />}>
      <HistoryContent />
    </Suspense>
  );
}

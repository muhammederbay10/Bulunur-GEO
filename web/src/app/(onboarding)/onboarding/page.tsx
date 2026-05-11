import { Store } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function OnboardingPage() {
  return (
    <main className="industrial-grid min-h-screen bg-background p-5">
      <div className="mx-auto max-w-5xl py-10">
        <PhasePlaceholder
          icon={Store}
          title="Onboarding rota temeli"
          description="Faz 1'de bu rota iş profili ve ürün kaynağı seçimi akışına dönüşecek."
          items={[
            "İş profili alanları profil ve mağaza bağlamını oluşturacak.",
            "Kaynak seçimi Shopify veya native içe aktarma kurulumuna ayrılacak.",
            "Kurulumu tamamlanmamış giriş yapmış kullanıcılar panelden önce buraya gelecek.",
            "Bu yer tutucu, özellik geliştirme başlamadan önce rota grupları hazır olsun diye var.",
          ]}
        />
      </div>
    </main>
  );
}

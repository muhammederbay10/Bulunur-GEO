import { History } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function HistoryPage() {
  return (
    <PhasePlaceholder
      icon={History}
      title="Geçmiş sade bir liste olacak"
      description="Kaydedilen analizler, optimizasyon sonuçları, dışa aktarma ve yayınlama aksiyonları burada iş odaklı bilgilerle gösterilecek."
      items={[
        "Geçmiş kayıtları sahip olunan ürün ve mağazaya bağlanmalı.",
        "Kaydedilen optimizasyon sonuçları kalıcı ve yeniden açılabilir olmalı.",
        "Yayın kayıtları dış API hatalarını gizli bilgileri açığa çıkarmadan göstermeli.",
        "Teknik loglar ana listeyi kalabalıklaştırmadan detay ekranlarında kalmalı.",
      ]}
    />
  );
}

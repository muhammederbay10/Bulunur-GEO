import { History } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function HistoryPage() {
  return (
    <PhasePlaceholder
      icon={History}
      title="Geçmiş rota temeli"
      description="Sonraki fazlarda kayıtlı analizler, optimizasyon sonuçları, dışa aktarma aksiyonları, yayın işleri ve geri dönüş kayıtları burada gösterilecek."
      items={[
        "Geçmiş kayıtları sahip olunan ürün ve mağazaya bağlanmalı.",
        "Kayıtlı optimizasyon sonuçları kalıcı ve yeniden yüklenebilir olmalı.",
        "Yayın kayıtları dış API hatalarını gizli bilgileri açığa çıkarmadan göstermeli.",
        "İnceleme aksiyonları onaylanan ve reddedilen alanları kaydetmeli.",
      ]}
    />
  );
}

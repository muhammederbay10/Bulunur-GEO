import { Gauge } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function ProductDetailPage() {
  return (
    <PhasePlaceholder
      icon={Gauge}
      title="Ürün analiz rota temeli"
      description="Faz 7 ve 8'de analiz, eksik bilgi soruları, optimizasyon ve önce/sonra sonuçları bu sayfaya bağlanacak."
      items={[
        "AI işi çalışırken ürün kimliği ve mevcut içerik önizlemesi görünür kalacak.",
        "Analiz çıktısı bilgilendirme amaçlıdır ve ürünü yeniden yazmaz.",
        "Optimizasyon çıktısı, satıcı alanları onaylayana kadar taslak sonuç olarak saklanır.",
        "AI çağrıları sunucudan sunucuya API sözleşmesini izlemelidir.",
      ]}
    />
  );
}

import { Package } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function ProductsPage() {
  return (
    <PhasePlaceholder
      icon={Package}
      title="Ürünler rota temeli"
      description="Faz 6'da Shopify ve native ürünler analiz ve optimizasyon aksiyonlarıyla burada listelenecek."
      items={[
        "Ürün satırları görsel, başlık, kaynak, fiyat, son skor ve sonraki aksiyonu gösterecek.",
        "Filtreler tüm ürünleri, analiz edilmemişleri, düşük skorluları, optimize edilenleri, Shopify ve native kaynakları kapsayacak.",
        "Analiz tüm katalog için değil, yalnızca seçilen ürün için çalışacak.",
        "Ürün verisi sahiplik kontrolü yapan veritabanı sorgularından gelmeli.",
      ]}
    />
  );
}

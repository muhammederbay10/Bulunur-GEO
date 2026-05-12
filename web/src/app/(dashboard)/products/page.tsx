import { Package } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function ProductsPage() {
  return (
    <PhasePlaceholder
      icon={Package}
      title="Ürünler burada listelenecek"
      description="Shopify veya web sitenizden gelen ürünler, satıcının kolayca seçim yapabileceği sade bir listeyle burada görünecek."
      items={[
        "Ürün görseli, başlık, kaynak, fiyat, son skor ve sıradaki aksiyon kolay taranır şekilde gösterilecek.",
        "Filtreler; tüm ürünler, analiz bekleyenler, düşük skorlular, optimize edilenler, Shopify ve web sitesi kaynaklarını kapsayacak.",
        "Analiz tüm katalog için değil, yalnızca seçilen ürün için başlatılacak.",
        "Ürün verisi sahiplik kontrolü yapan veritabanı sorgularından gelecek.",
      ]}
    />
  );
}

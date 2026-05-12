import { Store } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function SourcesPage() {
  return (
    <PhasePlaceholder
      icon={Store}
      title="Ürün kaynağınızı hazırlayın"
      description="Phase 3 başlamadan önce bu sayfa yalnızca temel yönü gösterir: Shopify mağazanızı bağlayın veya web sitenizden ürün ekleyin."
      items={[
        "Shopify akışı satıcıya mağaza bağlantısı gibi görünecek; OAuth, izinler ve token saklama sunucu tarafında kalacak.",
        "Web sitesinden ürün ekleme akışı güvenli, sınırlı ve önce önizlemeli olacak.",
        "WooCommerce şimdilik arayüzde gösterilmeyecek; gelecekteki kapsam olarak kalacak.",
        "Kaynak bağlantı durumu, anlaşılır hata mesajları ve güvenli sonraki aksiyonlar burada yer alacak.",
      ]}
    />
  );
}

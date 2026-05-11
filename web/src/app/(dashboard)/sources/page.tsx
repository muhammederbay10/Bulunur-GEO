import { Store } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function SourcesPage() {
  return (
    <PhasePlaceholder
      icon={Store}
      title="Kaynaklar rota temeli"
      description="Faz 3, 4 ve 5'te bu alan Shopify bağlantısı ve native içe aktarma için kullanılacak."
      items={[
        "Shopify OAuth; mağaza alan adını, state değerini, HMAC'i, izinleri ve token saklamayı doğrulayacak.",
        "Native URL içe aktarma sınırlı, sunucu taraflı, güvenli ve önce önizlemeli olacak.",
        "Takım MVP kapsamını değiştirmedikçe WooCommerce gelecek/opsiyonel kapsamda kalır.",
        "Kaynak bağlantı durumu ve manuel yeniden senkronizasyon burada yer alır.",
      ]}
    />
  );
}

import { Settings } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function SettingsPage() {
  return (
    <PhasePlaceholder
      icon={Settings}
      title="Ayarlar rota temeli"
      description="Ayarlar daha sonra çalışma alanı, entegrasyon, ortam ve hesap kontrollerini barındıracak."
      items={[
        "Gizli bilgiler ve servis tokenları asla tarayıcıya açılmamalı.",
        "Frontend kontrolleri sunucu tarafı yetkilendirme veya RLS yerine geçmez.",
        "Marka adı Bulunur, Starq ve VitrinAI referansları arasında hâlâ netleşmedi.",
        "Gelecekteki takım ve ajans yetkileri henüz tanımlanmadı.",
      ]}
    />
  );
}

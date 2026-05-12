import { Settings } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function SettingsPage() {
  return (
    <PhasePlaceholder
      icon={Settings}
      title="Ayarlar güvenli ve sade kalacak"
      description="Ayarlar daha sonra çalışma alanı, entegrasyon, hesap ve güvenlik kontrollerini satıcı dostu bir dille barındıracak."
      items={[
        "Gizli bilgiler ve servis tokenları asla tarayıcıya açılmamalı.",
        "Frontend kontrolleri sunucu tarafı yetkilendirme veya RLS yerine geçmez.",
        "Marka adı hâlâ netleşmediği için görünür arayüz genel isimlerle ilerlemeli.",
        "Gelecekteki takım ve ajans yetkileri henüz tanımlanmadı.",
      ]}
    />
  );
}

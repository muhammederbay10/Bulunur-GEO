import { Settings } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function SettingsPage() {
  return (
    <PhasePlaceholder
      icon={Settings}
      title="Settings route foundation"
      description="Settings will later hold workspace, integration, environment, and account controls."
      items={[
        "Secrets and service tokens must never be exposed to the browser.",
        "Frontend checks do not replace server-side authorization or RLS.",
        "Brand naming is still unresolved across Bulunur, Starq, and VitrinAI references.",
        "Future team and agency permissions are not defined yet.",
      ]}
    />
  );
}

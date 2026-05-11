import { History } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function HistoryPage() {
  return (
    <PhasePlaceholder
      icon={History}
      title="History route foundation"
      description="Later phases will show saved analyses, optimization results, export actions, publish jobs, and rollback logs."
      items={[
        "History records should link back to the owned product and store.",
        "Saved optimization results should be durable and reloadable.",
        "Publish logs should show external API errors without exposing secrets.",
        "Review actions should record approved and rejected fields.",
      ]}
    />
  );
}

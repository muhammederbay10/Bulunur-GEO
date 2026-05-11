import { Store } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function SourcesPage() {
  return (
    <PhasePlaceholder
      icon={Store}
      title="Sources route foundation"
      description="Phases 3, 4, and 5 will use this area for Shopify connection and native import."
      items={[
        "Shopify OAuth will validate shop domain, state, HMAC, scopes, and token storage.",
        "Native URL import will be bounded, server-side, safe, and preview-first.",
        "WooCommerce remains future or optional unless the team changes MVP scope.",
        "Source connection status and manual resync belong here.",
      ]}
    />
  );
}

import { Gauge } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function ProductDetailPage() {
  return (
    <PhasePlaceholder
      icon={Gauge}
      title="Product analysis route foundation"
      description="Phases 7 and 8 will attach analysis, missing-fact questions, optimization, and before/after results to this page."
      items={[
        "The product identity and current content preview stay visible while AI work runs.",
        "Analysis output is informational and does not rewrite the product.",
        "Optimization output is saved as a draft result until the seller approves fields.",
        "AI calls must follow the server-to-server API contract.",
      ]}
    />
  );
}

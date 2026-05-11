import { Package } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function ProductsPage() {
  return (
    <PhasePlaceholder
      icon={Package}
      title="Products route foundation"
      description="Phase 6 will list Shopify and native products here with analysis and optimization actions."
      items={[
        "Product rows will show image, title, source, price, latest score, and next action.",
        "Filters will cover all, not analyzed, low score, optimized, Shopify, and native.",
        "Analysis will run only for the selected product, not the whole catalog.",
        "Product data must come through ownership-aware database queries.",
      ]}
    />
  );
}

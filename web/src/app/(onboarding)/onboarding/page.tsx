import { Store } from "lucide-react";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function OnboardingPage() {
  return (
    <main className="industrial-grid min-h-screen bg-background p-5">
      <div className="mx-auto max-w-5xl py-10">
        <PhasePlaceholder
          icon={Store}
          title="Onboarding route foundation"
          description="Phase 1 will turn this route into the business profile and source-choice flow."
          items={[
            "Business profile fields will create profile and store context.",
            "Source choice will branch into Shopify or native import setup.",
            "Signed-in users will land here before the dashboard when setup is incomplete.",
            "This placeholder exists so route groups are ready before feature work starts.",
          ]}
        />
      </div>
    </main>
  );
}

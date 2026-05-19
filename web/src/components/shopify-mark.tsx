import { ShopifyLogo } from "@/components/shopify-logo";

export function ShopifyMark() {
  return (
    <div className="landing-hover inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-background/90">
        <ShopifyLogo decorative className="h-8 w-8" />
      </span>
      Shopifya kolay integrasyon
    </div>
  );
}

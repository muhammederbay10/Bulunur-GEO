import Image from "next/image";

import shopifyLogo from "@/app/shopify-logo.png";
import { cn } from "@/lib/utils";

type ShopifyLogoProps = {
  className?: string;
  decorative?: boolean;
  imageClassName?: string;
};

export function ShopifyLogo({
  className,
  decorative = false,
  imageClassName,
}: ShopifyLogoProps) {
  return (
    <span className={cn("flex items-center justify-center", className)}>
      <Image
        src={shopifyLogo}
        alt={decorative ? "" : "Shopify"}
        width={96}
        height={96}
        aria-hidden={decorative}
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </span>
  );
}

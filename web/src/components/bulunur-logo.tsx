import Image from "next/image";
import Link from "next/link";

import bulunurLogo from "@/app/bulunur-logo.png";
import { cn } from "@/lib/utils";

type BulunurLogoProps = {
  ariaLabel?: string;
  className?: string;
  href?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BulunurLogo({
  ariaLabel = "Bulunur ana sayfa",
  className,
  href,
  imageClassName,
  priority = false,
}: BulunurLogoProps) {
  const logo = (
    <Image
      src={bulunurLogo}
      alt="Bulunur"
      width={320}
      height={96}
      className={cn("h-full w-full object-contain object-left", imageClassName)}
      priority={priority}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("flex items-center", className)}
        aria-label={ariaLabel}
      >
        {logo}
      </Link>
    );
  }

  return <div className={cn("flex items-center", className)}>{logo}</div>;
}

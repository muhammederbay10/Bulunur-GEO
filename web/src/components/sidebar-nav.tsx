"use client";

import {
  History,
  LayoutDashboard,
  Package,
  Settings,
  Store,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/products", label: "Urunler", icon: Package },
  { href: "/sources", label: "Kaynaklar", icon: Store },
  { href: "/history", label: "Gecmis", icon: History },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 grid gap-2">
      {navItems.map((item) => {
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition",
              isActive
                ? "border-primary/30 bg-primary/10 text-primary shadow-primary-soft"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-primary",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

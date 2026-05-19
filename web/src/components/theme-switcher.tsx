"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Acik temaya gec" : "Koyu temaya gec";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-primary"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={!mounted}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

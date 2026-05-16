"use client";

import { CheckCircle2, Globe2, Store } from "lucide-react";

import { cn } from "@/lib/utils";

export type SourceChoice = "shopify" | "native";

type SourceChoiceSelectorProps = {
  value: SourceChoice;
  onChange: (value: SourceChoice) => void;
  disabled?: boolean;
};

const options: Array<{
  value: SourceChoice;
  title: string;
  description: string;
  icon: typeof Store;
}> = [
  {
    value: "shopify",
    title: "Shopify",
    description: "Shopify magazanizi baglayin ve urunleri otomatik senkronize edin.",
    icon: Store,
  },
  {
    value: "native",
    title: "Native web sitesi",
    description: "Kendi web siteniz icin URL veya dosya aktarim kaynagi olusturun.",
    icon: Globe2,
  },
];

export function SourceChoiceSelector({
  value,
  onChange,
  disabled = false,
}: SourceChoiceSelectorProps) {
  return (
    <div className="grid gap-3" role="radiogroup" aria-label="Urun kaynagi">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            className={cn(
              "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/10 shadow-primary-soft"
                : "border-border bg-card hover:border-primary/50 hover:bg-muted/40",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
            onClick={() => onChange(option.value)}
          >
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {option.title}
              </span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                {option.description}
              </span>
            </span>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {isSelected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

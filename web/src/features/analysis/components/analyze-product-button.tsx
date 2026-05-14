"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AnalyzeProductApiResponse } from "@/types/analysis";

export function AnalyzeProductButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAnalyze() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/products/${productId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const payload = (await response.json()) as AnalyzeProductApiResponse;

      if (!response.ok || !payload.ok) {
        setErrorMessage(
          payload.ok ? "Analiz baslatilamadi." : payload.message,
        );
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Analiz istegi gonderilemedi. Baglantiyi kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isSubmitting || isPending;

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        className="gap-2"
        disabled={disabled || isBusy}
        onClick={handleAnalyze}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isBusy ? "Analiz yenileniyor" : "Analiz Et"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

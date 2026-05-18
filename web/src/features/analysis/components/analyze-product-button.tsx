"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  AnalyzeProductApiResponse,
  AnalyzeProductStatusApiResponse,
} from "@/types/analysis";

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
  const [isPolling, setIsPolling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPolling) return;

    const startedAt = Date.now();
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/products/${productId}/analyze`, {
          method: "GET",
          cache: "no-store",
        });
        const payload =
          (await response.json()) as AnalyzeProductStatusApiResponse;

        if (!response.ok || !payload.ok) {
          return;
        }

        if (
          payload.analysis?.status === "succeeded" ||
          payload.analysis?.status === "failed"
        ) {
          window.clearInterval(intervalId);
          setIsPolling(false);
          startTransition(() => {
            router.refresh();
          });
          return;
        }

        if (Date.now() - startedAt > 75_000) {
          window.clearInterval(intervalId);
          setIsPolling(false);
          setErrorMessage(
            "Analiz devam ediyor. Birazdan sayfayı yenileyerek sonucu kontrol edin.",
          );
          startTransition(() => {
            router.refresh();
          });
        }
      } catch {
        // Keep polling; transient network errors should not stop the run.
      }
    }, 2_000);

    return () => window.clearInterval(intervalId);
  }, [isPolling, productId, router]);

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
          payload.ok ? "Analiz başlatılamadı." : payload.message,
        );
        return;
      }

      setIsPolling(payload.status === "running");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Analiz isteği gönderilemedi. Bağlantıyı kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isSubmitting || isPending || isPolling;

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
        {isBusy ? "Analiz ediliyor" : "Analiz Et"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

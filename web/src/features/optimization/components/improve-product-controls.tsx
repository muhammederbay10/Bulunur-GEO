"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImproveProductApiResponse } from "@/types/analysis";
import type { UserFactQuestion } from "@/types/ai-contract";

async function requestImprovement(
  productId: string,
  userFacts?: Record<string, string | null>,
) {
  const response = await fetch(`/api/products/${productId}/improve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userFacts ? { userFacts } : {}),
  });
  const payload = (await response.json()) as ImproveProductApiResponse;

  return { response, payload };
}

export function ImproveProductButton({
  productId,
  disabled,
  hasOptimization,
  isOptimizationRunning,
  reviewHref,
}: {
  productId: string;
  disabled?: boolean;
  hasOptimization?: boolean;
  isOptimizationRunning?: boolean;
  reviewHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusy = isSubmitting || isPending;
  const optimizationHref = reviewHref ?? `/products/${productId}/optimization`;

  async function handleImprove() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { response, payload } = await requestImprovement(productId);

      if (!response.ok || !payload.ok) {
        setErrorMessage(
          payload.ok ? "Optimizasyon başlatilamadi." : payload.message,
        );
        return;
      }

      startTransition(() => {
        if (payload.status === "needs_user_input") {
          router.refresh();
          return;
        }

        router.push(optimizationHref);
        router.refresh();
      });
    } catch {
      setErrorMessage(
        "Optimizasyon isteği gönderilemedi. Bağlantıyı kontrol edin.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasOptimization) {
    return (
      <Button asChild className="gap-2">
        <Link href={optimizationHref}>
          <CheckCircle2 className="h-4 w-4" />
          Optimize Edilmis Halini Gor
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <div className="grid gap-3">
      <Button
        type="button"
        className="gap-2"
        disabled={disabled || isBusy || isOptimizationRunning}
        onClick={handleImprove}
      >
        {isBusy || isOptimizationRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <WandSparkles className="h-4 w-4" />
        )}
        {isBusy || isOptimizationRunning ? "Optimizasyon Hazırlanıyor" : "Optimize Et"}
      </Button>
      {isBusy ? <OptimizationLoadingState /> : null}
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function OptimizationLoadingState() {
  const steps = [
    "Ürün içerigi okunuyor",
    "Görünürlük sinyalleri isleniyor",
    "Optimize taslak kaydediliyor",
  ];

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Optimizasyon hazırlanıyor
      </div>
      <div className="mt-3 grid gap-2">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 text-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MissingFactsForm({
  productId,
  questions,
}: {
  productId: string;
  questions: UserFactQuestion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusy = isSubmitting || isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const userFacts: Record<string, string | null> = {};

    for (const question of questions) {
      const value = formData.get(question.field);

      if (typeof value !== "string") continue;

      const trimmedValue = value.trim();

      if (trimmedValue) {
        userFacts[question.field] = trimmedValue;
      }
    }

    try {
      const { response, payload } = await requestImprovement(
        productId,
        userFacts,
      );

      if (!response.ok || !payload.ok) {
        setErrorMessage(
          payload.ok ? "Eksik bilgiler gönderilemedi." : payload.message,
        );
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Bilgiler gönderilemedi. Bağlantıyı kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {questions.map((question) => (
        <div key={question.field} className="grid gap-2">
          <Label htmlFor={`fact-${question.field}`}>{question.question}</Label>
          <Input
            id={`fact-${question.field}`}
            name={question.field}
            placeholder="Biliyorsaniz yazin, bilmiyorsaniz bos birakin"
            disabled={isBusy}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {question.reason}
          </p>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="gap-2" disabled={isBusy}>
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="h-4 w-4" />
          )}
          Bilgilerle Optimize Et
        </Button>
        <p className="text-sm text-muted-foreground">
          Bos birakilan alanlar uydurulmaz.
        </p>
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </form>
  );
}

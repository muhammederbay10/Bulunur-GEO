"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { Loader2, WandSparkles } from "lucide-react";

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
}: {
  productId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusy = isSubmitting || isPending;

  async function handleImprove() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { response, payload } = await requestImprovement(productId);

      if (!response.ok || !payload.ok) {
        setErrorMessage(
          payload.ok ? "Optimizasyon baslatilamadi." : payload.message,
        );
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage(
        "Optimizasyon istegi gonderilemedi. Baglantiyi kontrol edin.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        className="gap-2"
        disabled={disabled || isBusy}
        onClick={handleImprove}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <WandSparkles className="h-4 w-4" />
        )}
        {isBusy ? "Optimizasyon isleniyor" : "Optimize Et"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
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
          payload.ok ? "Eksik bilgiler gonderilemedi." : payload.message,
        );
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Bilgiler gonderilemedi. Baglantiyi kontrol edin.");
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
          Bos birakilan alanlar AI tarafindan uydurulmaz.
        </p>
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </form>
  );
}

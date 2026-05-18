"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  WandSparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ImproveProductApiResponse,
  ImproveProductStatusApiResponse,
} from "@/types/analysis";
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

function useOptimizationPolling({
  productId,
  enabled,
  optimizationHref,
  onDone,
  onTimeout,
}: {
  productId: string;
  enabled: boolean;
  optimizationHref?: string;
  onDone?: () => void;
  onTimeout?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;

    const startedAt = Date.now();
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/products/${productId}/improve`, {
          method: "GET",
          cache: "no-store",
        });
        const payload =
          (await response.json()) as ImproveProductStatusApiResponse;

        if (!response.ok || !payload.ok) {
          return;
        }

        const status = payload.optimization?.status;

        if (payload.workflowStatus === "optimization_running") {
          if (Date.now() - startedAt > 75_000) {
            window.clearInterval(intervalId);
            onTimeout?.();
            onDone?.();
            startTransition(() => {
              router.refresh();
            });
          }
          return;
        }

        if (status === "needs_user_input" || status === "failed") {
          window.clearInterval(intervalId);
          onDone?.();
          startTransition(() => {
            router.refresh();
          });
          return;
        }

        if (
          status === "ready_for_review" ||
          status === "approved" ||
          status === "exported" ||
          status === "published"
        ) {
          window.clearInterval(intervalId);
          onDone?.();
          startTransition(() => {
            if (optimizationHref) {
              router.push(optimizationHref);
            }
            router.refresh();
          });
          return;
        }

        if (Date.now() - startedAt > 4_000) {
          window.clearInterval(intervalId);
          onDone?.();
          startTransition(() => {
            router.refresh();
          });
          return;
        }

        if (Date.now() - startedAt > 75_000) {
          window.clearInterval(intervalId);
          onTimeout?.();
          onDone?.();
          startTransition(() => {
            router.refresh();
          });
        }
      } catch {
        // Keep polling while the background job is still expected to finish.
      }
    }, 2_000);

    return () => window.clearInterval(intervalId);
  }, [enabled, onDone, onTimeout, optimizationHref, productId, router]);
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
  const [isPolling, setIsPolling] = useState(Boolean(isOptimizationRunning));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const optimizationHref = reviewHref ?? `/products/${productId}/optimization`;
  const handleDone = useCallback(() => setIsPolling(false), []);
  const handleTimeout = useCallback(
    () =>
      setErrorMessage(
        "Optimizasyon devam ediyor. Birazdan sayfayı yenileyerek sonucu kontrol edin.",
      ),
    [],
  );

  useOptimizationPolling({
    productId,
    enabled: isPolling || Boolean(isOptimizationRunning),
    optimizationHref,
    onDone: handleDone,
    onTimeout: handleTimeout,
  });

  async function handleImprove() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { response, payload } = await requestImprovement(productId);

      if (!response.ok || !payload.ok) {
        setErrorMessage(
          payload.ok ? "Optimizasyon başlatılamadı." : payload.message,
        );
        return;
      }

      setIsPolling(payload.status === "optimization_running");
      startTransition(() => {
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

  const isBusy = isSubmitting || isPending || isPolling || isOptimizationRunning;

  if (hasOptimization) {
    return (
      <Button asChild className="gap-2">
        <Link href={optimizationHref}>
          <CheckCircle2 className="h-4 w-4" />
          Optimize Edilmiş Halini Gör
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
        disabled={disabled || isBusy}
        onClick={handleImprove}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <WandSparkles className="h-4 w-4" />
        )}
        {isBusy ? "Optimizasyon hazırlanıyor" : "Optimize Et"}
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
    "Ürün içeriği okunuyor",
    "Görünürlük sinyalleri işleniyor",
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
  const optimizationHref = `/products/${productId}/optimization`;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isOpen, setIsOpen] = useState(questions.length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.field] ?? ""
    : "";
  const isLastQuestion = currentIndex === questions.length - 1;
  const progressText = `${Math.min(currentIndex + 1, questions.length)}/${questions.length}`;
  const handleDone = useCallback(() => setIsPolling(false), []);
  const handleTimeout = useCallback(
    () =>
      setErrorMessage(
        "Optimizasyon devam ediyor. Birazdan sayfayı yenileyerek sonucu kontrol edin.",
      ),
    [],
  );

  useOptimizationPolling({
    productId,
    enabled: isPolling,
    optimizationHref,
    onDone: handleDone,
    onTimeout: handleTimeout,
  });

  function updateCurrentAnswer(value: string) {
    if (!currentQuestion) return;
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.field]: value,
    }));
  }

  function goToPreviousQuestion() {
    setErrorMessage(null);
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  function goToNextQuestion() {
    if (!currentQuestion) return;

    if (!currentAnswer.trim()) {
      setErrorMessage("Devam etmek için bu bilgiyi yazın.");
      return;
    }

    setErrorMessage(null);
    setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
  }

  async function submitAllAnswers() {
    if (!currentQuestion) return;

    if (!currentAnswer.trim()) {
      setErrorMessage("Optimizasyonu tamamlamak için bu bilgiyi yazın.");
      return;
    }

    const userFacts: Record<string, string | null> = {};

    for (const question of questions) {
      const answer = answers[question.field]?.trim();
      if (!answer) {
        setErrorMessage("Tüm soruları yanıtladıktan sonra devam edebilirsiniz.");
        setCurrentIndex(questions.indexOf(question));
        return;
      }
      userFacts[question.field] = answer;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

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

      setIsPolling(payload.status === "optimization_running");
      setIsOpen(false);
    } catch {
      setErrorMessage("Bilgiler gönderilemedi. Bağlantıyı kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLastQuestion) {
      void submitAllAnswers();
      return;
    }

    goToNextQuestion();
  }

  const isBusy = isSubmitting || isPolling;

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="gap-2"
          disabled={isBusy}
          onClick={() => setIsOpen(true)}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="h-4 w-4" />
          )}
          Soruları Yanıtla
        </Button>
        <p className="text-sm text-muted-foreground">
          Sorular tek tek alınır; tamamlanınca optimizasyon sayfasına geçersiniz.
        </p>
      </div>
      {isPolling ? <OptimizationLoadingState /> : null}
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
      {isOpen ? (
        <div
          aria-labelledby="missing-fact-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm"
          role="dialog"
        >
          <form
            className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-primary">{progressText}</p>
                <h3
                  id="missing-fact-dialog-title"
                  className="mt-1 text-lg font-semibold"
                >
                  Ürün bilgisini tamamla
                </h3>
              </div>
              <Button
                aria-label="Kapat"
                disabled={isBusy}
                onClick={() => setIsOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-3">
              <Label htmlFor={`fact-${currentQuestion.field}`}>
                {currentQuestion.question}
              </Label>
              <Input
                autoFocus
                disabled={isBusy}
                id={`fact-${currentQuestion.field}`}
                name={currentQuestion.field}
                onChange={(event) => updateCurrentAnswer(event.target.value)}
                placeholder="Kısa ve doğrulanmış bilgiyi yazın"
                value={currentAnswer}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {currentQuestion.reason}
              </p>
            </div>

            {errorMessage ? (
              <p className="mt-4 text-sm text-destructive">{errorMessage}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                className="gap-2"
                disabled={isBusy || currentIndex === 0}
                onClick={goToPreviousQuestion}
                type="button"
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4" />
                Geri
              </Button>
              <Button className="gap-2" disabled={isBusy} type="submit">
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLastQuestion ? (
                  <WandSparkles className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isLastQuestion ? "Optimize Et" : "Sonraki"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

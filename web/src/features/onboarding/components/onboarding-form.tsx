"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Globe2, Store } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOnboardingProfile } from "@/features/onboarding/actions";
import type { OnboardingFormState } from "@/features/onboarding/actions";
import type { UserProfile } from "@/types/profile";

const initialState: OnboardingFormState = { status: "idle" };

type OnboardingFormProps = {
  profile: UserProfile | null;
  databaseReady: boolean;
  setupMessage?: string;
};

const steps = [
  {
    title: "Kimlik",
    note: "Panelde kimin calistigini bilelim.",
  },
  {
    title: "Magaza",
    note: "Isletme baglamini hazirlayalim.",
  },
  {
    title: "Pazar",
    note: "TR odakli analiz ayarini netlestirelim.",
  },
];

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

export function OnboardingForm({
  profile,
  databaseReady,
  setupMessage,
}: OnboardingFormProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [state, formAction, pending] = useActionState(
    saveOnboardingProfile,
    initialState,
  );
  const isLastStep = activeStep === steps.length - 1;
  const isDisabled = !databaseReady || pending || state.status === "success";

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      const timeoutId = window.setTimeout(() => {
        router.replace(state.redirectTo as string);
      }, 650);

      return () => window.clearTimeout(timeoutId);
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <div className="page-enter mx-auto grid max-w-5xl gap-8 lg:grid-cols-[340px_1fr]">
      <aside className="seller-surface p-6 md:p-8">
        <p className="mono-label text-primary">Onboarding</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
          Magazanizi tanimlayalim
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Bu akista yalnizca temel isletme bilgilerini aliyoruz. Urun kaynagi
          secimi sonraki ekranda yapilacak.
        </p>

        <div className="mt-8 grid gap-3">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              className={
                activeStep === index
                  ? "rounded-xl border border-primary bg-primary/10 p-4 text-left"
                  : "rounded-xl border border-border bg-muted/60 p-4 text-left text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              }
              onClick={() => setActiveStep(index)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card font-mono text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-xs leading-5">{step.note}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <form action={formAction} className="seller-surface overflow-hidden p-6 md:p-8">
        <fieldset className="flex min-h-[520px] flex-col" disabled={isDisabled}>
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="mono-label text-primary">
                Adim {activeStep + 1} / {steps.length}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {steps[activeStep].title}
              </h2>
            </div>
            <div className="flex gap-2">
              {steps.map((step, index) => (
                <span
                  key={step.title}
                  className={
                    activeStep === index
                      ? "h-2 w-10 rounded-full bg-primary"
                      : "h-2 w-6 rounded-full bg-muted"
                  }
                />
              ))}
            </div>
          </div>

          {!databaseReady && setupMessage ? (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {setupMessage}
            </div>
          ) : null}

          {state.status === "error" && state.message ? (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {state.message}
            </div>
          ) : null}

          {state.status === "success" && state.message ? (
            <div className="mb-6 rounded-lg border border-primary/50 bg-primary/10 p-4 text-sm text-primary">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <span>{state.message}</span>
              </div>
            </div>
          ) : null}

          <div className="relative flex-1">
            <div
              className={
                activeStep === 0
                  ? "grid gap-5 animate-in fade-in slide-in-from-right-4 duration-300"
                  : "hidden"
              }
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-primary">
                <Store className="h-8 w-8" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">Ad soyad</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  defaultValue={profile?.fullName ?? ""}
                  placeholder="Orn: Ayse Yilmaz"
                />
                <FieldError errors={state.fieldErrors?.fullName} />
              </div>
            </div>

            <div
              className={
                activeStep === 1
                  ? "grid gap-5 animate-in fade-in slide-in-from-right-4 duration-300"
                  : "hidden"
              }
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-primary">
                <Store className="h-8 w-8" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="businessName">Isletme adi</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  autoComplete="organization"
                  defaultValue={profile?.businessName ?? ""}
                  placeholder="Orn: Kuzey Outdoor"
                />
                <FieldError errors={state.fieldErrors?.businessName} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="businessCategory">Isletme kategorisi</Label>
                <Input
                  id="businessCategory"
                  name="businessCategory"
                  defaultValue={profile?.businessCategory ?? ""}
                  placeholder="Orn: Outdoor ekipmanlari"
                />
                <FieldError errors={state.fieldErrors?.businessCategory} />
              </div>
            </div>

            <div
              className={
                activeStep === 2
                  ? "grid gap-5 animate-in fade-in slide-in-from-right-4 duration-300"
                  : "hidden"
              }
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-primary">
                <Globe2 className="h-8 w-8" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="marketFocus">Pazar odagi</Label>
                <Input
                  id="marketFocus"
                  name="marketFocus"
                  defaultValue={profile?.marketFocus ?? "TR"}
                  placeholder="TR"
                />
                <FieldError errors={state.fieldErrors?.marketFocus} />
              </div>
              <div className="rounded-xl border border-border bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                Onboarding bitince dogrudan urun kaynagi ekranina gececeksiniz.
                Shopify veya web sitesi secimini orada yapacaksiniz.
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={activeStep === 0 || isDisabled}
              onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}
            >
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Button>

            {isLastStep ? (
              <Button type="submit" className="gap-2" disabled={isDisabled}>
                {pending || state.status === "success"
                  ? "Kaynak secimine geciliyor..."
                  : "Onboarding'i tamamla"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-2"
                disabled={isDisabled}
                onClick={() =>
                  setActiveStep((step) => Math.min(step + 1, steps.length - 1))
                }
              >
                Devam
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}

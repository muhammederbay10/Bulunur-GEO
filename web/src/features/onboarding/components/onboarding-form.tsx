"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOnboardingProfile, type OnboardingFormState } from "@/features/onboarding/actions";
import {
  saveNativeSource,
  saveShopifySource,
  type NativeSourceFormState,
  type ShopifySourceFormState,
} from "@/features/sources/actions";
import { CompactSourceSetupForm } from "@/features/sources/components/compact-source-setup-form";
import type { SourceChoice } from "@/features/sources/components/source-choice-selector";
import { useInlineSourceSetupRedirect } from "@/features/sources/use-inline-source-setup-redirect";
import type { UserProfile } from "@/types/profile";

const onboardingInitialState: OnboardingFormState = { status: "idle" };
const nativeInitialState: NativeSourceFormState = { status: "idle" };
const shopifyInitialState: ShopifySourceFormState = { status: "idle" };

type OnboardingFormProps = {
  profile: UserProfile | null;
  databaseReady: boolean;
  setupMessage?: string;
};

const steps = [
  {
    title: "Kimlik",
    note: "Panelde kimin çalıştığını bilelim.",
  },
  {
    title: "Mağaza",
    note: "İşletme bilgilerini kaydederiz.",
  },
  {
    title: "Kaynak",
    note: "Shopify veya native site secilir.",
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
  const [activeStep, setActiveStep] = useState(0);
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
  const [businessCategory, setBusinessCategory] = useState(
    profile?.businessCategory ?? "",
  );
  const [sourceChoice, setSourceChoice] = useState<SourceChoice>("shopify");
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(
    saveOnboardingProfile,
    onboardingInitialState,
  );
  const [nativeState, nativeAction, nativePending] = useActionState(
    saveNativeSource,
    nativeInitialState,
  );
  const [shopifyState, shopifyAction, shopifyPending] = useActionState(
    saveShopifySource,
    shopifyInitialState,
  );
  const isDisabled = !databaseReady || onboardingPending;

  useEffect(() => {
    if (onboardingState.status === "success") {
      setActiveStep(2);
    }
  }, [onboardingState.status]);

  useInlineSourceSetupRedirect({ nativeState, shopifyState });

  return (
    <div className="page-enter mx-auto w-full max-w-2xl">
      <section className="seller-surface overflow-hidden p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="mono-label text-primary">
              Adım {activeStep + 1} / {steps.length}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{steps[activeStep].title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {steps[activeStep].note}
            </p>
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

        {activeStep === 0 ? (
          <div className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
              <Store className="h-8 w-8" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Ad soyad</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Orn: Ayşe Yılmaz"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              <FieldError errors={onboardingState.fieldErrors?.fullName} />
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="button" className="gap-2" onClick={() => setActiveStep(1)}>
                Devam
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === 1 ? (
          <form action={onboardingAction} className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <input type="hidden" name="flowMode" value="inline" />
            <input type="hidden" name="fullName" value={fullName} />
            <input type="hidden" name="marketFocus" value="TR" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Mağaza / işletme adi</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  placeholder="Orn: Kuzey Outdoor"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                />
                <FieldError errors={onboardingState.fieldErrors?.businessName} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="businessCategory">Kategori</Label>
                <Input
                  id="businessCategory"
                  name="businessCategory"
                  placeholder="Orn: Outdoor ekipmanlari"
                  value={businessCategory}
                  onChange={(event) => setBusinessCategory(event.target.value)}
                />
                <FieldError errors={onboardingState.fieldErrors?.businessCategory} />
              </div>
            </div>
            <FieldError errors={onboardingState.fieldErrors?.marketFocus} />
            {onboardingState.status === "error" && onboardingState.message ? (
              <p className="text-sm text-destructive">{onboardingState.message}</p>
            ) : null}
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setActiveStep(0)}>
                <ArrowLeft className="h-4 w-4" />
                Geri
              </Button>
              <Button type="submit" className="gap-2" disabled={isDisabled}>
                {onboardingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mağazayı kaydet
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {activeStep === 2 ? (
          <CompactSourceSetupForm
            businessName={businessName}
            nativeAction={nativeAction}
            nativePending={nativePending}
            nativeState={nativeState}
            onBack={() => setActiveStep(1)}
            onSourceChoiceChange={setSourceChoice}
            shopifyAction={shopifyAction}
            shopifyPending={shopifyPending}
            shopifyState={shopifyState}
            sourceChoice={sourceChoice}
          />
        ) : null}
      </section>
    </div>
  );
}

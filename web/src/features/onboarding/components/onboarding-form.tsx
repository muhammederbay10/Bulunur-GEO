"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Globe2, Loader2, Store } from "lucide-react";
import { useRouter } from "next/navigation";

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
    note: "Panelde kimin calistigini bilelim.",
  },
  {
    title: "Magaza",
    note: "Isletme bilgilerini kaydederiz.",
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
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
  const [businessCategory, setBusinessCategory] = useState(
    profile?.businessCategory ?? "",
  );
  const [sourceChoice, setSourceChoice] = useState<"shopify" | "native">("shopify");
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
  const sourcePending = nativePending || shopifyPending;

  useEffect(() => {
    if (onboardingState.status === "success") {
      setActiveStep(2);
    }
  }, [onboardingState.status]);

  useEffect(() => {
    if (shopifyState.status === "success" && shopifyState.connectUrl) {
      const timeoutId = window.setTimeout(() => {
        window.location.assign(shopifyState.connectUrl as string);
      }, 500);

      return () => window.clearTimeout(timeoutId);
    }

    if (nativeState.status === "success") {
      const timeoutId = window.setTimeout(() => {
        router.replace("/dashboard");
      }, 900);

      return () => window.clearTimeout(timeoutId);
    }
  }, [nativeState.status, router, shopifyState.connectUrl, shopifyState.status]);

  return (
    <div className="page-enter mx-auto w-full max-w-2xl">
      <section className="seller-surface overflow-hidden p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="mono-label text-primary">
              Adim {activeStep + 1} / {steps.length}
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
                placeholder="Orn: Ayse Yilmaz"
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
                <Label htmlFor="businessName">Magaza / isletme adi</Label>
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
                Magazayi kaydet
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {activeStep === 2 ? (
          <div className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                Magaza bilgileri kaydedildi. Simdi urun kaynaginizi secin.
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                className={
                  sourceChoice === "shopify"
                    ? "rounded-xl border border-primary bg-primary/10 p-4 text-left"
                    : "rounded-xl border border-border bg-muted/50 p-4 text-left transition hover:border-primary/50"
                }
                onClick={() => setSourceChoice("shopify")}
              >
                <Store className="h-8 w-8 text-primary" />
                <h3 className="mt-3 text-base font-semibold">Shopify</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Shopify magazanizi baglayin ve urunleri senkronize edin.
                </p>
              </button>
              <button
                type="button"
                className={
                  sourceChoice === "native"
                    ? "rounded-xl border border-primary bg-primary/10 p-4 text-left"
                    : "rounded-xl border border-border bg-muted/50 p-4 text-left transition hover:border-primary/50"
                }
                onClick={() => setSourceChoice("native")}
              >
                <Globe2 className="h-8 w-8 text-primary" />
                <h3 className="mt-3 text-base font-semibold">Native web sitesi</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Kendi web siteniz icin URL veya dosya aktarim kaynagi olusturun.
                </p>
              </button>
            </div>

            {sourceChoice === "shopify" ? (
              <form action={shopifyAction} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="shopDomain">Shopify alan adi</Label>
                  <Input id="shopDomain" name="shopDomain" placeholder="magazam.myshopify.com" />
                  <FieldError errors={shopifyState.fieldErrors?.shopDomain} />
                </div>
                {shopifyState.status === "error" && shopifyState.message ? (
                  <p className="text-sm text-destructive">{shopifyState.message}</p>
                ) : null}
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setActiveStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Geri
                  </Button>
                  <Button type="submit" className="gap-2" disabled={sourcePending}>
                    {shopifyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Kaydet ve Shopify&apos;a baglan
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <form action={nativeAction} className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="storeName">Kaynak adi</Label>
                    <Input id="storeName" name="storeName" defaultValue={businessName} />
                    <FieldError errors={nativeState.fieldErrors?.storeName} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="websiteUrl">Web sitesi URL</Label>
                    <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://magazam.com" />
                    <FieldError errors={nativeState.fieldErrors?.websiteUrl} />
                  </div>
                </div>
                {nativeState.status === "error" && nativeState.message ? (
                  <p className="text-sm text-destructive">{nativeState.message}</p>
                ) : null}
                {nativeState.status === "success" ? (
                  <p className="text-sm text-primary">{nativeState.message}</p>
                ) : null}
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setActiveStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Geri
                  </Button>
                  <Button type="submit" className="gap-2" disabled={sourcePending}>
                    {nativePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Web sitesi kaynagini kaydet
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

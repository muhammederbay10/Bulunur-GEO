"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Globe2, Loader2, Store } from "lucide-react";
import Link from "next/link";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const onboardingInitialState: OnboardingFormState = { status: "idle" };
const nativeInitialState: NativeSourceFormState = { status: "idle" };
const shopifyInitialState: ShopifySourceFormState = { status: "idle" };

const steps = [
  {
    title: "Hesap",
    note: "Oturumunuz otomatik acilir.",
  },
  {
    title: "Magaza",
    note: "Isletme bilgilerini kaydederiz.",
  },
  {
    title: "Kaynak",
    note: "Shopify veya web sitesi secilir.",
  },
];

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [sourceChoice, setSourceChoice] = useState<"shopify" | "native">("shopify");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
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

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignupError(null);
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName.trim().length < 2) {
      setSignupError("Ad soyad en az 2 karakter olmali.");
      return;
    }

    if (password !== repeatPassword) {
      setSignupError("Sifreler eslesmiyor.");
      return;
    }

    setIsSigningUp(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (!data.session) {
        setSignupError(
          "Hesap olustu ama oturum otomatik acilmadi. Supabase email verification ayarini kontrol edin.",
        );
        return;
      }

      setActiveStep(1);
      router.refresh();
    } catch (error: unknown) {
      setSignupError(error instanceof Error ? error.message : "Bir hata olustu.");
    } finally {
      setIsSigningUp(false);
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-2xl", className)} {...props}>
      <section className="seller-surface overflow-hidden p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="mono-label text-primary">
              Adim {activeStep + 1} / {steps.length}
            </p>
            <h1 className="mt-1 text-xl font-semibold">{steps[activeStep].title}</h1>
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

        {activeStep === 0 ? (
          <form
            onSubmit={handleSignUp}
            className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300"
          >
            <div>
              <h2 className="text-xl font-semibold">Kisisel bilgilerinizi girin</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Hesabiniz ve satici paneliniz icin temel bilgileri aliyoruz.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                  <Label htmlFor="firstName">Ad</Label>
                <Input
                    id="firstName"
                    autoComplete="given-name"
                    placeholder="Ayse"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                  <Label htmlFor="lastName">Soyad</Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    placeholder="Yilmaz"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@magazam.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="password">Sifre</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeatPassword">Sifre tekrar</Label>
                  <Input
                    id="repeatPassword"
                    type="password"
                    autoComplete="new-password"
                    value={repeatPassword}
                    onChange={(event) => setRepeatPassword(event.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            {signupError ? <p className="text-sm text-destructive">{signupError}</p> : null}
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" className="gap-2" disabled={isSigningUp}>
                {isSigningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Hesabi olustur
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {activeStep === 1 ? (
          <form action={onboardingAction} className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <input type="hidden" name="flowMode" value="inline" />
            <input type="hidden" name="fullName" value={`${firstName} ${lastName}`.trim()} />
            <input type="hidden" name="marketFocus" value="TR" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Magaza / isletme adi</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  placeholder="Kuzey Outdoor"
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
                  placeholder="Outdoor ekipmanlari"
                  value={businessCategory}
                  onChange={(event) => setBusinessCategory(event.target.value)}
                />
                <FieldError errors={onboardingState.fieldErrors?.businessCategory} />
              </div>
            </div>
            <FieldError errors={onboardingState.fieldErrors?.fullName} />
            <FieldError errors={onboardingState.fieldErrors?.marketFocus} />
            {onboardingState.status === "error" && onboardingState.message ? (
              <p className="text-sm text-destructive">{onboardingState.message}</p>
            ) : null}
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setActiveStep(0)}>
                <ArrowLeft className="h-4 w-4" />
                Geri
              </Button>
              <Button type="submit" className="gap-2" disabled={onboardingPending}>
                {onboardingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Magazayi kaydet
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {activeStep === 2 ? (
          <div className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {onboardingState.status === "success" ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5" />
                  Magaza bilgileri kaydedildi. Simdi urun kaynaginizi secin.
                </div>
              </div>
            ) : null}

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

        <div className="mt-5 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Zaten hesabin var mi?{" "}
          <Button asChild variant="link" className="h-auto px-1 py-0 align-baseline">
            <Link href="/auth/login">Giris yap</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

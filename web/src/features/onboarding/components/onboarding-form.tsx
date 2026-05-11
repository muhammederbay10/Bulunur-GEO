"use client";

import { useActionState, useEffect } from "react";
import { ArrowRight, Database, Globe2, Store } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOnboardingProfile } from "@/features/onboarding/actions";
import type { OnboardingFormState } from "@/features/onboarding/actions";
import { cn } from "@/lib/utils";
import type { ProductSourcePreference, UserProfile } from "@/types/profile";

const initialState: OnboardingFormState = { status: "idle" };

type OnboardingFormProps = {
  profile: UserProfile | null;
  databaseReady: boolean;
  setupMessage?: string;
};

const sourceOptions: Array<{
  value: ProductSourcePreference;
  label: string;
  description: string;
}> = [
  {
    value: "shopify",
    label: "Shopify",
    description:
      "Faz 4'te OAuth bağlantısı ve ürün senkronizasyonu bu seçimden devam edecek.",
  },
  {
    value: "native",
    label: "Native içe aktarma",
    description:
      "Faz 5'te URL, CSV veya manuel/demo içe aktarma akışı bu seçimden devam edecek.",
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
  const [state, formAction, pending] = useActionState(
    saveOnboardingProfile,
    initialState,
  );
  const selectedSource = profile?.preferredProductSource ?? "shopify";

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form action={formAction} className="industrial-panel p-6">
        <fieldset
          className="space-y-6"
          disabled={!databaseReady || pending || state.status === "success"}
        >
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase text-primary">
              Faz 1 / Onboarding
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">
              İşletme bağlamını oluştur
            </h1>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              Bu bilgiler ürün kaynağı, analiz ve optimizasyon akışında mağaza
              bağlamını oluşturmak için kullanılacak. Yayınlama veya ürün
              değişikliği yapılmaz.
            </p>
          </div>

          {!databaseReady && setupMessage ? (
            <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {setupMessage}
            </div>
          ) : null}

          {state.status === "error" && state.message ? (
            <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {state.message}
            </div>
          ) : null}

          {state.status === "success" && state.message ? (
            <div className="border border-primary/50 bg-primary/10 p-4 text-sm text-primary">
              {state.message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Ad soyad</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                defaultValue={profile?.fullName ?? ""}
                placeholder="Örn: Ayşe Yılmaz"
                required
              />
              <FieldError errors={state.fieldErrors?.fullName} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="businessName">İşletme adı</Label>
              <Input
                id="businessName"
                name="businessName"
                autoComplete="organization"
                defaultValue={profile?.businessName ?? ""}
                placeholder="Örn: Kuzey Outdoor"
                required
              />
              <FieldError errors={state.fieldErrors?.businessName} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="businessCategory">İşletme kategorisi</Label>
              <Input
                id="businessCategory"
                name="businessCategory"
                defaultValue={profile?.businessCategory ?? ""}
                placeholder="Örn: Outdoor ekipmanları"
                required
              />
              <FieldError errors={state.fieldErrors?.businessCategory} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="marketFocus">Pazar odağı</Label>
              <Input
                id="marketFocus"
                name="marketFocus"
                defaultValue={profile?.marketFocus ?? "TR"}
                placeholder="TR"
                required
              />
              <FieldError errors={state.fieldErrors?.marketFocus} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              defaultValue={profile?.websiteUrl ?? ""}
              placeholder="https://magazam.com"
            />
            <p className="text-sm text-muted-foreground">
              Opsiyonel. Native içe aktarma veya marka bağlamı için kullanılacak.
            </p>
            <FieldError errors={state.fieldErrors?.websiteUrl} />
          </div>

          <div className="space-y-3">
            <Label>Ürün kaynağı</Label>
            <div className="grid gap-3 md:grid-cols-2">
              {sourceOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer gap-3 border border-border bg-background/40 p-4 transition hover:border-primary/60",
                    "has-[:checked]:border-primary has-[:checked]:bg-primary/10",
                  )}
                >
                  <input
                    type="radio"
                    name="preferredProductSource"
                    value={option.value}
                    defaultChecked={selectedSource === option.value}
                    className="mt-1 h-4 w-4 accent-primary"
                    required
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError errors={state.fieldErrors?.preferredProductSource} />
          </div>

          <Button type="submit" className="w-full md:w-auto">
            {pending || state.status === "success"
              ? "Panele yönlendiriliyor..."
              : "Onboarding'i tamamla"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </fieldset>
      </form>

      <aside className="space-y-4">
        <div className="industrial-panel p-5">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Sonraki adım</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Bu faz yalnızca profil ve kaynak tercihini kaydeder. Shopify
            bağlantısı, native içe aktarma ve ürün tabloları sonraki fazlarda
            eklenecek.
          </p>
        </div>

        <div className="industrial-panel p-5">
          <Globe2 className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Türkçe varsayılan</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Satıcıya görünen ana arayüz Türkçe ilerler. Kod, API alanları ve dış
            platform terimleri gerektiğinde İngilizce kalabilir.
          </p>
        </div>

        <div className="industrial-panel p-5">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Manuel SQL akışı</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Veritabanı değişiklikleri uygulama tarafından otomatik çalıştırılmaz.
            SQL dosyası Supabase SQL Editor&apos;de manuel çalıştırılmalı.
          </p>
        </div>
      </aside>
    </div>
  );
}

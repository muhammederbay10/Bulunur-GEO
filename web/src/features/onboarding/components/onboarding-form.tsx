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
    label: "Shopify Mağazamı Bağla",
    description:
      "Mağazanızdaki ürünleri otomatik senkronize etmeye hazırlanır.",
  },
  {
    value: "native",
    label: "Web Sitemden Ürün Ekle",
    description:
      "Shopify kullanmıyorsanız ürünlerinizi bağlantı veya dosya ile eklemeye hazırlanır.",
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
      <form action={formAction} className="seller-surface p-6">
        <fieldset
          className="flex flex-col gap-6"
          disabled={!databaseReady || pending || state.status === "success"}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-primary">
              İşletmenizi tanıyalım
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">
              Mağazanıza uygun bir başlangıç hazırlayalım
            </h1>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              Bu bilgiler, ürün analizlerini işletmenize daha uygun hale
              getirmek için kullanılır. Bu adımda ürünlerinizde veya
              mağazanızda hiçbir değişiklik yapılmaz.
            </p>
          </div>

          {!databaseReady && setupMessage ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {setupMessage}
            </div>
          ) : null}

          {state.status === "error" && state.message ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {state.message}
            </div>
          ) : null}

          {state.status === "success" && state.message ? (
            <div className="rounded-md border border-primary/50 bg-primary/10 p-4 text-sm text-primary">
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
              Opsiyonel. Web siteniz varsa ürün ve marka bağlamını daha doğru
              hazırlamaya yardımcı olur.
            </p>
            <FieldError errors={state.fieldErrors?.websiteUrl} />
          </div>

          <div className="flex flex-col gap-3">
            <Label>Ürünleriniz nereden gelecek?</Label>
            <div className="grid gap-3 md:grid-cols-2">
              {sourceOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-md border border-border bg-background/70 p-4 transition hover:border-primary/60",
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

      <aside className="flex flex-col gap-4">
        <div className="seller-surface p-5">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Sonraki adım</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Profiliniz kaydedildikten sonra ürün kaynağınızı hazırlamaya
            geçeceğiz: Shopify mağazası veya web sitenizden ürün ekleme.
          </p>
        </div>

        <div className="seller-surface p-5">
          <Globe2 className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Türkçe ve anlaşılır</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Satıcıya görünen ana arayüz Türkçe ilerler. Teknik terimler yalnızca
            gerekli olduğunda ve açıklanarak kullanılır.
          </p>
        </div>

        <div className="seller-surface p-5">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Kontrol sizde</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            AI önerileri daha sonraki fazlarda gösterilecek. Siz onaylamadan
            ürün içeriği yayınlanmaz veya mağazanıza uygulanmaz.
          </p>
        </div>
      </aside>
    </div>
  );
}

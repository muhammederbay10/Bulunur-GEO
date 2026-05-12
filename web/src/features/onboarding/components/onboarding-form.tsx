"use client";

import { useActionState, useEffect } from "react";
import { ArrowRight, CheckCircle2, Globe2, Store } from "lucide-react";
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

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      const timeoutId = window.setTimeout(() => {
        router.replace(state.redirectTo as string);
      }, 650);

      return () => window.clearTimeout(timeoutId);
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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
              Sadece temel bilgileri alalım
            </h1>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              Ürün kaynağınızı bir sonraki adımda seçeceksiniz. Bu ekranda
              yalnızca işletme bağlamını hazırlıyoruz; ürünlerinizde veya
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
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <span>{state.message}</span>
              </div>
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

          <Button type="submit" className="w-full gap-2 md:w-auto">
            {pending || state.status === "success"
              ? "Kaynak seçimine geçiliyor..."
              : "Onboarding'i tamamla"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </fieldset>
      </form>

      <aside className="flex flex-col gap-4">
        <div className="seller-surface p-5">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Sonraki adım net</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Onboarding bitince doğrudan ürün kaynağı ekranına geçeceksiniz.
            Shopify veya web sitesi seçimini orada yapacaksınız.
          </p>
        </div>

        <div className="seller-surface p-5">
          <Globe2 className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Daha az karar</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Website adresi ve kaynak tercihi bu ekrandan kaldırıldı. Bu bilgiler
            yalnızca gerçekten kullanacağınız kaynak adımında istenecek.
          </p>
        </div>
      </aside>
    </div>
  );
}

import { CheckCircle2, Globe2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NativeSourceFormState } from "@/features/sources/actions";
import type { UserProfile } from "@/types/profile";
import type { SourceStore } from "@/types/source";

import { FeedbackMessage, FieldError } from "./source-setup-feedback";

type NativeSourceFormProps = {
  action: (formData: FormData) => void;
  disabled: boolean;
  pending: boolean;
  profile: UserProfile;
  state: NativeSourceFormState;
  store?: SourceStore;
};

export function NativeSourceForm({
  action,
  disabled,
  pending,
  profile,
  state,
  store,
}: NativeSourceFormProps) {
  return (
    <form
      action={action}
      className="seller-surface group relative overflow-hidden p-8 text-center transition hover:border-primary/60 hover:shadow-primary-soft focus-within:border-primary/60"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/80 to-transparent opacity-0 transition group-hover:opacity-100" />
      <fieldset className="flex flex-col gap-5" disabled={disabled || pending}>
        <div className="relative flex flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-primary transition group-hover:scale-105">
            <Globe2 className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Web Sitemden Urun Ekle</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Shopify kullanmiyorsaniz web siteniz icin bir urun kaynagi
              olusturun. URL, dosya veya manuel aktarim sonraki adimda ayni
              kaynaga yazilir.
            </p>
          </div>
        </div>

        <div className="relative grid gap-2 text-left">
          <Label htmlFor="storeName">Kaynak adi</Label>
          <Input
            id="storeName"
            name="storeName"
            defaultValue={store?.name ?? profile.businessName ?? "Magazam"}
            placeholder="Orn: Kuzey Outdoor"
          />
          <FieldError errors={state.fieldErrors?.storeName} />
        </div>

        <div className="relative grid gap-2 text-left">
          <Label htmlFor="websiteUrl">Web sitesi URL</Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            defaultValue={store?.websiteUrl ?? profile.websiteUrl ?? ""}
            placeholder="https://magazam.com"
          />
          <FieldError errors={state.fieldErrors?.websiteUrl} />
        </div>

        <div className="relative">
          <FeedbackMessage status={state.status} message={state.message} />
        </div>

        <Button
          type="submit"
          className="relative w-full gap-2"
          disabled={disabled || pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Web sitesi kaynagini kaydet
        </Button>
      </fieldset>
    </form>
  );
}

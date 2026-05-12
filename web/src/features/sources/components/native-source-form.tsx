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
    <form action={action} className="seller-surface p-5">
      <fieldset className="flex flex-col gap-5" disabled={disabled || pending}>
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Web Sitemden Ürün Ekle</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Shopify kullanmıyorsanız web siteniz için bir ürün kaynağı
              oluşturun. URL/dosya ile içe aktarma sonraki adımlarda eklenecek.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="storeName">Kaynak adı</Label>
          <Input
            id="storeName"
            name="storeName"
            defaultValue={store?.name ?? profile.businessName ?? "Mağazam"}
            placeholder="Örn: Kuzey Outdoor"
          />
          <FieldError errors={state.fieldErrors?.storeName} />
        </div>

        <div className="grid gap-2">
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

        <FeedbackMessage status={state.status} message={state.message} />

        <Button type="submit" className="w-full gap-2" disabled={disabled || pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Web sitesi kaynağını kaydet
        </Button>
      </fieldset>
    </form>
  );
}

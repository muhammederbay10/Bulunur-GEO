import { ExternalLink, Loader2, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShopifySourceFormState } from "@/features/sources/actions";
import type { SourceStore } from "@/types/source";

import { FeedbackMessage, FieldError } from "./source-setup-feedback";

type ShopifySourceFormProps = {
  action: (formData: FormData) => void;
  disabled: boolean;
  pending: boolean;
  state: ShopifySourceFormState;
  store?: SourceStore;
};

export function ShopifySourceForm({
  action,
  disabled,
  pending,
  state,
  store,
}: ShopifySourceFormProps) {
  return (
    <form action={action} className="seller-surface p-5">
      <fieldset className="flex flex-col gap-5" disabled={disabled || pending}>
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Shopify Mağazamı Bağla</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Mağazanızdaki ürünleri otomatik senkronize etmek için Shopify
              alan adınızı şimdiden hazırlayın.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="shopDomain">Shopify alan adı</Label>
          <Input
            id="shopDomain"
            name="shopDomain"
            defaultValue={store?.connection?.shopDomain ?? ""}
            placeholder="magazam.myshopify.com"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Sadece mağaza alan adı kaydedilir. Shopify bağlantısı sonraki
            adımda başlatılacak.
          </p>
          <FieldError errors={state.fieldErrors?.shopDomain} />
        </div>

        <FeedbackMessage status={state.status} message={state.message} />

        <Button type="submit" className="w-full gap-2" disabled={disabled || pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          Shopify hazırlığını kaydet
        </Button>
      </fieldset>
    </form>
  );
}

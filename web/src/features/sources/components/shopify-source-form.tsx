import { CheckCircle2, ExternalLink, Loader2, Store } from "lucide-react";

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
  const shopDomain = store?.connection?.shopDomain;
  const canStartOAuth =
    Boolean(shopDomain) &&
    store?.connection?.status !== "connected" &&
    store?.connection?.status !== "disconnected";
  const isConnected = store?.connection?.status === "connected";

  return (
    <form action={action} className="seller-surface p-5">
      <fieldset className="flex flex-col gap-5" disabled={disabled || pending}>
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Shopify Magazami Bagla</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Shopify urunlerinizi otomatik iceri almak icin myshopify.com
              alan adinizi girin ve yetki ekranini tamamlayin.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="shopDomain">Shopify alan adi</Label>
          <Input
            id="shopDomain"
            name="shopDomain"
            defaultValue={shopDomain ?? ""}
            placeholder="magazam.myshopify.com"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Ozel alan adiniz olsa bile Shopify OAuth icin myshopify.com alan
            adi gerekir.
          </p>
          <FieldError errors={state.fieldErrors?.shopDomain} />
        </div>

        <FeedbackMessage status={state.status} message={state.message} />

        {canStartOAuth ? (
          <Button asChild className="w-full gap-2" variant="outline">
            <a href={`/api/shopify/connect?shop=${encodeURIComponent(shopDomain as string)}`}>
              <ExternalLink className="h-4 w-4" />
              Shopify yetkisini tamamla
            </a>
          </Button>
        ) : null}

        <Button type="submit" className="w-full gap-2" disabled={disabled || pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isConnected ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          {isConnected ? "Shopify alan adini guncelle" : "Kaydet ve Shopify'a baglan"}
        </Button>
      </fieldset>
    </form>
  );
}

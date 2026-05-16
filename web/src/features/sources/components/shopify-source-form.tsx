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
    <form
      action={action}
      className="seller-surface group relative overflow-hidden p-8 text-center transition hover:border-primary/60 hover:shadow-primary-soft focus-within:border-primary/60"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/80 to-transparent opacity-0 transition group-hover:opacity-100" />
      <fieldset className="flex flex-col gap-5" disabled={disabled || pending}>
        <div className="relative flex flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-primary transition group-hover:scale-105">
            <Store className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Shopify Magazami Bagla</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Shopify urunlerinizi otomatik iceri almak icin myshopify.com
              alan adinizi girin ve yetki ekranini tamamlayin.
            </p>
          </div>
        </div>

        <div className="relative grid gap-2 text-left">
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

        <div className="relative">
          <FeedbackMessage status={state.status} message={state.message} />
        </div>

        {canStartOAuth ? (
          <Button asChild className="relative w-full gap-2" variant="outline">
            <a href={`/api/shopify/connect?shop=${encodeURIComponent(shopDomain as string)}`}>
              <ExternalLink className="h-4 w-4" />
              Shopify yetkisini tamamla
            </a>
          </Button>
        ) : null}

        <Button
          type="submit"
          className="relative w-full gap-2"
          disabled={disabled || pending}
        >
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

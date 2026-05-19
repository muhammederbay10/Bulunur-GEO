import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

import { ShopifyLogo } from "@/components/shopify-logo";
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
      className="seller-surface group relative overflow-hidden p-5 transition hover:border-primary/60 hover:shadow-primary-soft focus-within:border-primary/60 md:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/80 to-transparent opacity-0 transition group-hover:opacity-100" />
      <fieldset className="flex flex-col gap-5" disabled={disabled || pending}>
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary transition group-hover:scale-105">
            <ShopifyLogo decorative className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Shopify Mağazamı Bağla</h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Shopify ürünlerinizi otomatik içeri almak için myshopify.com
              alan adınızı girin ve yetki ekranını tamamlayın.
            </p>
          </div>
        </div>

        <div className="relative grid gap-2 text-left">
          <Label htmlFor="shopDomain">Shopify alan adı</Label>
          <Input
            id="shopDomain"
            name="shopDomain"
            defaultValue={shopDomain ?? ""}
            placeholder="mağazam.myshopify.com"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Özel alan adınız olsa bile Shopify OAuth için myshopify.com alan
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
          {isConnected ? "Shopify alan adıni güncelle" : "Kaydet ve Shopify'a bağlan"}
        </Button>
      </fieldset>
    </form>
  );
}

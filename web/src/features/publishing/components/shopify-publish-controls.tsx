"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublishProductApiResponse } from "@/types/analysis";
import type { ShopifyPublishableField } from "@/types/shopify";

type PublishableFieldCandidate = {
  field: ShopifyPublishableField;
  label: string;
  value: string | string[] | null;
  before?: string | string[] | null;
};

function formatValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.join(", ");

  return value ?? "Bos";
}

export function ShopifyPublishControls({
  productId,
  fields,
}: {
  productId: string;
  fields: PublishableFieldCandidate[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPublished, setHasPublished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isBusy = isSubmitting || isPending;

  async function publishToShopify() {
    setMessage(null);
    setHasPublished(false);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/products/${productId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvedFields: fields.map((field) => field.field),
        }),
      });
      const payload = (await response.json()) as PublishProductApiResponse;

      if (!response.ok || !payload.ok) {
        setMessage(payload.ok ? "Yayinlama basarisiz." : payload.message);
        return;
      }

      setHasPublished(true);
      setMessage("Shopify'a basariyla yayinlandi.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Yayinlama istegi gonderilemedi. Baglantiyi kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
        Shopify icin yayinlanabilir guvenli alan bulunamadi.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-md border border-border bg-background/70 p-3">
        <p className="text-sm font-semibold">Yayinlanacak guvenli alanlar</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fields.length} alan onayla birlikte Shopify&apos;a gonderilecek.
        </p>
      </div>

      <div className="grid gap-3">
        {fields.map((field) => (
          <div
            key={field.field}
            className="grid gap-3 rounded-lg border border-border bg-background/70 p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{field.label}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    Onay kapsaminda
                  </span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="mono-label text-muted-foreground">Once</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {formatValue(field.before)}
                    </p>
                  </div>
                  <div>
                    <p className="mono-label text-primary">Sonra</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                      {formatValue(field.value)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-md border border-primary/30 bg-primary/10 p-4">
        {isBusy ? (
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
              <p className="text-sm font-semibold">Shopify&apos;a yayinlaniyor</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Onaylanan guvenli alanlar Shopify&apos;a gonderiliyor.
              </p>
            </div>
          </div>
        ) : hasPublished ? (
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Basariyla yayinlandi</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Shopify guncellemesi dogru sekilde tamamlandi.
              </p>
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          className="gap-2"
          onClick={publishToShopify}
          disabled={isBusy}
        >
          <Send className="h-4 w-4" />
          Onayla ve Shopify&apos;a Yayinla
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <p className="text-sm leading-6 text-muted-foreground">
        Fiyat, stok, SKU, varyant, kargo, vergi, koleksiyon ve medya alanlari
        bu MVP&apos;de degistirilmez.
      </p>
    </div>
  );
}

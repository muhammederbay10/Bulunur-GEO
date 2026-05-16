"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Copy, Download, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

function buildExportPayload(fields: PublishableFieldCandidate[]) {
  return fields.reduce<Record<string, string | string[] | null>>(
    (payload, field) => {
      payload[field.field] = field.value;
      return payload;
    },
    {},
  );
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
  const [selectedFields, setSelectedFields] = useState<ShopifyPublishableField[]>(
    () => fields.map((field) => field.field),
  );
  const [message, setMessage] = useState<string | null>(null);
  const selectedFieldSet = useMemo(
    () => new Set(selectedFields),
    [selectedFields],
  );
  const selectedCandidates = fields.filter((field) =>
    selectedFieldSet.has(field.field),
  );
  const isBusy = isSubmitting || isPending;

  function toggleField(field: ShopifyPublishableField) {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  }

  async function copyApprovedJson() {
    const payload = JSON.stringify(buildExportPayload(selectedCandidates), null, 2);

    await navigator.clipboard.writeText(payload);
    setMessage("Onaylanan alanlar kopyalandi.");
  }

  function exportApprovedJson() {
    const payload = JSON.stringify(buildExportPayload(selectedCandidates), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `shopify-approved-fields-${productId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Onaylanan alanlar JSON olarak hazirlandi.");
  }

  async function publishToShopify() {
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/products/${productId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approvedFields: selectedFields }),
      });
      const payload = (await response.json()) as PublishProductApiResponse;

      if (!response.ok || !payload.ok) {
        setMessage(payload.ok ? "Yayinlama basarisiz." : payload.message);
        return;
      }

      setMessage("Onaylanan alanlar Shopify'a yayinlandi.");
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
      <div className="grid gap-3">
        {fields.map((field) => (
          <label
            key={field.field}
            className="grid gap-3 rounded-lg border border-border bg-background/70 p-4 transition hover:bg-muted/70"
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedFieldSet.has(field.field)}
                onCheckedChange={() => toggleField(field.field)}
                disabled={isBusy}
                aria-label={`${field.label} onayi`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{field.label}</p>
                  {selectedFieldSet.has(field.field) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Onayli
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="mono-label text-muted-foreground">
                      Once
                    </p>
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
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={copyApprovedJson}
          disabled={selectedCandidates.length === 0 || isBusy}
        >
          <Copy className="h-4 w-4" />
          JSON Kopyala
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={exportApprovedJson}
          disabled={selectedCandidates.length === 0 || isBusy}
        >
          <Download className="h-4 w-4" />
          JSON Disari Aktar
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={publishToShopify}
          disabled={selectedCandidates.length === 0 || isBusy}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Shopify&apos;a Yayinla
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <p className="text-sm leading-6 text-muted-foreground">
        Yalnizca isaretli alanlar gonderilir. Fiyat, stok, SKU, varyant,
        kargo, vergi, koleksiyon ve medya alanlari bu MVP&apos;de degistirilmez.
      </p>
    </div>
  );
}

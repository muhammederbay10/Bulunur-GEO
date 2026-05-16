"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  NativeSourceFormState,
  ShopifySourceFormState,
} from "@/features/sources/actions";

import { FieldError } from "./source-setup-feedback";
import { SourceChoiceSelector, type SourceChoice } from "./source-choice-selector";

type CompactSourceSetupFormProps = {
  sourceChoice: SourceChoice;
  onSourceChoiceChange: (choice: SourceChoice) => void;
  businessName: string;
  nativeAction: (formData: FormData) => void;
  nativePending: boolean;
  nativeState: NativeSourceFormState;
  shopifyAction: (formData: FormData) => void;
  shopifyPending: boolean;
  shopifyState: ShopifySourceFormState;
  onBack: () => void;
  successNotice?: string;
};

export function CompactSourceSetupForm({
  sourceChoice,
  onSourceChoiceChange,
  businessName,
  nativeAction,
  nativePending,
  nativeState,
  shopifyAction,
  shopifyPending,
  shopifyState,
  onBack,
  successNotice = "Magaza bilgileri kaydedildi. Simdi urun kaynaginizi secin.",
}: CompactSourceSetupFormProps) {
  const sourcePending = nativePending || shopifyPending;

  return (
    <div className="mx-auto grid w-full max-w-lg gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
      {successNotice ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            {successNotice}
          </div>
        </div>
      ) : null}

      <SourceChoiceSelector
        value={sourceChoice}
        onChange={onSourceChoiceChange}
        disabled={sourcePending}
      />

      {sourceChoice === "shopify" ? (
        <form action={shopifyAction} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="shopDomain">Shopify alan adi</Label>
            <Input id="shopDomain" name="shopDomain" placeholder="magazam.myshopify.com" />
            <FieldError errors={shopifyState.fieldErrors?.shopDomain} />
          </div>
          {shopifyState.status === "error" && shopifyState.message ? (
            <p className="text-sm text-destructive">{shopifyState.message}</p>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Button>
            <Button type="submit" className="gap-2" disabled={sourcePending}>
              {shopifyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Kaydet ve Shopify&apos;a baglan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      ) : (
        <form action={nativeAction} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="storeName">Kaynak adi</Label>
              <Input id="storeName" name="storeName" defaultValue={businessName} />
              <FieldError errors={nativeState.fieldErrors?.storeName} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="websiteUrl">Web sitesi URL</Label>
              <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://magazam.com" />
              <FieldError errors={nativeState.fieldErrors?.websiteUrl} />
            </div>
          </div>
          {nativeState.status === "error" && nativeState.message ? (
            <p className="text-sm text-destructive">{nativeState.message}</p>
          ) : null}
          {nativeState.status === "success" ? (
            <p className="text-sm text-primary">{nativeState.message}</p>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Button>
            <Button type="submit" className="gap-2" disabled={sourcePending}>
              {nativePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Web sitesi kaynagini kaydet
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

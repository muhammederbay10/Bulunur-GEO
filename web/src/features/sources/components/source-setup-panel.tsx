"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { NativeImportPanel } from "@/features/native-import/components/native-import-panel";
import {
  saveNativeSource,
  saveShopifySource,
  type NativeSourceFormState,
  type ShopifySourceFormState,
} from "@/features/sources/actions";
import { buildNativeImportLoadingPath } from "@/features/sources/native-import-redirect";
import type { UserProfile } from "@/types/profile";
import type { SourceStore } from "@/types/source";

import { NativeSourceForm } from "./native-source-form";
import { SourceChoiceSelector, type SourceChoice } from "./source-choice-selector";
import { ShopifySourceForm } from "./shopify-source-form";
import { SourceSetupSuccess } from "./source-setup-success";
import { SourceStatusList } from "./source-status-list";

type SourceSetupPanelProps = {
  profile: UserProfile;
  stores: SourceStore[];
  databaseReady: boolean;
  canWriteSources: boolean;
  setupMessage?: string;
  setupMode: boolean;
  shopifyNotice?: {
    kind: "success" | "warning" | "error";
    message: string;
  };
};

const nativeInitialState: NativeSourceFormState = { status: "idle" };
const shopifyInitialState: ShopifySourceFormState = { status: "idle" };

export function SourceSetupPanel({
  profile,
  stores,
  databaseReady,
  canWriteSources,
  setupMessage,
  setupMode,
  shopifyNotice,
}: SourceSetupPanelProps) {
  const router = useRouter();
  const [sourceChoice, setSourceChoice] = useState<SourceChoice>(() =>
    stores.some((store) => store.sourceType === "native") &&
    !stores.some((store) => store.sourceType === "shopify")
      ? "native"
      : "shopify",
  );
  const [nativeState, nativeAction, nativePending] = useActionState(
    saveNativeSource,
    nativeInitialState,
  );
  const [shopifyState, shopifyAction, shopifyPending] = useActionState(
    saveShopifySource,
    shopifyInitialState,
  );
  const formsDisabled = !databaseReady || !canWriteSources;
  const nativeStore = stores.find((store) => store.sourceType === "native");
  const shopifyStore = stores.find((store) => store.sourceType === "shopify");
  const successMessage =
    nativeState.status === "success"
      ? nativeState.message
      : shopifyState.status === "success"
        ? shopifyState.message
        : undefined;

  useEffect(() => {
    if (shopifyState.status === "success" && shopifyState.connectUrl) {
      const timeoutId = window.setTimeout(() => {
        window.location.assign(shopifyState.connectUrl as string);
      }, 500);

      return () => window.clearTimeout(timeoutId);
    }

    if (nativeState.status === "success" && nativeState.importUrl) {
      const timeoutId = window.setTimeout(() => {
        const redirectPath = buildNativeImportLoadingPath(nativeState.importUrl);

        router.replace(redirectPath ?? "/dashboard");
      }, 500);

      return () => window.clearTimeout(timeoutId);
    }

    if (nativeState.status === "success" || shopifyState.status === "success") {
      const timeoutId = window.setTimeout(() => {
        if (setupMode) {
          router.replace("/dashboard");
        } else {
          router.refresh();
        }
      }, setupMode ? 1600 : 900);

      return () => window.clearTimeout(timeoutId);
    }
  }, [
    nativeState.importUrl,
    nativeState.status,
    router,
    setupMode,
    shopifyState.connectUrl,
    shopifyState.status,
  ]);

  if (successMessage) {
    return (
      <SourceSetupSuccess
        message={successMessage}
        setupMode={setupMode}
        redirectLabel={
          shopifyState.status === "success" && shopifyState.connectUrl
            ? "Shopify yetki ekranına yönlendiriliyorsunuz..."
            : nativeState.status === "success"
              ? "Ürünleriniz içeri alınırken bekleme ekranına geçiliyor..."
              : undefined
        }
      />
    );
  }

  const selectedSourceForm =
    sourceChoice === "shopify" ? (
      <ShopifySourceForm
        action={shopifyAction}
        disabled={formsDisabled}
        pending={shopifyPending}
        state={shopifyState}
        store={shopifyStore}
      />
    ) : (
      <NativeSourceForm
        action={nativeAction}
        disabled={formsDisabled}
        pending={nativePending}
        profile={profile}
        state={nativeState}
        store={nativeStore}
      />
    );

  const sourceSelector = (
    <section
      className={
        setupMode ? "mx-auto grid w-full max-w-2xl gap-2" : "grid w-full gap-2"
      }
    >
      <p className="text-sm font-medium text-foreground">
        Bağlantı yöntemini seçin
      </p>
      <SourceChoiceSelector
        value={sourceChoice}
        onChange={setSourceChoice}
        disabled={formsDisabled || nativePending || shopifyPending}
      />
    </section>
  );

  const statusContent = (
    <section className="seller-surface h-full p-4">
      <div className="mb-4 flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Kaynak durumu</h2>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Kayıtlar sunucu tarafında sahiplik kontrolüyle oluşturulur.
          </p>
        </div>
      </div>
      <SourceStatusList stores={stores} />
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="sr-only">Kaynaklar</h1>

      {!databaseReady && setupMessage ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {setupMessage}
        </div>
      ) : null}

      {databaseReady && !canWriteSources ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Kaynak kurulumu şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin
          veya destek ekibine haber verin.
        </div>
      ) : null}

      {shopifyNotice ? (
        <div
          className={
            shopifyNotice.kind === "error"
              ? "rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
              : shopifyNotice.kind === "warning"
                ? "rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground"
                : "rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary"
          }
        >
          {shopifyNotice.message}
        </div>
      ) : null}

      {setupMode ? (
        <section className="mx-auto grid w-full max-w-2xl gap-4">
          {sourceSelector}
          {selectedSourceForm}
        </section>
      ) : null}

      {setupMode ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="mono-label inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary"
          >
            <HelpCircle className="h-5 w-5" />
            Yardıma mı ihtiyacınız var?
          </button>
        </div>
      ) : null}

      {!setupMode ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)] lg:items-stretch">
          <div className="grid h-full gap-4">
            {sourceSelector}
            {selectedSourceForm}
            {nativeStore?.status === "active" ? (
              <NativeImportPanel store={nativeStore} />
            ) : null}
          </div>
          <div className="h-full">{statusContent}</div>
        </div>
      ) : null}
    </div>
  );
}

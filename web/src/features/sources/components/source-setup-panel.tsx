"use client";

import { useActionState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  saveNativeSource,
  saveShopifySource,
  type NativeSourceFormState,
  type ShopifySourceFormState,
} from "@/features/sources/actions";
import type { UserProfile } from "@/types/profile";
import type { SourceStore } from "@/types/source";

import { NativeSourceForm } from "./native-source-form";
import { ShopifySourceForm } from "./shopify-source-form";
import { SourceSetupHeader } from "./source-setup-header";
import { SourceSetupSuccess } from "./source-setup-success";
import { SourceStatusList } from "./source-status-list";

type SourceSetupPanelProps = {
  profile: UserProfile;
  stores: SourceStore[];
  databaseReady: boolean;
  canWriteSources: boolean;
  setupMessage?: string;
  setupMode: boolean;
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
}: SourceSetupPanelProps) {
  const router = useRouter();
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
  }, [nativeState.status, router, setupMode, shopifyState.status]);

  if (successMessage) {
    return (
      <SourceSetupSuccess message={successMessage} setupMode={setupMode} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SourceSetupHeader />

      {!databaseReady && setupMessage ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {setupMessage}
        </div>
      ) : null}

      {databaseReady && !canWriteSources ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Kaynak kurulumu şu anda kullanılamıyor. Lütfen daha sonra tekrar
          deneyin veya destek ekibine haber verin.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <ShopifySourceForm
          action={shopifyAction}
          disabled={formsDisabled}
          pending={shopifyPending}
          state={shopifyState}
          store={shopifyStore}
        />
        <NativeSourceForm
          action={nativeAction}
          disabled={formsDisabled}
          pending={nativePending}
          profile={profile}
          state={nativeState}
          store={nativeStore}
        />
      </section>

      <section className="seller-surface p-5">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Kaynak durumu</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Bu liste yalnızca sizin mağaza/kaynak kayıtlarınızı gösterir.
              Kayıtlar server tarafında sahiplik kontrolüyle oluşturulur.
            </p>
          </div>
        </div>
        <SourceStatusList stores={stores} />
      </section>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type {
  NativeSourceFormState,
  ShopifySourceFormState,
} from "@/features/sources/actions";
import { buildNativeImportLoadingPath } from "@/features/sources/native-import-redirect";

export function useInlineSourceSetupRedirect({
  nativeState,
  shopifyState,
}: {
  nativeState: NativeSourceFormState;
  shopifyState: ShopifySourceFormState;
}) {
  const router = useRouter();

  useEffect(() => {
    if (shopifyState.status === "success" && shopifyState.connectUrl) {
      const timeoutId = window.setTimeout(() => {
        window.location.assign(shopifyState.connectUrl as string);
      }, 500);

      return () => window.clearTimeout(timeoutId);
    }

    if (nativeState.status === "success") {
      const timeoutId = window.setTimeout(() => {
        const redirectPath = buildNativeImportLoadingPath(nativeState.importUrl);

        router.replace(redirectPath ?? "/dashboard");
      }, 900);

      return () => window.clearTimeout(timeoutId);
    }
  }, [
    nativeState.importUrl,
    nativeState.status,
    router,
    shopifyState.connectUrl,
    shopifyState.status,
  ]);
}

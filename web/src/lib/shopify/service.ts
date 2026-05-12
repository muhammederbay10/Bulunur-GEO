import "server-only";

import {
  getOwnedShopifySyncContext,
  getShopifyConnectionSecret,
  markShopifySyncError,
  markShopifySyncStarted,
  markShopifySyncSuccess,
} from "@/lib/db/shopify-repository";
import { upsertShopifyProducts } from "@/lib/db/product-repository";
import { decryptShopifyAccessToken } from "@/lib/shopify/encryption";
import { mapShopifyProductToUpsert } from "@/lib/shopify/product-mapper";
import { fetchShopifyProducts } from "@/lib/shopify/products";
import type {
  ShopifyConnectionStatus,
  ShopifyProductSyncResult,
} from "@/types/shopify";

type ShopifyProductSyncServiceResult =
  | { ok: true; data: ShopifyProductSyncResult }
  | { ok: false; message: string; code: string };

export function getInitialShopifyConnectionStatus(): ShopifyConnectionStatus {
  return "not_connected";
}

function safeSyncError(error: unknown) {
  if (error instanceof Error && error.name === "MissingShopifyConfigError") {
    return {
      code: "missing_shopify_config",
      message: "Shopify sunucu ayarlari eksik.",
    };
  }

  return {
    code: "shopify_sync_failed",
    message: "Shopify urunleri senkronize edilemedi.",
  };
}

export async function syncShopifyProductsForConnection({
  profileId,
  storeId,
}: {
  profileId: string;
  storeId: string;
}): Promise<ShopifyProductSyncServiceResult> {
  let shouldMarkSyncError = true;

  try {
    const contextResult = await getOwnedShopifySyncContext(profileId, storeId);

    if (!contextResult.ok) {
      return {
        ok: false,
        code: contextResult.code ?? "shopify_connection_not_found",
        message: contextResult.message,
      };
    }

    const { store, connection } = contextResult.data;

    if (!connection.shopDomain) {
      return {
        ok: false,
        code: "missing_shop_domain",
        message: "Shopify magaza alan adi bulunamadi.",
      };
    }

    if (
      connection.status !== "connected" &&
      connection.status !== "error"
    ) {
      return {
        ok: false,
        code: "shopify_connection_not_connected",
        message: "Shopify baglantisi aktif degil.",
      };
    }

    const secretResult = await getShopifyConnectionSecret(
      profileId,
      connection.id,
    );

    if (!secretResult.ok) {
      return {
        ok: false,
        code: secretResult.code ?? "missing_shopify_token",
        message: secretResult.message,
      };
    }

    if (!secretResult.data.accessTokenCiphertext) {
      return {
        ok: false,
        code: "missing_shopify_token",
        message: "Shopify erisim anahtari bulunamadi. Yeniden baglan.",
      };
    }

    await markShopifySyncStarted({ profileId, storeId });

    const accessToken = decryptShopifyAccessToken(
      secretResult.data.accessTokenCiphertext,
    );
    const fetchResult = await fetchShopifyProducts({
      shop: connection.shopDomain,
      accessToken,
    });
    const products = fetchResult.products.map((product) =>
      mapShopifyProductToUpsert({
        product,
        profileId,
        storeId,
        language: store.language,
        market: store.market,
      }),
    );
    const upsertResult = await upsertShopifyProducts(products);

    if (!upsertResult.ok) {
      await markShopifySyncError({
        profileId,
        storeId,
        errorCode: upsertResult.code ?? "product_upsert_failed",
        errorMessage: upsertResult.message,
      });

      shouldMarkSyncError = false;

      return {
        ok: false,
        code: upsertResult.code ?? "product_upsert_failed",
        message: upsertResult.message,
      };
    }

    await markShopifySyncSuccess({ profileId, storeId });

    return {
      ok: true,
      data: {
        storeId,
        shopDomain: connection.shopDomain,
        fetchedCount: fetchResult.products.length,
        syncedCount: upsertResult.data.syncedCount,
        hasNextPage: fetchResult.hasNextPage,
        lastCursor: fetchResult.lastCursor,
      },
    };
  } catch (error) {
    const safeError = safeSyncError(error);

    if (shouldMarkSyncError) {
      await markShopifySyncError({
        profileId,
        storeId,
        errorCode: safeError.code,
        errorMessage: safeError.message,
      });
    }

    return {
      ok: false,
      code: safeError.code,
      message: safeError.message,
    };
  }
}

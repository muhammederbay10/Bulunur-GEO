import { NextRequest, NextResponse } from "next/server";

import {
  completeShopifyConnection,
  markShopifyConnectionError,
} from "@/lib/db/shopify-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { encryptShopifyAccessToken } from "@/lib/shopify/encryption";
import { verifyShopifyOAuthHmac } from "@/lib/shopify/hmac";
import {
  assertRequiredScopesGranted,
  exchangeCodeForAccessToken,
} from "@/lib/shopify/oauth";
import { syncShopifyProductsForConnection } from "@/lib/shopify/service";
import {
  SHOPIFY_OAUTH_STATE_COOKIE,
  verifySignedOAuthStateCookie,
  type ShopifyOAuthStatePayload,
} from "@/lib/shopify/state";
import { shopifyOAuthCallbackSchema } from "@/lib/validation/shopify";

function createSourcesRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/sources", request.nextUrl.origin);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

function createProductsRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/products", request.nextUrl.origin);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.delete(SHOPIFY_OAUTH_STATE_COOKIE);

  return response;
}

async function markErrorIfPossible(
  statePayload: ShopifyOAuthStatePayload | null,
  errorCode: string,
  errorMessage: string,
) {
  if (!statePayload) {
    return;
  }

  await markShopifyConnectionError({
    profileId: statePayload.profileId,
    storeId: statePayload.storeId,
    errorCode,
    errorMessage,
  });
}

export async function GET(request: NextRequest) {
  let statePayload: ShopifyOAuthStatePayload | null = null;

  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = shopifyOAuthCallbackSchema.safeParse({
      code: searchParams.get("code"),
      hmac: searchParams.get("hmac"),
      shop: searchParams.get("shop"),
      state: searchParams.get("state"),
      timestamp: searchParams.get("timestamp"),
      host: searchParams.get("host"),
    });

    if (!parsed.success) {
      return clearStateCookie(
        createSourcesRedirect(request, {
          shopify_error: "invalid_callback",
        }),
      );
    }

    const stateCookie = request.cookies.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value;
    statePayload = verifySignedOAuthStateCookie(
      stateCookie,
      parsed.data.state,
      parsed.data.shop,
    );

    if (!statePayload) {
      return clearStateCookie(
        createSourcesRedirect(request, {
          shopify_error: "invalid_state",
        }),
      );
    }

    const user = await getCurrentUser();

    if (!user || user.id !== statePayload.profileId) {
      await markErrorIfPossible(
        statePayload,
        "auth_context_mismatch",
        "Shopify callback oturum bilgisi dogrulanamadi.",
      );

      return clearStateCookie(
        createSourcesRedirect(request, {
          shopify_error: "auth_context_mismatch",
        }),
      );
    }

    if (!verifyShopifyOAuthHmac(searchParams)) {
      await markErrorIfPossible(
        statePayload,
        "invalid_hmac",
        "Shopify callback imzasi dogrulanamadi.",
      );

      return clearStateCookie(
        createSourcesRedirect(request, {
          shopify_error: "invalid_hmac",
        }),
      );
    }

    const token = await exchangeCodeForAccessToken({
      shop: parsed.data.shop,
      code: parsed.data.code,
    });
    assertRequiredScopesGranted(token.scope);

    const result = await completeShopifyConnection({
      profileId: statePayload.profileId,
      storeId: statePayload.storeId,
      shopDomain: parsed.data.shop,
      encryptedAccessToken: encryptShopifyAccessToken(token.accessToken),
      scopes: token.scope
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    });

    if (!result.ok) {
      await markErrorIfPossible(
        statePayload,
        "storage_failed",
        "Shopify baglantisi kaydedilemedi.",
      );

      return clearStateCookie(
        createSourcesRedirect(request, {
          shopify_error: "storage_failed",
        }),
      );
    }

    const syncResult = await syncShopifyProductsForConnection({
      profileId: statePayload.profileId,
      storeId: statePayload.storeId,
    });

    if (!syncResult.ok) {
      return clearStateCookie(
        createProductsRedirect(request, {
          shopify_connected: "1",
          shopify_sync: "failed",
          shop: parsed.data.shop,
        }),
      );
    }

    return clearStateCookie(
      createProductsRedirect(request, {
        shopify_connected: "1",
        shopify_sync: "success",
        product_count: String(syncResult.data.syncedCount),
        shop: parsed.data.shop,
      }),
    );
  } catch {
    await markErrorIfPossible(
      statePayload,
      "callback_failed",
      "Shopify baglantisi tamamlanamadi.",
    );

    return clearStateCookie(
      createSourcesRedirect(request, {
        shopify_error: "callback_failed",
      }),
    );
  }
}

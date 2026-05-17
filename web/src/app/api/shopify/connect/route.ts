import { NextRequest, NextResponse } from "next/server";

import { getOwnedShopifyConnectionByShopDomain } from "@/lib/db/shopify-repository";
import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
  hasCompletedSourceSetup,
} from "@/lib/db/profile-repository";
import { getShopifyConfig, MissingShopifyConfigError } from "@/lib/shopify/config";
import { buildShopifyAuthorizationUrl } from "@/lib/shopify/oauth";
import {
  createOAuthNönce,
  createSignedOAuthStateCookie,
  SHOPIFY_OAUTH_STATE_COOKIE,
} from "@/lib/shopify/state";
import { validateShopDomain } from "@/lib/shopify/validation";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

function redirectToSourcesError(request: NextRequest, code: string) {
  const url = new URL("/sources", request.nextUrl.origin);
  url.searchParams.set("shopify_error", code);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return redirectTo(request, "/auth/login");
  }

  const { profile } = await getProfileForUser(user.id);

  if (!hasCompletedOnboarding(profile)) {
    return redirectTo(request, "/onboarding");
  }

  if (!hasCompletedSourceSetup(profile)) {
    return redirectTo(request, "/sources?setup=1");
  }

  try {
    const config = getShopifyConfig();
    const shop = validateShopDomain(request.nextUrl.searchParams.get("shop"));
    const connection = await getOwnedShopifyConnectionByShopDomain(user.id, shop);

    if (!connection.ok) {
      return redirectToSourcesError(request, "connection_not_found");
    }

    const nönce = createOAuthNönce();
    const signedStateCookie = createSignedOAuthStateCookie({
      nönce,
      shop,
      profileId: user.id,
      storeId: connection.data.storeId,
      returnTo: "/sources",
    });
    const authorizationUrl = buildShopifyAuthorizationUrl({
      shop,
      nönce,
    });
    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, signedStateCookie, {
      httpOnly: true,
      secure: config.appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    if (error instanceof MissingShopifyConfigError) {
      return redirectToSourcesError(request, "missing_config");
    }

    return redirectToSourcesError(request, "connect_failed");
  }
}

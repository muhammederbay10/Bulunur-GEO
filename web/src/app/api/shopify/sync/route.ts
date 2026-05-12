import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/db/profile-repository";
import { syncShopifyProductsForConnection } from "@/lib/shopify/service";
import { shopifyProductSyncSchema } from "@/lib/validation/shopify";

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
      },
      { status: 401 },
    );
  }

  const parsed = shopifyProductSyncSchema.safeParse(
    await readJsonBody(request),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_sync_request",
      },
      { status: 400 },
    );
  }

  const result = await syncShopifyProductsForConnection({
    profileId: user.id,
    storeId: parsed.data.storeId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.code,
        message: result.message,
      },
      { status: result.code === "shopify_connection_not_connected" ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    sync: result.data,
  });
}

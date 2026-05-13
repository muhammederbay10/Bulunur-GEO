import { NextRequest, NextResponse } from "next/server";

import { markShopifyProductsSourceDisconnected } from "@/lib/db/product-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { disconnectShopifyConnection } from "@/lib/db/shopify-repository";
import { shopifyDisconnectSchema } from "@/lib/validation/shopify";

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

  const parsed = shopifyDisconnectSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_disconnect_request",
      },
      { status: 400 },
    );
  }

  const disconnectResult = await disconnectShopifyConnection({
    profileId: user.id,
    storeId: parsed.data.storeId,
  });

  if (!disconnectResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: disconnectResult.code ?? "disconnect_failed",
        message: disconnectResult.message,
      },
      { status: 400 },
    );
  }

  const productResult = await markShopifyProductsSourceDisconnected({
    profileId: user.id,
    storeId: parsed.data.storeId,
  });

  if (!productResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: productResult.code ?? "product_state_failed",
        message: productResult.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    connection: disconnectResult.data,
    products: productResult.data,
  });
}

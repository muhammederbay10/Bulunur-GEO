import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreConnectionStatus, StoreStatus } from "@/types/source";
import type {
  ShopifyConnectionSecret,
  ShopifyConnectionSummary,
} from "@/types/shopify";

type ShopifyStoreRow = {
  id: string;
  profile_id: string;
  source_type: "shopify";
  status: StoreStatus;
  market: string;
  language: string;
  last_sync_at: string | null;
};

type ShopifyConnectionRow = {
  id: string;
  profile_id: string;
  store_id: string;
  platform: "shopify";
  external_shop_id: string | null;
  shop_domain: string | null;
  scopes: string[] | null;
  status: StoreConnectionStatus;
  last_error_code: string | null;
  last_error_message: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

type ShopifyConnectionSecretRow = {
  connection_id: string;
  profile_id: string;
  access_token_ciphertext: string | null;
  token_reference: string | null;
  created_at: string;
  updated_at: string;
};

type ShopifyRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; isMissingTable?: boolean };

type CompleteShopifyConnectionInput = {
  profileId: string;
  storeId: string;
  shopDomain: string;
  encryptedAccessToken: string;
  scopes: string[];
  externalShopId?: string | null;
};

export type ShopifySyncContext = {
  store: {
    id: string;
    profileId: string;
    status: StoreStatus;
    market: string;
    language: string;
    lastSyncAt: string | null;
  };
  connection: ShopifyConnectionSummary;
};

const shopifyConnectionSelect =
  "id,profile_id,store_id,platform,external_shop_id,shop_domain,scopes,status,last_error_code,last_error_message,connected_at,created_at,updated_at";

function shopifyStorageSetupMessage() {
  return "Shopify bağlantı tabloları hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function isMissingShopifyTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("store_connections") ||
    message.includes("store_connection_secrets") ||
    message.includes("stores")
  );
}

function mapConnectionSummary(
  row: ShopifyConnectionRow,
): ShopifyConnectionSummary {
  return {
    id: row.id,
    profileId: row.profile_id,
    storeId: row.store_id,
    shopDomain: row.shop_domain,
    externalShopId: row.external_shop_id,
    scopes: row.scopes ?? [],
    status: row.status,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    connectedAt: row.connected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConnectionSecret(
  row: ShopifyConnectionSecretRow,
): ShopifyConnectionSecret {
  return {
    connectionId: row.connection_id,
    profileId: row.profile_id,
    accessTokenCiphertext: row.access_token_ciphertext,
    tokenReference: row.token_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOwnedShopifyStore(
  profileId: string,
  storeId: string,
): Promise<ShopifyRepositoryResult<ShopifyStoreRow>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id,profile_id,source_type,status,market,language,last_sync_at")
    .eq("profile_id", profileId)
    .eq("id", storeId)
    .eq("source_type", "shopify")
    .single<ShopifyStoreRow>();

  if (error) {
    const isMissingTable = isMissingShopifyTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? shopifyStorageSetupMessage()
        : "Shopify mağazası bulunamadı veya bu kullanıcıya ait değil.",
      code: error.code,
      isMissingTable,
    };
  }

  return { ok: true, data };
}

function mapSyncContext(
  store: ShopifyStoreRow,
  connection: ShopifyConnectionSummary,
): ShopifySyncContext {
  return {
    store: {
      id: store.id,
      profileId: store.profile_id,
      status: store.status,
      market: store.market,
      language: store.language,
      lastSyncAt: store.last_sync_at,
    },
    connection,
  };
}

export async function getOwnedShopifyConnection(
  profileId: string,
  storeId: string,
): Promise<ShopifyRepositoryResult<ShopifyConnectionSummary>> {
  const store = await getOwnedShopifyStore(profileId, storeId);

  if (!store.ok) {
    return store;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_connections")
    .select(shopifyConnectionSelect)
    .eq("profile_id", profileId)
    .eq("store_id", storeId)
    .eq("platform", "shopify")
    .single<ShopifyConnectionRow>();

  if (error) {
    const isMissingTable = isMissingShopifyTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? shopifyStorageSetupMessage()
        : "Shopify bağlantısı bulunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  return { ok: true, data: mapConnectionSummary(data) };
}

export async function getOwnedShopifySyncContext(
  profileId: string,
  storeId: string,
): Promise<ShopifyRepositoryResult<ShopifySyncContext>> {
  const store = await getOwnedShopifyStore(profileId, storeId);

  if (!store.ok) {
    return store;
  }

  const connection = await getOwnedShopifyConnection(profileId, storeId);

  if (!connection.ok) {
    return connection;
  }

  return {
    ok: true,
    data: mapSyncContext(store.data, connection.data),
  };
}

export async function getOwnedShopifyConnectionByShopDomain(
  profileId: string,
  shopDomain: string,
): Promise<ShopifyRepositoryResult<ShopifyConnectionSummary>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_connections")
    .select(shopifyConnectionSelect)
    .eq("profile_id", profileId)
    .eq("platform", "shopify")
    .eq("shop_domain", shopDomain)
    .single<ShopifyConnectionRow>();

  if (error) {
    const isMissingTable = isMissingShopifyTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? shopifyStorageSetupMessage()
        : "Shopify bağlantısı bulunamadı. Önce kaynak ekranında mağazayı hazırla.",
      code: error.code,
      isMissingTable,
    };
  }

  const store = await getOwnedShopifyStore(profileId, data.store_id);

  if (!store.ok) {
    return store;
  }

  return { ok: true, data: mapConnectionSummary(data) };
}

export async function completeShopifyConnection(
  input: CompleteShopifyConnectionInput,
): Promise<ShopifyRepositoryResult<ShopifyConnectionSummary>> {
  const connection = await getOwnedShopifyConnection(
    input.profileId,
    input.storeId,
  );

  if (!connection.ok) {
    return connection;
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: updatedConnection, error: connectionError } = await supabase
    .from("store_connections")
    .update({
      external_shop_id: input.externalShopId ?? null,
      shop_domain: input.shopDomain,
      scopes: input.scopes,
      status: "connected",
      last_error_code: null,
      last_error_message: null,
      connected_at: now,
    })
    .eq("id", connection.data.id)
    .eq("profile_id", input.profileId)
    .select(shopifyConnectionSelect)
    .single<ShopifyConnectionRow>();

  if (connectionError) {
    const isMissingTable = isMissingShopifyTable(connectionError);

    return {
      ok: false,
      message: isMissingTable
        ? shopifyStorageSetupMessage()
        : "Shopify bağlantısı kaydedilemedi.",
      code: connectionError.code,
      isMissingTable,
    };
  }

  const { error: secretError } = await supabase
    .from("store_connection_secrets")
    .upsert(
      {
        connection_id: updatedConnection.id,
        profile_id: input.profileId,
        access_token_ciphertext: input.encryptedAccessToken,
        token_reference: null,
      },
      {
        onConflict: "connection_id",
      },
    );

  if (secretError) {
    const isMissingTable = isMissingShopifyTable(secretError);

    return {
      ok: false,
      message: isMissingTable
        ? shopifyStorageSetupMessage()
        : "Shopify erişim anahtarı güvenli alana kaydedilemedi.",
      code: secretError.code,
      isMissingTable,
    };
  }

  return { ok: true, data: mapConnectionSummary(updatedConnection) };
}

export async function getShopifyConnectionSecret(
  profileId: string,
  connectionId: string,
): Promise<ShopifyRepositoryResult<ShopifyConnectionSecret>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_connection_secrets")
    .select(
      "connection_id,profile_id,access_token_ciphertext,token_reference,created_at,updated_at",
    )
    .eq("profile_id", profileId)
    .eq("connection_id", connectionId)
    .single<ShopifyConnectionSecretRow>();

  if (error) {
    const isMissingTable = isMissingShopifyTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? shopifyStorageSetupMessage()
        : "Shopify erişim anahtarı bulunamadı.",
      code: error.code,
      isMissingTable,
    };
  }

  return { ok: true, data: mapConnectionSecret(data) };
}

export async function markShopifyConnectionError(params: {
  profileId: string;
  storeId: string;
  errorCode: string;
  errorMessage: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("store_connections")
    .update({
      status: "error",
      last_error_code: params.errorCode,
      last_error_message: params.errorMessage,
    })
    .eq("profile_id", params.profileId)
    .eq("store_id", params.storeId)
    .eq("platform", "shopify");

  if (error) {
    console.error("[shopify] failed to mark connection error", {
      code: error.code,
      message: error.message,
    });
  }
}

export async function markShopifySyncStarted(params: {
  profileId: string;
  storeId: string;
}) {
  const supabase = createAdminClient();
  const [storeResult, connectionResult] = await Promise.all([
    supabase
      .from("stores")
      .update({
        status: "syncing",
      })
      .eq("profile_id", params.profileId)
      .eq("id", params.storeId)
      .eq("source_type", "shopify"),
    supabase
      .from("store_connections")
      .update({
        status: "connected",
        last_error_code: null,
        last_error_message: null,
      })
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId)
      .eq("platform", "shopify"),
  ]);

  if (storeResult.error || connectionResult.error) {
    console.error("[shopify] failed to mark sync started", {
      storeCode: storeResult.error?.code,
      storeMessage: storeResult.error?.message,
      connectionCode: connectionResult.error?.code,
      connectionMessage: connectionResult.error?.message,
    });
  }
}

export async function markShopifySyncSuccess(params: {
  profileId: string;
  storeId: string;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const [storeResult, connectionResult] = await Promise.all([
    supabase
      .from("stores")
      .update({
        status: "active",
        last_sync_at: now,
      })
      .eq("profile_id", params.profileId)
      .eq("id", params.storeId)
      .eq("source_type", "shopify"),
    supabase
      .from("store_connections")
      .update({
        status: "connected",
        last_error_code: null,
        last_error_message: null,
      })
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId)
      .eq("platform", "shopify"),
  ]);

  if (storeResult.error || connectionResult.error) {
    console.error("[shopify] failed to mark sync success", {
      storeCode: storeResult.error?.code,
      storeMessage: storeResult.error?.message,
      connectionCode: connectionResult.error?.code,
      connectionMessage: connectionResult.error?.message,
    });
  }
}

export async function markShopifySyncError(params: {
  profileId: string;
  storeId: string;
  errorCode: string;
  errorMessage: string;
}) {
  const supabase = createAdminClient();
  const [storeResult, connectionResult] = await Promise.all([
    supabase
      .from("stores")
      .update({
        status: "error",
      })
      .eq("profile_id", params.profileId)
      .eq("id", params.storeId)
      .eq("source_type", "shopify"),
    supabase
      .from("store_connections")
      .update({
        status: "error",
        last_error_code: params.errorCode,
        last_error_message: params.errorMessage,
      })
      .eq("profile_id", params.profileId)
      .eq("store_id", params.storeId)
      .eq("platform", "shopify"),
  ]);

  if (storeResult.error || connectionResult.error) {
    console.error("[shopify] failed to mark sync error", {
      storeCode: storeResult.error?.code,
      storeMessage: storeResult.error?.message,
      connectionCode: connectionResult.error?.code,
      connectionMessage: connectionResult.error?.message,
    });
  }
}

export async function disconnectShopifyConnection(params: {
  profileId: string;
  storeId: string;
}): Promise<ShopifyRepositoryResult<ShopifyConnectionSummary>> {
  const connection = await getOwnedShopifyConnection(
    params.profileId,
    params.storeId,
  );

  if (!connection.ok) {
    return connection;
  }

  const supabase = createAdminClient();
  const [storeResult, connectionResult, secretResult] = await Promise.all([
    supabase
      .from("stores")
      .update({
        status: "disconnected",
      })
      .eq("profile_id", params.profileId)
      .eq("id", params.storeId)
      .eq("source_type", "shopify"),
    supabase
      .from("store_connections")
      .update({
        status: "disconnected",
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", connection.data.id)
      .eq("profile_id", params.profileId)
      .select(shopifyConnectionSelect)
      .single<ShopifyConnectionRow>(),
    supabase
      .from("store_connection_secrets")
      .update({
        access_token_ciphertext: null,
        token_reference: null,
      })
      .eq("connection_id", connection.data.id)
      .eq("profile_id", params.profileId),
  ]);

  if (storeResult.error) {
    return {
      ok: false,
      message: "Shopify mağazasi bağlantı kesildi olarak işaretlenemedi.",
      code: storeResult.error.code,
      isMissingTable: isMissingShopifyTable(storeResult.error),
    };
  }

  if (connectionResult.error) {
    return {
      ok: false,
      message: "Shopify bağlantısı kesilemedi.",
      code: connectionResult.error.code,
      isMissingTable: isMissingShopifyTable(connectionResult.error),
    };
  }

  if (secretResult.error) {
    return {
      ok: false,
      message: "Shopify erişim anahtarı kaldirilamadi.",
      code: secretResult.error.code,
      isMissingTable: isMissingShopifyTable(secretResult.error),
    };
  }

  return {
    ok: true,
    data: mapConnectionSummary(connectionResult.data),
  };
}

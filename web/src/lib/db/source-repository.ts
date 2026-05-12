import "server-only";

import { createAdminClient, MissingSupabaseServiceRoleKeyError } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/profile";
import type {
  NativeSourceInput,
  ShopifySourceInput,
  SourceSetupLookupResult,
  SourceStore,
  StoreConnectionSummary,
  StoreConnectionStatus,
  StoreSourceType,
  StoreStatus,
} from "@/types/source";

type StoreRow = {
  id: string;
  profile_id: string;
  name: string;
  source_type: StoreSourceType;
  website_url: string | null;
  market: string;
  language: string;
  status: StoreStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

type StoreConnectionRow = {
  id: string;
  profile_id: string;
  store_id: string;
  platform: StoreSourceType;
  shop_domain: string | null;
  scopes: string[] | null;
  status: StoreConnectionStatus;
  last_error_code: string | null;
  last_error_message: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

type SourceMutationResult =
  | { ok: true; store: SourceStore }
  | { ok: false; message: string; isMissingTable?: boolean; isMissingServiceRole?: boolean };

type SourceSetupRpcResult = {
  store_id: string;
};

const storeSelect =
  "id,profile_id,name,source_type,website_url,market,language,status,last_sync_at,created_at,updated_at";

const connectionSelect =
  "id,profile_id,store_id,platform,shop_domain,scopes,status,last_error_code,last_error_message,connected_at,created_at,updated_at";

function sourceSetupMessage() {
  return "Kaynak tablolari hazir degil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasini calistir.";
}

function sourceSetupTransactionMessage() {
  return "Kaynak kurulum SQL'i guncel degil. Supabase SQL Editor'de web/.codex/sql/20260512_phase3_source_setup_transaction_rpc.sql dosyasini calistir.";
}

function serviceRoleMessage() {
  return "Kaynak kaydi olusturmak icin SUPABASE_SERVICE_ROLE_KEY sunucu ortam degiskeni gerekli. Bu anahtar tarayiciya acilmamali.";
}

function isMissingSourceTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("stores") ||
    message.includes("store_connections")
  );
}

function isMissingSourceSetupTransaction(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42883" ||
    message.includes("complete_source_setup") ||
    message.includes("source_setup_completed")
  );
}

function mapConnectionRow(row: StoreConnectionRow): StoreConnectionSummary {
  return {
    id: row.id,
    storeId: row.store_id,
    platform: row.platform,
    shopDomain: row.shop_domain,
    scopes: row.scopes ?? [],
    status: row.status,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    connectedAt: row.connected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStoreRow(
  row: StoreRow,
  connection: StoreConnectionSummary | null,
): SourceStore {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    sourceType: row.source_type,
    websiteUrl: row.website_url,
    market: row.market,
    language: row.language,
    status: row.status,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    connection,
  };
}

function profileDefaults(profile: UserProfile) {
  return {
    storeName: profile.businessName?.trim() || "Magazam",
    market: profile.marketFocus?.trim() || "TR",
    websiteUrl: profile.websiteUrl?.trim() || null,
  };
}

async function completeSourceSetupTransaction(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    profileId: string;
    sourceType: "shopify" | "native";
    storeName: string;
    websiteUrl?: string | null;
    shopDomain?: string | null;
    market: string;
    language: string;
  },
): Promise<{ ok: true; storeId: string } | { ok: false; message: string; isMissingTable?: boolean }> {
  const { data, error } = await supabase
    .rpc("complete_source_setup", {
      p_profile_id: params.profileId,
      p_source_type: params.sourceType,
      p_store_name: params.storeName,
      p_website_url: params.websiteUrl ?? null,
      p_shop_domain: params.shopDomain ?? null,
      p_market: params.market,
      p_language: params.language,
    })
    .single<SourceSetupRpcResult>();

  if (error) {
    const isMissingTable = isMissingSourceTable(error);

    return {
      ok: false,
      message: isMissingTable
        ? sourceSetupMessage()
        : isMissingSourceSetupTransaction(error)
          ? sourceSetupTransactionMessage()
          : "Kaynak kurulumu tamamlanamadi. Lutfen tekrar dene.",
      isMissingTable,
    };
  }

  if (!data?.store_id) {
    return {
      ok: false,
      message: "Kaynak kurulumu tamamlandi ancak kaynak kaydi bulunamadi. Lutfen tekrar dene.",
    };
  }

  return { ok: true, storeId: data.store_id };
}

async function loadStoreWithConnection(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  storeId: string,
): Promise<SourceMutationResult> {
  const [{ data: storeData, error: storeError }, { data: connectionData, error: connectionError }] =
    await Promise.all([
      supabase
        .from("stores")
        .select(storeSelect)
        .eq("profile_id", profileId)
        .eq("id", storeId)
        .single<StoreRow>(),
      supabase
        .from("store_connections")
        .select(connectionSelect)
        .eq("profile_id", profileId)
        .eq("store_id", storeId)
        .maybeSingle<StoreConnectionRow>(),
    ]);

  if (storeError) {
    return {
      ok: false,
      message: isMissingSourceTable(storeError)
        ? sourceSetupMessage()
        : "Kaynak kaydi okunamadi. Lutfen tekrar dene.",
      isMissingTable: isMissingSourceTable(storeError),
    };
  }

  if (connectionError) {
    return {
      ok: false,
      message: isMissingSourceTable(connectionError)
        ? sourceSetupMessage()
        : "Kaynak baglanti durumu okunamadi. Lutfen tekrar dene.",
      isMissingTable: isMissingSourceTable(connectionError),
    };
  }

  return {
    ok: true,
    store: mapStoreRow(storeData, connectionData ? mapConnectionRow(connectionData) : null),
  };
}

export async function getSourceSetupForUser(
  profileId: string,
): Promise<SourceSetupLookupResult> {
  const supabase = await createClient();

  const [storesResult, connectionsResult] = await Promise.all([
    supabase
      .from("stores")
      .select(storeSelect)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .limit(12)
      .returns<StoreRow[]>(),
    supabase
      .from("store_connections")
      .select(connectionSelect)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .limit(12)
      .returns<StoreConnectionRow[]>(),
  ]);

  if (storesResult.error) {
    return {
      stores: [],
      errorMessage: isMissingSourceTable(storesResult.error)
        ? sourceSetupMessage()
        : "Kaynak bilgileri okunamadi. Lutfen tekrar dene.",
      isMissingTable: isMissingSourceTable(storesResult.error),
    };
  }

  if (connectionsResult.error) {
    return {
      stores: [],
      errorMessage: isMissingSourceTable(connectionsResult.error)
        ? sourceSetupMessage()
        : "Kaynak baglantilari okunamadi. Lutfen tekrar dene.",
      isMissingTable: isMissingSourceTable(connectionsResult.error),
    };
  }

  const connectionsByStoreId = new Map(
    (connectionsResult.data ?? []).map((row) => [row.store_id, mapConnectionRow(row)]),
  );

  return {
    stores: (storesResult.data ?? []).map((row) =>
      mapStoreRow(row, connectionsByStoreId.get(row.id) ?? null),
    ),
  };
}

export async function createOrUpdateNativeSource(
  profile: UserProfile,
  input: NativeSourceInput,
): Promise<SourceMutationResult> {
  try {
    const supabase = createAdminClient();
    const defaults = profileDefaults(profile);
    const setupResult = await completeSourceSetupTransaction(supabase, {
      profileId: profile.id,
      sourceType: "native",
      storeName: input.storeName,
      websiteUrl: input.websiteUrl ?? defaults.websiteUrl,
      shopDomain: null,
      market: defaults.market,
      language: "tr",
    });

    if (!setupResult.ok) {
      return setupResult;
    }

    return loadStoreWithConnection(supabase, profile.id, setupResult.storeId);
  } catch (error) {
    if (error instanceof MissingSupabaseServiceRoleKeyError) {
      return {
        ok: false,
        message: serviceRoleMessage(),
        isMissingServiceRole: true,
      };
    }

    return {
      ok: false,
      message: "Kaynak kaydi olusturulurken beklenmeyen bir hata olustu.",
    };
  }
}

export async function prepareShopifySource(
  profile: UserProfile,
  input: ShopifySourceInput,
): Promise<SourceMutationResult> {
  try {
    const supabase = createAdminClient();
    const defaults = profileDefaults(profile);
    const setupResult = await completeSourceSetupTransaction(supabase, {
      profileId: profile.id,
      sourceType: "shopify",
      storeName: `${defaults.storeName} Shopify`,
      websiteUrl: null,
      shopDomain: input.shopDomain,
      market: defaults.market,
      language: "tr",
    });

    if (!setupResult.ok) {
      return setupResult;
    }

    return loadStoreWithConnection(supabase, profile.id, setupResult.storeId);
  } catch (error) {
    if (error instanceof MissingSupabaseServiceRoleKeyError) {
      return {
        ok: false,
        message: serviceRoleMessage(),
        isMissingServiceRole: true,
      };
    }

    return {
      ok: false,
      message: "Shopify hazirligi yapilirken beklenmeyen bir hata olustu.",
    };
  }
}

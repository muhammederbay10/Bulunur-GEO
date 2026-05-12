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

const storeSelect =
  "id,profile_id,name,source_type,website_url,market,language,status,last_sync_at,created_at,updated_at";

const connectionSelect =
  "id,profile_id,store_id,platform,shop_domain,scopes,status,last_error_code,last_error_message,connected_at,created_at,updated_at";

function sourceSetupMessage() {
  return "Kaynak tabloları hazır değil. Supabase SQL Editor'de web/.codex/sql/20260512_phase2_database_foundation.sql dosyasını çalıştır.";
}

function serviceRoleMessage() {
  return "Kaynak kaydı oluşturmak için SUPABASE_SERVICE_ROLE_KEY sunucu ortam değişkeni gerekli. Bu anahtar tarayıcıya açılmamalı.";
}

function isMissingSourceTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("stores") ||
    message.includes("store_connections")
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
    storeName: profile.businessName?.trim() || "Mağazam",
    market: profile.marketFocus?.trim() || "TR",
    websiteUrl: profile.websiteUrl?.trim() || null,
  };
}

async function loadStoreWithConnection(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  storeId: string,
): Promise<SourceMutationResult> {
  const [{ data: storeData, error: storeError }, { data: connectionData, error: connectionError }] =
    await Promise.all([
      supabase.from("stores").select(storeSelect).eq("profile_id", profileId).eq("id", storeId).single<StoreRow>(),
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
        : "Kaynak kaydı okunamadı. Lütfen tekrar dene.",
      isMissingTable: isMissingSourceTable(storeError),
    };
  }

  if (connectionError) {
    return {
      ok: false,
      message: isMissingSourceTable(connectionError)
        ? sourceSetupMessage()
        : "Kaynak bağlantı durumu okunamadı. Lütfen tekrar dene.",
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
        : "Kaynak bilgileri okunamadı. Lütfen tekrar dene.",
      isMissingTable: isMissingSourceTable(storesResult.error),
    };
  }

  if (connectionsResult.error) {
    return {
      stores: [],
      errorMessage: isMissingSourceTable(connectionsResult.error)
        ? sourceSetupMessage()
        : "Kaynak bağlantıları okunamadı. Lütfen tekrar dene.",
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
    const { data: existingStore, error: existingError } = await supabase
      .from("stores")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("source_type", "native")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      return {
        ok: false,
        message: isMissingSourceTable(existingError)
          ? sourceSetupMessage()
          : "Mevcut kaynak durumu kontrol edilemedi. Lütfen tekrar dene.",
        isMissingTable: isMissingSourceTable(existingError),
      };
    }

    const payload = {
      profile_id: profile.id,
      name: input.storeName,
      source_type: "native" as const,
      website_url: input.websiteUrl ?? defaults.websiteUrl,
      market: defaults.market,
      language: "tr",
      status: "active" as const,
    };

    const mutation = existingStore
      ? supabase.from("stores").update(payload).eq("id", existingStore.id).eq("profile_id", profile.id).select("id").single<{ id: string }>()
      : supabase.from("stores").insert(payload).select("id").single<{ id: string }>();

    const { data, error } = await mutation;

    if (error) {
      return {
        ok: false,
        message: isMissingSourceTable(error)
          ? sourceSetupMessage()
          : "Web sitesi kaynak kaydı oluşturulamadı. Lütfen tekrar dene.",
        isMissingTable: isMissingSourceTable(error),
      };
    }

    return loadStoreWithConnection(supabase, profile.id, data.id);
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
      message: "Kaynak kaydı oluşturulurken beklenmeyen bir hata oluştu.",
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
    const { data: existingStore, error: existingError } = await supabase
      .from("stores")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("source_type", "shopify")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      return {
        ok: false,
        message: isMissingSourceTable(existingError)
          ? sourceSetupMessage()
          : "Mevcut Shopify hazırlığı kontrol edilemedi. Lütfen tekrar dene.",
        isMissingTable: isMissingSourceTable(existingError),
      };
    }

    const storePayload = {
      profile_id: profile.id,
      name: `${defaults.storeName} Shopify`,
      source_type: "shopify" as const,
      website_url: null,
      market: defaults.market,
      language: "tr",
      status: "setup_pending" as const,
    };

    const storeMutation = existingStore
      ? supabase.from("stores").update(storePayload).eq("id", existingStore.id).eq("profile_id", profile.id).select("id").single<{ id: string }>()
      : supabase.from("stores").insert(storePayload).select("id").single<{ id: string }>();

    const { data: storeData, error: storeError } = await storeMutation;

    if (storeError) {
      return {
        ok: false,
        message: isMissingSourceTable(storeError)
          ? sourceSetupMessage()
          : "Shopify kaynak kaydı hazırlanamadı. Lütfen tekrar dene.",
        isMissingTable: isMissingSourceTable(storeError),
      };
    }

    const { error: connectionError } = await supabase
      .from("store_connections")
      .upsert(
        {
          profile_id: profile.id,
          store_id: storeData.id,
          platform: "shopify",
          shop_domain: input.shopDomain,
          scopes: [],
          status: "pending",
          last_error_code: null,
          last_error_message: null,
          connected_at: null,
        },
        { onConflict: "store_id,platform" },
      );

    if (connectionError) {
      return {
        ok: false,
        message: isMissingSourceTable(connectionError)
          ? sourceSetupMessage()
          : "Shopify bağlantı hazırlığı kaydedilemedi. Lütfen tekrar dene.",
        isMissingTable: isMissingSourceTable(connectionError),
      };
    }

    return loadStoreWithConnection(supabase, profile.id, storeData.id);
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
      message: "Shopify hazırlığı yapılırken beklenmeyen bir hata oluştu.",
    };
  }
}

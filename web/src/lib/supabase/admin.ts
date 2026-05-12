import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseElevatedKey } from "@/lib/env/server";
import { getSupabasePublicEnv } from "@/lib/env/public";

export class MissingSupabaseElevatedKeyError extends Error {
  constructor() {
    super("SUPABASE_SECRET_KEY is not configured.");
    this.name = "MissingSupabaseElevatedKeyError";
  }
}

export function createAdminClient() {
  const publicEnv = getSupabasePublicEnv();
  const elevatedKey = getSupabaseElevatedKey();

  if (!elevatedKey) {
    throw new MissingSupabaseElevatedKeyError();
  }

  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    elevatedKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";
import { getSupabasePublicEnv } from "@/lib/env/public";

export class MissingSupabaseServiceRoleKeyError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is not configured.");
    this.name = "MissingSupabaseServiceRoleKeyError";
  }
}

export function createAdminClient() {
  const publicEnv = getSupabasePublicEnv();
  const serverEnv = getServerEnv();

  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new MissingSupabaseServiceRoleKeyError();
  }

  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

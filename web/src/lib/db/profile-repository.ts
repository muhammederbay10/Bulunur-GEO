import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { OnboardingInput, UserProfile } from "@/types/profile";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  business_category: string | null;
  website_url: string | null;
  market_focus: string | null;
  preferred_product_source: "shopify" | "native" | null;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CurrentUser = {
  id: string;
  email?: string;
};

export type ProfileLookupResult = {
  profile: UserProfile | null;
  errorMessage?: string;
  isMissingTable?: boolean;
};

export type ProfileMutationResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; message: string; isMissingTable?: boolean };

const profileSelect =
  "id,email,full_name,business_name,business_category,website_url,market_focus,preferred_product_source,onboarding_completed,onboarding_completed_at,created_at,updated_at";

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    businessName: row.business_name,
    businessCategory: row.business_category,
    websiteUrl: row.website_url,
    marketFocus: row.market_focus,
    preferredProductSource: row.preferred_product_source,
    onboardingCompleted: row.onboarding_completed,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isMissingProfilesTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.toLowerCase().includes("profiles") === true
  );
}

function databaseSetupMessage() {
  return "Profil tablosu hazır değil. Supabase SQL Editor'de web/.codex/sql/20260511_phase1_profiles.sql dosyasını çalıştır.";
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return null;
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
});

export const getProfileForUser = cache(
  async (userId: string): Promise<ProfileLookupResult> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (error) {
      if (isMissingProfilesTable(error)) {
        return {
          profile: null,
          errorMessage: databaseSetupMessage(),
          isMissingTable: true,
        };
      }

      return {
        profile: null,
        errorMessage:
          "Profil bilgisi okunamadı. SQL şemasının güncel olduğundan emin ol ve tekrar dene.",
      };
    }

    return { profile: data ? mapProfileRow(data) : null };
  },
);

export async function upsertOnboardingProfile(
  user: CurrentUser,
  input: OnboardingInput,
): Promise<ProfileMutationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: input.fullName,
        business_name: input.businessName,
        business_category: input.businessCategory,
        market_focus: input.marketFocus,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(profileSelect)
    .single<ProfileRow>();

  if (error) {
    return {
      ok: false,
      message: isMissingProfilesTable(error)
        ? databaseSetupMessage()
        : "Profil kaydedilemedi. Lütfen SQL şemasının güncel olduğundan emin ol ve tekrar dene.",
      isMissingTable: isMissingProfilesTable(error),
    };
  }

  return { ok: true, profile: mapProfileRow(data) };
}

export function hasCompletedOnboarding(profile: UserProfile | null) {
  return profile?.onboardingCompleted === true;
}

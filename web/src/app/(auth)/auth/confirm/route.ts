import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

const DEFAULT_AUTH_CONFIRM_REDIRECT = "/onboarding";
const ALLOWED_AUTH_CONFIRM_REDIRECTS = new Set([
  "/onboarding",
  "/dashboard",
  "/sources?setup=1",
]);

function getSafeAuthConfirmRedirect(value: string | null) {
  if (!value) {
    return DEFAULT_AUTH_CONFIRM_REDIRECT;
  }

  return ALLOWED_AUTH_CONFIRM_REDIRECTS.has(value)
    ? value
    : DEFAULT_AUTH_CONFIRM_REDIRECT;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeAuthConfirmRedirect(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      redirect(next);
    } else {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect(`/auth/error?error=${encodeURIComponent("No token hash or type")}`);
}

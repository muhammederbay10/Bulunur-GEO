"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCurrentUser,
  upsertOnboardingProfile,
} from "@/lib/db/profile-repository";
import {
  onboardingSchema,
  type OnboardingFieldErrors,
} from "@/lib/validation/onboarding";

export type OnboardingFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: OnboardingFieldErrors;
  redirectTo?: string;
};

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveOnboardingProfile(
  _previousState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const parsed = onboardingSchema.safeParse({
    fullName: getFormValue(formData, "fullName"),
    businessName: getFormValue(formData, "businessName"),
    businessCategory: getFormValue(formData, "businessCategory"),
    marketFocus: getFormValue(formData, "marketFocus"),
  });
  const inlineFlow = getFormValue(formData, "flowMode") === "inline";

  if (!parsed.success) {
    return {
      status: "error",
      message: "Bilgileri kaydetmeden önce işaretli alanları düzelt.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await upsertOnboardingProfile(user, parsed.data);

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePath("/onboarding");
  revalidatePath("/sources");
  revalidatePath("/dashboard");
  return {
    status: "success",
    message: "Onboarding tamamlandı. Ürün kaynağını hazırlamaya geçiyoruz.",
    redirectTo: inlineFlow ? undefined : "/sources?setup=1",
  };
}

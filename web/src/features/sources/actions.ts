"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCurrentUser,
  getProfileForUser,
  hasCompletedOnboarding,
} from "@/lib/db/profile-repository";
import {
  createOrUpdateNativeSource,
  prepareShopifySource,
} from "@/lib/db/source-repository";
import {
  nativeSourceSchema,
  shopifySourceSchema,
  type NativeSourceFieldErrors,
  type ShopifySourceFieldErrors,
} from "@/lib/validation/source-setup";

export type NativeSourceFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: NativeSourceFieldErrors;
  importUrl?: string;
};

export type ShopifySourceFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: ShopifySourceFieldErrors;
  connectUrl?: string;
  shopDomain?: string;
};

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function getCompletedProfileOrRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { profile } = await getProfileForUser(user.id);

  if (!profile || !hasCompletedOnboarding(profile)) {
    redirect("/onboarding");
  }

  return profile;
}

export async function saveNativeSource(
  _previousState: NativeSourceFormState,
  formData: FormData,
): Promise<NativeSourceFormState> {
  const profile = await getCompletedProfileOrRedirect();
  const parsed = nativeSourceSchema.safeParse({
    storeName: getFormValue(formData, "storeName"),
    websiteUrl: getFormValue(formData, "websiteUrl"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Web sitesi kaynağını kaydetmeden önce alanları düzelt.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createOrUpdateNativeSource(profile, parsed.data);

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePath("/sources");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message:
      "Web sitesi kaynağı hazır. Ürünleriniz içeri alınırken bekleme ekranına yönlendiriliyorsunuz.",
    importUrl: parsed.data.websiteUrl,
  };
}

export async function saveShopifySource(
  _previousState: ShopifySourceFormState,
  formData: FormData,
): Promise<ShopifySourceFormState> {
  const profile = await getCompletedProfileOrRedirect();
  const parsed = shopifySourceSchema.safeParse({
    shopDomain: getFormValue(formData, "shopDomain"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Shopify hazırlığını kaydetmeden önce alanları düzelt.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await prepareShopifySource(profile, parsed.data);

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePath("/sources");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message:
      "Shopify mağaza bilgisi kaydedildi. Yetki vermeniz için Shopify'a yönlendiriliyorsunuz.",
    connectUrl: `/api/shopify/connect?shop=${encodeURIComponent(
      parsed.data.shopDomain,
    )}`,
    shopDomain: parsed.data.shopDomain,
  };
}

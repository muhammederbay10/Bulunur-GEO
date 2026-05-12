export type ProductSourcePreference = "shopify" | "native";

export type UserProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  businessName: string | null;
  businessCategory: string | null;
  websiteUrl: string | null;
  marketFocus: string | null;
  preferredProductSource: ProductSourcePreference | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingInput = {
  fullName: string;
  businessName: string;
  businessCategory: string;
  websiteUrl?: string;
  marketFocus: string;
  preferredProductSource: ProductSourcePreference;
};

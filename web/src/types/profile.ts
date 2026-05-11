export type ProductSourcePreference = "shopify" | "native";

export type UserProfile = {
  id: string;
  email: string | null;
  fullName: string;
  businessName: string;
  businessCategory: string;
  websiteUrl: string | null;
  marketFocus: string;
  preferredProductSource: ProductSourcePreference;
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

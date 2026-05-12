import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .url("Geçerli bir URL gir. Örn: https://magazam.com")
    .optional(),
);

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(120, "Ad soyad 120 karakteri geçmemeli."),
  businessName: z
    .string()
    .trim()
    .min(2, "İşletme adı en az 2 karakter olmalı.")
    .max(160, "İşletme adı 160 karakteri geçmemeli."),
  businessCategory: z
    .string()
    .trim()
    .min(2, "Kategori en az 2 karakter olmalı.")
    .max(120, "Kategori 120 karakteri geçmemeli."),
  websiteUrl: optionalUrl,
  marketFocus: z
    .string()
    .trim()
    .min(2, "Pazar odağı en az 2 karakter olmalı.")
    .max(80, "Pazar odağı 80 karakteri geçmemeli."),
  preferredProductSource: z.enum(["shopify", "native"], {
    error: "Ürün kaynağı seçilmeli.",
  }),
});

export type OnboardingFieldErrors = Partial<
  Record<keyof z.infer<typeof onboardingSchema>, string[]>
>;

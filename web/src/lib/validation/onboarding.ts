import { z } from "zod";

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
  marketFocus: z
    .string()
    .trim()
    .min(2, "Pazar odağı en az 2 karakter olmalı.")
    .max(80, "Pazar odağı 80 karakteri geçmemeli."),
});

export type OnboardingFieldErrors = Partial<
  Record<keyof z.infer<typeof onboardingSchema>, string[]>
>;

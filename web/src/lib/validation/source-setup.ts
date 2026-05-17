import { z } from "zod";

const requiredUrl = z
  .string()
  .trim()
  .min(1, "Ürün liste URL'sini gir.")
  .url("Geçerli bir URL gir. Örn: https://magazam.com/collections/all");

function normalizeShopDomain(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  let host = trimmed;

  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return trimmed;
    }
  }

  host = host.split("/")[0]?.trim() ?? "";

  if (!host.includes(".")) {
    return `${host}.myshopify.com`;
  }

  return host;
}

export const nativeSourceSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "Mağaza adı en az 2 karakter olmalı.")
    .max(160, "Mağaza adı 160 karakteri geçmemeli."),
  websiteUrl: requiredUrl,
});

export const shopifySourceSchema = z.object({
  shopDomain: z
    .string()
    .trim()
    .min(2, "Shopify mağaza alan adını gir.")
    .max(120, "Shopify mağaza alan adı çok uzun.")
    .transform(normalizeShopDomain)
    .refine(
      (value) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value),
      "Shopify alan adı örn: magazam.myshopify.com olmalı.",
    ),
});

export type NativeSourceFieldErrors = Partial<
  Record<keyof z.infer<typeof nativeSourceSchema>, string[]>
>;

export type ShopifySourceFieldErrors = Partial<
  Record<keyof z.input<typeof shopifySourceSchema>, string[]>
>;

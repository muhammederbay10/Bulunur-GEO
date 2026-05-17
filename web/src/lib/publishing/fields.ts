import type { OptimizationResultRecord } from "@/types/analysis";
import type { ShopifyPublishableField } from "@/types/shopify";

export type PublishableFieldCandidate = {
  field: ShopifyPublishableField;
  label: string;
  value: string | string[] | null;
  before?: string | string[] | null;
};

const fieldLabels: Record<ShopifyPublishableField, string> = {
  title: "Başlık",
  descriptionHtml: "Ürün açıklaması",
  tags: "Etiketler",
  "seo.title": "SEO basligi",
  "seo.description": "SEO açıklaması",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const values = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : null;
}

function readPath(source: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;

    return current[part];
  }, source);
}

function readBeforeAfter(
  optimization: OptimizationResultRecord,
  field: string,
  key: "before" | "after",
) {
  const directValue = optimization.beforeAfter[field];

  if (isRecord(directValue)) {
    return directValue[key];
  }

  return undefined;
}

function candidate(params: {
  optimization: OptimizationResultRecord;
  field: ShopifyPublishableField;
  generatedPaths: string[];
  beforeAfterFields: string[];
  arrayValue?: boolean;
}): PublishableFieldCandidate | null {
  const { optimization, field, generatedPaths, beforeAfterFields, arrayValue } =
    params;
  let value: string | string[] | null = null;
  let before: string | string[] | null = null;

  for (const path of generatedPaths) {
    const generatedValue = readPath(optimization.generated, path);

    value = arrayValue
      ? asStringArray(generatedValue)
      : asText(generatedValue);

    if (value) break;
  }

  if (!value) {
    for (const beforeAfterField of beforeAfterFields) {
      const afterValue = readBeforeAfter(
        optimization,
        beforeAfterField,
        "after",
      );

      value = arrayValue ? asStringArray(afterValue) : asText(afterValue);

      if (value) break;
    }
  }

  if (!value) return null;

  for (const beforeAfterField of beforeAfterFields) {
    const beforeValue = readBeforeAfter(
      optimization,
      beforeAfterField,
      "before",
    );

    before = arrayValue ? asStringArray(beforeValue) : asText(beforeValue);

    if (before) break;
  }

  return {
    field,
    label: fieldLabels[field],
    value,
    before,
  };
}

export function getShopifyPublishableFieldCandidates(
  optimization: OptimizationResultRecord,
): PublishableFieldCandidate[] {
  return [
    candidate({
      optimization,
      field: "title",
      generatedPaths: ["title"],
      beforeAfterFields: ["title"],
    }),
    candidate({
      optimization,
      field: "descriptionHtml",
      generatedPaths: ["descriptionHtml", "longDescription", "description"],
      beforeAfterFields: ["descriptionHtml", "longDescription", "description"],
    }),
    candidate({
      optimization,
      field: "tags",
      generatedPaths: ["tags", "suggestedTags"],
      beforeAfterFields: ["tags"],
      arrayValue: true,
    }),
    candidate({
      optimization,
      field: "seo.title",
      generatedPaths: ["seoTitle", "seo.title"],
      beforeAfterFields: ["seoTitle", "seo.title"],
    }),
    candidate({
      optimization,
      field: "seo.description",
      generatedPaths: ["seoDescription", "seo.description"],
      beforeAfterFields: ["seoDescription", "seo.description"],
    }),
  ].filter((item): item is PublishableFieldCandidate => Boolean(item));
}

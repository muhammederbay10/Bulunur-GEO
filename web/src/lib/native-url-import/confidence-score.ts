import type {
  ConfidenceScoreResult,
  ExtractedProductData,
  NativeUrlImportStatus,
} from "@/types/native-url-import";

function hasValue(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function getStatusFromScore(score: number): NativeUrlImportStatus {
  if (score >= 80) return "ready";
  if (score >= 50) return "partial";
  return "needs_review";
}

export function calculateProductConfidence(
  product: ExtractedProductData,
): ConfidenceScoreResult {
  let score = 0;
  const warnings: string[] = [];

  if (hasValue(product.title)) {
    score += 25;
  } else {
    warnings.push("Product title was not found.");
  }

  if (hasValue(product.productUrl)) {
    score += 20;
  } else {
    warnings.push("Product URL was not found.");
  }

  if (product.images.length > 0) {
    score += 15;
  } else {
    warnings.push("Product image was not found.");
  }

  if (
    hasValue(product.plainDescription) ||
    hasValue(product.descriptionHtml) ||
    hasValue(product.shortDescription)
  ) {
    score += 20;
  } else {
    warnings.push("Product description was not found.");
  }

  if (hasValue(product.priceDisplay)) {
    score += 10;
  } else {
    warnings.push("Product price was not found.");
  }

  if (product.extractionMethods.includes("json_ld_product_schema")) {
    score += 10;
  } else {
    warnings.push("JSON-LD Product schema was not found.");
  }

  const finalScore = Math.min(score, 100);

  return {
    score: finalScore,
    status: getStatusFromScore(finalScore),
    warnings,
  };
}

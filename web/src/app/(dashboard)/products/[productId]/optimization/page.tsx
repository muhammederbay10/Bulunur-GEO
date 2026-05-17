import { notFound } from "next/navigation";

import { ProductOptimizationReviewPage } from "@/features/optimization/components/product-optimization-review-page";
import { getLatestOptimizationResult } from "@/lib/db/optimization-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";

type ProductOptimizationPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductOptimizationPage({
  params,
}: ProductOptimizationPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const { productId } = await params;
  const [productResult, optimizationResult] = await Promise.all([
    getProductAnalysisContextForProfile({
      profileId: user.id,
      productId,
    }),
    getLatestOptimizationResult({
      profileId: user.id,
      productId,
    }),
  ]);

  if (!productResult.ok) {
    if (productResult.code === "product_not_found") {
      notFound();
    }

    throw new Error(productResult.message);
  }

  return (
    <ProductOptimizationReviewPage
      product={productResult.data.product}
      optimization={optimizationResult.ok ? optimizationResult.data : null}
      errorMessage={optimizationResult.ok ? undefined : optimizationResult.message}
    />
  );
}

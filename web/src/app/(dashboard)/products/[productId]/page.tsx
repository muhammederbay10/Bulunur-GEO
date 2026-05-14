import { notFound } from "next/navigation";

import { ProductAnalysisPage } from "@/features/analysis/components/product-analysis-page";
import { getLatestProductAnalysis } from "@/lib/db/analysis-repository";
import { getCurrentUser } from "@/lib/db/profile-repository";
import { getProductAnalysisContextForProfile } from "@/lib/db/product-repository";

type ProductDetailPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const { productId } = await params;
  const [productResult, analysisResult] = await Promise.all([
    getProductAnalysisContextForProfile({
      profileId: user.id,
      productId,
    }),
    getLatestProductAnalysis({
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
    <ProductAnalysisPage
      product={productResult.data.product}
      analysis={analysisResult.ok ? analysisResult.data : null}
      errorMessage={analysisResult.ok ? undefined : analysisResult.message}
    />
  );
}

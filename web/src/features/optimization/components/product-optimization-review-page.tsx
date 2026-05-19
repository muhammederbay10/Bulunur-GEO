import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BeforeAfterPanel,
  ShopifyReviewPublishPanel,
} from "@/features/analysis/components/product-analysis-page";
import type {
  OptimizationResultRecord,
  ProductAnalysisDetail,
  ProductAnalysisRecord,
} from "@/types/analysis";

const reviewStatusLabels = {
  draft: "Taslak",
  needs_user_input: "Eksik bilgi gerekiyor",
  ready_for_review: "Incelemeye hazır",
  approved: "Onaylandi",
  exported: "Disa aktarıldı",
  published: "Yayında",
  failed: "Hata",
};

function isReviewableOptimization(
  optimization: OptimizationResultRecord | null,
) {
  return (
    optimization &&
    ["ready_for_review", "approved", "exported", "published"].includes(
      optimization.status,
    )
  );
}

export function ProductOptimizationReviewPage({
  product,
  analysis,
  optimization,
  errorMessage,
}: {
  product: ProductAnalysisDetail;
  analysis: ProductAnalysisRecord | null;
  optimization: OptimizationResultRecord | null;
  errorMessage?: string;
}) {
  const isReady = isReviewableOptimization(optimization);

  return (
    <div className="page-enter grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/products/${product.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Analize dön
          </Link>
        </Button>
        <Badge variant="outline">
          {optimization
            ? reviewStatusLabels[optimization.status]
            : "Optimizasyon yok"}
        </Badge>
      </div>

      {errorMessage ? (
        <section className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          {errorMessage}
        </section>
      ) : null}

      {!isReady || !optimization ? (
        <section className="seller-surface p-4">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <p className="mono-label">Optimizasyon sonucu</p>
          </div>
          <h1 className="mt-2 text-xl font-semibold">
            Optimize edilmiş taslak henüz hazır değil
          </h1>
          <Button asChild className="mt-4">
            <Link href={`/products/${product.id}`}>Analize dön</Link>
          </Button>
        </section>
      ) : (
        <>
          <BeforeAfterPanel
            product={product}
            analysis={analysis}
            optimization={optimization}
          />
          <ShopifyReviewPublishPanel
            product={product}
            optimization={optimization}
          />
        </>
      )}
    </div>
  );
}

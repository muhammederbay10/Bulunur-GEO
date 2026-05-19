import Link from "next/link";
import { Package, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/features/products/components/product-card";
import type { ProductSummary } from "@/types/product";

export function ProductList({ products }: { products: ProductSummary[] }) {
  if (!products.length) {
    return (
      <section className="seller-surface p-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-primary">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">
            Bu filtrede ürün bulunmuyor
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Kaynaklar ekranından Shopify senkronizasyonu yapabilir, web sitesi
            URLi taratabilir ya da dosya/manual ürün aktarımı kullanabilirsiniz.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/sources">
              <RefreshCw className="h-4 w-4" />
              Kaynaklara git
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          animationIndex={index}
        />
      ))}
    </section>
  );
}

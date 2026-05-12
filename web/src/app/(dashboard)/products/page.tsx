import { Suspense } from "react";
import { Package } from "lucide-react";

import { ProductList } from "@/features/products/components/product-list";
import { listProductsForCurrentUser } from "@/lib/db/product-repository";

type ProductsSearchParams = {
  shopify_connected?: string;
  shopify_sync?: string;
  product_count?: string;
  shop?: string;
};

type ProductsPageProps = {
  searchParams?: Promise<ProductsSearchParams>;
};

function ProductsFallback() {
  return (
    <section className="seller-surface p-6">
      <p className="text-sm font-medium text-primary">Urunler</p>
      <h1 className="mt-3 text-2xl font-semibold">Urunler hazirlaniyor</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Senkronize edilen urunleriniz okunuyor.
      </p>
    </section>
  );
}

function getShopifyNotice(params?: ProductsSearchParams) {
  if (params?.shopify_connected !== "1") {
    return null;
  }

  if (params.shopify_sync === "failed") {
    return {
      tone: "warning" as const,
      message:
        "Shopify baglantisi kuruldu, ancak urun senkronizasyonu tamamlanamadi. Kaynaklar ekranindan tekrar senkronize edebilirsiniz.",
    };
  }

  const productCount = Number(params.product_count ?? "0");

  return {
    tone: "success" as const,
    message:
      productCount > 0
        ? `Shopify baglantisi tamamlandi ve ${productCount} urun iceri alindi.`
        : "Shopify baglantisi tamamlandi. Bu magazada iceri alinacak urun bulunamadi.",
  };
}

async function ProductsContent({
  searchParams,
}: {
  searchParams?: Promise<ProductsSearchParams>;
}) {
  const params = await searchParams;
  const products = await listProductsForCurrentUser();
  const shopifyNotice = getShopifyNotice(params);

  return (
    <div className="grid gap-6">
      {shopifyNotice ? (
        <div
          className={
            shopifyNotice.tone === "warning"
              ? "rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground"
              : "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100"
          }
        >
          {shopifyNotice.message}
        </div>
      ) : null}

      <section className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Urunler</p>
          <h1 className="mt-2 text-3xl font-semibold">
            Senkronize katalog
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Shopify veya web sitesi kaynaklarindan iceri alinan urunler burada
            listelenir. Analiz ve iyilestirme adimlari sonraki fazlarda bu
            katalogdan baslar.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          {products.length} urun
        </div>
      </section>

      <ProductList products={products} />
    </div>
  );
}

export default function ProductsPage({ searchParams }: ProductsPageProps) {
  return (
    <Suspense fallback={<ProductsFallback />}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

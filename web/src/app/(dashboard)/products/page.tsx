import { Suspense } from "react";

import { ProductList } from "@/features/products/components/product-list";
import { ProductFilters } from "@/features/products/components/product-filters";
import { listProductsForCurrentUser } from "@/lib/db/product-repository";
import type {
  ProductListSourceFilter,
  ProductListStatusFilter,
} from "@/types/product";

type ProductsSearchParams = {
  shopify_connected?: string;
  shopify_sync?: string;
  native_imported?: string;
  product_count?: string;
  shop?: string;
  status?: string;
  source?: string;
};

type ProductsPageProps = {
  searchParams?: Promise<ProductsSearchParams>;
};

function ProductsFallback() {
  return (
    <section className="seller-surface p-6">
      <p className="text-sm font-medium text-primary">Ürünler</p>
      <h1 className="mt-3 text-2xl font-semibold">Ürünler hazırlanıyor</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Senkronize edilen ürünleriniz okunuyor.
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
        "Shopify bağlantısı kuruldu, ancak ürün senkronizasyonu tamamlanamadı. Kaynaklar ekranından tekrar senkronize edebilirsiniz.",
    };
  }

  const productCount = Number(params.product_count ?? "0");

  return {
    tone: "success" as const,
    message:
      productCount > 0
        ? `Shopify bağlantısı tamamlandı ve ${productCount} ürün içeri alındı.`
        : "Shopify bağlantısı tamamlandı. Bu mağazada içeri alınacak ürün bulunamadı.",
  };
}

function getNativeImportNotice(params?: ProductsSearchParams) {
  if (params?.native_imported !== "1") {
    return null;
  }

  const productCount = Number(params.product_count ?? "0");

  return {
    tone: "success" as const,
    message:
      productCount > 0
        ? `Web sitesi kaynağı hazırlandı ve ${productCount} ürün içeri alındı.`
        : "Web sitesi kaynağı hazırlandı. Bu URL'den aktarılabilir ürün bulunamadı.",
  };
}

function normalizeStatusFilter(value?: string): ProductListStatusFilter {
  if (
    value === "waiting" ||
    value === "analyzed" ||
    value === "optimized" ||
    value === "low_score"
  ) {
    return value;
  }

  return "all";
}

function normalizeSourceFilter(value?: string): ProductListSourceFilter {
  if (value === "shopify" || value === "native" || value === "woocommerce") {
    return value;
  }

  return "all";
}

async function ProductsContent({
  searchParams,
}: {
  searchParams?: Promise<ProductsSearchParams>;
}) {
  const params = await searchParams;
  const activeStatus = normalizeStatusFilter(params?.status);
  const activeSource = normalizeSourceFilter(params?.source);
  const products = await listProductsForCurrentUser({
    status: activeStatus,
    source: activeSource,
  });
  const shopifyNotice = getShopifyNotice(params);
  const nativeImportNotice = getNativeImportNotice(params);

  return (
    <div className="page-enter grid gap-4">
      {shopifyNotice ? (
        <div
          className={
            shopifyNotice.tone === "warning"
              ? "rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground"
              : "rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary"
          }
        >
          {shopifyNotice.message}
        </div>
      ) : null}

      {nativeImportNotice ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {nativeImportNotice.message}
        </div>
      ) : null}

      <ProductFilters
        activeStatus={activeStatus}
        activeSource={activeSource}
      />
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

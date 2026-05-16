import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ProductListSourceFilter,
  ProductListStatusFilter,
} from "@/types/product";

const statusFilters: Array<{
  value: ProductListStatusFilter;
  label: string;
}> = [
  { value: "all", label: "Tum urunler" },
  { value: "waiting", label: "Analiz bekleyen" },
  { value: "analyzed", label: "Analiz edilen" },
  { value: "optimized", label: "Optimize edilen" },
  { value: "low_score", label: "Dusuk skor" },
];

const sourceFilters: Array<{
  value: ProductListSourceFilter;
  label: string;
}> = [
  { value: "all", label: "Tum kaynaklar" },
  { value: "shopify", label: "Shopify" },
  { value: "native", label: "Web sitesi" },
];

function filterHref(params: {
  status: ProductListStatusFilter;
  source: ProductListSourceFilter;
}) {
  const query = new URLSearchParams();

  if (params.status !== "all") {
    query.set("status", params.status);
  }

  if (params.source !== "all") {
    query.set("source", params.source);
  }

  const queryString = query.toString();

  return queryString ? `/products?${queryString}` : "/products";
}

export function ProductFilters({
  activeStatus,
  activeSource,
}: {
  activeStatus: ProductListStatusFilter;
  activeSource: ProductListSourceFilter;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Katalog filtreleri</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Analiz icin odaklanacaginiz urunleri hizli ayirin.
          </p>
        </div>
        <Badge variant="outline">Sunucuda filtrelenir</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              asChild
              size="sm"
              variant={activeStatus === filter.value ? "default" : "outline"}
            >
              <Link
                href={filterHref({
                  status: filter.value,
                  source: activeSource,
                })}
              >
                {filter.label}
              </Link>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {sourceFilters.map((filter) => (
            <Button
              key={filter.value}
              asChild
              size="sm"
              variant={activeSource === filter.value ? "secondary" : "outline"}
            >
              <Link
                href={filterHref({
                  status: activeStatus,
                  source: filter.value,
                })}
              >
                {filter.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

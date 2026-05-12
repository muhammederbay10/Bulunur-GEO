import Link from "next/link";
import { Activity, ArrowRight, CircleAlert, Package, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const metrics = [
  { label: "Ürünler", value: "0", note: "İlk kaynak bekleniyor", icon: Package },
  {
    label: "Analiz edilen",
    value: "0",
    note: "Ürün analizi sonraki fazda bağlanacak",
    icon: Activity,
  },
  {
    label: "Optimize edilen",
    value: "0",
    note: "Onaylı iyileştirmeler burada özetlenecek",
    icon: Sparkles,
  },
  {
    label: "Dikkat isteyen",
    value: "0",
    note: "Düşük skor veya eksik bilgi uyarıları görünecek",
    icon: CircleAlert,
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="seller-surface p-6">
        <p className="text-sm font-medium text-primary">
          Katalog kontrol merkezi
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Bugün nereden başlayalım?
            </h1>
            <p className="mt-3 leading-7 text-muted-foreground">
              Onboarding tamamlandı. Sıradaki adım, ürünlerin geleceği kaynağı
              hazırlamak ve katalog görünümünü gerçek ürünlerle doldurmak.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/sources">
              Kaynakları hazırla
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="seller-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-3 text-4xl font-semibold">{metric.value}</p>
              </div>
              <metric.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {metric.note}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

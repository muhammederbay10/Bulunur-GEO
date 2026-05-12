import { Activity, CircleAlert, Package, Sparkles } from "lucide-react";

const metrics = [
  { label: "Ürünler", value: "0", note: "İlk kaynak bekleniyor", icon: Package },
  {
    label: "Analiz edilen",
    value: "0",
    note: "AI bağlantısı Faz 7'de eklenecek",
    icon: Activity,
  },
  {
    label: "Optimize edilen",
    value: "0",
    note: "Onay akışı sonraki fazlarda gelecek",
    icon: Sparkles,
  },
  {
    label: "Dikkat isteyen",
    value: "0",
    note: "Düşük skor görünümü için yer tutucu",
    icon: CircleAlert,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="industrial-panel p-6">
        <p className="font-mono text-xs uppercase text-primary">
          Katalog kontrol merkezi
        </p>
        <div className="mt-4 max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
            Panel hazır
          </h1>
          <p className="leading-7 text-muted-foreground">
            Onboarding tamamlandı. Bu ekran şimdilik katalog özetinin Faz 1
            kabuğudur; kaynak bağlantısı, ürünler, analiz sonuçları ve
            optimizasyon geçmişi sonraki fazlarda bağlanacak.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="industrial-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-3 text-4xl font-semibold">{metric.value}</p>
              </div>
              <metric.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{metric.note}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

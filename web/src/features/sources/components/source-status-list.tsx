import { Badge } from "@/components/ui/badge";
import type { SourceStore } from "@/types/source";

const sourceLabels = {
  native: "Web sitesi",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

const storeStatusLabels = {
  setup_pending: "Hazırlanıyor",
  active: "Hazır",
  syncing: "Senkronize ediliyor",
  error: "Hata var",
  disconnected: "Bağlantı kesildi",
};

const connectionStatusLabels = {
  pending: "Bağlantı bekliyor",
  connected: "Bağlı",
  error: "Hata var",
  revoked: "Yetki kaldırıldı",
  disconnected: "Bağlantı kesildi",
};

export function SourceStatusList({ stores }: { stores: SourceStore[] }) {
  if (!stores.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background/60 p-5">
        <p className="font-medium">Henüz ürün kaynağı yok</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Önce Shopify mağazanızı hazırlayın veya web sitenizden ürün eklemek
          için bir kaynak oluşturun.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {stores.map((store) => (
        <article
          key={store.id}
          className="rounded-lg border border-border bg-background/70 p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{store.name}</h3>
                <Badge variant="secondary">{sourceLabels[store.sourceType]}</Badge>
                <Badge variant={store.status === "error" ? "destructive" : "outline"}>
                  {storeStatusLabels[store.status]}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {store.sourceType === "shopify"
                  ? store.connection?.shopDomain ?? "Shopify alan adı bekleniyor"
                  : store.websiteUrl ?? "Web sitesi adresi eklenmedi"}
              </p>
            </div>
            {store.connection ? (
              <Badge variant="outline">
                {connectionStatusLabels[store.connection.status]}
              </Badge>
            ) : null}
          </div>
          {store.connection?.lastErrorMessage ? (
            <p className="mt-3 text-sm text-destructive">
              {store.connection.lastErrorMessage}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

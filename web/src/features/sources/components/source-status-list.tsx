"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  pending: "Yetki bekliyor",
  connected: "Bağlı",
  error: "Tekrar gerekli",
  revoked: "Yetki kaldirildi",
  disconnected: "Bağlantı kesildi",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Henüz senkronize edilmedi";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getShopifyAction(store: SourceStore) {
  const shopDomain = store.connection?.shopDomain;
  const connectionStatus = store.connection?.status;

  if (!shopDomain || !connectionStatus) {
    return null;
  }

  if (connectionStatus === "connected") {
    return "sync";
  }

  return "connect";
}

function SyncButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      await fetch("/api/shopify/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storeId }),
      });
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleSync}
      disabled={isPending}
    >
      <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      Senkronize et
    </Button>
  );
}

function DisconnectButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      await fetch("/api/shopify/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storeId }),
      });
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleDisconnect}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Unplug className="h-4 w-4" />
      )}
      Bağlantıyı kes
    </Button>
  );
}

export function SourceStatusList({ stores }: { stores: SourceStore[] }) {
  if (!stores.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background/60 p-5">
        <p className="font-medium">Henüz ürün kaynağı yok</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Önce Shopify mağazanızı bağlayın veya web sitenizden ürün eklemek
          için bir kaynak oluşturun.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {stores.map((store) => {
        const shopifyAction =
          store.sourceType === "shopify" ? getShopifyAction(store) : null;
        const shopDomain = store.connection?.shopDomain;
        const canDisconnect =
          store.sourceType === "shopify" &&
          Boolean(store.connection) &&
          store.connection?.status !== "pending" &&
          store.connection?.status !== "disconnected" &&
          store.connection?.status !== "revoked";

        return (
          <article
            key={store.id}
            className="rounded-lg border border-border bg-background/70 p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{store.name}</h3>
                  <Badge variant="secondary">{sourceLabels[store.sourceType]}</Badge>
                  <Badge variant={store.status === "error" ? "destructive" : "outline"}>
                    {storeStatusLabels[store.status]}
                  </Badge>
                  {store.connection ? (
                    <Badge
                      variant={
                        store.connection.status === "error"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {connectionStatusLabels[store.connection.status]}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                  {store.sourceType === "shopify"
                    ? shopDomain ?? "Shopify alan adı bekleniyor"
                    : store.websiteUrl ?? "Web sitesi adresi eklenmedi"}
                </p>
                {store.sourceType === "shopify" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Son senkronizasyon: {formatDateTime(store.lastSyncAt)}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {shopifyAction === "connect" && shopDomain ? (
                  <Button asChild size="sm" className="gap-2">
                    <a href={`/api/shopify/connect?shop=${encodeURIComponent(shopDomain)}`}>
                      <ExternalLink className="h-4 w-4" />
                      {store.connection?.status === "disconnected"
                        ? "Yeniden bağlan"
                        : "Shopify'a bağlan"}
                    </a>
                  </Button>
                ) : null}

                {shopifyAction === "sync" ? <SyncButton storeId={store.id} /> : null}

                {canDisconnect ? <DisconnectButton storeId={store.id} /> : null}

                {store.connection?.status === "disconnected" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Unplug className="h-4 w-4" />
                    Kayıtlı ürünler veritabanından gösterilir.
                  </div>
                ) : null}
              </div>
            </div>

            {store.connection?.status === "disconnected" ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Unplug className="h-4 w-4" />
                Shopify bağlantısı kesildi. Eski ürünler kayıtlı veri olarak
                görünür, fakat Shopify API işlemleri yeniden bağlanana kadar
                kapali kalır.
              </p>
            ) : null}

            {store.connection?.status === "connected" ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Shopify bağlı. Ürünler otomatik senkronize edilir; gerekirse
                tekrar senkronize edebilirsiniz.
              </p>
            ) : null}

            {store.connection?.lastErrorMessage ? (
              <p className="mt-3 text-sm text-destructive">
                {store.connection.lastErrorMessage}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

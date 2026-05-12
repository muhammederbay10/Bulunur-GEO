"use client";

import { useActionState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Loader2,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveNativeSource,
  saveShopifySource,
  type NativeSourceFormState,
  type ShopifySourceFormState,
} from "@/features/sources/actions";
import type { UserProfile } from "@/types/profile";
import type { SourceStore } from "@/types/source";

type SourceSetupPanelProps = {
  profile: UserProfile;
  stores: SourceStore[];
  databaseReady: boolean;
  canWriteSources: boolean;
  setupMessage?: string;
};

const nativeInitialState: NativeSourceFormState = { status: "idle" };
const shopifyInitialState: ShopifySourceFormState = { status: "idle" };

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

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

function FeedbackMessage({
  status,
  message,
}: {
  status: "idle" | "error" | "success";
  message?: string;
}) {
  if (!message || status === "idle") {
    return null;
  }

  const isSuccess = status === "success";

  return (
    <div
      className={
        isSuccess
          ? "rounded-md border border-primary/50 bg-primary/10 p-3 text-sm text-primary"
          : "rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
      }
    >
      {message}
    </div>
  );
}

function SourceStatusList({ stores }: { stores: SourceStore[] }) {
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

export function SourceSetupPanel({
  profile,
  stores,
  databaseReady,
  canWriteSources,
  setupMessage,
}: SourceSetupPanelProps) {
  const router = useRouter();
  const [nativeState, nativeAction, nativePending] = useActionState(
    saveNativeSource,
    nativeInitialState,
  );
  const [shopifyState, shopifyAction, shopifyPending] = useActionState(
    saveShopifySource,
    shopifyInitialState,
  );
  const formsDisabled = !databaseReady || !canWriteSources;
  const nativeStore = stores.find((store) => store.sourceType === "native");
  const shopifyStore = stores.find((store) => store.sourceType === "shopify");
  const successMessage =
    nativeState.status === "success"
      ? nativeState.message
      : shopifyState.status === "success"
        ? shopifyState.message
        : undefined;

  useEffect(() => {
    if (nativeState.status === "success" || shopifyState.status === "success") {
      const timeoutId = window.setTimeout(() => {
        router.replace("/dashboard");
      }, 1250);

      return () => window.clearTimeout(timeoutId);
    }
  }, [nativeState.status, router, shopifyState.status]);

  if (successMessage) {
    return (
      <section className="seller-surface mx-auto max-w-2xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold">
          Kaynak hazırlığı tamamlandı
        </h1>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
          {successMessage}
        </p>
        <p className="mt-5 text-sm text-muted-foreground">
          Panel yenileniyor ve dashboard ekranına geçiliyor...
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="seller-surface p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <p className="text-sm font-medium text-primary">Ürün kaynağı</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Ürünleriniz nereden gelecek?
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
              Shopify kullanıyorsanız mağaza bilginizi hazırlayın. Shopify
              kullanmıyorsanız web siteniz için bir ürün kaynağı oluşturun.
              Ürün içe aktarma ve senkronizasyon sonraki fazlarda bu kayıtlar
              üzerinden ilerleyecek.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-4">
            <p className="font-medium">Bu fazda yapılan</p>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Kaynak tercihi kaydedilir.</li>
              <li>Mağaza/kaynak kayıtları oluşturulur.</li>
              <li>Shopify OAuth ve ürün senkronizasyonu başlatılmaz.</li>
            </ul>
          </div>
        </div>
      </section>

      {!databaseReady && setupMessage ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {setupMessage}
        </div>
      ) : null}

      {databaseReady && !canWriteSources ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          SUPABASE_SERVICE_ROLE_KEY eksik. Phase 3 kaynak kayıtlarını yazmak
          için bu anahtarı sadece server ortamında `.env.local` içine ekleyin.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form action={shopifyAction} className="seller-surface p-5">
          <fieldset className="flex flex-col gap-5" disabled={formsDisabled || shopifyPending}>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Shopify Mağazamı Bağla</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Mağazanızdaki ürünleri otomatik senkronize etmek için Shopify
                  alan adınızı şimdiden hazırlayın.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="shopDomain">Shopify alan adı</Label>
              <Input
                id="shopDomain"
                name="shopDomain"
                defaultValue={shopifyStore?.connection?.shopDomain ?? ""}
                placeholder="magazam.myshopify.com"
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">
                Sadece mağaza alan adı kaydedilir. OAuth bağlantısı Phase 4 aşamasında
                başlatılacak.
              </p>
              <FieldError errors={shopifyState.fieldErrors?.shopDomain} />
            </div>

            <FeedbackMessage
              status={shopifyState.status}
              message={shopifyState.message}
            />

            <Button type="submit" className="w-full gap-2" disabled={formsDisabled || shopifyPending}>
              {shopifyPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Shopify hazırlığını kaydet
            </Button>
          </fieldset>
        </form>

        <form action={nativeAction} className="seller-surface p-5">
          <fieldset className="flex flex-col gap-5" disabled={formsDisabled || nativePending}>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Web Sitemden Ürün Ekle</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Shopify kullanmıyorsanız web siteniz için bir ürün kaynağı
                  oluşturun. URL/dosya ile içe aktarma Phase 5 aşamasında eklenecek.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="storeName">Kaynak adı</Label>
              <Input
                id="storeName"
                name="storeName"
                defaultValue={nativeStore?.name ?? profile.businessName ?? "Mağazam"}
                placeholder="Örn: Kuzey Outdoor"
              />
              <FieldError errors={nativeState.fieldErrors?.storeName} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="websiteUrl">Web sitesi URL</Label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                defaultValue={nativeStore?.websiteUrl ?? profile.websiteUrl ?? ""}
                placeholder="https://magazam.com"
              />
              <FieldError errors={nativeState.fieldErrors?.websiteUrl} />
            </div>

            <FeedbackMessage
              status={nativeState.status}
              message={nativeState.message}
            />

            <Button type="submit" className="w-full gap-2" disabled={formsDisabled || nativePending}>
              {nativePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Web sitesi kaynağını kaydet
            </Button>
          </fieldset>
        </form>
      </section>

      <section className="seller-surface p-5">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Kaynak durumu</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Bu liste yalnızca sizin mağaza/kaynak kayıtlarınızı gösterir.
              Kayıtlar server tarafında sahiplik kontrolüyle oluşturulur.
            </p>
          </div>
        </div>
        <SourceStatusList stores={stores} />
      </section>
    </div>
  );
}

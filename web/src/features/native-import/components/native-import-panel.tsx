"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Globe2,
  Loader2,
  Plus,
  Search,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  NativeUrlImportResponse,
  ScanResponse,
  ScrapePreviewItem,
} from "@/types/native-url-import";
import type { SourceStore } from "@/types/source";

type NativeImportPanelProps = {
  store: SourceStore;
};

type Notice = {
  kind: "success" | "warning" | "error";
  message: string;
};

type ScanMode = "listing" | "direct";

type ScanProgress = {
  mode: ScanMode;
  title: string;
  message: string;
  target: string;
};

const statusLabels = {
  ready: "Hazir",
  partial: "Eksik bilgi var",
  needs_review: "Kontrol gerekli",
  failed: "Basarisiz",
  excluded: "Haric",
  imported: "Aktarildi",
};

function getErrorMessage(response: unknown, fallback: string) {
  if (
    response &&
    typeof response === "object" &&
    "error" in response &&
    typeof response.error === "string"
  ) {
    return response.error;
  }

  return fallback;
}

function itemImageUrls(item: ScrapePreviewItem) {
  const rawImages = item.rawPayload.images;

  if (!Array.isArray(rawImages)) {
    return item.imageUrl ? [item.imageUrl] : [];
  }

  return rawImages.filter(
    (imageUrl): imageUrl is string => typeof imageUrl === "string",
  );
}

export function NativeImportPanel({ store }: NativeImportPanelProps) {
  const scanInFlightRef = useRef(false);
  const [listingUrl, setListingUrl] = useState(store.websiteUrl ?? "");
  const [directUrls, setDirectUrls] = useState("");
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isImporting, startImportTransition] = useTransition();
  const [isFallbackImporting, startFallbackTransition] = useTransition();

  const isScanning = scanProgress !== null;
  const selectedCount = selectedIds.length;
  const allPreviewIds = useMemo(
    () => scanResponse?.previewItems.map((item) => item.id) ?? [],
    [scanResponse],
  );

  function resetNotice() {
    setNotice(null);
  }

  function updateSelection(previewItemId: string, checked: boolean) {
    setSelectedIds((currentIds) => {
      if (checked) {
        return Array.from(new Set([...currentIds, previewItemId]));
      }

      return currentIds.filter((id) => id !== previewItemId);
    });
  }

  async function scan(payload: { url?: string; urls?: string[] }, mode: ScanMode) {
    if (scanInFlightRef.current) {
      setNotice({
        kind: "warning",
        message:
          "Tarama zaten devam ediyor. Sonuc hazir olana kadar yeni tarama baslatilamaz.",
      });
      return;
    }

    scanInFlightRef.current = true;
    resetNotice();
    setScanResponse(null);
    setSelectedIds([]);
    setScanProgress({
      mode,
      title:
        mode === "listing"
          ? "Urun listesi taraniyor"
          : "Tekil urunler taraniyor",
      message:
        mode === "listing"
          ? "Sayfadaki urun baglantilari bulunuyor ve guvenli onizleme kayitlari hazirlaniyor."
          : "Girdiginiz urun sayfalari guvenli sekilde kontrol ediliyor.",
      target:
        mode === "listing"
          ? (payload.url ?? "")
          : `${payload.urls?.length ?? 0} urun URLsi`,
    });

    try {
      const response = await fetch("/api/native/url-import/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ScanResponse;

      setScanResponse(body);

      if (!response.ok || !body.success) {
        setNotice({
          kind: "error",
          message:
            body.error ??
            "URL taramasi tamamlanamadi. Dosya veya manuel aktarimi kullanabilirsiniz.",
        });
        return;
      }

      setSelectedIds(body.previewItems.map((item) => item.id));
      setNotice({
        kind: body.failedItems?.length ? "warning" : "success",
        message: body.failedItems?.length
          ? `${body.previewItems.length} urun hazir, ${body.failedItems.length} sayfa alinamadi.`
          : `${body.previewItems.length} urun onizlemeye hazir.`,
      });
    } catch {
      setNotice({
        kind: "error",
        message:
          "Tarama sirasinda baglanti hatasi olustu. Biraz sonra tekrar deneyebilirsiniz.",
      });
    } finally {
      scanInFlightRef.current = false;
      setScanProgress(null);
    }
  }

  function handleListingScan() {
    void scan({ url: listingUrl }, "listing");
  }

  function handleDirectScan() {
    const urls = directUrls
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean)
      .slice(0, 20);

    void scan({ urls }, "direct");
  }
  function handleImportSelected() {
    if (!scanResponse?.scrapeJobId || selectedIds.length === 0) {
      setNotice({
        kind: "error",
        message: "Aktarilacak onizleme secilmedi.",
      });
      return;
    }

    startImportTransition(async () => {
      resetNotice();

      const response = await fetch("/api/native/url-import/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scrapeJobId: scanResponse.scrapeJobId,
          previewItemIds: selectedIds,
        }),
      });
      const body = (await response.json()) as NativeUrlImportResponse;

      if (!response.ok || !body.success) {
        setNotice({
          kind: "error",
          message: getErrorMessage(body, "Secilen urunler aktarilamadi."),
        });
        return;
      }

      setNotice({
        kind: "success",
        message: `${body.importedCount} urun katalog listesine aktarildi.`,
      });
      setSelectedIds([]);
    });
  }

  function handleFallbackSubmit(formData: FormData) {
    startFallbackTransition(async () => {
      resetNotice();

      const response = await fetch("/api/native/fallback-import", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as NativeUrlImportResponse;

      if (!response.ok || !body.success) {
        setNotice({
          kind: "error",
          message: getErrorMessage(body, "Urun aktarimi tamamlanamadi."),
        });
        return;
      }

      setNotice({
        kind: "success",
        message: `${body.importedCount} urun katalog listesine aktarildi.`,
      });
    });
  }

  return (
    <section className="seller-surface p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">
            <Globe2 className="h-6 w-6" />
          </div>
          <div>
            <p className="mono-label text-primary">Native import</p>
            <h2 className="mt-1 text-xl font-semibold">
              Web sitesi urunlerini ice aktar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {store.name} icin URL taramasi, tekil urun ekleme ve dosya
              aktarimi ayni native katalog kaynagina yazilir.
            </p>
          </div>
        </div>
        <Badge variant="outline">{store.market} / {store.language}</Badge>
      </div>

      {notice ? (
        <div
          className={
            notice.kind === "error"
              ? "mt-5 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
              : notice.kind === "warning"
                ? "mt-5 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-foreground"
                : "mt-5 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-background/70 p-4">
          {scanProgress ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-5 overflow-hidden rounded-xl border border-primary/30 bg-primary/10"
            >
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {scanProgress.title}
                    </h3>
                    <Badge variant="outline">
                      {scanProgress.mode === "listing"
                        ? "Liste taramasi"
                        : "Tekil tarama"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {scanProgress.message}
                  </p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {scanProgress.target}
                  </p>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden bg-primary/15">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          ) : null}

          <div className="grid gap-3">
            <Label htmlFor="native-listing-url">Urun liste URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="native-listing-url"
                type="url"
                value={listingUrl}
                onChange={(event) => setListingUrl(event.target.value)}
                placeholder="https://magazam.com/collections/all"
                disabled={isScanning}
              />
              <Button
                type="button"
                className="gap-2 sm:w-36"
                onClick={handleListingScan}
                disabled={isScanning || !listingUrl.trim()}
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {scanProgress?.mode === "listing" ? "Taraniyor" : "Tara"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <Label htmlFor="native-direct-urls">Tekil urun URLleri</Label>
            <textarea
              id="native-direct-urls"
              className="min-h-24 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
              value={directUrls}
              onChange={(event) => setDirectUrls(event.target.value)}
              placeholder="Her satira bir urun URLsi"
              disabled={isScanning}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 sm:w-fit"
              onClick={handleDirectScan}
              disabled={isScanning || !directUrls.trim()}
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {scanProgress?.mode === "direct"
                ? "Tekil urunler taraniyor"
                : "Tekil urunleri tara"}
            </Button>
          </div>

          {scanResponse ? (
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Onizleme</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scanResponse.previewItems.length} secilebilir urun bulundu.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIds(allPreviewIds)}
                    disabled={allPreviewIds.length === 0}
                  >
                    Tumunu sec
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={handleImportSelected}
                    disabled={
                      isImporting ||
                      !scanResponse.scrapeJobId ||
                      selectedCount === 0
                    }
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Secilenleri aktar
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {scanResponse.previewItems.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  const images = itemImageUrls(item);

                  return (
                    <article
                      key={item.id}
                      className="rounded-lg border border-border bg-background/70 p-3"
                    >
                      <div className="flex gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            updateSelection(item.id, value === true)
                          }
                          aria-label={`${item.title ?? "Urun"} sec`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-medium">
                              {item.title ?? "Baslik bulunamadi"}
                            </h4>
                            <Badge variant="secondary">
                              {statusLabels[item.status]}
                            </Badge>
                            <Badge variant="outline">
                              {item.extractionConfidence}/100
                            </Badge>
                          </div>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {item.productUrl}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {item.priceDisplay ?? "Fiyat bulunamadi"}
                            {item.brand ? ` - ${item.brand}` : ""}
                            {images.length > 0 ? ` - ${images.length} gorsel` : ""}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {scanResponse.failedItems?.length ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  {scanResponse.failedItems.length} sayfa aktarilabilir onizleme
                  uretmedi.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5">
          <form
            action={handleFallbackSubmit}
            className="rounded-xl border border-border bg-background/70 p-4"
          >
            <input type="hidden" name="mode" value="file" />
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold">CSV / Excel aktar</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Basit kolonlar: title, url, description, price, image_urls,
                  brand, sku, category, tags.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <Input name="file" type="file" accept=".csv,.tsv,.xlsx,text/csv" />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="mt-4 w-full gap-2"
              disabled={isFallbackImporting}
            >
              {isFallbackImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Dosyayi aktar
            </Button>
          </form>

          <form
            action={handleFallbackSubmit}
            className="rounded-xl border border-border bg-background/70 p-4"
          >
            <input type="hidden" name="mode" value="manual" />
            <h3 className="font-semibold">Manuel urun ekle</h3>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="manual-title">Urun adi</Label>
                <Input id="manual-title" name="title" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-url">Urun URL</Label>
                <Input id="manual-url" name="productUrl" type="url" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-description">Aciklama</Label>
                <textarea
                  id="manual-description"
                  name="description"
                  className="min-h-20 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="manual-price">Fiyat</Label>
                  <Input id="manual-price" name="priceDisplay" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-brand">Marka</Label>
                  <Input id="manual-brand" name="brand" />
                </div>
              </div>
              <Button
                type="submit"
                className="gap-2"
                disabled={isFallbackImporting}
              >
                {isFallbackImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Manuel urunu aktar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

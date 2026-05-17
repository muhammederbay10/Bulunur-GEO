"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  Loader2,
  PackageCheck,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  NativeUrlImportResponse,
  ScanResponse,
} from "@/types/native-url-import";

type NativeSetupImportRunnerProps = {
  initialUrl: string;
};

type ImportStep = "scan" | "import" | "done" | "error";

type RunnerState = {
  step: ImportStep;
  title: string;
  message: string;
  scannedCount: number;
  importedCount: number;
  error?: string;
};

const initialState: RunnerState = {
  step: "scan",
  title: "Ürün sayfanız taranıyor",
  message: "İlk 20 ürün bulunup güvenli önizleme kayıtları hazırlanıyor.",
  scannedCount: 0,
  importedCount: 0,
};

function getResponseError(response: unknown, fallback: string) {
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

export function NativeSetupImportRunner({
  initialUrl,
}: NativeSetupImportRunnerProps) {
  const router = useRouter();
  const runKeyRef = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RunnerState>(initialState);

  useEffect(() => {
    const runKey = `${initialUrl}:${attempt}`;

    if (runKeyRef.current === runKey) {
      return;
    }

    runKeyRef.current = runKey;
    let cancelled = false;

    async function runImport() {
      setState(initialState);

      try {
        const scanResponse = await fetch("/api/native/url-import/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: initialUrl }),
        });
        const scanBody = (await scanResponse.json()) as ScanResponse;

        if (cancelled) {
          return;
        }

        if (
          !scanResponse.ok ||
          !scanBody.success ||
          !scanBody.scrapeJobId ||
          scanBody.previewItems.length === 0
        ) {
          throw new Error(
            getResponseError(
              scanBody,
              "Bu URL'den aktarılabilir ürün bulunamadı. Kaynaklar ekranından tekil ürün, CSV/Excel veya manuel aktarım kullanabilirsiniz.",
            ),
          );
        }

        setState({
          step: "import",
          title: "Ürünler kataloğa aktarılıyor",
          message: `${scanBody.previewItems.length} ürün bulundu. Şimdi seçilebilir önizlemeler kataloğunuza yazılıyor.`,
          scannedCount: scanBody.previewItems.length,
          importedCount: 0,
        });

        const importResponse = await fetch("/api/native/url-import/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scrapeJobId: scanBody.scrapeJobId,
            previewItemIds: scanBody.previewItems.map((item) => item.id),
          }),
        });
        const importBody =
          (await importResponse.json()) as NativeUrlImportResponse;

        if (cancelled) {
          return;
        }

        if (!importResponse.ok || !importBody.success) {
          throw new Error(
            getResponseError(
              importBody,
              "Bulunan ürünler kataloğa aktarılamadı. Kaynaklar ekranından tekrar deneyebilirsiniz.",
            ),
          );
        }

        setState({
          step: "done",
          title: "Ürünler hazır",
          message: "Katalog sayfasına geçiyorsunuz.",
          scannedCount: scanBody.previewItems.length,
          importedCount: importBody.importedCount,
        });

        window.setTimeout(() => {
          const params = new URLSearchParams({
            native_imported: "1",
            product_count: String(importBody.importedCount),
          });

          router.replace(`/products?${params.toString()}`);
        }, 800);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          step: "error",
          title: "Aktarım tamamlanamadı",
          message:
            "URL taraması bu site için tamamlanamadı. Dosya, tekil ürün URL'si veya manuel ekleme ile devam edebilirsiniz.",
          scannedCount: 0,
          importedCount: 0,
          error:
            error instanceof Error
              ? error.message
              : "Beklenmeyen bir hata oluştu.",
        });
      }
    }

    void runImport();

    return () => {
      cancelled = true;
    };
  }, [attempt, initialUrl, router]);

  const isWorking = state.step === "scan" || state.step === "import";
  const progressValue =
    state.step === "scan" ? 35 : state.step === "import" ? 72 : 100;

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5 text-center">
      <div className="seller-surface p-6 md:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {state.step === "error" ? (
            <AlertTriangle className="h-7 w-7" />
          ) : state.step === "done" ? (
            <CheckCircle2 className="h-7 w-7" />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin" />
          )}
        </div>

        <p className="mono-label mt-5 text-primary">Native import</p>
        <h1 className="mt-3 text-2xl font-semibold md:text-3xl">
          {state.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          {state.message}
        </p>

        <div className="mt-6 overflow-hidden rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressValue}%` }}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/70 p-4 text-left">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe2 className="h-4 w-4 text-primary" />
              Taranan sayfa
            </div>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {initialUrl}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-4 text-left">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PackageCheck className="h-4 w-4 text-primary" />
              Katalog durumu
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {state.importedCount > 0
                ? `${state.importedCount} ürün hazır.`
                : state.scannedCount > 0
                  ? `${state.scannedCount} ürün aktarım için hazırlanıyor.`
                  : "Ürünler aranıyor."}
            </p>
          </div>
        </div>

        {state.error ? (
          <div className="mt-5 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-left text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        {state.step === "error" ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              className="gap-2"
              onClick={() => setAttempt((current) => current + 1)}
            >
              <RefreshCcw className="h-4 w-4" />
              Tekrar dene
            </Button>
            <Button asChild variant="outline">
              <Link href="/sources">Kaynaklara dön</Link>
            </Button>
          </div>
        ) : null}

        {isWorking ? (
          <p className="mt-5 text-xs text-muted-foreground">
            Bu ekran açıkken işlem devam eder. Ürünler hazır olunca katalog
            sayfasına otomatik geçilir.
          </p>
        ) : null}
      </div>
    </section>
  );
}

import { CheckCircle2, RefreshCw } from "lucide-react";

export function SourceSetupSuccess({
  message,
  setupMode,
}: {
  message: string;
  setupMode: boolean;
}) {
  return (
    <section className="seller-surface mx-auto max-w-2xl p-8 text-center">
      <div className="mx-auto flex h-16 w-16 motion-safe:animate-pulse items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-3xl font-semibold">
        Kaynak hazırlığı tamamlandı
      </h1>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
        {message}
      </p>
      <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-primary motion-safe:animate-pulse" />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 motion-safe:animate-spin" />
          {setupMode
            ? "Panel yenileniyor ve dashboard ekranına geçiliyor..."
            : "Kaynak durumu yenileniyor..."}
        </p>
      </div>
    </section>
  );
}

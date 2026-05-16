import { ThemeSwitcher } from "@/components/theme-switcher";

type AuthScreenShellProps = {
  children: React.ReactNode;
};

export function AuthScreenShell({ children }: AuthScreenShellProps) {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-5 text-foreground md:p-10">
      <div className="absolute right-5 top-5 z-20 md:right-10 md:top-10">
        <ThemeSwitcher />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold leading-none text-primary">
            AI Gorunurluk
          </h1>
          <p className="mono-label mt-3 text-muted-foreground">
            E-ticaret gorunurluk motoru
          </p>
        </div>

        {children}
      </div>
    </main>
  );
}

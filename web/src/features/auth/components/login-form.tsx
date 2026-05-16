"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Bir hata olustu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-2xl", className)} {...props}>
      <section className="seller-surface overflow-hidden p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="mono-label text-primary">Adim 1 / 1</p>
            <h1 className="mt-1 text-xl font-semibold">Giris</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paneli kullanmaya devam edin.
            </p>
          </div>
          <span className="h-2 w-10 rounded-full bg-primary" />
        </div>

        <form
          onSubmit={handleLogin}
          className="mx-auto grid w-full max-w-lg gap-4 animate-in fade-in slide-in-from-right-4 duration-300"
        >
          <div>
            <h2 className="text-xl font-semibold">Hesabiniza giris yapin</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Kayitli e-posta ve sifrenizle satici paneline devam edin.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">E-posta adresi</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@magazam.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <Label htmlFor="password">Sifre</Label>
                <Link
                  href="/auth/forgot-password"
                  className="mono-label ml-auto text-primary transition hover:text-foreground"
                >
                  Sifremi unuttum
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" className="gap-2" disabled={isLoading}>
              {isLoading ? "Giris yapiliyor..." : "Giris yap"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
            Hesabin yok mu?{" "}
            <Button asChild variant="link" className="h-auto px-1 py-0 align-baseline">
              <Link href="/auth/sign-up">Kayit ol</Link>
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

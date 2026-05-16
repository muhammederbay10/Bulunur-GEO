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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="seller-surface p-8 md:p-10">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">Giris yap</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Paneli kullanmaya devam etmek icin hesabinizla giris yapin.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="flex flex-col gap-6">
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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full gap-2 py-6" disabled={isLoading}>
              {isLoading ? "Giris yapiliyor..." : "Giris yap"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Hesabin yok mu?{" "}
            <Link
              href="/auth/sign-up"
              className="font-semibold text-primary transition hover:text-foreground"
            >
              Kayit ol
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

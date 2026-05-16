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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Sifreler eslesmiyor");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
        },
      });

      if (error) throw error;
      router.push("/auth/sign-up-success");
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
          <h2 className="text-2xl font-semibold">Hesap olustur</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Magazanizdaki urunleri AI aramalarina hazirlamak icin baslayin.
          </p>
        </div>

        <form onSubmit={handleSignUp}>
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
              <Label htmlFor="password">Sifre</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="repeat-password">Sifreyi tekrar gir</Label>
              <Input
                id="repeat-password"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full gap-2 py-6" disabled={isLoading}>
              {isLoading ? "Hesap olusturuluyor..." : "Hesap olustur"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Zaten hesabin var mi?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-primary transition hover:text-foreground"
            >
              Giris yap
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

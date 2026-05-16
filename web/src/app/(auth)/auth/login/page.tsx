import { AuthScreenShell } from "@/features/auth/components/auth-screen-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export default function Page() {
  return (
    <AuthScreenShell>
      <LoginForm />
    </AuthScreenShell>
  );
}

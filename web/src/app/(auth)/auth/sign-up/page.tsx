import { AuthScreenShell } from "@/features/auth/components/auth-screen-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default function Page() {
  return (
    <AuthScreenShell wide>
      <SignUpForm />
    </AuthScreenShell>
  );
}

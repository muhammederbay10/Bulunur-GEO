import { BulunurLogo } from "@/components/bulunur-logo";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BulunurLogo href="/" className="h-14 w-48" priority />
        </div>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Kayıt olduğun için teşekkürler!
              </CardTitle>
              <CardDescription>Onay için e-postanı kontrol et</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Kaydın başarıyla oluşturuldu. Giriş yapmadan önce hesabını
                onaylamak için e-postanı kontrol et.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

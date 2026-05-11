import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <Badge variant={"outline"} className="font-normal">
        Supabase ortam değişkenleri gerekli
      </Badge>
      <div className="flex gap-2">
        <Button size="sm" variant={"outline"} disabled>
          Giriş yap
        </Button>
        <Button size="sm" variant={"default"} disabled>
          Kayıt ol
        </Button>
      </div>
    </div>
  );
}

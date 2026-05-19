# Web Uygulamasi

Bu klasor BTK 2026 Hackathon projesinin Next.js web uygulamasini icerir.
Uygulama Turkiye odakli e-ticaret saticilari icin urun ice aktarma, AI/GEO
analizi, iyilestirme taslagi ve onayli yayinlama akislarini sunar.

## Ana Ozellikler

- Supabase Auth ile kayit ve giris
- Onboarding ve magaza profili
- Shopify OAuth baglantisi
- Shopify urun sync
- Shopify urun gorsellerini `image_urls` alanina kaydetme
- Native URL/category import
- Tekil urun URL import
- CSV/Excel/manual fallback import
- Dashboard ve urun listesi
- Tekil urun AI/GEO analizi
- GEO skor katmanlari
- Eksik bilgi akisi
- Iyilestirme taslagi
- Once/sonra karsilastirma
- Kopyalama/export/review aksiyonlari
- Shopify icin onayli guvenli alan yayinlama

## Teknoloji

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase SSR/Auth
- Supabase/PostgreSQL
- Shopify Admin GraphQL API
- Server-to-server AI service entegrasyonu

## Kurulum

Bagimliliklari yukleyin:

```bash
npm install
```

Env dosyasini olusturun:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` dosyasini doldurun.

## Env Degiskenleri

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AI_SERVICE_URL=
AI_SERVICE_SECRET=

SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_SCOPES=read_products,write_products
SHOPIFY_APP_URL=
SHOPIFY_REDIRECT_URI=
SHOPIFY_API_VERSION=2026-04
SHOPIFY_TOKEN_ENCRYPTION_KEY=
SHOPIFY_TEST_SHOP_DOMAIN=
```

Lokal gelistirme icin ornek:

```env
AI_SERVICE_URL=http://localhost:8001
SHOPIFY_APP_URL=http://localhost:3000
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/callback
```

Ngrok kullaniyorsaniz Shopify app URL ve redirect URI ngrok domainini
gostermelidir.

## Lokal Calistirma

```bash
npm run dev
```

Uygulama:

```text
http://localhost:3000
```

## Kontrol Komutlari

```bash
npm run lint
npm run build
```

Production build sonrasi calistirma:

```bash
npm run start
```

## Supabase Ayarlari

Supabase Auth icin lokal ayarlar:

```text
Site URL:
http://localhost:3000

Redirect URLs:
http://localhost:3000/auth/update-password
http://localhost:3000/auth/confirm
http://localhost:3000/onboarding
http://localhost:3000/dashboard
http://localhost:3000/sources
http://localhost:3000/sources?setup=1
```

Production'da ayni pathleri production domaininizle ekleyin.

Veritabani SQL dosyalari `web/.codex/sql/` altindadir. Bu projede SQL
degisiklikleri agent tarafindan otomatik uygulanmaz; Supabase SQL Editor
uzerinden manuel uygulanir.

## Shopify Ayarlari

Lokal:

```env
SHOPIFY_APP_URL=http://localhost:3000
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/callback
```

Production:

```env
SHOPIFY_APP_URL=https://your-domain.com
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/shopify/callback
```

Shopify Partner Dashboard tarafinda Allowed redirection URL ayni olmalidir:

```text
https://your-domain.com/api/shopify/callback
```

Gerekli scope:

```text
read_products,write_products
```

## AI Servisi

AI/GEO backend ayri bir servistir. Web uygulamasi bu servisi server tarafindan
cagirir.

Lokal:

```env
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_SECRET=shared-secret
```

Production:

```env
AI_SERVICE_URL=https://your-ai-service-domain.com
AI_SERVICE_SECRET=shared-secret
```

`AI_SERVICE_SECRET`, AI servisindeki `SERVICE_AUTH_SECRET_KEY` ile ayni
olmalidir.

## Vercel Deployment

Vercel'e deploy etmek icin:

1. GitHub reposunu Vercel'e baglayin.
2. Root Directory olarak `web` secin.
3. Framework olarak Next.js otomatik secilmelidir.
4. Environment Variables bolumune production env degerlerini girin.
5. Deploy edin.

Production icin degismesi gerekenler:

- `SHOPIFY_APP_URL`
- `SHOPIFY_REDIRECT_URI`
- `AI_SERVICE_URL`
- Supabase Auth Site URL
- Supabase Auth Redirect URLs

## Docker Notu

Web uygulamasi Vercel'e Docker olmadan deploy edilebilir. Lokal olarak Docker
Compose ile AI servisiyle birlikte calistirmak isterseniz repo root dizinindeki
`docker-compose.yml` dosyasini kullanin:

```bash
docker compose --env-file ./web/.env.local up --build
```

## Kod Organizasyonu

Onemli klasorler:

```text
src/app                 # App Router route ve API route'lari
src/features            # Feature bazli UI ve interaction katmani
src/lib                 # Service, repository, integration ve validation kodlari
src/types               # Paylasilan TypeScript tipleri
```

Shopify entegrasyonu:

```text
src/lib/shopify
src/lib/db/shopify-repository.ts
src/app/api/shopify
```

Native import:

```text
src/lib/native-url-import
src/features/native-import
src/app/api/native
```

AI entegrasyonu:

```text
src/lib/ai
src/lib/validation/ai-contract.ts
src/app/api/products/[productId]/analyze
src/app/api/products/[productId]/improve
```

## Gelistirme Kurallari

- Secretlar client componentlere tasinmaz.
- Browser kodu AI servisini direkt cagirmaz.
- Shopify publish islemleri kullanici onayi olmadan yapilmaz.
- SQL degisiklikleri `web/.codex/sql/` altinda dosyalanir ve manuel uygulanir.
- Varsayilan dogrulama `npm run lint` ve `npm run build` komutlaridir.
- UI seller-friendly ve Turkish-first olmalidir.


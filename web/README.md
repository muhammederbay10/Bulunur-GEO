# Web Application

This folder contains the Next.js web application for the BTK 2026 Hackathon project.
The app provides product import, AI/GEO analysis, improvement drafts, and approved publishing flows for Turkey-focused e-commerce merchants.

## Main Features

- Sign up and sign in with Supabase Auth
- Onboarding and store profile setup
- Shopify OAuth connection
- Shopify product sync
- Shopify product image persistence in the `image_urls` field
- Native URL/category import
- Single product URL import
- CSV/Excel/manual fallback import
- Dashboard and product list
- Single product AI/GEO analysis
- GEO score layers
- Missing-fact flow
- Improvement draft generation
- Before/after comparison
- Copy/export/review actions
- Approved safe field publishing for Shopify

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase SSR/Auth
- Supabase/PostgreSQL
- Shopify Admin GraphQL API
- Server-to-server AI service integration

## Setup

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Then fill in `.env.local`.

## Environment Variables

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

Example values for local development:

```env
AI_SERVICE_URL=http://localhost:8001
SHOPIFY_APP_URL=http://localhost:3000
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/callback
```

If you use ngrok, the Shopify app URL and redirect URI should point to your ngrok domain.

## Run Locally

```bash
npm run dev
```

The app will be available at:

```text
http://localhost:3000
```

## Validation Commands

```bash
npm run lint
npm run build
```

Run the production build locally:

```bash
npm run start
```

## Supabase Settings

Recommended local Supabase Auth settings:

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

For production, add the same paths with your production domain.

Database SQL files are stored under `web/.codex/sql/`. SQL changes are not applied automatically by agents in this project; apply them manually through the Supabase SQL Editor.

## Shopify Settings

Local:

```env
SHOPIFY_APP_URL=http://localhost:3000
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/callback
```

Production:

```env
SHOPIFY_APP_URL=https://your-domain.com
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/shopify/callback
```

The Allowed redirection URL in the Shopify Partner Dashboard must match:

```text
https://your-domain.com/api/shopify/callback
```

Required scopes:

```text
read_products,write_products
```

## AI Service

The AI/GEO backend is a separate service. The web application calls it from the server side.

Local:

```env
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_SECRET=shared-secret
```

Production:

```env
AI_SERVICE_URL=https://your-ai-service-domain.com
AI_SERVICE_SECRET=shared-secret
```

`AI_SERVICE_SECRET` must match `SERVICE_AUTH_SECRET_KEY` in the AI service.

## Vercel Deployment

To deploy on Vercel:

1. Connect the GitHub repository to Vercel.
2. Select `web` as the Root Directory.
3. Vercel should automatically detect Next.js as the framework.
4. Add the production environment variables in the Environment Variables section.
5. Deploy.

Values that must be changed for production:

- `SHOPIFY_APP_URL`
- `SHOPIFY_REDIRECT_URI`
- `AI_SERVICE_URL`
- Supabase Auth Site URL
- Supabase Auth Redirect URLs

## Docker Note

The web application can be deployed to Vercel without Docker. If you want to run it locally with the AI service through Docker Compose, use the `docker-compose.yml` file in the repository root:

```bash
docker compose --env-file ./web/.env.local up --build
```

## Code Organization

Important folders:

```text
src/app                 # App Router routes and API routes
src/features            # Feature-based UI and interaction layer
src/lib                 # Services, repositories, integrations, and validation code
src/types               # Shared TypeScript types
```

Shopify integration:

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

AI integration:

```text
src/lib/ai
src/lib/validation/ai-contract.ts
src/app/api/products/[productId]/analyze
src/app/api/products/[productId]/improve
```

## Development Rules

- Do not move secrets into client components.
- Browser code must not call the AI service directly.
- Shopify publish actions must not run without user approval.
- SQL changes should be saved under `web/.codex/sql/` and applied manually.
- Default validation commands are `npm run lint` and `npm run build`.
- The UI should be seller-friendly and Turkish-first.

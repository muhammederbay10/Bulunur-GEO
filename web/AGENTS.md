# AGENTS.md

Future agents working inside `web` must read and follow this file before starting any task. Treat the project docs as the source of truth and surface conflicts instead of guessing.

## 1. Read Order Before Coding

Read these files before making code changes:

1. `web/AGENTS.md`
2. `web/.codex/projectState.md`
3. `web/.codex/PRD.md`
4. `web/.codex/API_CONTRACT.md`
5. `web/.codex/docs/final-project-implementation-plan.md`
6. `web/.codex/docs/project-architecture-and-implementation-plan.md`
7. `web/.codex/docs/ui-ux-flow-and-visual-direction-plan.md`

Task-specific reference docs:

- If touching Shopify, also read the Shopify prototype docs named in `web/.codex/docs/project-architecture-and-implementation-plan.md` if those folders are present.
- If touching native import/scraping, also read the scraping prototype docs named in `web/.codex/docs/project-architecture-and-implementation-plan.md` if those folders are present.
- If touching Next.js routing, server actions, cookies, route handlers, caching, or server/client boundaries, first check local Next.js docs under `web/node_modules/next/dist/docs/` when available. This project may use a Next.js version with breaking changes.

## 2. Core Working Rules

1. Work inside `web` unless the task explicitly says otherwise.
2. Do not perform arbitrary refactors.
3. Change only what the task requires.
4. Preserve existing behavior unless the task requires changing it.
5. For larger tasks, identify affected files and write a short implementation plan before editing.
6. Docs, locked requirements, API contracts, and project state win over assumptions.
7. If docs conflict, mention the conflict clearly and ask for confirmation when the choice affects implementation.
8. Keep prototype folders as references unless the task explicitly asks to modify them.
9. Do not merge prototype apps wholesale into the main web app.

## 3. Documentation And Version Awareness

1. Prefer current official documentation for framework/library behavior when touching routing, auth, API integration, cookies, server/client boundaries, Shopify, Supabase/PostgreSQL, scraping, or deployment-sensitive behavior.
2. Check local framework docs first when they exist, especially `web/node_modules/next/dist/docs/`.
3. When a behavior depends on a changing external platform, such as Shopify Admin API, Supabase Auth/RLS, or Next.js App Router, verify against official docs before implementation.
4. Keep `web/.codex/API_CONTRACT.md`, implementation plans, and `web/.codex/projectState.md` aligned with code changes.
5. Follow current best practices for the actual framework/library versions installed in this project, not assumptions from memory.
6. When implementing or modifying important platform behavior, document which docs or local references were checked if the choice depends on version-sensitive behavior.

## 4. Tech Stack

The documented target stack is:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Supabase Auth.
- Supabase/PostgreSQL with Row Level Security.
- Zod for request/response validation.
- Server-only service modules for AI, Shopify, native import/scraping, persistence, publishing, and rollback.
- Shopify GraphQL Admin API for product sync and safe approved writeback.
- Native URL import/scraping as a bounded, server-side, preview-first flow.
- Separate AI/GEO backend owned by the AI engineer, called server-to-server through `web/.codex/API_CONTRACT.md`.

## 5. Product Summary

Bulunur is a Turkey-focused e-commerce GEO platform. It helps Turkish e-commerce sellers import products, analyze one selected Turkish product page for AI visibility, generate safe Turkish improvements, review before/after output, and copy, export, save, apply, or publish only approved changes.

The product is not a generic AI copywriter and must not promise guaranteed ranking in AI answers. It is an AI visibility workflow for e-commerce product pages with human approval.

## 6. Locked Product Scope

Confirmed MVP scope from the docs:

1. Sign up and sign in.
2. Onboarding with business/store context.
3. Product source choice: Shopify or Native.
4. Shopify OAuth and product sync.
5. Native product import path, at least one of URL import/scraping, CSV/Excel upload, or simple/manual demo fallback depending on team decision.
6. Dashboard with catalog metrics.
7. Products page with imported/fetched products and clear actions.
8. Product analysis trigger for one selected product.
9. Product analysis page with GEO score, score breakdown, signal cards, missing facts, main problems, and recommended action.
10. AI optimization trigger.
11. Missing-fact question flow when AI requests user-confirmed facts.
12. Before/after optimization result on the same product page.
13. Saved optimization result.
14. Copy/export actions.
15. Optional Shopify publish for safe approved fields if time allows.
16. Basic history/log visibility.

Boundaries:

- Do not run full LLM analysis automatically for every product.
- Do not publish automatically.
- Do not apply the whole AI payload blindly.
- Do not edit price, inventory, SKU, variants, shipping, tax, product status, collections, or media in the Shopify MVP.
- WooCommerce is documented as future/optional unless the team explicitly adds it to MVP.

## 7. Roles And Permissions

Documented roles are limited.

- Signed-out visitor: may use public/auth screens only.
- Signed-in seller/user: owns a profile, store/workspace, product records, analyses, optimization results, approvals, publish jobs, and logs.
- AI/GEO service: not a user role; it receives server-to-server requests from the backend and must not be trusted for user authorization.

Unclear:

- Team accounts, agencies, admins, and multi-role permissions are future scope or not defined.
- If roles beyond a basic signed-in owner are introduced, update this file and the database/RLS docs.

## 8. API / AI Integration Boundary

AI features are handled by the AI/GEO backend/API contract.

The web/backend layer owns:

- User authentication and authorization.
- Product ownership checks.
- Product discovery/import.
- Shopify/native integration.
- Persistence.
- Building `ProductInput`.
- Calling the AI service.
- Showing missing-fact questions.
- Persisting analysis and optimization results.
- Review, approval, export, apply, publish, rollback, and logs.

The AI/GEO engine owns:

- `analyze_product(product_input) -> GeoAnalysisOutput`.
- `improve_product(product_input, analysis, user_facts?) -> GeoImprovementOutput`.
- Turkish buyer-intent reasoning.
- Four-layer GEO scoring.
- Strategy selection.
- Missing-fact detection.
- Turkish content improvements.
- Schema.org Product JSON-LD generation/validation.
- Anti-hallucination validation.
- Estimated score improvement.

Rules:

1. Browser code must not call the AI/GEO service directly.
2. Backend/server code calls AI with `Authorization: Bearer <internal-service-secret>`.
3. Do not forward user JWTs to the AI/GEO service.
4. Treat user/store/product IDs sent to AI as context, not authentication proof.
5. Mirror `API_CONTRACT.md` in TypeScript types/Zod schemas and validate responses at the boundary.
6. Do not invent backend/AI behavior that is not in the contract.

## 9. UI/UX Rules

Use the documented product design principle: high-tech appearance, simple business workflow.

Project-specific UI rules:

1. The website/application UI must be Turkish by default. Use English only for developer-facing docs, code identifiers, API field names, library terms, or external platform terms that should remain unchanged.
2. Use a premium industrial noir direction: graphite/dark surfaces, safety orange action color, sharp radii, thin borders, subtle grid texture, and score instrumentation.
3. Keep the app usable for non-technical sellers.
4. The dashboard is a catalog/status dashboard, not the product analysis page.
5. Product analysis and optimization result should live on the product page.
6. Keep analysis visible while optimization runs.
7. Show before/after output on the same product page after optimization.
8. Provide clear loading, empty, error, retry, and partial-success states.
9. Explain score dimensions in plain Turkish.
10. Avoid unexplained AI/GEO jargon in primary UI.
11. Do not expose raw debug payloads as the main user experience.
12. Show warnings near affected fields.
13. Make approval/export/publish actions explicit and human-controlled.
14. Respect responsive layouts and reduced-motion preferences.
15. Avoid decorative fake charts and nested-card clutter.

## 10. Auth, Security, And Environment Rules

1. Use Supabase Auth for user authentication unless docs are updated.
2. Protect dashboard and product data routes.
3. Every route that reads or mutates product/workflow data must verify ownership server-side.
4. Frontend checks are not a replacement for server-side authorization or RLS.
5. Keep secrets server-side only.
6. Never expose Shopify secrets, Shopify access tokens, AI service secrets, encryption keys, Supabase service-role keys, or internal bearer tokens to client components.
7. Centralize environment variable reads in `src/lib/env` or the established env module.
8. Fail fast for missing required server env vars.
9. Store `AI_SERVICE_URL` and `AI_SERVICE_SECRET` server-side only.
10. Persist external API failures safely without leaking stack traces or secrets to users.

## 11. Database / SQL Rules

The documented platform database is Supabase/PostgreSQL.

High-level tables expected by the docs:

- `profiles`
- `stores`
- `store_connections`
- `products`
- `product_snapshots`
- `product_analyses`
- `optimization_results`
- `review_actions`
- `publish_jobs`
- `publish_logs`
- `scrape_jobs`
- `scrape_preview_items`

Rules:

1. Every major row must be traceable to a user/profile, store/workspace, and product where applicable.
2. Use JSONB for flexible AI outputs, raw connector payloads, scrape payloads, and snapshots without losing relational ownership.
3. Keep SQL/Supabase calls out of UI components where possible.
4. Centralize ownership-aware data access in repository/service functions.
5. Any schema, table, policy, function, or migration change must be provided as a script/migration in the correct project folder once that folder is established.
6. Do not silently apply database changes outside the documented workflow.
7. If the SQL/migration folder is not yet established, create or propose one explicitly before adding schema changes.

Known conflict:

- `API_CONTRACT.md` mentions MongoDB persistence, while the final implementation docs recommend Supabase/PostgreSQL. Treat Supabase/PostgreSQL as the current web platform direction and surface this mismatch when touching persistence docs or contract language.

## 12. Query And Performance Rules

1. Treat performance as an important product priority, especially on dashboard, product lists, import/sync flows, analysis pages, and publish/review workflows.
2. Avoid premature optimization, but do not ignore production-path performance.
3. Dashboard/list pages should query computed/indexable fields such as latest score, status, timestamps, source, and counts rather than scanning raw AI JSON.
4. Product list filters should be database-backed once real data exists.
5. AI analysis and optimization should run for one selected product at a time in the MVP.
6. Persist job/status timestamps so slow or failed operations are visible and retryable.
7. Shopify sync should be bounded, paginated, and resilient to user errors/rate limits.
8. Native scraping should be bounded by product count, response size, timeout, and concurrency.
9. Review pages should load the saved analysis/optimization result by ownership-aware IDs, not recompute AI output on render.
10. Do not block UI rendering on unnecessary external calls when saved data exists.
11. Prefer server components and server-side data loading where it reduces client JavaScript, but keep interactive components small and clearly scoped.
12. For any implementation that may affect bundle size, loading time, database query cost, external API volume, or perceived responsiveness, call out the performance impact in the task summary.

## 13. External Integration Rules

Shopify:

1. Shopify must be handled server-side.
2. OAuth must validate shop domain, signed state, and HMAC.
3. Tokens must be encrypted or stored through a secure token reference.
4. Use GraphQL Admin API for product reads/writes.
5. Sync products into normalized internal records.
6. Before writeback, fetch latest Shopify product, save rollback snapshot, update only approved safe fields, handle Shopify `userErrors`, save publish log, and re-sync.
7. MVP safe fields are `title`, `descriptionHtml`, `tags`, `seo.title`, and `seo.description` when explicitly approved.

Native import/scraping:

1. Server-side only.
2. Allow only HTTP/HTTPS.
3. Block localhost, private, and internal hosts.
4. Validate redirects.
5. Use timeouts, response-size limits, product-count limits, and concurrency limits.
6. Do not bypass CAPTCHA, login, or anti-bot protections.
7. Respect robots/access restrictions where applicable.
8. Use preview-first import and confidence statuses.
9. Provide CSV/manual fallback messaging when blocked or unreliable.

AI API:

1. Call through backend/server-only service modules.
2. Use the internal bearer secret.
3. Validate request/response shapes.
4. Handle timeouts and malformed responses as recoverable failures.
5. Persist raw contract output plus query-friendly summary fields.

## 14. Route And Code Organization Rules

Preferred project organization:

```text
src/app
  (auth)/
  (onboarding)/
  (dashboard)/
    dashboard/
    products/
    products/[productId]/
    sources/
    history/
    settings/
  api/
    ai/
    shopify/
    native/
    products/
    optimizations/
    publish/

src/features
  auth/
  onboarding/
  dashboard/
  products/
  analysis/
  optimization/
  review/
  publishing/
  shopify/
  native-import/

src/lib
  ai/
  shopify/
  scraping/
  publishing/
  db/
  auth/
  env/
  validation/

src/types
  ai-contract.ts
  product.ts
  shopify.ts
  scraping.ts
```

Route handler pattern:

1. Authenticate user.
2. Validate input.
3. Verify ownership.
4. Call service layer.
5. Persist result.
6. Return UI-safe response.

Code rules:

- UI components belong in feature folders or shared component areas following existing app patterns.
- Route handlers/API routes stay thin.
- Services own external calls and workflow logic.
- Repositories own database access and ownership filters.
- Validation schemas should live near `src/lib/validation` or the relevant feature.
- Shared contract types should live under `src/types`.

## 15. Testing And Validation

After each task, provide exact local validation steps:

1. Commands to run.
2. Pages/routes to open.
3. User actions to take.
4. Expected results.
5. Any untested parts and why.

Project-specific validation rule:

- Do not start a local dev server or run browser-based local testing unless the user explicitly asks for it.
- Default validation is `npm.cmd run lint` and `npm.cmd run build`, followed by clear local testing instructions for the user.
- If the user reports a local runtime/browser issue, debug it together from the reported error, screenshots, console output, or terminal logs.

For risky areas, add or update tests around:

- Ownership-aware data access.
- Env validation.
- AI request/response validation.
- Shopify HMAC/state/domain validation.
- Shopify payload mapping.
- Native URL validation and SSRF protections.
- Scraping extraction/confidence helpers.
- Review/approval/publish field filtering.

Use browser verification for meaningful frontend changes and check responsive states when UI layout changes.

## 16. Task Completion Protocol

At the end of each implementation task:

1. Update `web/.codex/projectState.md`.
2. Summarize what changed.
3. List files modified.
4. List commands/tests run.
5. List pages/actions manually checked.
6. Note risks, assumptions, blockers, and follow-ups.
7. Include a short, high-quality suggested commit message for the completed task.
8. If code and docs disagree, surface the mismatch clearly.

Commit message guidance:

- Use a concise imperative subject, usually 50-72 characters.
- Prefer clear scopes when helpful, such as `phase0:`, `auth:`, `shopify:`, `ai:`, `db:`, or `ui:`.
- The message should explain the reviewable unit of work, not every file changed.
- If a task is not ready to commit, say so and explain why instead of inventing a commit message.

Do not mark a task complete if secrets were exposed, ownership checks were skipped, AI payloads are unvalidated, or publish/apply flows can run without explicit user approval.

## 17. Project Docs To Respect

Keep these docs aligned with code and decisions:

- `web/.codex/PRD.md`
- `web/.codex/API_CONTRACT.md`
- `web/.codex/projectState.md`
- `web/.codex/docs/final-project-implementation-plan.md`
- `web/.codex/docs/project-architecture-and-implementation-plan.md`
- `web/.codex/docs/ui-ux-flow-and-visual-direction-plan.md`
- This `web/AGENTS.md`

If code and docs disagree, do not silently pick one. Report the mismatch, explain the implementation impact, and update the relevant doc when the task includes documentation maintenance.

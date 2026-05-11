# API Route Boundaries

Phase 0 creates the route namespace only. Future phases should add route handlers under:

- `ai/`
- `shopify/`
- `native/`
- `products/`
- `optimizations/`
- `publish/`

Route handlers must authenticate users, validate input, verify ownership, call service modules, persist results, and return UI-safe responses.

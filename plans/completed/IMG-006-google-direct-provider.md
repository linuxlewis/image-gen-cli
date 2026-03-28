# IMG-006 Google Direct Provider

## Goal

Add a Google direct provider adapter that supports the planned Gemini and Imagen canonical models
with explicit canonical-to-raw naming, provider request mapping, and normalized result output.

## Decisions

- Added `src/providers/google/models.ts` as the single source of truth for Google direct canonical
  ids, raw ids, and API method selection.
- Added `src/providers/base.ts`, `src/providers/google.ts`, and `src/providers/google/adapter.ts`
  to expose importable provider modules, build Google REST requests, execute them through the shared
  HTTP client, and normalize provider responses into a provider result shape that preserves raw
  response data.
- Updated `src/registry/routes.ts` to derive Google route entries from the shared Google model map
  so registry metadata and adapter logic cannot drift independently.

## Validation

- `pnpm lint`
- `pnpm check`
- `pnpm test`
- `pnpm coverage`
- `pnpm build`

# IMG-004 Shared Plumbing

## Goal

Add reusable provider-facing utilities for environment loading, HTTP requests, normalized output
rendering, and shared error types without coupling unrelated commands to unused provider
configuration.

## Decisions

- Added `src/config/env.ts` for lazy provider API key lookup and validation.
- Added `src/http/client.ts` for fetch-based requests with normalized network and non-2xx failures.
- Added `src/io/outputs.ts` for provider-agnostic output rendering helpers.
- Added `src/core/errors.ts` for typed application, config, and HTTP errors.

## Validation

- `pnpm lint`
- `pnpm check`
- `pnpm test`
- `pnpm coverage`
- `pnpm build`

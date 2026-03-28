# IMG-005 OpenAI Direct Provider

## Goal

Add an importable OpenAI direct-provider adapter for canonical GPT image models without coupling the
current CLI discovery commands to generation wiring.

## Decisions

- Added `src/providers/base.ts` for provider-agnostic generation request and normalized result types.
- Added `src/providers/openai.ts` for OpenAI-specific route detection, request mapping, auth lookup,
  HTTP execution, and response normalization.
- Kept model selection canonical-model-first and translated to provider payloads only through route
  metadata from the registry.
- Preserved the raw OpenAI response alongside normalized assets and token usage for later JSON and
  file-output work.

## Validation

- `pnpm lint`
- `pnpm check`
- `pnpm test`
- `pnpm coverage`
- `pnpm build`

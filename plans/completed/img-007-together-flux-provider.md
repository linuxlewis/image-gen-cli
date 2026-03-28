# IMG-007 Together FLUX Provider

## Goal

Add a Together provider adapter for the planned FLUX canonical models while keeping provider route
identifiers centralized in the registry and returning a normalized generation result shape.

## Decisions

- Aligned `src/providers/together.ts` with the shared provider-generation contract from
  `src/providers/base.ts`, using canonical model ids, shared HTTP client wiring, request translation,
  and normalized output mapping.
- Kept Together route identifiers in the registry and resolved them through canonical model ids
  instead of hardcoding FLUX route slugs in provider call sites.
- Covered Together-specific behavior with unit tests for supported-model detection, request mapping,
  missing credential failure, request execution, and normalized response output.

## Validation

- `pnpm lint`
- `pnpm check`
- `pnpm test`
- `pnpm coverage`
- `pnpm build`

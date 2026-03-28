# Quality Notes

## Current State

- CLI scaffold is in place with build, lint, typecheck, and unit test scripts.
- Hand-authored registry primitives now cover canonical model, provider, route lookup, and alias resolution behavior.
- Shared provider plumbing now covers lazy env lookup, HTTP error normalization, and output rendering helpers.
- OpenAI direct-provider plumbing now covers supported-model detection, route-driven request mapping,
  auth/config failures, and normalized response shaping with raw response preservation.
- Together provider support now covers FLUX route resolution, request translation, and normalized response handling.
- Google direct provider coverage now includes canonical-to-raw model translation, request mapping, lazy Google auth failure, and normalized Gemini/Imagen result handling with raw response retention.
- Coverage can be calculated with `pnpm coverage`.
- Help output, documented `pnpm dev -- ...` pass-through invocation shapes, read-only discovery command output, shared env utilities, HTTP client helpers, and normalized output rendering are covered by unit tests.
- Together FLUX provider tests exercise canonical-model route mapping, provider request translation, missing credential handling, auth error mapping, and normalized generate results.
- HTTP client regression coverage now includes raw byte payload passthrough so binary request bodies are not JSON-normalized.
- Replicate provider coverage now exercises supported-route detection, request translation, async prediction polling, auth gating, terminal failure handling, and normalized output metadata shaping.

## Known Gaps

- No integration tests that execute the built binary.
- No release or publish workflow yet.

# Quality Notes

## Current State

- CLI scaffold is in place with build, lint, typecheck, and unit test scripts.
- Hand-authored registry primitives now cover canonical model, provider, route lookup, and alias resolution behavior.
- Shared provider plumbing now covers lazy env lookup, HTTP error normalization, and output rendering helpers.
- Coverage can be calculated with `pnpm coverage`.
- Help output, documented `pnpm dev -- ...` pass-through invocation shapes, read-only discovery command output, shared env utilities, HTTP client helpers, and normalized output rendering are covered by unit tests.

## Known Gaps

- No integration tests that execute the built binary.
- No release or publish workflow yet.

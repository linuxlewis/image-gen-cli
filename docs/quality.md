# Quality Notes

## Current State

- CLI scaffold is in place with build, lint, typecheck, and unit test scripts.
- Hand-authored registry primitives now cover canonical model, provider, route lookup, and alias resolution behavior.
- Coverage can be calculated with `pnpm coverage`.
- Help output and read-only discovery command output are covered by unit tests.

## Known Gaps

- No integration tests that execute the built binary.
- No release or publish workflow yet.

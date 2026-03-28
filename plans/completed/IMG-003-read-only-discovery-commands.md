# IMG-003 Read-Only Discovery Commands

## Scope

Add network-free CLI discovery commands for providers, models, and routes while keeping the process
entrypoint thin.

## Decisions

- Keep `src/cli.ts` as a minimal process wrapper and move parsing and dispatch into `src/run-cli.ts`.
- Implement one importable module per discovery command under `src/commands/`.
- Render deterministic human-readable tables from registry data so tests can assert exact output.
- Support initial filters at the runtime layer instead of adding a larger CLI parsing framework.

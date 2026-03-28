# ARCHITECTURE.md

## CLI-Oriented Layering

This repo is not a monorepo, but it still follows explicit dependency boundaries so agents can make
safe changes without guessing.

```text
cli -> run-cli -> commands -> registry/providers/io/config/http/core
```

## Layer Responsibilities

| Layer | Purpose | Rules |
|------|---------|-------|
| `src/cli.ts` | Process entrypoint | Reads `process.argv`, invokes the runtime function, exits with a code |
| `src/run-cli.ts` | CLI runtime orchestration | Coordinates output and command dispatch; should stay small |
| `src/commands/**` | Command behavior | Keep command rendering and orchestration importable and testable |
| `src/registry/**` | Model-first source of truth | Own canonical model ids, aliases, provider ids, and route lookup |
| `src/providers/**` | Provider adapters | Translate normalized requests into provider-specific HTTP calls and normalized results |
| `src/io/**` | Output formatting and persistence | Render CLI output and save generated assets |
| `src/config/**` and `src/http/**` | Shared support code | Centralize env validation and HTTP behavior |
| `src/core/**` | Shared types and errors | Keep low-level contracts stable and reusable |

## Dependency Rules

1. `src/cli.ts` may import runtime helpers, but runtime helpers should not depend on process state.
2. New commands should expose pure helpers first and wire them into the CLI second.
3. Command modules may depend on registry, provider, config, HTTP, and IO helpers, but registry code should stay free of CLI concerns.
4. Provider adapters should consume canonical model intent plus route metadata; they should not redefine the registry.
5. Tests should target importable modules, not spawned child processes, unless process behavior is the thing under test.
6. Docs and plans are part of the system. Keep them current when structure changes or when the public CLI surface changes.

## Adding New Commands

1. Add a module for the command behavior under `src/commands/`.
2. Add tests next to the implementation or in the same folder.
3. Wire the command into `run-cli.ts`.
4. Update `README.md` and `AGENTS.md` if the public surface area changes.

## Current MVP Structure

- Discovery commands are fully registry-backed and make no network calls.
- `generate` is the only mutating command. It resolves a canonical model id to one provider route,
  constructs the provider adapter, executes the request, then renders text or JSON output and
  optionally saves assets.
- Route ambiguity is resolved at the CLI layer by requiring `--provider` when a canonical model maps
  to multiple provider routes.

## Practical Ownership Map

- `src/run-cli.ts`: help text, arg normalization, flag parsing, exit code behavior
- `src/commands/generate.ts`: route selection and provider execution orchestration
- `src/io/generate-output.ts`: output rendering and `--output-dir` persistence
- `src/registry/models.ts`: canonical ids, aliases, vendor metadata, family membership
- `src/registry/routes.ts`: provider route definitions and route-level confidence/status notes
- `src/providers/openai.ts`, `src/providers/google/**`, `src/providers/together.ts`, `src/providers/replicate.ts`: provider-specific request and response translation

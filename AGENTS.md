# AGENTS.md

This is the map. Not the manual.

## Repository Overview

This repository is a TypeScript CLI project using `pnpm`. It is intentionally small, but it follows
agent-first repo conventions so the codebase can scale without losing structure.
The current MVP exposes registry-backed discovery commands plus a route-backed `generate` command
with text, JSON, and file-save output modes.

## Quick Navigation

| What | Where |
|------|-------|
| User-facing command overview | [README.md](./README.md) |
| Code organization and dependency rules | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Model registry rules | [docs/model-registry-principles.md](./docs/model-registry-principles.md) |
| Documentation catalog | [docs/catalog.md](./docs/catalog.md) |
| Testing guidance | [docs/testing.md](./docs/testing.md) |
| Quality notes and gaps | [docs/quality.md](./docs/quality.md) |
| Design records | [docs/design/README.md](./docs/design/README.md) |
| Active plans | [plans/active/README.md](./plans/active/README.md) |
| Completed plans | [plans/completed/README.md](./plans/completed/README.md) |

## Stack

pnpm · TypeScript · tsx · tsup · Vitest · Biome

## Current MVP Surface

Public commands:

- `providers list`
- `models list [--family <family>] [--provider <provider>]`
- `routes list --model <model> [--provider <provider>]`
- `generate --model <model> --prompt <prompt> [--provider <provider>] [--json] [--output-dir <dir>]`

Supported providers:

- `openai` via `OPENAI_API_KEY`
- `google` via `GOOGLE_API_KEY`
- `together` via `TOGETHER_API_KEY`
- `replicate` via `REPLICATE_API_TOKEN`

Supported canonical model families:

- `gpt-image`
- `gemini-image`
- `imagen`
- `flux`
- `kling`

Source-of-truth files for current behavior:

- `src/run-cli.ts`: command parsing, help output, and exit-code behavior
- `src/commands/*.ts`: command-specific rendering and generate orchestration
- `src/registry/models.ts`: canonical ids, aliases, and model metadata
- `src/registry/routes.ts`: provider-route definitions and route-level notes
- `src/registry/providers.ts`: provider ids, types, and display names
- `src/providers/*.ts`: provider adapters
- `src/providers/google/models.ts`: shared Google direct-model mapping used by both registry and adapter code
- `src/io/generate-output.ts`: text output, JSON output, and file-save behavior

## Architecture Snapshot

The dependency shape is:

`src/cli.ts` -> `src/run-cli.ts` -> command modules -> registry/provider/io/config helpers

Working module map:

- `src/cli.ts` is the only process entrypoint and owns `process.argv` plus process exit behavior
- `src/run-cli.ts` parses command arguments, validates flags, and delegates to command modules
- `src/commands/` contains user-visible command behavior and rendering
- `src/registry/` owns canonical model ids, aliases, provider definitions, and route lookup
- `src/providers/` owns provider-specific request/response translation
- `src/config/` owns lazy environment-variable loading and validation
- `src/http/` owns shared fetch/error handling
- `src/io/` owns CLI output rendering and generated-asset persistence
- `src/core/` owns shared types and error classes

## Resume Without Chat History

If you are picking up work cold:

1. Read `README.md` for the current user-facing MVP.
2. Read `ARCHITECTURE.md` for dependency boundaries.
3. Read `docs/model-registry-principles.md` before changing canonical models, aliases, or routes.
4. Check `plans/active/` and `docs/quality.md` for in-flight work and known gaps.
5. Inspect `src/run-cli.ts` and the matching command module before changing CLI behavior.

Recent durable implementation notes live in `plans/completed/`. Read the most relevant ticket note
before changing generation plumbing or provider adapters.

Common change locations:

- Add or change a public command: update `src/run-cli.ts`, add or edit `src/commands/*`, then update `README.md` and this file.
- Add or change a provider: update `src/registry/providers.ts`, `src/config/env.ts`, provider adapter files, registry routes, and tests.
- Add or change a model or alias: update `src/registry/models.ts`, then verify route coverage in `src/registry/routes.ts` and docs.
- Change output behavior: update `src/io/generate-output.ts` and command tests.

## Key Rules

1. Keep the CLI entrypoint thin. Put behavior in importable modules so it remains testable.
2. Prefer pure functions for parsing and output shaping; let `src/cli.ts` handle process wiring.
3. Generated output belongs in `dist/` only. Never hand-edit built artifacts.
4. Plans and design decisions live in the repo. If it matters, write it down under `plans/` or `docs/`.
5. Mock external API responses in tests, but exercise the full internal lifecycle around them: parse, orchestration, state changes, and output.
6. Run `pnpm lint && pnpm test && pnpm coverage && pnpm build` before considering work complete.

## Before You Start a Task

1. Read this file.
2. Check `plans/active/` for ongoing work.
3. Read [ARCHITECTURE.md](./ARCHITECTURE.md) before introducing new modules or directories.
4. Read [docs/model-registry-principles.md](./docs/model-registry-principles.md) before changing model,
   registry, alias, or provider-routing logic.
5. Read [README.md](./README.md) if the task affects the public CLI surface or examples.

## When You're Done

1. Run `pnpm lint && pnpm test && pnpm coverage && pnpm build`.
2. Update [docs/quality.md](./docs/quality.md) if you improved coverage or fixed a known gap.
3. Update `README.md` and this file if the public CLI surface, provider matrix, or handoff path changes.
4. Add or update a plan or design note if the change affects repo structure.

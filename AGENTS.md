# AGENTS.md

This is the map. Not the manual.

## Repository Overview

This repository is a TypeScript CLI project using `pnpm`. It is intentionally small, but it follows
agent-first repo conventions so the codebase can scale without losing structure.

## Quick Navigation

| What | Where |
|------|-------|
| Code organization and dependency rules | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Documentation catalog | [docs/catalog.md](./docs/catalog.md) |
| Quality notes and gaps | [docs/quality.md](./docs/quality.md) |
| Design records | [docs/design/README.md](./docs/design/README.md) |
| Active plans | [plans/active/README.md](./plans/active/README.md) |
| Completed plans | [plans/completed/README.md](./plans/completed/README.md) |

## Stack

pnpm · TypeScript · tsx · tsup · Vitest · Biome

## Key Rules

1. Keep the CLI entrypoint thin. Put behavior in importable modules so it remains testable.
2. Prefer pure functions for parsing and output shaping; let `src/cli.ts` handle process wiring.
3. Generated output belongs in `dist/` only. Never hand-edit built artifacts.
4. Plans and design decisions live in the repo. If it matters, write it down under `plans/` or `docs/`.
5. Run `pnpm lint && pnpm test && pnpm build` before considering work complete.

## Before You Start a Task

1. Read this file.
2. Check `plans/active/` for ongoing work.
3. Read [ARCHITECTURE.md](./ARCHITECTURE.md) before introducing new modules or directories.

## When You're Done

1. Run `pnpm lint && pnpm test && pnpm build`.
2. Update [docs/quality.md](./docs/quality.md) if you improved coverage or fixed a known gap.
3. Add or update a plan or design note if the change affects repo structure.

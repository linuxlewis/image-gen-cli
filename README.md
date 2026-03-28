# image-gen-cli

An agent-friendly TypeScript CLI scaffold using `pnpm`, `tsx`, `tsup`, `vitest`, and Biome.

## Quick Start

```bash
pnpm install
pnpm dev -- --help
pnpm test
pnpm coverage
pnpm lint
pnpm build
```

## Repository Map

- `AGENTS.md`: first stop for agents working in the repo
- `ARCHITECTURE.md`: code organization and dependency rules
- `docs/model-registry-principles.md`: source of truth for canonical model IDs and provider routes
- `docs/`: documentation, quality notes, and design records
- `plans/`: active and completed work plans
- `src/`: CLI source code

## Commands

- `pnpm dev`
- `pnpm dev -- providers list`
- `pnpm dev -- models list --family flux`
- `pnpm dev -- routes list --model flux-2-pro`
- `pnpm build`
- `pnpm start --help`
- `pnpm check`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm test`
- `pnpm coverage`
- `pnpm test:watch`
- `pnpm format`

## Discovery Commands

The CLI now exposes read-only discovery commands backed by the in-repo registry. These commands do
not make network calls.

```bash
pnpm dev -- providers list
pnpm dev -- models list
pnpm dev -- models list --family flux
pnpm dev -- models list --provider google
pnpm dev -- routes list --model flux-2-pro
pnpm dev -- routes list --model flux-pro
pnpm dev -- routes list --model flux-2-pro --provider together
```

`providers list` shows registered provider ids, types, and display names.

`models list` shows canonical model ids with family, vendor, lifecycle metadata, and the providers
that expose each model. Supported filters:

- `--family <family>`
- `--provider <provider>`

`routes list` shows the provider routes for one canonical model id or alias. Required and optional
filters:

- `--model <model>`
- `--provider <provider>`

# image-gen-cli

An agent-friendly TypeScript CLI for image-model discovery and route-backed generation using `pnpm`,
`tsx`, `tsup`, `vitest`, and Biome.

## Quick Start

```bash
pnpm install
pnpm dev -- --help
pnpm test
pnpm coverage
pnpm lint
pnpm build
```

## MVP Scope

The current MVP has two capabilities:

- Read-only registry discovery for providers, canonical models, and provider routes
- Image generation through one selected provider route with text or JSON output and saved files by default

The CLI is model-first: users select a canonical model id or alias, and the registry resolves that
to a provider route.

## Repository Map

- `AGENTS.md`: first stop for agents working in the repo
- `ARCHITECTURE.md`: code organization and dependency rules
- `skills/image-gen-cli/SKILL.md`: installable agent skill for using this CLI
- `docs/model-registry-principles.md`: source of truth for canonical model IDs and provider routes
- `docs/`: documentation, quality notes, and design records
- `plans/`: active and completed work plans
- `src/`: CLI source code

For future delegated work, the quickest handoff path is: `README.md` -> `AGENTS.md` ->
`ARCHITECTURE.md` -> `docs/model-registry-principles.md` -> the relevant file in
`plans/completed/`.

## Install And Run

During development:

```bash
pnpm dev -- --help
pnpm dev -- providers list
pnpm dev -- models list
pnpm dev -- routes list --model imagen-4-fast
pnpm dev -- generate --model imagen-4-fast --prompt "A studio product shot"
```

After build:

```bash
pnpm build
pnpm start -- --help
```

## Agent Skill

The repo ships an installable skill at `skills/image-gen-cli/SKILL.md` for agents that need
canonical model discovery, route inspection, or `generate` usage without reopening the broader repo
docs.

Validated local workflow:

```bash
python3 /home/sbolgert/.npm-global/lib/node_modules/openclaw/skills/skill-creator/scripts/package_skill.py \
  skills/image-gen-cli \
  dist/skill-packages

/home/sbolgert/.npm-global/lib/node_modules/openclaw/dist/extensions/acpx/node_modules/.bin/skillflag install \
  skills/image-gen-cli \
  --agent codex \
  --scope cwd \
  --force
```

The packaging command writes a distributable archive under `dist/skill-packages/`. The install
command validates non-interactive Codex installation from the raw skill directory in the current
working tree.

## Commands

```text
image-gen-cli providers list
image-gen-cli models list [--family <family>] [--provider <provider>]
image-gen-cli routes list --model <model> [--provider <provider>]
image-gen-cli generate --model <model> --prompt <prompt> [--provider <provider>] [--json] [--output-dir <dir>]
```

### `providers list`

Shows registered provider ids, provider type, and display name. This command is read-only and does
not make network calls.

Current providers:

- `openai` (`direct`)
- `google` (`direct`)
- `together` (`aggregated`)
- `replicate` (`aggregated`)

### `models list`

Shows canonical model ids with family, vendor, lifecycle metadata, confidence, and the providers
that expose each model.

Supported filters:

- `--family <family>`
- `--provider <provider>`

Current canonical model families:

- `gpt-image`
- `gemini-image`
- `imagen`
- `flux`
- `kling`

Current canonical model ids:

- `gpt-image-1.5`
- `gpt-image-1`
- `gpt-image-1-mini`
- `gemini-2.5-flash-image-preview`
- `imagen-4-fast`
- `imagen-4`
- `imagen-4-ultra`
- `flux-1-schnell`
- `flux-1-kontext-pro`
- `flux-2-pro`
- `flux-2-dev`
- `flux-2-flex`
- `kling-v1`

### `routes list`

Shows provider routes for one canonical model id or alias. Use `--model <model>` and optionally
`--provider <provider>`.

## Generate Command

`generate` resolves a canonical model id to one provider route, runs the selected provider adapter,
prints normalized output metadata for the generated assets, and saves generated assets to disk in the
current working directory by default. Use `--output-dir` to override that location.

```bash
pnpm dev -- generate --model imagen-4-fast --prompt "A studio product shot"
pnpm dev -- generate --model gpt-image-1 --prompt "A studio product shot"
pnpm dev -- generate --model flux-schnell --provider together --prompt "A studio product shot"
pnpm dev -- generate --model flux-2-pro --provider together --prompt "A studio product shot"
pnpm dev -- generate --model imagen-4-fast --prompt "A studio product shot" --json
pnpm dev -- generate --model imagen-4-fast --prompt "A studio product shot" --output-dir ./generated
```

Rules:

- `--model <model>` is required and accepts canonical ids or aliases
- `--prompt <prompt>` is required
- `--provider <provider>` is optional when the model resolves to exactly one route
- `--provider <provider>` is required when the model resolves to multiple routes
- `--json` renders stable structured output with canonical model, provider, provider model, raw response, and output references
- Generated assets save to deterministic file paths in the current working directory by default and those paths are included in the output
- `--output-dir <dir>` overrides the default save location and writes generated assets under the target directory
- Ambiguous models such as `flux-2-pro`, `flux-2-dev`, `flux-2-flex`, `flux-1-schnell`, and `flux-1-kontext-pro` require explicit provider selection because they currently route through both `together` and `replicate`

Example text output:

```text
Provider: google
Canonical model: imagen-4-fast
Provider model: imagen-4.0-fast-generate-001
Outputs: 1
Output 1: ... | mime=image/png
```

Example JSON output shape:

```json
{
  "canonicalModel": "imagen-4-fast",
  "outputs": [],
  "provider": "google",
  "providerModel": "imagen-4.0-fast-generate-001",
  "rawResponse": {}
}
```

## Environment Variables

Provider adapters load credentials lazily. Discovery commands do not require credentials.

- `OPENAI_API_KEY` for `openai`
- `GOOGLE_API_KEY` for `google`
- `TOGETHER_API_KEY` for `together`
- `REPLICATE_API_TOKEN` for `replicate`

## Route Snapshot

The current registry maps canonical models to provider routes like this:

- OpenAI direct routes for `gpt-image-1.5`, `gpt-image-1`, and `gpt-image-1-mini`
- Google direct routes for `gemini-2.5-flash-image-preview`, `imagen-4-fast`, `imagen-4`, and `imagen-4-ultra`
- Together aggregated routes for `flux-1-schnell`, `flux-1-kontext-pro`, `flux-2-pro`, `flux-2-dev`, and `flux-2-flex`
- Replicate aggregated routes for `flux-1-schnell`, `flux-1-kontext-pro`, `flux-2-pro`, `flux-2-dev`, `flux-2-flex`, and `kling-v1`

The detailed source of truth lives in [`src/registry/models.ts`](./src/registry/models.ts) and
[`src/registry/routes.ts`](./src/registry/routes.ts).

## Repo Handoff

If you are resuming implementation without prior chat context:

1. Read `AGENTS.md` for the module map, change workflow, and handoff path.
2. Read `ARCHITECTURE.md` before moving responsibilities across files.
3. Read `docs/model-registry-principles.md` before editing canonical model ids, aliases, or routes.
4. Read the matching ticket note in `plans/completed/` before extending a provider or output mode.

## Validation

Before handing off changes, run:

```bash
pnpm lint
pnpm test
pnpm coverage
pnpm build
```

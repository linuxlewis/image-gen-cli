---
name: image-gen-cli
description: Use when an agent needs registry-backed image model discovery or single-route image generation from this repo's CLI, including choosing canonical models, resolving provider routes, and using text, JSON, or file-save output modes.
---

# Image Gen CLI

Use this skill to inspect available image models and providers or generate images through the local
`image-gen-cli`.

## Quick start

- Run from this repo with `pnpm dev -- ...` during development.
- After build or installation, use `image-gen-cli ...`.
- Discovery commands are local and do not need API keys.
- `generate` needs the provider credential for the selected route:
  `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `TOGETHER_API_KEY`, or `REPLICATE_API_TOKEN`.

## Choose the model first

- Start from the canonical model id, not the provider model name.
- Use `models list` to discover canonical ids and aliases.
- Use `routes list --model <model>` before `generate` when provider routing is unclear.
- Treat aliases as input conveniences only; once resolved, keep reasoning in terms of the canonical id.

Canonical families currently shipped by the CLI:

- `gpt-image`
- `gemini-image`
- `imagen`
- `flux`
- `kling`

## Providers and routes

- Direct providers expose their own native model endpoint: `openai`, `google`.
- Aggregated providers broker another vendor's model: `together`, `replicate`.
- Canonical models can map to multiple routes. Provider choice does not change the canonical model; it changes the concrete route used to execute it.
- If `routes list --model <model>` shows more than one provider, pass `--provider` explicitly to `generate`.

These currently require `--provider together` or `--provider replicate`:

- `flux-1-schnell`
- `flux-1-kontext-pro`
- `flux-2-pro`
- `flux-2-dev`
- `flux-2-flex`

## Common command patterns

```bash
pnpm dev -- providers list
pnpm dev -- models list
pnpm dev -- models list --family flux
pnpm dev -- models list --provider google
pnpm dev -- routes list --model imagen-4-fast
pnpm dev -- routes list --model flux-2-pro --provider replicate
pnpm dev -- generate --model imagen-4-fast --prompt "A studio product shot"
pnpm dev -- generate --model flux-2-pro --provider together --prompt "A studio product shot"
```

## Output mode guidance

- Default text output is best for human-readable confirmation in the terminal.
- Use `--json` when another tool, agent step, or test needs deterministic structured output, including provider, canonical model, provider model, raw response, and output references.
- Use `--output-dir <dir>` when generated assets must be persisted to deterministic local file paths for later steps.
- `--json` and `--output-dir` can be combined when both machine-readable metadata and saved files are needed.

## Operating rules

- `generate` always requires `--model` and `--prompt`.
- Prefer `routes list` over guessing when a provider route may be ambiguous.
- If a prompt fails on one provider route, keep the canonical model fixed unless the user asked to change capabilities; first verify whether a different route for that same canonical model is intended.
- Do not invent provider-specific model ids in commands when the registry already exposes a canonical id or alias.

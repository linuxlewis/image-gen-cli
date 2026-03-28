# IMG-012 Installable Skill

## Goal

Add a distributable agent skill for the stabilized CLI and validate a real local package/install
workflow.

## Decisions

- Added the repo-local skill at `skills/image-gen-cli/SKILL.md` and kept it intentionally minimal so
  it covers canonical model selection, route discovery, provider ambiguity, and output-mode usage
  without duplicating the broader repo docs.
- Updated `README.md`, `AGENTS.md`, `docs/catalog.md`, and `docs/quality.md` so future agents can
  find the skill quickly and reuse the validated install workflow.
- Validated both packaging and installation locally with the provided tooling:
  `package_skill.py skills/image-gen-cli dist/skill-packages` and
  `skillflag install skills/image-gen-cli --agent codex --scope cwd --force`.

## Validation

- `python3 /home/sbolgert/.npm-global/lib/node_modules/openclaw/skills/skill-creator/scripts/package_skill.py skills/image-gen-cli dist/skill-packages`
- `/home/sbolgert/.npm-global/lib/node_modules/openclaw/dist/extensions/acpx/node_modules/.bin/skillflag install skills/image-gen-cli --agent codex --scope cwd --force`
- `pnpm lint`
- `pnpm test`
- `pnpm coverage`
- `pnpm build`

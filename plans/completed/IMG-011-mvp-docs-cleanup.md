# IMG-011 MVP Docs Cleanup

## Goal

Refresh repo docs so the current MVP command surface and architecture can be resumed from the repo
alone.

## Decisions

- Updated `README.md` to reflect the shipped discovery commands, `generate` behavior, provider
  environment variables, route coverage, and output modes.
- Updated `AGENTS.md` and `ARCHITECTURE.md` to document the current module map, generate flow, and
  repo handoff path for future delegated coding work.
- Updated `docs/quality.md` to note that the repo docs now track the implemented MVP surface.

## Validation

- `pnpm lint`
- `pnpm test`
- `pnpm coverage`
- `pnpm build`

# ARCHITECTURE.md

## CLI-Oriented Layering

This repo is not a monorepo, but it still follows explicit dependency boundaries so agents can make
safe changes without guessing.

```text
cli -> run-cli -> feature modules
```

## Layer Responsibilities

| Layer | Purpose | Rules |
|------|---------|-------|
| `src/cli.ts` | Process entrypoint | Reads `process.argv`, invokes the runtime function, exits with a code |
| `src/run-cli.ts` | CLI runtime orchestration | Coordinates output and command dispatch; should stay small |
| `src/**` feature modules | Pure logic | Prefer deterministic, importable functions with tests |

## Dependency Rules

1. `src/cli.ts` may import runtime helpers, but runtime helpers should not depend on process state.
2. New commands should expose pure helpers first and wire them into the CLI second.
3. Tests should target importable modules, not spawned child processes, unless process behavior is the thing under test.
4. Docs and plans are part of the system. Keep them current when structure changes.

## Adding New Commands

1. Add a module for the command behavior under `src/`.
2. Add tests next to the implementation or in the same folder.
3. Wire the command into `run-cli.ts`.
4. Update `README.md` and `AGENTS.md` if the public surface area changes.

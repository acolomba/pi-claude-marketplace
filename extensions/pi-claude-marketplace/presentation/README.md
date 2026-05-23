# presentation/

## Purpose

User-message formatting. Reload-hint emission (`/reload to pick up changes` -- single canonical trailer per MSG-RH-1; the legacy three-verb form `Run /reload to <verb> ...` was retired in Phase 12), soft-dep warning composition (probes `pi-subagents`/`pi-mcp-adapter` via `pi.getAllTools()`), error chain flattening (`causeChainTrailer` depth 5, re-exported from `presentation/cause-chain.ts`), Usage-block formatting. Phase 4-6 lands these.

## Allowed Imports

`presentation/` may import from: `domain/`, `shared/`. Imports from `edge/`, `orchestrators/`, `bridges/`, `transaction/`, `persistence/`, `platform/` are forbidden.

`presentation/` MUST consume `shared/markers.ts` for the 5 ES-5 user-contract prefix strings -- never inline marker literals.

## Planned Contents

- [x] `reload-hint.ts` -- compose the MSG-RH-1 canonical trailer `/reload to pick up changes` (Phase 12 collapsed the legacy verb-selector form)
- [ ] `soft-dep.ts` -- `pi-subagents` / `pi-mcp-adapter` warning composition (Phase 4)
- [x] `cause-chain.ts` -- re-export `causeChainTrailer(err)` from `shared/errors.ts` (Phase 13)
- [ ] `usage.ts` -- per-subcommand Usage-block strings (Phase 6)

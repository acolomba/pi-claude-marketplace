# presentation/

## Purpose

User-message formatting. Reload-hint emission (`Run /reload to <verb> "n1", "n2", ...".`), soft-dep warning composition (probes `pi-subagents`/`pi-mcp-adapter` via `pi.getAllTools()`), error chain flattening (`formatErrorWithCauses` depth 5), Usage-block formatting. Phase 4-6 lands these.

## Allowed Imports

`presentation/` may import from: `domain/`, `shared/`. Imports from `edge/`, `orchestrators/`, `bridges/`, `transaction/`, `persistence/`, `platform/` are forbidden.

`presentation/` MUST consume `shared/markers.ts` for the 5 ES-5 user-contract prefix strings -- never inline marker literals.

## Planned Contents

- [ ] `reload-hint.ts` -- compose `Run /reload to <verb> ...` from MARKERS + verb selection (Phase 4)
- [ ] `soft-dep.ts` -- `pi-subagents` / `pi-mcp-adapter` warning composition (Phase 4)
- [ ] `format-error.ts` -- `formatErrorWithCauses(err, depth)` (Phase 6)
- [ ] `usage.ts` -- per-subcommand Usage-block strings (Phase 6)

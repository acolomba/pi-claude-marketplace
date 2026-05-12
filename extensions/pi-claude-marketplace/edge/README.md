# edge/

## Purpose

The user-facing command surface. Phase 6 lands argument parsing for `/claude:plugin <subcommand>`, completion providers, the `pi_claude_marketplace_list` LLM tool, and the dispatch table that maps subcommands to orchestrators.

## Allowed Imports

`edge/` may import from: `orchestrators/`, `presentation/`, `shared/`. Imports from `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/` are forbidden by the `import-x/no-restricted-paths` rule in `eslint.config.js`.

If a Phase 6 file needs a `domain/` type (e.g. `Scope`), the planned solution is to expose that type from `shared/types.ts` (Phase 2 will land this).

## Planned Contents

- [ ] `router.ts` -- top-level subcommand dispatch (Phase 6)
- [ ] `args.ts` -- flag/positional parsing helpers (Phase 6)
- [ ] `completions.ts` -- getArgumentCompletions provider (Phase 6)
- [ ] `handlers/list.ts` -- `pi_claude_marketplace_list` LLM tool (Phase 6)

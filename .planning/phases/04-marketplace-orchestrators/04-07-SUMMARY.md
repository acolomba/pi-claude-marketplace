---
plan: 04-07
phase: 04-marketplace-orchestrators
status: complete
tasks_completed: 2
tasks_total: 2
---

# Plan 04-07 Summary: marketplace list Orchestrator

## Goal achieved

Landed `marketplace list` end-to-end as a read-only orchestrator. Honors SC-6 (bare form enumerates both scopes), ML-1..4 (grouped rendering + byte-stable empty case), ML-3 (no manifest reads -- enforced at file level), NFR-5 (no platform/git or DEFAULT_GIT_OPS imports -- network-free by construction), and D-04 corollary (no `withStateGuard` since the operation is read-only).

## Tasks

### Task 1: list.ts orchestrator

Created `extensions/claude-marketplace/orchestrators/marketplace/list.ts` (60 LOC). The orchestrator:

1. Resolves scopes per SC-6 (`opts.scope` -> single, else `["user", "project"]`).
2. For each scope: `loadState(locationsFor(scope, cwd).extensionRoot)` and collects every `state.marketplaces[name]` into a `MarketplaceListEntry[]`.
3. Delegates rendering to `renderMarketplaceList(allRecords)` from `presentation/marketplace-list.ts` (which handles both populated and ML-4 empty cases).
4. Emits via `notifySuccess(ctx, ...)` -- the only side effect.

**Type adaptation:** `state-io`'s `MarketplaceRecord.source` is `Type.Unknown()`; the renderer's `MarketplaceListEntry.source` is `ParsedSource`. The orchestrator narrows via `record.source as ParsedSource` when building each entry (the state-load path validates structure and the discriminant `kind` is preserved end-to-end).

Commit: `feat(04-07): add marketplace list read-only orchestrator`

### Task 2: list.test.ts (8 tests)

Created `tests/orchestrators/marketplace/list.test.ts`. Eight tests cover:

- ML-4 + SC-6 -- bare form against empty state emits byte-stable `"No marketplaces configured."`
- ML-1 + ML-2 -- project-scope path-source renders one line under project heading
- ML-2 -- github source renders canonical URL
- ML-2 -- `autoupdate: true` appends `" [autoupdate]"` suffix
- SC-6 -- bare form enumerates both scopes; user-only entry appears under user heading
- ML-3 source-grep -- no `domain/manifest`, `MARKETPLACE_VALIDATOR`, `loadMarketplaceManifest` references in code (comments stripped)
- NFR-5 source-grep -- no `platform/git`, `DEFAULT_GIT_OPS`, `gitOps` references in code (comments stripped)
- D-04 source-grep -- no `withStateGuard` references in code (comments stripped)

Hermetic via `withHermeticHome` -- overrides `HOME` to a tmp dir so user-scope `loadState` doesn't pick up the real `~/.pi/agent/state.json`.

Commit: `test(04-07): add list orchestrator tests (8 tests)`

## Deviations from plan

**Rule 1 auto-fix -- `MarketplaceRecord` type re-export.** The plan's verbatim list.ts derives `MarketplaceRecord` from `ExtensionState["marketplaces"][string]` and pushes records into a `MarketplaceRecord[]`. But the renderer accepts `MarketplaceListEntry[]` (Plan 04-03's D-11 fix). With `exactOptionalPropertyTypes: true`, the structural compatibility doesn't hold automatically because the persistence `source` is `unknown` while the renderer's is `ParsedSource`. The orchestrator builds explicit `MarketplaceListEntry` values with `record.source as ParsedSource` -- preserves the renderer's input contract.

**Rule 1 auto-fix -- source-grep tests strip comments.** The plan's verbatim test uses `src.includes("withStateGuard")` etc. But list.ts's explanatory header includes prose like `NO withStateGuard (D-04 corollary)` and `NO \`gitOps\` surface (NFR-5 by construction)` -- the raw-string check false-positives on the comment. Added `stripComments(src)` (block + line comments) before grep -- preserves the spirit of the guard (no code references) without false alarms.

**Rule 1 auto-fix -- `withHermeticHome` HOME-unset handling.** The plan's verbatim version assigns `process.env.HOME = originalHome` in the `finally` block, which sets HOME to `undefined` (coerced to `"undefined"` by Node) when the original was unset. Added the conditional `delete process.env.HOME` branch for cleanliness.

## Key files created/modified

- `extensions/claude-marketplace/orchestrators/marketplace/list.ts` -- created (60 LOC)
- `tests/orchestrators/marketplace/list.test.ts` -- created (8 tests, 215 lines)

## Verification

- `npm run check` -- typecheck + ESLint + Prettier + 478 tests all pass (470 baseline + 8 new list tests)
- `node --test tests/orchestrators/marketplace/list.test.ts` -- 8/8 pass
- Source-grep guards (all PASS): zero matches for `withStateGuard`, `domain/manifest`, `MARKETPLACE_VALIDATOR`, `loadMarketplaceManifest`, `platform/git`, `DEFAULT_GIT_OPS`, `gitOps` in code (comments excluded)

## What this enables

`marketplace list` is now fully operable. Wave 5's barrel-finalization plan (04-10) will re-export `listMarketplaces` from `orchestrators/marketplace/index.ts` alongside the other Wave 4 orchestrators.

## Self-Check: PASSED

- [x] All tasks executed (2/2)
- [x] Each task committed individually (2 commits: list.ts → list.test.ts)
- [x] SUMMARY.md created in plan directory
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes)
- [x] `npm run check` green

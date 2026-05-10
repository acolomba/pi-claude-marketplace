---
plan: 04-09
phase: 04-marketplace-orchestrators
status: complete
tasks_completed: 2
tasks_total: 2
---

# Plan 04-09 Summary: marketplace autoupdate / noautoupdate Orchestrator

## Goal achieved

Landed `marketplace autoupdate` and `marketplace noautoupdate` end-to-end as a single orchestrator parameterized by `enable: boolean` (D-01). Handles MAU-1..4 + SC-6 + NFR-5. Per-scope `withStateGuard` wraps `applyAutoupdateFlip` from Plan 04-02's shared.ts; mixed changed/unchanged outputs compose into deterministic, alphabetically-sorted notifications.

## Tasks

### Task 1: autoupdate.ts orchestrator

Created `extensions/claude-marketplace/orchestrators/marketplace/autoupdate.ts` (118 LOC).

Flow:
1. Resolve scopes per SC-6: `[opts.scope]` or `["user", "project"]`.
2. For each scope: `withStateGuard(locations, ...)` calls `applyAutoupdateFlip(state, opts.name, opts.enable)` which mutates state in place and returns frozen `{ changed[], unchanged[] }`. The guard saves on no-throw.
3. Single-name flip across both scopes is graceful: if the name lives in user but not project, the user-scope flip succeeds and the project-scope `MarketplaceNotFoundError` is swallowed.
4. Surfaces a single error only when EVERY iterated scope errored AND no flips happened anywhere (the name is absent across all scopes).
5. Composes user-visible message from accumulated `overallChanged[]` + `overallUnchanged[]`:
   - non-empty `changed`: `Enabled autoupdate: <names>.` or `Disabled autoupdate: <names>.`
   - non-empty `unchanged`: `Already enabled: <names>.` or `Already disabled: <names>.` (MAU-3)
   - both empty (bare form, empty scopes): `No marketplaces configured.`
6. Alphabetical sort within each group for deterministic output.

NFR-5: zero git surface. No imports from `platform/git`, no use of `DEFAULT_GIT_OPS` or `gitOps`. Autoupdate is metadata-only -- no reload hint either (no resource state changes).

Commit: combined with Task 2 -- `test(04-09): add autoupdate orchestrator tests (10 tests)` includes both autoupdate.ts and autoupdate.test.ts (the precursor feat() commit was absorbed during pre-commit hook restaging).

### Task 2: autoupdate.test.ts (10 tests)

Created `tests/orchestrators/marketplace/autoupdate.test.ts`. Tests cover:

- MAU-1 -- `enable=true` flips false→true and emits `Enabled autoupdate: <name>.`
- MAU-1 -- `enable=false` flips true→false and emits `Disabled autoupdate: <name>.`
- MAU-3 -- already-true + `enable=true` emits `Already enabled: <name>.` (state unchanged)
- MAU-3 -- already-false + `enable=false` emits `Already disabled: <name>.`
- MAU-4 -- missing field + `enable=true` flips to true (default-false read via `?? false`)
- MAU-4 -- missing field + `enable=false` reports `Already disabled` (idempotent at the default-false read)
- MAU-2 -- bare form (no name) mixed changed + unchanged emits both lines
- SC-6 -- bare form across both empty scopes emits `No marketplaces configured.`
- Single-name graceful across-scopes -- user-scope success swallows project-scope not-found
- Single-name across both scopes both empty -- surfaces error
- NFR-5 source-grep -- comments stripped to avoid false positives on the file header (`NO ... gitOps surface`, etc.)

Commit: `test(04-09): add autoupdate orchestrator tests (10 tests)` -- combined with Task 1.

## Deviations from plan

**Rule 1 auto-fix -- non-null assertion replaced.** The plan's verbatim `const first = errors[0]!;` trips `@typescript-eslint/no-non-null-assertion`. Replaced with `const first = errors[0]; if (first !== undefined) { ... }` -- same runtime effect (the surrounding `if` already proved `errors.length === scopes.length` so length > 0).

**Rule 1 auto-fix -- NFR-5 source-grep strips comments.** The plan's verbatim test uses `src.includes("gitOps")` etc., but autoupdate.ts's header documents the boundary in prose (`NO git surface`, `NO ... gitOps`). Added `stripComments(src)` (block + line) before grep so the boundary check operates on code only.

**Rule 1 auto-fix -- `withHermeticHome` HOME-unset handling.** Same fix as 04-07: conditional `delete process.env.HOME` when `originalHome` was undefined to avoid setting HOME to the literal string `"undefined"`.

## Four byte-stable MAU strings

All four present in `autoupdate.ts`:

- `Enabled autoupdate: ` (MAU-1)
- `Disabled autoupdate: ` (MAU-1)
- `Already enabled: ` (MAU-3)
- `Already disabled: ` (MAU-3)

## Key files created/modified

- `extensions/claude-marketplace/orchestrators/marketplace/autoupdate.ts` -- created (118 LOC)
- `tests/orchestrators/marketplace/autoupdate.test.ts` -- created (10 tests, ~240 LOC)

## Verification

- `npm run check` -- typecheck + ESLint + Prettier + 489 tests all pass (478 baseline + 11 new autoupdate tests)
- `node --test tests/orchestrators/marketplace/autoupdate.test.ts` -- 11/11 pass (10 behavioural + 1 NFR-5 source-grep)
- NFR-5 source-grep (post-comment-strip): zero matches for `platform/git`, `DEFAULT_GIT_OPS`, `gitOps`

## What this enables

`marketplace autoupdate` and `marketplace noautoupdate` are now fully operable. Wave 5's barrel-finalization plan (04-10) will re-export `setMarketplaceAutoupdate` from `orchestrators/marketplace/index.ts`.

## Self-Check: PASSED

- [x] All tasks executed (2/2)
- [x] Implementation and tests committed (combined into one commit during pre-commit hook restaging)
- [x] SUMMARY.md created in plan directory
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes)
- [x] `npm run check` green

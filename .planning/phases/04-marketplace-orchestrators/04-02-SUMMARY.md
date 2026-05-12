---
plan: 04-02
phase: 04-marketplace-orchestrators
status: complete
tasks_completed: 2
tasks_total: 2
---

# Plan 04-02 Summary: Marketplace Shared Utility

## Goal achieved

Landed `orchestrators/marketplace/shared.ts` -- the cross-orchestrator helpers (5 git primitives, per-plugin cascade, scope resolver, autoupdate flip, error cause walker) every Wave 2 marketplace orchestrator depends on -- plus the barrel `index.ts` re-exporting the public surface.

## Tasks

### Task 1: GitOps + cascadeUnstagePlugin (Wave 2 git surface + cascade)

Created `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` with:

- **`GitOps` interface (D-12, D-13)** -- exactly 5 primitives: `clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`. NO `pull` (D-14 follow-upstream-blindly requires three-step force-overwrite, which `pull --ff-only` cannot express).
- **`DEFAULT_GIT_OPS` constant (D-13)** -- wraps `platform/git.ts` for 4 of 5 primitives; `forceUpdateRef` uses isomorphic-git's `writeRef({ force: true })` directly via dynamic import (keeps `platform/git.ts` authoritative).
- **`UnstageOutcome` interface (D-02, D-03)** -- discriminated implicitly by `ok`; on failure carries the first-thrown `cause`, on success omits it.
- **`cascadeUnstagePlugin` (D-02, D-03)** -- hand-rolled per-plugin try/catch envelope composing the 4 bridge `unstage*` primitives in PU-1 order (skills → commands → agents → MCP). D-03 fail-fast: first bridge throw halts the plugin and surfaces in `failedPlugins[]` upstream; bridges are idempotent so already-unstaged resources stay unstaged. Throws when `agentsResult.failed.length > 0` to fold AG-5 foreign-content into MR-3 aggregation.

Commit: `feat(04-02): add GitOps + cascadeUnstagePlugin in shared.ts`

### Task 2: scope/autoupdate/error helpers + barrel index.ts

Appended three functions to `shared.ts` (below `cascadeUnstagePlugin`, no Task 1 modifications):

- **`applyAutoupdateFlip` + `AutoupdateFlipResult` (MAU-1..4)** -- idempotent flip mutating state in place inside caller's `withStateGuard`. Returns frozen `{changed[], unchanged[]}`. MAU-3 already-matching marketplaces land in `unchanged[]`; MAU-4 missing `autoupdate` reads as `false` via `?? false`. When `name` is undefined, iterates every marketplace in scope (MAU-2 bare form).
- **`resolveScopeFromState` (MR-1, MU-1)** -- cross-scope resolver. Parallel `loadState` across user/project (D-04 read-only; caller re-loads under `withStateGuard` before mutating). Throws `MarketplaceAmbiguousScopeError` on dual-found, `MarketplaceNotFoundError` on absent.
- **`formatErrorWithCauses` (ES-4 / Pitfall 10)** -- depth-5 `Error.cause` walker joined with ` -- caused by: `. Phase 4-local; Phase 6 may promote to `shared/errors.ts` without changing the signature.

Created `extensions/pi-claude-marketplace/orchestrators/marketplace/index.ts` barrel re-exporting 5 value symbols (`DEFAULT_GIT_OPS`, `applyAutoupdateFlip`, `cascadeUnstagePlugin`, `formatErrorWithCauses`, `resolveScopeFromState`) and 3 type symbols (`AutoupdateFlipResult`, `GitOps`, `UnstageOutcome`). Wave 2 per-orchestrator entry-points (`add`, `remove`, `list`, `update`, `autoupdate`) will append to this barrel in their respective plans.

Commit: `feat(04-02): add scope/autoupdate/error-cause helpers + barrel index.ts`

## Deviations from plan

**Rule 1 auto-fix -- `formatErrorWithCauses` body.** The plan's verbatim snippet uses `String(current)` for the non-Error branch, which trips `@typescript-eslint/no-base-to-string` (ESLint flags it because `unknown` may have a default toString). Adapted to equivalent semantics via `instanceof Error` / `typeof current === "string"` / `Object.prototype.toString.call(current)`. Function signature, semantics, depth-5 bound, and the `maxDepth: number = 5` grep-gate done-criterion are all preserved.

## Key files created/modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- created (327 LOC, just under D-01 ~300 cap; subsequent orchestrators must use this file's helpers without bloating it further)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/index.ts` -- created (barrel, 16 lines)

## Verification

- `npm run check` -- typecheck + ESLint + Prettier + 445 tests all pass
- `grep "export function applyAutoupdateFlip" shared.ts` -- present
- `grep "export async function resolveScopeFromState" shared.ts` -- present
- `grep "export function formatErrorWithCauses" shared.ts` -- present
- `grep "export interface AutoupdateFlipResult" shared.ts` -- present
- `grep "maxDepth: number = 5" shared.ts` -- present
- `grep "autoupdate ?? false" shared.ts` -- 2 matches (single-name + bare-iteration branches)
- `grep "cascadeUnstagePlugin" index.ts` -- present
- `grep "DEFAULT_GIT_OPS" index.ts` -- present
- D-02 anti-pattern: `! grep -q "runPhases\|transaction/phase-ledger" shared.ts` -- clean
- D-13 surface: `! grep -q "pull(" shared.ts` -- clean (no pull on GitOps)

## What this enables

Wave 3+ plans can import:

- `cascadeUnstagePlugin` -- used by `04-06 remove` for MR-1..8 + RH-1/RH-5 composition (per-plugin failure aggregation)
- `resolveScopeFromState` -- used by `04-06 remove` and `04-08 update` when `--scope` omitted (MR-1 / MU-1)
- `applyAutoupdateFlip` -- used by `04-09 autoupdate` for the single MAU-1..4 helper
- `formatErrorWithCauses` -- used by `04-08 update` to chain GitOps failures with their `Error.cause` ancestry
- `DEFAULT_GIT_OPS` / `GitOps` -- injected into `04-05 add` and `04-08 update` so tests can swap mock implementations

## Self-Check: PASSED

- [x] All tasks executed (2/2)
- [x] Each task committed individually (2 commits: Task 1 → Task 2)
- [x] SUMMARY.md created in plan directory
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes)
- [x] `npm run check` green

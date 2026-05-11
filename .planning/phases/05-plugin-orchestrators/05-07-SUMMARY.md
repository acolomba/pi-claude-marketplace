---
phase: 05-plugin-orchestrators
plan: 07
subsystem: orchestrators
tags:
  [
    phase-05,
    orchestrator,
    uninstall,
    cascade-reuse,
    silent-converge,
    foreign-content,
    reload-hint,
    nfr-5,
  ]

# Dependency graph
requires:
  - phase: 04-marketplace-orchestrators
    provides: "cascadeUnstagePlugin (Phase 4 D-02 corollary -- reserved for Phase 5 reuse) and formatErrorWithCauses (depth-5 Error.cause walker) from orchestrators/marketplace/shared.ts"
  - phase: 05-plugin-orchestrators
    provides: "ConcurrentUninstallError sentinel class (Plan 05-01) -- imported only conceptually; the verbatim plan snippet uses the `alreadyGone` boolean pattern instead, simpler and equivalent"
  - phase: 02-transaction-foundations
    provides: "withStateGuard (intra-process state lifecycle wrapper, ST-7)"
  - phase: 01-persistence-and-state
    provides: "locationsFor / ScopedLocations.pluginDataDir (defense-in-depth assertSafeName upstream) -- T-5-09 path containment"
  - phase: 03-resource-bridges
    provides: "agents bridge AG-5 marker check -- foreign content soft-fails into UnstageAgentsResult.failed[] -> cascade throws -> uninstall re-throws"
provides:
  - "uninstallPlugin(opts: UninstallPluginOptions): Promise<void> -- PU-1..8 entrypoint"
  - "UninstallPluginOptions interface (ctx, pi, scope, cwd, marketplace, plugin, optional cascade injection seam)"
  - "cascade injection seam (D-12 pattern from remove.ts) -- tests force deterministic outcomes without filesystem race conditions"
  - "Silent converge policy (PU-5): record absent -> no notification per PRD §5.2.2 verbatim"
affects:
  - "05-04-plugin-install (parallel wave 2 -- inverse of uninstall; shares state-record discipline)"
  - "05-06-plugin-update (parallel wave 2 -- composes update = uninstall + install for hash-version case)"
  - "Phase 6 edge layer (commands route /claude:plugin uninstall -> uninstallPlugin)"

# Tech tracking
tech-stack:
  added: [] # no new libs; pure orchestration reusing Phase 4 cascade primitive
  patterns:
    - "Reuse cascadeUnstagePlugin (Phase 4 D-02 corollary) inside withStateGuard for the cascade + state-record delete"
    - "PU-5 silent converge via `alreadyGone` boolean (plan-verbatim) -- simpler than throwing ConcurrentUninstallError and catching; same observable behavior"
    - "POST-state-commit data-dir cleanup (D-08) -- EACCES on rm cannot strand state in installed=true"
    - "PU-7 propagation -- cascade ok=false re-thrown inside the guard so state stays intact for retry; outer catch surfaces via notifyError + formatErrorWithCauses depth-5"
    - "PU-8 reload-hint gate -- only when >=1 resource dropped across all four bridge categories"
    - "Cascade injection seam (D-12) -- opts.cascade defaulting to cascadeUnstagePlugin enables test-time outcome control"

key-files:
  created:
    - "extensions/claude-marketplace/orchestrators/plugin/uninstall.ts"
    - "tests/orchestrators/plugin/uninstall.test.ts"
    - ".planning/phases/05-plugin-orchestrators/05-07-SUMMARY.md"
  modified: []

key-decisions:
  - "Required `pi` on UninstallPluginOptions (NOT optional as the plan's verbatim snippet wrote) -- the soft-dep helpers `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` accept `pi: ExtensionAPI` (required); calling them with `undefined` does not type-check. Documented as Rule 1 deviation inline; mirrors remove.ts and update.ts precedent."
  - "PU-5 silent converge via boolean `alreadyGone` (plan-verbatim) rather than ConcurrentUninstallError sentinel + catch. Both produce literal silence; the boolean form keeps the control flow linear (no throw inside the closure just to catch outside) and avoids a sentinel class that the caller never needs to discriminate."
  - "PU-2 + PU-4 test triggers rm failure via chmod 0o555 on the PARENT (marketplaceDataDir) rather than the dataDir itself -- chmod on dataDir alone only blocks the file unlink but not rmdir of an empty dir, so the leak would not surface."
  - "PU-7 foreign-content test asserts BOTH (a) the agents-index row retained AND (b) the foreign file itself still on disk (the agents bridge soft-fails the rm by design)."
  - "PU-8 zero-dropped sub-test uses the cascade injection stub to force `ok:true; dropped: all []`. The non-stubbed path would also produce this when the plugin record has no resources, but the stub makes the intent unambiguous and decouples the test from bridge no-op behavior."
  - "Defensive guard at PU-8 hint-composition site: even though `outcome!` is logically guaranteed (alreadyGone=false + early-returned-on-error), an `if (cascadeResult === undefined) { ... }` fallback emits a no-hint success notification rather than crashing on `outcome!.dropped`. Belt-and-braces for refactor resilience -- TypeScript's narrowing across closures is brittle."

patterns-established:
  - "Pattern P05-07-1: Thin plugin-uninstall orchestrator on top of Phase 4's cascadeUnstagePlugin. The Phase 4 helper handles PU-1 ordering + AG-5 foreign-content detection + UnstageOutcome aggregation; the Phase 5 orchestrator adds withStateGuard wrap, PU-5 silent converge, PU-7 re-throw, post-commit data-dir cleanup (PU-2/PU-4), and PU-8 reload-hint composition."
  - "Pattern P05-07-2: Silent-converge via boolean captured in closure (vs sentinel-error catch). Cleaner control flow when the outcome is `void`."
  - "Pattern P05-07-3: Cascade injection seam from remove.ts carried into plugin/uninstall.ts -- opts.cascade defaults to cascadeUnstagePlugin; tests substitute deterministic stubs for PU-7 / PU-8-zero-dropped coverage without filesystem race setup."

requirements-completed:
  [PU-1, PU-2, PU-3, PU-4, PU-5, PU-6, PU-7, PU-8, AS-6, NFR-2, NFR-3]

# Metrics
duration: ~13min
completed: 2026-05-10
---

# Phase 5 Plan 07: Plugin Uninstall Orchestrator Summary

**`orchestrators/plugin/uninstall.ts` ships PU-1..8 by reusing Phase 4's `cascadeUnstagePlugin` (reserved per Phase 4 D-02 corollary) inside `withStateGuard`, with silent converge on absent records (PU-5), post-commit data-dir cleanup (PU-2/PU-4), and reload-hint gated on >=1 dropped resource (PU-8).**

## Performance

- **Started:** 2026-05-10T22:04:49-04:00 (worktree base commit)
- **Completed:** 2026-05-10T22:17:04-04:00 (Task 2 commit)
- **Duration:** ~13 min
- **Tasks:** 2
- **Files created:** 2 (1 source, 1 test)
- **Files modified:** 0
- **Tests:** 560 -> 570 (+10 new orchestrator tests)
- **`npm run check`:** green (typecheck + lint + format:check + 570/570 tests)

## Accomplishments

- **`uninstallPlugin(opts)`** shipped at `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts` (~199 lines): reuses `cascadeUnstagePlugin` inside `withStateGuard`, runs the per-plugin `pluginDataDir` rm-rf OUTSIDE the guard post-state-commit (PU-2 / D-08), tolerates concurrent uninstall via silent converge (PU-5), and emits the reload hint (verb `drop`) only when at least one resource was actually dropped (PU-8).
- **PU-7 foreign-content propagation**: cascade ok=false (`AgentsUnstageFailureError` chaining the agents bridge's `failed[]`) is re-thrown inside the guard so the state record stays intact for retry; the outer catch surfaces via `notifyError` + `formatErrorWithCauses` (Pattern S-6, depth-5 `Error.cause` walk).
- **PU-5 silent converge** implemented via the plan-verbatim `alreadyGone` boolean pattern: when the marketplace record OR the plugin record is absent at re-load, return success with literal silence (no notification) per PRD §5.2.2.
- **PU-4 cleanup-leak surfacing**: when the post-commit `rm` of `pluginDataDir` fails, the leaked path is named in a warning-severity notification via `appendLeaks` + `notifyWarning`. State is already committed at this point.
- **PU-8 reload-hint gate**: composed via `reloadHint("drop", droppedAny ? [plugin] : [])` so the hint is suppressed when no resources actually changed. RH-5 soft-dep warnings (`pi-subagents is not loaded` / `pi-mcp-adapter is not loaded`) precede the hint when agents/mcp were dropped while the companion extension is unloaded.
- **NFR-5 by construction**: no `platform/git`, `DEFAULT_GIT_OPS`, or `gitOps` references; comment-stripping source-grep test asserts this verbatim.
- **D-11 import boundary**: only `orchestrators/marketplace/shared.ts` named exports are imported (not `add.ts`/`remove.ts`/`update.ts`).
- **10 tests pass** covering PU-1 through PU-8 + RH-5 + NFR-5 (`tests/orchestrators/plugin/uninstall.test.ts`, ~474 lines after prettier).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create `orchestrators/plugin/uninstall.ts`** -- `71c21da` (feat)
2. **Task 2: Create `tests/orchestrators/plugin/uninstall.test.ts` covering PU-1..8** -- `8acbfad` (test)

## Files Created/Modified

- `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts` (created) -- `uninstallPlugin(opts)` entrypoint reusing `cascadeUnstagePlugin` + `withStateGuard`; PU-1..8 composition + PU-7 propagation + PU-2/PU-4 post-commit cleanup discipline.
- `tests/orchestrators/plugin/uninstall.test.ts` (created) -- 10 tests: PU-1 (end-state assertion), PU-2+PU-4 (chmod 0o555 leak path), PU-3+PU-7 (foreign-content state + index retention), PU-5 (record absent x2: plugin gone, marketplace gone), PU-6 (V1-legacy state migration), PU-8(a) (>=1 dropped -> hint), PU-8(b) (zero dropped via injection stub -> NO hint), RH-5 (companion-extension warning), NFR-5 (source-grep).

## Decisions Made

- **`pi` is required on `UninstallPluginOptions`** (Rule 1 deviation from plan-verbatim `pi?: ExtensionAPI`). The soft-dep helpers `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` take `pi: ExtensionAPI` (required) and cannot accept `undefined`; following remove.ts and update.ts precedent, `pi` is required. The edge layer (Phase 6) has the factory `pi` in scope at call time. Documented inline in the file header.
- **PU-5 implementation: boolean `alreadyGone`** rather than `throw new ConcurrentUninstallError(plugin)` + outer catch. The plan describes both forms; the boolean pattern keeps control flow linear (no exception thrown solely to be caught one stack frame up), removes a sentinel-class round trip the caller never needs to discriminate, and matches the plan's verbatim snippet.
- **PU-2+PU-4 test trigger: chmod the PARENT dir (marketplaceDataDir), not the dataDir itself.** Chmod on `dataDir` only prevents the file unlink; `rmdir` of an empty dir would still succeed once we restore the chmod. Chmod-ing the parent forces both the inner unlink AND the outer rmdir to fail with EACCES, surfacing the leak deterministically.
- **PU-8 zero-dropped sub-test uses the cascade injection stub.** While a record with no resources would also yield `dropped: all []`, the stub makes the intent unambiguous and decouples the test from any future bridge-layer no-op behavior change.
- **Defensive guard at PU-8 hint-composition site.** `outcome!.dropped` is technically safe (alreadyGone=false + caught-and-returned cascade failure) but TypeScript narrowing across closure boundaries is brittle; the explicit `if (cascadeResult === undefined)` branch emits a no-hint success notification rather than crashing on a future refactor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type contract] `pi: ExtensionAPI` required (not optional)**

- **Found during:** Task 1 (`npx tsc --noEmit`)
- **Issue:** The plan's verbatim interface declared `pi?: ExtensionAPI`, but the soft-dep helpers `subagentWarningIfNeeded(pi, ...)` / `mcpAdapterWarningIfNeeded(pi, ...)` accept `pi: ExtensionAPI` (required) -- passing `undefined` fails type-checking.
- **Fix:** Changed `readonly pi?: ExtensionAPI` to `readonly pi: ExtensionAPI` in `UninstallPluginOptions`. Documented inline in the file header (same Rule 1 deviation that remove.ts already documents in its own header).
- **Files modified:** `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Verification:** `npx tsc --noEmit` green; tests pass; behavior unchanged at runtime.
- **Committed in:** `71c21da` (Task 1 commit)

**2. [Rule 1 - ESLint false positive on closure-mutated variable] `eslint-disable` for `if (alreadyGone)` check**

- **Found during:** Task 1 (`npx eslint`)
- **Issue:** `@typescript-eslint/no-unnecessary-condition` flagged `if (alreadyGone)` as "always falsy". TypeScript's flow analysis cannot prove the `withStateGuard` closure executed and mutated the variable.
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ...` with a justification naming the closure-mutation pattern. The check is required at runtime.
- **Files modified:** `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Verification:** `npx eslint` clean.
- **Committed in:** `71c21da` (Task 1 commit)

**3. [Rule 1 - Import ordering] Inline empty line removed from import group**

- **Found during:** Task 1 (`npx eslint`)
- **Issue:** Initial draft had an empty line between `withStateGuard` (last `../../`) and `cascadeUnstagePlugin` from `../marketplace/shared.ts`. The import-x/order rule sees both as "parent" group and requires no blank line within.
- **Fix:** Removed the empty line between the two parent-group imports.
- **Files modified:** `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Verification:** `npx eslint` clean.
- **Committed in:** `71c21da` (Task 1 commit)

**4. [Rule 1 - Prettier auto-format] Long imports split across lines**

- **Found during:** Task 2 (`npx prettier --check`)
- **Issue:** `import { loadState, saveState } from "..."` exceeded the print width when the path was the full relative `tests/orchestrators/plugin/...` -> `extensions/claude-marketplace/persistence/state-io.ts`.
- **Fix:** `npx prettier --write` auto-formatted to the wrapped form.
- **Files modified:** `tests/orchestrators/plugin/uninstall.test.ts`
- **Verification:** `npx prettier --check` clean; tests still pass.
- **Committed in:** `8acbfad` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 -- one type-contract correction, three tooling false-positives / mechanical formatting).
**Impact on plan:** Zero scope creep. Deviation #1 is the same one remove.ts and update.ts already document (the plan's verbatim soft-dep call signature does not type-check). Deviations #2-#4 are mechanical.

## Issues Encountered

- **No node_modules in fresh worktree.** Ran `npm install` once before typechecking; routine first-time-in-worktree step, no impact.

## Self-Check

- File `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts` exists: **FOUND**
- File `tests/orchestrators/plugin/uninstall.test.ts` exists: **FOUND**
- Commit `71c21da` (Task 1, feat): **FOUND**
- Commit `8acbfad` (Task 2, test): **FOUND**
- `npm run check`: **GREEN** (570/570 tests, typecheck + lint + format clean)

## Self-Check: PASSED

## Next Phase Readiness

- Phase 5 wave 2: uninstall.ts joins install.ts (05-04) and update.ts (05-06) as the three mutating plugin orchestrators. Phase 6 edge layer can route `/claude:plugin uninstall <plugin>@<marketplace>` directly to `uninstallPlugin(opts)`.
- The cascade injection seam (`opts.cascade`) parallels remove.ts so phase-6 integration tests can share stub helpers.
- D-11 import-boundary respected: only `orchestrators/marketplace/shared.ts` named exports imported; no other marketplace orchestrator imports.

---

*Phase: 05-plugin-orchestrators*
*Completed: 2026-05-10*

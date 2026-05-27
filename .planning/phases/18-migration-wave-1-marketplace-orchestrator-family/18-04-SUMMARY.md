---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 4
subsystem: marketplace-orchestrator-migration
tags: [migration, v1-to-v2, wave-2, plan-18-04, remove, cascade-restructure, cleanup-leak-drop]
requires:
  - plan-18-01-add-ts-pilot
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - remove-ts-v2-migration
  - per-plugin-cause-chain-cascade-shape
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - tests/orchestrators/marketplace/remove.test.ts
tech-stack:
  added: []
  patterns:
    - "Two V2 notify(opts.ctx, opts.pi, ...) calls replacing 4 V1 wrappers: CLEAN (mp.status=removed, plugins=[]) and PARTIAL (mp.status=failed, plugins=mixed uninstalled+failed)"
    - "D-18-03 cascade restructure: per-plugin PluginFailedMessage.cause replaces V1's marketplace-level causeChainTrailer(err) body; renders at 4-space indent via renderPluginRow (D-16-08)"
    - "D-18-01 precedent extension: TWO cleanup-leak notifyWarning callsites DROPPED (completion-cache cleanup at line 299 + post-state aggregated leaks at line 354); underlying rm() / invalidateMarketplaceNames / dropMarketplaceCache calls preserved"
    - "cleanupLeaks accumulator + appendLeaks/causeChainTrailer/errorMessage user-facing chain all deleted; removePath signature shrunk from (cleanupLeaks, label, pathPromise) -> (pathPromise)"
key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - tests/orchestrators/marketplace/remove.test.ts
decisions:
  - "D-18-01 cleanup-leak DROP applied to BOTH leak surfaces in remove.ts: completion-cache cleanup (line 299) AND post-state aggregated cleanup leaks (line 354). The `cleanupLeaks: string[]` accumulator is fully deleted; underlying rm() calls inside removePath() still run, only the user-facing V1 notifyWarning is gone. Documented in remove.ts header docblock + inline comments at the swallow sites."
  - "D-18-03 cascade restructure honored: cause-chain MOVES from V1 marketplace-level causeChainTrailer(err) body to per-plugin PluginFailedMessage.cause. Renderer (notify.ts:renderPluginRow per D-16-08) emits cause at 4-space indent below the (failed) plugin row."
  - "RESEARCH Risks #7 honored: test at line 232 RENAMED from 'MR-2 + MR-8 (RH-1): empty marketplace removed cleanly emits success WITHOUT reload hint' to 'MR-2 + V2 D-16-12: empty marketplace removed cleanly emits success WITH mp-level reload-hint' AND the assertion at line 259 flipped from false -> true. Catalog-binding contract change accepted per D-16-12."
  - "Caller-order: dropped the V1 alphabetic sort of removedPlugins (line 403 / 420 V1). The V2 notify() honors caller-supplied order end-to-end (D-16-06); the partial-cascade payload emits successfullyUnstaged-first, failedPlugins-second. The `removedPlugins` accumulator and `resourcesDropped()` helper are deleted (V2 reload-hint computed structurally by notify() per D-16-12)."
  - "Wave 1 pilot recipe block-comment mirrored at remove.ts above the partial-cascade notify() call: discriminator (mp.status), cascade-restructure rationale (D-18-03), retry-anchor drop (D-17-09), severity + reload-hint computation reference (D-16-11 + D-16-12), catalog UAT fixture pointer (1154-1183)."
metrics:
  duration_minutes: 11
  duration_seconds: 660
  completed: 2026-05-27
---

# Phase 18 Plan 4: `remove.ts` V1 -> V2 Migration Summary

Migration of `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`
from V1 severity-named wrappers (`notifySuccess` + `notifyWarning`, 4 callsites)
to the V2 structured entry point `notify(opts.ctx, opts.pi, NotificationMessage)`.
Applies D-18-01 (DROP cleanup-leak warnings entirely; underlying `rm()` calls
preserved) and D-18-03 (cascade cause-chain MOVES from marketplace-level body to
per-plugin `PluginFailedMessage.cause`, rendered at 4-space indent per D-16-08).

## What Was Built

### Task 1 -- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`

| Change | Location | Detail |
|--------|----------|--------|
| Drop V1 imports | old lines 73-77, 80 | Removed `softDepStatus`, `cascadeSummary`, `causeChainTrailer`, `renderRow`, `appendReloadHint`, `reloadHint`, `notifySuccess`, `notifyWarning` |
| Drop V1 type imports | old lines 90-94 | Removed `MarketplaceRow`, `PluginCascadeRow`, `SoftDepProbe` |
| Drop dead V1 helpers | old lines 79, 100, 121-133 | Removed `appendLeaks` import (no V2 surface), `RETRY_ANCHOR` literal, `errorMessage` import (no remaining user-facing path), `resourcesDropped()` helper (V2 reload-hint computed structurally) |
| Add V2 imports | new line 63 | `import { notify } from "../../shared/notify.ts";` + `import type { PluginFailedMessage, PluginUninstalledMessage } from "../../shared/notify.ts";` |
| Shrink removePath helper | new lines 96-109 | Signature reduced from `(cleanupLeaks: string[], label: string, pathPromise: Promise<string>)` to `(pathPromise: Promise<string>)`; the failed-path label accumulator is deleted because no V2 surface consumes it; `rm()` still runs inside the try/catch (correctness preserved) |
| Drop completion-cache leak warning | old line 299 | `notifyWarning("...completion cache cleanup deferred...")` REMOVED; the surrounding try/catch keeps its swallowing semantics with explanatory D-18-01 inline comments |
| Drop post-state cleanup-leak warning | old lines 322-336 | The `if (cleanupLeaks.length > 0) { aggregated = appendLeaks(...); trailer = causeChainTrailer(aggregated); notifyWarning(opts.ctx, body); return; }` block REMOVED entirely (no V2 representation per D-18-01); also dropped the `cleanupLeaks: string[]` accumulator |
| Replace V1 partial-cascade call | old lines 363-408 | Single `notify(opts.ctx, opts.pi, { marketplaces: [{ status: "failed", plugins: [...uninstalled, ...failed] }] })` per D-18-03; per-plugin `PluginFailedMessage.cause` carries the per-plugin Error |
| Replace V1 clean-removal call | old line 422 | Single `notify(opts.ctx, opts.pi, { marketplaces: [{ status: "removed", plugins: [] }] })`; reload-hint computed by notify() per D-16-12 |
| Add construction recipe | new comment block above partial-cascade call | Mirror of Plan 18-01 pilot at add.ts:160-169; cross-references catalog UAT fixtures at 1154-1183 |
| Update header docblock | lines 1-56 | Replaced V1 CMC-31/CMC-15/CMC-16 narrative with V2 narrative covering CLEAN, PARTIAL (D-18-03 cause-chain MOVE), and cleanup-leak DROP (D-18-01) |

**File line count:** 434 (V1) -> 287 (V2). Net -147 lines via removed V1 composer plumbing, dead `RETRY_ANCHOR`, dead `resourcesDropped()` helper, and the entire `cleanupLeaks` aggregation block.

### Task 2 -- `tests/orchestrators/marketplace/remove.test.ts`

5 byte-string flips + 1 reload-hint contract flip + 1 test rename + 1 severity flip + 1 retry-anchor assertion delete. Existing `makeCtx()` pattern preserved verbatim per D-18-06.

| Old line | Surface | V1 byte / assertion | V2 byte / assertion |
|---------:|---------|---------------------|---------------------|
| 154 | MR-1 dup-name (project-scope precedence) | `● dup-name [project] (removed)` | `● dup-name [project] (removed)\n\n/reload to pick up changes` |
| 187 | MR-1 user-only scope | `● user-only [user] (removed)` | `● user-only [user] (removed)\n\n/reload to pick up changes` |
| 232 | test NAME | `MR-2 + MR-8 (RH-1): empty marketplace removed cleanly emits success WITHOUT reload hint` | `MR-2 + V2 D-16-12: empty marketplace removed cleanly emits success WITH mp-level reload-hint` |
| 259 | reload-hint includes() boolean | `false` | `true` (RESEARCH Risks #7 contract flip per D-16-12) |
| 262 | byte assertion inside the same test | `● empty [project] (removed)` | `● empty [project] (removed)\n\n/reload to pick up changes` |
| 308 | multi-plugin removal | `assert.match(notifications[0]!.message, /\/reload to pick up changes$/)` | KEPT unchanged (still ends with the trailer on multi-plugin removal) |
| 333 | test NAME (MR-4 cascade) | `MR-4: cascade failure produces ONE aggregated warning ending with the canonical trailer` | `MR-4: cascade failure produces ONE V2 notification with severity=error (D-16-11)` |
| 388 | severity | `"warning"` | `"error"` (D-16-11: any plugin/mp failed -> error) |
| 389-393 | retry-anchor regex | `assert.match(notifications[0]!.message, /Fix the underlying issue and retry\.?$/)` | DELETED (D-17-09 already excluded the retry-anchor from V2 catalog) |

**Tests left UNCHANGED** (per RESEARCH "Tests to KEEP unchanged"):

- `MR-1: --scope omitted + name not in either scope throws MarketplaceNotFoundError` (throw-path).
- `MR-1: same name in both scopes WITH --scope=user removes only user-scope record` (filesystem-state test).
- `NFR-5: remove for a path-source marketplace makes no network calls` (source-level inspection).
- `MR-7: github-source clone dir retained when any plugin failed in cascade` and `MR-7 inverse: github-source clone dir REMOVED on full cascade success` (filesystem-state tests).
- `D-03-INV :: remove unlinks the plugin cache file and invalidates marketplace-names` (cache-state test).
- All 5 `narrowCascadeFailure` unit tests via `__test_narrowCascadeFailure` (the helper is still used in V2 to populate `PluginFailedMessage.reasons[0]`).

**Cleanup-leak tests:** none existed pre-migration. Confirmed via `grep -in "cleanup leak\|cleanupLeaks\|completion cache" tests/orchestrators/marketplace/remove.test.ts` returning 0 lines (the V1 line 354 branch was untested). No tests deleted.

## Verification

```
$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          PASS  1362 tests (1360 pass, 0 fail, 2 todo) -- IDENTICAL to Plan 18-01 baseline
```

Plan-specified invariants:

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (non-comment lines only) | 0 | 0 |
| `grep -c 'from "../../presentation/' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | 0 | 0 |
| `notify(opts.ctx, opts.pi` actual call sites in remove.ts (excluding comments) | 2 | 2 |
| Catalog UAT (`tests/architecture/catalog-uat.test.ts`) byte-equality | GREEN | GREEN (3/3 tests) |
| `tests/orchestrators/marketplace/remove.test.ts` | 16 tests pass | 16 tests pass |
| `tests/orchestrators/marketplace/cascade.test.ts` (no changes required) | 3 tests pass | 3 tests pass |
| `tests/orchestrators/marketplace/shared.test.ts` (no changes required) | 3 tests pass | 3 tests pass |

## Cleanup-Leak DROP Decision (D-18-01)

The V1 surface had TWO independent cleanup-leak `notifyWarning` callsites in
`remove.ts`:

1. **Completion-cache cleanup leak (V1 line 299).** Catches failures from
   `invalidateMarketplaceNames(...)` and `dropMarketplaceCache(...)` and emitted
   `Marketplace "${name}" removed; completion cache cleanup deferred: ${err}`.
2. **Post-state aggregated cleanup leaks (V1 lines 341-356).** Aggregated failures
   from the per-plugin `rm()` of plugin-data dirs (always) and marketplace-data
   dir + clone dir (when no plugin failed) into a single `notifyWarning` with
   inline `causeChainTrailer(...)`.

**Decision:** Both DROPPED per D-18-01. Rationale:

- The V2 `MarketplaceNotificationMessage` type has no field representing
  "cleanup leak after successful state mutation". Folding into
  `status: "failed"` would misrepresent the operation (the state mutation
  DID succeed). Emitting a second `notify()` after the primary would double
  severity routing without a catalog fixture to gate against.
- Precedent: D-17-09 / D-18-01 / add.ts pilot already established this drop.

**Preservation of correctness:**

- The `invalidateMarketplaceNames` and `dropMarketplaceCache` calls STILL run
  inside an explicit try/catch.
- The per-plugin `rm()` calls STILL run via the shrunk `removePath()` helper.
- The marketplace-data / clone-dir `rm()` calls STILL run on the success-only branch.
- Only the user-visible V1 notifyWarning surface is gone.

**Code shape changes from the drop:**

- `removePath(cleanupLeaks: string[], label: string, pathPromise: Promise<string>)` -> `removePath(pathPromise: Promise<string>)`. No second argument is needed because nothing surfaces leaks.
- Deleted the entire `if (cleanupLeaks.length > 0) { ... }` block.
- Deleted the local `cleanupLeaks: string[]` accumulator.
- Deleted the `appendLeaks` import (no V2 surface) and the `errorMessage` import (no remaining user-facing path).
- Deleted the `RETRY_ANCHOR` literal constant.
- Deleted the `resourcesDropped()` helper (V2 reload-hint is computed structurally by `notify()` per D-16-12; no manual RH-1 gate needed).

## Cascade Restructure (D-18-03)

**V1 shape (lines 363-408):**

- Built `headerRow: MarketplaceRow{status:"failed", reasons:["plugins remain"]}` + `childRows: PluginCascadeRow[]` (mixed uninstalled + failed).
- Called `cascadeSummary({marketplace, rows, probe})` to compose the body.
- Appended `appendReloadHint(message, reloadHint(removedSorted))` then `${body}\n\n${RETRY_ANCHOR}`.
- Called `notifyWarning(opts.ctx, body)`.
- The per-plugin Error.cause chain was rendered as part of the cascade summary's `narrowCascadeFailure(fp.cause)` reason text, NOT as a separate per-plugin cause-chain (V1 did not surface the raw Error cause to the user).

**V2 shape:**

```ts
notify(opts.ctx, opts.pi, {
  marketplaces: [{
    name: opts.name,
    scope: resolved.scope,
    status: "failed",
    plugins: [
      ...successfullyUnstaged.map((name): PluginUninstalledMessage => ({
        status: "uninstalled",
        name,
      })),
      ...failedPlugins.map(({ name, cause }): PluginFailedMessage => ({
        status: "failed",
        name,
        reasons: [narrowCascadeFailure(cause)],
        cause, // Per-plugin cause-chain, rendered at 4-space indent by renderPluginRow (D-16-08).
      })),
    ],
  }],
});
```

The per-plugin `cause: Error` is now structurally part of `PluginFailedMessage`; the
renderer (per D-16-08) prints `    cause: ${err.message}` at 4-space indent under
each failed plugin row (see catalog UAT fixture `partial` at
tests/architecture/catalog-uat.test.ts:1162-1183 for the binding byte shape).

V1 `RETRY_ANCHOR` (`Fix the underlying issue and retry.`) is DROPPED entirely (it
was already excluded from the V2 catalog by D-17-09). Severity (`error`) is
computed by `notify()` per D-16-11 (any plugin/mp `failed` -> error). Reload-hint
fires from the at-least-one `uninstalled` plugin per D-16-12.

## Line-232 Test Rename + Reload-Hint Flip (RESEARCH Risks #7)

The test at old line 232:

- **V1 name:** `MR-2 + MR-8 (RH-1): empty marketplace removed cleanly emits success WITHOUT reload hint`
- **V2 name:** `MR-2 + V2 D-16-12: empty marketplace removed cleanly emits success WITH mp-level reload-hint`
- **V1 assertion (line 259):** `notifications[0]!.message.includes("/reload to pick up changes") === false`
- **V2 assertion (line 259):** `notifications[0]!.message.includes("/reload to pick up changes") === true`
- **V1 byte (line 262):** `● empty [project] (removed)`
- **V2 byte (line 262):** `● empty [project] (removed)\n\n/reload to pick up changes`

V2 emits the reload-hint from `mp.status === "removed"` (state-changing per D-16-12),
regardless of whether plugin resources were actually removed. The V1 contract
distinction ("no reload-hint when no plugin resources changed") is deliberately
retired in V2 per the catalog-binding contract.

## Cascade + Shared Test Landmines (RESEARCH §"Cascade + Shared Test Landmines")

Confirmed via direct test runs that the following peer test files require NO
changes for Plan 18-04:

- `tests/orchestrators/marketplace/cascade.test.ts` -- tests the `cascadeUnstagePlugin` function-level behavior; no notify output asserted. **PASS (3 tests).**
- `tests/orchestrators/marketplace/shared.test.ts` -- tests `applyAutoupdateFlipInPlace` / pure helpers; no notify output asserted. **PASS (3 tests).**

The catalog UAT (`tests/architecture/catalog-uat.test.ts`) already binds the V2
byte shape for both `clean` and `partial` remove states; it passes unchanged with
the migrated `remove.ts` because the orchestrator now constructs the exact same
payload shape the UAT runner constructs from the catalog fixtures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped dead `errorMessage` + `resourcesDropped()` + `RETRY_ANCHOR` + `cleanupLeaks` accumulator**

- **Found during:** Task 1 source review after the V1 -> V2 swap.
- **Issue:** The plan called out `appendLeaks` and `RETRY_ANCHOR` as orphans. After applying the D-18-01 cleanup-leak DROP, FOUR additional V1 symbols also became orphaned: `errorMessage` (no remaining user-facing path), `cleanupLeaks: string[]` accumulator, the `resourcesDropped()` helper (V2 reload-hint computed structurally by `notify()` per D-16-12; no manual RH-1 gate needed), and the `removedPlugins` accumulator. Leaving them would have produced TS `noUnusedLocals` warnings and ESLint `no-unused-vars` errors at merge.
- **Fix:** Deleted in lockstep with the V1 callsite removals. The `removePath` helper signature reduced from `(cleanupLeaks, label, pathPromise)` to `(pathPromise)`; underlying `rm()` correctness preserved per D-18-01.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`
- **Commit:** (this task's commit)

**2. [Rule 3 - Cosmetic] Renamed MR-4 cascade test from "ONE aggregated warning ending with the canonical trailer" to "ONE V2 notification with severity=error (D-16-11)"**

- **Found during:** Task 2 review.
- **Issue:** The original test name asserted "canonical trailer" -- factually wrong post-D-17-09 / D-18-03 (the retry-anchor IS the trailer being asserted against, and it is DROPPED in V2).
- **Fix:** One-line test-name change to reflect the V2 contract; the body's deleted regex assertion + severity flip drove the rename.
- **Files modified:** `tests/orchestrators/marketplace/remove.test.ts`

### Other deviations

None. The cleanup-leak DROP, cascade restructure, line-232 rename, and reload-hint flip are all planned (D-18-01, D-18-03, RESEARCH Risks #7).

## Authentication Gates

None.

## V1 -> V2 Migration Status (remove.ts only)

| Status | Count |
|--------|------:|
| V1 wrapper callsites remaining in remove.ts | 0 |
| V2 notify() callsites in remove.ts | 2 (CLEAN + PARTIAL) |
| `presentation/*` imports remaining in remove.ts | 0 |
| Cleanup-leak warnings dropped | 2 (completion-cache + post-state aggregated) |
| Catalog UAT fixtures for `remove` state still GREEN | 2/2 (clean, partial) |

## Threat Flags

None. Per the plan's `<threat_model>` block (T-18-04-01: accept, T-18-04-02: accept), this is an internal API refactor; the cleanup-leak DROP affects only the user-visible notification (the underlying try/catch swallowing already existed in V1; correctness posture unchanged vs NFR-10 containment). No new attack surface or auth/session change.

## Known Stubs

None. remove.ts now emits real V2 NotificationMessage payloads; no placeholder or hardcoded empty fields beyond `plugins: []` on the CLEAN branch, which is structurally required (D-15-08/09).

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` exists, typechecks, lints, and is prettier-clean.
- File `tests/orchestrators/marketplace/remove.test.ts` exists; 16/16 tests pass.
- Plan's verification invariants confirmed (grep counts 0 + 0 for non-comment lines; notify() call count 2).
- `npm run check` exits 0 (typecheck + lint + format:check + 1360 pass / 0 fail / 2 todo).
- Catalog UAT byte-equality GREEN for `clean` + `partial` fixtures.
- Cascade and shared peer test files unchanged and passing (3 + 3 tests).
- No modifications to STATE.md or ROADMAP.md (per parallel_execution rules; orchestrator owns those writes).

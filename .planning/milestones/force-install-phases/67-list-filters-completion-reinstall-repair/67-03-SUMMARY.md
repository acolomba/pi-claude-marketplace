---
phase: 67-list-filters-completion-reinstall-repair
plan: 03
subsystem: api
tags: [completion, classifier, list, cache, schema, force-state, edge-deps]

# Dependency graph
requires:
  - phase: 66-derived-force-state-glyphs
    provides: "the derived force-installed / force-upgradable states + resolver three-way ResolvedPlugin.state the classifier reads"
  - phase: 67-list-filters-completion-reinstall-repair
    plan: 02
    provides: "the FilterBucket shape and availableRowMessage { message, bucket } the list refactor builds on (merged base)"
provides:
  - "plugin-state-classifier.ts: ONE shared pure per-entry classifier (classifyInstalledRecord -> installed|upgradable|force-installed|force-upgradable; classifyManifestEntry -> available|unsupported|unavailable) consumed by BOTH list and the completion bucketizer"
  - "completion plugin-index cache carries the finer 7-status set (schemaVersion 2, auto-evicting stale v1)"
  - "edge-deps bucketizer emits the finer statuses via the shared classifier (no provider-local reclassification; no-network resolveStrict, NFR-5)"
  - "parity drift-guard test: bucketizer equals the shared classifier on a shared fixture (T-67-08)"
affects: [list-filters-completion, force-install-candidate-sets, prd-section-11-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared classifier: list (installedRowMessage / availableRowMessage) and the completion bucketizer (edge-deps loadManifestForMarketplace) both delegate plugin-state classification to plugin-state-classifier.ts -- the caller owns the no-network resolveStrict probe so the classifier stays pure (NFR-5 boundary at the caller)"
    - "Ephemeral cache schema bump: bumping PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion 1->2 auto-evicts stale caches via the existing drop+rebuild-on-mismatch path (no manual migration; the plugin-index cache is NOT the persisted state model -- T-67-07)"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - tests/orchestrators/plugin/plugin-state-classifier.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - tests/orchestrators/edge-deps.test.ts
    - tests/shared/completion-cache.test.ts
    - tests/orchestrators/marketplace/remove.test.ts

key-decisions:
  - "The classifier is PURE: classifyInstalledRecord takes an UpgradeCandidate discriminated union ({ upgradable: false } | { upgradable: true; resolved }) rather than an optional resolved arg, so 'not upgradable' (-> installed) is distinguished from 'upgradable but probe failed' (-> upgradable, CR-01 degrade). The caller owns the no-network resolveStrict probe (NFR-5)."
  - "data.ts (no-force completion) was updated to admit the full installed-inventory status group (installed|upgradable|force-installed|force-upgradable) so no-force completion output stays byte-identical now that the cache no longer flattens every state-present plugin to `installed` (D-67-02)."

patterns-established:
  - "Pattern: when two surfaces must agree on a derived classification, extract one PURE classifier taking already-resolved inputs and add a parity drift-guard test asserting one surface equals the classifier on a shared fixture"

requirements-completed: [LIST-02]

# Metrics
duration: 19min
completed: 2026-06-27
---

# Phase 67 Plan 03: Shared Plugin-State Classifier & Finer Completion Cache Summary

**One shared pure per-entry classifier (`plugin-state-classifier.ts`) is now the single source of plugin-state classification for BOTH `list` and the completion bucketizer (D-67-02); the completion plugin-index cache carries the finer 7-status set (schema v2, auto-evicting), the bucketizer emits those statuses with no network access (NFR-5) and no provider-local reclassification, and a parity drift-guard pins the two surfaces together -- list rendering and no-`--force` completion stay byte-identical.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-06-27T17:59:29-04:00
- **Completed:** 2026-06-27T18:18:20-04:00
- **Tasks:** 2 (Task 1 via TDD RED/GREEN)
- **Files created:** 2; **modified:** 7

## Accomplishments

- **Task 1 (TDD):** Added `plugin-state-classifier.ts` exporting two PURE functions: `classifyInstalledRecord(record, candidate)` (`installed | upgradable | force-installed | force-upgradable`) and `classifyManifestEntry(resolved)` (`available | unsupported | unavailable`). The A4 force-installed-wins precedence and the CR-01 candidate-probe-failure degrade-to-upgradable live inside the classifier; it imports nothing from `platform`/network layers (only `assertNever` + the `ResolvedPlugin` type). Refactored `list.ts` `installedRowMessage` and `availableRowMessage` to obtain their status/bucket from the classifier instead of re-deriving inline -- byte output unchanged.
- **Task 2:** Bumped `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion` 1 -> 2 and widened the `status` union (+ `PluginIndexRow.status`) to the finer 7-status set; bumped both cache write paths (poison + normal) to `2 as const`. Rewired the `edge-deps` bucketizer onto the shared classifier (extracted `classifyInstalledPluginRow` / `classifyNotInstalledPluginRow` helpers to keep cognitive complexity under the ESLint limit). Updated `data.ts` no-`--force` installed-modes filter to admit the full installed-inventory group (byte-identical output). Added edge-deps tests for each finer status plus a D-67-02 / T-67-08 parity drift-guard.
- `npm run check` deterministic surface is green; closed-set tripwire unchanged at **22 / 17 / 7**.

## Task Commits

1. **Task 1 RED:** add failing shared plugin-state-classifier unit tests - `2de48480` (test)
2. **Task 1 GREEN:** extract shared plugin-state classifier; list delegates to it - `225fe8d3` (feat)
3. **Task 2:** widen cache to finer statuses via shared classifier - `cbfaa766` (feat)

**Plan metadata:** committed separately with this SUMMARY.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` (NEW) - the shared pure classifier (two functions + `InstalledRecordLike` / `UpgradeCandidate` types).
- `tests/orchestrators/plugin/plugin-state-classifier.test.ts` (NEW) - unit corpus for both functions incl. A4 precedence and CR-01 degrade.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - `installedRowMessage` / `availableRowMessage` delegate to the classifier; candidate resolve hoisted to the caller (no-network); byte output preserved.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` - `schemaVersion` 1->2; widened `status` Type.Union + `PluginIndexRow.status`; both write paths bumped to v2.
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` - bucketizer emits the finer statuses via the shared classifier (two extracted row-builder helpers; `resolveStrict` no-network).
- `extensions/pi-claude-marketplace/edge/completions/data.ts` - no-`--force` installed-modes candidate set admits the full installed-inventory status group (byte-identical preservation).
- `tests/orchestrators/edge-deps.test.ts` - finer-status bucketizer tests + the D-67-02 / T-67-08 parity drift-guard.
- `tests/shared/completion-cache.test.ts` - plugin-index schemaVersion snapshot + fixtures/poison assertions bumped to v2.
- `tests/orchestrators/marketplace/remove.test.ts` - plugin-cache fixture bumped to schemaVersion 2 for lockstep accuracy.

## Decisions Made

- **`UpgradeCandidate` discriminated union over an optional arg.** `classifyInstalledRecord`'s second parameter is `{ upgradable: false } | { upgradable: true; resolved: ResolvedPlugin | undefined }`. A single optional `resolved?` could not distinguish "not upgradable" (-> `installed`) from "upgradable but probe failed" (-> `upgradable`, the CR-01 degrade) since both would pass `undefined`. The union keeps the classifier pure while encoding both signals.
- **`data.ts` admits the installed-inventory group (D-67-02 byte-identical guarantee).** Previously the bucketizer flattened every state-present plugin to `installed`, so the no-`--force` installed-modes completion (`status === "installed"`) offered force-installed/upgradable plugins too. With the finer cache those get distinct statuses, so the filter was widened to `installed | upgradable | force-installed | force-upgradable` to keep no-`--force` output byte-identical (the `--force`-gated narrowing lands in 67-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No-`--force` completion would regress without a data.ts update**
- **Found during:** Task 2
- **Issue:** The cache widening means a force-installed/upgradable plugin is no longer cached as `installed`; `data.ts`'s installed-modes filter (`row.status === "installed"`) would silently drop them from no-`--force` update/uninstall/etc. completion, violating D-67-02's "without `--force`, completion output is byte-identical to today."
- **Fix:** Added an `INSTALLED_INVENTORY_STATUSES` set and changed the filter to membership in it. `data.ts` was not in the plan's `files_modified`, but the change is required to preserve the locked D-67-02 no-`--force` contract.
- **Files modified:** extensions/pi-claude-marketplace/edge/completions/data.ts
- **Commit:** cbfaa766

**2. [Rule 3 - Blocking] Cache schema bump broke completion-cache + remove tests**
- **Found during:** Task 2
- **Issue:** `tests/shared/completion-cache.test.ts` asserted `schemaVersion === 1` and wrote v1 plugin-index fixtures/poison rows; under the v2 schema those fail validation (changing TTL/poison-serving behavior). `tests/orchestrators/marketplace/remove.test.ts` seeded a v1 plugin cache whose comment claimed validation succeeds.
- **Fix:** Bumped the plugin-index assertions and fixtures to schemaVersion 2 (the marketplace-NAMES stale-1 rebuild test stays at 1 -- different schema). Lockstep with the schema bump.
- **Files modified:** tests/shared/completion-cache.test.ts, tests/orchestrators/marketplace/remove.test.ts
- **Commit:** cbfaa766

**3. [Rule 3 - Blocking] Cognitive complexity + import order (ESLint)**
- **Found during:** Task 2 (pre-commit)
- **Issue:** Inlining both finer-status loops pushed `loadManifestForMarketplace` cognitive complexity to 19 (limit 15); the new test type-imports tripped `import-x/order`.
- **Fix:** Extracted `classifyInstalledPluginRow` / `classifyNotInstalledPluginRow` module helpers; reordered the type imports.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/edge-deps.ts, tests/orchestrators/edge-deps.test.ts
- **Commit:** cbfaa766

### Documented No-ops

**4. [Note] `manifestRef` cache field untouched.** The schema's optional `manifestRef` is unrelated to the status widening; left as-is.

---

**Total deviations:** 3 blocking fixes auto-applied (all required to keep `npm run check` green and honor the D-67-02 byte-identical contract); 1 no-op. No scope creep -- every touched file serves the LIST-02 / D-67-02 classifier-extraction + cache-widening goal.

## Closed-set tripwire evidence

- `tests/architecture/notify-closed-set-locks.test.ts` passes: `STATUS_TOKENS.length === 22`, `PLUGIN_STATUSES.length === 17`, `MARKETPLACE_STATUSES.length === 7`. No token bump (none expected -- the finer statuses live in the completion-cache status union, a different closed set from the render-token sets; no new render token).
- `tests/architecture/no-orchestrator-network.test.ts` green: the bucketizer's candidate resolve stays the no-network `resolveStrict` (NFR-5); the new classifier module imports no `platform`/git surface.
- `tests/architecture/catalog-uat.test.ts` green (no rendered-byte drift -- the list refactor is behavior-preserving).

## Flaky-test note (environmental, NOT caused by this plan)

Two full-suite `npm run check` runs each surfaced ONE non-deterministic failure in an UNRELATED, timing/FS-race test, and a DIFFERENT test each run:
- `tests/architecture/hooks-async-rewake.test.ts` "D-62-05: PID table reflects both entries until each exit fires" (process-exit timing; `2 !== 1`).
- `tests/orchestrators/marketplace/autoupdate.test.ts` "IDEMPOTENT flip leaves config BYTE-IDENTICAL" (`ENOTEMPTY` temp-dir cleanup race).

BOTH pass deterministically in isolation (`node --test <file>` -> 0 fail). They are pre-existing parallel-execution environment races on this machine, unrelated to the classifier/cache changes (which all pass deterministically). Logged here per the scope boundary; NOT fixed (out of scope, not caused by this task).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 67-04 can build the `--force`-gated completion candidate sets directly on this cache: `install` = `available + unsupported`, `update` = `upgradable + force-upgradable`, `unavailable` excluded. The finer statuses are already in the cache rows; the `--force`-position detection narrows the existing no-`--force` sets that this plan kept byte-identical.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` exists on disk.
- `tests/orchestrators/plugin/plugin-state-classifier.test.ts` exists on disk.
- Task commits `2de48480` (test), `225fe8d3` (feat), `cbfaa766` (feat) exist in history.
- `grep schemaVersion completion-cache.ts` shows the plugin-index literal is `2`.
- STATE.md / ROADMAP.md untouched (worktree mode; orchestrator owns those writes).

---
*Phase: 67-list-filters-completion-reinstall-repair*
*Completed: 2026-06-27*

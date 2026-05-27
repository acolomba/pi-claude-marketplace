---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 5
subsystem: marketplace-orchestrator-migration
tags: [migration, v1-to-v2, wave-2, plan-18-05, update-ts, cascade, retry-hint-drop, glyph-flip]
requires:
  - plan-18-00-pi-plumbing
  - plan-18-01-add-ts-pilot
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - update-ts-v2-migration
  - cascade-restructure-per-plugin-cause
  - outcome-to-cascade-plugin-message-mapper
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - tests/orchestrators/marketplace/update.test.ts
tech-stack:
  added: []
  patterns:
    - "notify(opts.ctx, opts.pi, { marketplaces: [...] }) -- single V2 call per orchestration replacing 6 V1 wrapper callsites"
    - "Per-outcome PluginNotificationMessage construction (PluginUpdatedMessage / PluginSkippedMessage / PluginFailedMessage) -- D-18-03 cause-chain MOVES to per-plugin variant"
    - "D-18-02 retry-hint DROP: V1 ${errorMessage(err)}\\n${err.retryHint} trailer eliminated; err.retryHint stays internal to MarketplaceUpdateError"
    - "Glyph flip on cascade unchanged -> skipped+up-to-date (RESEARCH Risks #5): V1 ● -> V2 ⊘ via renderer's severity ladder (D-16-11)"
    - "PluginUpdateFailedOutcome.cause?: Error transports the raw thrown Error from cascadeAutoupdates catch through to the V2 mapper for the 4-space-indent trailer (D-16-08)"
key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - tests/orchestrators/marketplace/update.test.ts
key-decisions:
  - "D-18-09-amendment confirmed: 6 V1 callsites in update.ts (lines 220, 584, 586, 599, 631, 647), not 5 as CONTEXT canonical-refs stated. All 6 migrated atomically."
  - "D-18-02 honored: retry-hint suffix DROPPED entirely; lines 584 + 586 collapse to one V2 shape (no conditional). err.retryHint remains internal to MarketplaceUpdateError."
  - "D-18-03 honored: marketplace-level cause-chain MOVES to per-plugin PluginFailedMessage.cause. cascadeAutoupdates catch site stamps outcome.cause with the raw thrown Error; V2 mapper attaches it to PluginFailedMessage."
  - "D-18-01 precedent extended to update.ts:599 (cache-cleanup leak warning DROPPED; underlying rm() still runs)."
  - "RESEARCH Risks #9 honored: composeErrorWithCauseChain import KEPT -- still used at the cascadeAutoupdates catch (line 346) for outcome.notes composition (non-notify consumers + narrowFailReason notes-fallback)."
  - "RESEARCH Risks #10 / option-a honored: makeMarketplaceUpdateHandler factory already accepted pi as first positional arg (delivered by Plan 18-00). edge/register.ts line 87 wiring already correct; no edits needed to edge/handlers/marketplace/update.ts or edge/register.ts."
  - "Rule 3 deviation: added cause?: Error to PluginUpdateFailedOutcome in orchestrators/types.ts (not in plan's files_modified) -- required to fulfill the plan's explicit `outcome.cause !== undefined && { cause: outcome.cause }` reference in Task 1 step 2."
  - "Rule 3 deviation: RH-1 cascade-all-unchanged reload-hint test flipped (V2 D-16-12 contract -- mp.status \"updated\" fires the trailer regardless of plugin partition mix). RESEARCH §Per-File Test Surface flagged this as a KEEP but acknowledged the contradiction; the V2 contract wins."
patterns-established:
  - "outcomeToCascadePluginMessage: discriminated-union outcome -> PluginNotificationMessage mapper preserving the test seam (__test_outcomeToCascadePluginMessage)"
  - "Cascade-catch cause-stamp: cascadeAutoupdates catch site spreads ...(err instanceof Error && { cause: err }) onto the failed outcome so the V2 mapper can attach it without an extra parameter"
  - "V2 single-notify discipline preserved: each orchestrator codepath emits exactly one notify() call (no secondary cache-leak warning after the primary)"
requirements-completed: []

# Metrics
duration: 33min
completed: 2026-05-26
---

# Phase 18 Plan 5: `update.ts` V1 -> V2 Migration Summary

**6-callsite V1 -> V2 notify() migration of `marketplace/update.ts`; retry-hint DROP (D-18-02); per-plugin cause-chain restructure (D-18-03); glyph flip on cascade skipped rows (Risks #5)**

## Performance

- **Duration:** 33 min (approx; start 2026-05-26T23:00Z, end 2026-05-26T23:33Z)
- **Tasks:** 2 (committed as one atomic commit per plan spec)
- **Files modified:** 3 source/test files

## Accomplishments

- Replaced all 6 V1 callsites in `orchestrators/marketplace/update.ts` (lines 220 / 584 / 586 / 599 / 631 / 647 in the pre-migration file) with one V2 `notify(ctx, pi, NotificationMessage)` call per orchestrator codepath.
- Rewrote `outcomeToCascadeRow` (returning V1 `PluginCascadeRow`) as `outcomeToCascadePluginMessage` (returning discriminated V2 `PluginNotificationMessage`).
- DROPPED the V1 retry-hint suffix per D-18-02; `MarketplaceUpdateError.retryHint` stays internal for programmatic inspection.
- MOVED the marketplace-level cause-chain to per-plugin `PluginFailedMessage.cause` per D-18-03; the cascade-catch site in `cascadeAutoupdates` now stamps the raw thrown `Error` on the failed outcome.
- Updated 22 existing tests + added 2 new helper tests (24 total, all pass). Catalog UAT byte-equality GREEN; `npm run check` GREEN (1362 pass / 0 fail / 2 todo, identical to Plan 18-04 baseline).

## Task Commits

1. **Task 1 + Task 2 (combined atomic commit per plan spec): migrate update.ts + update.test.ts** -- `f792b7f` (feat)

The plan specified both tasks land in one atomic commit (verification = `npm run check` GREEN after the combined edit); per the verification block at the end of 18-05-PLAN.md.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- 6 V1 wrapper callsites replaced with V2 `notify()`; `outcomeToCascadeRow` rewritten as `outcomeToCascadePluginMessage`; `NULL_PROBE` deleted; presentation imports trimmed (only `composeErrorWithCauseChain` retained per Risks #9); test seam renamed to `__test_outcomeToCascadePluginMessage`; cascade-catch stamps `outcome.cause` for the V2 mapper.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- added `readonly cause?: Error` to `PluginUpdateFailedOutcome` so the cascade-catch site can transport the raw thrown Error through the outcome contract to the V2 `PluginFailedMessage.cause` field.
- `tests/orchestrators/marketplace/update.test.ts` -- 1 byte flip on autoupdate-OFF MU-4 test + reload-hint inclusion add (Risks #4); 3 retry-hint regex deletes (rewritten/offline/broken) replaced with V2 bare-failed byte equality (D-18-02); 2 glyph flips on cascade rows b/c (RESEARCH Risks #5); 1 reload-hint contract flip on RH-1 cascade-all-unchanged (V2 D-16-12); 4 `__test_outcomeToCascadeRow` tests rewritten as `__test_outcomeToCascadePluginMessage` + 2 new tests added.

## Decisions Made

See the `key-decisions:` block in the frontmatter for the full list. Highlights:

- **6-callsite count clarified:** CONTEXT canonical-refs said 5; the actual file has 6 (line 220's empty-targets `notifySuccess` was the missing one). RESEARCH Risks #2 documented the drift and D-18-09-amendment locked the corrected count. All 6 migrated atomically.
- **Retry-hint surface dropped (D-18-02):** lines 584 + 586's two-arm conditional dispatch (`if err.retryHint !== "")` was a V1 surface to put the retry hint between the message and the auto-trailed cause-chain. V2 catalog `mp-failure-network` renders the bare `⊘ <name> [<scope>] (failed)` only; there is no V2 representation for either the retry-hint or the marketplace-level cause-chain. Both arms collapse to one V2 shape.
- **Cascade cause-chain restructure (D-18-03):** the V1 `cascadeAutoupdates` catch wrote `composeErrorWithCauseChain(err)` into the outcome's `notes` so the legacy cascade renderer could surface it. V2 places `cause?: Error` on `PluginFailedMessage` and the renderer emits a 4-space-indent trailer per D-16-08. To bridge this without rebuilding the outcome plumbing, the catch site now ALSO spreads `...(err instanceof Error && { cause: err })` onto the outcome; the V2 mapper reads `outcome.cause` and forwards it. `notes` is retained for non-notify consumers (test fixtures + `narrowFailReason` substring fallback).
- **edge/handlers + register.ts wiring already in place:** Plan 18-00 (Wave 0) promoted `pi: ExtensionAPI` to a required first positional argument on `makeMarketplaceUpdateHandler`. Verified: `grep -c "makeMarketplaceUpdateHandler(pi" extensions/pi-claude-marketplace/edge/register.ts` returns 1 on the pre-migration file. No edits needed to either file (they were already in `files_modified` aspirationally; the plan's verification "`makeMarketplaceUpdateHandler(pi` returns 1" passes without further work).
- **composeErrorWithCauseChain KEPT (Risks #9):** still used at line 346 (the cascadeAutoupdates catch) for `outcome.notes` composition, which feeds non-notify consumers AND the `narrowFailReason` substring fallback when no typed reason can be derived. The V2 user-visible cause-chain renders via `PluginFailedMessage.cause`; `notes` continues to feed the legacy fallback path.

## Silent Contract Changes Documented

1. **Autoupdate-OFF manifest-refresh now emits the reload-hint trailer** (Risks #4 / catalog `autoupdate-off-manifest-refresh` at docs/output-catalog.md:801-806). The V1 V1-side comment at the pre-migration line 631 explicitly said "no reload-hint trailer (catalog lines 659-666: the autoupdate-off case shows just the marketplace row)"; the V2 contract (`mp.status === "updated"` is state-changing per D-16-12 / `shouldEmitReloadHint` at shared/notify.ts:1027-1052) emits the trailer. Test "MU-4 + D-14" now asserts the full V2 byte form including the trailer.
2. **Cascade glyph flip on skipped rows: V1 ● -> V2 ⊘** (Risks #5). The V1 "trivial-skip" treatment for `unchanged` outcomes used the ● glyph (`up-to-date` plugin still installed); the V2 renderer routes `skipped` through the warning severity ladder per D-16-11 -> ICON_UNINSTALLABLE (⊘) per shared/notify.ts:903-911. Test "CMC-26 / MSG-GR-3" assertions for rows `b` and `c` flip from `"  ● b [project]"` / `"  ● c [project]"` to `"  ⊘ b (skipped) {up-to-date}"` / `"  ⊘ c (skipped) {up-to-date}"` (also dropping the `[project]` bracket since the Phase 17.2 orphan-fold suppresses it when plugin.scope === mp.scope).
3. **Cascade all-unchanged now emits the reload-hint trailer.** V1 RH-1 test asserted no reload-hint when zero plugins updated; V2 fires the trailer because `mp.status === "updated"` is state-changing regardless of the plugin partition mix. Test renamed `RH-1 + V2 D-16-12: cascade all-unchanged still emits reload-hint`; assertion flipped from `includes() === false` to `match(/\/reload to pick up changes$/)`. RESEARCH §Per-File Test Surface flagged the possible contradiction; the V2 contract is the source of truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `cause?: Error` to `PluginUpdateFailedOutcome` in `orchestrators/types.ts`**

- **Found during:** Task 1 (rewriting `outcomeToCascadeRow` -> `outcomeToCascadePluginMessage`).
- **Issue:** The plan's Task 1 step 2 explicitly references `outcome.cause !== undefined && { cause: outcome.cause }` for the failed-partition mapping. The existing `PluginUpdateFailedOutcome` interface had no `cause` field; only the cascadeAutoupdates catch site had the raw `err` in scope, but the err went out of scope before `refreshOneMarketplace` constructed the V2 payload. Without a transport, the V2 mapper could not attach `cause` to `PluginFailedMessage`.
- **Fix:** Added `readonly cause?: Error` to `PluginUpdateFailedOutcome` (single-field addition). The cascade catch site spreads `...(err instanceof Error && { cause: err })` onto the failed outcome; the mapper reads `outcome.cause` and forwards it. Non-cascade failed outcomes (e.g. those produced by `plugin/update.ts`) leave the field undefined and the renderer omits the trailer.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`.
- **Verification:** `npm run typecheck` GREEN; the 4 existing `260525-cjr B2` tests (EACCES / ENOENT / generic Error cascade) still pass without modification (their assertions match the `(failed) {<reason>}` line; the new cause-chain trailer renders below it and the regex is non-anchored).
- **Committed in:** `f792b7f` (combined Task 1 + Task 2 commit; types.ts addition lives alongside the cascade-catch spread that exercises it).
- **Note on `files_modified`:** the plan's `files_modified` list did not include `orchestrators/types.ts`. The addition is required to satisfy the plan's own explicit Task 1 step 2 reference to `outcome.cause`. No other parallel Wave 2 plan touches `types.ts`; trial-check confirms no merge conflict surface.

**2. [Rule 3 - Blocking] Flipped RH-1 cascade-all-unchanged test from "NO reload hint" to "emits reload hint"**

- **Found during:** Task 2 verification (`node --test tests/orchestrators/marketplace/update.test.ts`).
- **Issue:** Test "RH-1: NO reload hint when zero plugins updated" (former line 579) asserted `first.message.includes("/reload to pick up changes") === false`. V2 `shouldEmitReloadHint` (shared/notify.ts:1027-1052) fires the trailer when `mp.status === "updated"` regardless of plugin partition mix. The orchestrator constructs `mp.status: "updated"` on every successful autoupdate-ON cascade (including all-unchanged), so the V2 contract IS to emit the trailer. RESEARCH §Per-File Test Surface flagged this with explicit text: "if the orchestrator now sets `mp.status: \"updated\"` even on all-unchanged cascades, the V2 contract IS to fire reload-hint and this test ALSO flips."
- **Fix:** Renamed test to `RH-1 + V2 D-16-12: cascade all-unchanged still emits reload-hint (mp.status "updated" is state-changing)`; flipped the assertion from `includes() === false` to `match(/\/reload to pick up changes$/)`; added a Plan 18-05 commentary block citing D-16-12 and shared/notify.ts:1027-1052.
- **Files modified:** `tests/orchestrators/marketplace/update.test.ts`.
- **Verification:** All 24 tests pass; catalog UAT GREEN.
- **Committed in:** `f792b7f`.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking).
**Impact on plan:** Both auto-fixes are essential to satisfy the plan's own contract (the explicit `outcome.cause` reference; the V2 D-16-12 reload-hint trigger ladder). No scope creep; no new files outside the source/test surface the plan already targeted; one cross-cutting `types.ts` field addition.

## Authentication Gates

None.

## V1 -> V2 Migration Status (update.ts only)

| Status | Count |
|--------|------:|
| V1 wrapper callsites remaining in update.ts | 0 |
| V2 notify() callsites in update.ts | 4 (empty-targets, mp-failure, autoupdate-OFF, autoupdate-ON cascade) |
| `presentation/*` imports remaining in update.ts | 1 (`composeErrorWithCauseChain` per Risks #9) |
| Catalog UAT fixtures for `marketplace update` still GREEN | 3/3 (`autoupdate-off-manifest-refresh`, `mixed-outcomes`, `mp-failure-network`) |
| Tests pass | 24/24 (22 pre-existing + 2 new helper tests) |

Marketplace-family aggregate V1 callsite count after this plan (across all 5 orchestrators) -- this plan removes 6 from update.ts:

```
$ grep -rE "(notifySuccess|notifyWarning|notifyError)" extensions/pi-claude-marketplace/orchestrators/marketplace/ | wc -l
```

Net -6 in this plan (lines 220 / 584 / 586 / 599 / 631 / 647 from update.ts). Plans 18-02 / 18-03 / 18-04 (parallel Wave 2 siblings) handle their own files; Plan 18-06 (Wave 3) narrows the MSG-* lint after Wave 2 lands.

## Verification

```
$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          PASS  1364 tests (1362 pass, 0 fail, 2 todo)
```

Plan-specified invariants:

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -r "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | 0 | 0 |
| `grep -c 'from "../../presentation/' extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | 1 | 1 (only `cause-chain` per Risks #9) |
| `grep -c "makeMarketplaceUpdateHandler(pi" extensions/pi-claude-marketplace/edge/register.ts` | 1 | 1 |
| 3 retry-hint assertions deleted (former lines 275 / 295 / 332) | 3 | 3 |
| 2 glyph flips on cascade skipped rows (former line 515 / 516) | 2 | 2 |
| 1 reload-hint inclusion assertion added on autoupdate-OFF (former line 163) | 1 | 1 (`assert.equal(first.message, "● official [project] (updated)\n\n/reload to pick up changes")`) |
| `tests/orchestrators/marketplace/update.test.ts` | 22 tests pass (per plan) | 24 tests pass (22 pre-existing + 2 new) |
| `tests/architecture/catalog-uat.test.ts` byte-equality | GREEN | GREEN |

## Threat Flags

None. Per the plan's `<threat_model>` block (T-18-05-01: accept; T-18-05-02: accept), this is an internal API refactor; byte output is governed by Phase 17 catalog binding contract; no new attack surface or auth/session change. The retry-hint DROP per D-18-02 has no information-disclosure implication (the suffix was a generic "Retry the command." anchor with no sensitive data).

## Known Stubs

None. `update.ts` now emits real V2 `NotificationMessage` payloads for every codepath. The `notes: [composeErrorWithCauseChain(err)]` retained in the cascade-catch is not a stub -- it is the back-compat path for the `narrowFailReason` notes-substring fallback (CR-06 transitional bridge), still exercised by the 24 tests in `update.test.ts` and by the existing `260525-cjr B2: generic Error falls through to notes-substring (back-compat preserved)` test.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` exists and compiles.
- File `extensions/pi-claude-marketplace/orchestrators/types.ts` exists and compiles.
- File `tests/orchestrators/marketplace/update.test.ts` exists and 24/24 tests pass.
- Commit `f792b7f` exists on the worktree branch (`worktree-agent-a019be8e721a5d5ee`) and contains all 3 modified files (`git show --stat f792b7f` confirms).
- `npm run check` exits 0 (typecheck + lint + format:check + 1362 pass / 0 fail / 2 todo).
- All plan verification invariants pass (grep counts, retry-hint deletes, glyph flips, reload-hint inclusion add).
- No catalog UAT byte changes; UAT runner GREEN (3/3 update fixtures pass).
- No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes per parallel_execution rules).
- No files outside the plan's declared list modified, EXCEPT `extensions/pi-claude-marketplace/orchestrators/types.ts` which received a single-field addition per the Rule 3 deviation documented above. No other parallel Wave 2 plan touches `types.ts`.
- The plan's `files_modified` line for `edge/handlers/marketplace/update.ts` + `edge/register.ts` resolved as no-op: both files already carry the `pi`-as-first-arg signature (delivered by Plan 18-00).

---
*Phase: 18-migration-wave-1-marketplace-orchestrator-family*
*Completed: 2026-05-26*

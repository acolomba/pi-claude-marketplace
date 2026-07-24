---
phase: 02-caller-stamped-severity-reload-reducer
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-stamp-coverage.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notify-inert-fields.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/shared/snm37-behavioral-smoke.test.ts
  - tests/shared/snm38-indent-ladder.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-24
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

This is an output-preserving refactor that converts `notify()` from a content-derived severity/reload ladder into a dumb reducer (numeric MAX over caller-stamped `row.severity`, OR-reduce of `row.needsReload`, tally by stamped facts) and pushes the desired-state judgment out to every producer. I traced the reducer (`cascadeSeverity`, `computeSeverity`, `shouldEmitReloadHint`, `countRowsBySeverity`, `buildSummaryLine`) and every stamping producer against the documented D-03/D-06 maps and the `docs/output-catalog.md` byte contract.

**Correctness: the refactor is sound.** All 203 tests in the phase's suite pass (`catalog-uat`, `notify-stamp-coverage`, `notify-grammar-invariant`, `notify-v2`, `notify-inert-fields`, `snm37/38`, `enable-disable`, `reconcile/apply`). The reducer logic is correct: `cascadeSeverity` MAX-reduces both marketplace-level and nested plugin `severity` with an `info` default; `shouldEmitReloadHint` OR-reduces `needsReload` with the info-kind short-circuit intact; the `reconcile-applied-cascade` kind-level reload suppression is preserved even though its rows stamp `needsReload:true`. Every `assertNever` exhaustiveness tail (`renderPluginRow`, `renderMpHeader`, `computeSeverity`, `buildSummaryLine`, `shouldEmitReloadHint`, `tools.ts::projectRowStatus`, `reconcile/notify.ts::applyOutcomeToBlock`/`blockToMarketplaceMessage`) is intact and total over the closed sets. The collapsed `present`→`installed` status and removed `disable-cascade` kind leave no dangling references in source (only documentary comments remain).

No BLOCKER-class defects found. The findings below are a stale-doc cluster (the migration left several comment blocks describing the deleted content-ladder) and one genuine test-coverage gap: nothing binds the *producer-stamped* severity/needsReload values to the catalog — the catalog UAT validates the reducer against hand-written fixture payloads, not against the orchestrators' actual stamps.

## Warnings

### WR-01: No end-to-end gate binds producer-stamped severity/needsReload to the catalog

**File:** `tests/architecture/catalog-uat.test.ts:3037-3150`; cross-cutting over every producer
**Issue:** The catalog UAT drives `notify()` with **hand-written fixture payloads** (`FIXTURES`) whose `severity`/`needsReload` stamps are authored independently of what the orchestrators actually stamp. It proves the *reducer* renders byte-correctly given correctly-stamped input, and `notify-stamp-coverage.test.ts` covers the two reconcile *projections*, and the type-level GATE-01 (`TransitionMessageBase`) forces transition rows to stamp *something*. But no test verifies a producer stamps the *correct value*. A producer that regressed to `needsReload: false` on a realized install row, or `severity: "warning"` on a failed row, would still type-check (the field is present) and would NOT be caught by catalog-uat (which never invokes the orchestrator). This is the load-bearing risk the refactor introduces: severity/reload correctness moved from one centrally-tested function to ~15 distributed stamp sites with only partial coverage.
**Fix:** Add an integration-level gate that invokes representative standalone orchestrator arms (install/uninstall/update/reinstall/enable/disable success + a benign skip + a failure) through a mock `ctx.ui.notify` and asserts the emitted 2nd-arg severity and the presence/absence of the `/reload to pick up changes` trailer — i.e. assert the producer→reducer→wire path, not just the reducer. The reconcile family already has this via `notify-stamp-coverage.test.ts`; extend the same dynamic-introspection pattern to the render-map producers.

### WR-02: Stale severity documentation in `autoupdate.ts` header contradicts the emitted (and correct) code

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:13-18`
**Issue:** The file header documents idempotent autoupdate flips as `severity: "warning"`:
```
//  - enable idempotent -> status: "skipped", reasons: ["already autoupdate"]
//  -> `● <mp> [<scope>] <autoupdate> {already autoupdate}`
//  severity: "warning"
```
The actual emitted row (lines 555-563) omits `severity`, defaulting to `info` (rank 0) — which is the **correct** value per the catalog (`docs/output-catalog.md:108` classifies `already autoupdate`/`already no autoupdate` as all-benign → info; `catalog-uat.test.ts:2449-2485` pins both as info with no `expectedSeverity`). So the code is right and the doc is wrong, but a future maintainer reading this header could "fix" the code to match the stale comment and introduce a real output drift on a currently-green path.
**Fix:** Update the header lines 13-18 to say `severity: "info"` (benign idempotent skip per UXG-02 / D-28-06), matching the emitted behavior and the catalog.

### WR-03: Idempotent autoupdate skip row omits the severity/needsReload stamp, relying on defaults

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:555-563`
**Issue:** The `alreadyMatching` branch emits a `skipped` marketplace row with no `severity` and no `needsReload`:
```ts
if (row.alreadyMatching) {
  return { name: row.name, scope: row.scope, status: "skipped",
    reasons: [opts.enable ? "already autoupdate" : "already no autoupdate"], plugins: [] };
}
```
`MpSkipped extends MpCommon extends MessageBase`, so both fields are optional and default to info/false — which happens to be the catalog-correct value. But the catalog-uat fixture for the SAME state (`catalog-uat.test.ts:2455-2462`) explicitly stamps `severity: "info"` and `needsReload: false`. The producer relies on the implicit default while the fixture is explicit; this is the one producer that does NOT follow the phase's "producers stamp caller-supplied severity/needsReload" convention for a non-transition row. It is not an output bug (defaults coincide), but it is an inconsistency that defeats the design's intent of making every stamp explicit and auditable, and it sits exactly on the path WR-01 cannot catch.
**Fix:** Stamp the idempotent skip row explicitly: `severity: "info", needsReload: false` (matching the catalog fixture and the SEV-01/RLD-01 default contract made explicit).

### WR-04: Stale content-ladder documentation in `notify-v2.test.ts` header

**File:** `tests/shared/notify-v2.test.ts:104-108`
**Issue:** The test-file JSDoc still describes the DELETED content-derived severity ladder as the live contract:
```
//     1. Any plugin.status === "failed" OR mp.status === "failed" -> "error"
//     2. Any plugin.status in {"skipped", "manual recovery"}      -> "warning"
```
After this phase, severity is the numeric MAX over caller-stamped `row.severity`, not status inference. The test fixtures themselves were updated to carry explicit `severity` stamps (so the tests pass), but the documentation now lies about how the reducer derives severity. A reader trusting this header would misunderstand the reducer contract and could author a fixture without a stamp expecting status inference to "do the right thing."
**Fix:** Replace the status-inference description with the SEV-02/RLD-02 stamped-fact contract (MAX over `row.severity`, OR-reduce of `row.needsReload`), mirroring the accurate header already present in `notify-inert-fields.test.ts:1-14`.

## Info

### IN-01: `notify.ts:2386,2439` and `enable-disable.ts:1007` retain `disable-cascade` references in comments

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2386,2439`; `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1007`
**Issue:** The `disable-cascade` cascade kind was removed this phase, but several comments still narrate it ("the former `disable-cascade` kind straddle is now a per-row stamped fact"). These are accurate *historical* notes explaining the migration and are arguably useful, but they reference a construct that no longer exists in the type model, which can confuse a reader grepping for `disable-cascade` expecting to find a live kind.
**Fix:** Optional — these are acceptable as migration-rationale anchors. If trimming, keep one canonical explanation (e.g. on `shouldEmitReloadHint`) and drop the duplicates.

### IN-02: `composeRollbackPartialLines` cause-chain indent comment cites wrong indent width

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2462-2464`
**Issue:** `renderIndentedCauseChain`'s JSDoc says "per-plugin cause (`indent = " "`, 4 spaces) and the per-rollback-phase cause (`indent = " "`, 6 spaces)" — the literal `" "` shown is a single space in both cases (a copy artifact); the actual call sites pass 4- and 6-space strings. The prose width is correct; only the inlined literal is misleading. Not a functional issue (the renderer is exercised byte-for-byte by `snm38-indent-ladder.test.ts`).
**Fix:** Optional — correct the inlined literal or drop it in favor of the prose width.

### IN-03: `cascadeSeverity` and `countRowsBySeverity` re-walk the same flattened rows independently

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2121-2142, 2245-2261`
**Issue:** `cascadeSeverity` (MAX reduce) and `countRowsBySeverity` (tally) perform two separate traversals of `marketplaces[].plugins[]`, and `buildSummaryLine` triggers a third via the count helpers. For the cascade sizes in this domain (a handful of rows) this is irrelevant to correctness and out of scope for v1 performance review; flagged only as a structural note that the stamped-fact model now invites a single-pass reduce-and-tally if a future refactor wants it.
**Fix:** None required (out of v1 perf scope). Noted for awareness.

---

_Reviewed: 2026-06-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

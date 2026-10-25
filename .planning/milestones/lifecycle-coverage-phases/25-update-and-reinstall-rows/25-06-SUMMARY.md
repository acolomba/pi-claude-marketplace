---
phase: 25-update-and-reinstall-rows
plan: 06
subsystem: absent-target-rows
tags: [update, reinstall, not-installed, failed-row, backfill, UPR-04]

requires:
  - phase: 25-update-and-reinstall-rows
    provides: plan 05's reinstall record inputs and reinstall-flow's pre-runner arm
provides:
  - RecordNotInstalledOutcomeInput, reinstall's `failed {not installed}` outcome
  - reachedBeforeRunner (renamed from skippedBeforeRunner)
  - triageUpdateMembership's record-first `failed {not installed}` verdict
  - emitMarketplaceNotAddedSignal's cross-scope `failed` row, typed CommandContext<"failed">
  - backfill's silent converge for a `not installed` reinstall outcome
affects: [25-07 preflight failures, 25-08]

actuals:
  tokens: 16500
  tasks: 2
  commits: 2
plan_head_before: d1af8790967d65ca4fb089c319abdc034ec4e158
plan_head_after: c6f3cdaddc53d09a57bea1b79b07ba48a1c92700

tech-stack:
  added: []
  patterns:
    - "recordReinstallOutcome tells its two failed inputs apart with `\"error\" in input`"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - features/plugin/reinstall.feature
    - features/plugin/update.feature
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/plugin-reinstall.ts
    - test/architecture/catalog-uat/fixtures/plugin-update.ts

key-decisions:
  - "The not-installed reinstall input is a second `failed` input (`reason: \"not installed\"`), and the skipped input's reason narrows to `already disabled`"
  - "cascadeSkipSeverity loses both its `not installed` and its `not found` terms: no update producer stamps either on a skipped outcome"
  - "The autoupdate cascade's per-plugin runner returns the same `failed {not installed}` verdict when a record vanishes under it"

requirements-completed: [UPR-04]

duration: 70min
completed: 2026-10-24
status: complete
---

# Phase 25 Plan 06: Not-installed targets fail on update and reinstall Summary

**`reinstall` and `update` of a plugin the scope does not record now render `⊘ pp (failed) {not installed}` at error severity and change no file, as `uninstall` does and as Claude Code does. `update` checks the record before the manifest. The cross-scope row `{not installed, marketplace in <scope> scope}` is a failure for both verbs. Backfill stays silent about the same outcome.**

## Accomplishments

- `reinstall-record.ts`: a new `RecordNotInstalledOutcomeInput` (`partition: "failed"`, `reason: "not installed"`) composes `{ partition: "failed", name, marketplace, scope, notes: ["not installed"], reasons: ["not installed"] }`, with no cause and no version. `RecordSkippedOutcomeInput.reason` narrows to `"already disabled"`.
- `reinstall-flow.ts`: the missing-record arm of `runReinstall` returns that failed outcome. `skippedBeforeRunner` is renamed `reachedBeforeRunner`, since it now wraps a failure and a skip.
- `reinstall.messaging.ts`: the skipped row's severity is `skipSeverity(reasons)` for every skip. The error flip for a skipped absent target and its comment are gone.
- `reconcile/backfill.ts::maybeBackfillPlugin`: the failed arm returns `false` with no row when the outcome's reasons include `not installed`, the converge of a concurrent uninstall. The skipped arm's comment no longer lists the concurrent uninstall.
- `update-preflight.ts::triageUpdateMembership`: a missing record returns the failed `not installed` verdict whatever the manifest lookup found. The absent-manifest branch is gone. The `StaticPreflightRowOptions` doc now says the failed row is the plugin with no install record. Nothing else in the file changed. The fence diff over `makeUpdateCloneProbe` .. `deriveUpdateToVersion` printed nothing before the commit, and `error instanceof StateLockHeldError` still appears once.
- `shared.ts::emitMarketplaceNotAddedSignal`: the `notInstalledAt` arm renders a `failed` row at `error`, and the parameter is `CommandContext<"failed">`. Its doc and the `MarketplaceNotAddedSignal.notInstalledAt` doc are rewritten.
- `update-cascade.ts::cascadeSkipSeverity`: the `not installed` term is gone. The remaining `not found` term then showed as uncovered. `grep -rn '"not found"' orchestrators/plugin/update-*.ts` finds only `typedDirectFailReason` in `update-flow.ts`, which names a failed row, so no update producer stamps it on a skip. That arm was deleted too, with no test added.
- `update-flow.ts`: the two comments that named the skipped not-installed preflight row now name the failed row.
- Scenarios: `reinstall.feature` "Reinstalling a plugin that is not installed fails as not installed and changes nothing" states a `failed` row with empty `leaks` and `rollback partial`. `update.feature` gains "Updating a plugin that is not installed fails as not installed and changes nothing".
- Catalog: `standalone-not-installed-error`, `reinstall-not-installed-cross-scope`, and `update-not-installed-cross-scope` render `(failed)` rows. The prose of those states, of reinstall's `missing-marketplace-not-added`, and of `enable-not-installed` no longer names a skipped not-installed row for update or reinstall. Enable's own rows did not change.

## Task Commits

1. Task 1: reinstall of a plugin that is not installed fails as not installed, end to end. Commit `c8be5d53`.
2. Task 2: update fails as not installed too, and the cross-scope row is a failure for both verbs. Commit `c6f3cdad`.

## Answers the plan asked for

- **`cascadeSkipSeverity`'s `not found` arm:** deleted (see above).
- **BFILL-01 backfill case:** `BFILL-01: emits no promotion row when the record is removed between the snapshot and the re-materialize` passes unedited. It reaches the new `not installed` early return in the failed arm: no outcome row, and the scan stamps `lastReconciledExtensionVersion`, so the gate closes. No new backfill case was added.
- **Catalog state count:** 303, unchanged. `EXPECTED_UTF8_BYTES` moved 49_019 -> 49_016 (three rows changed `(skipped)` to `(failed)`, one byte each).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The reinstall line of `reserved-record-keys.test.ts` moved into task 1**
- Found during: task 1 (`npm run test:integration`)
- Issue: the plan put both lines of that integration test in task 2. Task 1 alone made the reinstall line fail.
- Fix: task 1 changed the reinstall line to `(failed) {not installed}`. Task 2 changed the update line from `(failed) {not in manifest}` to `(failed) {not installed}`.
- Commits: `c8be5d53`, `c6f3cdad`

**2. [Rule 1 - Stale comment] `enable-disable.ts`**
- Found during: task 2
- Issue: a comment in enable's absent-target arm said `update`'s `cascadeSkipSeverity` and `reinstall`'s in-scope skipped arm stamp the same `not installed` set `error`. Both are gone after this plan. The file is outside the plan's list.
- Fix: a comment-only change, saying `uninstall`, `update`, and `reinstall` stamp that set `error` on their `(failed)` rows. Enable's behavior did not change.
- Commit: `c6f3cdad`

**3. [Rule 2 - Test hygiene] Assertions tightened while updating cases**
- `PRL-06` and `GAP-14` in `reinstall-flow.test.ts` now assert the whole outcome and the exact notification, not a partition and a regex. The triage test in `update-preflight.test.ts` is now two sibling cases over a declared and an undeclared plugin, each asserting the same whole verdict.

### Behavior note

The marketplace autoupdate cascade runs `beginPluginUpdateRun` per recorded plugin. When a record vanishes under it (a concurrent uninstall), the per-plugin verdict is now `failed {not installed}` instead of `skipped {not installed}`. The test "UPR-04: routes a not-installed preflight failure through the flow owner" pins it. The plan did not name this path, but it reads the same triage verdict.

No file owned by Phase 26 was staged.

## Changed test expectations

| File | Case | Now |
| --- | --- | --- |
| `reinstall-record.test.ts` | the skipped-outcome case | not-installed failure plus already-disabled skip |
| `reinstall-flow.test.ts` | PRL-06, GAP-07, GAP-08, GAP-14 | `failed {not installed}` |
| `reinstall-flow.test.ts` | ATTR-03/SCOPE-01 plug, SCOPE-01 hello cross-scope | `(failed) {not installed, marketplace in user scope}` |
| `reinstall.messaging.test.ts` | single missing target | failed outcome, `⊘ alpha (failed) {not installed}` |
| `update-preflight.test.ts` | triage of a target with no record | `failed {not installed}` for both lookups |
| `update-flow.test.ts` | PUP-1 not in state, PUP-1 not in state or manifest, SCOPE-01 cross-scope, PUP-1 fallback, swapState-plugin-gone, flow-owner routing | `failed {not installed}` |
| `update-cascade.test.ts` | absent targeted result | failed outcome, `⊘ hello (failed) {not installed}` |
| `shared.test.ts` | both `emitMarketplaceNotAddedSignal` cases | `failed` policy, failed plugin row |
| `notify-producer-wire-coverage.test.ts` | absent-target rows of both verbs | `failed` rows, still `error` with no reload |
| `reserved-record-keys.test.ts` | `reinstall` and `update` of an absent plugin | `(failed) {not installed}` |

## Verification

- `npm run test:coverage:direct` on `reinstall-record.ts`, `reinstall-flow.ts`, `reinstall.messaging.ts`, `types.ts`, `reconcile/backfill.ts` (task 1), and on `update-preflight.ts`, `shared.ts`, `update-cascade.ts`, `update-flow.ts`, `reinstall-flow.ts`, `enable-disable.ts` (task 2): exit 0.
- `npm run test:architecture`: exit 0. `npm run test:integration`: exit 0.
- Cucumber: `reinstall.feature` and `reconcile.feature` (29 of 29), `update.feature` and `reinstall.feature` (35 of 35).
- `awk` over the reinstall and update sections of `docs/output-catalog.md` counts 0 `(skipped) {not installed`. `grep -c 'status: "skipped"' shared.ts` is 0. Neither fixture file contains `(skipped) {not installed`.
- `npm run check` at `c6f3cdad`: exit 0 (752 of 752 scenarios).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-11 is mitigated: both verbs now report an absent target as `failed`, matching uninstall and upstream's `not_installed` failure code, and tests pin the exact rows and the unchanged state and declarations. T-25-12 is mitigated: under backfill a `not installed` outcome emits no row and lets the gate close (BFILL-01), while every other failure still emits its row and keeps the gate open.

## Self-Check: PASSED

- Commits `c8be5d53` and `c6f3cdad` are ancestors of HEAD.
- `not installed` appears in `reinstall-flow.ts` and `backfill.ts`; `CommandContext<"failed">` appears in `shared.ts`.
- `grep -c 'includes("not installed") ? "error"' reinstall.messaging.ts` is 0, and `grep -c "pp@fixtures | pp   | skipped" features/plugin/reinstall.feature` is 0.

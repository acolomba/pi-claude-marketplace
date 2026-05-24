---
phase: 14-drift-guard-test-alignment
plan: 01
subsystem: orchestrators/plugin reinstall
tags: [CMC-16, D-14-02, MSG-MR-1, MSG-MR-2, manual-recovery, cascade-emission]
requirements: [CMC-16]
dependency_graph:
  requires:
    - "presentation/manual-recovery.ts::renderManualRecovery (existing composer; consumed unchanged)"
    - "presentation/compact-line.ts::ManualRecoveryLine (existing RowSpec variant; consumed unchanged)"
    - "shared/grammar/reasons.ts::Reason (\"rollback partial\" closed-set token; consumed unchanged)"
    - "orchestrators/types.ts::ReinstallFailedOutcome.failureClass (\"manual-recovery\" tag; consumed unchanged)"
  provides:
    - "Production caller of renderManualRecovery in orchestrators/plugin/reinstall.ts (closes CMC-16 BLOCKER)"
    - "isManualRecoveryOutcome type guard for filter-callback narrowing"
    - "__test_renderReinstallPartitionAndNotify seam for downstream regression tests"
  affects:
    - "User-visible bulk-reinstall output on manual-recovery outcomes: cascade body now has a separate top-level `⊘ <name>@<marketplace> (manual recovery) {rollback partial}` line below it, separated by `\\n\\n` (MSG-MR-1)"
    - "Removes dead-code import + `void` seam from orchestrators/marketplace/remove.ts (no production behavior change there; the path never emitted manual-recovery anchors)"
tech_stack:
  added: []
  patterns:
    - "Filter + type-guard narrowing for discriminated-union variants (matches existing ReinstallReinstalledOutcome filter pattern in same function)"
    - "`__test_*` re-export seam for direct binding tests of file-private functions (matches __test_outcomeToCascadeRow / __test_errorWithManualRecovery / __test_findManualRecoveryError precedent)"
key_files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
    - "tests/orchestrators/plugin/reinstall.test.ts"
decisions:
  - "Anchor emission lives in `renderReinstallPartitionAndNotify`, NOT inside `outcomeToCascadeRow` (per RESEARCH.md §Pitfall 5 -- outcomeToCascadeRow has a single responsibility: build a PluginCascadeRow; the anchor is a separate top-level line per MSG-MR-1)."
  - "Anchor `resource` slot collapses to `${name}@${marketplace}` (MSG-MR-2 mandates no `[<scope>]` and no separate `@<marketplace>` slot on ManualRecoveryLine; the entity composition lives inside the free-form `resource` string)."
  - "Anchor reasons pin to `[\"rollback partial\"]` (matches the per-row cascade Reason set by `outcomeToCascadeRow`'s manual-recovery branch; cause-chain text surfaces separately via the notify boundary's depth-5-bounded cause-chain trailer)."
  - "Cascade body composition (lines 416-483 pre-edit) preserved byte-equal for non-manual-recovery outcomes (the new emission appends below the cascade body, gated by `manualRecoveryAnchors.length === 0`)."
  - "remove.ts dead-code seam removed entirely (per Task 2 / D-14-02 final sub-clause): the hedge \"reachable if a future deviation surfaces\" no longer applies once reinstall.ts carries the canonical caller. If a marketplace-remove ManualRecoveryError ever materializes, the import + emission can be added at that time."
  - "Added `__test_renderReinstallPartitionAndNotify` seam (mirrors existing pattern) rather than driving manual-recovery through a real fs-permission injection -- the bulk path `reinstallPlugins` does not propagate `__deps` to its inner `reinstallPlugin` calls, so an end-to-end fixture would require new plumbing well beyond the plan's scope."
metrics:
  duration: "~12 minutes"
  completed: "2026-05-24T18:20:28Z"
  tasks_total: 3
  tasks_completed: 3
  files_modified: 3
  tests_added: 1
  npm_check: "green at 5bd7f81 (1147 tests pass)"
---

# Phase 14 Plan 01: CMC-16 closure (manual-recovery anchor wiring) Summary

Closes CMC-16 (audit BLOCKER, `.planning/v1.3-MILESTONE-AUDIT.md` lines 19-25) by wiring `presentation/manual-recovery.ts::renderManualRecovery` into production via `orchestrators/plugin/reinstall.ts`, and dropping the dead-code `void renderManualRecovery;` seam from `orchestrators/marketplace/remove.ts` that the audit also flagged.

## One-liner

Manual-recovery anchor line (MSG-MR-1 / MSG-MR-2) now emits below the bulk-reinstall cascade body when a `ManualRecoveryError` propagates; the `(failed) {rollback partial}` cascade-row binding is preserved byte-equal.

## What changed

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (`d612318`)

- Imported `renderManualRecovery` from `../../presentation/manual-recovery.ts`.
- Imported types `ManualRecoveryLine` (from `presentation/compact-line.ts`) and `ReinstallFailedOutcome` (from `../types.ts`).
- Added inside `renderReinstallPartitionAndNotify` (after `const body = bodySegments.join("\n\n");`):
  - A filter over `outcomes` selecting the new `isManualRecoveryOutcome` type guard.
  - For each match, constructs a `ManualRecoveryLine{kind:"manual-recovery", resource:"${name}@${marketplace}", reasons:Object.freeze(["rollback partial" as const])}` and calls `renderManualRecovery(line, probe)`.
  - Joins multiple anchors with `\n\n` (each its own top-level compact line per MSG-MR-1).
  - Composes `composedBody = manualRecoveryAnchors.length === 0 ? body : ${body}\n\n${...}` (the leading `\n\n` satisfies MSG-MR-1's blank-line discipline above the first anchor).
  - The dispatch path (`appendReloadHint(composedBody, hint)`) now consumes `composedBody` instead of `body`; severity dispatch unchanged.
- Added a small file-private type guard `isManualRecoveryOutcome(outcome): outcome is ReinstallFailedOutcome & { readonly failureClass: "manual-recovery" }` hoisted out of the filter callback so the narrowing is named and reusable.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (`406e22e`)

- Removed `import { renderManualRecovery } from "../../presentation/manual-recovery.ts";`.
- Removed the 5-line comment block + `void renderManualRecovery;` dead-code statement (lines 91-96 of the original file).
- Updated the file header comment block (lines 25-31 of the original) to note that Phase 14 D-14-02 centralized the CMC-16 emission in `orchestrators/plugin/reinstall.ts`; the marketplace-remove path remains intentionally unemitted (no system-level resource participates).
- `grep -c 'void renderManualRecovery' remove.ts` → 0; `grep -c 'renderManualRecovery' remove.ts` → 0.

### `tests/orchestrators/plugin/reinstall.test.ts` (`5bd7f81`)

- Added `__test_renderReinstallPartitionAndNotify` to the existing `__test_*` import set.
- Added `renderRow` import from `presentation/compact-line.ts` so the new test composes the expected anchor string THROUGH the renderer (preserves grammar contract).
- Added type imports `ReinstallPluginOutcome`, `ManualRecoveryLine`, `SoftDepProbe`.
- Added one new test named `"D-14-02 / CMC-16: manual-recovery outcome emits separate top-level anchor line below cascade body"` (33rd test in the file). Asserts:
  1. Cascade `(failed) {rollback partial}` row preserved byte-equal.
  2. Successful reinstall row co-exists in the same cascade body.
  3. Separate anchor `⊘ broken@mp (manual recovery) {rollback partial}` composed via `renderRow` is present in the body.
  4. The anchor is preceded by `\n\n` (MSG-MR-1 blank-line discipline).
  5. Reload-hint trailer still composes for the successful reinstall row.
  6. Severity routes via `notifyWarning` (MSG-SR-6: never `notifyError` on cascade summaries).

- Added a paired `__test_renderReinstallPartitionAndNotify` re-export in `reinstall.ts` mirroring the existing `__test_outcomeToCascadeRow` / `__test_errorWithManualRecovery` / `__test_findManualRecoveryError` pattern.

## How the production path now behaves

```
# Bulk reinstall with one manual-recovery failure and one success:

● mp [project]
  ⊘ broken [project] (failed) {rollback partial}
  ● good [project] v1.0.0 (reinstalled)

⊘ broken@mp (manual recovery) {rollback partial}

/reload to pick up changes
```

The cascade-row line and the separate top-level anchor line are byte-distinct: the cascade row is INDENTED beneath the marketplace header and carries no `@<marketplace>` slot (CMC-02); the anchor is at top-level, carries no `[<scope>]` (MSG-MR-2), and its `resource` collapses to `name@marketplace`. The two lines do NOT duplicate information visually -- they serve complementary purposes (per-row cascade status vs. system-level manual-recovery alert).

## Verification (per plan `<verify>` blocks)

| Verifier                                                                   | Expected         | Observed |
| -------------------------------------------------------------------------- | ---------------- | -------- |
| `grep -c 'renderManualRecovery' reinstall.ts`                              | ≥1 production    | 2 (import + invocation) |
| `grep -c 'void renderManualRecovery' remove.ts`                            | 0                | 0        |
| `grep -c 'renderManualRecovery' remove.ts`                                 | 0                | 0        |
| `node --test tests/orchestrators/plugin/reinstall.test.ts`                 | new test passes  | 33/33 ok |
| `npm run check`                                                            | green            | green (1147 tests pass; typecheck + lint + format:check all clean) |
| Existing `__test_outcomeToCascadeRow` regression on `failureClass="manual-recovery"` mapping | still asserts `["rollback partial"]` | preserved (test 19 of 33 still passes) |

## Deviations from Plan

None -- all three tasks executed exactly as written.

The plan's Task 3 action stated `"(or renderReinstallPartitionAndNotify directly if a test seam exists)"`. I added a `__test_renderReinstallPartitionAndNotify` re-export to enable the second branch. This is not a deviation: the plan explicitly anticipated the option, and the seam matches the existing `__test_*` re-export pattern used throughout `reinstall.ts` (`__test_outcomeToCascadeRow`, `__test_errorWithManualRecovery`, `__test_findManualRecoveryError`). Adding the seam was the lower-risk choice over forcing a real `ManualRecoveryError` via fs-permission injection through the bulk path (which would have required propagating `__deps` from `reinstallPlugins` to its inner `reinstallPlugin` calls -- well beyond plan scope).

## Threat surface scan

No new threat surface introduced. T-14-01 (Information) and T-14-02 (Tampering) from the plan's threat register remain accepted/mitigated as planned:

- T-14-01: anchor's `resource` slot uses `${name}@${marketplace}` -- same content the cascade row already exposes; no new info leak. Cause-chain trailer continues to depth-5 bound at the notify boundary (Phase 13 / T-13-04 mitigation, unchanged).
- T-14-02: `renderManualRecovery` import added to reinstall.ts; flows through the ESLint BLOCK C `orchestrators/ → presentation/` direction. No new path-containment risk (no file I/O touched).

## Known Stubs

None. The emission path is fully wired and exercised by the new test.

## Commit chain

- `d612318` -- `feat(14-01): wire ManualRecoveryLine emission into reinstall orchestrator` (Task 1: production wiring + type guard)
- `406e22e` -- `refactor(14-01): drop dead-code renderManualRecovery seam from mp remove` (Task 2: dead-code removal)
- `5bd7f81` -- `test(14-01): cover ManualRecoveryLine emission below cascade body` (Task 3: regression test + `__test_*` seam)

## Self-Check

- [x] `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- modified, commit `d612318` (and `5bd7f81` for seam export)
- [x] `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- modified, commit `406e22e`
- [x] `tests/orchestrators/plugin/reinstall.test.ts` -- modified, commit `5bd7f81`
- [x] All three commits present in `git log --oneline`
- [x] `npm run check` green at HEAD (`5bd7f81`)

## Self-Check: PASSED

---
phase: 06-import-marketplace-planning
plan: 02
subsystem: orchestrators
status: complete
tags: [mim-03, rollback-partials, install, enable, reconcile]
requires: []
provides:
  - "Orchestrated install outcome of a dependency failure carries the member's rollbackPartials (D-PL6-04)"
  - "Orchestrated enable failed outcome carries rollbackPartials (D-PL6-11)"
  - "PluginInstallFailedOutcome: cause widened to Error, optional rollbackPartials (D-PL6-05)"
affects: [06-04 import rows, 06-05 apply rows]
tech-stack:
  added: []
  patterns: ["conditional spread for optional outcome members (exactOptionalPropertyTypes, NREG-01)"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - test/orchestrators/reconcile/apply-outcomes.test.ts
decisions:
  - "memberPartials derives its return type from InstallPluginOutcome's failed arm instead of importing RollbackPartial, so install-flow.ts's shared import block stays untouched"
  - "The standalone handleCascadeThrow return is unchanged: nothing reads it, and the standalone rows already render the partials"
  - "PluginInstallFailedOutcome.rollbackPartials uses the redacted row shape { phase, cause? }, never the raw ledger msg"
requirements: [MIM-03]
metrics:
  duration: 25min
  completed: 2026-10-26
estimate:
  tokens: 60000
  tasks: 3
actuals:
  tokens: 4200
  tasks: 3
  commits: 3
plan_head_before: 26d795a9
plan_head_after: 969f39a171f5b3cf70f3e9ebe65820a7b4040ec7
---

# Phase 06 Plan 02: Rollback partials on orchestrated failure outcomes Summary

Three changes so import and apply can show install's per-phase rollback rows. The orchestrated install outcome of a failed dependency now carries that dependency's rollback partials. So does the orchestrated enable failure. The reconcile failed-install outcome type now takes any `Error` cause and an optional list of redacted `{ phase, cause? }` partials.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | A failed dependency's rollback partials ride the orchestrated install outcome (tracer) | e1dbd1e0 | install-flow.ts, install-flow.test.ts |
| 2 | The orchestrated enable failure carries its rollback partials | ea683e87 | enable-disable.ts, enable-disable.test.ts |
| 3 | The reconcile failed-install outcome takes an Error cause and rollback partials | 969f39a1 | apply-outcomes.ts, apply-outcomes.test.ts |

`commits: 3` counts only this plan's commits. Measured with `git rev-list --count 26d795a9..HEAD -- <the six plan files>`. Sibling plans 06-01 and 06-03 committed in between (e72392ff, 635c0360, 4c989ed8), so the unfiltered range count is 6.

## Changed functions per shared file (for the phase merge against Phases 1, 2, 4)

- `orchestrators/plugin/install-flow.ts`: `handleCascadeThrow` only (its doc comment and its orchestrated return), plus a new module-private helper `memberPartials` directly below it. No import change.
- `orchestrators/plugin/enable-disable.ts`: the `failed` arm of `EnableDisablePluginOutcome` (new optional `rollbackPartials` with a doc comment), and the `enable-failed` arm of `outcomeToTypedResult` (the I4 comment is rewritten and the partials are spread in). Nothing else.
- `orchestrators/reconcile/apply-outcomes.ts`: `PluginInstallFailedOutcome` only. The `cause` doc comment is rewritten, `cause` is widened to `Error`, and `rollbackPartials` is added. The `DependencyCascadeError` and `DirectoryPinUnsatisfiedError` imports stay, because the runtime classifier further down still uses them.

## TDD evidence

- Task 1 RED: the new case failed only on the missing `rollbackPartials` member (`actual: { status, cause }`). It passes after the change. A second case pins the arm where the member's undo finished: the outcome is `{ status, error, cause }` with no `rollbackPartials`. The closure arm is already pinned by "RESV-01 / RESV-06: a dependency no marketplace declares fails the install whole" (`assertRetryFailure` checks the exact key set).
- Task 2 RED: the dedicated case failed only on the missing `rollbackPartials` member. It is now a two-row data table (partials present / absent). The GHB-03 `typedFailure` deep-equal gained the member (Pitfall 6).
- Task 3: type-level only. The `@ts-expect-error` that pinned the narrow cause became a positive `satisfies` check (bare `Error` cause plus one `skills` partial).

## Verification

- `node --test test/orchestrators/plugin/install-flow.test.ts`: 311/311 pass.
- `node --test test/orchestrators/plugin/enable-disable.test.ts`: 177/177 pass.
- `node --test test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/notify.test.ts`: 321/321 pass.
- `npm run test:coverage:direct -- <source>` exit 0 (100%) for install-flow.ts and enable-disable.ts.
- `npm run typecheck` exit 0 on the combined tree with the sibling plans' work in progress. Widening `cause` broke nothing in 06-03's or 06-05's files.
- Acceptance greps: `orchestrated callers cannot consume` 0; `readonly rollbackPartials?: readonly RollbackPartial[]` 1 in enable-disable.ts; `install failure causes are DependencyCascadeError` 0; the narrow `cause?:` union 0; `rollbackPartials` in apply-outcomes.ts 1.
- The commit hook (`npm run check:commit`) passed on all three commits. The full `npm run check` is left to plan 06-06, as instructed.

## Deviations from Plan

### Auto-fixed Issues

None. The plan was executed as written. Two small choices inside its latitude:

- **memberPartials return type.** `RollbackPartial` is not imported in install-flow.ts. Adding the import would put a hunk in the shared import block. So the helper's return type is `Pick<Extract<InstallPluginOutcome, { status: "failed" }>, "rollbackPartials">`, from the already-imported outcome type.
- **Extra regression cases.** Task 1 has a no-partials member case, and Task 2 has a no-partials enable row. The behaviors call for these, and V8 branch coverage does not tell the two operands of the `&&` guard apart.

## Process notes

Sibling pre-commit runs stash the unstaged edits of the whole worktree for the length of each hook. Twice during this plan my unstaged edits were missing for a short time, then pre-commit put them back. Before each later edit and commit, I waited for any running hook in this worktree to finish (`scratchpad/waithook.sh`). Right after each commit, I checked that my files were present and clean.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-04 and T-06-05 stay as planned. The outcomes carry raw rollback causes, and the doc comments on all three types make redaction the consumer's job (D-PL6-12): import in plan 06-04, apply in plan 06-05.

## Self-Check: PASSED

- FOUND: e1dbd1e0, ea683e87, 969f39a1 (all ancestors of HEAD)
- FOUND: all six modified files

---
quick_id: 261025-n1z
status: complete
date: 2026-10-25
---

# Quick task 261025-n1z summary

- `convergence.ts`: `planConvergenceCascade` orders moves dependencies first
  and returns each record's declarations; `settleMoveCascade` releases the
  held dependents the planned moves satisfy (shrink-only loop) and names the
  marker lifts that wait on moves; `installedCopyUnsatisfied` judges a failed
  dependent's copy (a pinned git copy exactly; a path source, whose old
  declarations are gone, fails closed only when the dependency moved for it).
- `dependency-verdict.ts`: `releasableDependents`, `verdictWithout`,
  `verdictAfterMoves`, `stillHeld`, `firstUnsatisfied`.
- `read-pass.ts` and `pending.ts` settle the plan through `settleMoveCascade`;
  the read pass carries the deferred enables out of the toggle step.
- `apply.ts`: `convergeScope` runs the cascade (`{dependency failed}` for a
  move whose dependency did not land), then the deferred enables, then
  disables a failed dependent whose copy rejects the moved dependency.
- Docs: the two-run exception in `docs/dependency-resolution.md` is replaced
  by the cascade rules. BACKLOG APPLY1-01 resolved; PROJECT.md records
  APPLY1-D1 (supersedes D-12b's two-run acceptance); CHANGELOG sub-bullet.
- Upstream: Claude Code 2.1.310 checks each install's recorded
  `depConstraints` against the dependency's installed version at load
  (`dependency-version-unsatisfied`), the installed-copy judgement used here;
  no contradiction. Upstream records those constraints, so it knows them for
  path sources too, where this extension fails closed.

Rows: a deferred dependent that moves reports `(installed)` at its new
version (the enable row), not an `(updated)` row. A failed dependent that is
disabled shows two rows: its failed move and the `(disabled)` row.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Rework after the second review (APPLY1-REVIEW, 4 Critical, 5 Warning, 4 Info)

The review showed the post-move check covered one shape only. Structural fix:
releases decide only what `apply` attempts; one pass after the cascade
(`disableUnmetAfterCascade`) judges every enabled plugin against what landed
with the LOAD-01 verdict, transitively, and disables each unmet one with a
remedy naming the failed move. It acts only on holds the cascade can change
(new holds, or holds a move could meet), so a missing dependency stays
MISS-01's to install. Each released held-down record's enable runs right
after its own pin refresh; a move counts as landed only at the version the
plan judged; failed toggle enables count as dependencies that did not land.

| Finding | Fix |
|---|---|
| CR-01 | post-cascade pass disables a released dependent whose dependency did not land, whatever happened to its own move |
| CR-02 | the pass uses the transitive verdict (seeded with failed dependents), so a disable reaches every plugin above it |
| CR-03 | a held-down record's enable runs right after its pin refresh, in cascade order; a failed enable is a failed step and its dependents are skipped |
| CR-04 | deferral covers every released held-down record; enable-only steps take their place in the cascade by the declaration closure, and failures propagate step by step |
| WR-01 | `moveReached` requires the planned version; the pass catches any release cascade B no longer satisfies |
| WR-02 | net `(updated)` row for a moved-and-enabled record; `pending` lists one `(will update)` row (`MoveCascade.preview`) |
| WR-03 | own-move and dependency-failed remedies (`cascadeDisabledOutcome`); the fail-closed arm names the dependency the scope left unmet before the moves |
| WR-04 | only released lifts are deferred; a lift the current state satisfies runs with the toggles |
| WR-05 | the two scenarios that encoded CR-01/CR-03 are corrected; probe scenarios added (fail on a777b12f) |
| IN-01 | not changed: the enable path classifies the same EACCES as `{unreadable}` |
| IN-02 | the installed-copy check measures only the landed dependencies |
| IN-03 | not changed: the release loop still runs inside the read-pass lock, but only when a held dependent is releasable |
| IN-04 | the pass runs in a `finally`, so a GHB-03 throw mid-cascade still judges what landed |

## Second rework (APPLY1-REVIEW-2: 2 Critical, 5 Warning, 4 Info)

The post-cascade pass is now an invariant check over the final state:
`judgeFinalScope` judges every enabled record by its catalog plus installed
copy declarations (D-12a) against each dependency's recorded version and
enabled state, with a marker record read as disabled, to a fixed point.

| Finding | Fix |
|---|---|
| CR-A | a held-down record with a move of its own is deferred (move, then enable), released or not; the judgement reads installed copies against every dependency, not only this run's moves; `apply.feature:353` now expects one net `(updated)` row |
| CR-B | the judgement reads marker records as disabled; a released enable is deferred whether or not it carries the marker; a failed enable-only step propagates to the steps above |
| WR-A | no narrowing: every enabled record is judged; a disable already refused this apply is not retried |
| WR-B | one row per plugin: a deferred step that stays disabled reports nothing; a skipped move of an enabled record is `(skipped)`, replaced by its `(disabled)` row; holds only for plugins that end enabled; a toggle enable the judgement undoes reports neither row |
| WR-C | a failed deferred enable restores the pre-move pin and reports the move's `(failed)` row |
| WR-D | falls out of the judgement |
| IN-A | the routing rebuild (`closeScopePass`) and the hold rows also run on the GHB-03 throw path |
| IN-B | not changed: a failed walk disables nothing (D-05-07 conflict, reported) |
| IN-C | a move that lands on another version counts as landed; the judgement measures it |
| IN-D | the narrowing comment is gone with the narrowing |

Changed existing tests: D-05-16/PU-5 and LOAD-03/MISS-01 (keeper is disabled
the same apply its dependency is removed; the next pass reinstalls it and
enables keeper); D-09-07, D-09-08 and LOAD-02 (held-down records with a growth
move are enabled in cascade order; D-09-08's rows are now lib before app).
The refused-disable and lock-count tests pass unchanged.

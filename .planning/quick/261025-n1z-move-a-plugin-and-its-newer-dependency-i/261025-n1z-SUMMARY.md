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

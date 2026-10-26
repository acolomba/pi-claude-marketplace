---
quick_id: 261025-vf1
status: complete
date: 2026-10-25
---

# Quick task 261025-vf1 summary

- `install-cascade.ts`: `moveOutOfRange` reports recorded members outside the
  merged range as `dependencies-out-of-range` (nothing materialized);
  `rootRecorded` materializes a recorded root's closure only
  (`dependencies-installed`).
- `dependency-move.ts` (new): judges every move with the update preflight
  (`judgeOnly`, writes nothing) and runs the moves through
  `materializeLatestVersion` under `UPDATE_MATERIALIZATION`, with the
  requester's ranges folded into the constraint gate (`constraint-fold.ts`
  `ConstraintRequester`).
- `install-flow.ts`: install judges the moves inside its lock (a refusal is
  RESV-05's row with the move's cause), runs them after it, then installs
  again; `createUpdateDependencyResolver` settles an update's new closure
  through the same cascade, moves included.
- `materialize-latest.ts`: settles the closure before the swap when the
  runner binds a settler; a refusal fails the update at its installed version.
  `update-flow.ts` binds it for `update` and autoupdate, not for `apply`'s
  converge runner; `beginPluginUpdateRun` takes the command's context.
- Rows: dependency rows ride the update outcome (`dependencyRows`) and render
  beside the plugin's row; install's block shows a moved dependency's
  `(updated)` row in place of its skip.
- Records: PROJECT.md UPD-DEP-D1 (amends RESV-05, upstream divergence);
  `docs/dependency-resolution.md`, `docs/output-catalog.md` (new
  `dependency-cascade-moved-into-range` state), CHANGELOG sub-bullet.
- Upstream: Claude Code 2.1.310's `installResolvedPlugin` force-includes and
  refetches an installed dependency whose version fails a range an installed
  plugin records (a failed move is skipped, "pinner stays demoted"), but
  refuses an install whose own range rejects an installed dependency
  (`installed-unsatisfied`, `suggestDependencyUpdate`). `updatePluginOp` never
  resolves the new version's closure.
- `pending`: missing-dependency installs and catalog moves were already
  previewed (MISS-01, APPLY1-D1); a config-disabled dependency stays disabled.
  No new `pending` scenario can fail on f8e715c9.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

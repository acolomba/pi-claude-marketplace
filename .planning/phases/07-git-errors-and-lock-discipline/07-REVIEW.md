---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-28T19:11:29Z
reviewed_commit: d2d93c0f0351b1b5c8f9e757c0975d4a46595d48
depth: standard
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - test/orchestrators/plugin/clone-gc.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-28T19:11:29Z
**Reviewed commit:** `d2d93c0f0351b1b5c8f9e757c0975d4a46595d48`
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The original CR-01 concurrent-fetch race is closed for the interleaving that
reported it. Cleanup now takes one fresh scope lock, re-derives live keys, and
targets only the supplied candidate set. A distinct mirror warmed by a
concurrent locked fetch is not a candidate, so the sweep cannot delete it.
The collector still routes deletion through `pluginCloneDir`, keeps live and
shared keys, swallows cleanup failure, and does not nest the non-reentrant
scope lock.

The replacement protocol nevertheless regresses the other half of the
dependency-plan cleanup contract. It derives candidates only from the final
accepted move steps, even though planning itself can materialize several
discarded move candidates plus root and fresh-plugin previews. No sweep is
created when the plan refuses or throws. Those operation-created clones are
therefore leaked, contrary to the established fail-clean behavior and the
module's own promise to collect the clones the plan created.

The supplied combined-tree gate remains green at the reviewed inputs (1126
scenarios / 11509 steps and 309 direct LCOV records). A focused read-only run
of the five changed owner test modules also passed. Those tests validate the
new distinct-mirror negative control, but they do not exercise a real git
preview or a ruled-out candidate that materializes a clone before the plan
refuses.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Refused and backtracked dependency plans leak the clones they materialized

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts:162-168`

**Issue:** `planCloneSweep` builds its entire ownership set from
`cleanupCloneKeys` on the final accepted plan's `move` steps. This omits three
real write paths:

1. A plan search can successfully judge and materialize multiple versions of
   one move before `ruleOut` discards earlier choices
   (`dependency-plan.ts:324-346`). Only the last choice is copied into a step
   at `dependency-plan.ts:572-590`, so every earlier candidate key is lost.
2. Root and fresh-member previews call the install preflight. That preflight
   explicitly clones a git source on cache miss
   (`install-outcome.ts:897-928`), but materialize steps carry no cleanup keys
   and `planCloneSweep` ignores them.
3. `installAfterMoves` keeps a no-op sweep until the plan succeeds
   (`install-flow-planning.ts:243-250`). `settlePlanned` likewise returns on a
   thrown or refused plan before calling `planSweep`
   (`dependency-settle.ts:260-273`). A refusal after any of the writes above
   therefore performs no cleanup at all.

This is not only a theoretical omission. `previewInstall` documents and
implements the cache-miss clone before later name and agent-target checks can
throw. The planner also has tested backtracking paths that judge 3.0.0, rule
it out, and then judge 2.0.0. On either a later refusal or an execution failure
before the previewed member lands, the corresponding mirror/per-commit
directories remain unreferenced on disk. The previous sweep removed all
clones created after its initial snapshot; the new tests changed the refusal
expectations to assert that no sweep runs, without replacing that cleanup
coverage with explicit ownership for these materializations.

The result violates NFR-3 fail-clean semantics and the Phase 4/7 dependency
contract recorded in `dependency-settle.ts:16-23`: clones the plan created
must be removed while clones that predated it stay. Repeated refused installs
or resolver backtracking can accumulate unreachable cache directories
indefinitely.

**Fix:** Track clone ownership for the whole planning attempt, not only the
accepted step list. The materialization boundary should report the exact
mirror/per-commit keys it actually created (distinguishing new entries from
pre-existing cache hits), and move judgment should add every successfully
materialized candidate, including candidates later ruled out. Root and fresh
previews must add their created keys to the same attempt-owned set. Construct
the candidate sweep before planning starts and invoke it from an outer
`finally` on success, refusal, and throw; the current locked live-state recheck
can then safely retain landed/shared keys. Add filesystem tests for both a
refused git preview and a backtracked move: each must remove its own newly
created keys, preserve a pre-existing warm key, and preserve a distinct mirror
created by a concurrent locked fetch.

## Prior Finding Disposition

- The prior concurrent-fetch CR-01 is closed for a distinct fetched mirror;
  this finding concerns clone ownership that the replacement protocol omits.
- Previously fixed classifier, lock, stamp, and comment findings remain fixed.
- Previously accepted or deferred Phase 7 dispositions remain unchanged and
  were not reopened.

## Review Evidence

- `collectPluginCloneCandidatesLocked` takes one fresh lock and rechecks the
  current state before deleting an exact candidate; no nested-lock path was
  found.
- Candidate deletion still passes through `locations.pluginCloneDir`, so the
  existing safe-name, containment, and symlink checks remain in force.
- The new concurrency test is a valid negative control for the old race: its
  fetched mirror is created under the real scope lock after sweep creation and
  remains after the owned replaced clone is removed.
- Focused owner tests: five modules passed (`clone-gc`,
  `dependency-bindings`, `dependency-move`, `dependency-plan`, and
  `dependency-settle`).
- `fallow review --base d4436bd3^ --brief` could not create its temporary
  comparison worktree in this isolated checkout; this orientation-only command
  is not a gate and does not supersede the supplied green Fallow/full-gate
  evidence.

---

_Reviewed: 2026-10-28T19:11:29Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

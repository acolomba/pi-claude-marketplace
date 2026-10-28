---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-28T18:33:55Z
reviewed_commit: e65cb5d705bc2019107ec31b6727d042d39dfdcb
depth: standard
scope_resolution: degraded-phase-range-reconstructed-from-phase-contract
files_reviewed: 32
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - test/orchestrators/plugin/clone-gc.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/fetch.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/shared/git-failure-classifiers.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-28T18:33:55Z
**Reviewed commit:** `e65cb5d705bc2019107ec31b6727d042d39dfdcb`
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

This is a fresh integrated review of all ten Phase 7 plans against the active
implementation after Phases 8-11. It covers GLK-01 through GLK-08, the four
ROADMAP success criteria, D-PL7-01 through D-PL7-18, and the current classifier,
lock, network, containment, cleanup, version-flow, and offline-tag call chains.

The evaluation-scope resolver returned a degraded phase-range spanning later
phases, so the review scope above was reconstructed from the Phase 7 plans,
summaries, prior verification scope, active imports/callers, and paired tests.
The classifier convergence, operation-specific 404/410 rules, cause framing and
credential-safe URL rendering, direct/cascade parity, all active clone-GC
callers, update tag-copy lock, fetch/info row locks, intent stamps, offline tag
resolution, and fetch/list/completion version flow were re-evaluated in current
code. One correctness defect remains in the dependency sweep's concurrency
protocol.

Fresh gate evidence remains usable because this review changed no build input:
`07-VALIDATION.md` is COMPLIANT (92 scenarios / 1086 steps and 15 direct
pairs), `07-SECURITY.md` is SECURED (31/31, `threats_open: 0`), and the combined
tree gate at build-input commit `c9dbf878` is green (1126 scenarios / 11509
steps, 309 direct LCOV records). A local focused-test attempt could not start
because this isolated worktree has no `tsx` package resolution; it does not
supersede the reusable full gate or the deterministic code-path evidence below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A dependency sweep can delete a clone that a concurrent fetch just completed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts:163-178`

**Issue:** `planCloneSweep` takes one fresh lock to snapshot the unreferenced
clone keys into `before`, releases it, runs an arbitrarily long dependency plan,
then takes a second fresh lock for `collectPluginClonesLocked(locations,
before)`. The second lock prevents deletion while another operation is actively
using the clone, but it does not make the two endpoints atomic.

A deterministic interleaving is:

1. `planCloneSweep` snapshots an empty `before` set and releases the lock.
2. A concurrent unpinned `fetch` takes the same lock, materializes
   `fetched-mirror`, reads its row, and successfully releases the lock.
3. The dependency operation finishes and invokes its sweep.
4. `garbageCollectPluginClones` sees `fetched-mirror` as unreferenced in state
   and absent from `before`, so `clone-gc.ts:123-145` deletes it.

The public fetch has therefore reported a refreshed cache that another
operation immediately removes. A subsequent warm/offline install or reinstall
can no longer use that fetched mirror. The current unit case at
`test/orchestrators/plugin/dependency-bindings.test.ts:323-340` only proves that
a mirror present *before* the snapshot is retained; it does not exercise a
mirror created between the snapshot and sweep. This is the exact interleaving
the D-PL7-13 comments at `clone-gc.ts:168-172` claim to prevent, but separately
locking the two endpoints does not prevent it.

**Fix:** Make the sweep ownership-based instead of treating every clone absent
from the initial snapshot as created by this operation. Track the clone keys
materialized/replaced by the dependency plan and pass only those exact keys to
a locked collector, deleting a key only if it is still unreferenced. Add a
test that pauses after `planCloneSweep`, creates a distinct fetched mirror under
`withExistingScopeLock`, then runs the sweep and asserts that the concurrent
mirror remains while the dependency plan's own abandoned clone is removed.

## Prior Finding Disposition

The earlier review disposition remains respected and was not automatically
reopened:

- Fixed findings remain fixed: the plugin-update refresh lock, maximum-Date
  stamp fallback, fetch lost-lock row, update compromised-lock reason, and stale
  comments.
- D-PL7-12 continues to govern the accepted/deferred raw-cause parity item.
- The accepted millisecond stale-record window, duplicated rule constants,
  other `updatedAt` writers, unreachable cascade catch, and simultaneous
  body-plus-release failure remain outside this finding.
- CR-01 is new. It concerns the interval between two individually locked
  dependency-sweep endpoints, not any prior disposition.

## Review Evidence

- All production GC references resolve to `collectPluginClonesLocked` or
  `listUnreferencedPluginClonesLocked`; no active caller invokes the private
  unlocked helpers.
- Cleanup callers do not nest the non-reentrant lock. Uninstall, marketplace
  remove, apply, update, reinstall, converge, and dependency cleanup invoke GC
  after their own guarded state mutation returns.
- Unpinned fetch and `info --fetch` keep refresh plus row read in one lock body;
  pinned immutable and bare-info arms intentionally remain unlocked under
  D-PL7-07.
- The shared classifier still supplies one ladder with operation-specific
  not-found policies, strips cleanup wrappers, and frames HTTP failures with the
  credential-safe wire URL. Direct and cascade update paths consume that ladder.
- `nextUpdateStamp` changes both the pre-commit mark and finalize stamp within
  one millisecond, while its invalid/maximum-date fallback still changes the
  compared value.
- Warm tag reinstall resolves the local tag first and fetch/list/completion
  continue to share the current candidate-version flow.

---

_Reviewed: 2026-10-28T18:33:55Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-28T20:35:13Z
reviewed_commit: c7e660ac
depth: standard
files_reviewed: 25
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/clone-gc.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-clone-probe.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-28T20:35:13Z
**Reviewed commit:** `c7e660ac`
**Depth:** standard
**Files Reviewed:** 25
**Status:** clean

## Summary

The iteration-5 repair closes the remaining same-key ownership defect. Move
judgment now contributes only the recorded old clone key as a possible
superseded entry. A prepared key enters the attempt set only when a cache
writer reports an atomic `renamed` promotion. Warm hits and exact-key
race-lost promotions therefore remain unowned and survive a refused move.

The complete clone-ownership protocol was rechecked together with the narrow
repair. Root previews, fresh-member previews, and every move candidate share
one attempt set; install and planned update flows sweep it from terminal
`finally` paths; the collector takes one fresh scope lock, re-reads live state,
routes every delete through `pluginCloneDir`, and cannot mask the primary
result or error. All reviewed files meet the required quality standard. No
issues found.

## Narrative Findings (AI reviewer)

No Critical, Warning, or Info findings.

## Ownership Finding Closure

- **Distinct concurrent cache deletion — closed.** Cleanup accepts an exact
  candidate set and never targets an unrelated key. The deterministic
  concurrent-mirror control leaves the unrelated entry on disk while removing
  the unreferenced owned key.
- **Refused and backtracked preview leaks — closed.** The pinned clone,
  per-commit copy, unpinned mirror, and marketplace-tag materializers report a
  key only after promotion returns `renamed`. Root, fresh-member, and move
  preflights forward the same callback. Refused plans sweep created preview
  keys, and resolver backtracking removes the rejected tag clone while keeping
  the landed clone.
- **Warm and exact-key race reclamation — closed.** `supersededCloneKeys`
  derives only the current record's old root. The two iteration-5 negatives
  run the production pinned materializer and production locked collector. The
  warm case pre-creates the exact key; the race case installs the exact winner
  between checkout and promotion. Both rule the candidate out and prove its
  manifest remains. Reinstating the previous prepared-root insertion would
  make both fail with `ENOENT` after the collector deleted that key.

## Protocol Evidence

- The recorded old key remains eligible by entering `cloneCandidates` during
  move judgment. On refusal, the collector's live-state recheck retains it;
  after a successful replacement, the state no longer references it and the
  same collector removes it.
- A genuinely created rejected key remains eligible through
  `onCloneCreated`. The refused-root and backtracking integration controls
  prove cleanup of the rejected keys, while landed, live, shared, warm, and
  distinct concurrent keys remain.
- Install creates the set before root preview and sweeps after `installAgain`.
  Planned update creates it before graph planning and sweeps on success,
  refusal, and thrown-plan paths. Step failure and invalid-base propagation
  tests also execute the final sweep.
- `collectPluginCloneCandidatesLocked` acquires one fresh non-nested scope
  lock. Its state reload happens under that lock, and every deletion target is
  resolved through the containment chokepoint before `rm`.
- `planCloneSweep` catches lock, read, and cleanup failures and records them
  through the debug path, so cleanup cannot replace a command's primary
  outcome.
- `DependencyMoveContext` types the injected clone-cache and constraint-gate
  seams from `PreparePluginUpdateOptions`; `moveArgs` forwards them together
  with the attempt set. The focused production-seam tests prove the callback
  reaches the real materializer, and the direct typecheck is green.

## Accepted and Deferred Scope

The recorded Phase 7 accepted and deferred items remain unchanged and were not
reclassified as findings. In particular, the broader cross-process candidate
window between preflight and finalize, the separately owned unlocked
`previewInstall` paths, unlocked marketplace-source deletes, mirror tag-fetch
behavior, apply's dropped cause, raw update-path causes, and the Phase 3
notification comment remain deferred by `07-CONTEXT.md`. The iteration-5
repair neither expands nor relies on those behaviors.

## Review Evidence

- Focused owner module:
  `node --test test/orchestrators/plugin/dependency-move.test.ts` passed.
- Focused ownership names for the old key, warm hit, and exact-key race passed.
- Direct typecheck: `npx tsc --noEmit --incremental false --pretty false`
  passed with no diagnostics.
- Owner full combined gate at the reviewed implementation: all static checks
  passed; 1126 Cucumber scenarios / 11509 steps passed; the merged direct run
  produced 309 LCOV records.
- The changed source/test pair has 100% direct line, function, and branch
  coverage. The complete owner module passed 29/29 during the repair.
- Validation is COMPLIANT. Security is SECURED with 31/31 rows and
  `threats_open: 0`.

---

_Reviewed: 2026-10-28T20:35:13Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

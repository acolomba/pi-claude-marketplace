---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-28T20:04:26Z
reviewed_commit: 967fdb8a
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-clone-probe.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-28T20:04:26Z
**Reviewed commit:** `967fdb8a`
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The iteration-4 repair closes the previously reported leak for cache entries
that the current attempt actually creates. The four materialization variants
report ownership only after an atomic promotion returns `renamed`; root,
fresh-member, and move previews thread the same attempt set; install and update
run the locked, live-rechecking sweep from `finally` on success, refusal, and
throw. The successful install sweep runs after `installAgain`, so landed keys
are live before collection. Cleanup still uses the location chokepoint, takes
one fresh non-nested scope lock, and cannot mask a primary result or error.

One ownership defect remains. After the materializer deliberately declines to
report a warm or race-lost key, move judgment derives that same key from the
prepared plugin root and adds it to the candidate set anyway. A refused or
backtracked plan can consequently delete a cache entry that this attempt did
not create. The supplied concurrency test uses a different mirror key and does
not exercise this same-key race.

The combined-tree gate is green at the reviewed implementation: all static
checks passed, 1126 Cucumber scenarios / 11509 steps passed, and the merged
direct run produced 309 LCOV records. The gate does not expose the ownership
error because the relevant same-key negative control is absent.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Move judgment reclaims warm and race-lost candidate clones

**Classification:** BLOCKER

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts:135-146,239-242`

**Issue:** The clone-cache writers correctly call `onCloneCreated` only when
their atomic promotion returns `renamed`. A warm hit returns before the
callback, and a promotion that returns `raced` also skips it. That distinction
is the ownership boundary: in either case the current attempt did not create
the final key.

`judgeDependencyMove` immediately defeats that boundary. Its
`cleanupCloneKeys` function derives both the old record key and the candidate
key from `prepared.installable.pluginRoot`, then unconditionally inserts both
into the attempt's `cloneCandidates` set before exclusions and name checks.
Therefore:

1. A pre-existing warm candidate is added even though no writer reported it.
2. If another process wins promotion of the exact same key, the losing process
   adds the winner's key even though the `raced` result deliberately did not
   report ownership.
3. If that candidate is later ruled out, the plan refuses, or a later step
   fails before the candidate lands, the final candidate-only sweep sees no
   live record for it and deletes it.

The fresh lock and live-state recheck do not repair this case: the key is an
explicit candidate, and a preview owned by another attempt need not yet have a
persisted record. This reintroduces the concurrent cache deletion class for an
exact-key race and violates the operation-owned candidate contract. The
high-level negative test at
`test/orchestrators/plugin/install-flow-planning.test.ts:263-313` preserves a
distinct concurrent mirror key, so it still passes when the exact raced or
warm candidate key is wrongly claimed.

**Fix:** Keep writer-reported creation separate from replacement cleanup. Add
only the current record's old clone key as a possible superseded key during
move judgment; rely exclusively on `onCloneCreated` to add the prepared
candidate key. The live-state recheck will retain the old key while the move is
refused and remove it only after a successful move makes it unreferenced. Add
negative tests that pass a callback through a warm hit and an exact-key
`raced` promotion, then refuse or backtrack the candidate and prove the key
survives. Keep the existing tests proving a genuinely `renamed` rejected key
is removed and a landed key remains live.

## Prior Finding Disposition

- The prior distinct concurrent-fetch deletion is closed: entries outside the
  candidate set cannot be deleted, and the sweep rechecks live state under a
  fresh scope lock.
- The prior refused/backtracked leak is closed for keys the attempt actually
  creates: all four promotion variants report `renamed` keys, and the outer
  finalizers sweep on every terminal path.
- This report's CR-01 is a separate over-claim in move judgment that bypasses
  the new atomic ownership signal for warm and same-key raced candidates.

## Review Evidence

- `materializePluginClone`, `materializePluginCommitCopy`,
  `materializeOrRefreshPluginMirror`, and `materializeMarketplaceTagClone`
  report only `renamed` promotions; warm and `raced` paths do not report.
- Pinned, unpinned mirror/per-commit, and marketplace-tag probes thread the
  callback through install and update preflights.
- Install planning creates its candidate set before root preview and sweeps
  after the second install attempt. Update planning creates it before graph
  planning and sweeps from `settlePlanned`'s `finally`.
- `collectPluginCloneCandidatesLocked` routes every target through
  `pluginCloneDir`, re-derives live and shared keys from state under one fresh
  lock, and receives cleanup failures through a swallowing wrapper.
- The full `npm run check` result at the reviewed inputs is green: static
  checks, 1126 scenarios / 11509 steps, and 309 merged LCOV records.
- `fallow review --base 967fdb8a^ --brief` could not create its temporary
  comparison worktree in this isolated checkout. It is orientation-only and
  does not supersede the green project Fallow/full-gate evidence.

---

_Reviewed: 2026-10-28T20:04:26Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

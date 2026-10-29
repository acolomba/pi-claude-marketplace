---
phase: 07-git-errors-and-lock-discipline
verified: 2026-10-29T13:32:14Z
status: passed
score: 4/4 roadmap success criteria verified (8/8 requirements satisfied)
covered_files:
  - ".planning/phases/07-git-errors-and-lock-discipline/07-01-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-01-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-02-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-02-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-03-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-03-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-04-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-04-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-05-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-05-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-06-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-06-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-07-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-07-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-08-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-08-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-09-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-09-SUMMARY.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-10-PLAN.md"
  - ".planning/phases/07-git-errors-and-lock-discipline/07-10-SUMMARY.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/orchestrators/edge-deps.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
  - "extensions/pi-claude-marketplace/transaction/with-state-guard.ts"
  - "features/lib/published-marketplace.ts"
  - "features/plugin/fetch.feature"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/git-source.feature"
  - "features/plugin/info.feature"
  - "features/plugin/update-rollback.feature"
  - "features/plugin/url-marketplace-update.feature"
  - "features/step_definitions/marketplace/update.steps.ts"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/orchestrators/edge-deps.test.ts"
  - "test/orchestrators/marketplace/remove.test.ts"
  - "test/orchestrators/marketplace/shared.test.ts"
  - "test/orchestrators/marketplace/update.test.ts"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/clone-gc.test.ts"
  - "test/orchestrators/plugin/dependency-bindings.test.ts"
  - "test/orchestrators/plugin/dependency-move.test.ts"
  - "test/orchestrators/plugin/dependency-plan.test.ts"
  - "test/orchestrators/plugin/dependency-settle.test.ts"
  - "test/orchestrators/plugin/dependency-tag-probe.test.ts"
  - "test/orchestrators/plugin/fetch.test.ts"
  - "test/orchestrators/plugin/info.test.ts"
  - "test/orchestrators/plugin/install-clone-probe.test.ts"
  - "test/orchestrators/plugin/install-flow-cascade-context.test.ts"
  - "test/orchestrators/plugin/install-flow-dependency-ledger.test.ts"
  - "test/orchestrators/plugin/install-flow-planning.test.ts"
  - "test/orchestrators/plugin/install-outcome.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
  - "test/orchestrators/plugin/update-swap.test.ts"
  - "test/shared/git-failure-classifiers.test.ts"
covered_digest: "v4:sha256:58099ae5bbf3e501a40eb886b8b18e9e3367376baf9062ef5f8a9e153a1387f9"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions: []
decision_coverage:
  honored: 18
  total: 18
  not_honored: []
---

# Phase 7: Git Errors and Lock Discipline Verification Report

**Phase Goal:** One classifier reports every git host failure, and no clone
read, copy, or cleanup runs outside the state lock.
**Verified:** 2026-10-29T13:32:14Z
**Status:** passed
**Re-verification:** Yes — final verification on the integrated Phase 1-10 tree.

## Goal Achievement

### Roadmap Success Criteria

| # | Success criterion | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | A host 404 and 5xx on plugin install, update, fetch, and info report as marketplace add and update report them, through one entry point (GLK-01, GLK-02). | VERIFIED | `classifyGitFailure` is the one policy entry point. Current callers cover marketplace update/shared, direct and cascade plugin update, preflight, fetch, info, and dependency tag listing; compatibility wrappers are thin fixed-rule calls. Independent classifier, info-503, and cascade-parity named tests passed. |
| 2 | A second operation holding the lock makes clone cleanup, tag copy, and fetch/info row reads wait or refuse safely (GLK-03, GLK-04, GLK-05). | VERIFIED | Broad lifecycle GC uses `collectPluginClonesLocked`. Dependency planning uses `collectPluginCloneCandidatesLocked`, which takes a fresh lock, reloads live state, and targets only operation-owned keys. Tag copy and unpinned fetch/info materialize-plus-row-read use `withExistingScopeLock`. Independent candidate-only, race-winner, tag-lock, fetch-lock, and info-lock tests passed. |
| 3 | Two intent marks in one millisecond are distinguished (GLK-06). | VERIFIED | Both mark and finalize call module-private `nextUpdateStamp`, which chooses a valid stamp strictly later than the replaced value. The independent controlled-clock same-millisecond concurrency test passed. |
| 4 | Fetch shows list's version rule and a warm tag reinstall makes no network call (GLK-07, GLK-08). | VERIFIED | Fetch and completion call the shared list candidate/upgrade rules. `resolveFetchedRefOffline` tries the tracking ref, then peels the local `refs/tags/<ref>`. Independent named owner tests and the two real command-surface scenarios passed: 1 scenario/10 steps and 1 scenario/14 steps. |

**Score:** 4/4 roadmap success criteria verified (0 behavior-unverified).

### Exact-Candidate Ownership Supersession

The current exact-candidate protocol formally supersedes Plan 07-02's older
`listUnreferencedPluginClonesLocked` broad-listing literal. The old protocol
could list a clone before another operation began using it and later delete
that unrelated warmed clone. Current planning records only keys the operation
created after an atomic `renamed` promotion. Its terminal sweep then takes a
fresh scope lock, reloads state, and deletes only those still-unreferenced
candidates. Warm hits and exact-key race losers are not owned.

The plan-artifact probe therefore reports the historical export missing, but
that is not a missing behavior or override: `collectPluginCloneCandidatesLocked`
is the reviewed stronger implementation of GLK-03. The independent
candidate-only and exact-key race tests passed; restoring broad listing would
reintroduce the verified concurrent-cache deletion defect.

### Advisory (New Scope, Unevidenced)

None. No new-scope blocker or advisory was identified.

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/git-failure-classifiers.ts` | One classifier entry point and fixed-rule wrappers | VERIFIED | Exists, substantive, and wired to every owned git-host failure surface; no competing exported status/transport policy remains. |
| `plugin/clone-gc.ts` | Locked cleanup | VERIFIED | General GC and exact-candidate GC both wrap the private filesystem body in `withExistingScopeLock`; the body reloads live state before deletion. |
| Planning/move/cache modules | Attempt ownership and terminal cleanup | VERIFIED | `onCloneCreated` fires only after `promotion === "renamed"`; planning shares one candidate set and sweeps it after lock release. |
| `plugin/update-swap.ts` | Monotonic intent/finalize stamps | VERIFIED | `nextUpdateStamp` is substantive and called at both guarded writes. |
| `plugin/clone-cache.ts` | Offline tag fallback | VERIFIED | Tracking-ref lookup falls back to local tag peeling and refreshes only on a real cache miss. |
| `fetch.ts`, `info.ts`, `update-preflight.ts` | Locked read/copy and shared classification | VERIFIED | Unpinned materialize/copy and dependent row reads share the lock; host failures use the shared classifier. |
| `edge-deps.ts` | Completion uses list's upgrade rule | VERIFIED | Imports and calls `upgradeCandidate`; browse consumes list payloads. |
| Phase 7 unit/Cucumber evidence | Behavioral enforcement | VERIFIED | Named independent tests passed; the unchanged implementation tree also retains the exact full gate at 1,145 scenarios, 11,777 steps, and 309 LCOV records. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Marketplace/plugin git catches | `classifyGitFailure` | Explicit per-operation rule and optional wire URL | WIRED | Production search found all current classifier call sites and no alternate policy entry point. |
| Lifecycle cleanup callers | locked collectors | Fresh scope lock around state reload and deletion | WIRED | General callers bind the broad locked GC; dependency planning binds the narrower candidate collector. |
| Cache promotion | planning ownership set | `onCloneCreated` after atomic `renamed` only | WIRED | Warm and raced outcomes cannot become cleanup candidates. |
| Fetch/info materialization | row builders | One `withExistingScopeLock` body for unpinned sources | WIRED | The row cannot read a mirror while cleanup or refresh mutates it. |
| Intent and finalize writes | `nextUpdateStamp` | Two direct calls inside state guards | WIRED | Current source contains exactly the intended two guarded assignments. |
| Warm mirror resolution | local tag peel | tracking ref, then `resolveTagOid` | WIRED | Missing local refs fall through to refresh; valid tags remain offline. |
| Completion | list upgrade logic | `edge-deps.ts` calls `upgradeCandidate` | WIRED | Completion and list share the version rule. |

The generic plan key-link probe returned false for several symbol-name
`from:` entries that are not relative file paths. Direct source and
CodeGraph tracing verified those links above; these are plan-metadata probe
limitations, not unwired code.

## Data-Flow Trace (Level 4)

These are orchestration utilities rather than rendered UI components. Real
data nevertheless flows end to end: thrown git errors enter
`classifyGitFailure` and its reason/frame reach notification rows; live scope
state plus on-disk clone keys enter the locked collectors; manifest and plugin
metadata enter shared list-candidate resolution; and those values reach
command rows exercised through the real Cucumber command surface.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| One classifier policy | Named `classifyGitFailure` test | 1 passed | PASS |
| Direct/cascade parity | Named GLK-02 converge test | 1 passed | PASS |
| Candidate-only cleanup | Named clone-GC candidate test | 1 passed | PASS |
| Exact-key race ownership | Named dependency-move race test | 1 passed | PASS |
| Tag copy under lock | Named GLK-04 preflight test | 1 passed | PASS |
| Fetch/info row reads under lock | Two named GLK-05 tests | 2 passed | PASS |
| Same-millisecond conflict | Named GLK-06 update-swap test | 1 passed | PASS |
| Fetch version rule | Named GLK-07 fetch test | 1 passed | PASS |
| Offline local tag | Named GLK-08 clone-cache test | 1 passed | PASS |
| User-visible fetch version | Focused Cucumber scenario | 1 scenario, 10 steps passed | PASS |
| User-visible offline reinstall | Focused Cucumber scenario | 1 scenario, 14 steps passed | PASS |

The exact full `npm run check` result is reusable because
`git diff be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` is empty:
static checks passed, 1,145 Cucumber scenarios / 11,777 steps passed, and
direct coverage merged 309 LCOV records under Node v26.12.1.

## Probe Execution

No Phase 7 plan declares a standalone probe script. The executable evidence is
the owner-test, command-surface Cucumber, direct-coverage, and combined-gate
suite.

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
| --- | --- | --- | --- |
| GLK-01 | 07-01, 07-06..10 | SATISFIED | One classifier and operation rules are wired across all owned host paths; named classifier/info tests passed. |
| GLK-02 | 07-06 | SATISFIED | Direct and cascade update failures share the same ladder; the named parity test passed. |
| GLK-03 | 07-02 plus superseding review fix | SATISFIED | Every cleanup boundary is locked; dependency cleanup is exact-candidate scoped; ownership/race tests passed. |
| GLK-04 | 07-07 | SATISFIED | Marketplace-tag copy executes inside the scope lock; the named held-lock test passed. |
| GLK-05 | 07-08, 07-09 | SATISFIED | Fetch and info build unpinned rows inside their materialization lock; named tests passed. |
| GLK-06 | 07-03 | SATISFIED | Mark and finalize use strictly increasing stamps; the controlled-clock test passed. |
| GLK-07 | 07-05, 07-08 | SATISFIED | Fetch/completion share list's version rule; owner and command-surface tests passed. |
| GLK-08 | 07-04 | SATISFIED | Warm local tag peeling avoids the network; owner and command-surface tests passed. |

No Phase 7 requirement is orphaned. GLK-01 through GLK-08 occur in plan
frontmatter and map to Phase 7 in `REQUIREMENTS.md`.

### Decision Coverage

All 18 trackable `07-CONTEXT.md` decisions are honored by shipped artifacts
(`check.decision-coverage-verify`: 18/18). The exact-candidate repair
supersedes only the unsafe broad-listing mechanism; it preserves and
strengthens the locked-cleanup result.

## Test Quality Audit

| Test evidence | Linked requirements | Active | Skipped | Circular | Strongest assertion | Verdict |
| --- | --- | ---: | ---: | --- | --- | --- |
| Classifier/update/fetch/info owners | GLK-01, GLK-02 | yes | 0 | no | exact value and behavioral | PASS |
| Clone GC/planning/move/preflight owners | GLK-03..05 | yes | 0 | no | filesystem state and multi-step behavioral | PASS |
| Update-swap owners | GLK-06 | yes | 0 | no | state-transition behavioral | PASS |
| Fetch/completion owners and Cucumber | GLK-07 | yes | 0 | no | exact row/value behavioral | PASS |
| Clone-cache owner and Cucumber | GLK-08 | yes | 0 | no | network-call absence and exact state | PASS |

Disabled requirement tests: 0. Circular expected-value patterns: 0.
Insufficient assertions: 0. The ownership controls would fail if broad
enumeration or an unowned prepared key again entered the cleanup set.

## Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` marker, disabled requirement
test, placeholder implementation, or hardcoded-empty command row was found.
`SYNTHETIC_UPDATE_PLACEHOLDER_NAME` is a deliberate internal subject for
update failure composition, not an implementation stub. Final complete review
is CLEAN: 0 Critical, 0 Warning, 0 Info. Final security audit is SECURED:
31/31 threat rows closed and `threats_open: 0`.

## Human Verification Required

None. Each classification, lock, cleanup, ordering, version, and offline
network invariant has executable behavioral evidence. No visual or
external-service-only truth remains.

## Gaps Summary

No gaps. All four roadmap success criteria, GLK-01 through GLK-08, and all
18 trackable decisions are verified on the integrated tree. The
exact-candidate supersession closes the historical concurrent-cache deletion
defect without weakening Phase 7's lock discipline.

---

_Verified: 2026-10-29T13:32:14Z_
_Verifier: the agent (gsd-verifier)_

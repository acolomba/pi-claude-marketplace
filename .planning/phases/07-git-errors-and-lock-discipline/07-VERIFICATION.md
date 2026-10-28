---
phase: 07-git-errors-and-lock-discipline
verified: 2026-10-28T21:21:00Z
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
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
covered_digest: "v4:sha256:114b73a2888c7d135a2cf4ac9cf05fce6d6fb7b6cdcf3b143bedf2e1f4280922"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 7: Git Errors and Lock Discipline Verification Report

**Phase Goal:** One classifier reports every git host failure, and no clone read, copy, or cleanup runs outside the state lock.
**Verified:** 2026-10-28
**Status:** passed
**Re-verification:** Yes -- after later lifecycle work and the Phase 7 review-fix convergence loop

## Goal Achievement

### Roadmap Success Criteria

| # | Success criterion | Status | Current evidence |
|---|---|---|---|
| 1 | A host 404 and 5xx on plugin install, update, fetch, and info report as marketplace add and update report them, through one entry point (GLK-01, GLK-02) | VERIFIED | `classifyGitFailure` remains the single policy entry point in `shared/git-failure-classifiers.ts`; transport/status helpers are private and the three compatibility wrappers are thin calls. Current production callers cover marketplace update/shared, plugin fetch/info/update/preflight, and dependency tag probing. The focused `classifyGitFailure` test passed. |
| 2 | A unit test holds the lock in a second operation and shows each clone cleanup, the tag copy, and the fetch row read wait for it (GLK-03, GLK-04, GLK-05) | VERIFIED | Broad lifecycle GC still enters through `collectPluginClonesLocked`; dependency-plan cleanup now enters through `collectPluginCloneCandidatesLocked`, which acquires a fresh scope lock, reloads live state, and limits deletes to the operation-owned set. Fetch and info keep materialize-plus-row-read inside `withExistingScopeLock`; preflight tag copy is also locked. Existing held-lock tests remain active. Fresh spot checks proved candidate-only collection, refused-plan cleanup, and exact-key race preservation. |
| 3 | Two intent marks in one millisecond are distinguished (GLK-06) | VERIFIED | `nextUpdateStamp` is used by both the intent mark and finalize, chooses a strictly later valid ISO stamp, and falls back to current time for unparseable/maximum dates. The focused same-millisecond concurrency test passed. |
| 4 | A `fetch` scenario for a plugin whose `plugin.json` and entry disagree shows the `list` version; a warm tag reinstall makes no network call (GLK-07, GLK-08) | VERIFIED | Fetch and completion still call the shared list candidate/upgrade rules. `resolveFetchedRefOffline` tries the tracking ref first, then peels `refs/tags/<ref>` locally. Both named Cucumber scenarios passed: 1 scenario/10 steps for list-version parity and 1 scenario/14 steps for offline tag reinstall. |

**Score:** 4/4 success criteria verified (0 behavior-unverified).

### Review-Fix Supersession

The current implementation formally supersedes Plan 07-02's literal broad-listing export `listUnreferencedPluginClonesLocked`. Review found that listing every unreferenced entry and later collecting it could delete a distinct cache entry warmed by a concurrent operation. The converged design passes one operation-owned key set to `collectPluginCloneCandidatesLocked`; the collector takes the same fresh scope lock and rechecks live state before deleting only keys in that set. Restoring the old export or broad sweep would reintroduce the verified defect. This supersession preserves GLK-03 and strengthens the phase goal.

The three ownership corrections are all present:

- exact candidate-only GC (`d4436bd3`) leaves unrelated concurrent cache entries untouched;
- root, fresh-member, move, backtracked, and refused preflights share callback-based attempt ownership, with terminal cleanup (`967fdb8a`);
- warm hits and exact-key race winners remain unowned because materializers call `onCloneCreated` only after an atomic `renamed` promotion, while move judgment adds only the superseded recorded key (`64fb10b1`).

Final review `4965f333` reports 0 Critical, 0 Warning, and 0 Info findings over this protocol.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `shared/git-failure-classifiers.ts` | One classifier entry point and thin compatibility wrappers | VERIFIED | Exists, substantive, wired to all owned host-failure paths; old transport/status layers are private. |
| `plugin/clone-gc.ts` | Locked clone cleanup | VERIFIED | `collectPluginClonesLocked` handles general lifecycle GC; `collectPluginCloneCandidatesLocked` is the reviewed exact-ownership replacement for the old broad listing. Both wrap the filesystem body in `withExistingScopeLock`. |
| `plugin/dependency-bindings.ts` and planning/move modules | Attempt ownership and terminal sweep | VERIFIED | `planCloneSweep` calls the exact-candidate collector and swallows cleanup failure; the operation creates one set before planning and sweeps from terminal paths. |
| `plugin/update-swap.ts` | Strictly increasing update stamps | VERIFIED | `nextUpdateStamp` is module-private and wired to intent plus finalize. |
| `plugin/clone-cache.ts` | Offline tag fallback and exact creation callback | VERIFIED | Local tag peeling is wired; `onCloneCreated` fires only after a successful `renamed` promotion, never on warm/raced outcomes. |
| `plugin/fetch.ts`, `plugin/info.ts`, `plugin/update-preflight.ts` | Locked reads/copy and shared classification | VERIFIED | Current code keeps the materialize/copy and protected read in the lock body and classifies host failures through the shared entry point. |
| `edge-deps.ts` | Completion uses list's upgrade rule | VERIFIED | Imports and calls `upgradeCandidate`; browse continues to consume list payloads. |
| Phase 7 feature files | User-visible classifier/version/offline behavior | VERIFIED | Active scenarios are wired to the real command surface; the full combined gate passed 1126 scenarios/11509 steps and the two named spot checks passed independently. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Marketplace/plugin host catches | `classifyGitFailure` | Explicit per-operation rule and optional wire URL | WIRED | Current production grep finds no alternate exported transport/status classifier. |
| Lifecycle cleanup callers | locked collectors | Fresh scope lock around state reload plus deletion | WIRED | General callers use `collectPluginClonesLocked`; dependency planning uses the narrower candidate collector. |
| Cache materializers | planning attempt set | `onCloneCreated` after `promotion === "renamed"` | WIRED | Warm and exact-key race-lost paths do not claim ownership. |
| `fetchOne` / `runFetchLocked` | protected row builders | One `withExistingScopeLock` body for unpinned sources | WIRED | Materialization and list/info row reads share the lock. |
| update intent and finalize | `nextUpdateStamp` | Both `updatedAt` assignments call the helper | WIRED | Two current call sites. |
| mirror offline resolver | local tag peel | tracking ref, then `refs/tags/<ref>` through injected `resolveTagOid` | WIRED | Missing/invalid local tags retain the network cache-miss path. |
| completion | list upgrade logic | `edge-deps.ts` calls `upgradeCandidate` | WIRED | Completion and list use one rule. |

### Data-Flow Trace (Level 4)

Not applicable as a UI-data-flow check. These artifacts are orchestration utilities. Their real data flows are nevertheless traced end-to-end: thrown git errors enter the shared classifier; scope state and on-disk cache keys enter locked collectors; manifest/plugin metadata enters shared list candidate resolution; and resulting rows reach the command notification types exercised by Cucumber.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| One git classifier policy | `node --test --test-name-pattern='classifyGitFailure' test/shared/git-failure-classifiers.test.ts` | 1 passed, 0 failed | PASS |
| Exact-key race winner is not reclaimed | `node --test --test-name-pattern='keeps an exact-key race winner that a ruled-out move did not create' test/orchestrators/plugin/dependency-move.test.ts` | 1 passed, 0 failed | PASS |
| Candidate collector removes only owned unreferenced keys | `node --test --test-name-pattern='collects only unreferenced candidates' test/orchestrators/plugin/clone-gc.test.ts` | 1 passed, 0 failed | PASS |
| Refused preview cleans owned keys but keeps unrelated entries | `node --test --test-name-pattern='removes clones from a refused git preview without touching other cache entries' test/orchestrators/plugin/install-flow-planning.test.ts` | 1 passed, 0 failed | PASS |
| Same-millisecond update marks conflict | `node --test --test-name-pattern='GLK-06: a swap prepared in the millisecond' test/orchestrators/plugin/update-swap.test.ts` | 1 passed, 0 failed | PASS |
| Fetch shows plugin manifest/list version | Focused `cucumber-js --name` scenario | 1 scenario, 10 steps passed | PASS |
| Warm tag reinstall stays offline | Focused `cucumber-js --name` scenario | 1 scenario, 14 steps passed | PASS |

The full combined `npm run check` result supplied by the unchanged-input gate remains green after source commit `64fb10b1`: static checks passed, 1126 Cucumber scenarios / 11509 steps passed, and direct coverage merged 309 LCOV records.

### Probe Execution

No Phase 7 plan declares a standalone probe script. Behavioral verification is through focused owner tests, real command-surface Cucumber scenarios, and the combined repository gate.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| GLK-01 | 07-01, 07-06, 07-07, 07-08, 07-09, 07-10 | SATISFIED | Shared classifier entry point, per-operation rules, frames, and active unit/Cucumber coverage. |
| GLK-02 | 07-06 | SATISFIED | Direct and cascade updates use the shared failure ladder; cascade no longer mislabels an unclassified failure as not in manifest. |
| GLK-03 | 07-02 | SATISFIED | Every broad lifecycle cleanup is locked; dependency-plan cleanup is now locked and exact-candidate scoped. Held-lock and ownership/race tests are active. |
| GLK-04 | 07-07 plus review fix | SATISFIED | Tag copy and plugin-update marketplace refresh execute inside the appropriate scope lock. |
| GLK-05 | 07-08, 07-09 | SATISFIED | Unpinned fetch and info-fetch build their row inside the materialization lock; pinned/bare paths remain intentionally lock-free. |
| GLK-06 | 07-03 | SATISFIED | Strictly increasing mark/finalize stamps with passing focused concurrency test. |
| GLK-07 | 07-05, 07-08 | SATISFIED | Fetch and completion use list's version/upgrade rule; focused user-visible scenario passes. |
| GLK-08 | 07-04 | SATISFIED | Local tag fallback peels the warm mirror's tag; focused no-request scenario passes. |

No Phase 7 requirement is orphaned: GLK-01 through GLK-08 all occur in plan frontmatter and map to Phase 7 in `REQUIREMENTS.md`.

### Decision Coverage

All 18 trackable `07-CONTEXT.md` decisions are honored by shipped artifacts (`check.decision-coverage-verify`: 18/18). The reviewed exact-candidate ownership repair supersedes only the unsafe broad-listing mechanism; it does not change the intended locked-cleanup result of D-PL7-05/D-PL7-13.

### Test Quality Audit

| Test evidence | Linked requirement(s) | Active | Skipped | Circular | Strongest assertion | Verdict |
|---|---|---:|---:|---|---|---|
| classifier and update/fetch/info owner tests | GLK-01, GLK-02 | yes | 0 | no | value/behavioral | PASS |
| clone GC, dependency planning/move, preflight owner tests | GLK-03, GLK-04, GLK-05 | yes | 0 | no | filesystem state plus multi-step behavioral | PASS |
| update-swap owner tests | GLK-06 | yes | 0 | no | state-transition behavioral | PASS |
| fetch and completion owner tests plus Cucumber | GLK-07 | yes | 0 | no | exact row/value behavioral | PASS |
| clone-cache owner tests plus Cucumber | GLK-08 | yes | 0 | no | network-call absence and exact state | PASS |

Disabled tests on requirements: 0. Circular expected-value patterns: 0. Insufficient assertions: 0. The ownership negatives would fail if warm/raced candidates were again inserted into the cleanup set; the refused-preview control also proves the collector still removes genuinely owned keys.

### Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` marker, disabled requirement test, placeholder implementation, or hardcoded-empty command row was found in the current Phase 7 implementation/evidence set. The final clean review found no Critical, Warning, or Info issue. Re-verification advisory: none.

### Human Verification Required

None. This is an infrastructure/orchestration phase, and each cleanup, ordering, classification, version, and offline-network invariant has a passing behavioral test. No visual or external-service-only truth remains.

### Gaps Summary

No gaps. All four roadmap success criteria, all eight GLK requirements, and all 18 trackable decisions are verified against the current code. The exact-candidate cleanup supersession closes the later-discovered ownership race without weakening lock discipline.

---

_Verified: 2026-10-28_
_Verifier: the agent (gsd-verifier)_

---
phase: 26-git-mirror-access
verified: 2026-10-24T00:26:02Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/26-git-mirror-access/26-01-PLAN.md"
  - ".planning/phases/26-git-mirror-access/26-01-SUMMARY.md"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "extensions/pi-claude-marketplace/shared/fs-utils.ts"
  - "features/plugin/fetch.feature"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/info.feature"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/fetch.test.ts"
  - "test/orchestrators/plugin/info.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
  - "test/platform/removal-ops-contract.ts"
  - "test/platform/removal-ops-fake.test.ts"
  - "test/platform/removal-ops-fake.ts"
  - "test/shared/fs-utils.test.ts"
covered_digest: "v3:sha256:c411104442f8375af3d7e2f367941a0320c9b7ae4b21df36efdf9658ceaea370"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 26: Git Mirror Access Verification Report

**Phase Goal:** The git download cache is refreshed safely and fetched once.
**Verified:** 2026-10-24T00:26:02Z
**Status:** passed
**Re-verification:** No (initial verification)
**Commits:** `4d0dd858` (feature), `91472ba1` (review fix CR-01), range `54302d99..HEAD`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC-1 / GIT-03: `fetch` and `info --fetch` refresh the mirror under the state lock; with the lock held they fail with `lock held` | VERIFIED | `fetch.ts::fetchOne` wraps the unpinned `materializeThroughSeam` in `withExistingScopeLock` (line 380-382); `narrowFetchFailure` maps `StateLockHeldError` to `lock held`; `failedRow` keeps the cause chain at `error`. `info.ts::makeFetchProbe` wraps the unpinned probe in the lock (2119-2122); `buildInstalledGitRow` and `buildGitNotInstalledRow` return `lockHeldRow` (failed, `lock held`, `componentsResolved: true, components: {}`). Update and reinstall: `update-preflight.ts::probeUnpinned` takes the lock (267), and `resolveUpdateCandidate` rethrows `StateLockHeldError` (471-473), so the flow reports `failed {lock held}`. Install already runs `probeInstallClone` inside `runInstallLedgerBody` under the install transaction's lock. Behavior proven by passing tests: fetch.feature and info.feature lock-held scenarios (no host request, no clones, `failed {lock held}`, severity error); the git-source-update.feature Outline for `update` and `reinstall`; unit tests `GIT-03:` in fetch, info (installed and not-installed arms), and update-preflight. Pinned sources take no lock, by design (WR-01): a pinned clone never reads or writes the mirror (`materializePluginClone` clones from the network and promotes atomically). |
| 2 | SC-2 / GIT-04: per-commit copies and tag clones use one copy-and-checkout helper that handles a symlink-only directory | VERIFIED | `clone-cache.ts::checkoutGitDirCopy` (271-280) copies `.git` with `verbatimSymlinks`, drops the index, and checks out without `force`. Its callers: `copyMirrorAtCommit` (per-commit copy), `materializeMarketplaceTagClone` (tag clone, `force: true` removed), and the pinned arm of `seedOnePluginMirror` (WR-04). No production `checkout({... force` remains. Test `GIT-04: a tag clone checks out a directory that holds only a symlink` (real isomorphic-git) passes. A scratch experiment against the repo's isomorphic-git confirmed the test is a real regression check: a forced checkout of the same layout throws `MultipleGitError` (ENOENT on the symlink), and the drop-index checkout writes the link. |
| 3 | SC-3 / GIT-05: a cold `info --fetch` of an unpinned source makes one request round to the host | VERIFIED | info.feature scenario "Info with --fetch on a plugin never fetched clones its repository with one request round" asserts the exact request list (`assert.deepStrictEqual` in `git-host.steps.ts:126-133`): one GET `info/refs` and one POST `git-upload-pack`. Passes. No product change was needed (D-05: fixed in phase 10). |
| 4 | SC-4: `npm run check` stays green | VERIFIED | Per the orchestrator: `npm run check` ran green on `91472ba1`'s exact tree (749/749 scenarios, exit 0). Not re-run here, as instructed. Consistent with SUMMARY's 747/747 before the two CR-01 Outline scenarios were added. Targeted re-runs here: 6 unit files, 429/429 pass; 3 feature files, 29/29 scenarios pass. |
| 5 | IN-06: `RemovalOps.rename` removed | VERIFIED | `shared/fs-utils.ts`: the interface has only `rm`, `createRemovalOps` binds only `fs.rm`. `rename` is gone from `test/platform/removal-ops-fake.ts`, the contract, and their tests (only a doc mention of the removal remains at fs-utils.ts:47). TESTING.md updated. |
| 6 | Orchestrator scope: unify `probeUnpinned` (update-preflight.ts) and `probeInstallClone` (install-clone-probe.ts) on the helper where it fits | VERIFIED | `clone-cache.ts::materializeUnpinnedSource` (367-395) is the single mirror-then-copy-then-subdir path. `probeInstallClone` (install-clone-probe.ts:67) and `probeUnpinned` (update-preflight.ts:267-273) both call it with their existing seams. Composition test `GIT-04: an unpinned source copies the mirror's commit and anchors its subdir` passes. `info`'s and `fetch`'s unpinned probes stay separate on purpose: they read or refresh the mirror itself and make no per-commit copy. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `orchestrators/plugin/clone-cache.ts` | `checkoutGitDirCopy`, `materializeUnpinnedSource` | VERIFIED | Substantive; 3 internal callers of the helper; the unpinned path is exported and imported by install and update |
| `orchestrators/plugin/fetch.ts` | lock around unpinned refresh, `lock held` mapping | VERIFIED | Wired in `fetchOne` and `narrowFetchFailure` |
| `orchestrators/plugin/info.ts` | lock in `makeFetchProbe`, `lockHeldRow` | VERIFIED | Wired in both git row builders |
| `orchestrators/plugin/update-preflight.ts` | lock in `probeUnpinned`, rethrow in `resolveUpdateCandidate` | VERIFIED | Both present |
| `orchestrators/plugin/install-clone-probe.ts` | uses `materializeUnpinnedSource` | VERIFIED | Unpinned arm delegates |
| `shared/fs-utils.ts` | `RemovalOps` with `rm` only | VERIFIED | |
| features: fetch, info, git-source-update | lock-held and one-round scenarios | VERIFIED | 5 new scenarios, all pass |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `fetchOne` | `withExistingScopeLock` | unpinned arm only | WIRED |
| `makeFetchProbe` | `withExistingScopeLock` | unpinned arm only | WIRED |
| `probeUnpinned` (update) | `withExistingScopeLock` -> `materializeUnpinnedSource` | preflight, before the swap's lock, no nesting | WIRED |
| `resolveUpdateCandidate` catch | update-flow / reinstall-record `lock held` mapping | `StateLockHeldError` rethrow | WIRED (scenario proves `failed {lock held}`) |
| `probeInstallClone` | `materializeUnpinnedSource` | under the install transaction lock | WIRED |
| `copyMirrorAtCommit`, `materializeMarketplaceTagClone`, `seedOnePluginMirror` | `checkoutGitDirCopy` | direct call | WIRED |

Nesting check: `preparePluginUpdate` runs before the swap's guard and before `refreshDisabledRecord`'s own transaction, so the preflight lock never nests. `stateTransaction` on the update operations is a state-I/O seam, not a held lock. The reconcile backfill calls reinstall with no outer lock (`reconcile/backfill.ts`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unit suites for the phase | `node --test test/orchestrators/plugin/{clone-cache,fetch,info,update-preflight}.test.ts test/shared/fs-utils.test.ts test/platform/removal-ops-fake.test.ts` (hermetic HOME and PI_CODING_AGENT_DIR in the scratchpad) | 429 pass, 0 fail | PASS |
| Scenarios | `npx cucumber-js features/plugin/fetch.feature features/plugin/info.feature features/plugin/git-source-update.feature` (hermetic) | 29/29 scenarios, 328/328 steps | PASS |
| Forced checkout refuses a symlink-only dir | scratch script on the repo's isomorphic-git | force: `MultipleGitError`; drop index: link written | PASS (confirms the GIT-04 test is meaningful) |

### Probe Execution

None. No `scripts/*/tests/probe-*.sh` exists, and the plan declares no probe.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| GIT-03 | 26-01 | SATISFIED | Truth 1 |
| GIT-04 | 26-01 | SATISFIED | Truth 2 |
| GIT-05 | 26-01 | SATISFIED | Truth 3 |

No orphaned requirements. REQUIREMENTS.md still lists all three as `[ ]` and `Pending` (lines 163-165, 276-278); the bookkeeping update was not part of this verification.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or placeholder markers in any file the phase changed.

### Human Verification Required

None.

## For the user

- **WR-03 (deferred):** clone GC runs after the guard is released (uninstall, update swap, `marketplace remove`, disabled-pin refresh), so it can delete a mirror a locked fetch, info, or install is using, or the fresh copy between update's preflight and swap. It is older than this phase; the fix is to run `garbageCollectPluginClones` under `withExistingScopeLock` at each call site.
- **WR-05 (deferred):** the update preflight's path-pin tag clone (`resolvePathPluginRoot` -> `materializeMarketplaceTagClone`) copies the marketplace `.git` with no lock, while `marketplace update` refreshes that `.git` under the lock; lock it the way `probeUnpinned` is locked, with the same rethrow.
- **WR-06 (deferred):** `fetch` (`freshRow`) and `info --fetch` (resolver and component reads) read the mirror tree after the lock is released; display only, but holding the lock across the row derivation would close it.
- **IN-03 (deferred):** more commands now hold the `retries: 0` lock across a network refresh and the Device Flow, and `proper-lockfile`'s default `onCompromised` throws from a timer (an uncaught exception in the host after a stall longer than `stale`); pass an `onCompromised` handler and record the trade-off in D-01.
- **D-02 (decide or accept):** `info --fetch` fails a plugin `failed {lock held}` at error severity when the lock is held, while transport failures degrade to `components: not resolved` per D-81-04; Claude Code has no state lock, so this rests on the project lock rule, not upstream parity.
- **Merge risk with Phase 25:** besides `probeUnpinned`, `update-preflight.ts` changed the `resolveUpdateCandidate` catch (the `StateLockHeldError` rethrow) and its imports (`StateLockHeldError`, `withExistingScopeLock`, `materializeUnpinnedSource`), which 26-CONTEXT said would stay untouched; expect a conflict there when Phase 25's preflight work merges.
- **GIT-05:** no product change was needed (fixed in phase 10); the phase only adds a scenario that pins one GET and one POST.
- **Orphan test helper:** `createDelegatingRemovalOps` in `test/platform/removal-ops-fake.ts` has no consumers, and had none before this phase either; delete it or give it a case.
- **Bookkeeping:** REQUIREMENTS.md still shows GIT-03, GIT-04, and GIT-05 as Pending; flip them when the phase is marked complete.
- **Behavior change to know about:** an `update` of an up-to-date unpinned git plugin used to report `unchanged` without the lock; while another process holds the lock it now reports `failed {lock held}` (the preflight needs the lock to read the mirror). That follows D-01, but it is a user-visible change.
- **Doc nit:** `CheckoutOptions.force` in `platform/git.ts` now has no production caller (IN-01 only fixed its doc); remove it if no test needs it.

## Gaps Summary

None. All four roadmap criteria and both orchestrator-scope items hold in the code, and each behavior claim is backed by a passing test. The deferred review findings (WR-03, WR-05, WR-06, IN-03) are hazards next to GIT-03, not part of its stated contract: they concern clone GC, the marketplace clone, and display reads, not a mirror refresh an install copies from.

---

_Verified: 2026-10-24T00:26:02Z_
_Verifier: Claude (gsd-verifier)_

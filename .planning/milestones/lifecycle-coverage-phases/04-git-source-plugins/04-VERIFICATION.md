---
phase: 04-git-source-plugins
verified: 2026-10-23T14:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/04-git-source-plugins/04-01-PLAN.md"
  - ".planning/phases/04-git-source-plugins/04-01-SUMMARY.md"
  - ".planning/phases/04-git-source-plugins/04-02-PLAN.md"
  - ".planning/phases/04-git-source-plugins/04-02-SUMMARY.md"
  - "CHANGELOG.md"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
  - "features/plugin/fetch.feature"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/git-source.feature"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/fetch.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/install.messaging.test.ts"
  - "test/shared/git-failure-classifiers.test.ts"
covered_digest: "v3:sha256:d1dec5c9d25f77923e60f5104371d835fda4e61f0c43385e4b7e1431893f2691"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 4: Git-Source Plugins Verification Report

**Phase Goal:** A plugin whose source is a git repository installs, fails, updates, and uninstalls against the loopback git host, and the request log shows when the network is used and when the clone cache is.
**Verified:** 2026-10-23T14:30:00Z
**Status:** passed
**Re-verification:** Yes -- on the combined milestone tree (all 15 phases merged), because covered files changed in later merges. The previous report passed 5/5 with no gaps, so this pass is a regression check, with fresh runs of the phase's scenarios and unit tests.

## What changed since the previous verification

Of the phase's product files, only `install.messaging.ts` changed after the previous verification, through the Phase 15 merge (3c5c2aa1, 4a9d5fa0). It added `StateLockHeldError` handling to Branch 4 of `composeInstallFailureMessage`. The orchestrator's merge resolution kept both sides. Read from the current file:

- `runtimeFailureReasons(err, gitReason)` returns `["lock held"]` for `StateLockHeldError`, otherwise `[gitReason]` when `classifyGitHostFailure(err)` produced one, otherwise `[]`.
- The cause gate `...(gitReason !== "authentication required" && cause !== undefined && { cause })` is unchanged, so the auth row stays bare and every other row keeps its cause chain.
- A lock error is not a git-host failure, so `classifyGitHostFailure` returns `undefined` for it and the two paths do not collide. The git-host reasons (`source missing`, `network unreachable`, `network error`, `authentication required`) are all still produced by the ladder.

`clone-cache.ts`, `fetch.ts`, `install-flow.ts`, `shared/git-failure-classifiers.ts`, `features/plugin/git-source.feature`, and `features/plugin/git-source-update.feature` have no commits since the previous verification's base (c20afb40). `features/plugin/fetch.feature` (Phase 12) and `test/orchestrators/plugin/install.messaging.test.ts` did change; both are now in `covered_files`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 / INS-05: each git source kind (`github`, `url`, `git-subdir`) installs from the git host and a new session offers its skills; a second install of the same pinned source reuses the clone with no request | ✓ VERIFIED | `git-source.feature` install Outline (3 rows) compares the whole envelope, plugin rows, request log (exactly one GET+POST upload-pack pair), and the skills of a new session. The pinned-reuse scenario asserts `{ requests: [], connections: 0 }`. Re-run on the combined tree: 12 scenarios pass. `clone-cache.ts:328` still guards the refresh with `promotion !== "renamed"`. |
| 2 | SC2 / INS-06: a 404, a 401, or a dropped connection fails the install with the matching reason and leaves no record, no `plugin-clones/` entry, and no skill in a new session | ✓ VERIFIED | Refusal Outline (404 `source missing`, drop `network unreachable`, 503 `network error`) and the 401 scenario (`authentication required`, bare row). Each checks the failed row, the request log, no installed plugins, no git clones, and no skills in a new session. Code path read: `install.messaging.ts` Branch 4 via `classifyGitHostFailure`; the Phase 15 lock branch sits in the same function and leaves the git arms intact (unit tests below pass). |
| 3 | SC3 / UPD-02: updating a git-source plugin fetches the new revision on a cache miss (request log shows it) and makes no request when the cache already holds that revision | ✓ VERIFIED | `git-source-update.feature` "fetches its new revision" and "makes no request" scenarios pass on the combined tree. `update-flow.ts` changed in Phase 15 (held-lock reporting); the scenarios still pass, so the update path's cache behavior is intact. |
| 4 | SC4 / UNI-03: uninstall removes the `plugin-clones/` entry when no other installation uses it and keeps it while another does | ✓ VERIFIED | Both uninstall scenarios in `git-source.feature` pass (keeps the shared clone; removes the sole one). |
| 5 | SC5: the phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | ✓ VERIFIED | Orchestrator ran `npm run check` on this exact tree: green (static, unpaired, integration, 702/702 cucumber scenarios, direct coverage). Verifier runs: `npx cucumber-js --parallel 2 features/plugin/git-source.feature features/plugin/git-source-update.feature` -> 12 scenarios, 160 steps passed; `npm run check:features` -> exit 0. |

Plan-level truths (merged):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P1 | A first unpinned install clones once (D-05) | ✓ VERIFIED | `clone-cache.ts` skips `refreshGitHubClone` when the promotion is `renamed`. Unit test "MIRR-01 ... returns HEAD without a refresh" passes. |
| P2 | A warm mirror and a raced promotion still refresh (D-79.1-02/03) | ✓ VERIFIED | MIRR-02 and MIRR-03 unit cases pass in `clone-cache.test.ts`; the update scenario needs the warm refresh to reach revision 2 and passes. |
| P3 | A refused install carries its reason; the auth row stays bare; others keep the cause | ✓ VERIFIED | `install.messaging.test.ts` (30 lines added by Phase 15 beside the git-host cases), `git-failure-classifiers.test.ts`, and `install-flow.test.ts` pass: 493 tests, 0 fail across the five unit files. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `materializeOrRefreshPluginMirror` skips the refresh after a fresh clone | ✓ VERIFIED | unchanged since previous verification; `promotion !== "renamed"` guard at line 328 |
| `features/plugin/git-source-update.feature` | warm-cache update scenario | ✓ VERIFIED | present, passes |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | runtime-throw branch classifies git host refusals | ✓ VERIFIED (plan pattern stale) | uses `classifyGitHostFailure` (line 248), plus the lock-held arm from Phase 15. The 04-02 plan names `classifyGitSourceAccessFailure`; review fix WR-01 renamed it on purpose (see For the orchestrator). |
| `features/plugin/git-source.feature` | refusal Outline + 401 scenario | ✓ VERIFIED | present, passes |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `materializeOrRefreshPluginMirror` | `promoteStagingToClone` | `renamed` result -> no refresh | WIRED | `promotion` set at line 317, guard at line 328 |
| `composeInstallFailureMessage` | `shared/git-failure-classifiers.ts` | runtime-throw branch maps the failure to a closed-set reason | WIRED | `classifyGitHostFailure(err)` feeds `reasons` (through `runtimeFailureReasons`) and the cause gate. `classifyGitSourceAccessFailure` (marketplace add, `add.ts:335`) composes over the same ladder. |

### Data-Flow Trace (Level 4)

Not applicable. No rendered dynamic data; the cucumber steps read the real product's results, `state.json`, `plugin-clones/`, and the git host's request log.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js --parallel 2 features/plugin/git-source.feature features/plugin/git-source-update.feature` | 12 scenarios, 160 steps passed | ✓ PASS |
| Phase unit tests | `node --test test/orchestrators/plugin/{install.messaging,clone-cache,install-flow,fetch}.test.ts test/shared/git-failure-classifiers.test.ts` | 493 pass, 0 fail | ✓ PASS |
| Feature catalog | `npm run check:features` | exit 0 | ✓ PASS |
| Full gate | `npm run check` (orchestrator, this tree) | green | ✓ PASS (not rerun, per instruction) |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INS-05 | 04-01 | git/github/url source installs from the loopback host; a second pinned install reuses the clone with no request | ✓ SATISFIED | Truth 1 |
| INS-06 | 04-02 | a refused source (404, 401, drop) fails with the matching reason and leaves nothing | ✓ SATISFIED | Truth 2 |
| UPD-02 | 04-01 | update fetches on a cache miss and makes no request on a cache hit | ✓ SATISFIED | Truth 3 |
| UNI-03 | (Phase 1 seeds, kept per D-02) | uninstall removes the clone when no other installation uses it | ✓ SATISFIED | Truth 4. No plan's `requirements:` lists UNI-03; CONTEXT D-02 assigns it to the Phase 1 seeds, so it is not orphaned. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (covered files) | -- | No TBD/FIXME/XXX on lines this phase added | -- | none |

### Info (non-blocking)

- `the {word} scope holds no git clones` reads `plugin-clones/` and `.git` checkouts under `sources/`, but not `sources-staging/`. A leaked staging directory would pass the refusal scenarios. SC2 names only `plugin-clones/`, so this is not a gap.
- UNI-03's removal is shown only for an unpinned mirror, and the kept case only for a pinned clone. `clone-gc.ts` treats both key shapes the same way, so the risk is low.
- The refusal scenarios use only the `github` plugin source kind. SC2 does not ask for each kind.

### Human Verification Required

None.

### Gaps Summary

None. All five roadmap success criteria and all four requirements still hold on the combined tree. The Phase 15 lock-held handling and this phase's git-host failure reasons coexist in `composeInstallFailureMessage` Branch 4 without interfering.

## For the orchestrator

Resolved since the previous report:

- WR-03 (info `--fetch` on a cold unpinned source contacted the host twice): resolved by Phase 10, commit ef5165df "fix(info): fetch a git plugin's repository once".
- Merge note (sibling-phase scenarios asserting two upload-pack pairs on a first unpinned clone): resolved. `features/plugin/fetch.feature` now asserts one pair each for `ghp` and `urlp` on a first unpinned `fetch` (lines ~168-176, comment "cloned once"), after 7a9b6107 and the Phase 12 merge. `git-source.feature` on this tree is Phase 4's version (one pair per install).

Still open (all deferred, none is a Phase 4 success criterion):

- WR-02: a dependency's refused clone in a cascade still has no reason. `handleCascadeThrow` -> `composeCascadeFailureMessage` (`install-cascade.messaging.ts`) takes its reasons from `failureFacts`, and `classifyGitHostFailure` is not called there. It shows `{unreadable}` on `/reload`.
- IN-01: when staging cleanup leaks, `appendLeakToError` drops the error `code`, so the install loses its reason.
- IN-03 remainder: an install pinned to a commit the remote lacks still fails with no reason.
- Planning drift: the 04-02 PLAN artifact and key_link name `classifyGitSourceAccessFailure`; the code uses `classifyGitHostFailure` after WR-01. Update the plan text if plans are re-checked. `verify.artifacts` flags it as a missing pattern.
- Info: `holds no git clones` does not inspect `sources-staging/` (candidate for Phase 5 rollback coverage).

---

_Verified: 2026-10-23T14:30:00Z_
_Verifier: Claude (gsd-verifier)_

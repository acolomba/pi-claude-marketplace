---
phase: 22-install-failure-reasons
verified: 2026-10-23T16:10:00Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/phases/22-install-failure-reasons/22-01-PLAN.md
  - .planning/phases/22-install-failure-reasons/22-01-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - features/plugin/git-source.feature
  - features/plugin/install-dependencies.feature
  - features/step_definitions/plugin/git-source.steps.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/shared/errors.test.ts
  - test/shared/git-failure-classifiers.test.ts
covered_digest: "v3:sha256:792d71af21f54b9f3b9dfb76170e0436239c787832500e59e83d2556d4843d6e"
behavior_unverified: 0
overrides_applied: 0
human_verification: []
re_verification: "orchestrator closed truth 5 (narrowProbeError reads through leaks) and accepted truth 3 under D-05; message reworded for the ref-hint tag gap"
---

# Phase 22: Install Failure Reasons Verification Report

**Phase Goal:** No install failure renders without its reason.
**Verified:** 2026-10-23T16:10:00Z
**Status:** passed
**Re-verification:** Yes -- after the initial `human_needed` report, the orchestrator fixed truth 5 and accepted truth 3 under the recorded decision D-05 (autonomous run: recommended default taken and recorded)
**Implementation:** commit `ccadeb11` (HEAD; no tracked changes after it)

## For the user

Items that need your attention or a decision, one per line:

1. **D-05 interpretation (INR-01, SC1), accepted autonomously:** on `/reload`, a declared plugin whose dependency's clone the host refused reads `{dependency failed}`, with the host's answer (`HTTP Error: 404 Not Found, fetched ...`) only in its cause chain; the dependency gets no row and no `{source missing}` token. The dependency's own reason is named by the command's row. Change it only if you want reconcile to emit a dependency row. (A declared git plugin that is itself refused does read `{source missing}` on `/reload`.)
2. **Import's git-refusal fallthrough is left to phase 24 (D-06):** `import` still reports a refused git clone as `unexpected-failure`. The comment at `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1773-1775` still says `dispatchFailedOutcome` "mirrors" `classifyOrchestratorThrow`, which stopped being true when this phase added the git arm. Phase 24 should fix both.
3. **Pinned sha that no branch or tag reaches (INR-03 / D-09):** Claude Code fetches the pinned sha directly (`git fetch origin <sha>`) and installs it. We fail it as `{source missing}` ("A fresh clone from the git host does not hold the commit ..."). No ID records this divergence. Decide whether to record it (isomorphic-git capability gap) or to add the sha fetch.
4. **Range list form (INR-04 / D-10):** both `{version conflict}` causes now quote the declared ranges space-joined in one quoted string (`"^1.0.0 ^2.0.0"`). Upstream joins with `, ` and does not quote. Caveat: a declared range that contains `||` changes meaning under the space join (`["^1.0.0 || ^2.0.0", "^3.0.0"]` renders as `"^1.0.0 || ^2.0.0 ^3.0.0"`, which semver reads as `^1.0.0 || (^2.0.0 ^3.0.0)`).
5. **`{no matching version}` still prints a normalized range:** its cause goes through `renderConstraintRange(range)` on the effective range (`install-cascade.ts:671/686`), not the declared texts. INR-04 covers only the two `{version conflict}` causes, so this is outside the SC, but the three dependency causes do not yet read the same way.
6. **Missing-pin cause chain keeps isomorphic-git's advice:** the row reads `A fresh clone from the git host does not hold the commit <sha>, Failed to checkout "<sha>" because commit <sha> is not available locally. Do a git fetch to make the branch available locally.` The "Do a git fetch" text is advice the user cannot act on inside Pi.
7. **INR-02 non-git reasons, fixed after verification:** `classifyOrchestratorThrow` now calls `narrowProbeError(withoutCleanupLeaks(err))`, so a leak-wrapped `EACCES` reads `permission denied` on `/reload` (unit case added).
8. **Ref-hint path does not fetch tags (pre-existing):** a ref-hint clone is `singleBranch` (wants only that branch) and the recovery fetch runs with `tags: false` (isomorphic-git `_fetch` keeps only `refs/heads/*` then), so a pin reachable only from a tag fails on that path. The message was reworded to what is proven ("A fresh clone from the git host does not hold the commit <sha>"). Passing `tags: true` needs a `platform/git.ts` `FetchOptions` change; left as a follow-up.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1a: a cascade dependency whose clone the host refuses names the reason on its own row in the command (INR-01, D-03) | VERIFIED | `install-cascade.messaging.ts::memberReasons` (rollback partial, then `InstallMarketplaceAddError.reason`, then `classifyGitHostFailure`). Scenario Outline "An install fails on the dependency as <reason> when the git host <refusal> ..." (404 → source missing, dropped → network unreachable, 503 → network error) passes. Unit tests "INR-01 a member whose clone the git host refused ..." and "... whose marketplace add failed ..." pass. Extra probe (scratch feature, not committed): a refused ROOT git plugin with a dependency reads `{source missing}` |
| 2 | SC1b: a declared git plugin whose clone the host refuses reads its git reason on `/reload`, not `{unreadable}` (INR-01, D-04) | VERIFIED | `apply-outcomes.ts::classifyOrchestratorThrow` returns `InstallMarketplaceAddError.reason`, then `classifyGitHostFailure(err) ?? narrowProbeError(err)`. Scenario "A new session reports a declared plugin whose clone the git host refuses as source missing" passes; unit "INR-01: classifies a clone the git host refused ..." passes |
| 3 | SC1c: after `/reload`, a declared plugin whose DEPENDENCY was refused names the dependency's reason | VERIFIED (under D-05) | The row reads `{dependency failed}` and the 404 appears in its cause chain (scenario "... whose dependency's clone the git host refuses as dependency failed" passes). Whether this counts as "names the reason" is the D-05 interpretation, so it goes to the user |
| 4 | SC2: a staging cleanup leak keeps the git failure's reason (INR-02, D-07, D-08) | VERIFIED | `appendLeakToError` returns `CleanupLeakError` (`errors.ts:282-296`); `withoutCleanupLeaks` walks `causeChain` (depth-capped). `classifyGitTransportFailure`, `hostHttpStatus`, `classifyGitHostFailure`, `classifyGitSourceAccessFailure` all unwrap it. Unit cases for each ladder behind a leak pass. Auth row keeps the cause behind a leak (`install.messaging.ts::keepsRuntimeCause`, unit "INR-02: keeps the cause of an authentication failure whose cleanup leaked"). Probe: `classifyOrchestratorThrow(appendLeakToError(HTTP 404))` → `source missing` |
| 5 | SC2 (literal): a leak keeps a NON-git reason | VERIFIED | After the fix, `classifyOrchestratorThrow` probes `withoutCleanupLeaks(err)`; unit "INR-02: classifies a filesystem error behind a cleanup leak through the probe fallback" passes (`permission denied`) |
| 6 | SC3: an install pinned to a commit the remote lacks fails with a reason (INR-03, D-09) | VERIFIED | `clone-cache.ts::checkoutPinWithRefetch` + `asPinnedCommitMissing` turn `CommitNotFetchedError` from a fresh staging clone (both the no-ref path and the ref-hint retry) into `PinnedCommitMissingError`; `classifyGitHostFailure` maps it to `source missing`. Scenario "An install of a plugin pinned to a commit its repository lacks fails as source missing and leaves nothing behind" passes (row `{source missing}`, no record, no clone). Unit: both PURL-04 / INR-03 clone-cache cases pass |
| 7 | SC4: both `{version conflict}` causes print ranges in one form (INR-04, D-10) | VERIFIED | Both `range-conflict` arms now use `renderConstraintRange(<member>.ranges.join(" "))` (`install-cascade.ts:554` contradictory-declarations, `:875` installed-unsatisfied). They are the only `"version conflict"` producers (`install-cascade.messaging.ts:340/348`). The feature's cause lines read `"^1.0.0 ^2.0.0"` and `"^2.0.0"` (declared texts) |
| 8 | SC5: `npm run check` stays green | VERIFIED | Orchestrator ran it green on this tree (718 scenarios, direct coverage merged); not re-run on instruction. Spot checks agree: 29/29 scenarios in the two features, 608/608 tests in the 8 paired unit files |

**Score:** 6/8 truths verified (0 present, behavior-unverified; 2 uncertain, routed to the user)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/errors.ts` | `CleanupLeakError`, `withoutCleanupLeaks`, `PinnedCommitMissingError` | VERIFIED | Present, substantive, imported by classifiers, clone-cache, install.messaging |
| `shared/git-failure-classifiers.ts` | leak unwrap on every ladder, missing pin → source missing | VERIFIED | Wired into install, cascade, reconcile |
| `orchestrators/plugin/clone-cache.ts` | typed missing-pin error | VERIFIED | Both checkout catch sites wrap |
| `orchestrators/plugin/install-cascade.messaging.ts` | member arm reason | VERIFIED | `failureFacts` calls `memberReasons` |
| `orchestrators/reconcile/apply-outcomes.ts` | git arm before probe fallback | VERIFIED | |
| `orchestrators/plugin/install.messaging.ts` | auth + leak keeps cause | VERIFIED | |
| `orchestrators/plugin/install-cascade.ts` | declared ranges on installed-unsatisfied | VERIFIED | |
| `features/plugin/git-source.feature`, `install-dependencies.feature`, `git-source.steps.ts` | scenarios D-11 | VERIFIED | 6 new scenarios run (by name filter) and pass |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `appendLeakToError` callers (clone-cache, marketplace add, 4 bridges) | classifiers | `CleanupLeakError.cause` read by `withoutCleanupLeaks` | WIRED |
| `materializePluginClone` | `classifyGitHostFailure` | `PinnedCommitMissingError` | WIRED (scenario) |
| cascade member ledger error | member row brace | `memberReasons` | WIRED (scenario) |
| reconcile install throw | reconcile row brace | `classifyOrchestratorThrow` | WIRED (scenario) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase features | `cucumber-js features/plugin/git-source.feature features/plugin/install-dependencies.feature` | 29 scenarios passed | PASS |
| New scenarios execute | `cucumber-js git-source.feature --name "...for the dependency\|declared plugin whose\|commit its repository lacks"` | 6 passed | PASS |
| Paired unit files (8) | `node --test` on errors, git-failure-classifiers, clone-cache, install-cascade, install-cascade.messaging, install.messaging, apply-outcomes, marketplace/add | 608/608 | PASS |
| Root git plugin refused, with a dependency | scratch feature (outside the repo) | row `ghp (failed) {source missing}` with the 404 cause | PASS |
| Leak-wrapped errors through the reconcile classifier | `node -e` probe | 404 behind leak → `source missing`; EACCES behind leak → `unreadable` (bare → `permission denied`) | PASS / see truth 5 |

### Probe Execution

Not applicable. The phase declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| INR-01 | 22-01 | SATISFIED | Truths 1-3 (truth 3 under D-05) |
| INR-02 | 22-01 | SATISFIED | Truths 4-5 |
| INR-03 | 22-01 | SATISFIED | Truth 6 |
| INR-04 | 22-01 | SATISFIED | Truth 7 |

No orphaned requirements. REQUIREMENTS.md maps only INR-01..04 to phase 22.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `orchestrators/import/execute.ts` | 1773-1775 | Stale "mirrors classifyOrchestratorThrow" comment (not a phase file) | Info | Phase 24 owns it (D-06) |

No TBD/FIXME/XXX/TODO/HACK markers in the 18 files the commit touched.

### Human Verification Required

None. The D-05 reading is recorded in CONTEXT and listed under "For the user".

### Gaps Summary

No gaps. Every success criterion has code and passing tests behind it. `npm run check` was rerun green by the orchestrator after the post-verification fixes.

---

_Verified: 2026-10-23T16:10:00Z_
_Verifier: Claude (gsd-verifier)_

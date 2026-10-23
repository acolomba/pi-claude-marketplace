---
phase: 04-git-source-plugins
verified: 2026-10-23T09:39:17Z
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
  - "features/plugin/git-source-update.feature"
  - "features/plugin/git-source.feature"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/fetch.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/install.messaging.test.ts"
  - "test/shared/git-failure-classifiers.test.ts"
covered_digest: "v3:sha256:f70679f9568a6bdc033cb268a8e61dc9c4ead71bde60ae7e4d1da14b4581c8ef"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 4: Git-Source Plugins Verification Report

**Phase Goal:** A plugin whose source is a git repository installs, fails, updates, and uninstalls against the loopback git host, and the request log shows when the network is used and when the clone cache is.
**Verified:** 2026-10-23T09:39:17Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 / INS-05: each git source kind (`github`, `url`, `git-subdir`) installs from the git host and a new session offers its skills; a second install of the same pinned source reuses the clone with no request | ✓ VERIFIED | `git-source.feature` Outline "Installing a plugin from a <plugin source kind> source..." (3 rows) compares the whole envelope, the whole plugin row set (version `{<repo> revision 1}`), the whole request log (exactly one GET+POST upload-pack pair), and the whole skill list of a new session. "A plugin pinned to the commit another installed plugin was cloned at installs with no request" asserts `{ requests: [], connections: 0 }` for the second install. A wrong implementation that re-clones, re-resolves the pin over the network (ls-remote), or refreshes after the clone adds rows to the log and fails. |
| 2 | SC2 / INS-06: a 404, a 401, or a dropped connection fails the install with the matching reason and leaves no record, no `plugin-clones/` entry, and no skill in a new session | ✓ VERIFIED | Refusal Outline (404 -> `source missing`, drop -> `network unreachable`, plus 503 -> `network error`) and a separate 401 scenario (`authentication required`; the plain `answers {int}` step refuses 401, so it uses the credential arm). Each compares the whole failed row: reasons, cause chain, leaks, rollback partial. `recordTable` adds every unstated field as a column, so the 401 row also proves there is no cause (D-79-03). Each then checks the request log (one GET with the refused status), `has no installed plugins` (state records + staged skills + prompts), `holds no git clones` (every `plugin-clones/` entry, strictly), and `the session offers no skills`. The pre-fix product reported empty reasons (measured in 04-CONTEXT), which the reasons column rejects. |
| 3 | SC3 / UPD-02: updating a git-source plugin fetches the new revision on a cache miss (request log shows it) and makes no request when the cache already holds that revision | ✓ VERIFIED | `git-source-update.feature` "Updating a git-source plugin fetches its new revision": `updated` from `{ghp revision 1}` to `{ghp revision 2}`, the whole log (marketplace pair + `ghp` pair), and the clones. "Updating a plugin to a revision the clone cache already holds makes no request": after `subp`'s update fetches `mono` revision 2, `subq`'s update reports `updated` from rev 1 to rev 2 with `{ requests: [], connections: 0 }`, and a new session offers both skills at 2.0.0. An always-fetch update fails the empty log; an update that keeps the old clone fails from/to and the skill descriptions. |
| 4 | SC4 / UNI-03: uninstall removes the `plugin-clones/` entry when no other installation uses it and keeps it while another does | ✓ VERIFIED | "Uninstalling one of two plugins pinned to one commit keeps the clone the other still uses" compares the whole clone set (one plugin clone, mono rev 1). "Uninstalling the only installation of a git-source plugin removes its clone" asserts `holds no git clones`. Always-remove fails the first scenario and never-remove fails the second. A key derived from the full `resolvedSource` (with the subdir) would delete the shared git-subdir clone and fail the first. `clone-gc.ts` takes one path for pinned and mirror keys, so a missing pinned-only-removal scenario is a low risk (see Info). |
| 5 | SC5: the phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | ✓ VERIFIED | Orchestrator measurement: `npm run check` exit 0 at c20afb40 (static incl. check:features + fallow, unpaired, integration, 468/468 cucumber, direct coverage). f4344b14 touches only `.planning/` docs. Verifier rerun: `npx cucumber-js features/plugin/git-source.feature features/plugin/git-source-update.feature --parallel 1` -> exit 0, 12 scenarios / 160 steps passed. |

Plan-level truths (merged):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P1 | A first unpinned install clones once (D-05) | ✓ VERIFIED | `clone-cache.ts` skips `refreshGitHubClone` when `promoteStagingToClone` returns `"renamed"`. Commit 791a60dd removed the second pair from the install Outline, which shows the Outline detects the double fetch. Unit test "MIRR-01: ... returns HEAD without a refresh" asserts `fetchCalls.length === 0`. |
| P2 | A warm mirror and a raced promotion still refresh (D-79.1-02/03) | ✓ VERIFIED | Unit tests "MIRR-02: mirror PRESENT (warm) refreshes in place", "MIRR-02: two successive calls...", "MIRR-03: ... treats the winner's dir as the warm mirror" (now asserts `fetchCalls.length === 1`). PROV-03 calls the function twice, so the refresh fetch still carries auth. Behavior check: the cucumber update scenario 1 needs the warm refresh to reach revision 2. |
| P3 | A refused install carries its reason; auth row stays bare; others keep the cause | ✓ VERIFIED | `install.messaging.ts` branch 4 uses `classifyGitHostFailure` and keeps `cause` unless the reason is `authentication required`. Unit cases: 404, 503, ECONNRESET, a local `NotFoundError` that stays unclassified (WR-01), and the existing auth cases. `install-flow.test.ts` ENETUNREACH now reports `{network unreachable}` with its cause. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `materializeOrRefreshPluginMirror` skips the refresh after a fresh clone | ✓ VERIFIED | `verify.artifacts` passed; `promotion !== "renamed"` guard at the refresh |
| `features/plugin/git-source-update.feature` | warm-cache update scenario | ✓ VERIFIED | present, runs, passes |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | runtime-throw branch classifies git host refusals | ✓ VERIFIED (plan pattern stale) | `verify.artifacts` reports "Missing pattern: classifyGitSourceAccessFailure". This is intentional: review fix WR-01 (c20afb40) moved install to the new `classifyGitHostFailure`, which is the same ladder without the remote-`NotFoundError` arm. Without that arm, a local read on an on-disk clone is not reported as `source missing`. The intent of the artifact holds. |
| `features/plugin/git-source.feature` | refusal Outline + 401 scenario | ✓ VERIFIED | present, runs, passes |

### Key Link Verification

`verify.key-links` could not evaluate either link, because the plans name symbols in `from:` and the tool needs a file path. Checked by hand:

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `materializeOrRefreshPluginMirror` | `promoteStagingToClone` | `renamed` result -> no refresh | WIRED | `promotion = await promoteStagingToClone(...)`, then `if (promotion !== "renamed") refreshGitHubClone(...)` |
| `composeInstallFailureMessage` | `shared/git-failure-classifiers.ts` | runtime-throw branch maps the failure to a closed-set reason | WIRED | `const gitReason = classifyGitHostFailure(err)` feeds `reasons` and the cause gate. `classifyGitSourceAccessFailure` (marketplace add) now composes over it, and `add.ts:332` is unchanged. |

### Data-Flow Trace (Level 4)

Not applicable. No rendered dynamic data; the cucumber steps read the real product's results, state.json, `plugin-clones/`, and the git host's request log.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js features/plugin/git-source.feature features/plugin/git-source-update.feature --parallel 1` | exit 0, 12 scenarios, 160 steps passed | ✓ PASS |
| Fix unit tests | `node --test test/orchestrators/plugin/install.messaging.test.ts test/shared/git-failure-classifiers.test.ts test/orchestrators/plugin/clone-cache.test.ts` | 176 pass, 0 fail | ✓ PASS |
| Full gate | `npm run check` (orchestrator, at c20afb40) | exit 0 | ✓ PASS (not rerun, per instruction) |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INS-05 | 04-01 | git/github/url source installs from the loopback host; a second pinned install reuses the clone with no request | ✓ SATISFIED | Truth 1 |
| INS-06 | 04-02 | a refused source (404, 401, drop) fails with the matching reason and leaves nothing | ✓ SATISFIED | Truth 2 |
| UPD-02 | 04-01 | update fetches on a cache miss and makes no request on a cache hit | ✓ SATISFIED | Truth 3 |
| UNI-03 | (Phase 1 seeds, kept per D-02) | uninstall removes the clone when no other installation uses it | ✓ SATISFIED | Truth 4. No plan's `requirements:` lists UNI-03. CONTEXT D-02 assigns it to the Phase 1 seeds, which this phase keeps, so it is not orphaned. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (phase diff) | -- | No TBD/FIXME/XXX/TODO/HACK on added lines | -- | none |

### Info (non-blocking)

- `the {word} scope holds no git clones` reads `plugin-clones/` and `.git` checkouts under `sources/`, but not `sources-staging/`. A staging directory leaked by a failed clone would pass the refusal scenarios. SC2 names only `plugin-clones/`, so this is not a gap.
- UNI-03's removal is shown only for an unpinned mirror, and the kept case only for a pinned clone. `clone-gc.ts` treats both key shapes the same way, so the risk is low.
- The refusal scenarios use only the `github` plugin source kind. SC2 does not ask for each kind.

### Human Verification Required

None.

### Gaps Summary

None. All five roadmap success criteria and all four requirements have scenarios that a plausible wrong implementation fails. Both product fixes have unit tests and cucumber coverage: the single clone of a new unpinned mirror, and install refusal reasons through `classifyGitHostFailure`. The plan 04-02 artifact pattern is stale because of the documented WR-01 rename. That is a planning-text drift, not a code gap.

## For the orchestrator

- WR-02 (deferred): a dependency's refused clone in a cascade still has no reason (`handleCascadeThrow`), and shows `{unreadable}` on `/reload`.
- WR-03 (deferred, Phase 10 surface): `info --fetch` on a cold unpinned source still contacts the host twice (direct probe, then again through `resolveStrict`).
- IN-01 (deferred): when staging cleanup leaks, `appendLeakToError` drops the error `code`, so the install loses its reason.
- IN-03 remainder (deferred): an install pinned to a commit the remote lacks still fails with no reason.
- Merge note: scenarios in other parallel phases that assert two upload-pack pairs on a first unpinned clone, or an empty reason on a refused install, must be updated at merge. Found: `lc-p12-fetch-prune-7cbdf4/features/plugin/fetch.feature` (~lines 168-177) asserts two pairs each for `ghp` and `urlp` on a first unpinned `fetch`, and its comment says "cloned and then refreshed at once". Every sibling worktree still carries the Phase 1 seed of `features/plugin/git-source.feature` with two pairs (line ~28); take Phase 4's version.
- Planning drift: the 04-02 PLAN artifact/key_link names `classifyGitSourceAccessFailure`; the code uses `classifyGitHostFailure` after WR-01. Update the plan text if plans are re-checked.
- Info: `holds no git clones` does not inspect `sources-staging/`, so a leaked clone staging dir would go unnoticed (candidate for Phase 5 rollback coverage).

---

_Verified: 2026-10-23T09:39:17Z_
_Verifier: Claude (gsd-verifier)_

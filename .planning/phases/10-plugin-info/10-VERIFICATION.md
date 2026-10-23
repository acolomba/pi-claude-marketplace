---
phase: 10-plugin-info
verified: 2026-10-23T09:08:49Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/phases/10-plugin-info/10-01-PLAN.md
  - .planning/phases/10-plugin-info/10-01-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - features/plugin/info.feature
  - test/orchestrators/plugin/info.test.ts
covered_digest: "v3:sha256:de738d1b8480fe426be72b2e0e4ee94d4e8b581723762ab3523f3017cc49c581"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A missing path-source directory reads `source missing` rather than `unsupported source` in info, install, and list"
    addressed_in: "follow-up (shared resolver classification, shared/probe-classifiers.ts)"
    evidence: "10-CONTEXT.md D-05 and <deferred>; outside the Phase 10 surface, shared with Phases 3 and 9"
  - truth: "`list` shows the warm tree's sha version for a fetched git plugin whose entry declares none"
    addressed_in: "Phase 9 (Plugin List)"
    evidence: "10-CONTEXT.md <deferred>; 10-REVIEW IN-02; list-candidate-row.ts still reads manifestEntry.version only"
---

# Phase 10: Plugin Info Verification Report

**Phase Goal:** `info` has scenarios for installed, available, partially available, and unavailable plugins, for `--fetch`, and for a plugin the marketplace does not offer.
**Verified:** 2026-10-23T09:08:49Z
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC-1 / INF-01, INF-02: `info` on an installed plugin shows its version, scope, source, and skills; on an available plugin it shows what an install would provide | VERIFIED | `info.feature:26-51`: install at `1.0.0`, the marketplace then offers `2.0.0`, and info still shows `plugin version 1.0.0`, `plugin scope project`, `marketplace name fixtures`, `marketplace scope project`, `plugin components skills demo-skill`. `info.feature:53-73`: not installed, `available`, `demo-skill`. Mutation: showing the entry version on the installed row (`info.ts:1368` `installed.version` -> `manifestVersion`) fails this scenario and the installed `--fetch` scenario. "Source" is read as the marketplace (D-02); `PluginInfoRowBase` (`shared/notification-types.ts:926`) has no source field. |
| 2 | SC-2 / INF-03: a partially available plugin names what an install would leave out; an unavailable plugin names the reasons | VERIFIED | `info.feature:75-96`: `partially-available`, `unsupported component`, kept skill `demo-skill`. `info.feature:98-124`: npm source, `unavailable`, `unsupported source`, components unresolved. The fields step compares every envelope field (`namesLike` in `features/lib/field-rows.ts:78`), so a wrong status or reason fails. |
| 3 | SC-3 / INF-04: `info --fetch` reads the remote source and reports a newer revision; `info` without the flag makes no request | VERIFIED | `info.feature:150-181`: fetch, the repository moves, `info --fetch` shows `{ghp revision 2}` with one GET and one POST. `info.feature:126-148`: never-fetched remote plugin, `remote`, unresolved, no request. `info.feature:183-211`: bare info after a fetch shows `{ghp revision 1}`, no request. Request steps read only the last `When` window (`features/support/https-git-host.ts`). Mutation: the pre-phase `info.ts` (0fc0172c) fails 3 scenarios (version absent twice, doubled fetch once). |
| 4 | SC-4 / INF-05: `info` on a plugin the marketplace does not offer fails as not in the manifest | VERIFIED | `info.feature:247-267`: `failed`, `not in manifest`, severity `error`, summary `A plugin operation has failed.` |
| 5 | SC-5: the scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | VERIFIED | Orchestrator report: `npm run check` on HEAD c4744b4c exited 0, including check:features, test:cucumber (472 scenarios / 4482 steps), test:integration, and direct coverage (280 records). Verifier run: `npx cucumber-js features/plugin/info.feature`, 10 scenarios / 91 steps passed. |
| 6 | D-03: a not-installed git-source plugin with a warm tree and no declared version shows `sha-<12hex>` of that tree | VERIFIED | `info.ts:2539-2542` `version ?? shaVersion(presence.resolvedSha)` feeds the available, warm non-installable, and unreadable-tree arms. Unit test `D-77-01: a WARM git clone whose entry declares no version shows the clone's commit` passes. Scenario `info.feature:183-211` fails without the fix (mutation run). |
| 7 | WR-01 / D-04: `info --fetch` fetches a git plugin's repository once, and on an installed plugin keeps showing the installed revision | VERIFIED | `info.ts:2188` and `:2548` pass `() => Promise.resolve(presence)` to the resolver. Mutation: restoring `resolveGitPluginRoot: probe` fails both `--fetch` scenarios on the request table. `info.feature:213-245`: installed at revision 1, repository moves, `info --fetch` shows `{ghp revision 1}` with one fetch. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Missing path-source directory reads `unsupported source` in info, install, and list | Follow-up on `shared/probe-classifiers.ts` | 10-CONTEXT D-05 and deferred list |
| 2 | `list` shows only the entry version for a fetched git plugin | Phase 9 | 10-CONTEXT deferred list, 10-REVIEW IN-02 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/info.feature` | The info scenarios, `Feature: Plugin info` | VERIFIED | 10 scenarios; each single result stated whole with the fields step (D-07); the two-scope cascade uses the rows table |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | Warm git rows fall back to `shaVersion(presence.resolvedSha)` | VERIFIED | Import at line 63, use at line 2542; resolver reuses the first probe's tree at lines 2188 and 2548 |
| `test/orchestrators/plugin/info.test.ts` | Unit contract for the warm sha fallback and the single fetch | VERIFIED | New D-77-01 test; the fetched-tree-unreadable test asserts `materializations === 1` |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `buildGitNotInstalledRow` | `domain/version.ts` `shaVersion` | `version ?? shaVersion(presence.resolvedSha)` | WIRED | Value flows into `buildAvailableRow`, `buildWarmGitNonInstallableRow`, and the catch arm |
| `buildGitNotInstalledRow` / `buildInstalledGitRow` | `resolveStrict` | `resolveGitPluginRoot: () => Promise.resolve(presence)` | WIRED | `plugin-resolver.ts:458` calls it once with the parsed source of the same entry |
| `{ghp revision N}` token | `sha-<12hex>` | `features/support/world.ts:121-127` | WIRED | Token maps to `sha-` plus the first 12 hex of the n-th published commit |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Info scenarios pass | `npx cucumber-js features/plugin/info.feature` | 10 scenarios, 91 steps passed | PASS |
| Changed unit tests pass | `node --test --test-name-pattern="D-77-01: a WARM git clone whose entry declares no version\|an explicit fetch whose fetched tree cannot be read" test/orchestrators/plugin/info.test.ts` | 2 pass, 0 fail | PASS |
| Pre-phase `info.ts` fails the new scenarios (scratch copy) | `git show 0fc0172c:.../info.ts` over a copy, then cucumber | 3 failed: bare-after-fetch and `--fetch` lack `plugin version`; installed `--fetch` sends 2 GET/POST pairs | PASS (scenarios discriminate) |
| Double probe restored (scratch copy) | `resolveGitPluginRoot: probe` | 2 failed on the request tables | PASS (scenarios discriminate) |
| Installed row shows offered version (scratch copy) | `version: manifestVersion` at line 1368 | 2 failed (`2.0.0` vs `1.0.0`; revision 1 missing) | PASS (scenarios discriminate) |

All mutations ran in a scratch copy with a symlinked `node_modules`; the worktree was not touched.

### Probe Execution

Not applicable: the phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INF-01 | 10-01 | Installed plugin shows version, scope, source, skills | SATISFIED (source read as marketplace, D-02) | Truth 1 |
| INF-02 | 10-01 | Available plugin shows what an install would provide | SATISFIED | Truth 1 |
| INF-03 | 10-01 | Partially available or unavailable plugin names the reasons | SATISFIED | Truth 2 |
| INF-04 | 10-01 | `--fetch` reports a newer revision; bare info makes no request | SATISFIED | Truths 3, 6, 7 |
| INF-05 | 10-01 | Plugin not offered fails as not in manifest | SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps only INF-01..INF-05 to Phase 10.

### Review Findings

| ID | Disposition | Verified |
| --- | --- | --- |
| CR-01 | Fixed | Yes: `info.feature:33-35` republishes `2.0.0`, expects `1.0.0`; mutation confirms |
| WR-01 | Fixed | Yes: single probe in both git row builders; request tables state one pair; mutation confirms |
| WR-02 | Kept by decision | Comment at `info.ts:2539-2541` states the precedence; open for the user (below) |
| WR-03 | Fixed | Yes: title at `info.feature:75` |
| IN-01 | Fixed | Yes: catch arm uses `version: warmVersion` (`info.ts:2581`) |
| IN-02 | Deferred | Phase 9 |
| IN-03 | Fixed | Yes: `info.feature:213-245` |
| IN-04 | Not changed | Acceptable: pinned arm shares the same expression |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (added lines of the phase diff) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `test/orchestrators/plugin/info.test.ts` | ~8530 | `chmod(..., 0o000)` to make a manifest unreadable | Info | Would not block reads when run as root; CI and local runs are non-root (uid 1000), so the test is valid here |

### Human Verification Required

None. The WR-02 display policy is a product decision, not a verification item; it is listed below for the orchestrator.

### Gaps Summary

No gaps. Every success criterion has a passing scenario that fails under a plausible wrong implementation, and every review finding is fixed or dispositioned.

## For the orchestrator

- Deferred: a missing path-source directory reads `unsupported source` instead of `source missing` across info, install, and list, through the catch-all in `shared/probe-classifiers.ts`; shared with Phases 3 and 9, needs its own change.
- Deferred: `list` shows only the entry version for a fetched git plugin whose entry declares none (`list-candidate-row.ts`), Phase 9's surface.
- Decision for the user (WR-02): `info` shows a declared entry version for a warm git plugin, while install records `sha-<12hex>` (D-77-01); kept to preserve 12 existing info unit contracts. The user may want sha-always on warm git rows, which would also make `--fetch` show a new revision for entries that declare a version.
- Assumption (D-02): INF-01's "source" is read as the marketplace name and scope, because the plugin-info row has no source field (`PluginInfoRowBase`, `shared/notification-types.ts:926`); adding a source field would be a feature.
- Gaps: none.

---

_Verified: 2026-10-23T09:08:49Z_
_Verifier: Claude (gsd-verifier)_

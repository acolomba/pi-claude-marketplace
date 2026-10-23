---
phase: 16-git-plugin-copies-and-version-rule
verified: 2026-10-23T12:00:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/phases/16-git-plugin-copies-and-version-rule/16-01-PLAN.md"
  - ".planning/phases/16-git-plugin-copies-and-version-rule/16-01-SUMMARY.md"
  - ".planning/phases/16-git-plugin-copies-and-version-rule/16-02-PLAN.md"
  - ".planning/phases/16-git-plugin-copies-and-version-rule/16-02-SUMMARY.md"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "features/plugin/fetch.feature"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/git-source.feature"
  - "features/plugin/info.feature"
  - "features/plugin/prune.feature"
  - "features/step_definitions/plugin/fetch.steps.ts"
  - "features/step_definitions/plugin/git-source.steps.ts"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/clone-gc.test.ts"
  - "test/orchestrators/plugin/enable-disable.test.ts"
  - "test/orchestrators/plugin/git-source-probe.test.ts"
  - "test/orchestrators/plugin/install-clone-probe.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/install-outcome.test.ts"
  - "test/orchestrators/plugin/list-candidate-row.test.ts"
  - "test/orchestrators/plugin/mirror-checkout.ts"
  - "test/orchestrators/plugin/reinstall-clone-probe.test.ts"
  - "test/orchestrators/plugin/reinstall-flow.test.ts"
  - "test/orchestrators/plugin/shared.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/plugin/update-preflight.test.ts"
covered_digest: "v3:sha256:be2781608eaf387d262812ae0c3762beadbac9659e1577a385fa5d5105b78148"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 16: Git Plugin Copies and Version Rule Verification Report

**Phase Goal:** An installed git-source plugin runs exactly the code its record names, and every command reports a plugin's version the same way.
**Verified:** 2026-10-23T12:00:00Z
**Status:** passed
**Re-verification:** No. This is the first verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1 / GIT-01: after `fetch` refreshes an unpinned plugin's mirror, the installed plugin's files and the code a session runs stay unchanged until `update` or `reinstall` | VERIFIED | `install-clone-probe.ts:63-85` and `update-preflight.ts:228-258` call `materializePluginCommitCopy` after the mirror step and return the copy root, not the mirror. `fetch` and `info --fetch` are unchanged and only refresh the mirror. Scenario `fetch.feature` "A fetch leaves the installed plugin running the revision it installed until an update" passed in my run: the mirror holds revision 2, the record's `resolvedSource` is a `<url12>-<sha12>` copy at revision 1, and the session skill still reads 1.0.0. `clone-cache.test.ts` "a real per-commit copy holds the commit's tree with relative symlinks and no untracked file" runs real isomorphic-git, so the copy's work-tree content is checked (the CR-01 fix). |
| 2 | Plan 01: an unpinned git install records a per-commit copy `plugin-clones/<url12>-<sha12>/` as `resolvedSource`, never the mirror | VERIFIED | `materializePluginCommitCopy` (`clone-cache.ts:296-317`) keys `dest` on `pluginCloneKey(cloneUrl, sha)`. Step `runs revision {int}` in `git-source.steps.ts` asserts that the `resolvedSource` key matches `^[0-9a-f]{12}-[0-9a-f]{12}$`. It is used in fetch, git-source, and git-source-update scenarios, and all of them passed. |
| 3 | Plan 01: reinstall restores the copy at the recorded sha (copy, else from the mirror, else a clone) | VERIFIED | `reinstall-clone-probe.ts:53-64` calls `materializePluginCommitCopy` with `sha: recordedSha` for every git source. The old mirror-HEAD arm is removed. Unit tests "restores an unpinned source's copy at the recorded sha, not the moved mirror" and the reinstall-flow test "an unpinned reinstall copies the recorded commit from the warm mirror with no network call" passed. |
| 4 | SC-2 / GIT-02: clone cleanup keeps the per-commit copy of every installed plugin (and its URL's mirror) and deletes clones no installation uses, including fetch-warmed mirrors | VERIFIED | `clone-gc.ts:39-65` adds each live record key plus, for a `<url12>-<sha12>` key, its `<url12>` mirror. Scenario `git-source.feature` "Clone cleanup keeps an installed plugin's copy and mirror and removes a mirror no installation uses" passed: the fetch-warmed `ghp` mirror is gone and `urlp`'s mirror and copy remain. In `git-source-update.feature`, the scope holds only the mirror and the revision-2 copy after an update. Unit test `clone-gc.test.ts` "GIT-02: keeps the mirror of an installed per-commit copy and removes an unused mirror" passed. |
| 5 | SC-3 / VER-01: a git plugin that declares a version is recorded and shown with that version by `install`, `info`, and `list`, and one that declares none shows `sha-<12hex>` | VERIFIED | `shared.ts:1229-1270` implements the one rule: `resolveDeclaredPluginVersion` (plugin.json, then the entry), then `shaVersion(resolvedSha)`, then the content hash. It is wired into `install-outcome.ts:449-466`, `update-preflight.ts:303-318`, `info.ts:2540-2543` (warm not-installed row), and `list-candidate-row.ts:111-116`. Installed list and info rows read `record.version`, which install derives with the same rule. Scenario `git-source.feature` "A git-source plugin that declares no version is shown by its commit" passed (install, list, and info show `{ghp revision 2}`). The `info.feature` not-installed and installed git rows show the declared 1.0.0 or 2.0.0. The `shared.test.ts` cases "a git commit names the version when none is declared" and "a declared version wins over a git commit" passed. |
| 6 | SC-3 / VER-01: `update` still detects a new revision through the stored sha, and the full sha stays stored | VERIFIED | `update-preflight.ts:327-334` `isSameRevision` needs equal version AND equal `resolvedSha`. It is used at `:707` (disabled refresh) and `:951-954` (main path). The ST-9 guard in `update-swap.ts:589-591` also compares the sha. Scenario `git-source-update.feature` "Updating a git-source plugin to a new commit with the same declared version updates it" passed (`updated` 1.0.0 to 1.0.0, runs revision 2). The `update-preflight.test.ts` D-16-09 cases passed. `install-outcome.ts:1331` still persists the full `resolvedSha`. |
| 7 | SC-4: `npm run check` stays green | VERIFIED (attested) | The orchestrator reports that `npm run check` ran green on this exact tree just before commit `455a8d00`: 706/706 scenarios, direct coverage merged, exit 0. I was told not to re-run it. My own targeted runs on HEAD were also green (see Behavioral Spot-Checks). |

**Score:** 7/7 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `orchestrators/plugin/clone-cache.ts` | `materializePluginCommitCopy`, `copyMirrorAtCommit` | VERIFIED | Copies only `.git` with `verbatimSymlinks`, drops the index, checks out into an empty tree, and promotes by rename. Only NotFound and CommitNotFetched fall back to a clone. |
| `orchestrators/plugin/clone-gc.ts` | Keeps the mirror of a live per-commit key | VERIFIED | `PER_COMMIT_KEY` regex, wired in `deriveLiveCloneKeys`. |
| `install-clone-probe.ts`, `update-preflight.ts`, `reinstall-clone-probe.ts` | Callers record the copy | VERIFIED | Seams gained `materializePluginCommitCopy`, and the real seams bind it. |
| `git-source-probe.ts` | Reload migration reads the copy first, and the mirror only at the recorded HEAD | VERIFIED | `makeRecordedShaPresenceProbe:219-234`. |
| `shared.ts` | `resolvePluginVersion` with a sha tier, `resolveDeclaredPluginVersion` | VERIFIED | Imported by install-outcome, update-preflight, info, and list-candidate-row. |
| `enable-disable.ts` | WR-05 fix: enable pins to the recorded sha | VERIFIED | `recordedSourcePin` is spread into both enable `runInstallLedger` calls (`:415`, `:973`). Unit test "enable re-materializes the commit the record names" passed. |
| `features/step_definitions/plugin/git-source.steps.ts` | Steps for "declares no version" and "runs revision N" | VERIFIED | Both steps are used by passing scenarios. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `probeInstallClone` (unpinned) | `materializePluginCommitCopy` | `seam.materializePluginCommitCopy({ sha: mirror.resolvedSha })` | WIRED |
| `makeUpdateCloneProbe.probeUnpinned` | `materializePluginCommitCopy` | same, returns `copyRoot` | WIRED |
| `probeReinstallClone` | `materializePluginCommitCopy` | `sha: recordedSha` | WIRED |
| `deriveInstallVersion` / `deriveUpdateToVersion` | `resolvePluginVersion` | the sha is passed only for url, git-subdir, and github kinds | WIRED |
| `buildGitNotInstalledRow` / `resolveCandidateEntry` | `resolveDeclaredPluginVersion` + `shaVersion` | warm tree only | WIRED |
| `preparePluginUpdate` / `refreshDisabledPluginUpdate` | `isSameRevision` | unchanged gate | WIRED |
| enable branches | `runInstallLedger({ sourcePinOverride })` | `recordedSourcePin(record)` routes the probe to its pinned arm | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| install record `resolvedSource` | copy root | `materializePluginCommitCopy` → `resolveGitPluginRootWithSubdir` → `c.resolved.pluginRoot` (`install-outcome.ts:1323`) | yes | FLOWING |
| install record `version` | the version rule | `deriveInstallVersion` → `resolvePluginVersion` reads plugin.json under the copy root | yes | FLOWING |
| list and info candidate `version` | warm tree | `makePresenceProbe` → `presence.pluginRoot` / `resolvedSha` | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suites of every touched pair (clone-cache, clone-gc, shared, update-preflight, list-candidate-row, enable-disable, install-outcome, reinstall-clone-probe, install-clone-probe, git-source-probe, update-swap, info) | `node --test <12 files>` with HOME and PI_CODING_AGENT_DIR pointed at the scratchpad | 1054 pass, 0 fail, exit 0 | PASS |
| GIT-01, GIT-02, and VER-01 scenarios | `npx cucumber-js features/plugin/{fetch,git-source,git-source-update,info,prune}.feature` | 39/39 scenarios, 461/461 steps, exit 0 | PASS |
| Phase commits exist | `gsd-tools query verify.commits 7d95bf74 8bb2a5ab 2331f8b9 455a8d00` | valid | PASS |
| Upstream precedence (D-01) | Read the Claude Code 2.1.309 binary | Order is the manifest `version`, then catalog or installed `h.version`, then the git sha (12 hex; git-subdir adds `-<8hex path hash>`), then archive and others. This matches the rule. | PASS |

### Probe Execution

Step 7c: SKIPPED. The phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| GIT-01 | 16-01 | SATISFIED | Truths 1-3. Records made before this phase are the deferred migration (see For the user). |
| GIT-02 | 16-01 | SATISFIED | Truth 4. |
| VER-01 | 16-02 | SATISFIED | Truths 5-6. |

No orphaned requirements. REQUIREMENTS.md maps only GIT-01, GIT-02, and VER-01 to Phase 16. Their traceability rows still read "Pending". The orchestrator updates them when it closes the phase.

### Anti-Patterns Found

None. I found no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or placeholder markers in the added lines of the phase's non-planning files. I found no stub returns in the changed production code.

### Human Verification Required

None. Each behavior-dependent truth (copy isolation from the mirror, GC retention, same-version revision detection, enable pin) is exercised by a passing test.

### Gaps Summary

None block the goal. The items below are deferrals, recorded divergences, and behavior changes the user should know about. They are not unmet must-haves.

## For the user

- **WR-04 (deferred):** `fetch` and `info --fetch` refresh the mirror without the scope lock, while an install or update may copy `.git` out of it at the same time. The worst case is a checkout error on that install (it can be retried), not a half-updated tree. Decide whether `fetch` should take the state lock around the mirror refresh.
- **IN-01 (deferred):** a record made before this phase whose `update` comes back `unchanged` stays on the mutable mirror. Its next copy is unreferenced until the next cleanup. Decide whether an `update` should treat a mirror-backed `resolvedSource` as "not the same revision" so that it moves the record onto its copy.
- **IN-04 (deferred):** `copyMirrorAtCommit` duplicates the logic of `materializeMarketplaceTagClone`. Per the review, the tag clone's forced checkout also mishandles a directory that holds only a symlink. Consider one shared copy-and-checkout helper.
- **Pre-phase unpinned records:** an unpinned git install made before this phase still names the mirror as its `resolvedSource`. A `fetch` still changes its hooks and MCP code until the next real `update` or `reinstall` (or `enable`, which now pins and re-materializes it). Nothing migrates these records automatically. Decide whether a migration is wanted.
- **One-time `updated` row:** a record whose version is `sha-...` for a plugin that declares a version (made under D-77-01) reports `updated` once on the next `update`, from `sha-...` to the declared version, even with no new commit (D-11). Expect this on existing installs.
- **Parity divergences:** the project keeps the `sha-` prefix on commit versions (upstream uses the bare 12 hex). It does not add the `-<8hex>` path hash that upstream appends for git-subdir sources. Confirm that both stay recorded divergences.
- **Parity divergence (new finding):** upstream appends `-<sha12>` to a declared version for plugins of the `anthropic-plugin-directory` marketplace that pin a `sha` (`Y7`/`zKt` in the 2.1.309 binary). This project does not. Decide whether to record it as a divergence or close it.
- **`1.0.0 → 1.0.0` update row:** an update to a new commit at the same declared version renders `updated` with identical from and to versions (D-09). Users cannot see the commit change in that row. Decide whether the row should show the commit as well.
- **Path-source candidate rows:** list and info rows for a not-installed path-source plugin still show only the marketplace entry version, not plugin.json's (D-10 scoped this phase to git). So a path plugin can show one version before install and another after. Decide whether to extend the rule to path sources.
- **Edit outside the fetch stream's own phase:** `features/step_definitions/plugin/fetch.steps.ts` (the fetch stream module) was edited so that "the fetched copy" reads only the mirror. CONTEXT claims ownership for fetch.feature. Confirm that this cross-stream edit is acceptable.
- **WR-05 behavior change:** `enable` now passes the record's `resolvedSha` as `sourcePinOverride` (`enable-disable.ts`). This file is outside the phase's listed files. Enable now restores the recorded commit instead of the mirror's fresh HEAD. It also applies to a tag-pinned `path` dependency whose record carries a `resolvedSha`: that dependency now re-materializes its tag tree through `materializeMarketplaceTagClone`, instead of the live marketplace tree. For a pre-phase mirror-backed record, the pinned arm clones the commit over the network on enable when no copy exists, because it does not copy from the mirror. Review the change as a deliberate behavior change.
- **Cleanup timing:** a mirror that `fetch` warmed for a plugin that is not installed stays on disk until the next uninstall, update, or marketplace remove. Cleanup does not run after `fetch` or `install` (D-07). Confirm that this timing is acceptable.
- **REQUIREMENTS.md traceability:** GIT-01, GIT-02, and VER-01 still read "Pending" and `[ ]`. Mark them complete when the phase closes.

---

_Verified: 2026-10-23T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

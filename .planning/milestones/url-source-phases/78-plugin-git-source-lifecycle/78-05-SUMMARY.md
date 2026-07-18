---
phase: 78-plugin-git-source-lifecycle
plan: 05
subsystem: plugin-reinstall
tags: [git-source, reinstall, offline, clone-cache, recorded-sha, PURL-07]
status: complete
requires:
  - "orchestrators/plugin/clone-cache.ts (materializePluginClone, canonicalCloneUrl, resolveGitSubdirRoot)"
  - "orchestrators/plugin/install.ts (InstallCloneCacheSeam / makeInstallCloneProbe pattern mirrored)"
  - "domain/resolver.ts (resolveStrict + resolveGitPluginRoot seam, GitPluginRootResult)"
  - "persistence/state-io.ts (optional resolvedSha field)"
provides:
  - "ReinstallCloneCacheSeam interface (materializePluginClone only) exported from reinstall.ts"
  - "makeReinstallCloneProbe(seam, locations, recordedSha, cloneUrl) — recorded-sha offline probe"
  - "resolvedSha carry-forward in reinstall's updateStateRecord"
  - "resolvedSha preservation in clonePluginRecord"
affects:
  - "orchestrators/plugin/reinstall.ts (git-source plugins now reinstall offline from the recorded sha)"
tech-stack:
  added: []
  patterns:
    - "By-name clone-cache seam so reinstall.ts stays gate-clean (no gitOps token)"
    - "Recorded-sha pin (no resolvePluginPin / resolveRemoteRef) for offline warm-cache reinstall"
key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts"
    - "tests/orchestrators/plugin/reinstall.test.ts"
key-decisions:
  - "Reinstall pins from oldRecord.resolvedSha (D-78-02); never calls resolvePluginPin/resolveRemoteRef"
  - "ReinstallCloneCacheSeam exposes materializePluginClone only (reinstall does not re-resolve pins)"
  - "clonePluginRecord must preserve resolvedSha or the probe never sees the pin (Rule 1 bug fix)"
requirements-completed: [PURL-07]
coverage:
  - deliverable: "Offline warm-cache reinstall from the recorded sha (clone + resolveRemoteRef throw)"
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall.test.ts#a url-source reinstall completes on a warm cache with clone and resolveRemoteRef both throwing (offline)"
        status: pass
    human_judgment: false
  - deliverable: "resolvedSha / version / installedAt carry-forward on reinstall"
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall.test.ts#a git-source reinstall carries the recorded resolvedSha, version, and installedAt forward"
        status: pass
    human_judgment: false
  - deliverable: "Cold-cache re-materialize from the recorded sha, no ref re-resolution"
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall.test.ts#a cold-cache git-source reinstall re-materializes from the recorded sha without re-resolving the ref"
        status: pass
    human_judgment: false
  - deliverable: "git-subdir clone-root containment on reinstall"
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall.test.ts#a git-subdir reinstall honors clone-root subdir containment (pluginRoot under the clone root)"
        status: pass
    human_judgment: false
  - deliverable: "reinstall.ts carries zero gitOps surface (no-orchestrator-network gate)"
    verification:
      - kind: test
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
      - kind: command
        ref: "tsc --noEmit"
        status: pass
    human_judgment: false
duration: 12 min
completed: 2026-07-11
---

# Phase 78 Plan 05: Offline git-source reinstall from the recorded sha Summary

Made `reinstall` re-materialize a git-source plugin (url / git-subdir / github) from the state record's recorded `resolvedSha` (D-78-02), so PURL-07's offline guarantee holds unconditionally on a warm cache. Reinstall reaches `materializePluginClone` by name via a new `ReinstallCloneCacheSeam` — it never calls `resolvePluginPin`/`resolveRemoteRef`, so reinstall.ts stays in the no-orchestrator-network forbidden list and gate-clean.

## Accomplishments

- **`ReinstallCloneCacheSeam`** — new exported interface in `reinstall.ts` carrying `materializePluginClone` ONLY (not `resolvePluginPin`, since reinstall pins from the recorded sha). A test-only `cloneCacheSeam` field on `ReinstallPluginDeps` lets tests inject a mock-backed materialize.
- **`makeReinstallCloneProbe(seam, locations, recordedSha, cloneUrl)`** — a `resolveGitPluginRoot` callback that materializes the clone at the recorded sha, applies `resolveGitSubdirRoot` containment for git-subdir sources, and stamps `resolvedSha = recordedSha` on the materialized arm. No pin re-resolution anywhere.
- **`resolveInstallable` rewired** — now takes `{ entry, marketplaceRoot, locations, recordedSha, seam }`. For a git source (url/git-subdir/github) with a recorded sha it builds the probe from `canonicalCloneUrl(parsedSource)` and passes it to `resolveStrict`; a path source (or a git record predating the resolvedSha field) keeps the existing no-callback path.
- **`updateStateRecord` carry-forward** — the rewritten record now preserves `oldRecord.resolvedSha` via a conditional spread, alongside `version` / `installedAt`. Path/github-name records without a resolvedSha rewrite without a spurious field.
- **Four new offline reinstall test cases** — warm-cache-offline (clone + resolveRemoteRef throw → still reinstalled, both call logs empty), resolvedSha/version/installedAt carry-forward, cold-cache re-materialize (checkout pins the recorded sha, no ref re-resolution), and git-subdir containment.

## Task Commits

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | Add offline git-source reinstall test cases (RED) | 3c63d30a |
| 2 | Add ReinstallCloneCacheSeam + recorded-sha probe, inject at resolveInstallable | 49b08ab5 |
| 3 | Carry resolvedSha forward in updateStateRecord | fa7bbb5e |

## Verification

- `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` — 72/72 pass.
- `tsc --noEmit` — clean (exit 0).
- `eslint` + `prettier --check` on both changed files — clean.
- The `feat` and `fix` commit pre-commit hooks (npm typecheck + lint + format:check + test, `pass_filenames: false`) ran green.
- Offline contract proven behaviorally: the warm-cache test asserts `resolveRemoteRefCalls` empty AND `cloneCalls` empty with a GitOps stub whose clone AND resolveRemoteRef both throw.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] clonePluginRecord dropped resolvedSha, starving the probe**
- **Found during:** Task 2
- **Issue:** `runLockedReinstall` snapshots the old record via `clonePluginRecord(oldRecord)` and I pass `oldSnapshot.resolvedSha` into `resolveInstallable`. But `clonePluginRecord` did not copy `resolvedSha` (it predates the field), so `recordedSha` was always `undefined` — the git-source probe was never built and reinstall failed with "git source requires a clone-cache resolver".
- **Fix:** Added `...(record.resolvedSha !== undefined && { resolvedSha: record.resolvedSha })` to `clonePluginRecord`. This is required for both the probe (Task 2) and the carry-forward rewrite (Task 3), which reads `oldRecord.resolvedSha` from the same snapshot.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
- **Verification:** Debug harness confirmed the reinstall outcome flipped from `failed` to `reinstalled`; the full suite is green.
- **Commit:** 49b08ab5

### Plan Inaccuracy (noted, not a code deviation)

The plan's verification step reads `cd extensions/pi-claude-marketplace && npm run typecheck`, but the npm package (and its `typecheck`/`tsc` script) lives at the **repo root**. Typecheck was run from the repo root (`tsc --noEmit`) instead — clean. Same note as 78-02-SUMMARY.

**Total deviations:** 1 auto-fixed (1 bug: resolvedSha not cloned). **Impact:** the fix is the load-bearing precondition for the plan's feature; touches only the snapshot helper my change reads from.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-78-10 (Info disclosure: reinstall silently re-resolves HEAD) | mitigate | The probe pins from `oldRecord.resolvedSha` and calls `materializePluginClone` directly; `resolvePluginPin`/`resolveRemoteRef` are never called — proven by `resolveRemoteRefCalls` empty on the warm-cache test. |
| T-78-11 (Tampering: git-subdir escape on reinstall) | mitigate | The git-subdir arm reuses `resolveGitSubdirRoot` — the same clone-root-anchored `assertPathInside` containment install uses (PURL-03 / NFR-10). The git-subdir reinstall test asserts `pluginRoot = cloneRoot + subdir`. |
| T-78-12 (Tampering: gitOps token leaks into reinstall.ts) | mitigate | Seam-by-name import; the no-orchestrator-network gate (strips comments, greps `\bgitOps\b` / `platform/git` / `DEFAULT_GIT_OPS`) stays green. |

No new threat surface introduced (no new endpoints, auth paths, or schema changes; the seam adds no git surface to reinstall.ts).

## Known Stubs

None.

## Self-Check: PASSED

- Modified files exist on disk: reinstall.ts, reinstall.test.ts — confirmed.
- Commits exist: 3c63d30a, 49b08ab5, fa7bbb5e — confirmed in `git log`.
- `ReinstallCloneCacheSeam` + `makeReinstallCloneProbe` present and injected at `resolveInstallable`.
- resolvedSha carry-forward present in `updateStateRecord` and `clonePluginRecord`.
- Tests 72/72 pass; typecheck exit 0; architecture gate green.
- node_modules symlink (used for local typecheck/lint) removed; working tree clean.

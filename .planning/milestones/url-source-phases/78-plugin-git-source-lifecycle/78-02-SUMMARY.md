---
phase: 78-plugin-git-source-lifecycle
plan: 02
subsystem: plugin-clone-cache
tags: [refactor, extraction, git-source, containment, shared-helpers]
status: complete
requires:
  - "orchestrators/plugin/clone-cache.ts (materializePluginClone, resolvePluginPin)"
  - "orchestrators/plugin/install.ts (makeInstallCloneProbe git-subdir arm)"
  - "shared/path-safety.ts (assertPathInside, PathContainmentError)"
  - "shared/fs-utils.ts (pathExists)"
provides:
  - "canonicalCloneUrl(source) — pure url reconstruction, no network"
  - "resolveGitSubdirRoot(cloneRoot, subPath) — shared git-subdir containment"
affects:
  - "orchestrators/plugin/install.ts (now imports resolveGitSubdirRoot)"
  - "reinstall (Plan 05) and update (Plan 06) — future consumers of both helpers"
tech-stack:
  added: []
  patterns:
    - "Pure helper extraction to single-source url reconstruction"
    - "Shared containment helper moved to the seam both install and reinstall call"
key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
key-decisions:
  - "canonicalCloneUrl kept pure (no gitOps/resolveRemoteRef) so reinstall derives the clone url offline without triggering pin re-resolution"
  - "resolveGitSubdirRoot moved verbatim (body byte-identical) to preserve NFR-10 containment behavior exactly"
requirements-completed: [PURL-07]
coverage:
  - deliverable: "canonicalCloneUrl exported pure from clone-cache.ts; resolvePluginPin reuses it"
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#D-77-06 resolvePluginPin reconstructs the canonical github url"
        status: pass
      - kind: test
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#D-77-04 resolvePluginPin returns the git-subdir url verbatim"
        status: pass
    human_judgment: false
  - deliverable: "resolveGitSubdirRoot moved to clone-cache.ts; install.ts imports it with byte-identical behavior"
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/install.test.ts (104 tests, incl git-subdir escape / missing-subdir)"
        status: pass
      - kind: command
        ref: "tsc --noEmit"
        status: pass
    human_judgment: false
duration: 6 min
completed: 2026-07-11
---

# Phase 78 Plan 02: Extract canonicalCloneUrl and share resolveGitSubdirRoot Summary

Extracted two reuse-blocking helpers out of the install path into `clone-cache.ts`: a pure `canonicalCloneUrl(source)` url reconstructor (no network) and the git-subdir containment resolver `resolveGitSubdirRoot`, so reinstall (Plan 05) and update (Plan 06) can build offline recorded-sha probes without copying code and without `resolvePluginPin` firing a network `resolveRemoteRef`.

## Accomplishments

- **`canonicalCloneUrl(source)`** — new exported pure function in `clone-cache.ts`. Returns `https://github.com/<owner>/<repo>` for github sources, `source.url` otherwise. No `gitOps`, no `resolveRemoteRef`. `resolvePluginPin` now calls it for its `cloneUrl`, so the reconstruction is single-sourced (PURL-07).
- **`resolveGitSubdirRoot(cloneRoot, subPath)`** — moved verbatim from `install.ts` (was private) to `clone-cache.ts` as an exported function, with the identical body and `materialized | escapes | missing-subdir` return union (PURL-03 / NFR-10 clone-root-anchored containment).
- **`install.ts` rewired** — deletes the local definition and imports `resolveGitSubdirRoot` from `./clone-cache`; `makeInstallCloneProbe` calls it with the same arguments. Orphaned `assertPathInside` / `pathExists` imports removed (`PathContainmentError` retained — still used elsewhere in install.ts).

## Task Commits

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | Extract canonicalCloneUrl into clone-cache.ts, rewire resolvePluginPin | 43980932 |
| 2 | Move resolveGitSubdirRoot to clone-cache.ts, import in install.ts | 35834c3f |

## Verification

- `node --test tests/orchestrators/plugin/clone-cache.test.ts` — 14/14 pass (Task 1).
- `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/clone-cache.test.ts` — 104/104 pass (final).
- `tsc --noEmit` — clean (exit 0).
- Install-path behavior byte-stable: the git-subdir escape and missing-subdir install tests stay green after the move.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Orphaned imports after moving resolveGitSubdirRoot**
- **Found during:** Task 2
- **Issue:** After moving `resolveGitSubdirRoot` out of `install.ts`, its `assertPathInside` and `pathExists` imports became unused (would fail `noUnusedLocals`/lint). `PathContainmentError` remained used elsewhere.
- **Fix:** Dropped `assertPathInside` from the `path-safety` import and removed the `pathExists` import entirely; kept `PathContainmentError`.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
- **Verification:** `tsc --noEmit` clean; 104 tests pass.
- **Commit:** 35834c3f

### Plan Inaccuracy (noted, not a code deviation)

The plan's verification step reads `cd extensions/pi-claude-marketplace && npm run typecheck`, but the npm package (and its `typecheck`/`tsc` script) lives at the **repo root**, not under `extensions/pi-claude-marketplace/` (source files live there, but there is no package.json there). Typecheck was run from the repo root (`tsc --noEmit`) instead, clean. No code impact.

**Total deviations:** 1 auto-fixed (1 blocker: orphaned-import cleanup). **Impact:** none — cleanup was required for the typecheck/lint gate to pass and touches only imports my own change orphaned.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-78-04 (Tampering: resolveGitSubdirRoot path resolution) | mitigate | Preserved — body moved verbatim; `assertPathInside(cloneRoot, resolve(cloneRoot, subPath))` still returns `escapes` on `..`-bearing subPath. install.test.ts escape case green. |
| T-78-05 (Tampering: canonicalCloneUrl) | accept | Pure string reconstruction from parser-validated source fields; no injection surface. |

No new threat surface introduced (no new endpoints, auth paths, or schema changes; the extraction adds no git surface).

## Known Stubs

None.

## Self-Check: PASSED

- Modified files exist on disk: clone-cache.ts, install.ts — confirmed.
- Commits exist: 43980932, 35834c3f — confirmed in `git log`.
- `canonicalCloneUrl` exported and pure (0 gitOps/resolveRemoteRef in body) — confirmed by grep.
- `resolveGitSubdirRoot` exported from clone-cache.ts, no longer defined in install.ts — confirmed by grep.
- Tests 104/104 pass; typecheck exit 0.

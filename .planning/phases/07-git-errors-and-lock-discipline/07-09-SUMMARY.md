---
phase: 07-git-errors-and-lock-discipline
plan: 09
subsystem: plugin-info
tags: [info, fetch, git, classifier, scope-lock]

requires:
  - phase: 07-01
    provides: "classifyGitFailure(thrown, rule, remoteUrl?) and its { reason, frame? } result"
provides:
  - "info --fetch classifies a refused clone or mirror refresh with the plugin-clone rule: a host 404/410 is source missing, any other non-auth HTTP status network error (GLK-01)"
  - "on an unpinned source, info --fetch probes and builds its row, component reads included, in one withExistingScopeLock body; pinned --fetch and bare info take no lock (GLK-05)"
affects: [07-10, docs/output-catalog.md]

actuals:
  tokens: 6950
  tasks: 2
  commits: 2
plan_head_before: 95f90e91e8d56be4652619c1d5a02daf1a52fc3f
plan_head_after: 1b88debf3f6042f2445e61faefba70406f95ef18

tech-stack:
  added: []
  patterns:
    - "A probe-then-build helper that picks the probe, runs it, and hands its result to the row body, under the scope lock only on the unpinned --fetch arm"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/orchestrators/plugin/info.test.ts
    - features/plugin/info.feature

key-decisions:
  - "foldFetchOrProbeError is classifyGitFailure(err, { notFound: source missing })?.reason ?? narrowProbeError(err); no frame, because info rows have no cause slot (D-PL7-03)"
  - "runFetchLocked(locations, fetchCtx, gitSource, buildRow) chooses the fetch or presence probe, runs it, and passes the result to buildRow; it locks only when fetchCtx is set and the source is unpinned (D-PL7-07). Taking the probe choice into the helper removes the clone group fallow reported when each builder kept its own probe prologue"
  - "makeFetchProbe returns the bare pinned/unpinned probe and no longer locks"

requirements-completed: [GLK-01, GLK-05]

coverage:
  - id: D1
    description: "info --fetch reads a host 404 as source missing and a 503 as network error, on the not-installed and installed rows"
    requirement: GLK-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#GLK-01"
        status: pass
      - kind: e2e
        ref: "features/plugin/info.feature#Info with --fetch on a plugin the git host answers with 404 names it source missing"
        status: pass
    human_judgment: false
  - id: D2
    description: "unpinned info --fetch reads its row with the scope lock held; pinned --fetch and bare info read with no lock; the lock is free afterwards"
    requirement: GLK-05
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#GLK-05"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-27
status: complete
---

# Phase 7 Plan 09: info --fetch host answers and locked row read Summary

**`info --fetch` now reads a git host's HTTP answer the way `fetch` does: a 404/410 names the plugin `{source missing}` and any other non-auth status `{network error}`, where both used to fall through to `{unreadable}`. On an unpinned source, the mirror refresh and the row read, component files included, run in one body under the scope's state lock.**

## Performance

- **Duration:** about 17 min of work, plus three commit hooks of about 10 min each
- **Started:** 2026-10-27T07:26:34Z
- **Completed:** 2026-10-27T07:43:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `foldFetchOrProbeError` classifies through `classifyGitFailure` with the plugin-clone rule `{ notFound: "source missing" }`, then falls back to `narrowProbeError`. `info.ts` no longer imports `classifyGitTransportFailure`. It still imports nothing from `platform/git.ts` (BLOCK F passed in the hook's lint).
- `makeFetchProbe` returns the bare probe. A new module-private helper `runFetchLocked` picks the fetch or presence probe, runs it, and hands the result to the builder's row body. It runs that body under `withExistingScopeLock` only when `fetchCtx` is set and the source has no sha.
- `buildInstalledGitRow`: the probe, `resolveStrict`, and `buildResolvedInstalledRow` run in the helper's body. The body returns the recorded row on the cold and non-installable arms. The outer catch is unchanged: GHB-03 rethrow, `lockHeldRow`, the `--fetch` fold, and the silent bare-info degrade.
- `buildGitNotInstalledRow`: the probe and the whole row build run in the body. The inner row-build try/catch stays inside it, so a warm-tree read failure still folds to `remote` + `narrowProbeError`. Only probe and lock errors reach the outer catch (`lockHeldRow` / `remote` + `foldFetchOrProbeError`).

## Task Commits

1. **Task 1: info --fetch reads a host answer through the plugin-clone rule** - `ada24ee3` (fix)
2. **Task 2: the --fetch probe and the row build share one locked body** - `1b88debf` (fix)

## Verification

| Command | Exit | After |
|---|---|---|
| `node --test --test-name-pattern 'GLK-01' test/orchestrators/plugin/info.test.ts` | 0 (3 tests) | ada24ee3 |
| `npx cucumber-js features/plugin/info.feature` | 0 (15 scenarios) | ada24ee3 |
| `node --test test/orchestrators/plugin/info.test.ts` | 0 (228 tests) | ada24ee3 |
| `node --test --test-name-pattern 'GLK-05\|GIT-03' test/orchestrators/plugin/info.test.ts` | 0 (6 tests, the two GIT-03 cases unchanged) | 1b88debf |
| `node --test test/orchestrators/plugin/info.test.ts` | 0 (233 tests) | 1b88debf |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | 0 (100%) | 1b88debf |
| `npx cucumber-js features/plugin/info.feature` | 0 (15 scenarios, 135 steps) | 1b88debf |
| `npx cucumber-js` over the nine features that run `plugin info` (remove, marketplace update, git-source, info, partial-install, reinstall, update, update-rollback, usage-errors) | 0 (349 scenarios) | Task 2 tree |
| pre-commit hook `npm run check:commit` (check:static included) | Passed on both commits | both |
| `npm run fallow` (unpiped) | **0** | 1b88debf |
| `npm run typecheck` (unpiped) | **0** | 1b88debf |

Acceptance greps on `info.ts`: `classifyGitTransportFailure` 0 (baseline 3), `classifyGitFailure(` 1, `from "../../platform/git` 0, `withExistingScopeLock` inside `makeFetchProbe` 0 (baseline 1), `withExistingScopeLock(` 1 (the helper).

### Fails-before records

- Scenario "Info with --fetch on a plugin the git host answers with 404 names it source missing": with `info.ts` restored to 95f90e91, it failed on `plugin reasons` (the row read `unreadable`). With the change, it passes.
- Unit GLK-01 (404 not-installed, 503 not-installed, 404 installed): all three failed against 95f90e91's `info.ts`, each with `{unreadable}` in place of the expected reason.
- Unit GLK-05: with `info.ts` restored to the Task 1 commit (ada24ee3), the two unpinned cases failed (the reads saw the lock free). The pinned and bare-info cases passed there too, as intended: they pin behavior that did not change.

## Decisions Made

- The GLK-01 and the first three GLK-05 cases are table loops over `test()`. Each row compares the whole notification array.
- The GLK-05 reader spreads `NODE_READER` and wraps `readTextFile` with a `lockfile.check` before each real read. The cases assert that the set of observed values is `[true]` or `[false]`, because the read count is incidental. An empty set fails too, so each case proves at least one read.
- The bare-info GLK-05 case seeds a warm mirror with the file's `seedWarmMirror`, because the in-memory git fake does not write a `.git/HEAD` that the presence probe could read.

## Deviations

- **[Rule 2 - coverage] One extra unit case.** Moving the cold and non-installable returns into the locked body left the post-catch return of `buildInstalledGitRow` reachable only from a bare-info probe or read throw. No case covered that path, which used to share a coverage block with the cold path. The new case "D-78-04: bare info of an installed git plugin whose warm manifest cannot be read keeps the recorded row with no reason" fails the warm `plugin.json` read and pins the silent degrade: the recorded `(installed)` row with `components: not resolved` and no reason.
- **[Rule 3 - fallow dupes] Probe choice moved into the helper.** The first commit attempt of Task 2 failed the hook's `fallow dupes` on a new in-file clone group (`dup:b38bdced`): both builders repeated the probe selection, the `runFetchLocked` call, and the probe call. `runFetchLocked` now takes a `buildRow(presence)` body and runs the probe itself. The behavior is the same, and `fallow dupes` reports no group.
- Behavior note: in `buildGitNotInstalledRow`, `resolveDeclaredPluginVersion` now runs inside the outer try. Before, a throw from it left the builder. That helper catches its own read and parse errors, so no reachable throw changes its row.

## Out-of-line edits

None. Every file edited is in the plan's `files_modified`. In `info.ts`, only the fetch path changed: the import line, `makeFetchProbe`, the new `runFetchLocked`, `foldFetchOrProbeError`, and the probe-and-build parts of the two git row builders.

## Issues Encountered

- Each commit hook ran about 10 minutes, so both commits ran in the background and were read back by exit code. The first Task 2 attempt failed on `fallow dupes` and made no commit (see Deviations).

## For the orchestrator

- After this plan, `classifyGitTransportFailure` has production importers only outside `fetch.ts` and `info.ts` (the dependency tag probe, which 07-10 makes private). The export stays.
- `docs/output-catalog.md`'s `info --fetch` failure prose (404 as `source missing`, 5xx as `network error`) belongs to 07-10. This plan did not edit it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-07-18 is mitigated: the GLK-05 cases observe the lock during the row reads on the unpinned arm. T-07-19 holds: info rows carry only the reason token, with no URL or transport text.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- FOUND: test/orchestrators/plugin/info.test.ts
- FOUND: features/plugin/info.feature
- FOUND: ada24ee3 (ancestor of HEAD)
- FOUND: 1b88debf (ancestor of HEAD)

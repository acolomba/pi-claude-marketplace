---
phase: 09-plugin-package-dependencies
plan: "04"
subsystem: behavioral-tests
tags: [cucumber, npm, lockfile, update, reinstall]

requires:
  - "09-02: the loopback npm registry steps and the plugin packages step module"
  - "09-03: the D-PL9-03 local-folder note, installUpdatedPackages and the force rule"
provides:
  - "Scenarios for the D-PL9-03 local-folder note, the three Claude Code lockfile refusals, the package install on update, and the offline reinstall"
  - "Steps `the published plugin {string} of the marketplace {string} ships a package.json and the lockfile {string}` and `the npm cache is empty`"
affects: [09-05]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2
plan_head_before: eb07c41e03fd04f22ee31329885260624e6b76b7
plan_head_after: 949ff8c60c96f88c4f8c1733dd88b9a74ffc8bdf

tech-stack:
  added: []
  patterns:
    - "A scenario that proves npm did not run empties npm's cache first, so a run would have to make a registry request"

key-files:
  created: []
  modified:
    - features/plugin/package-dependencies.feature
    - features/step_definitions/plugin/packages.steps.ts

key-decisions:
  - "The reinstall scenario empties npm's cache under the sandbox HOME before the reinstall; without it a forced npm ci installs from the cache the install filled and makes no request"

requirements-completed: [PKD-01, PKD-02]

duration: 12min
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 04: Package Scenarios for Local Folders, Lockfiles, Update, and Reinstall Summary

**Four new scenarios, one of them a three-row Outline, cover the rest of the package behavior through the real `/claude:plugin` command. A plugin of a dir marketplace installs with the D-PL9-03 note naming `npm ci ...` for its folder `pkp`, and npm gets no request. yarn.lock, pnpm-lock.yaml, and bun.lockb each install with Claude Code's refusal line, word for word. An update to 2.0.0 fetches only `/pkd-dep/-/pkd-dep-2.0.0.tgz` and leaves pkd-dep 2.0.0 alone in node_modules. A reinstall with an empty npm cache makes no request and keeps pkd-dep 1.0.0.**

## Performance

- **Duration:** about 12 min (2026-10-27T04:47:47Z to 04:59:22Z)
- **Tasks:** 2 of 2
- **Files:** 0 created, 2 modified

## Accomplishments

- `packages.steps.ts`: a Given that writes package.json (`pkd-dep` 1.0.0) and one named lockfile through `writePublishedPluginFiles`, then reads both back. It fails on a lockfile name other than yarn.lock, pnpm-lock.yaml, or bun.lockb, so it cannot create a lockfile that npm or bun would run (T-09-20).
- `packages.steps.ts`: a Given `the npm cache is empty` that removes `{home}/.npm` and asserts that it is gone (see Deviation 1).
- `package-dependencies.feature`: the local-folder scenario, the refusal Outline (one untagged Examples block, columns `lockfile | note`, three rows), the update scenario, and the reinstall scenario.

## Task Commits

1. **Task 1: scenarios for the local-folder note and the lockfile refusals.** `f5d7880c` test(features): cover package notes for local folders and lockfiles
2. **Task 2: scenarios for the package install on update and the offline reinstall.** `949ff8c6` test(features): cover package installs on update and reinstall

Both commits passed the pre-commit hook (`npm run check:commit`).

## RED runs

Each edit was temporary. After each one, `git checkout -- <file>` restored it, and `git diff --quiet -- extensions` exited 0.

- **Task 1:** `packagesPhase,` dropped from the phase array in `install-outcome.ts`: `7 scenarios (7 failed)`, `77 steps (58 passed, 12 skipped, 7 failed)`. Each of the four new pickles failed at `Then the command reports these results:` with one result (the cascade) instead of two. The three 09-02 scenarios failed too, as expected.
- **Task 2 (a):** the two `installUpdatedPackages(...)` wraps in `materialize-latest.ts` unwrapped back to the bare `swapPluginUpdate` and `swapAfterSettle` returns: `9 scenarios (8 passed, 1 failed)`. The update scenario failed at `Then the npm registry receives these requests:`, because there was no request for `/pkd-dep/-/pkd-dep-2.0.0.tgz`.
- **Task 2 (b):** `installUpdatedPackages` passed `true` in place of `target.policy.skipSameRevision`, so every policy forces the install. The first run of the scenario as the plan wrote it passed: `9 scenarios (9 passed)`, so it was not RED (see Deviation 1). With `Given the npm cache is empty` added: `9 scenarios (8 passed, 1 failed)`, `106 steps (104 passed, 1 skipped, 1 failed)`. The reinstall scenario failed at `Then the npm registry receives no request` with a `GET /pkd-dep/-/pkd-dep-1.0.0.tgz`.

## Verification

| Check | Exit |
| --- | --- |
| T1 verify 1: feature run, `7 scenarios (7 passed)` | 0 |
| T1 verify 2: `npm run check:features`, then ESLint on packages.steps.ts | 0, 0 |
| T1 verify 3: extensions clean, subject, and the two files | 0 |
| T2 precondition: `npm --version` printed 11.20.0 | met |
| T2 verify 1: feature run, `9 scenarios (9 passed)` | 0 |
| T2 verify 2: `npm run check:features` | 0 |
| T2 verify 3: extensions clean, subject, and only the feature file | 1 (expected: the commit also holds packages.steps.ts, see Deviation 1) |

`SKIP=npm-check pre-commit run --files <both files>` exited 0 before each commit. I did not run the full `npm run check`, because plan 09-05 owns the phase gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The reinstall scenario as planned did not fail without the force rule**
- **Found during:** Task 2, RED (b)
- **Issue:** the plan expected a forced reinstall to make a GET for 1.0.0. npm keeps the tarballs it fetches in its cache under the sandbox HOME (`{home}/.npm`). The install in the scenario's Givens fills that cache, so a forced `npm ci` installs pkd-dep 1.0.0 from the cache and makes no request. The scenario passed with the force rule removed, which breaks the must_have "each new scenario fails with the change it covers removed".
- **Fix:** a new Given, `the npm cache is empty`, in packages.steps.ts. It removes `{home}/.npm` and asserts that it is gone. The reinstall scenario runs it after the install, so a run of npm would have to fetch. The `Before()` hook already empties the whole sandbox HOME between scenarios, so the step only moves that cleanup forward inside one scenario. The scenario title and its Then steps are as planned. The fileoverview of the step module now names npm's cache.
- **Files modified:** features/step_definitions/plugin/packages.steps.ts, features/plugin/package-dependencies.feature
- **Commit:** 949ff8c6. Task 2's verify 3 expected only the feature file in that commit, so it exits 1.

### Uncertain choices (for review)

1. **Step wording `the npm cache is empty`.** The step names npm's own cache in the user's HOME, which a user can see and clear (`npm cache clean`). It does not name a sandbox path. A reviewer may prefer it in `npm-registry.steps.ts`. I kept it in `packages.steps.ts` because that file is in the plan's `files_modified` and `npm-registry.steps.ts` is not.
2. **The refusal step's lockfile text is fixed prose** (`a lockfile the package step refuses by name`), because the step refuses these names before it reads them.
3. **The update scenario states only the npm request log.** The marketplace fetch also makes git host requests. The plan does not ask for them, and the git log has no compared-marker, so they go unchecked, as in the 09-02 url scenarios.
4. **Table alignment.** The new tables are aligned on their own widths. The header column of the 09-02 failure scenario has one pad space more than the new tables. I left that line as it was.

## Files outside files_modified

None. Task 2 also changed `features/step_definitions/plugin/packages.steps.ts`. That file is in the plan's `files_modified`, but not in Task 2's `<files>` (Deviation 1).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-09-20: each plugin file goes through `writePublishedPluginFiles`, and the lockfile step accepts only the three refused names. The cache step removes only `{home}/.npm` in the sandbox HOME. T-09-21: every RED edit was restored, and `git diff --quiet -- extensions` exited 0 before each commit. T-09-24: the dir-marketplace refusal scenarios start no registry and spawn no npm. Each scenario that can spawn npm starts the loopback registry first, and the local-folder, update, and reinstall scenarios state their request logs.

## Self-Check: PASSED

- FOUND: features/plugin/package-dependencies.feature
- FOUND: features/step_definitions/plugin/packages.steps.ts
- FOUND: .planning/phases/09-plugin-package-dependencies/09-04-SUMMARY.md
- FOUND: commit f5d7880c (ancestor of HEAD)
- FOUND: commit 949ff8c6 (ancestor of HEAD)

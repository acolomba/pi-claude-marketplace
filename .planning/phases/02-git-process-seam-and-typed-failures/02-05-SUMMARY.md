---
phase: 02-git-process-seam-and-typed-failures
plan: "05"
subsystem: platform
tags: [git, git-missing, cucumber, credentials, askpass, isomorphic-git]

requires:
  - phase: 02-git-process-seam-and-typed-failures (plan 02-02)
    provides: "`GitCommandError` with the `git-missing` kind, the `git missing` reason, and the cause row in `marketplace add`"
  - phase: 02-git-process-seam-and-typed-failures (plan 02-03)
    provides: "`NODE_GIT_PROCESS.locate()` in `platform/git-process.ts`, and the hardened `git credential` launch"
provides:
  - "The git-required gate: `clone`, `fetch`, `resolveRemoteRef`, and `listRemoteTags` in `platform/git.ts` call `NODE_GIT_PROCESS.locate()` first"
  - "`ScenarioWorld.usePiWithoutGit()` and the step `pi runs without git on its path`"
  - "`features/marketplace/without-git.feature` and `features/plugin/without-git.feature` (SG-PRC-06)"
  - "Two credential scenarios in `features/marketplace/git-source.feature` and their fixture `features/lib/user-git-programs.ts` (SG-PRC-02, SG-PRC-03)"
affects: [transport swap phase, failure-message wording phase]

actuals:
  tokens: 8977
  tasks: 3
  commits: 3
plan_head_before: 3cdab55d51e571fef90eafbfbd69383d49a33d37
plan_head_after: d095c9e9cdbb3e47def3e308ac559fc18e3f43d0

tech-stack:
  added: []
  patterns:
    - "A scenario Pi with a changed PATH value: `usePiWith({ ...run.piEnvironment, PATH: <scenario-owned empty directory> })`, which keeps the key set of Pi's environment"
    - "A recording stand-in for a user-configured git program: a `/bin/sh` script of shell builtins that appends each run's arguments to a record file created with it"

key-files:
  created:
    - features/marketplace/without-git.feature
    - features/plugin/without-git.feature
    - features/lib/user-git-programs.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - test/platform/git.test.ts
    - features/support/world.ts
    - features/step_definitions/git-host.steps.ts
    - features/marketplace/git-source.feature
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "The gate sits outside `networkCall`, so a missing git gets no fetched-URL cause, even when the GitHub base override rewrote the URL"
  - "The dir and file adds are one scenario each, not an Outline, because the feature rules reserve an Outline for three or more variants"
  - "The askpass step composes with an earlier credential-store step by appending to the sandbox `.gitconfig`, and its release restores the previous text"

patterns-established:
  - "A no-git scenario starts its own Pi through `usePiWithoutGit()`; the release stops that Pi, then removes the empty PATH directory"

requirements-completed: ["SG-PRC-06", "SG-PRC-02", "SG-PRC-03"]

coverage:
  - id: D1
    description: "The four network verbs of `platform/git.ts` reject with the `git-missing` GitCommandError before any request or write. The seven local verbs run with no git on PATH. A clone succeeds once PATH is restored in the same process."
    requirement: "SG-PRC-06"
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#SG-PRC-06: the git-required gate (6 cases; file 130/130 pass with marketplace-tag-probe.test.ts)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts (100%)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A url or github marketplace add with no git on Pi's PATH fails with `{git missing}` and the cause `Git is required to install marketplaces.`, writes no config, and sends no request"
    requirement: "SG-PRC-06"
    verification:
      - kind: e2e
        ref: "features/marketplace/without-git.feature#Adding a git marketplace with no git fails as git missing and sends no request (4 rows, adapter profile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "With no git, dir, file, and hosted marketplaces still add, and a local plugin still installs"
    requirement: "SG-PRC-06"
    verification:
      - kind: e2e
        ref: "features/marketplace/without-git.feature (dir, file, hosted scenarios); features/plugin/without-git.feature#Installing a plugin of a local marketplace with no git installs it"
        status: pass
    human_judgment: false
  - id: D4
    description: "With no git, a github, url, or git-subdir plugin install fails with `{git missing}` and the cause, records nothing, leaves no clone, and sends no request"
    requirement: "SG-PRC-06"
    verification:
      - kind: e2e
        ref: "features/plugin/without-git.feature#Installing a plugin from a <plugin source kind> source with no git fails as git missing and sends no request (3 rows)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A credential lookup runs neither the askpass program of the user's git config nor the credential helper of the project's own repository"
    requirement: "SG-PRC-02"
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#A url marketplace that needs a credential fails as authentication required without running the user's askpass program"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#A url marketplace that needs a credential fails as authentication required without asking the project's credential helper"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-11-23
status: complete
---

# Phase 2 Plan 05: Git-Required Gate and No-Git Scenarios Summary

**`platform/git.ts` now looks up system git before each clone, fetch, and remote listing. With no usable git, a git-source `marketplace add` or plugin install fails with `{git missing}` and the cause line `Git is required to install marketplaces.`, and sends no request. Path-source and hosted marketplaces keep working. Cucumber scenarios pin each case, and also pin that a credential lookup runs neither the user's askpass program nor the project's own credential helper.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-11-23T15:45:05Z
- **Completed:** 2026-11-23T16:09:13Z
- **Tasks:** 3
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `clone`, `fetch`, `resolveRemoteRef`, and `listRemoteTags` call `await NODE_GIT_PROCESS.locate()` as their first statement, outside `networkCall` (SG-PRC-06, D-SG-01). The local verbs stay ungated. The header no longer says that git cannot be missing.
- `usePiWithoutGit()` starts a scenario Pi whose PATH is one empty directory that the scenario owns. The step `pi runs without git on its path` calls it.
- Two new features run with no git on Pi's PATH. `Marketplace without git` has 7 scenarios: 4 url and github rows fail as git missing, and the dir, file, and hosted adds succeed. `Plugin without git` has 4: 3 git plugin source kinds fail, and a local plugin installs.
- In `git-source.feature`, an askpass scenario and a project credential-helper scenario pin the hardened credential environment of plan 02-03.

## Task Commits

1. **Task 1: a git-source marketplace add with no git fails as git missing** - `890b378` (feat)
2. **Task 2: local and hosted sources work, git-source plugins fail** - `0d18442` (test)
3. **Task 3: credential lookups run no user prompt** - `d095c9e` (test)

**Plan metadata:** the SUMMARY commit that follows these three.

## TDD evidence

The commit hook runs typecheck and every architecture test, so it rejects a commit that holds only failing tests. Each RED below ran locally against the old code. RED and GREEN were then committed together, one commit per task. `workflow.tdd_mode` is off, so no `test(...)` gate commit was needed. Every run used the adapter profile. None of these scenarios names an MCP server, so none carries an implementation tag.

**Task 1 RED, unit** (old `git.ts`; `node --test --test-reporter=tap --test-name-pattern "SG-PRC-06|D-SG-0|TAGS-01: the local" test/platform/git.test.ts`): exit 1, 6 tests, 1 pass, 5 fail. The clone and fetch cases failed on `assert.ok(error instanceof GitCommandError)`, because isomorphic-git rejected on its own. `resolveRemoteRef`, `listRemoteTags`, and the restore case failed with `Missing expected rejection (isGitMissingWithoutCause)`, because nothing checked for git. Semantic assessment: valid RED on the planned assertions. The local-verbs case passed in RED as a guard. It pins that the gate leaves those verbs alone.

**Task 1 GREEN, unit:** `test/platform/git.test.ts` and `test/orchestrators/plugin/marketplace-tag-probe.test.ts` pass, 130/130. Direct coverage of `platform/git.ts` is 100%.

**Task 1 RED, scenario** (`without-git.feature` with the old `git.ts` swapped in): 4 scenarios, 4 failed. Each one failed at `Then the result has these fields:`. The severity was `info` instead of `error`, and there was no summary row, because isomorphic-git cloned the marketplace with no git binary. Semantic assessment: valid RED. The gate is what makes the failure appear (RESEARCH F2).

**Task 1 GREEN, scenario:** `without-git.feature`, `git-source.feature`, and `url-source.feature` pass: 42 scenarios, 420 steps. typecheck, `check:features`, fallow, and ESLint are clean.

**Task 2 RED** (both `without-git` features with the old `git.ts`, at PLAN_BASE): 11 scenarios, 4 passed, 7 failed. The 3 plugin rows (github, url, git-subdir) failed at the fields step with severity `info` and needs reload `true`, because the plugin installed. The 4 marketplace git rows failed as in Task 1. The dir, file, hosted, and local-plugin scenarios passed in RED, as the plan expects. They pin that the gate does not cover every source.

**Task 2 GREEN:** 11 scenarios, 124 steps pass on the first run. Each git-source plugin row reads `git missing` with the cause. So neither `resolvePluginPin` nor the clone wraps the `GitCommandError` on its way to `classifyGitHostFailure`, and no fix was needed.

**Task 3 RED** (scratch worktree at `7d5c54d`, the parent of `e1d6fd3`, with this plan's scenario, step, world, and fixture files copied in; the worktree was removed afterwards with `git worktree remove --force`): 2 scenarios, 2 failed. Both failed at `Then the result has these fields:`, where the severity was `info` instead of `error`. The add succeeded: the askpass program, or the project's credential helper, answered `alice`/`s3cret`, and the clone went through. Each scenario has no other credential source. Semantic assessment: valid RED. The old `git credential` launch ran with `process.env` plus two variables and Pi's cwd, so git ran `core.askPass` and read the project's `.git/config`.

**Task 3 GREEN:** `git-source.feature` passes: 31 scenarios, 314 steps. typecheck, `check:features`, fallow, and ESLint are clean.

**Final run:** both `without-git` features and `git-source.feature` pass: 42 scenarios, 438 steps. `check:features` passes. Per the plan, `npm run check` was not run; the wave gate runs it.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - the gate on the four network verbs; header rewritten (D-SG-01 reverses D-21)
- `test/platform/git.test.ts` - `describe("SG-PRC-06: the git-required gate")`: 4 network verbs, the local verbs, and the restore case; helpers `isGitMissingWithoutCause` and `withoutGitOnPath`
- `features/support/world.ts` - `usePiWithoutGit()`
- `features/step_definitions/git-host.steps.ts` - `pi runs without git on its path`, the askpass and project-helper Givens, and two "has recorded no run" Thens
- `features/marketplace/without-git.feature` - new, 7 scenarios
- `features/plugin/without-git.feature` - new, 4 scenarios
- `features/marketplace/git-source.feature` - the askpass and credential-helper scenarios
- `features/lib/user-git-programs.ts` - new: writes, reads, and removes the recording askpass program and credential helper
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - one bullet for `usePiWithoutGit()`

## Decisions Made

- The gate runs before `networkCall`, so a missing git is not wrapped with a `FetchedUrlCause`. The unit cases run under the GitHub base override, so they prove this.
- The dir and file adds are one scenario each. The feature rules reserve a Scenario Outline for three or more variants, and a hosted source may never appear in an Outline.
- The project-repository Given lives in `git-host.steps.ts`, as the plan names, next to the other credential steps, and not in `project.steps.ts`.
- The fixture creates an empty record file together with the program, so reading the record needs no ENOENT branch. The only such branch is `readOptionalText` in the step module, which avoids a duplicate block for `fallow dupes`.

## Deviations from Plan

None - plan executed exactly as written. A type error (the `cache` field of `resolveTagOid`) and an ESLint blank-line finding in the new unit cases were fixed before the Task 1 commit, as part of writing those cases.

## Issues Encountered

- The session refuses shell command text that names a path containing `git` in a complex form, such as a multi-step Python edit of `platform/git.ts`, or an `eslint` call on `git-host.steps.ts` chained with other commands. Edits went through the Edit tool, and checks ran as separate commands or through scripts in the scratch directory.
- The pre-commit Prettier hook reflowed `features/step_definitions/git-host.steps.ts` on the Task 3 commit. The commit script restaged the file and the hooked commit passed. No hook was skipped.

## Note for the transport phase

The local verbs of `platform/git.ts` (`listTags`, `resolveTagOid`, `resolveRef`, `currentBranch`, `listRemotes`, `checkout`, `forceUpdateRef`) are ungated because they still run in-process with isomorphic-git. When they move to system git, a path-source marketplace's tag read (`orchestrators/plugin/marketplace-tag-probe.ts`, through `listTags` and `resolveTagOid`) will need git. SG-PRC-06's promise that path-source marketplaces work without git must be checked again then. The case `TAGS-01: the local verbs read and write a clone with no git on the path` in `test/platform/git.test.ts` is the unit pin that will fail first.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations hold. T-02-22: the gate rejects before any isomorphic-git call. The unit cases assert that the mocked HTTP client saw no request. The scenarios assert `the git host receives no request`, which also counts connections. T-02-23: only the four network verbs are gated. A unit case runs all seven local verbs with no git, and the dir, file, hosted, and local-plugin scenarios pass. T-02-24: every fixture writes only in the sandbox HOME and project directory, and the project repository is made through the hermetic git. Each Given registers its release. T-02-25: the recording programs live in the sandbox HOME. Their release removes them, and the `Before()` reset empties the sandbox. T-02-SC: nothing was installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SG-PRC-06 is visible end to end. The transport swap raises the same `git-missing` error from the same `locate()` call.
- The wave gate runs `npm run check` on the combined tree, with this plan and plan 02-04's `git-process.ts` changes together.

## Self-Check: PASSED

- FOUND: features/marketplace/without-git.feature, features/plugin/without-git.feature, features/lib/user-git-programs.ts
- FOUND: 890b378, 0d18442, d095c9e (each an ancestor of HEAD)
- Scratch worktree removed (`git worktree list` no longer shows it)

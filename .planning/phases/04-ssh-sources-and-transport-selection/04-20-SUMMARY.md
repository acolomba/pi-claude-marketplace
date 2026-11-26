---
phase: 04-ssh-sources-and-transport-selection
plan: 20
subsystem: github plugin clone transport
tags: [system-git, ssh, parity, github-source, gap-closure, cucumber]
status: complete

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-06/04-12: pluginCloneTransport as the one factory of every plugin GitHub clone plan; 04-14..04-17: clone notes recorded only after the plan exists; D-SG-17: `unsupported source` for a source address Claude Code refuses"
provides:
  - "isGitHubRepositoryFormat(repository) in domain/source.ts, over the same owner/repo constant as isGitSubdirShorthand"
  - "InvalidGitHubRepositoryError (readonly repository) in shared/errors.ts, with Claude Code's `Invalid GitHub repository format: <owner>/<repo>. Expected format: owner/repo`"
  - "pluginCloneTransport's plan rejects a github source whose <owner>/<repo> fails the pattern before it reads the force, any check, or the probe"
  - "classifyGitFailure (and classifyGitHostFailure, classifyGitSourceAccessFailure) read the refusal, also behind a cleanup leak, as `unsupported source`"
affects: [04-26]

estimate:
  tokens: 90000
  tasks: 2
actuals:
  tokens: 7763 # chars/4 over the realized diff (31,050 chars, 11 files)
  tasks: 2
  commits: 2
plan_head_before: 373e8e6501e8de9b75e8d1fb608d3ec54fe07006
plan_head_after: 07751e354332b99e3c493dccbe2f84e15e8ce0ed

tech-stack:
  added: []
  patterns:
    - "A refusal that upstream makes before it builds a clone URL sits in the plan factory, so the clone runner records no note and runs no attempt"

key-files:
  created:
    - .planning/phases/04-ssh-sources-and-transport-selection/04-20-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
    - test/domain/source.test.ts
    - test/shared/errors.test.ts
    - test/shared/git-failure-classifiers.test.ts
    - test/orchestrators/github-transport.test.ts
    - features/plugin/github-transport.feature
    - features/plugin/fetch.feature
    - .planning/PROJECT.md

key-decisions:
  - "The refusal checks `<owner>/<repo>` as Pi joins it for both clone URLs, in pluginCloneTransport's plan, before `context.force` is read: an invalid GitHub base override does not hide the refusal, as upstream's zHi check runs before PJt()"
  - "The predicate reuses the private GIT_SUBDIR_SHORTHAND constant (its doc now names KHi, Uze, and zHi); the constant keeps its name, so isGitSubdirShorthand does not change"
  - "The classifier arm sits right after the cleanup-leak unwrap, before the both-failed and GitCommandError arms; the widened union stays inside shared/git-failure-classifiers.ts (tsc asked no caller for a wider annotation)"
  - "The PROJECT.md D-SG-18 sentence lists the commands that report `unsupported source` and says enable does not yet, instead of `every plugin surface`, because enable's ladder classifies no clone failure (see Deviations)"

requirements-completed: [SG-SSH-04]

duration: 30min
completed: 2026-11-26
---

# Phase 4 Plan 20: Refuse a github repository that is not owner/repo Summary

A `github` plugin whose repository is not an `owner/repo` pair now fails at clone time with Claude Code's `Invalid GitHub repository format` message, before any probe, skip check, or git command, and install and fetch show it as `(failed) {unsupported source}`.

PLAN_BASE: `373e8e6501e8de9b75e8d1fb608d3ec54fe07006`

## Performance

- Started: 2026-11-26T17:45Z (first edit after the base commit at 17:44:37Z)
- Task commits: 18:00:59Z, 18:10:33Z
- Tasks: 2, files changed: 11

## Task Commits

1. Task 1 (tracer, TDD): `ed4fd6f` feat(github): refuse a github repository that is not owner/repo
2. Task 2 (TDD): `07751e3` feat(fetch): fail a github repository that is not owner/repo

The commit hook runs typecheck and every architecture test, so a commit with only the failing tests cannot pass it. Each task's RED was run locally and recorded below, and RED and GREEN share one `feat` commit (the 04-08 precedent).

## TDD Gate Compliance

### Task 1 RED

1. With no source change, `node --import ./scripts/isolated-pi-home.mjs --test test/domain/source.test.ts test/shared/errors.test.ts` failed to load both files: `SyntaxError: The requested module '.../domain/source.ts' does not provide an export named 'isGitHubRepositoryFormat'` and the same for `InvalidGitHubRepositoryError` (`tests 2, pass 0, fail 2`). This is a load failure, not an assertion RED, so the predicate and the error class were added next (pure data, no refusal) to get an assertion RED for the behavior.
2. With the predicate and error class only, `node --import ./scripts/isolated-pi-home.mjs --test --test-reporter=tap test/shared/git-failure-classifiers.test.ts test/orchestrators/github-transport.test.ts` exited 1 with `tests 159, pass 150, fail 9`:
   - the five `IN-A-01, upstream zHi: refuses a github repository that is not owner/repo before any check, with <no force | CLAUDE_CODE_PLUGIN_PREFER_HTTPS | the base override | an invalid base override | Windows>` cases: `Missing expected rejection.` (four), and for the invalid base, a rejection with `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme.`, which fails the `instanceof InvalidGitHubRepositoryError` check;
   - the four `IN-A-01 ... classifies a refused github repository ... under <the plugin-clone rule | the fetch rule>` rows: `deepStrictEqual` got `undefined` (plugin-clone rule) and `{ reason: "network error" }` (fetch rule) for `{ reason: "unsupported source" }`.
   - `gsd-tools check tdd-red-evidence` on the record (target `... with no force`): `RED_EVIDENCE_OK`, `target_test_failed`.
   - Semantic assessment: each target ran and failed on its planned assertion because the plan factory had no refusal and the classifier no arm. No load, fixture, or unrelated failure.
3. The install scenario `A github plugin whose repository is not an owner/repo pair is refused before any probe or clone` fails on PLAN_BASE's four source files (swapped in, then restored): the row reads `authentication required` with the both-transports cause chain, clone note `ssh-not-configured`, and clone URLs `git@github.com:evil:x/ghp.git` / `https://github.com/evil:x/ghp.git`, so the probe ran and git cloned.

### Task 1 GREEN

`node --import ./scripts/isolated-pi-home.mjs --test test/domain/source.test.ts test/shared/errors.test.ts test/shared/git-failure-classifiers.test.ts test/orchestrators/github-transport.test.ts test/orchestrators/plugin/install.messaging.test.ts`: `tests 654, pass 654, fail 0`. The scenario passes under the adapter profile (1 scenario, 16 steps). Direct coverage of the four sources (`npm run --silent test:coverage:direct -- <source>`) exits 0 for each, so each stays at 100%.

Tracer gate: the task's automated verify passed end to end on the committed tree (unit run, scenario, and the commit hook's `check:commit`), so Task 2 went ahead.

### Task 2 RED

- The fetch scenario `Fetching a github plugin whose repository is not an owner/repo pair fails as unsupported source and sends no request` fails on PLAN_BASE's sources: the row reads `source missing` with `404 on https://{git host}/evil:x/ghp.git, git clone --depth failed: repository-not-found, exit code 128, fetched https://{git host}/evil:x/ghp.git`, clone note `via-https`, so the fetch reached the git host.
- The two wrapper rows (`classifyGitHostFailure`, `classifyGitSourceAccessFailure`) passed when written, because Task 1 had already added the classifier arm; they pin the wrappers, and they cannot load on PLAN_BASE (no error class there).

### Task 2 GREEN

`node --import ./scripts/isolated-pi-home.mjs --test test/shared/git-failure-classifiers.test.ts test/orchestrators/plugin/fetch.test.ts`: `tests 153, pass 153`. `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/github-transport.feature features/plugin/fetch.feature`: 31 scenarios, 467 steps, all passed.

### REFACTOR

None.

## New scenarios

- `features/plugin/github-transport.feature`: "A github plugin whose repository is not an owner/repo pair is refused before any probe or clone" (routed Pi, denied ssh stand-in; the manifest step writes `"repo": "evil:x/ghp"`; the row has no clone columns, so no clone note was recorded; the user's ssh receives no launch and the git host no request).
- `features/plugin/fetch.feature`: "Fetching a github plugin whose repository is not an owner/repo pair fails as unsupported source and sends no request" (shared Pi, whose base override forces HTTPS; the git host receives no request and the project holds no git clones).

No existing scenario changed: `git diff --stat 373e8e6..HEAD -- features` lists only these two files, each with one added scenario.

## Plugin ladders (Task 2 step 1)

| Ladder | Route to `classifyGitFailure` | Reason shown |
|--------|-------------------------------|--------------|
| install (`install.messaging.ts::composeInstallFailureMessage`) | `classifyGitHostFailure(err)` -> `runtimeFailureReasons` | `unsupported source` (scenario) |
| install cascade rows (`install-cascade.messaging.ts`) | `classifyGitHostFailure(subject.error)` | `unsupported source` |
| fetch (`fetch.ts::narrowFetchFailure`) | `classifyGitFailure(err, { notFound, unknown: "network error" }, remoteUrl)` | `unsupported source` (scenario) |
| update (`update-preflight.ts::candidateFailure`; `update-flow.ts::classifyUpdateFailure` -> `untypedUpdateFailReason`) | `classifyGitFailure(error, plugin-clone rule, remoteUrl)`; `classifyGitFailure(primary, plugin-clone rule)` | `unsupported source` |
| reinstall (`reinstall-flow.ts` -> `materializeLatestVersion` -> `preparePluginUpdate` -> `candidateFailure`; `reinstall-record.ts::reinstallOutcomeFromRun` keeps `run.reasons`) | through update-preflight's `candidateFailure` | `unsupported source` |
| info --fetch (`info.ts::foldFetchOrProbeError`) | `classifyGitFailure(err, plugin-clone rule)` | `unsupported source` |
| apply (`reconcile/apply-outcomes.ts::classifyOrchestratorThrow`) | `classifyGitHostFailure(err)` | `unsupported source` |
| import (`import/execute.ts::runtimeFailureReason`) | `classifyGitHostFailure(error)` | `unsupported source` |
| enable (`enable-disable.messaging.ts::narrowEnableFailure`, used by `enable-disable.ts::enableFailedRow` and the orchestrated `enable-failed` arm) | does not reach it | see Deviations |

## Deviations from Plan

### Ladder that does not reach `classifyGitFailure`

**1. Enable classifies no clone failure (recorded, not edited, as Task 2 step 1 asks)**
- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` (`narrowEnableFailure`), read by `orchestrators/plugin/enable-disable.ts` (`enableFailedRow`, and the orchestrated `enable-failed` arm near line 3050).
- **What it shows:** an enable that re-clones a gone clone (D-SG-19) and meets the refusal ends `enable-failed`. `narrowEnableFailure` maps only ENOENT and the resolver's missing-source shape, so the standalone `enable` row is `(failed)` with no reason brace and the cause on the trailer, and the orchestrated outcome (apply's and import's enable steps) reads `unreadable`. Every other git failure of an enable re-clone reads the same today, so this is an existing gap of the enable ladder, not new to this plan. It only applies to a record installed before this change, because install now refuses the source.
- **Effect on the must-have truth:** "enable" in the truth's ladder list does not read `unsupported source`. The PROJECT.md sentence says so instead of claiming every surface.

### Auto-fixed issues

None. `tsc` asked no caller outside `shared/` for a wider annotation.

### Other

- The plan's whole-suite verification ran on the final tree (counts under "Suites").
- The optional test peers were not in this worktree's `node_modules/.cache/optional-peers`, so `node scripts/install-test-peers.mjs` ran once (the project's own script that `test:cucumber` and `test:integration` run; it installs the declared peer floors, no new package).

## Suites

All on the final tree (`07751e3`), each with `env -u GIT_CONFIG_COUNT`:

| Suite | Result |
|-------|--------|
| `npm run --silent check:static` | exit 0 (typecheck, lint, fallow, format, pairing, features check) |
| `npm run --silent test:modules` | exit 1, one failing test: `test/bridges/hooks/dispatch-exec.test.ts:1650` ("contains an async delegate rejection from its failing diagnostic sink", an unhandledRejection from the test at line 1485 under parallel load). The file run alone passes (118 of 118). It is in the hooks bridge, which this plan does not touch; it is the same sandbox flake family as the known `dispatch-exec.test.ts:39` baseline. The quiet reporter prints no totals. |
| `npm run --silent test:integration` | exit 0 |
| cucumber, adapter profile, `features` | 2398 scenarios: 2393 passed, 5 failed. The 5 are the known fd baselines of `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834). |
| cucumber, builtin profile, `features` | 260 scenarios, 260 passed |

The commit hook's `npm run check:commit` passed on both task commits.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-63 is mitigated as planned (the refusal precedes any URL, probe, skip check, git, or ssh launch; unit cases pin zero check calls under every force and on Windows, and both scenarios assert no ssh launch or git host request). T-04-64: the cause line holds only the manifest's own `owner/repo` value and goes through the existing cause-chain path.

## Orchestrator actions

The plan asks for no `gsd-tools windows append`. If the orchestrator records the enable deviation on the ledger, this is the command:

```bash
gsd-tools windows append --kind deviation --phase 04 --file extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts --description "[system-git] An enable that re-clones a github plugin whose repository is not owner/repo shows no unsupported source: narrowEnableFailure classifies no clone failure (IN-A-01, D-SG-18)"
```

## Next Phase Readiness

04-26 edits only the D-SG-22 row of PROJECT.md; this plan changed only the D-SG-18 row.

## Self-Check: PASSED

All modified files exist; commits `ed4fd6f` and `07751e3` are ancestors of HEAD; every acceptance grep meets its expectation; the Task 2 PROJECT.md hunk is on line 2614 (the D-SG-18 row) only.

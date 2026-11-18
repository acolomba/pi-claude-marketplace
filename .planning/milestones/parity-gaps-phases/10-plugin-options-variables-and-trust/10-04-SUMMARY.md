---
phase: 10-plugin-options-variables-and-trust
plan: "04"
subsystem: plugin-path
status: complete
tags: [path, project-trust, penv-01]
requires: ["10-01"]
provides:
  - "recomputePluginPath(cwd, projectTrusted) with the directory and metacharacter filter"
  - "the load passes its trust answer to the PATH recompute"
affects: [10-20, 10-21]
tech-stack:
  added: []
  patterns: ["the filter runs after the pure collectBinDirs, in its own async function"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/shared/session-env.ts
    - test/orchestrators/plugin-path.test.ts
    - test/index.test.ts
    - features/plugin/executables.feature
decisions:
  - "A dropped bin is debug-logged with its errno code (ENOENT, ENOTDIR), the text `not a directory`, or `holds a shell metacharacter`; a kept-despite-error bin logs the runtime's error message, which the owner case reads back from `stat` because Node releases word it differently."
  - "The `:` case is proved through `asAbsolutePluginRoot`, which already refuses a root holding the path delimiter before the filter runs."
metrics:
  duration: "~24 min"
  completed: 2026-11-15
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: 6ae0ad17c7c0e15633003e6803ae8b48a954d4d0
plan_head_after: b3a7fbc6
---

# Phase 10 Plan 04: PATH trust gate and existence filter Summary

The `PATH` recompute now takes the load's trust answer and leaves the project scope out when Pi does not trust the project, and it appends a plugin's `bin` only when `stat` says it is a directory and its path holds no shell metacharacter.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Leave the project scope out of PATH when the load's trust answer is false | d3a5b8f7 | plugin-path.ts, index.ts, plugin-path.test.ts, index.test.ts, executables.feature |
| 2 | Put a plugin's bin on PATH only when it is a directory with no shell metacharacter | b3a7fbc6 | plugin-path.ts, session-env.ts, plugin-path.test.ts, index.test.ts, executables.feature |

## Red and green runs

Task 1, "The bash tool does not find the executable of a project plugin in a project the user marked do not trust (PG-CORE-06)":
- Red on PLAN_BASE `6ae0ad17`: failed at `Then the model receives these calls:` with the actual `bash returned: greeted\n` against the expected `bash returned: absent\n`. 1 scenario (1 failed), 13 steps (12 passed, 1 failed).
- Owner cases red: 4 failed of 62. The three `D-PG10-02` cases in `plugin-path.test.ts` (the project bin was appended; the malformed project state was reported as `skipped: [{ scope: "project", reason: "... is not valid JSON ..." }]`; the untrusted-empty case materialized `PATH` and the ledger), and the `index.test.ts` case "D-PG10-02: leaves the project plugin's binaries off PATH when Pi does not trust the project, reading trust no more often" (`PATH` held `/usr/bin:<project>/vendored-plugin/bin`; the trust-read count was already 2).
- Green: the scenario passed (1 scenario, 13 steps). 62 of 62 unit tests passed. Direct coverage of `plugin-path.ts` and `index.ts` exited 0. `executables.feature` plus `project-trust.feature` under the adapter profile: 10 scenarios (10 passed), 162 steps.

Task 2, "Two enabled plugins, one with a bin folder, add one entry to PATH (PG-CORE-07)":
- Red after Task 1: failed at `Then the model receives these calls:` with the actual `bash returned: {home}/marketplaces/fixtures/plugins/demo/bin:{home}/marketplaces/fixtures/plugins/plain/bin` against the expected `bash returned: {home}/marketplaces/fixtures/plugins/demo/bin`. 1 scenario (1 failed), 14 steps (13 passed, 1 failed).
- Owner cases red: 13 failed of 108 (the three drop cases, the seven metacharacter cases, the `ELOOP` keep case, the two-plugin case, and the created-then-removed case). The directory, symbolic-link, and path-delimiter cases passed before the edit, as expected.
- Green: the scenario passed (1 scenario, 14 steps). 108 of 108 tests in `plugin-path.test.ts`, `index.test.ts`, and `session-env.test.ts` passed. Direct coverage of `plugin-path.ts`, `session-env.ts`, and `index.ts` exited 0. `executables.feature` under the adapter profile: 4 scenarios (4 passed), 53 steps. `npm run check:features` exited 0 with no "Feature gate failed".

## Other checks

- `npx tsc --noEmit -p .` and ESLint on the changed `.ts` files: exit 0. `npm run fallow`: exit 0.
- Regression runs under the adapter profile: `state-migration.feature` plus `project-trust.feature`, 18 scenarios (18 passed). The builtin profile selects no scenario of `executables.feature`.
- No other caller of `recomputePluginPath` exists. Every other test that compares `PI_CLAUDE_MARKETPLACE_PATH` is in `test/index.test.ts`; each one that expects an entry now seeds a real `bin` through `seedPluginBinDirectory`, and so does the recompute-refused case, so it still proves something.
- Both commits passed the hook.
- Acceptance greps: `recomputePluginPath(event.cwd, projectTrusted)` 1; `projectTrusted` in `plugin-path.ts` 3; `D-PG10-02` in `plugin-path.ts` 2 and in its test 3; `D-PG10-03` in `plugin-path.ts` 5 and in `session-env.ts` 1; `D-PG10-22\|D-PG10-03` in the test 9; `PG-CORE-07` in the feature 2. The `index.ts` diff adds no `isProjectTrusted` call, the `TRUST_READS_PER_DISCOVER` line is untouched, and the `session-env.ts` diff changes comment lines only.

## Lines for later plans

The `PATH` rule as implemented, for `docs/env-vars.md` (plan 10-21) and PENV-01 (plan 10-20):

- Each load computes the candidates `<pluginRoot>/bin` for every enabled record, first in the user scope, then in the project scope. The project scope is read only when the load's `ctx.isProjectTrusted()` answer is true. When the answer is false, the project's `state.json` is not opened, a malformed one gives no skipped-scope warning, and the ledger removes the project entries an earlier load appended (D-PG10-02).
- A candidate joins `PATH` only when it holds none of `:`, `"`, `'`, `$`, a backquote, a backslash, a newline, or a carriage return, and `stat`, which follows a symbolic link, says it is a directory. The character check is skipped where `path.sep` is a backslash. `ENOENT` and `ENOTDIR` drop the path. Any other `stat` error keeps it. There is no `stat` timeout (D-PG10-03, D-PG10-22).
- The check runs at each recompute, so a `bin` folder created after a load joins at the next `/reload`, and one removed leaves at the next `/reload`.
- With `PI_CLAUDE_MARKETPLACE_DEBUG=1`, each drop logs `[env] plugin PATH: dropped <bin>: <cause>` (cause `ENOENT`, `ENOTDIR`, `not a directory`, or `holds a shell metacharacter`), and each kept-despite-error path logs `[env] plugin PATH: kept <bin> despite a stat error: <message>`.
- This closes only the case where Pi answers "not trusted". A project that Pi trusts without asking is the gap D-LOC-01 accepts (D-PG10-01).

## Parent-owned lines

The parent may record these; this plan did not touch them.

- `10-VALIDATION.md`: "features/plugin/executables.feature: 'The bash tool does not find the executable of a project plugin in a project the user marked do not trust (PG-CORE-06)' and 'Two enabled plugins, one with a bin folder, add one entry to PATH (PG-CORE-07)' — both shown red, then green."
- REQUIREMENTS.md: PG-CORE-06 and PG-CORE-07 can be marked complete (behavior and scenarios landed; the records stay with plans 10-20 and 10-21).
- STATE.md decision: "The PATH recompute takes the load's trust answer and skips the project scope when it is false; a bin joins only when stat says it is a directory with no shell metacharacter in its path (D-PG10-02, D-PG10-03, D-PG10-22)."
- STATE.md decision: "A kept-despite-error bin logs the runtime's stat message; its owner case reads the wording back from stat because Node releases differ."

## Deviations from Plan

None that change the behavior. Three details:

1. The `:` metacharacter case runs through `recomputePluginPath` like the others, but on POSIX `asAbsolutePluginRoot` refuses a root that holds the path delimiter before the filter runs, so its log line is the existing invalid-root line. The filter's class keeps `:` verbatim from upstream.
2. The plan's behavior list asks one debug line for each dropped path, so a missing `bin` is logged too (debug-only output).
3. An extra owner case shows a `bin` created between two recomputes joins at the second and leaves at the third once removed (the "next /reload" truth).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-08: the untrusted-state owner case seeds a project `state.json` that is not valid JSON and asserts it is not read; the scenario shows `hello` absent. T-10-10: one owner case per character. T-10-11: the `ELOOP` case keeps the path, as accepted. T-10-SC: no package installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin-path.ts, features/plugin/executables.feature
- FOUND: d3a5b8f7, b3a7fbc6 (ancestors of HEAD)

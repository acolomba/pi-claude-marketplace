---
phase: 07-workflows
plan: 03
subsystem: testing
tags: [cucumber, workflows, pi-dynamic-workflows, arguments]
status: complete

requires:
  - phase: 07-workflows
    plan: 01
    provides: progressOf, sendWorkflowCommand, and the three run step texts
provides:
  - "features/workflow/run.feature: the seed run, the argument Outline (3 rows), and the failing-run negative control"
  - "step `the workflow run ends with the status {string} and the error {string}` in features/step_definitions/workflow/runs.steps.ts"
affects: [07-04, 07-05, 07-06]

estimate:
  tokens: 60000
  tasks: 2
actuals:
  tokens: 1900
  tasks: 2
  commits: 2
plan_head_before: a374c9241c338f04b8d43cc8ae6c465a78f908e0
plan_head_after: 79a9a9658238b2ef6d33db1f6faef8e6561b4287

tech-stack:
  added: []
  patterns:
    - "The run-ending Then steps share one module-private projection (`runOutcome`) of the turn's single run to `{ status, result, error }`"
    - "A JSON result is written in single quotes in the step, so the Examples cell holds the double-quoted JSON whole"

key-files:
  created: []
  modified:
    - features/workflow/run.feature
    - features/step_definitions/workflow/runs.steps.ts

key-decisions:
  - "Feature prose cites no decision ID (no feature file in the suite does); the feature names the Pi gap and the engine's argument object in words, and this SUMMARY maps them to D-CF7-01 and D-CF7-02"
  - "The Outline fixture is written through the generic file Given, so no new fixture writer was added to features/lib/workflow-files.ts"

requirements-completed: [WFL-02]

duration: 25min
completed: 2026-11-01
---

# Phase 7 Plan 03: Workflow run arguments and failing run Summary

A bridged workflow command hands its script the engine's argument object, pinned whole for three typed texts (D-CF7-02); a script that throws ends `failed` with `Error: Nope.` and no result; and the feature description names the missing run approval as a Pi gap (D-CF7-01), which every run step pins by failing on any dialog.

## Performance

- Duration: about 25 min (2026-11-01T14:08Z to 14:33Z)
- Tasks: 2 of 2
- Files: 2 modified

## Accomplishments

- `features/workflow/run.feature` (`Feature: Workflow run`), 5 scenarios:
  - Seed "Running a bridged workflow completes with the result its script returns": title and steps byte-identical; only the three description lines changed.
  - Outline "Typed text reaches the workflow script as the engine's argument object, because the engine runs the command itself" (D-CF7-02), fixture `workflows/echo.js` returning `JSON.stringify(args)`:
    | typed command | returned text |
    | --- | --- |
    | `/demo:echo first second who=Ada` | `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}` |
    | `/demo:echo` | `{"_":"","_raw":""}` |
    | `/demo:echo a=1 b= =c x=y=z tail` | `{"a":"1","b":"","x":"y=z","_":"=c tail","_raw":"a=1 b= =c x=y=z tail"}` |
  - "A workflow whose script throws ends failed with the error it threw" (negative control), fixture `workflows/nope.js` (`throw new Error("Nope.");` then `return "never";`): status `failed`, error `Error: Nope.`.
- New description: "A bridged workflow command runs the plugin's script in the workflow engine, which hands it the engine's argument object; Pi asks no approval first, unlike Claude Code in its manual permission mode (a Pi gap). A scripted model and a local marketplace stand in."
- `npx cucumber-js features/workflow`: 10 scenarios passed (4 listing, 1 lifecycle, 5 run). `npm run check:static` passed (typecheck, lint, lint:workflows, fallow including dupes and health, format:check, test:corresponding, check:features). `npm run check:features` passed after Task 1.

## Step text added (exact)

`the workflow run ends with the status {string} and the error {string}` (a `Then`, registered after the result `Then`). It compares `{ status, result: undefined, error }` with the projection of the turn's run. The three existing step texts and their behavior are unchanged: the result `Then` still compares `{ status, result, error: undefined }` and requires exactly one run among the turn's progress entries, now through the module-private `runOutcome(world)` that both run-ending `Then` steps call.

## Red proofs

1. Task 1, Outline row 1 expected Claude Code's value (the typed text as one string), 3 scenarios (2 passed, 1 failed):
   ```
   AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
   + actual - expected
     {
       error: undefined,
   +   result: '{"who":"Ada","_":"first second","_raw":"first second who=Ada"}',
   -   result: 'first second who=Ada',
       status: 'completed'
     }
   ```
2. Task 2, negative control expected the error `Nope.`, 1 scenario failed:
   ```
   AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
   + actual - expected
     {
   +   error: 'Error: Nope.',
   -   error: 'Nope.',
       result: undefined,
       status: 'failed'
     }
   ```
   Each then passed with its final literal.

## Literals versus RESEARCH

Every observed literal matched RESEARCH Q1 and Q2 (single-space form of the third row, as the plan specifies). The bridge installed `nope.js`, with its unreachable `return` after the `throw`, without a warning: the `the user has run` install step requires info payloads only and passed.

## Task Commits

1. Task 1, argument Outline (tracer): `cfa8c5c` test(workflows): pin the arguments a workflow script receives
2. Task 2, failing run: `79a9a96` test(workflows): pin a workflow run that fails

## Decisions Made

- The projection helper returns the whole `{ status, result, error }` record, so each `Then` is one `deepStrictEqual` and fallow dupes forms no clone group.
- The description keeps three lines by folding the stand-in sentence; it no longer says "ends with the value the script returns", which the seed title states.

## Deviations from Plan

None - plan executed exactly as written.

Environment notes (not deviations): the first precondition run of the seed failed at its second step under parallel load (four executors) and passed on the immediate rerun; the first `npm run lint` was killed (exit 137, out of memory) and passed on a lone retry.

## Parent lines

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Plans 07-04 and 07-05 can keep using the three existing run step texts unchanged; the new error `Then` is available to them. Plan 07-06 can cite the Outline for D-CF7-02 and the description for D-CF7-01 in `docs/workflows-compatibility.md`.

## Self-Check: PASSED

- FOUND: features/workflow/run.feature, features/step_definitions/workflow/runs.steps.ts
- FOUND commits: cfa8c5c, 79a9a96 (2 commits since `plan_head_before`, measured with `git rev-list --count`)

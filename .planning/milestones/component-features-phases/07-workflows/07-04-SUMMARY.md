---
phase: 07-workflows
plan: 04
subsystem: testing
tags: [cucumber, workflows, pi-dynamic-workflows, companion-missing, pi-settings]
status: complete

requires:
  - phase: 07-workflows
    provides: "plan 07-01's shared workflow steps (`pi offers no workflow commands`) and the seed run steps"
provides:
  - "features/workflow/companion-missing.feature: WFL-04, the missing-engine marker at warning and info (WDEP-02), the later-loaded engine running the workflow with no reinstall, and the negative control"
  - "features/step_definitions/workflow/companion-missing.steps.ts: the step that adds the engine's package to Pi's user settings"
affects: [07-05, 07-06]

actuals:
  tokens: 1667
  tasks: 2
  commits: 2
plan_head_before: a374c9241c338f04b8d43cc8ae6c465a78f908e0
plan_head_after: 3e43fe7db0a7306f256ed9a56a6e7f68975b55f4

tech-stack:
  added: []
  patterns:
    - "Loading a companion later: add its package root to `{agent dir}/settings.json` `packages`, then start a new session, which stands in for `/reload`"
    - "A step that edits a settings file shared by the worker's Pis merges into it and restores the exact text it found at release"

key-files:
  created:
    - features/workflow/companion-missing.feature
    - features/step_definitions/workflow/companion-missing.steps.ts
  modified: []

key-decisions:
  - "The settings step merges a `packages` member into the existing settings file instead of writing a new file with `wx`: every profile Pi already holds `{\"retry\":{\"enabled\":false}}` there, written by the world's `set_auto_retry` call"
  - "The step fails when the file already lists `packages`, so it never replaces packages it did not write, and its release restores the found text (or removes the file when there was none)"

requirements-completed: [WFL-04]

duration: 45min
completed: 2026-11-01
---

# Phase 7 Plan 04: Workflow companion missing Summary

Without the workflow engine, installing a plugin with a workflow reports `requires pi-dynamic-workflows` at `warning` and `list` reports it at `info` (WDEP-02). Once Pi's user settings list the engine's package, a new session runs `/demo:hello` to `completed` with `Hello from demo.`, with no reinstall. A negative control shows that without the settings entry no workflow command appears.

## Performance

- Duration: about 45 min, including two out-of-memory retries of the lint warm-up under the siblings' load
- Tasks: 2 of 2
- Files: 2 created

## Accomplishments

`features/workflow/companion-missing.feature` (`Feature: Workflow companion missing`), 4 scenarios:

1. "Adding the engine to pi's settings after the install runs the workflow in a new session with no reinstall" (WFL-04): a profile Pi with no companion, the install `which warned`, the settings step, a new session, then `/demo:hello` ends `completed` with `Hello from demo.`.
2. "Installing a plugin with a workflow without the engine reports that it requires pi-dynamic-workflows" (WDEP-02), on the run's shared Pi: `cascade | warning | true | A plugin operation needs attention.` and the row `fixtures | user | demo@fixtures | demo | installed | requires pi-dynamic-workflows | user | 1.0.0`.
3. "Listing plugins without the engine reports the requirement as information" (WDEP-02), on the shared Pi: fields `kind cascade`, `severity info`, `needs reload false`, `tally label Plugin list`, `tally failures 0`, `tally warnings 0`, `tally success count 1`; the same row.
4. "Without the engine, a new session offers no workflow command" (negative control): profile Pi, install, new session, `pi offers no workflow commands`.

New step text (exact), in `features/step_definitions/workflow/companion-missing.steps.ts`:

- `the user has added the pi-dynamic-workflows package to pi's settings`

Verification:

- `npx cucumber-js features/workflow/companion-missing.feature`: 4 scenarios passed (42 steps, seed 66090).
- `npx cucumber-js features/workflow`: 10 scenarios passed (108 steps, seed 889084). This worktree holds only wave 1's files plus this plan's, so the siblings' scenarios were not part of that run.
- `npm run check:static`: passed after Task 1 (typecheck, lint, lint:workflows, fallow with dupes and health, format:check, test:corresponding, check:features). Task 2 changed only the feature file; `npm run check:features` passed after it, and the commit hook's `check:commit` passed for both commits.
- Acceptance greps: `^Feature: Workflow companion missing$` 1; step text 1; `onRelease` 1; `^  Scenario:` 4; `| requires pi-dynamic-workflows |` cells 2; `pi offers no workflow commands` 1; no U+2014 in either file. `flag: "wx"` prints 0, see Deviations.
- `git diff --name-only a374c92..HEAD` lists only the two plan files (and this SUMMARY after its commit).

## Red proofs

1. Task 1, tracer without the settings step (seed 128814), 1 scenario failed:
   ```
   When the user runs the workflow command "/demo:hello"
     AssertionError [ERR_ASSERTION]: {"id":"r8","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
     + 'started'
     - 'handled'
   ```
   Pi answered the prompt with a model turn, because no engine registered the command.
2. Task 2, install severity written as `info`:
   ```
   Then the command reports these results:
         'cascade',
   +     'warning',
   -     'info',
         'true',
         'A plugin operation needs attention.'
   ```
3. Task 2, list severity written as `warning`:
   ```
   Then the result has these fields:
         'severity',
   +     'info'
   -     'warning'
   ```
4. Task 2, negative control with the settings step added:
   ```
   Then pi offers no workflow commands
   + [ [ '/demo:hello', 'Says hello.' ] ]
   - []
   ```
   That run: 4 scenarios, 1 passed (the tracer), 3 failed. Each then passed with its final value.

## Literals versus RESEARCH

Every observed literal matched RESEARCH Q3: install `cascade | warning | true | A plugin operation needs attention.`, list `info` with `tally success count 1`, the row `fixtures | user | demo@fixtures | demo | installed | requires pi-dynamic-workflows | user | 1.0.0`, and the run's `completed` / `Hello from demo.`. The new session after the settings edit reported no non-info payload, as measured. One measurement differed: RESEARCH said the sandbox agent directory holds only `trust.json` at that point; with the harness's profile Pi it also holds `settings.json` (see Deviations).

A new session stands in for `/reload` (P7-DC-06 item 1): Pi's RPC mode cannot run the `/reload` builtin, and RPC `new_session` re-reads Pi's settings and extensions as `/reload` does.

## Task Commits

1. Task 1, tracer: `c83f615` test(workflows): run an installed workflow once the engine loads
2. Task 2, marker and negative control: `3e43fe7` test(workflows): pin the missing workflow engine marker

## Decisions Made

- The settings step merges the `packages` member into the existing file, the way `pi install` adds a package to existing settings, and keeps the other members.
- The marker scenarios run on the run's shared Pi with no profile `Given`, as the plan says; the shared Pi never loads the engine.
- No `Background:`: the four marketplace `Given`s are in every scenario, but two scenarios start a profile Pi first, and the sibling workflow features state the setup in each scenario too.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `{agent dir}/settings.json` already exists when the settings step runs**
- Found during: Task 1, the first green run
- Issue: the step failed with `EEXIST: file already exists, open '/tmp/pi-cm-features-cbCfuN/agent/settings.json'`. The file held `{"retry":{"enabled":false}}`: `usePiWithProfile` in the frozen `features/support/world.ts` sends RPC `set_auto_retry` with `enabled: false`, and Pi saves that choice to the user settings. RESEARCH's probe did not make that call, so it saw only `trust.json`. A `wx` write cannot work in any profile-Pi scenario.
- Fix: the step reads the file (or treats a missing file as `{}`), asserts it has no `packages` member (so it never replaces packages it did not write), writes the merged object, registers `onRelease` to restore the exact text it found (or remove the file when there was none), and asserts the parsed file equals the merged object. The T-07-09 mitigation holds: the shared Pi sees the original settings again after release.
- Effect on acceptance: `grep -c 'flag: "wx"'` prints 0, not 1. The intent of that criterion (never overwrite an existing file blindly; remove the entry at release) is kept by the `packages` assertion and the restoring release.
- Files modified: `features/step_definitions/workflow/companion-missing.steps.ts`
- Commit: `c83f615`

Otherwise the plan ran as written. No product bug was found; `shared/concerns/soft-dep.ts` is unchanged.

## Parent lines

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The T-07-09 mitigation changed shape (merge and restore instead of `wx` and remove), as recorded under Deviations; the surface is the same file.

## Next Phase Readiness

`the user has added the pi-dynamic-workflows package to pi's settings` is a verb-module step used only by this feature. If another plan needs it, it moves to a workflow topic module in a commit of its own (D-08).

## Self-Check: PASSED

- FOUND: features/workflow/companion-missing.feature, features/step_definitions/workflow/companion-missing.steps.ts
- FOUND commits: c83f615, 3e43fe7 (2 commits since `plan_head_before`, measured with `git rev-list --count`)

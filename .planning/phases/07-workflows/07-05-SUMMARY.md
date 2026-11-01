---
phase: 07-workflows
plan: 05
subsystem: testing
tags: [cucumber, workflows, pi-dynamic-workflows, lifecycle, stale-command]
status: complete

requires:
  - phase: 07-workflows
    provides: "plan 07-01's listing, empty-listing, no-run, and notices steps, and its stale-notice seed scenario"
provides:
  - "features/workflow/lifecycle.feature: WFL-05 removal (uninstall, disable), re-enable, and replacement (same-name and renaming update), 11 scenarios behind one Background"
affects: [07-06]

actuals:
  tokens: 2100
  tasks: 3
  commits: 3
plan_head_before: a374c9241c338f04b8d43cc8ae6c465a78f908e0
plan_head_after: 8067eb7be771ecc837a455e2110c343b34ff2db5

tech-stack:
  added: []
  patterns:
    - "A lifecycle feature puts the installed plugin and a fresh session in a Background; each scenario adds only the verb it proves"
    - "An update scenario re-offers the plugin and replaces the workflow script through the generic file Given, because the workflow Given cannot overwrite"

key-files:
  created: []
  modified:
    - features/workflow/lifecycle.feature

key-decisions:
  - "The Background holds the profile Pi with the engine, the dir marketplace, demo 1.0.0 with the hello workflow, the user-scope add, the install, and a new session; every one of the 11 scenarios needs all of them"
  - "The renaming update's results and rows run as the scenario's When; the new-session scenario reuses it as a Given with `, which warned`"

requirements-completed: [WFL-05]

duration: 25min
completed: 2026-11-01
---

# Phase 7 Plan 05: Workflow lifecycle Summary

Uninstall and disable report the lingering workflow command (`stale workflow command`, WLIF-06) and the engine refuses it in the same session; enable brings it back in a new session; an update that keeps the name runs the new script at once but keeps the old description until a new session; an update that renames the workflow reports the stale command and a new session offers only the new name.

## Performance

- Duration: about 25 min (from 14:04Z to 14:29Z on 2026-11-01)
- Tasks: 3 of 3
- Files: 1 modified

## Accomplishments

`features/workflow/lifecycle.feature` grew from 1 scenario to 11, with one `Background:` of `Given` steps only. Plan 07-01's scenario keeps its title, its uninstall `Given`, its `When`, and its `Then`; only its repeated Givens moved.

1. Running a workflow command after its plugin is uninstalled shows the engine's notice, because pi keeps the command until a new session (07-01, kept)
2. Uninstalling a plugin with a workflow reports that its command lingers until a new session
3. A new session after the uninstall offers no workflow command (negative control)
4. Disabling a plugin with a workflow reports that its command lingers until a new session
5. Running a workflow command after its plugin is disabled shows the engine's notice, because pi keeps the command until a new session
6. Enabling a disabled plugin runs its workflow again in a new session
7. Updating a plugin runs the new script of its workflow at once, because the engine reads the script when the command runs
8. The session that ran the update still lists the old description, because pi cannot change a command it already offers
9. A new session after an update lists the new description of its workflow
10. Updating to a version that renames the workflow reports that the old command lingers until a new session
11. A new session after a renaming update offers only the new workflow command

Verification: `npx cucumber-js features/workflow/lifecycle.feature` 11 scenarios passed (148 steps); `npx cucumber-js features/workflow` 16 scenarios passed (4 listing, 11 lifecycle, 1 run seed); `npm run check:features` passed after each task; `npm run check:static` passed before the first commit (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). No step module was added or edited.

## Red proofs

Each new scenario failed once with one wrong literal, then passed with its final value.

Task 1 run: 3 scenarios (1 passed, 2 failed).

1. Uninstall rows, status `installed`:
   ```
                 'demo',
           +     'uninstalled',
           -     'installed',
                 'stale workflow command',
   ```
2. New session after uninstall, with the uninstall `Given` left out:
   ```
   Then pi offers no workflow commands
           + [ [ '/demo:hello', 'Says hello.' ] ]
           - []
   ```

Task 2 run: 6 scenarios (3 passed, 3 failed).

3. Disable rows, status `uninstalled`:
   ```
           +     'disabled',
           -     'uninstalled',
   ```
4. Notice after disable, severity `error`:
   ```
           +     'warning',
           -     'error',
   ```
5. Enable then run, result `Hello.`:
   ```
           +   result: 'Hello from demo.',
           -   result: 'Hello.',
               status: 'completed'
   ```

Task 3 run: 11 scenarios (6 passed, 5 failed).

6. Same-name update then run, result `Hello from demo.`:
   ```
           +   result: 'Hello 2.',
           -   result: 'Hello from demo.',
   ```
7. Same-session listing after update, description `Says hello again.`:
   ```
           +     'Says hello.'
           -     'Says hello again.'
   ```
8. New-session listing after update, description `Says hello.`:
   ```
           +     'Says hello again.'
           -     'Says hello.'
   ```
9. Renaming update, severity `info` (the rows step was skipped in this run; it passed on the green run):
   ```
           +     'warning',
           -     'info',
   ```
10. New-session listing after renaming update, command `/demo:hello`:
    ```
           +     '/demo:greet',
           -     '/demo:hello',
    ```

## Literals versus RESEARCH

Every observed literal matched RESEARCH Q5: uninstall and disable each give one `cascade | warning | true | A plugin operation needs attention.`; the rows `uninstalled` and `disabled` with `stale workflow command` at `1.0.0`; the engine notice `warning | /demo:hello is not available in this project -- reload the session to drop the stale command.` after disable as after uninstall; enable in a new session runs `Hello from demo.`; a same-name update runs `Hello 2.` in the same session while the same session lists `Says hello.` and a new session lists `Says hello again.`; a renaming update gives `cascade | warning | true` and the row `updated | stale workflow command | user | 1.0.0 | 1.1.0`, and a new session lists only `/demo:greet | Greets.`. Every Background `Given the user has started a new pi session` reported only info payloads, so no scenario needed the `When the user starts a new pi session` fallback.

## Task Commits

1. Task 1 (tracer), uninstall: `54fc959` test(workflows): retire a workflow when its plugin is uninstalled
2. Task 2, disable and enable: `01271f0` test(workflows): retire and restore a workflow with disable and enable
3. Task 3, update: `8067eb7` test(workflows): replace a workflow when its plugin updates

`commits: 3` is measured with `git rev-list --count a374c92..8067eb7` before this SUMMARY's own commit.

Tracer gate (Task 1): auto mode off and `human_verify_mode` at its `end-of-phase` default with an automated-only `<verify>`, so the gate re-ran the verify (3 scenarios passed, `check:features` passed) and continued.

## Decisions Made

- The Background holds every Given that all 11 scenarios need, as the cucumber `features.md` "Background" rule allows; each scenario's verb stays in the scenario.
- The two renaming-update scenarios repeat the re-offer and the script `Given`s rather than sharing them, because the same-name update scenarios need a different script and a Background would move each scenario's point out of it.

## Deviations from Plan

None - plan executed exactly as written.

Environment note: the worktree isolation guard refused a compound shell command that wrote the plan ledger into the git dir, so the plan base was recorded in the scratch folder instead (`a374c92`, equal to the spawn-time HEAD that the branch check asserted). No tracked file was affected.

## Parent lines

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

WFL-05 is proven through what Pi reports after each verb. `lifecycle.feature` touches no shared step module or helper, so it merges independently of plans 07-02, 07-03, and 07-04.

## Self-Check: PASSED

- FOUND: features/workflow/lifecycle.feature
- FOUND commits: 54fc959, 01271f0, 8067eb7 (ancestors of HEAD)
- `git diff --name-only a374c92..8067eb7` lists only `features/workflow/lifecycle.feature`

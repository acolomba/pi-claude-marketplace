---
phase: 07-workflows
plan: 01
subsystem: testing
tags: [cucumber, workflows, pi-dynamic-workflows, registry-probe]
status: complete

requires:
  - phase: 01-harness
    provides: profile Pi with companions, registry probe, the listing When, the workflow seed and fixture writer
provides:
  - "features/workflow/listing.feature: WFL-01 listing, the meta-name rule, the WNAM-06 elision, and the empty-listing negative control"
  - "features/workflow/lifecycle.feature: the stale-command notice after uninstall (WLIF-06), seeded for plan 07-05"
  - "four shared workflow steps in features/step_definitions/workflow/listing.steps.ts"
  - "progressOf, WorkflowCommandTurn, sendWorkflowCommand in features/lib/workflow-files.ts"
affects: [07-02, 07-03, 07-04, 07-05, 07-06]

actuals:
  tokens: 4600
  tasks: 3
  commits: 4
plan_head_before: 2950d48a31bee83867bc2890b3429c30719e6af9
plan_head_after: 299e63f7a7f97129189c86562503523957a8bd9e

tech-stack:
  added: []
  patterns:
    - "A workflow command goes through sendWorkflowCommand with a settle callback: the run When waits for the run-ending progress entry, the no-run When settles at once"
    - "U+2014 lives in one constant written as a JavaScript escape and is projected to `--`, because the commit hook rewrites the character"

key-files:
  created:
    - features/workflow/listing.feature
    - features/workflow/lifecycle.feature
    - features/step_definitions/workflow/listing.steps.ts
  modified:
    - features/lib/workflow-files.ts
    - features/step_definitions/workflow/runs.steps.ts

key-decisions:
  - "The listing filter keeps extension commands whose path is the engine's entry and whose name holds a colon (research assumption A3: none of the engine's eleven own commands holds one at 3.15.0)"
  - "sendWorkflowCommand checks only the disposition, run faults, and model calls; the no-run assertion (no progress entry) stays in the no-run When"

requirements-completed: [WFL-01]

duration: 14min
completed: 2026-11-01
---

# Phase 7 Plan 01: Workflow listing and shared workflow steps Summary

With the workflow engine loaded, a new session offers a bridged workflow as `/<plugin>:<meta.name>` with its description, observed whole through the registry probe; a lingering command after uninstall shows the engine's WLIF-06 warning and starts no run; and the four shared workflow steps plus the shared record helpers exist for every wave-2 plan.

## Performance

- Duration: about 14 min (2026-11-01T13:34:57Z to 13:48:29Z)
- Tasks: 3 of 3
- Files: 3 created, 2 modified

## Accomplishments

- `features/workflow/listing.feature` (`Feature: Workflow listing`), 4 scenarios:
  - "A new session offers a bridged workflow as a command named for its plugin and its meta name": `/demo:hello | Says hello.`
  - "A workflow is named by its meta name, not by its file name": `workflows/zzz.workflow.js` declaring `greet` gives `/demo:greet | Greets.`
  - "A workflow name that starts with its plugin name loses that prefix, by this extension's naming rule" (WNAM-06; Claude Code 2.1.316 keeps `/demo:demo-audit`): `/demo:audit | Audits the code.`
  - "A plugin with no workflow script adds no workflow command" (negative control)
- `features/workflow/lifecycle.feature` (`Feature: Workflow lifecycle`), 1 scenario with no `Background:`: "Running a workflow command after its plugin is uninstalled shows the engine's notice, because pi keeps the command until a new session" (WLIF-06, the first part of WFL-05).
- `features/workflow/run.feature` is byte-identical to `plan_head_before` and passes through the shared helpers.
- `npx cucumber-js features/workflow`: 6 scenarios passed (4 listing, 1 lifecycle, 1 run seed). `npm run check:static` passed after every task (typecheck, lint, lint:workflows, fallow including dupes and health, format:check, test:corresponding, check:features).

## Shared step texts (exact)

Registered in `features/step_definitions/workflow/listing.steps.ts`, in this order (`When`, then `Then`):

1. `the user runs the workflow command {string}, which starts no run`
2. `pi offers these workflow commands:` (table `command | description`)
3. `pi offers no workflow commands`
4. `the workflow engine shows these notices:` (table `severity | message`)

The seed `runs.steps.ts` keeps its three texts unchanged:
`the published plugin {string} of the marketplace {string} has the workflow {string} described as {string} that returns {string}`, `the user runs the workflow command {string}`, `the workflow run ends with the status {string} and the result {string}`.

## Helper exports in `features/lib/workflow-files.ts`

- Unchanged: `PluginWorkflow`, `workflowScriptText(workflow)`, `publishWorkflow(published, plugin, workflow)`.
- New: `progressOf(record: RpcRecord): Readonly<Record<string, unknown>> | undefined`.
- New: `interface WorkflowCommandTurn { prompt; disposition; records; logs }` (the world's `ModelTurn` shape, no import of `features/support/world.ts`).
- New: `sendWorkflowCommand(pi: PiProcess, harness: string, command: string, settle: (from: number) => Promise<unknown>): Promise<WorkflowCommandTurn>`. It reads the record count and log lengths, sends the prompt, asserts `handled` through `promptDisposition` from `test/e2e/_rpc.ts`, awaits `settle(from)`, asserts no `extension_error` and no `select`/`confirm`/`input`/`editor` dialog, asserts no model call, and returns the turn.
- Module-private: `PROGRESS_ENTRY`, `DIALOG_METHODS`, `isRecord`, `isRunFault`.

## Red proofs

1. Task 1, listing (expected `Says hi.`), 1 scenario failed:
   ```
   Then pi offers these workflow commands:
     | command     | description |
     | /demo:hello | Says hi.    |
   AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       [ '/demo:hello',
   +     'Says hello.'
   -     'Says hi.'
   ```
2. Task 2, stale notice (final period left out), 1 scenario failed:
   ```
   +     '/demo:hello is not available in this project -- reload the session to drop the stale command.'
   -     '/demo:hello is not available in this project -- reload the session to drop the stale command'
   ```
3. Task 3, meta name (expected `/demo:zzz.workflow`):
   ```
   +     '/demo:greet',
   -     '/demo:zzz.workflow',
         'Greets.'
   ```
4. Task 3, WNAM-06 elision (expected `/demo:demo-audit`):
   ```
   +     '/demo:audit',
   -     '/demo:demo-audit',
         'Audits the code.'
   ```
5. Task 3, negative control (with the `hello` workflow `Given` added):
   ```
   Then pi offers no workflow commands
   + [ [ '/demo:hello', 'Says hello.' ] ]
   - []
   ```
   Run total: 4 scenarios (1 passed, 3 failed). Each then passed with its final literal.

## Literals versus RESEARCH

Every observed literal matched RESEARCH Q1, Q5, and Q6: `/demo:hello | Says hello.`, `/demo:greet | Greets.`, `/demo:audit | Audits the code.`, and the notice `warning | /demo:hello is not available in this project -- reload the session to drop the stale command.` (U+2014 projected). The stale command printed exactly one notify and no progress entry before Pi's `handled` answer.

## Task Commits

1. Task 1, listing tracer: `3c2e52f` test(workflows): list a bridged workflow as its plugin command
2. Task 2, helpers (no step text or behavior change): `4a9ca40` test(workflows): share the workflow command record helpers
3. Task 2, stale notice: `6366e40` test(workflows): show the stale workflow command notice after uninstall
4. Task 3, name rules and empty listing: `299e63f` test(workflows): name workflow commands by their meta name

## Decisions Made

- The listing filter is `source === "extension"`, `path === resolveCompanion("pi-dynamic-workflows").entry`, and a colon in the name (research assumption A3). Every listing compares the whole table (T-07-01).
- The no-run `When` asserts the empty progress list itself; `sendWorkflowCommand` stays neutral so the run `When` can share it.
- `requirements-completed` lists only WFL-01: this plan delivers the first part of WFL-05 (the WLIF-06 stale notice), and plan 07-05 completes it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Write tool stored U+2014 itself instead of the `—` escape**
- Found during: Task 2, at the pre-commit run before its commit
- Issue: the file held the raw character, so `fix-unicode-dashes` rewrote the constant to `"--"`, which would have made the projection a no-op.
- Fix: wrote the six-character escape with a byte-exact script; confirmed `git show HEAD:...listing.steps.ts` holds `const EM_DASH = "—";` and the raw-character grep prints nothing. The scenario passed again before the commit.
- Files modified: `features/step_definitions/workflow/listing.steps.ts`
- Commit: `6366e40`

Otherwise the plan ran as written.

## Parent lines

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

The four shared steps are used by `listing.feature` and `lifecycle.feature`, so `npm run check:features` passes in every wave-2 worktree. Plan 07-05 owns `lifecycle.feature` next and may add a `Background:`.

## Self-Check: PASSED

- FOUND: features/workflow/listing.feature, features/workflow/lifecycle.feature, features/step_definitions/workflow/listing.steps.ts, features/lib/workflow-files.ts, features/step_definitions/workflow/runs.steps.ts
- FOUND commits: 3c2e52f, 4a9ca40, 6366e40, 299e63f (4 commits since `plan_head_before`, measured with `git rev-list --count`)

---
phase: 07-workflows
plan: 02
subsystem: testing
tags: [cucumber, workflows, pi-dynamic-workflows, refusals]
status: complete

requires:
  - phase: 07-workflows
    provides: "the shared workflow steps of plan 07-01 (no-run When, notices Then, workflow-commands Then)"
provides:
  - "features/workflow/refusals.feature: WFL-03 install dispositions, the new-session listing they leave, the engine's refusal at run, and the negative control"
  - "features/step_definitions/workflow/refusals.steps.ts: the setup step for an install that reports notes on workflow scripts"
affects: [07-06]

actuals:
  tokens: 4300
  tasks: 3
  commits: 3
plan_head_before: a374c9241c338f04b8d43cc8ae6c465a78f908e0
plan_head_after: 21dc2361e3fa625e3b9b183d84fdb6ee6c28b2ad

tech-stack:
  added: []
  patterns:
    - "A mixed-severity setup install (info cascade plus warning diagnostic) gets its own verb-module Given that destructures the payloads and compares one whole record"

key-files:
  created:
    - features/workflow/refusals.feature
    - features/step_definitions/workflow/refusals.steps.ts
  modified: []

key-decisions:
  - "The caveat wording `was installed but the engine will refuse to load it` is pinned as the product prints it; its inaccuracy goes to the parent as a BACKLOG line"
  - "The setup step compares one record {cascade, diagnostic, otherLines, extra} so a missing, extra, or non-workflow diagnostic line fails in the Given"

requirements-completed: [WFL-03]

duration: 30min
completed: 2026-11-01
---

# Phase 7 Plan 02: Workflow refusals Summary

Every install-time disposition of a workflow script (refused per D-CF7-03, skipped as Claude Code does, installed with a note per D-CF7-04) is pinned whole through Pi's install report; a new session offers commands only for the installed scripts; and running a noted script's command shows the engine's own `error` notice with no run and no model call.

## Performance

- Duration: about 30 min (2026-11-01T13:58Z to 14:28Z)
- Tasks: 3 of 3
- Files: 2 created, 0 modified

## Accomplishments

`features/workflow/refusals.feature` (`Feature: Workflow refusals`), Background: profile Pi with `pi-dynamic-workflows`, the `fixtures` dir marketplace offering `demo` `1.0.0`. Six scenarios, 8 runs:

1. Outline (3 rows) "Running the command of a script installed with a note shows the engine's refusal and starts no run, where Claude Code skips the script at load" (D-CF7-04): `late.js`, `reserved.js`, `nodesc.js`, each `error | /demo:<name> failed: <engine message>`.
2. "Installing a plugin refuses a nondeterministic script and one that does not parse, which Claude Code refuses only when they run" (D-CF7-03): header `... 2 declared components have notes.`, `broken.js` then `clock.js` lines.
3. "Installing a plugin skips a script with no meta and a script whose name is not a literal, as Claude Code does": `dyn.js` then `helper.js` lines.
4. "Installing a plugin installs a script the engine will refuse with a note, where Claude Code skips it at load" (D-CF7-04): header `... 3 declared components have notes.`, `late.js`, `nodesc.js`, `reserved.js` caveat lines in one `lines` cell.
5. Negative control "Installing a plugin whose workflow script the engine accepts reports no note": one `cascade | info | true` row.
6. "A new session offers a command for each installed script and none for a refused or skipped one": `/demo:hello`, `/demo:late`, `/demo:nodesc` (`Saved workflow: demo:nodesc`), `/demo:reserved`.

Each install scenario also pins the plugin row `fixtures | user | demo@fixtures | demo | installed |  | user | 1.0.0`.

Verification: `npx cucumber-js features/workflow/refusals.feature` 8 passed; `npx cucumber-js features/workflow` 14 passed (8 here plus the 6 of plan 07-01); `npm run check:static` passed (typecheck, lint, lint:workflows, fallow incl. dupes and health, format:check, test:corresponding, check:features); `npx fallow dupes --fail-on-issues` exit 0 (no clone group with `skill/collisions.steps.ts`).

## Step text added

`features/step_definitions/workflow/refusals.steps.ts`, one `Given`:

- `the user has run {string}, which reported notes on workflow scripts of the plugin`

It runs the command through `runCommandPayloads`, destructures `[cascade, diagnostic, ...extra]`, and compares one record: `cascade` is `["cascade", "info"]`, `diagnostic` is `["diagnostic", "warning"]`, every diagnostic line starts with `workflow script "` (the non-matching lines are `[]`), and `extra` is `[]`.

## Red proofs

1. Task 1, the Outline with `warning` expected in every row: `3 scenarios (3 failed)`, each
   ```
   +     'error',
   -     'warning',
         '/demo:reserved failed: reserved key name not allowed in meta: constructor'
   ```
   (and the same for `/demo:late failed: ...` and `/demo:nodesc failed: meta.description must be a non-empty string`).
2. Task 2, four wrong cells: `7 scenarios (3 passed, 4 failed)`:
   ```
   +     'Plugin "demo" [user] installed; 2 declared components have notes.',   (refused)
   -     'Plugin "demo" [user] installed; 1 declared component has a note.',
   +     'Plugin "demo" [user] installed; 2 declared components have notes.',   (skipped)
   -     'Plugin "demo" [user] installed; 1 declared component has a note.',
   +     'Plugin "demo" [user] installed; 3 declared components have notes.',   (caveat)
   -     'Plugin "demo" [user] installed; 1 declared component has a note.',
   +     'info',                                                                (negative control)
   -     'warning',
   ```
   In each diff the `lines` cell was shown unchanged, so the RESEARCH Q4 lines matched at the red run.
3. Task 3, the listing with an extra `/demo:clock | Tells the time.` row: `1 scenario (1 failed)`:
   ```
   -     '/demo:clock',
   -     'Tells the time.'
   -   ],
   -   [
         '/demo:hello',
   ```

## Literals versus RESEARCH

Every observed literal matched RESEARCH Q1 and Q4: the three engine messages, the headers, all seven diagnostic lines, the plugin row, and the four listed commands with the fallback description `Saved workflow: demo:nodesc`. The Outline's one-script installs each carry the header `1 declared component has a note.`, which the setup step does not pin (it checks only the shape).

## Task Commits

1. Task 1: `33b99bf` test(workflows): show the engine refusing a noted workflow script
2. Task 2: `e1d1333` test(workflows): pin how install reports refused workflow scripts
3. Task 3: `21dc236` test(workflows): list the commands that noted workflow scripts leave

## Decisions Made

- The caveat wording is pinned as is (CONTEXT refusals bullet); the BACKLOG line is below.
- The Outline installs only the one caveat script per row (no `hello`), as the plan's Outline specifies; the setup step proves the install noted it.

## Deviations from Plan

None - plan executed exactly as written. (The first `npm run check:static` had its lint job killed for memory because the ESLint warm-up was still running beside it; a lone `npm run lint` then passed, and a later full `check:static` passed.)

## Parent lines

- BACKLOG: the workflow caveat line `workflow script "<file>" in "workflows" was installed but the engine will refuse to load it: ...` (`bridges/workflows/discover.ts`) is inaccurate: the engine registers the command and refuses the script when it runs, not when it loads. Rewording it touches `test/orchestrators/plugin/{install-flow-ledger,reinstall-flow,info}.test.ts`, `docs/output-catalog.md`, and `features/workflow/refusals.feature` (the "installs a script the engine will refuse with a note" scenario).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

`refusals.feature` uses the shared no-run `When`, the notices `Then`, and the workflow-commands `Then`; the new `Given` is used by two scenarios (the Outline and the listing). Plan 07-06 (docs) can cite these scenarios for the admit-versus-run rows.

## Self-Check: PASSED

- FOUND: features/workflow/refusals.feature, features/step_definitions/workflow/refusals.steps.ts
- FOUND commits: 33b99bf, e1d1333, 21dc236 (3 since `plan_head_before`, measured with `git rev-list --count`; this SUMMARY's commit is the fourth)

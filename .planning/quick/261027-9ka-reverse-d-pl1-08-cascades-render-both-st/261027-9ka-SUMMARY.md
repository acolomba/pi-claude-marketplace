---
phase: quick-261027-9ka
plan: 01
subsystem: staging-warnings
tags: [warnings, cascades, marketplace-update, apply, D-PL1-25]
status: complete
requires: []
provides:
  - "surfaceCascadeStagingDiagnostics: the cascades' both-halves staging renderer"
affects:
  - marketplace update / autoupdate cascade output
  - apply catalog move, backfill and enable output
tech-stack:
  added: []
  patterns:
    - "one private composition path (notifyStagingHalves) shared by the standalone and cascade renderers"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/orchestrators/plugin/staging-diagnostics.test.ts
    - test/orchestrators/marketplace/update.messaging.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - features/plugin/staging-warnings.feature
    - .planning/phases/01-staging-warning-channels/01-CONTEXT.md
    - .planning/phases/01-staging-warning-channels/01-08-SUMMARY.md
decisions:
  - "D-PL1-25: cascades (marketplace update, autoupdate, apply moves/backfills/enables) render both staging warning halves per plugin; standalone verbs keep the discovery half"
  - "Cascade header: one diagnostic per plugin with one clause per half (`...; 1 declared component has a note; 1 staging warning.`); uncertain choice 8"
metrics:
  duration: not measured (start time not recorded)
  completed: 2026-10-27
actuals:
  tokens: 13750
  tasks: 3
  commits: 4
plan_head_before: 4c79447b8d4032da02a46064aec6977abf16bfbc
plan_head_after: 9af99507743c49fd53e39d33a907b7319db01502
---

# Quick 261027-9ka: cascades render both staging warning halves (D-PL1-25) Summary

`marketplace update`, autoupdate and `apply`'s catalog moves, backfills and
enables now show each plugin's discovery notes and then its hygiene warnings
(for example `[helper] dropped fields: color`) in one diagnostic per plugin,
under `Plugin "<p>" [<s>] <verb>; 1 declared component has a note; 1 staging warning.`.
Standalone verbs keep the discovery half only.

## Commits

| Task | Commit | Title | Hook (`check:commit`) |
| ---- | ------ | ----- | --------------------- |
| 1 (tracer) | 06d4b83c | feat(update): show all staging warnings in marketplace update cascades | Passed |
| 2 | f2e03dae | feat(apply): show all staging warnings of catalog moves and enables | Passed |
| 3 (code comments) | 9728ab58 | docs(update): correct comments the cascade warning change made false | Passed |
| 3 (phase records) | 9af99507 | docs(warnings): record the reversal of the cascade warning rule | Skipped (no build input) |

`SKIP=npm-check pre-commit run --files <task files>` was clean (exit 0) before
each commit. No commit needed a retry.

## Red runs (scenarios fail before their change)

- **Scenario A** ("A marketplace update with autoupdate on reports a moved
  plugin's skip and its dropped agent field under one header"), on HEAD
  4c79447b: `npx cucumber-js --name ...` exit 1, failing at
  `Then the command reports these results:`. Actual diagnostic:
  `Plugin "demo" [project] updated; 1 declared component has a note.` with
  only the skip line; expected the both-halves header and
  `..., [helper] dropped fields: color`.
- **Scenario B** ("Apply that moves a plugin to its catalog version reports
  the moved plugin's skip and its dropped agent field under one header"), on
  the Task 1 code (06d4b83c): exit 1 at `Then the command reports these
  results:`, the same diff (skip only, notes-only header).
- **Unit RED:** `staging-diagnostics.test.ts` failed to load (missing export)
  before the renderer existed; the apply D-PL1-25 case failed with the
  notes-only diagnostic before `apply.ts` switched renderer.

Cells taken from the rendered run, as the plan directs: scenario A's demo
row reasons `requires pi-subagents` (the new agent); scenario B's demo row
reasons `components now supported, requires pi-subagents` (1.1.0 adds an
agents directory, so apply's move is a growth move); the apply unit case's
cascade row `{requires pi-subagents}`.

## Re-pinned expectations

Only the plan's own three pins changed (Task 1 step 6): the delta case and the
hygiene-only case in `update.messaging.test.ts`, and the autoupdate staging
case in `update.test.ts`. The Task 2 ripple check (`npm run test:modules`,
exit 0; `npm run test:integration`, exit 0) needed no re-pin.

## Verification

- `node --test` staging-diagnostics, update.messaging, update (marketplace):
  175 pass; apply.test.ts: 148 pass.
- `npm run test:coverage:direct` for staging-diagnostics.ts,
  update.messaging.ts and apply.ts: exit 0.
- `npx cucumber-js features/plugin/staging-warnings.feature features/marketplace/update.feature features/marketplace/autoupdate.feature`:
  143 scenarios pass. `... staging-warnings apply reconcile autoapply enable`:
  102 scenarios pass.
- `npx fallow dupes --fail-on-issues`: exit 0, so the new apply case needed no
  fold into a data-row loop.
- `grep -rn 'D-PL1-08' extensions test features | wc -l`: 0.
- `grep -c '^  Scenario:' features/plugin/staging-warnings.feature`: 14.
- No commit touched CHANGELOG.md, PROJECT.md, BACKLOG.md or ROADMAP.md.
  Nothing pushed or merged.

## Full gate

`npm run check > <scratchpad>/check.txt 2>&1; echo $? > <scratchpad>/check-exit.txt`,
run unpiped in the foreground-equivalent background job in this worktree
(`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p1-warnings-6e004c`,
dependencies present) on the clean tree at HEAD
`9af99507743c49fd53e39d33a907b7319db01502`: **exit 0**. Node v26.12.1, wall
time 158 s. The run included the cucumber suite (915 scenarios, 915 passed)
and merged `coverage/direct.lcov` (293 records). Only this task's untracked
quick directory was in `git status`.

## Header choice (orchestrator amendment 1, uncertain choice 8)

The install cascade has no per-plugin form to match. `apply` renders install
`postCommitWarnings` (discovery lines first, then hygiene lines) as one
aggregated block across all installs, `N post-install warning(s) surfaced from
reconcile installs.`; `import` pushes each line as a separate
`post-install-warning` diagnostic. Neither names a plugin, and the phase
already kept that generic block apart from the per-plugin header (phase
uncertain choice 7). So the line shape matches the install cascade
(discovery first, then hygiene, raw redacted lines), and the header uses the
plan's clause form: `; N staging warning(s).` beside the D-PL1-05 notes
clause. Recorded as uncertain choice 8 in 01-CONTEXT.md and 01-08-SUMMARY.md.
Alternatives for the user: a second diagnostic per plugin for the hygiene
half, or one generic `N staging warnings` header over all lines (the closest
per-plugin analogue of the install cascade's block).

## Deviations from Plan

- **[Rule 1 - Truthful comment] `types.ts` failed-arm `stagingWarnings` doc.**
  It said "A consumer renders the discovery half after the failure row",
  which the cascade change made false. It now says the direct update renders
  the discovery half and the cascades render both halves (D-PL1-25). Same
  file as the plan's types.ts edit; commit 9728ab58.
- The update.test.ts autoupdate case kept its `D-PL1-07 / D-PL1-09` title
  (still true); only its arrange comment and expectation changed.
- 01-08-SUMMARY.md: per orchestrator amendment 2, the UPCASC-01 backlog row
  now cites D-PL1-25 (and marks D-PL1-08 reversed, with the two new
  scenarios as proof), and the T-01-15 threat line names
  `surfaceCascadeStagingDiagnostics` and the both-halves rule.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-9ka-01 is mitigated: every line, hygiene included, goes through
`redactAbsolutePaths` in `notifyStagingHalves`, pinned by the NFR-9 unit case
(`/private/tmp/stage/alpha-skill` renders as `alpha-skill`). T-9ka-03 and
T-9ka-04 are mitigated by the header data-row cases, the two scenarios, and
the unchanged `surfaceStagingDiagnostics` hygiene-only case and
`@ts-expect-error` pin.

## Self-Check: PASSED

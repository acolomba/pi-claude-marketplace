---
phase: 261004-az6
plan: 01
subsystem: checks
tags: [check-changed, negative-controls, ci, pre-commit]
status: complete
requires: []
provides:
  - "npm run check:controls (the six negative controls)"
  - "npm run check without negative controls"
  - "selector family controls by scripts/<stem> and a toolchain-only check:controls fallback"
affects:
  - scripts/check-changed.mjs
  - package.json
  - .github/workflows/ci.yml
tech-stack:
  added: []
  patterns:
    - "checker family = scripts/<stem>.mjs, scripts/<stem>.<part>.mjs, scripts/<stem>.negative.mjs"
key-files:
  created: []
  modified:
    - scripts/check-changed.mjs
    - scripts/check-changed.negative.mjs
    - package.json
    - .github/workflows/ci.yml
    - tests/architecture/unused-type-member-gate.test.ts
    - tests/architecture/unowned-exports-census.test.ts
    - tests/architecture/gate-targets.ts
    - tests/architecture/gate-targets.test.ts
    - skills/local-verification/SKILL.md
    - CONTRIBUTING.md
    - docs/unused-type-member-gate.md
  deleted:
    - tests/scripts/gsd-discuss-integration.test.ts
decisions:
  - "npm run check runs no negative control; npm run check:controls runs all six, type-member control last"
  - "A changed scripts/<stem>.*.mjs adds node scripts/<stem>.negative.mjs to focused, full, and selection-error plans"
  - "Toolchain inputs (package files, Node version files, tsconfig*, eslint, fallow, rule-packs, Prettier config) add npm run check:controls after npm run check"
  - "CI check job runs npm run check:controls on pull requests only"
  - "No test reads .planning/ data or skill/instruction Markdown; those paths select scope none"
metrics:
  duration: "~51 min (12:31:50Z to 13:22:30Z), dominated by two ~23-min hook runs"
  completed: 2026-10-04
estimate:
  tokens: 130000
  tasks: 2
actuals:
  tokens: 11600
  tasks: 2
  commits: 2
plan_head_before: e187b8ec7ecadbc160a5682b36209a6d9f4949a2
plan_head_after: 1d2cdd516e51f5f702a4cd6f776c0ab37d8fe142
---

# Quick Task 261004-az6: Run negative controls only when their checker changes

`npm run check` no longer runs the six negative controls. A new `npm run check:controls` runs them. The changed-check selector adds a checker's own control when any file in its `scripts/<stem>` family changes, and adds `check:controls` when a toolchain input changes. CI runs `check:controls` on pull requests. The tests that read planning data or skill Markdown are gone, and with them the selector's reader table and rule.

## Commits

| Task | Commit     | Title                                                            |
| ---- | ---------- | ---------------------------------------------------------------- |
| 1    | `67f95c91` | test(checks): drop tests that read planning and skill files      |
| 2    | `1d2cdd51` | perf(checks): run checker controls only when a checker changes   |

`actuals.tokens` is chars/4 over the realized diff (`git diff e187b8ec 1d2cdd51`, 46,504 bytes).

## What changed

Task 1:

- Deleted `tests/scripts/gsd-discuss-integration.test.ts`.
- Removed the D-07-17 disposition case, `ROUTED_FINDINGS`, and `dispositionRow` from `tests/architecture/unowned-exports-census.test.ts`. The other test definitions are unchanged.
- Removed `EVIDENCE_RECORD_TARGETS` and `FINDING_DISPOSITIONS_REL` from `tests/architecture/gate-targets.ts`, and the `\.planning` root from `REPO_RELATIVE_ENTRY`.
- Removed `DATA_READERS`, the `reader` rule, and `selectReaders` from `scripts/check-changed.mjs`. `isInstruction` has a one-line doc comment.
- In the selector control, removed the reader block and the real-tree `.planning` scan. Added the two former reader inputs to the exempt list.
- Applied TXT-1 and TXT-2.

Task 2:

- Applied TXT-3 in `package.json`: `check` has nine members, and `check:controls` has the six controls.
- In `scripts/check-changed.mjs`, added `isToolchain` and `familyControls`. `fullChecks(root, files)` now adds either `check:controls` or the family controls. Focused plans add the family controls. `selectAnalyzer` has no control logic.
- Added these selector-control cases: an analyzer helper, a checker and its helper (control selected once), a helper with no test, a removed helper, the toolchain replacing the family control, e2e order, the selection-error fallback, eleven toolchain inputs, and `schema/`.
- Applied TXT-4 in CI: a `Run checker controls` step for pull requests only.
- Rewrote the two wiring cases in `unused-type-member-gate.test.ts`. They now match exact CI lines and pin `CONTROLS_SCRIPT`.
- Applied TXT-5, TXT-6, and TXT-7.

## Verification evidence

| Item                         | Task 1                                                       | Task 2                                                       |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `<verify>` command           | passed (`tests 22, ... pass 22`; "reader-free selection probe passed") | passed ("package scripts ok"; "controls selection probe passed"; chain cases `tests 2 ... pass 2`) |
| Pre-commit command           | `pre-commit run --verbose --files <7 files>`                  | `pre-commit run --verbose --files <8 files>`                  |
| Pre-commit exit              | 0 (`/tmp/az6-precommit-task1.log`)                            | 0 (`/tmp/az6-precommit-task2.log`)                            |
| Hook scope                   | `full`                                                       | `full`                                                       |
| Commands run                 | `npm run check` (still containing the six controls)          | `npm run check`, then `npm run check:controls`, then "Checks passed." |
| check-changed.log durationMs | 1,430,892                                                    | 1,384,434                                                    |
| lockWaitMs / exitStatus      | 1 / 0                                                        | 0 / 0                                                        |
| Unit suite                   | 8523 pass, 0 fail                                            | 8523 pass, 0 fail                                            |
| Base commit verified         | e187b8ec + staged Task 1 changes, committed as 67f95c91       | 67f95c91 + staged Task 2 changes, committed as 1d2cdd51       |
| Node                         | v26.10.0                                                     | v26.10.0                                                     |
| fallow audit verdict         | pass                                                         | pass                                                         |

The final record in `.git/check-changed.log` is:

```json
{"timestamp":"2026-10-04T12:59:04.945Z","worktree":"/home/acolomba/pi-claude-marketplace","branch":"features/faster-precommit","scope":"full","reason":"Full check required by .github/workflows/ci.yml, package.json, scripts/check-changed.mjs, scripts/check-changed.negative.mjs","fileCount":9,"durationMs":1384434,"exitStatus":0,"lockWaitMs":0}
```

No `check-changed-full.lock` directory remains.

The Task 2 hook run is the full check over the finished tree. It ran both `npm run check` and `npm run check:controls`, so the plan needed no separate `check:controls` run. The Task 2 run includes all six controls and still took 46 s less than the Task 1 run. Most of both runs is the unit suite under coverage (about 440-465 s) and the integration tests.

## Smoke probes

Task 1, after the commit: an untracked planning JSON file plus `skills/az6-probe.md` gave `"scope": "none"` and `"commands": []`. Both probe files were removed.

Task 2, after the commit:

- (i) `scripts/check-unused-type-members.az6probe.mjs` with its test gave `focused`. The commands were Prettier, typecheck, ESLint, `fallow`, `test:corresponding`, `test:analyzers`, then `["node","scripts/check-unused-type-members.negative.mjs"]`. There was no `check:controls`.
- (ii) The same script without its test gave `full` `[["npm","run","check"],["node","scripts/check-unused-type-members.negative.mjs"]]`.
- (iii) `.node-version` gave `full` `[["npm","run","check"],["npm","run","check:controls"]]`.

The probe files were removed, and `git status --short` shows only the planning directory.

## Selector output for representative file sets (HEAD 1d2cdd51)

| Changed set                                          | Scope   | Commands                                                                 |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `schema/plugin.schema.json` (absent)                 | full    | `npm run check`                                                          |
| `package.json`                                       | full    | `npm run check`, `npm run check:controls`                                |
| `scripts/check-unused-type-members.flow.mjs`         | focused | Prettier, ESLint (script + its test), `fallow`, `test:analyzers`, `node scripts/check-unused-type-members.negative.mjs` |
| `scripts/check-unused-type-members.model.mjs`        | focused | same shape as `.flow.mjs`, including the type-member control              |
| `scripts/test-reporter.mjs`                          | full    | `npm run check`, `node scripts/test-reporter.negative.mjs`               |
| `.planning/config.json`                              | none    | (none)                                                                   |
| `scripts/check-unused-type-members.exceptions.json`  | focused | Prettier, `npm run lint:type-members`                                    |
| `.github/workflows/ci.yml`                           | full    | `npm run check`                                                          |

## Deviations from Plan

None. The plan executed as written. Two small choices were within its latitude:

- The `isInstruction` doc comment reads "Planning records and agent instruction Markdown select no checks: no test reads them." The colon form keeps the line under the 100-column print width.
- `isToolchain` and `familyControls` are function declarations placed before `git()`. `fullChecks` stays at its original location as an arrow constant and reaches them through hoisting.

Focused task verification passed. Both commits ran the full scope, so this change set has full `npm run check` plus `npm run check:controls` evidence at 1d2cdd51.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/check-changed.mjs, scripts/check-changed.negative.mjs, package.json, .github/workflows/ci.yml, tests/architecture/unused-type-member-gate.test.ts, docs/unused-type-member-gate.md
- ABSENT (intended): tests/scripts/gsd-discuss-integration.test.ts
- FOUND commits: 67f95c91, 1d2cdd51

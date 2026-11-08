---
phase: 08-first-run-config-migration
plan: 01
subsystem: persistence
tags: [config-migration, mig-01, cucumber, fix-02, dependencies]
status: complete

requires:
  - phase: 01-foundation
    provides: "the 0.4.3 fixture writer, the deleted-config step, and the two CFGMIG-01 seeds in features/plugin/config-migration.feature"
provides:
  - "buildConfigFromState writes each plugin entry as the user's commands wrote it: { enabled: false } for a user disable, {} otherwise, nothing for a cascade-only dependency, {} for a record the dependency check holds down (D-BG-801, D-BG-802, D-BG-803)"
  - "Nine scenarios in features/plugin/config-migration.feature covering CFGMIG-01 in the user and the project scope"
affects: [08-02, load path, reconcile README]

actuals:
  tokens: 6200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A rebuilt config is the config the user's own commands would have written for the records"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/migrate-config.ts
    - test/persistence/migrate-config.test.ts
    - features/plugin/config-migration.feature
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md

key-decisions:
  - "D-BG-801: a user-disabled record is rebuilt as { enabled: false }; every other projected record as {}"
  - "D-BG-802: a provenance dependency record is left out unless the user disabled it"
  - "D-BG-803: a record held by the dependency check is rebuilt as {} (fourth reader of dependencyDisabled)"

patterns-established:
  - "Red proof by a temporary product break with a keep copy and a git diff --exit-code restore check"

requirements-completed: [CFGMIG-01]

coverage:
  - id: D1
    description: "The rebuild keeps a disabled plugin disabled, leaves cascade-only dependencies out, and keeps a held record liftable"
    requirement: CFGMIG-01
    verification:
      - kind: unit
        ref: "test/persistence/migrate-config.test.ts (five D-BG-801/802/803 rows; 18/18 pass)"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/config-migration.feature (9 scenarios, 9 passed)"
        status: pass
---

# Phase 8 Plan 01: First-run config rebuild Summary

**The first-load config rebuild now writes what the user's own commands wrote, so a disabled plugin stays disabled, a cascade-only dependency stays undeclared, and `pending` shows nothing to apply in both scopes.**

## Execution note

The plan started in a `gsd-executor` subagent. The coordinator then ordered inline execution (P8-DC-21), so the executor was stopped after Task 1 step 2: it had reduced the Background, rewritten the seed, and measured the seed's red run, and it committed nothing. The phase session checked the tree was quiet for 60 seconds and finished the plan inline.

## Accomplishments

- `persistence/migrate-config.ts`: `basePluginEntries` takes the record map; new private `declaredEntry` (uses `isRecordedButDisabled`, ENBL-05) and `isHeldByDependencyCheck`. Doc comments carry D-BG-801..803. `migrateFirstRunConfig` unchanged.
- `test/persistence/migrate-config.test.ts`: `populatedState(plugins = {})` and one data-driven loop of five rows. Unit file: `tests 18`, `fail 0`. Direct coverage of the pair passes (100%).
- `orchestrators/reconcile/README.md`: "Exactly four readers", naming `persistence/migrate-config.ts::isHeldByDependencyCheck`.
- `features/plugin/config-migration.feature`: Background reduced to the publish step; seed renamed "... writes it with a disabled plugin's enabled state"; seven new scenarios (S-U3, S-U4, S-U5, S-P1, S-P2, S-P3, S-P5). 9 scenarios, 119 steps, all pass.

## Task Commits

1. **Task 1: the fix, unit rows, seed rewrite, README** - `3c833b5a` (fix) - hook `npm run check:commit` Passed
2. **Task 2: user-scope pending and dependency scenarios** - `ec8fc16a` (test) - hook Passed
3. **Task 3: project-scope scenarios** - `c48c6735` (test) - hook Passed

## Checks run

- `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/persistence/migrate-config.test.ts`: 18 pass, 0 fail.
- `test/architecture/disabled-state-classification.test.ts` and `test/integration/reconcile-plan-convergence.test.ts`: pass.
- `npx tsc --noEmit -p .`: exit 0. `npx eslint` on the two touched TS files: exit 0.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/migrate-config.ts`: exit 0.
- `npx cucumber-js features/plugin/config-migration.feature`: `9 scenarios (9 passed)`, `119 steps (119 passed)`.
- `npm run check:features`: exit 0.

## Red proofs

Each break was applied to `migrate-config.ts`, the feature file run, the keep copy restored, and `git diff --exit-code -- extensions/pi-claude-marketplace/persistence/migrate-config.ts` exited 0 after every restore. Logs are under `/tmp/claude-1000/bg-phase-8/`.

| Scenario | Break | Failing step | Observed |
| --- | --- | --- | --- |
| Deleted config with a disabled plugin (rewritten seed) | unfixed file (`migrate-config.orig.ts`) | `Then the session reports no results` | two `Reconcile pending` cascades with demo@fixtures `will enable` (executor run, `t1-red.log`; repeated in `t2-red-orig.log`) |
| 0.4.3 upgrade, user scope (seed) | `existing-valid` guard disabled | `Then the "claude-plugins.json" file of the user scope declares these marketplaces:` | the session's second load re-migrated with `autoupdate` already scrubbed, so the `autoupdate` cell was missing (`t3-red-valid.log`) |
| S-U3 pending empty, user | unfixed file | `Then the result has these fields:` | kind was not `reconcile-pending-empty` |
| S-U4 dependency left out | unfixed file | `... user scope declares these plugins:` | `demo@fixtures` also declared |
| S-U5 disabled dependency kept | unfixed file | `Then the session reports no results` | pending cascade |
| S-U5 disabled dependency kept | dependency check moved ahead of the disabled check | `... user scope declares these plugins:` | `demo@fixtures` missing (`t2-red-depfirst.log`) |
| S-P1 0.4.3 upgrade, project, autoupdate off | exact-`false` copy removed | `... project scope declares these marketplaces:` | `autoupdate` cell empty (`t3-red-false.log`) |
| S-P2 pending empty, project | unfixed file | `Then the result has these fields:` | kind was not `reconcile-pending-empty` (`t3-red-orig.log`) |
| S-P3 all-local scope | `{}` passed as the local config | `Then the "claude-plugins.json" file of the project scope does not exist` | the base config was written (`t3-red-local.log`) |
| S-P3 all-local scope (empty arm) | `entryCount === 0` check falls through | same step | an empty base config was written (`t3-red-empty.log`) |
| S-P5 mixed local and base | `{}` passed as the local config | `... project scope declares these marketplaces:` | `fixtures` also declared (`t3-red-local.log`) |

S-P5 was unmeasured by research; it passed on the first run with the reference tables.

## Real-home check

`find /home/acolomba/.pi/agent -newer /tmp/claude-1000/bg-phase-8/home-marker-inline` listed nothing after the last run (the executor's own check of its part also listed nothing).

## Unowned feature files changed

None.

## Parent line candidates

None from this plan (08-02 collects the phase's parent lines).

## Deviations from Plan

- Finished inline in the phase session instead of the subagent (P8-DC-21). No change to the planned content.

## Issues Encountered

- STATE.md was left modified by `state.begin-phase`; it is committed with the tracking update, not with a task.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- The 0.4.3 user seed's red proof breaks the `existing-valid` guard rather than the seed's own projection, because the unfixed projection already wrote `autoupdate` correctly (plan checker advisory 3).
- Unit rows use one data-driven loop (planned, P8-DC-16).

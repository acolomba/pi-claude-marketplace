---
phase: 03-marketplace-add
plan: 02
subsystem: testing
tags: [cucumber, marketplace-add, fixtures, gherkin, scopes]
status: complete

requires:
  - phase: 03-marketplace-add
    provides: the add verb module (add.steps.ts) and the ADD-06/ADD-07 Outlines from 03-01
provides:
  - publishMarketplaceIn in features/lib/published-marketplace.ts (a manifest name published in a directory of another name); publishMarketplace delegates to it
  - The add-only step `another marketplace named {string} to add is published as a {source kind} source in {string}`
  - The ADD-04 duplicate-name Outline, the ADD-05 both-scopes Outline, and the ADD-02 default-scope scenario in features/marketplace/add.feature
affects: [03-03, url source kind, github source kind, marketplace list, marketplace remove]

actuals:
  tokens: 2086
  tasks: 2
  commits: 2
plan_head_before: 987a97d474670b430f774a0b2e8270f5584b263e
plan_head_after: e90fae7fae739b6ad9a15ffb681a21d3dbbe30db

tech-stack:
  added: []
  patterns:
    - "A kind dispatcher widens in place: the old entry point delegates to a parameterized one, so the kind switch stays single and fallow sees no clone"
    - "A fixture that would collide with a world record by name is published without recording it, so later steps keep typing the first source"

key-files:
  created: []
  modified:
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/add.steps.ts
    - features/marketplace/add.feature

key-decisions:
  - "publishMarketplace is a plain (non-async) function returning publishMarketplaceIn's promise, so it adds no await-less async function"
  - "The second-publish step registers the release of its directory and records nothing on the world (D-01), so `is added to the project scope` still types the first `tools` source"

requirements-completed: [ADD-02, ADD-04, ADD-05]

coverage:
  - deliverable: "ADD-04: a name the scope already holds fails as duplicate name for the same source and for another directory declaring it; the project file keeps the original source"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Adding a marketplace whose name the scope already holds fails as a duplicate name'"
        status: pass
  - deliverable: "ADD-05: the same marketplace added to both scopes is declared in each scope's file"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Adding a marketplace the user scope holds to the project scope records it in both scopes'"
        status: pass
  - deliverable: "ADD-02: an add with no --scope lands in the user scope"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Adding a marketplace without a scope records it in the user scope'"
        status: pass
  - deliverable: "Whole suite and feature gate; no clone group added"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm run test:cucumber"
        status: pass
      - kind: command
        ref: "CI=1 npm run check:features"
        status: pass
      - kind: command
        ref: "npx fallow audit --base 25d7ae50 (verdict)"
        status: pass

duration: 5 min
completed: 2026-10-16
---

# Phase 3 Plan 02: Duplicate-name and both-scope add scenarios Summary

**`marketplace add` now has scenarios for three cases. A name the scope already holds fails as `duplicate name`, keyed on the manifest name, and the original record survives. The same marketplace can be added to both scopes and is recorded in each. An add with no `--scope` lands in the user scope. One new add-only step drives the duplicate case, through `publishMarketplaceIn`, with no cloned kind switch.**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-10-16T12:46:48Z
- **Completed:** 2026-10-16T12:51:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ADD-04 Outline: the same source added twice, and the `tools-copy` directory whose manifest declares `tools`, both fail with the error envelope and one row `tools | project | failed | duplicate name`. The project `claude-plugins.json` still declares only `tools` with its original source. Two dir rows run now, and two `@url` rows are dry-run by the feature gate (D-01, D-02).
- ADD-05 Outline: `tools` added to the user scope and then to the project scope reports `tools | project | added`, and both scopes' files declare it. dir and file run now. url and github are dry-run (D-09).
- ADD-02 scenario: an add with no `--scope` reports `tools | user | added`, and the user scope's file declares `{home}/marketplaces/tools`.
- `publishMarketplaceIn(marketplacesRoot, directory, name, kind, plugins)` holds the one kind switch. `publishMarketplace` delegates to it with `directory = name`, so its two callers did not change.

## Task Commits

1. **Task 1: a name the scope already holds fails as a duplicate name (ADD-04)**: `eeb66885` (test). Hook `npm run check:commit`: Passed.
2. **Task 2: the same marketplace in both scopes, and the user scope by default (ADD-05, ADD-02)**: `e90fae7f` (test). Hook `npm run check:commit`: Passed.

## Verification Results

| Command | Result |
| --- | --- |
| Task 1 `npx cucumber-js --parallel 1 --name 'Adding a marketplace whose name the scope already holds fails as a duplicate name'` | `2 scenarios (2 passed)` |
| Task 1 `npm run test:cucumber` | `36 scenarios (36 passed)` |
| Task 1 `CI=1 npm run check:features` | `Feature gate passed: 44 scenarios, 21 step definitions.` |
| `npx fallow audit --base 25d7ae50` verdict (after Task 1, and again after Task 2) | `pass`, `pass` |
| Task 2 `npx cucumber-js --parallel 1 --name 'Adding a marketplace the user scope holds to the project scope records it in both scopes'` | `2 scenarios (2 passed)` |
| Task 2 `npx cucumber-js --parallel 1 --name 'Adding a marketplace without a scope records it in the user scope'` | `1 scenario (1 passed)` |
| Task 2 `npm run test:cucumber` | `39 scenarios (39 passed)` |
| Task 2 `CI=1 npm run check:features` | `Feature gate passed: 49 scenarios, 21 step definitions.` |

Acceptance greps: `export async function publishMarketplaceIn`: 1. `case "url":`: 2. The step-text check printed `4 true`. `recordPublished` in add.steps.ts: 0. The ADD-04 Outline title: 1. `tools-copy`: 3. The ADD-05 Outline title: 1. The ADD-02 scenario title: 1. `"claude-plugins.json" file of the user scope`: 3. `grep -n "Scenario"` lists, in order: ADD-01 (7), ADD-02 (36), `~` (50), ADD-05 (64), new session (97), ADD-04 (129), ADD-06 (157), ADD-07 (176).

This plan did not run the phase gate (`npm run check`). It belongs to the last plan of the phase.

## Planted Checks (each reverted, none committed)

Each check edited `features/marketplace/add.feature` from a backup copy in the scratchpad. The backup was restored afterwards, and `cmp` confirmed the restore.

**Task 1 (a): the copy's manifest name changed from `"tools"` to `"other"`** in the third Given. `npx cucumber-js --parallel 1 --name 'Adding a marketplace whose name the scope already holds fails as a duplicate name'` exited 1 with `2 scenarios (1 passed, 1 failed)`. The failing row is the `tools-copy` row (`add.feature:102`). The add succeeded, so the envelope step failed first:

```
Then the result has these fields: # features/step_definitions/command.steps.ts:116
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +     'info'
  -     'error'
  -   [
  -     'summary',
  -     'A marketplace operation has failed.'
  -   ]
```

The add was refused only when the copy's manifest declared `tools`. So the refusal keys on the manifest name, not on the directory. The same-source row still passed, as expected.

**Task 1 (b): the config row's `<source>` changed to `<second source>`.** The same command exited 1 with `2 scenarios (1 passed, 1 failed)`. The failing row is the `tools-copy` row (`add.feature:102`):

```
+     '{home}/marketplaces/tools',
-     '{home}/marketplaces/tools-copy',
```

The project file keeps the original source after the refusal (D-02).

**Task 2 (a): the ADD-05 result row's scope changed from `project` to `user`** (`add.feature:74`). `npx cucumber-js --parallel 1 --name 'Adding a marketplace the user scope holds to the project scope records it in both scopes'` exited 1 with `2 scenarios (2 failed)` (the dir row at `:84` and the file row at `:85`):

```
+     'project',
-     'user',
```

**Task 2 (b): the ADD-02 result row's scope changed from `user` to `project`** (`add.feature:45`). `npx cucumber-js --parallel 1 --name 'Adding a marketplace without a scope records it in the user scope'` exited 1 with `1 scenario (1 failed)`:

```
+     'user',
-     'project',
```

## Decisions Made

- The step text is the one the plan suggested: `another marketplace named {string} to add is published as a {source kind} source in {string}`.
- `publishMarketplace` is a plain function that returns `publishMarketplaceIn(...)`, not an `async` wrapper, so it adds no `async` function without an `await`.
- The one-line comment above the `publishMarketplaceIn` call explains why the step records nothing on the world (D-01).

## Deviations from Plan

None - plan executed exactly as written.

Planted check Task 1 (a) failed at the envelope step (`info` against `error`), not at a row step that shows an `added` row named `other`. The plan predicted the row step. The envelope step runs first and already shows that the add succeeded, so the check proves the same point.

## Hermeticity Review

- The second-publish step writes only under `path.join(this.marketplacesRoot, <directory from the feature file>)`, inside the sandbox HOME. It registers the directory's release before the write (T-03-06).
- The config steps read each scope's `claude-plugins.json` in the sandbox agent directory and in `<sandbox cwd>/.pi`. No step reads or writes the real HOME, `~/.pi/agent`, or git config.
- The url and github rows stay excluded by `cucumber.json` (`not @url and not @github`). The git arm of `publishMarketplaceIn` still throws `noStandIn`, and Pi runs with `PI_OFFLINE=1` (T-03-09).

## Issues Encountered

None.

## Next Phase Readiness

Ready for 03-03. When the url source kind lands, it fills the git arm of `publishMarketplaceIn` with a repository named by `directory`. The ADD-04 and ADD-05 `@url` rows then turn on with no feature-file edit.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/lib/published-marketplace.ts, features/step_definitions/marketplace/add.steps.ts, features/marketplace/add.feature
- FOUND: eeb66885, e90fae7f (both ancestors of HEAD)
- Commits measured: `git rev-list --count 987a97d4..HEAD` = 2

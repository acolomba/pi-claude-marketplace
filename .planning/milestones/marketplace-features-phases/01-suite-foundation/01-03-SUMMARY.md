---
phase: 01-suite-foundation
plan: 03
subsystem: testing
tags: [cucumber, gherkin, parameter-type, behavioral-tests, marketplace]

requires:
  - phase: 01-suite-foundation (01-01)
    provides: "runCommandPayloads, run tokens ({home}, {scenario time}), ScenarioWorld with an exactly-one lastResult()"
  - phase: 01-suite-foundation (01-02)
    provides: "check:features in check:static (unused/undefined/ambiguous steps over every row, excluded rows included) and the @url/@github exclusion in cucumber.json"
provides:
  - "Step `the result lists these marketplaces:` over a cascade's marketplaces or a marketplace-info-cascade's blocks, failing on a block with plugin rows"
  - "Step `the result lists no marketplaces` for an empty cascade"
  - "features/lib/published-marketplace.ts: SourceKind, parseSourceKind, PublishedMarketplace, publishMarketplace, invalidateManifest"
  - "features/support/source-kind.ts: the `source kind` parameter type (dir, file, url, github)"
  - "ScenarioWorld.recordPublished / publishedMarketplace"
  - "features/step_definitions/marketplace/publishing.steps.ts: publish-by-kind, offers-these-plugins, added-to-scope, manifest-has-become-invalid"
  - "features/lib/path-marketplace.ts: writeInvalidManifest"
  - "Seeds: LS-01 (list.feature), INFO-04 and INFO-08 (info.feature), ADD-01 multi-kind Outline (add.feature)"
affects: [01-04, 01-05, marketplace verb phases, kind phases]

actuals:
  tokens: 5242
  tasks: 3
  commits: 3
plan_head_before: b26473669cd7512dd0d2b4adeba67ba3bb2e9c4f
plan_head_after: c623ddae48ad044d43696f326603cf4db0312ca9

tech-stack:
  added: []
  patterns:
    - "Row steps share one table builder (recordTable): stated columns first, then unstated ones, an empty cell where a record lacks a column"
    - "A marketplace's source kind is recorded on the world when published; adding and breaking it dispatch on the recorded kind in features/lib"
    - "A source kind is a parameter type, so a misspelled kind is an undefined step the dry-run gate rejects in every row"

key-files:
  created:
    - features/lib/published-marketplace.ts
    - features/support/source-kind.ts
    - features/marketplace/list.feature
    - features/marketplace/add.feature
  modified:
    - features/step_definitions/command.steps.ts
    - features/step_definitions/marketplace/publishing.steps.ts (moved from features/step_definitions/marketplace.steps.ts)
    - features/support/world.ts
    - features/lib/path-marketplace.ts
    - features/marketplace/info.feature

key-decisions:
  - "The parameter type is named `source kind` with a space; Cucumber accepts it, so step text reads `{source kind}`"
  - "`the marketplace {string} offers these plugins:` republishes under the recorded kind and defaults to dir, so the plugin features keep working unchanged"
  - "The publish step registers the fixture release before writing, so a failed or partial write is still removed"

patterns-established:
  - "A verb-local step that needs a source kind calls publishMarketplace or invalidateManifest; a kind phase extends only features/lib"
  - "An empty result is read with its own step, never a header-only table"

requirements-completed: [DRV-01, DRV-02]

coverage:
  - id: D1
    description: "Marketplace rows of a cascade and of a marketplace-info-cascade are compared whole; a block with plugin rows fails the marketplace step; an empty cascade has its own step"
    requirement: DRV-01
    verification:
      - kind: e2e
        ref: "features/marketplace/info.feature#Info on a marketplace both scopes hold shows one block per scope, project first"
        status: pass
      - kind: e2e
        ref: "features/marketplace/list.feature#The list is empty when no marketplace is added"
        status: pass
      - kind: other
        ref: "planted checks 1(a)-(c) recorded below (each failed, reverted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "{home} and {scenario time} project in marketplace rows"
    requirement: DRV-02
    verification:
      - kind: e2e
        ref: "features/marketplace/info.feature#Info on a marketplace both scopes hold shows one block per scope, project first"
        status: pass
    human_judgment: false
  - id: D3
    description: "A marketplace is published as a dir or file source by one step and added through its recorded source; url and github rows are gate-checked but not run"
    verification:
      - kind: e2e
        ref: "features/marketplace/add.feature#Adding a marketplace records it in the chosen scope (npm run test:cucumber: 21 scenarios passed after Task 2)"
        status: pass
      - kind: other
        ref: "CI=1 npm run check:features (Feature gate passed: 23 scenarios, 12 step definitions after Task 2) and planted checks 2(a)-(b)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A scenario can break a published manifest, and info on it is compared whole as a failed plugin-info result"
    requirement: DRV-01
    verification:
      - kind: e2e
        ref: "features/marketplace/info.feature#Info on a marketplace whose manifest became invalid reports a failed invalid manifest row"
        status: pass
      - kind: other
        ref: "planted reasons-cell change recorded below (failed, reverted)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-15
status: complete
---

# Phase 1 Plan 03: Kind-Neutral Marketplace Steps Summary

**Marketplace scenarios now publish a marketplace as a `dir` or `file` source through one `{source kind}` step. The step records the source on the world, and the add step types it. Two new steps compare a result's marketplace rows whole or assert an empty list. The suite gained four seeds: LS-01, INFO-04, INFO-08, and the ADD-01 Outline. The Outline's `@url` and `@github` rows are checked by the gate but not run.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-15T20:00:49Z
- **Completed:** 2026-10-15T20:13:20Z
- **Tasks:** 3
- **Files modified:** 10 (4 created, 1 moved, 5 modified)

## Accomplishments

- `the result lists these marketplaces:` reads `marketplaces` of a `cascade` or `blocks` of a `marketplace-info-cascade`. Each block becomes one record of its flattened, token-projected fields, without `plugins`. Any other kind fails with the payload JSON. A cascade block with plugin rows fails and names `the result lists these plugins:`.
- `the result lists no marketplaces` passes only for one `cascade` whose `marketplaces` is `[]`.
- Both row steps now share `recordTable`. `blocks` joined `UNSTATED_FIELDS`.
- `features/lib/published-marketplace.ts` holds the source-kind dispatch:
  - `dir` writes the path fixture at `<marketplacesRoot>/<name>` and returns that directory.
  - `file` writes the same fixture and returns `.claude-plugin/marketplace.json` inside it.
  - `url` and `github` throw before any I/O.
  - Each switch lists all four kinds and has no `default`.
- `features/support/source-kind.ts` registers the `source kind` parameter type, which accepts only `dir|file|url|github`.
- The marketplace step module moved to `features/step_definitions/marketplace/publishing.steps.ts`. Adding a marketplace now types the recorded source. If the scenario never published the marketplace, the step fails.
- `writeInvalidManifest` rewrites the manifest as valid JSON with `plugins: "nope"`. `invalidateManifest` dispatches it per kind. The step `the manifest of the marketplace {string} has become invalid` calls it.

## Task Commits

1. **Task 1: Read a result's marketplace rows, and an empty result.** `a185d399` (test). Hook `check:commit` passed.
2. **Task 2: Publish a marketplace by source kind and seed the multi-kind Outline.** `f5134e57` (test). Hook `check:commit` passed. The commit records the deletion of `features/step_definitions/marketplace.steps.ts` (a `git mv` to `marketplace/publishing.steps.ts`).
3. **Task 3: Break a published manifest and read the failure through info.** `c623ddae` (test). Hook `check:commit` passed.

Before each commit, `SKIP=npm-check pre-commit run --files <changed files>` passed, and no fixer rewrote anything. `npx prettier --write` had already formatted `command.steps.ts` and `publishing.steps.ts`.

## Files Created/Modified

- `features/step_definitions/command.steps.ts`: `marketplaceRecords`, `recordTable`, and the two marketplace row steps. `blocks` is now hidden from `the result has these fields:`.
- `features/lib/published-marketplace.ts` (new): `SourceKind`, `parseSourceKind`, `PublishedMarketplace`, `publishMarketplace`, `invalidateManifest`.
- `features/support/source-kind.ts` (new): the `source kind` parameter type.
- `features/support/world.ts`: `recordPublished` and `publishedMarketplace`.
- `features/step_definitions/marketplace/publishing.steps.ts` (moved): four `Given` steps.
- `features/lib/path-marketplace.ts`: `writeInvalidManifest` and a private `manifestPath`.
- `features/marketplace/list.feature` (new): LS-01 seed.
- `features/marketplace/add.feature` (new): ADD-01 Outline with untagged dir/file Examples, an `@url` block, and a `@github` block.
- `features/marketplace/info.feature`: INFO-04 and INFO-08 seeds.

## Planted Checks (each run once by hand, then reverted; nothing planted was committed)

Task 1:

- **(a)** The two INFO-04 rows were swapped. Command: `npx cucumber-js --name 'one block per scope'`. Result: exit 1, `1 scenario (1 failed)`:
  ```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  ...
                'tools',
  +     'project',
  -     'user',
  ...
  +     'user',
  -     'project',
  ```
- **(b)** In LS-01, `the result lists no marketplaces` was replaced with `the result lists these marketplaces:` and the header-only table `| name | scope |`. Command: `npx cucumber-js --name 'The list is empty'`. Result: exit 1, `1 scenario (1 failed)`:
  ```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    [
  +   []
  -   [
  -     'name',
  -     'scope'
  -   ]
    ]
  ```
- **(c)** The first install.feature scenario's `the result lists these plugins:` was changed to `the result lists these marketplaces:`. Command: `npx cucumber-js --name 'Installing a plugin reports it installed in the chosen scope'`. Result: exit 1:
  ```
  AssertionError [ERR_ASSERTION]: marketplace fixtures has plugin rows; compare them with "the result lists these plugins:"
  ```

Task 2:

- **(a)** The `@url` row's kind was changed to `ulr`.
  - `npm run --silent check:features`: exit 1.
    ```
    features/marketplace/add.feature:8: undefined step "the marketplace \"tools\" is published as a ulr source" (.agents/skills/cucumber/rules/steps.md)
    Feature gate failed with 1 finding(s).
    ```
  - `npm run test:cucumber` on the same tree: exit 0, `21 scenarios (21 passed)`. No test run executes the row.
- **(b)** A temporary `features/marketplace/planted.feature` (deleted after the run) ran `Given the marketplace "ghost" is added to the project scope` without publishing `ghost`. Command: `npx cucumber-js features/marketplace/planted.feature`. Result: exit 1, `1 scenario (1 failed)`:
  ```
  AssertionError [ERR_ASSERTION]: the marketplace ghost is not published in this scenario
  ```

Task 3:

- The INFO-08 `plugin reasons` cell was changed to `unparseable`. Command: `npx cucumber-js --name 'manifest became invalid'`. Result: exit 1, `1 scenario (1 failed)`:
  ```
                'plugin reasons',
  +     'invalid manifest'
  -     'unparseable'
  ```

After each check, `cmp` against the saved copy (or `git diff --quiet`) confirmed the restored file.

## Verification

- After Task 1: `npm run test:cucumber` gave `19 scenarios (19 passed)`. `CI=1 npm run check:features` gave `Feature gate passed: 19 scenarios, 11 step definitions.`
- After Task 2: `21 scenarios (21 passed)`, and `Feature gate passed: 23 scenarios, 12 step definitions.`
- After Task 3 (final): `22 scenarios (22 passed)`, 155 steps, and `Feature gate passed: 24 scenarios, 13 step definitions.`
- `npx tsc --noEmit -p .` and `npx eslint --no-cache` on every changed `.ts` file exited 0 after each task. `npx fallow dead-code` exited 0 after Task 2.
- All 13 plugin scenarios still pass. Their Background publishes through the reshaped `offers these plugins:` and `is added to` steps.
- Acceptance greps: each marketplace step text appears once, `head -1` of each new feature is correct, `marketplace-info-cascade` appears once in info.feature, the old module path is gone, the new one exists, there are 4 published-marketplace exports, 2 `@url`/`@github` tag lines, 1 `writeInvalidManifest` export, 1 `invalidateManifest` export, and 1 `plugin-info` row. For `defineParameterType`, see the deviation below.
- The phase gate `npm run check` belongs to plan 01-05 and was not run here.

## Decisions Made

- The parameter type name `source kind` contains a space, and Cucumber accepts it, so the `source-kind` fallback was not needed.
- `offers these plugins:` republishes under the recorded kind and defaults to `dir`.
- Publishing registers the fixture's release before it writes.

## Deviations from Plan

**1. [Acceptance criterion wording] `grep -c "defineParameterType" features/support/source-kind.ts` prints `2`, not `1`.**
- **Found during:** Task 2 acceptance check.
- **Issue:** The module has to import `defineParameterType` from `@cucumber/cucumber` before it can call it, so the name appears on two lines.
- **Resolution:** No code change. The criterion's intent holds: the file registers exactly one parameter type.
- **Files modified:** none.

**Total deviations:** 1 (a criterion-wording mismatch, no code change). **Impact:** none.

## Issues Encountered

- A first `prettier --check` and `eslint` run passed the file list in one zsh variable. zsh does not split words, so both tools treated the list as one missing path and exited 2. The tools were re-run on explicit paths, and those runs are the results above.

## Known Stubs

- `features/lib/published-marketplace.ts`: the `url` and `github` arms of `publishMarketplace` and `invalidateManifest` throw `the <kind> source kind has no stand-in yet`. This is intentional (T-01-08). The kind phases (9-10) replace these arms with their stand-ins. Until then, `cucumber.json` excludes those rows, and the gate checks only their step text.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- Verb phases can publish, add, and break marketplaces, and can read marketplace rows or an empty list, without editing shared code.
- Kind phases add `url` and `github` by editing `features/lib/published-marketplace.ts` (plus their stand-ins). The `{git host}` token is still to come.
- Plan 01-04 continues the shared steps (envelope and rows-across-payloads, config reads). Plan 01-05 owns the skill docs and the `npm run check` phase gate.

## Self-Check: PASSED

- FOUND: features/lib/published-marketplace.ts, features/support/source-kind.ts, features/marketplace/list.feature, features/marketplace/add.feature, features/step_definitions/marketplace/publishing.steps.ts
- FOUND commits: a185d399, f5134e57, c623ddae

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-15*

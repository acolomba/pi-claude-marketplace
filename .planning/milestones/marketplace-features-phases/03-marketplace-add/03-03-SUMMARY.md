---
phase: 03-marketplace-add
plan: 03
subsystem: testing
tags: [cucumber, marketplace-add, marketplace-remove, local-config, gherkin, review, phase-gate]
status: complete

requires:
  - phase: 03-marketplace-add
    provides: the add verb module and the ADD-02/04/05/06/07 scenarios from 03-01 and 03-02
provides:
  - The ADD-13 add --local scenario in features/marketplace/add.feature
  - features/marketplace/remove.feature (Feature: Marketplace remove) with the remove --local scenario
  - A ten-entry cucumber review of add.feature and remove.feature, the ADD-01, ADD-03, and ADD-14 seeds included
  - The phase gate record (npm run check, fallow audit, unchanged production)
affects: [03.1 local-leak fix (FIX-02), 04 marketplace remove and list]

actuals:
  tokens: 660
  tasks: 2
  commits: 2
plan_head_before: 731b4a4b828bad84d59641406c5b20827fd41741
plan_head_after: c584048df9997aee54dc63a7eee10b3fefdb2c53

tech-stack:
  added: []
  patterns:
    - "A remove is shown by a sibling entry that stays: the existing whole-file read step proves only the removed entry is gone, with no zero-declaration step"

key-files:
  created:
    - features/marketplace/remove.feature
  modified:
    - features/marketplace/add.feature
    - features/step_definitions/marketplace/add.steps.ts

key-decisions:
  - "remove --local is shown with a second local entry that stays (Option 1), so no remove.steps.ts and no zero-declaration step exist"
  - "Both --local scenarios use the project scope and seed a base entry first, and neither starts a new session before its checks (D-06, D-08)"
  - "Review: the duplicated published-marketplace lookup in add.steps.ts and publishing.steps.ts is a recorded WARNING, because its fix touches publishing.steps.ts or world.ts, outside this plan's files"

requirements-completed: [ADD-01, ADD-03, ADD-13, ADD-14]

coverage:
  - deliverable: "ADD-13: add --local declares the marketplace only in claude-plugins.local.json; the base file keeps only its own entry"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Adding a marketplace with --local declares it only in the local configuration'"
        status: pass
  - deliverable: "ADD-13: remove --local clears only its local declaration; the other local entry and the base file stay"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Removing a marketplace with --local clears only its local declaration'"
        status: pass
  - deliverable: "ADD-01, ADD-03, ADD-14 seeds reviewed and passing in the phase gate"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm run check (41 scenarios (41 passed))"
        status: pass
  - deliverable: "Phase gate: combined tree, no production change, fallow audit pass"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm run check"
        status: pass
      - kind: command
        ref: "npx fallow audit --base 25d7ae50 (verdict)"
        status: pass
      - kind: command
        ref: "git diff --quiet 25d7ae50 HEAD -- extensions tests cucumber.json package.json package-lock.json"
        status: pass

duration: 7 min
completed: 2026-10-16
---

# Phase 3 Plan 03: The --local round trip, the add and remove review, and the phase gate Summary

**`add --local` now has a scenario that shows the marketplace declared only in the project scope's `claude-plugins.local.json`, with the base file keeping only the entry seeded before it. A new `features/marketplace/remove.feature` shows that `remove --local` clears only that one local entry: a second local entry and the base file stay. Neither scenario starts a new session, so neither reaches the D-08 leak. A cucumber review of all ten add and remove scenario blocks found no BLOCKER. It fixed one comment WARNING and recorded one WARNING. `npm run check` passes on the combined tree of the phase.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-16T12:54:55Z
- **Completed:** 2026-10-16T13:02:09Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- ADD-13 add: `Adding a marketplace with --local declares it only in the local configuration`. `extras` is added without `--local` first (D-06). Then `add {home}/marketplaces/tools --scope project --local` reports `tools | project | added` with an info envelope. The base file declares only `extras`, and the local file declares only `tools`.
- ADD-13 remove: `Removing a marketplace with --local clears only its local declaration`, in the new `Feature: Marketplace remove`. `base` is in the base file, and `tools` and `extras` are in the local file. `remove tools --scope project --local` reports `tools | project | removed`. The local file then declares only `extras`, and the base file still declares only `base`.
- The remove feature description covers the scopes, declarations, and installed plugins that a remove drops, so it stays true when the plugin and scope scenarios for remove join this file.
- No `features/step_definitions/marketplace/remove.steps.ts`: the remove scenario uses only shared steps (D-07).

## Task Commits

1. **Task 1: add --local declares only in the local file, and remove --local clears only that declaration (ADD-13)**: `ff94d4cf` (test). Hook `npm run check:commit`: Passed.
2. **Task 2: Cucumber review, then the phase gate (ADD-01, ADD-03, ADD-14)**: review fix `c584048d` (test). Hook `npm run check:commit`: Passed. The gate itself made no commit.

## Verification Results

| Command | Result |
| --- | --- |
| Task 1 `npx cucumber-js --parallel 1 --name 'Adding a marketplace with --local declares it only in the local configuration'` | exit 0, `1 scenario (1 passed)` |
| Task 1 `npx cucumber-js --parallel 1 --name 'Removing a marketplace with --local clears only its local declaration'` | exit 0, `1 scenario (1 passed)` |
| Task 1 `npm run test:cucumber` | exit 0, `41 scenarios (41 passed)` |
| Task 1 `CI=1 npm run check:features` | exit 0, `Feature gate passed: 51 scenarios, 21 step definitions.` |
| Task 2 `npm run test:cucumber` (after the review fix) | exit 0, `41 scenarios (41 passed)` |

Task 1 acceptance greps: the add scenario title: 1. `"claude-plugins.local.json" file of the project scope` in add.feature: 1. `head -1 features/marketplace/remove.feature`: `Feature: Marketplace remove`. The remove scenario title: 1. `pi session` in the add `--local` region: 0. `pi session` in remove.feature: 0. `test ! -e features/step_definitions/marketplace/remove.steps.ts`: succeeded.

The review fix changed a comment only, so the scenario and step counts stay at 41 run, 51 dry-run, and 21 step definitions.

## Phase Gate

Run alone on the final tree, with no other plan editing it. `git status --short -- features` printed nothing before and after.

| Command | Exit | Commit | Node | Scope |
| --- | --- | --- | --- | --- |
| `npm run check` (foreground, output in a scratchpad log, exit read directly) | 0 | `c584048d` | v26.11.1 | the combined tree of the phase, `25d7ae50..HEAD`, changes in `features/` only |
| `npx fallow audit --base 25d7ae50 --format json --quiet` piped into the verdict script from the plan | 0, `fallow audit verdict: pass` | `c584048d` | v26.11.1 | the same |
| `git diff --quiet 25d7ae50 HEAD -- extensions tests cucumber.json package.json package-lock.json` | 0 | `c584048d` | v26.11.1 | the same |

From the `npm run check` log, these stages passed: `lint`, `lint:workflows`, `fallow`, `format:check`, `test:corresponding`, and `check:features`. Then `test:unpaired`, `test:integration`, and `test:cucumber` ran, with `41 scenarios (41 passed)`, `324 steps (324 passed)`. Last, `test:coverage:direct:all` ran (`Merged LCOV: coverage/direct.lcov (280 records)`). The gate passed on its first run.

`git diff --stat 25d7ae50 HEAD -- . ':!.planning'` lists six files, all under `features/`.

## Planted Checks (each reverted, none committed)

Each check edited a feature file from a backup copy in the scratchpad. The backup was restored afterwards, and `cmp` confirmed the restore.

**(a) The row `tools | {home}/marketplaces/tools` added to the add scenario's base-file table.** `npx cucumber-js --parallel 1 --name 'Adding a marketplace with --local declares it only in the local configuration'` exited 1 with `1 scenario (1 failed)`, `10 steps (8 passed, 1 skipped, 1 failed)`. The failing step is the `claude-plugins.json` table, and the base file has no `tools` row:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected
...
-   [
-     'tools',
-     '{home}/marketplaces/tools'
-   ]
```

**(b) The remove scenario's local-file table listing both `extras` and `tools`.** `npx cucumber-js --parallel 1 --name 'Removing a marketplace with --local clears only its local declaration'` exited 1 with `1 scenario (1 failed)`, `13 steps (11 passed, 1 skipped, 1 failed)`. The failing step is `Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:` (`config.steps.ts:31`):

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected
...
-   [
-     'tools',
-     '{home}/marketplaces/tools'
-   ]
```

## Cucumber Review

The review applied the two questions from the cucumber skill to each scenario block. It also applied the typescript-style review to `add.steps.ts` and to the diffs of `features/lib/path-marketplace.ts` and `features/lib/published-marketplace.ts` since `25d7ae50`. Every table step compares whole values: `recordTable` puts each column that the table leaves out after the stated ones, so an unstated field fails the step. A cascade block with plugin rows also fails `the result lists these marketplaces:`.

1. **ADD-01 `Adding a marketplace records it in the chosen scope`: no finding.** The fixture publishes `tools` with an empty `plugins` list, and the result shows one `added` row and no plugin rows. The config row is compared with the typed `<source>` cell as an exact string. For the file row, that is the manifest path, so an implementation that records the directory fails. `{home}` is the only projection, applied by exact substring (`projectTokens`). An implementation that ignores `--scope` writes the user file and leaves the project file missing, and the config step fails on a missing file. "Under its manifest name": the fixture directory has the manifest's name, so ADD-01 alone cannot catch a name taken from the directory. The ADD-04 `tools-copy` row catches it, because such an add would succeed under `tools-copy`, and that row expects the error envelope and `duplicate name` (03-02 planted check Task 1 (a) showed that the refusal keys on the manifest name). The seed is unchanged.
2. **ADD-02 `Adding a marketplace without a scope records it in the user scope`: no finding.** A project default fails both the row and the user-file table.
3. **ADD-14 `Adding a marketplace by a home-relative path keeps the ~ form in the user configuration`: no finding.** The config row keeps `~/marketplaces/tools` unexpanded, so an implementation that stores the expanded path fails. The `added` row shows that `~` was resolved against the sandbox HOME, the only place the manifest exists. A path resolved against the cwd or any other root fails as `source missing`. The other scenarios in the file show the dir source at `{home}/marketplaces/tools`, so a reader can see where the `~` form leads.
4. **ADD-05 `Adding a marketplace the user scope holds to the project scope records it in both scopes`: no finding.** A duplicate check across scopes fails the envelope. A move instead of a copy fails the user-file table.
5. **ADD-13 `Adding a marketplace with --local declares it only in the local configuration` (new): no finding.** Both files are compared whole. A write to the base file fails planted check (a), and a write to the local file only in state leaves the local file missing. No new session runs before the checks (D-08).
6. **ADD-03 `An added marketplace is still listed in a new session`: no finding.** The new session rebuilds the extension runtime (`startSession`), so the list reads persisted state. The envelope pins `tally success count | 1`, and the row table lists exactly one row with every field the row carries. The requirement names dir and url, and the Outline has dir, file, `@url`, and `@github` rows. The empty list is covered by `The list is empty when no marketplace is added` in `list.feature`, which passes in the gate.
7. **ADD-04 `Adding a marketplace whose name the scope already holds fails as a duplicate name`: no finding.** The envelope, the failed row, and the unchanged project file are each compared whole (D-02).
8. **ADD-06 `Adding a path that holds no marketplace manifest fails as source missing, named as typed`: no finding.** The `~/` row tells "as typed" apart from "as resolved". It checks no config file, because these failures throw before anything is written (D-05).
9. **ADD-07 `Adding a marketplace with a malformed or schema-invalid manifest fails as invalid manifest`: no finding** in the feature. In `add.steps.ts`, the typescript-style review found two WARNINGs:
   - **Fixed in `c584048d`:** the module's `@fileoverview` cited "D-08 of the suite foundation", which names a planning phase by its title (comments.md). It now cites "D-08 in `.agents/skills/cucumber/rules/layout.md`". That is the rule file stating the decision, and it keeps D-08 distinct from this phase's own D-08.
   - **Recorded, not fixed:** `breakManifest` in `add.steps.ts` repeats the lookup-and-fail logic of `requirePublished` in `publishing.steps.ts` (the "is not published in this scenario" check). Under layout.md, a helper that a second module needs moves to `features/lib/`. The fix touches `publishing.steps.ts` or `support/world.ts`, which are outside this plan's five files. The steps behave correctly, so this is a WARNING.

   The quick scan of `add.steps.ts` and the two lib diffs found none of the listed tokens.
10. **ADD-13 `Removing a marketplace with --local clears only its local declaration` (new, remove.feature): no finding.** If a remove deletes the whole local file or clears every local entry, the `extras` table fails. If it touches the base file, the `base` table fails. If it leaves the removed entry, planted check (b) fails. Whether the record also leaves `marketplace list` is the core remove behavior, which the remove scenarios of the next phase own.

No BLOCKER was found. `.agents/skills/cucumber/rules/features.md` quotes the ADD-01 Outline, and the Outline did not change, so the quote still matches.

## Decisions Made

- Option 1 for `remove --local`: a second local entry that stays. The existing whole-file read step proves that only the removed entry is gone. No zero-declaration step and no remove step module were needed.
- The remove feature description follows the research sketch, reworded to three lines.
- Both `--local` scenarios use the project scope, whose base file a team commits.

## Deviations from Plan

None - plan executed exactly as written.

## Hermeticity Review

- The project scope is `<sandbox cwd>/.pi`: `ScenarioWorld.scopeRoot("project")` reads there, and Pi runs with the sandbox project directory as its cwd. The repository's own `.pi/` is never a target. `git status --short` stayed clean after every run (T-03-10).
- Every fixture path is `{home}/marketplaces/<name>` under the sandbox HOME. No step reads or writes the real HOME, `~/.pi/agent`, or git config.
- No `--local` scenario reloads or starts a new session, so neither pins the D-08 leak as intended behavior (T-03-11). The leak's fix belongs to FIX-02.

## Issues Encountered

None.

## Next Phase Readiness

Phase 3's plans are all complete, and the phase is ready for verification. Phase 3.1 (FIX-02) can add its reload scenario beside the `--local` add scenario, and the remove scenarios of Phase 4 join `features/marketplace/remove.feature`. The recorded WARNING (the duplicated published lookup) is a small move to `features/lib/` for whichever plan next edits `publishing.steps.ts`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/marketplace/remove.feature, features/marketplace/add.feature, features/step_definitions/marketplace/add.steps.ts
- FOUND: ff94d4cf, c584048d (both ancestors of HEAD)
- Commits measured: `git rev-list --count 731b4a4b..HEAD` = 2

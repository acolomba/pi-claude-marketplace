---
phase: 01-suite-foundation
plan: 03
subsystem: testing
tags: [cucumber, result-rows, plugin-info-cascade, prune-empty, retry-setup]

requires:
  - phase: 01-suite-foundation
    provides: "Plan 02: features/lib/result-rows.ts (pluginRowRecords and its kind dispatch), runCommandPayloads"
provides:
  - "Step: Given the user has run {string}, which failed (every payload must be an error)"
  - "pluginRowRecords reads plugin-info-cascade blocks, one record per block, named as a single plugin-info result's fields"
  - "Seed: features/marketplace/failed-add.feature 'Adding a marketplace succeeds once its invalid manifest is repaired'"
  - "Seed: features/plugin/info.feature 'Info on a plugin installed in both scopes shows its installation in each'"
  - "Seed: features/plugin/prune.feature 'Pruning a scope with nothing to remove reports the empty result'"
  - "The marketplace repair step moved to the publishing topic module, shared by add and update"
affects: [install, uninstall, info, prune, marketplace-add, rollback, git-source]

actuals:
  tokens: 4083
  tasks: 2
  commits: 3
plan_head_before: 2df840e93c5f08230f3c355ed047287c76396b0a
plan_head_after: d1a2d2eabf5913411e9bd68b6b176e5b12498f5e

tech-stack:
  added: []
  patterns:
    - "A retry scenario states its failed first attempt as a Given that asserts every payload is an error"
    - "An info fan-out's blocks are rows: marketplace-info-cascade for the marketplace row step, plugin-info-cascade for the plugin row step"

key-files:
  created:
    - features/marketplace/failed-add.feature
    - features/plugin/info.feature
    - features/plugin/prune.feature
  modified:
    - features/step_definitions/command.steps.ts
    - features/lib/result-rows.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/step_definitions/marketplace/update.steps.ts
    - .agents/skills/cucumber/rules/steps.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "The repair step 'the marketplace {string} source is repaired with a changed valid manifest' moved from marketplace/update.steps.ts to marketplace/publishing.steps.ts in its own commit, because marketplace add now uses it too (D-08)"
  - "The two row-step dispatchers share requireMarketplaceBlocks and infoBlockRecords, so fallow dupes stays at zero clone groups"
  - "The failing-setup Given relies on runCommandPayloads to refuse an empty payload list, so it only checks that no payload is a non-error"

patterns-established:
  - "Retry: Given <cause> -> Given the user has run <command>, which failed -> Given <cause removed> -> When the same command -> Then the whole success result"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "A setup command that must fail fails the scenario when it succeeds; a marketplace add retried after its manifest is repaired succeeds"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/marketplace/failed-add.feature (1 scenario passed)"
        status: pass
      - kind: other
        ref: "planted check: without the invalid manifest, the failing-setup step fails and shows the info cascade"
        status: pass
    human_judgment: false
  - id: D2
    description: "The plugin row step reads plugin-info-cascade blocks; info on a plugin in both scopes lists both installations"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/plugin/info.feature (1 scenario passed, two rows)"
        status: pass
      - kind: other
        ref: "planted check: the plugin-info-cascade case returning no records fails the info seed"
        status: pass
    human_judgment: false
  - id: D3
    description: "The prune-empty result is compared whole by the field step"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/plugin/prune.feature (1 scenario passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step is used, the feature gate stays green, and the whole suite passes"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features; commit hooks npm run check:commit on 5d45cbaf, ad71c0bd, d1a2d2ea"
        status: pass
      - kind: integration
        ref: "npm run test:cucumber (437 scenarios passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The cucumber skill states the failing-setup rule and which step reads each payload kind"
    verification:
      - kind: other
        ref: "grep -c 'which failed' .agents/skills/cucumber/rules/steps.md; grep -c prune-empty .agents/skills/cucumber/rules/world-and-stand-ins.md"
        status: pass
    human_judgment: true
    rationale: "Whether the rule text reads clearly is a wording judgment no check asserts"

duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 03: Failing Setup and Plugin Info Rows Summary

**A new `Given the user has run {string}, which failed` step lets retry scenarios state a failed first attempt, `the result lists these plugins:` now reads `plugin-info-cascade` blocks, and three seed features prove both and the `prune-empty` result.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-23T02:52:02Z
- **Completed:** 2026-10-23T03:02:39Z
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `features/step_definitions/command.steps.ts`: the failing-setup `Given` runs the expanded command with `runCommandPayloads` and compares the list of non-error payloads with `[]`, so an unexpected success shows its payloads whole. It keeps nothing on the world.
- `features/lib/result-rows.ts`: `pluginRowRecords` returns one record per `plugin-info-cascade` block, `fieldRecord(flatten(block, tokens))`, so the columns are the field names of a single `plugin-info` result. The checks that both row dispatchers share are now `requireMarketplaceBlocks` and `infoBlockRecords`.
- Three seed features: `marketplace/failed-add.feature` (owned by Phase 15 next), `plugin/info.feature` (Phase 10), and `plugin/prune.feature` (Phase 12).
- The cucumber skill: `steps.md` has the failing-setup rule, and `world-and-stand-ins.md` says which step reads each payload kind and that the field steps compare the kinds without a row array.

## Task Commits

1. **Deviation commit: share the repair step** - `5d45cbaf` (test), `test(features): share the step that repairs a marketplace source`. Hook: `npm run check:commit` Passed, gitlint Passed.
2. **Task 1: A setup command that must fail, seeded by a marketplace add retried after its manifest is repaired** - `ad71c0bd` (test), `test(features): run a setup command that must fail`. Hook: `npm run check:commit` Passed, gitlint Passed. Tracer gate: re-ran `npx cucumber-js features/marketplace/failed-add.feature` (1 passed) and `npm run check:features` (exit 0) after the commit.
3. **Task 2: Read the blocks of a plugin info fan-out, and seed info in two scopes and an empty prune** - `d1a2d2ea` (test), `test(features): read the blocks of a plugin info fan-out`. Hook: the first attempt failed `npm run check:commit` with `gate duplication-findings (1 against 0)` (fallow dupes: `result-rows.ts` lines 90-100 and 112-130, the info-cascade branch plus the marketplace-blocks check in both row dispatchers). No commit was made. After the refactor below, the retry passed: `npm run check:commit` Passed, gitlint Passed.

## Final Text of New Steps

- `Given the user has run {string}, which failed` (in `features/step_definitions/command.steps.ts`).

Changed behavior, same text: `Then the result lists these plugins:` reads `plugin-info-cascade` blocks. Moved, same text and body: `Given the marketplace {string} source is repaired with a changed valid manifest` (now in `features/step_definitions/marketplace/publishing.steps.ts`).

## Seed Results

- **failed-add:** the retry reports `cascade`, info, needs reload `false`, the row `tools` / `project` / `added`, and the project `claude-plugins.json` declares `tools` at `{home}/marketplaces/tools`. The retry succeeding shows that the failed add left no record behind.
- **info:** `plugin-info-cascade`, info, needs reload `false`, two blocks in this order: project, then user. Each block: marketplace `fixtures`, marketplace scope equal to the plugin scope, `marketplace details autoupdate` `false`, `demo@fixtures`, `demo`, `installed`, no reasons, version `1.0.0`, `plugin components resolved` `true`, `plugin components skills` `demo-skill`. Every column is stated.
- **prune:** `prune-empty`, info, needs reload `false`, scope `project`. Prune needed no setup: it answers with no marketplace or plugin in the scope.

## Planted Checks

1. **Failing setup that succeeds (Task 1).** I deleted `Given the manifest of the marketplace "tools" to add is not valid json`, ran `npx cucumber-js features/marketplace/failed-add.feature` (exit 1), and restored the file from a backup:

   ```
   Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project", which failed # features/step_definitions/command.steps.ts:43
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       + [
       +   {
       +     kind: 'cascade',
       +     marketplaces: [ { name: 'tools', plugins: [], scope: 'project', status: 'added' } ],
       +     needsReload: false, ... severity: 'info'
       +   }
       + ]
       - []
   1 scenario (1 failed)
   9 steps (3 passed, 5 skipped, 1 failed)
   ```

2. **No plugin-info-cascade records (Task 2).** I made the `plugin-info-cascade` branch return `[]`, ran `npx cucumber-js features/plugin/info.feature` (exit 1), and restored the file from a backup. I ran it on the first version and again after the refactor, with the same result:

   ```
   Then the result lists these plugins: # features/step_definitions/command.steps.ts:68
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
         [
       +   []
       -   [ 'marketplace name', 'marketplace scope', 'marketplace details autoupdate', ... ],
   1 scenario (1 failed)
   11 steps (10 passed, 1 failed)
   ```

## Files Created/Modified

- `features/marketplace/failed-add.feature` - `Feature: Marketplace failed add` and the retry seed
- `features/plugin/info.feature` - `Feature: Plugin info` and the two-scope seed
- `features/plugin/prune.feature` - `Feature: Plugin prune` and the empty-prune seed
- `features/step_definitions/command.steps.ts` - the failing-setup `Given`; the file overview mentions it
- `features/lib/result-rows.ts` - the `plugin-info-cascade` case and the two shared helpers
- `features/step_definitions/marketplace/publishing.steps.ts` - gains the repair step
- `features/step_definitions/marketplace/update.steps.ts` - loses the repair step
- `.agents/skills/cucumber/rules/steps.md` - the failing-setup rule
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - which step reads each payload kind

## Decisions Made

- I moved the repair step to the publishing topic module before using it from the add feature. That module already holds the similar step `the manifest of the marketplace {string} has become invalid`.
- The skill sentence says "a new kind with a `marketplaces` or `blocks` row array fails", not "a new kind with a row array", because `rowArrays` only flags those two field names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, CLAUDE.md-driven] Moved the repair step to the publishing topic module**

- **Found during:** Task 1
- **Issue:** the seed uses `the marketplace {string} source is repaired with a changed valid manifest`, which lived in the `marketplace/update.steps.ts` verb module. The cucumber layout rule D-08 says that when a second verb needs a step of a verb module, the work that finds the second use moves it to the shared topic module, in a commit of its own.
- **Fix:** moved the registration, unchanged, to `marketplace/publishing.steps.ts` (which already imports `rewritePublishedManifest`). `update.steps.ts` still uses that import for another step.
- **Files modified:** features/step_definitions/marketplace/publishing.steps.ts, features/step_definitions/marketplace/update.steps.ts (not in the plan's `files_modified`)
- **Verification:** `npm run check:features` exit 0; the commit hook passed; the full suite passed.
- **Committed in:** 5d45cbaf

**2. [Rule 3 - Blocking] Removed the clone that fallow dupes found in result-rows.ts**

- **Found during:** Task 2 (commit hook)
- **Issue:** the new `plugin-info-cascade` branch made `pluginRowRecords` and `marketplaceRowRecords` one 19-line clone group (`dup:bfc72405`), and `check:commit` fails on any clone group.
- **Fix:** extracted `requireMarketplaceBlocks(result, infoKind)` (an assertion function) and `infoBlockRecords(blocks, tokens)`. The failure messages are unchanged.
- **Files modified:** features/lib/result-rows.ts
- **Verification:** `npx fallow dupes` found no duplication; the marketplace info, plugin info, prune, and install features passed (25 scenarios); the planted check still failed the info seed; the retried hook passed.
- **Committed in:** d1a2d2ea

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No change to scope. The step text that later phases use did not change.

## Issues Encountered

None beyond the deviations above.

## Bug Candidates

None found. Every observed value matches the scenario titles. One point for Phase 10 to check against Claude Code: the info fan-out lists the project block before the user block.

## Plan-level Verification

- `npx cucumber-js features/marketplace/failed-add.feature features/plugin/info.feature features/plugin/prune.feature`: each passed in its task run.
- `npm run check:features`: exit 0 on the final tree.
- `npm run test:cucumber`: 437 scenarios passed, 4109 steps passed (exit 0, final tree).
- I did not run `npm run check`. That is the wave gate after wave 3.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Phases 4, 5, 12, and 15 can write retry scenarios with `Given the user has run <command>, which failed`.
- Phase 10 can compare plugin info fan-outs with `the result lists these plugins:`, and Phase 12 extends `prune.feature`.
- Ready for the next wave 3 plan (01-04 or 01-05).

## Self-Check: PASSED

- FOUND: features/marketplace/failed-add.feature, features/plugin/info.feature, features/plugin/prune.feature, features/lib/result-rows.ts, features/step_definitions/command.steps.ts
- FOUND: 5d45cbaf, ad71c0bd, d1a2d2ea (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*

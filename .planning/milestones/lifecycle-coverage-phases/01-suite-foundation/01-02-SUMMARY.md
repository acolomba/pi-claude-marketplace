---
phase: 01-suite-foundation
plan: 02
subsystem: testing
tags: [cucumber, rpc, get_entries, reconcile, result-rows]

requires:
  - phase: 01-suite-foundation
    provides: "Plan 01: plugin topic module layout and the parallel-work ownership rule"
provides:
  - "startSession(pi): Promise<SessionReport> reads a new session's payloads through RPC get_entries, each validated (DRV-01), duplicates kept"
  - "features/lib/result-rows.ts: rowArrays, envelopeFields, pluginRowRecords, marketplaceRowRecords, resultsRowRecords, resultsTable"
  - "World: resultsSource, recordResults(results, source), resultsOf(source)"
  - "Step: Then the session reports these results:"
  - "Row steps read reconcile-applied-cascade rows"
  - "Seed: features/plugin/reconcile.feature 'A new session installs a plugin that a config declares by hand and reports it'"
affects: [reconcile, marketplace-remove, uninstall, update, configuration]

actuals:
  tokens: 11415
  tasks: 2
  commits: 2
plan_head_before: 9b2adfc227eb462d985daced2c5fe144cb627c1b
plan_head_after: 543022fc07a898e89d39e5b1113e46da6d5c715e

tech-stack:
  added: []
  patterns:
    - "A new session's payloads are the last results, like a command's, so the uncompared-rows contract covers sessions"
    - "Result projections shared by step modules live in features/lib/result-rows.ts"

key-files:
  created:
    - features/lib/result-rows.ts
    - features/plugin/reconcile.feature
  modified:
    - features/lib/pi-commands.ts
    - features/support/world.ts
    - features/support/pi-process.ts
    - features/step_definitions/session.steps.ts
    - features/step_definitions/command.steps.ts
    - features/plugin/configuration.feature
    - features/marketplace/update.feature
    - features/marketplace/remove.feature
    - features/plugin/uninstall.feature
    - features/plugin/update.feature
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .planning/ROADMAP.md

key-decisions:
  - "The session driver keeps both copies of a lasting reconcile failure (Pi's RPC new_session binds the extension twice); scenarios state both rows"
  - "resultsSource is an inline 'command' | 'session' union on the world, not an exported type, so fallow sees no unused export or private type leak"
  - "The reconcile seed states the installed row as observed, without a version; the missing version is recorded for Phase 11, not fixed"

patterns-established:
  - "Session results: When the user starts a new pi session -> the session reports these results: (one row per payload) -> the results list these marketplaces and plugins: (rows across payloads)"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "A new session's reconcile report travels from Pi through get_entries, schema validation, the world, and the row steps into the passing reconcile seed"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/plugin/reconcile.feature (1 scenario passed)"
        status: pass
      - kind: other
        ref: "planted check: startSession returning no payloads fails the seed (expected exactly one result, got [])"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uncompared session rows fail a scenario; the six existing scenarios compare their session reports whole"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npm run test:cucumber (434 scenarios passed)"
        status: pass
      - kind: other
        ref: "planted check: removing the row step from the uninstall scenario fails with 'no step compared these rows of the last results'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every new step is used and the feature gate stays green"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features; commit hook npm run check:commit on 003af429"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cucumber skill and ROADMAP Untouched note describe session results and the two untouched files Phase 1 edits"
    verification:
      - kind: other
        ref: "grep -c get_entries .agents/skills/cucumber/rules/world-and-stand-ins.md; grep -c marketplace/update.feature .planning/ROADMAP.md"
        status: pass
    human_judgment: true
    rationale: "Whether the rule text reads clearly is a wording judgment no check asserts"

duration: 11min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 02: New-Session Results Summary

**`startSession` reads a new session's own payloads through Pi's RPC `get_entries`, the session `When` keeps them as the last results, the row steps read `reconcile-applied-cascade`, and the new step `the session reports these results:` lets six existing scenarios and a reconcile seed compare session reports whole.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-23T02:37:14Z
- **Completed:** 2026-10-23T02:48:00Z
- **Tasks:** 2
- **Files modified:** 14 (2 created, 12 modified)

## Accomplishments

- `features/lib/pi-commands.ts`: `startSession` sends `new_session`, `get_commands`, then `get_entries`, validates the response shape with a compiled schema, keeps the `custom` entries with `customType` `claude-plugin`, validates each payload (DRV-01), and returns `{ skills, payloads }` in session order. The per-payload validation is one private helper (`claudePluginPayloads`) that `runCommandPayloads` shares.
- `features/lib/result-rows.ts` (new): the row-array and envelope projections moved from `command.steps.ts`. A result with marketplace blocks is a `cascade` or a `reconcile-applied-cascade`. The record shapes did not change, so no existing table changed.
- `features/support/world.ts`: `recordResults(results, source)` asserts that the previous rows and notices were compared, then keeps the new results; `resultsOf(source)` refuses results from the other source. `lastResult()` and `allResults()` now say "no command or session has run in this scenario".
- `features/support/pi-process.ts`: the `Before()` reset asserts `payloads: []` for its reset session.
- `Given the user has started a new pi session` asserts that every payload is info.
- Six existing scenarios state their session reports; `features/plugin/reconcile.feature` adds the seed.

## Task Commits

1. **Task 1: A new session's reconcile report reaches the row steps, end to end** - no commit of its own, by plan design. Its files are in `003af429`.
2. **Task 2: State the session reports of the six existing scenarios, document the session results, and commit both tasks** - `003af429` (test), `test(features): read and compare the reports of new sessions`. Hook: the first attempt failed `npm run check:commit` (lint, `import-x/order`: no blank line between the parent and sibling import groups in `world.ts`). After the fix the retry passed, with `npm run check:commit` Passed and gitlint Passed.
   - `543022fc` (docs), `docs(planning): note the feature files edited before parallel work`. Hook: `npm run check:commit` Skipped (not a build input), gitlint Passed.

## Final Text of New Steps

- `Then the session reports these results:` (in `features/step_definitions/session.steps.ts`). It builds one row per session payload with `resultsTable` from `this.resultsOf("session")`, then calls `markNoticesCompared()`.

Changed behavior, same text: `When the user starts a new pi session` (records payloads, source `session`), `Given the user has started a new pi session` (every payload info), `Then the command reports these results:` (refuses session results), and `the result lists these plugins:`, `the result lists these marketplaces:`, and `the results list these marketplaces and plugins:` (accept `reconcile-applied-cascade`).

Final `result-rows.ts` exports: `rowArrays`, `envelopeFields`, `pluginRowRecords`, `marketplaceRowRecords`, `resultsRowRecords`, `resultsTable`.

## Planted Checks

1. **Session without payloads (Task 1).** I changed `startSession` to return `claudePluginPayloads(custom).slice(0, 0)`, ran `npx cucumber-js features/plugin/reconcile.feature` (exit 1), and restored the file from a backup:

   ```
   Then the result has these fields: # features/step_definitions/command.steps.ts:47
       AssertionError [ERR_ASSERTION]: expected exactly one result, got []
   1 scenario (1 failed)
   10 steps (7 passed, 2 skipped, 1 failed)
   ```

2. **Uncompared session rows (Task 2).** I removed `Then the results list these marketplaces and plugins:` and its table from "Uninstalling a plugin whose dependency's declarations cannot be read fails and changes nothing", ran `npx cucumber-js features/plugin/uninstall.feature --name "dependency's declarations cannot be read"` (exit 1), and restored the file:

   ```
   AssertionError [ERR_ASSERTION]: no step compared these rows of the last results
   +   'reconcile-applied-cascade marketplaces',
   +   'reconcile-applied-cascade marketplaces'
   1 scenario (1 failed)
   ```

## Stated Session Reports

Each of the six scenarios reports two identical `reconcile-applied-cascade` payloads with severity `error`, needs reload `false`, summary `A plugin operation has failed.`, tally `Reconcile`, 1 failure, and 0 warnings. Their rows:

| Scenario | File | Row (stated twice) |
| --- | --- | --- |
| A new session does not install a plugin whose local layer lacks its marketplace | plugin/configuration.feature | `claude-plugins.local.json` failed, `invalid manifest`, with the cause chain naming the missing local marketplace |
| Autoupdate keeps a plugin removed from the catalog (4 examples) | marketplace/update.feature | `demo@tools` failed, `unreadable`, project |
| An invalid refreshed manifest leaves installed plugins unchanged (4 examples) | marketplace/update.feature | `demo@tools` failed, `unreadable`, `<scope>` |
| Removing a marketplace whose dependency declarations cannot be read fails and changes nothing | marketplace/remove.feature | `lib@tools` failed, `unreadable`, project |
| Uninstalling a plugin whose dependency's declarations cannot be read fails and changes nothing | plugin/uninstall.feature | `lib@tools` failed, `unreadable`, project |
| Updating every plugin with --local fails and updates nothing when the dependencies of a local plugin cannot be read | plugin/update.feature | `lib@tools` failed, `unreadable`, project |

The seed reports one `reconcile-applied-cascade`, info, tally `Reconcile` with success count 1, and the row `demo@fixtures` `installed` with no reasons. No other scenario needed a comparison: the whole suite passed with 434 scenarios.

## Bug Candidates

I stated each of these as observed and did not fix it. None of them blocks a seed of this plan.

1. **The reconcile `installed` row has no version** (seed in `plugin/reconcile.feature`). An install command's row carries `version 1.0.0`, but the reconcile row for the same install has no `version`. Owner: Phase 11 (reconcile).
2. **Reconcile reports `failed` / `unreadable` for a plugin that is still installed and declared** (`marketplace/update.feature`, both Outlines). In "Autoupdate keeps a plugin removed from the catalog", every new session reports `demo@tools` as failed with `unreadable` and severity error, but the plugin stays installed and offers its skill. The reason does not match the cause either: the catalog dropped the plugin (`not in manifest`), and nothing is unreadable. Owner: Phase 11 (reconcile). The update-side behavior belongs to Phase 7.
3. **Reconcile reports a failure for an installed dependency when the marketplace manifest is invalid** (remove, uninstall, and plugin update scenarios). `lib@tools` is reported as failed `unreadable` on every new session, with no `cause chain`. The command's own failure row carries one (`cannot read the dependencies of lib@tools: its marketplace manifest is invalid`). Owner: Phase 11 (reconcile). The verbs' own failures belong to Phase 15 (marketplace remove), Phase 6 (uninstall), and Phase 7 (update).
4. **A lasting failure is reported twice per new session.** This is Pi RPC behavior (`new_session` binds the extension twice), not a product bug. Re-measure it if the Pi peer is upgraded.

## Files Created/Modified

- `features/lib/result-rows.ts` - the row-array and envelope projections shared by the command and session steps
- `features/plugin/reconcile.feature` - `Feature: Plugin reconcile` with the seed scenario (Phase 11 owns it after this phase)
- `features/lib/pi-commands.ts` - `SessionReport`, and `startSession` reading `get_entries`
- `features/support/world.ts` - `resultsSource`, `recordResults`, `resultsOf`
- `features/support/pi-process.ts` - the reset asserts that the reset session reports no payload
- `features/step_definitions/session.steps.ts` - records session results, asserts that setup sessions report only info, and adds the session results step
- `features/step_definitions/command.steps.ts` - uses the lib helpers; `When the user runs` calls `recordResults`
- Five feature files - the six scenarios' session comparisons
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - the session driver, session results, and the steps that refuse the other source
- `.planning/ROADMAP.md` - the **Untouched** note names the two files Phase 1 edits

## Decisions Made

- Kept the duplicate reconcile payloads and stated both rows, as the plan and research require.
- Inlined the `"command" | "session"` union on the world rather than export a type that nothing outside the file uses.
- Renamed the failure message of `the results list these marketplaces and plugins:` to name both kinds with marketplace blocks. No feature file asserts the message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing blank line between the import groups in world.ts**

- **Found during:** Task 2 (feature commit)
- **Issue:** the commit hook's ESLint `import-x/order` rule rejected the new `../lib/result-rows.ts` import, because no blank line separated it from the sibling `./pi-process.ts` import.
- **Fix:** I added the blank line and re-ran the commit. No commit was made before the fix.
- **Files modified:** features/support/world.ts
- **Verification:** `npx eslint features/support/world.ts`; the retried hook passed.
- **Committed in:** 003af429

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** None. It was a formatting rule caught by the hook.

## Issues Encountered

- My table aligner, run over whole feature files, padded one existing CJK cell in `marketplace/update.feature` (line 251) by character count. I reverted that line before the commit, so the commit changes no existing table.

## Plan-level Verification

- `npm run test:cucumber`: 434 scenarios passed, 4084 steps passed (exit 0, final tree).
- `npm run check:features`: exit 0.
- One commit (`003af429`) carries the feature changes of both tasks. The ROADMAP note has its own docs commit (`543022fc`), which changes only `.planning/ROADMAP.md`.
- I did not run `npm run check` (the phase gate). The commit hook ran `check:commit`, which includes typecheck, lint, fallow, format, and `check:features`.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Phases 11 and 15 can compare reconcile reports with `When the user starts a new pi session`, `the session reports these results:`, and the row steps.
- Bug candidates 1-3 above are open for Phase 11, and for Phases 6, 7, and 15 on the verb side.

## Self-Check: PASSED

- FOUND: features/lib/result-rows.ts, features/plugin/reconcile.feature, features/lib/pi-commands.ts, features/support/world.ts
- FOUND: 003af429, 543022fc (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*

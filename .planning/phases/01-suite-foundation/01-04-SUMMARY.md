---
phase: 01-suite-foundation
plan: 04
subsystem: testing
tags: [cucumber, gherkin, behavioral-tests, marketplace, config]

requires:
  - phase: 01-suite-foundation (01-01)
    provides: "runCommandPayloads (every payload, schema-checked), run tokens, ScenarioWorld"
  - phase: 01-suite-foundation (01-02)
    provides: "check:features gate (unused/undefined/ambiguous steps over every row)"
  - phase: 01-suite-foundation (01-03)
    provides: "recordTable, pluginRecords, publish/add-by-kind steps, the source kind parameter type"
provides:
  - "Step `the command reports these results:`: one envelope row per payload in emission order (D-02)"
  - "Step `the results list these marketplaces and plugins:`: marketplace and plugin rows across every cascade payload (D-02)"
  - "Step `the {string} file of the {word} scope declares these marketplaces:`: read-only config comparison (D-07)"
  - "Step `the user has started a new pi session` (setup Given)"
  - "features/lib/field-rows.ts: flatten, namesLike, isPlainObject, recordTable"
  - "ScenarioWorld.allResults() and ScenarioWorld.scopeRoot(scope)"
  - "Seeds: UPD-07 (update.feature), ADD-14 and the ADD-03 Outline (add.feature)"
affects: [01-05, marketplace verb phases, kind phases]

actuals:
  tokens: 4841
  tasks: 3
  commits: 3
plan_head_before: c0a219430a8bd028895ac14c52c1174b0079bc47
plan_head_after: 788d567626db37374e1dbdddb3f07bf288dd4eaa

tech-stack:
  added: []
  patterns:
    - "A multi-payload result is read in two whole-value steps: an envelope table (count, order, kind of every payload) and a rows table across every payload"
    - "Field-row helpers live in features/lib/field-rows.ts, shared by the command and config step modules"
    - "A config step resolves its path only through ScenarioWorld.scopeRoot and an allow-list of two file names"

key-files:
  created:
    - features/lib/field-rows.ts
    - features/step_definitions/config.steps.ts
    - features/marketplace/update.feature
  modified:
    - features/step_definitions/command.steps.ts
    - features/step_definitions/session.steps.ts
    - features/support/world.ts
    - features/marketplace/add.feature

key-decisions:
  - "The envelope step and `the result has these fields:` share one envelopeFields helper, so both hide exactly the UNSTATED_FIELDS set"
  - "The config step fails on a missing file and names its path: an absent claude-plugins.json is rebuilt from the extension's records on the next load (MIG-01), so it is not an empty declaration"
  - "The config step also fails when the file has no `marketplaces` object; an empty map yields no rows and so fails any table"

patterns-established:
  - "Multi-payload commands: `the command reports these results:` then `the results list these marketplaces and plugins:`"
  - "A setup Given that starts a session relies on startSession's own assertions and keeps nothing on the world"

requirements-completed: [DRV-01, DRV-02]

coverage:
  - id: D1
    description: "A bare update's payloads are compared whole: count, order, kinds, envelope fields, and every marketplace row across payloads (D-02)"
    requirement: DRV-01
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A bare update refreshes every marketplace of both scopes, project first"
        status: pass
      - kind: other
        ref: "planted checks 1(a) row deletion and 1(b) row swap, recorded below (each failed, reverted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A scope's claude-plugins.json declarations are compared whole and read only; a missing file fails naming its path; an unknown file name throws (D-07); the ~ form reads back as typed (D-04)"
    requirement: DRV-02
    verification:
      - kind: e2e
        ref: "features/marketplace/add.feature#Adding a marketplace by a home-relative path keeps the ~ form in the user configuration"
        status: pass
      - kind: other
        ref: "planted checks 2(a)-(c), recorded below (each failed, reverted)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A new session as setup; an added marketplace is still listed after it with {scenario time} in its row (DRV-02)"
    requirement: DRV-02
    verification:
      - kind: e2e
        ref: "features/marketplace/add.feature#An added marketplace is still listed in a new session (dir, file)"
        status: pass
      - kind: other
        ref: "CI=1 npm run check:features: Feature gate passed: 29 scenarios, 17 step definitions; planted scope change recorded below"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-15
status: complete
---

# Phase 1 Plan 04: Multi-Payload, Config, and Session Steps Summary

**Two D-02 steps now compare a multi-payload result whole: an envelope row for each payload, then the marketplace and plugin rows across every payload. A read-only D-07 step compares the marketplaces a scope's config file declares. A missing file fails that step. A setup `Given` starts a new Pi session. Three seeds give each new step its first use: UPD-07, ADD-14, and the ADD-03 Outline.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-15T20:16:12Z
- **Completed:** 2026-10-15T20:28:52Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `the command reports these results:` builds one record for each payload of `allResults()`, in emission order. Each record holds every field except `schemaVersion`, `origin`, `marketplaces`, and `blocks`, flattened and token-projected. The step compares the whole table, so the table pins how many payloads there are, their order, and their kinds. Two identical payloads stay two rows. When one payload lacks a field, its cell is empty.
- `the results list these marketplaces and plugins:` requires every payload to be a cascade. If one is not, the step fails, names the payload's kind, and prints its JSON. The rows are `pluginRecords` of each payload, in order.
- `features/lib/field-rows.ts` now holds `fieldWords`, `isPlainObject`, `cell`, `flatten`, `namesLike`, and `recordTable`. Of these, it exports `flatten`, `namesLike`, `isPlainObject`, and `recordTable`. `pluginRecords` and `UNSTATED_FIELDS` stay in `command.steps.ts`.
- `ScenarioWorld.scopeRoot(scope)` returns the sandbox agent directory for `user` and `<sandbox cwd>/.pi` for `project`. Any other scope throws.
- `the {string} file of the {word} scope declares these marketplaces:` accepts only `claude-plugins.json` and `claude-plugins.local.json`. It asserts that the file exists and names the path when it does not. It also requires a `marketplaces` object. It compares one row for each declared marketplace: `name` plus every key of its entry. The module never writes a file.
- `Given the user has started a new pi session` calls `startSession`, whose own assertions prove that the session started.

## Task Commits

1. **Task 1: Compare every payload of a multi-payload result in two whole-value steps (D-02).** `6216bddd` (test). The hook `npm run check:commit` passed, and prettier and gitlint passed.
2. **Task 2: Read the marketplaces a scope's config declares (D-07).** `b30a6708` (test). The hook `npm run check:commit` passed, and prettier and gitlint passed.
3. **Task 3: Start a new session as setup and show that an added marketplace survives it (ADD-03 seed).** `788d5676` (test). The hook `npm run check:commit` passed, and prettier and gitlint passed.

Before each commit, `SKIP=npm-check pre-commit run --files <changed files>` passed, and no fixer rewrote anything. `npx prettier --write` had already formatted the `.ts` files.

## Files Created/Modified

- `features/lib/field-rows.ts` (new): JSON records to data-table rows.
- `features/step_definitions/config.steps.ts` (new): the read-only config step.
- `features/marketplace/update.feature` (new): the UPD-07 bare-update seed.
- `features/step_definitions/command.steps.ts`: the two D-02 steps and `envelopeFields`, which `the result has these fields:` now shares. The step module imports the helpers from `field-rows.ts`.
- `features/step_definitions/session.steps.ts`: the setup `Given`, and an updated fileoverview.
- `features/support/world.ts`: `allResults()` and `scopeRoot(scope)`.
- `features/marketplace/add.feature`: the ADD-14 scenario and the ADD-03 Outline (untagged `dir`/`file` Examples and an `@url` Examples block).

## Planted Checks (each run once by hand, then reverted; nothing planted was committed)

Task 1:

- **(a)** The third envelope row was deleted. Command: `npx cucumber-js --name 'A bare update refreshes'`. Result: exit 1, `1 scenario (1 failed)`. The actual table had one row more than the expected table:
  ```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +   [
  +     'cascade',
  +     'info',
  +     'false',
  +     'Marketplace update',
  +     '0',
  +     '0',
  +     '1'
  +   ]
  ```
- **(b)** The `alpha` and `gamma` rows of the second table were swapped. Same command. Result: exit 1, `1 scenario (1 failed)`:
  ```
  + actual - expected
  +     'alpha',
  -     'gamma',
  +     'gamma',
  -     'alpha',
  ```
- The three identical envelope rows already show that two identical payloads stay separate rows.

Task 2:

- **(a)** The ADD-14 `source` cell was changed to `{home}/marketplaces/tools`. Command: `npx cucumber-js --name 'home-relative path'`. Result: exit 1, `1 scenario (1 failed)`:
  ```
  +     '~/marketplaces/tools'
  -     '{home}/marketplaces/tools'
  ```
- **(b)** A temporary `features/marketplace/planted.feature` added a marketplace to the user scope, then read the project scope's `claude-plugins.json`. The file was deleted after the run. Command: `npx cucumber-js features/marketplace/planted.feature`. Result: exit 1, `1 scenario (1 failed)`:
  ```
  AssertionError [ERR_ASSERTION]: /tmp/pi-cm-features-3ezLDN/project/.pi/claude-plugins.json does not exist, which is not an empty declaration
  ```
- **(c)** The file name was changed to `state.json`. Command: `npx cucumber-js --name 'home-relative path'`. Result: exit 1, `1 scenario (1 failed)`:
  ```
  Error: state.json is not a configuration file of a scope
  ```

Task 3:

- The ADD-03 `scope` cell was changed to `user`. Command: `npx cucumber-js --name 'still listed in a new session'`. Result: exit 1, `2 scenarios (2 failed)` (the dir and file rows):
  ```
  + actual - expected
  +     'project',
  -     'user',
  ```

After each check, `cmp` against a saved copy confirmed the restored file. `git status --short` showed no leftover file.

## The missing-file decision

A missing config file fails the config step, and the message names the path. The step never reads a missing file as zero declarations. The extension treats a missing `claude-plugins.json` as a file it has not written yet. On the next load, it rebuilds the file from its own records (MIG-01). A file with an empty `marketplaces` map is different: it declares that the user wants no marketplace. The module comment in `config.steps.ts` records this decision. A scenario that needs zero declarations must add its own step and say which of the two cases it means. That step also needs a requirement behind it (D-07).

## Verification

- After Task 1: `npx cucumber-js --name 'A bare update ...'` gave `1 scenario (1 passed)`. `npm run test:cucumber` gave `23 scenarios (23 passed)`. `CI=1 npm run check:features` gave `Feature gate passed: 25 scenarios, 15 step definitions.`
- After Task 2: `24 scenarios (24 passed)`, and `Feature gate passed: 26 scenarios, 16 step definitions.` `npx fallow dead-code` exited 0.
- After Task 3 (final): `26 scenarios (26 passed)`, 189 steps, and `Feature gate passed: 29 scenarios, 17 step definitions.`
- After each task, `npx tsc --noEmit -p .` and `npx eslint --no-cache` on every changed `.ts` file exited 0.
- All acceptance greps passed: each step text appears once, `allResults()` is in `world.ts`, `update.feature` has 3 `| Marketplace update |` rows, `field-rows.ts` has 4 exported functions, `config.steps.ts` has no write call, `~/marketplaces/tools` appears twice in `add.feature`, and the session step and Outline titles each appear once.
- The phase gate `npm run check` belongs to plan 01-05 and was not run here.

## Decisions Made

- `the result has these fields:` and the envelope step share `envelopeFields`, so both hide the same set of fields.
- The config step fails when the file has no `marketplaces` object, and the failure message prints the file content. An empty map yields no rows, so it fails any table.
- The ADD-03 Outline has two variants that run (`dir` and `file`) and one gated `@url` row, as the plan specified.

## Deviations from Plan

None. The plan was executed as written.

## Issues Encountered

- The ADD-14 config table was misaligned by one column the first time. It was realigned before the first suite run.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- Verb phases can now:
  - compare multi-payload results (`update` bare, `info` fan-out) with the two D-02 steps;
  - read a scope's config declarations;
  - start a new session as setup.
- Plan 01-05 owns the skill docs and the `npm run check` phase gate.

## Self-Check: PASSED

- FOUND: features/lib/field-rows.ts, features/step_definitions/config.steps.ts, features/marketplace/update.feature
- FOUND commits: 6216bddd, b30a6708, 788d5676

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-15*

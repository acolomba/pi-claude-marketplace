---
phase: 01-suite-foundation
plan: 01
subsystem: testing
tags: [cucumber, typebox, notification-wire, behavioral-tests]

requires: []
provides:
  - "runCommandPayloads: every claude-plugin payload a command emits, in order, each validated against NOTIFICATION_PAYLOAD_SCHEMA"
  - "runCommand: the strict exactly-one-cascade wrapper over runCommandPayloads"
  - "features/lib/run-tokens.ts: RunTokens, expandTokens, projectTokens ({home}, {scenario time})"
  - "ScenarioWorld (renamed from PluginWorld) with results, startedAt, tokens, and an exactly-one lastResult()"
  - "Realpath'd run root; local marketplaces under {home}/marketplaces"
  - "A kind row in every `the result has these fields:` table (D-01)"
  - "Seed scenarios: marketplace-info, marketplace-not-added (info.feature), usage-info, usage-error (help.feature)"
affects: [01-02, 01-03, 01-04, 01-05, marketplace verb phases, kind phases]

actuals:
  tokens: 7545
  tasks: 3
  commits: 3
plan_head_before: e4ab99a38127f30881e96a75fb967edee5cea9dd
plan_head_after: 9a5c5b7d6451576f75a79ba36345e4f9c4ddaac2

tech-stack:
  added: []
  patterns:
    - "Driver returns every payload unfiltered; single-result steps assert exactly one (never search)"
    - "Run tokens: exact-substring expansion in commands and projection at each result leaf"
    - "{scenario time}: key-scoped to lastUpdatedAt, exact ISO round trip, inclusive window [world construction, check]"

key-files:
  created:
    - features/lib/run-tokens.ts
    - features/marketplace/info.feature
    - features/marketplace/help.feature
  modified:
    - features/lib/pi-commands.ts
    - features/support/world.ts
    - features/support/pi-process.ts
    - features/step_definitions/command.steps.ts
    - features/step_definitions/marketplace.steps.ts
    - features/step_definitions/session.steps.ts
    - features/plugin/install.feature
    - features/plugin/uninstall.feature
    - features/plugin/update.feature

key-decisions:
  - "Given setup commands stay on the strict runCommand path (one cascade, severity info); only When uses runCommandPayloads"
  - "PluginWorld renamed to ScenarioWorld; the world now serves every command, not only plugin ones"
  - "Zero tolerance on the {scenario time} window: Pi and the worker share the host clock, and the world is built before any Before() hook"
  - "The usage cell in help.feature was generated from MARKETPLACE_USAGE itself (escaped \\n and \\|), so every run of spaces matches"

patterns-established:
  - "A result table states `| kind | <wire kind> |` as its first row"
  - "Fixtures and typed sources use {home}/marketplaces/<name>"

requirements-completed: [DRV-01, DRV-02]

coverage:
  - id: D1
    description: "The driver returns and validates every payload a command emits; single-result steps fail on zero or several"
    requirement: DRV-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (17 scenarios passed)"
        status: pass
      - kind: other
        ref: "planted two-payload bare update read by `the result has these fields:` (failed on the exactly-one assertion, reverted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "{home} expands in commands and projects in results by exact substring; {scenario time} matches only an in-window lastUpdatedAt"
    requirement: DRV-02
    verification:
      - kind: e2e
        ref: "features/marketplace/info.feature#Info on a directory marketplace shows its absolute path and autoupdate state"
        status: pass
      - kind: other
        ref: "planted wrong path and literal stale timestamp (both failed, reverted)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every result table states its payload kind; cascade, marketplace-info, marketplace-not-added, usage-info, and usage-error results are each compared whole"
    requirement: DRV-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (17 scenarios passed); npx cucumber-js --name 'Marketplace help' (2 passed)"
        status: pass
      - kind: other
        ref: "planted wrong kind cell and one-character usage change (both failed, reverted)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-15
status: complete
---

# Phase 1 Plan 01: Widened Payload Driver and Run Tokens Summary

**The cucumber driver now returns every schema-validated `claude-plugin` payload a command emits. Scenarios write `{home}` and `{scenario time}` tokens, and every result table states its payload kind. Five payload kinds pass through the driver.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-15T19:32:53Z
- **Completed:** 2026-10-15T19:40:43Z
- **Tasks:** 3
- **Files modified:** 12 (3 created, 9 modified)

## Accomplishments

- `runCommandPayloads` in `features/lib/pi-commands.ts` returns every `claude-plugin` entry in emission order. It checks each entry against `NOTIFICATION_PAYLOAD_SCHEMA` through the compiled validator's type guard, with no `as`. It fails a command that emits nothing. `runCommand` is now the strict exactly-one-cascade wrapper over it.
- `features/lib/run-tokens.ts` adds `RunTokens`, `expandTokens`, and `projectTokens`. `{home}` is an exact `replaceAll` of the realpath'd sandbox HOME. `{scenario time}` applies only to a `lastUpdatedAt` value that round-trips exactly through ISO and falls in the window [world construction, check].
- `ScenarioWorld` (renamed from `PluginWorld`) keeps `results`, `startedAt`, and a pure `tokens` getter. Its `lastResult()` asserts exactly one payload and puts every payload's JSON in the failure message.
- The run root is realpath'd in `BeforeAll`. Local marketplaces now live under `{home}/marketplaces` (D-04), and `Before()` still clears them.
- `kind` is no longer hidden. All 10 plugin field tables state `| kind | cascade |`, and the info table states `| kind | marketplace-info |` (D-01).
- Seed scenarios: INFO-01 (`marketplace-info`, with `{home}` and `{scenario time}`), INFO-05 (`marketplace-not-added`), USE-01 (`usage-info`, the full `MARKETPLACE_USAGE` text in one cell), and USE-08 (`usage-error`).

## Task Commits

1. **Task 1: Tracer, one marketplace info scenario through the payload driver with run tokens.** `dd24cc3b` (test). Hook `check:commit` passed.
2. **Task 2: State the payload kind in every result table.** `96075253` (test). Hook `check:commit` passed.
3. **Task 3: Compare the not-added and usage payload kinds whole.** `9a5c5b7d` (test). Hook `check:commit` passed.

Tracer gate (interactive, `end-of-phase`, automated-only verify): both verify commands were re-run after the Task 1 commit. Results: `1 scenario (1 passed)` and `14 scenarios (14 passed)`. Then the plan expanded to Tasks 2 and 3.

## Files Created/Modified

- `features/lib/pi-commands.ts`: `NotificationPayload`, `runCommandPayloads`, and `runCommand` re-expressed over it.
- `features/lib/run-tokens.ts` (new): the `{home}` and `{scenario time}` tokens.
- `features/support/world.ts`: `ScenarioWorld` with `results`, `startedAt`, `tokens`, and an exactly-one `lastResult()`.
- `features/support/pi-process.ts`: the realpath'd run root and `marketplacesRoot` under the sandbox HOME.
- `features/step_definitions/command.steps.ts`: token expansion in both run steps and projection at each leaf. `kind` is now stated. The plugin-rows step fails unless the result is a cascade.
- `features/step_definitions/marketplace.steps.ts`, `session.steps.ts`: the world type only.
- `features/plugin/{install,uninstall,update}.feature`: a kind row in every field table.
- `features/marketplace/info.feature` (new): INFO-01 and INFO-05 seeds.
- `features/marketplace/help.feature` (new): USE-01 and USE-08 seeds.

## Planted Checks (each run by hand, then reverted; nothing planted was committed)

Task 1:

- **(a)** In info.feature, `source abs path` was changed to `{home}/marketplaces/other`. Command: `npx cucumber-js --name 'Info on a directory marketplace'`, exit 1, `1 scenario (1 failed)`:
  ```
  'source abs path',
  +     '{home}/marketplaces/tools'
  -     '{home}/marketplaces/other'
  ```
- **(b)** `details last updated at` was changed to the literal `2020-01-01T00:00:00.000Z`. Same command, exit 1, `1 scenario (1 failed)`:
  ```
  'details last updated at',
  +     '{scenario time}'
  -     '2020-01-01T00:00:00.000Z'
  ```

Task 2:

- **(a)** In install.feature, the first table's `cascade` kind cell was changed to `marketplace-info`. Command: `npx cucumber-js --name 'Installing a plugin reports it installed in the chosen scope'`, exit 1:
  ```
  'kind',
  +     'cascade'
  -     'marketplace-info'
  ```
- **(b)** A temporary `features/marketplace/planted.feature` published `alpha` and `beta` and added both to the project scope. It ran `/claude:plugin marketplace update` and read the result with `the result has these fields:`. The file was deleted after the run. Exit 1, and the failure names both payloads:
  ```
  AssertionError [ERR_ASSERTION]: expected exactly one result, got [{"schemaVersion":1,"kind":"cascade",...,"marketplaces":[{"name":"alpha",...}]},{"schemaVersion":1,"kind":"cascade",...,"marketplaces":[{"name":"beta",...}]}]
  ```

Task 3:

- In the usage cell, one space was moved from before `(alias: rm)` to after it, so `]   (alias: rm)` became `]  (alias: rm) `. Command: `npx cucumber-js --name 'Marketplace help shows the marketplace usage'`, exit 1:
  ```
  +       '  remove <name> [--scope user|project]   (alias: rm)\n' +
  -       '  remove <name> [--scope user|project]  (alias: rm) \n' +
  ```

## Verification

- `npm run test:cucumber`: exit 0, `17 scenarios (17 passed)`, 123 steps.
- `npx cucumber-js --name 'Marketplace help'`: `2 scenarios (2 passed)`.
- `npx cucumber-js --dry-run --format usage`: lists no `UNUSED` definition.
- The `check:commit` hook (typecheck, lint, fallow, prettier, pairing) passed on all three commits.
- All acceptance-criteria greps passed: install 4, uninstall 3, update 3 `cascade` kind rows; 1 `marketplace-info` row; 2 usage kinds; 1 `marketplace-not-added` row.

## Decisions Made

- Setup `Given` commands keep the strict `runCommand` path (exactly one cascade with severity `info`). Only `When` stores every payload.
- The `{scenario time}` window has zero tolerance, as the plan specified. Flagged assumption A-02 holds for this run: across four full-suite runs it never flaked.
- The `help.feature` usage cell was generated from the `MARKETPLACE_USAGE` constant, escaping `\` then `|` then line breaks, not typed by hand.

## Deviations from Plan

None. The plan was executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- Later plans can build on `runCommandPayloads`, `ScenarioWorld.results`, and the run tokens. The envelope and rows-across-payloads steps (D-02) are still to be written. So are the publish-by-kind steps and the usage gate.
- The `npm run check` phase gate belongs to the last plan of the phase.

## Self-Check: PASSED

- FOUND: features/lib/run-tokens.ts, features/marketplace/info.feature, features/marketplace/help.feature
- FOUND commits: dd24cc3b, 96075253, 9a5c5b7d

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-15*

---
phase: 08-marketplace-help-and-usage-errors
plan: "02"
subsystem: edge
tags: [cucumber, marketplace, help, usage, router, signature-table]
status: complete

requires:
  - phase: 08-marketplace-help-and-usage-errors
    provides: "08-01: usage-error Outlines that pin every marketplace verb's usage line end to end"
provides:
  - "MARKETPLACE_VERB_SIGNATURES in edge/router.ts: one row per marketplace verb builds both MARKETPLACE_USAGE and, through the exported marketplaceUsage(verb), every marketplace verb's Usage: line"
  - "The marketplace help shows [--local] on add, remove, autoupdate, and noautoupdate"
  - "Scenarios for help marketplace (USE-01) and the bare and unknown marketplace subcommand rejections (USE-02)"
affects: [08-03, 08-04, 08-05, marketplace usage lines, top-level help fix (deferred)]

actuals:
  tokens: 7338
  tasks: 3
  commits: 3
plan_head_before: 42f05b6411cc5da012be9f2564bf916adc0a0ed0
plan_head_after: e3f9bacbf97d774dac1f69ec117c6570c5d46e9c

tech-stack:
  added: []
  patterns:
    - "Signature table: a module-private Readonly<Record<Verb, Signature>> in router.ts builds both the help block and each verb's usage line, so a flag added to one row reaches both surfaces"

key-files:
  created:
    - .planning/phases/08-marketplace-help-and-usage-errors/08-02-RED.json
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
    - features/marketplace/help.feature
    - tests/edge/router.test.ts
    - tests/architecture/flag-catalog-drift.test.ts
    - CHANGELOG.md
    - docs/open-closed-proof.md

key-decisions:
  - "The marketplace signature table lives in edge/router.ts, which imports no handler; handlers value-import marketplaceUsage from the router as help.ts already imports MARKETPLACE_USAGE"
  - "The help alias column is computed from the rows (three past the longest aliased line), so the list line gains 10 spaces to keep (alias: ls) under (alias: rm)"
  - "help marketplace extra is not pinned by a scenario; the deferred top-level help fix owns the plugin help topic error"

patterns-established:
  - "Usage text single source: the router's signature row is the one usage entry a new marketplace verb adds"

requirements-completed: [USE-01, USE-02, USE-08]

coverage:
  - id: D1
    description: "marketplace help and help marketplace each emit one usage-info payload whose usage is the help block with [--local] on add, remove, autoupdate, and noautoupdate"
    requirement: USE-01
    verification:
      - kind: integration
        ref: "features/marketplace/help.feature#Marketplace help shows the marketplace usage"
        status: pass
      - kind: integration
        ref: "features/marketplace/help.feature#Help for the marketplace topic shows the marketplace usage"
        status: pass
    human_judgment: false
  - id: D2
    description: "A bare marketplace and marketplace bogus each report their reason with the same help block as a usage-error payload"
    requirement: USE-02
    verification:
      - kind: integration
        ref: "features/marketplace/help.feature#A marketplace command without a subcommand shows the marketplace usage with a reason"
        status: pass
      - kind: integration
        ref: "features/marketplace/help.feature#An unknown marketplace subcommand shows the marketplace usage with a reason"
        status: pass
      - kind: unit
        ref: "tests/edge/router.test.ts#reports that marketplace needs a subcommand, with the marketplace usage block"
        status: pass
    human_judgment: false
  - id: D3
    description: "marketplace help extra still reports marketplace help takes no arguments. with the one-line marketplace help usage"
    requirement: USE-08
    verification:
      - kind: integration
        ref: "features/marketplace/help.feature#Marketplace help with an argument is rejected"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every marketplace verb's Usage: line comes from the signature table, byte for byte unchanged"
    requirement: USE-01
    verification:
      - kind: unit
        ref: "tests/edge/router.test.ts#gives marketplace <verb> its own usage line"
        status: pass
      - kind: integration
        ref: "features/marketplace/usage-errors.feature (43 rows)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/*.test.ts and tests/edge/register.test.ts (unchanged since 124f2311)"
        status: pass
    human_judgment: false

duration: 11 min
completed: 2026-10-20
---

# Phase 8 Plan 02: Marketplace help from one signature table Summary

**The marketplace help now shows `[--local]` on `add`, `remove`, `autoupdate`, and `noautoupdate`, and one signature row per verb in `edge/router.ts` builds both that help block and each verb's own `Usage:` line, so the two cannot drift apart again.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-20T12:29:24Z
- **Completed:** 2026-10-20T12:40:41Z
- **Tasks:** 3
- **Files modified:** 12 (1 created: 08-02-RED.json, committed with this SUMMARY)

## Accomplishments

- D-01: `MARKETPLACE_USAGE` now documents `[--local]` on the four verbs that accept it. The `list` alias note moves 10 spaces to stay in the `remove` alias note's column.
- D-02: `MARKETPLACE_VERB_SIGNATURES` (module-private) builds the help through `marketplaceHelp()` and each verb's usage line through the exported `marketplaceUsage(verb)`. The six marketplace handlers hold no usage literal, and `usageFor` in `autoupdate.ts` is gone.
- USE-01, USE-02: three new scenarios in `features/marketplace/help.feature` (help marketplace, a bare `marketplace`, `marketplace bogus`); the USE-08 scenario is unchanged byte for byte.
- Seven literal unit cases in `tests/edge/router.test.ts` pin each verb's usage line, covering both arms of the alias spelling.
- The flag-catalog drift pins record `--local` as documented on the four marketplace lines. `TOP_LEVEL_USAGE` and its pins are unchanged.
- One CHANGELOG `[Unreleased]` bullet; `docs/open-closed-proof.md` names the signature row as the one usage entry a new marketplace verb adds.

## Task Commits

1. **Task 1: Show --local in the marketplace help, test-first, from one signature table (D-01)** - `d48cbf20` (fix)
2. **Task 2: Build every marketplace usage line from the same signature table (D-02)** - `f734b714` (refactor)
3. **Task 3: Record the help fix in the CHANGELOG and the open-closed proof** - `e3f9bacb` (docs)

The tracer gate after Task 1 re-ran its `<verify>` cucumber command (5 scenarios, 5 passed) before Task 2 started.

## RED Evidence (D-01, before the fix)

- **Cucumber:** `npm run --silent test:cucumber -- features/marketplace/help.feature --parallel 1 --name '^(<the four help-block titles>)$' --format summary --format junit:<scratch>/08-02-red.xml` exited 1 with `4 scenarios (4 failed)`, `16 steps (12 passed, 4 failed)`. Each scenario failed only at `Then the result has these fields:`, and each diff was the `usage` row alone (today's literal without `[--local]` and with the old `list` alias column). Recorded in `08-02-RED.json` (base commit `42f05b64`, whose `router.ts` still held the literal help block). `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for each of the four titles, submitted one per temporary copy; no copy remains.
- **Unit:** `node --test tests/edge/router.test.ts tests/architecture/flag-catalog-drift.test.ts` exited 1 with 172 tests, 161 passed, 11 failed: exactly the seven router cases that compare the help block (`reports that marketplace needs a subcommand ...` x2, `names an unrecognized marketplace token ...`, `appends router rejection for marketplace` and `... marketplace unknown` in json and rpc) and the four drift cases (`marketplace add`, `remove`, `autoupdate`, `noautoupdate`).
- **Semantic assessment:** the targets ran and failed on the planned assertion for the intended reason (the help omits `--local`); no setup, load, or unrelated failure.

The tests landed with the fix in one commit (`d48cbf20`), as the plan requires; no red tree was committed.

## Verification Evidence

Node `v26.11.1`, run on this worktree (`features/cucumber-behavioral-tests`).

| Command | Tree | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:cucumber -- features/marketplace/help.feature --parallel 1` (Task 1 and tracer re-run) | `d48cbf20` | 0 | `5 scenarios (5 passed)`, `20 steps (20 passed)` |
| `node --test tests/edge/router.test.ts tests/architecture/flag-catalog-drift.test.ts tests/edge/handlers/plugin/help.test.ts tests/edge/register.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | `d48cbf20` | 0 | 446 tests, 446 pass, 0 fail |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts` | `d48cbf20` | 0 | no coverage shortfall reported |
| `npm run check:features` | `d48cbf20` | 0 | no `Feature gate failed` |
| `node --test` on router, the six marketplace handler owners, `shared.test.ts`, `register.test.ts`, `help.test.ts`, and the drift test (Task 2) | `f734b714` | 0 | 608 tests, 608 pass, 0 fail |
| `npm run test:cucumber -- features/marketplace/usage-errors.feature features/marketplace/help.feature --parallel 1` | `f734b714` | 0 | `48 scenarios (48 passed)`, `192 steps (192 passed)` |
| `npm run test:coverage:direct --` router.ts and the six handlers | `f734b714` | 0 | no coverage shortfall reported |
| `npx tsc --noEmit -p .` | both code commits | 0 | clean |
| `SKIP=npm-check pre-commit run --files <task files>` | all three tasks | 0 | all hooks passed or skipped |
| commit hook `npm run check:commit` | `d48cbf20`, `f734b714` | 0 | Passed (incremental evidence only); skipped for the docs-only `e3f9bacb` |

Acceptance checks: the D-01 `remove` help line appears 4 times in `help.feature`; `MARKETPLACE_VERB_SIGNATURES` appears 2+ times in `router.ts` and once in `docs/open-closed-proof.md`; `documented: ["--local"], omitted: [] }` appears 6 times in the drift test; `export function marketplaceUsage` and `export type MarketplaceVerb` appear once each; all six handlers call `marketplaceUsage(`; no `Usage: /claude:plugin` literal remains under `edge/handlers/marketplace/`; `function usageFor` is gone; `git diff --quiet 124f2311 -- docs/output-catalog.md tests/architecture/catalog-uat/catalog-contract.test.ts` and `-- tests/edge/handlers/marketplace/ tests/edge/register.test.ts` both exit 0; the `[Unreleased]` section holds 12 bullets with the new one first (19 words). The combined-tree `npm run check` belongs to plan 08-05.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/router.ts` - signature table, help builder, exported `marketplaceUsage` and `MarketplaceVerb`
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,remove,list,info,update,autoupdate}.ts` - usage from `marketplaceUsage(...)`
- `features/marketplace/help.feature` - D-01 help cell in the help scenario, plus the USE-01 and USE-02 scenarios
- `tests/edge/router.test.ts` - D-01 `EXPECTED_MARKETPLACE_USAGE` literal and seven per-verb usage-line cases
- `tests/architecture/flag-catalog-drift.test.ts` - four marketplace rows document `--local`
- `CHANGELOG.md` - one `[Unreleased]` bullet
- `docs/open-closed-proof.md` - the router usage bullet names the signature row
- `.planning/phases/08-marketplace-help-and-usage-errors/08-02-RED.json` - the RED run before the fix

## Decisions Made

- The signature table stays in `edge/router.ts` (no new module, no handler import from the router); handlers value-import `marketplaceUsage` beside their existing type import.
- The alias column is read off the rows, so the `list` line gains 10 spaces (08-RESEARCH.md Assumption A1). If the user wants the `list` line byte-identical instead, the column rule, the scenario cells, and the router literal change together.

## Flagged Assumptions From the Spec-less Probe

- `USE-01 / unclassified / unresolved`: the probe supplied no edge shape. The two help-spelling scenarios are the manual-review target.
- `USE-02 / unclassified / unresolved`: the bare and unknown subcommand scenarios are the manual-review target.
- `USE-08 / unclassified / unresolved`: the existing `Marketplace help with an argument is rejected` scenario is the manual-review target.
- Not pinned here: the top-level `help` and `help help` text (`TOP_LEVEL_USAGE`), which the deferred top-level help fix will change, and `help marketplace extra` (`Unknown help topic: "marketplace extra".`), whose routing and sentence the unit owners already pin.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0. **Impact:** none.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 08-03. The usage lines now come from one table, so the D-05 empty-argument change touches only the parser and its messages.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/edge/router.ts
- FOUND: features/marketplace/help.feature
- FOUND: .planning/phases/08-marketplace-help-and-usage-errors/08-02-RED.json
- FOUND: d48cbf20
- FOUND: f734b714
- FOUND: e3f9bacb

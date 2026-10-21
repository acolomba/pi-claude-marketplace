---
phase: 08-marketplace-help-and-usage-errors
plan: "03"
subsystem: edge
tags: [cucumber, marketplace, plugin, usage-errors, args-schema, parser]
status: complete

requires:
  - phase: 08-marketplace-help-and-usage-errors
    provides: "08-01: usage-error Outlines that pin every marketplace rejection; 08-02: every marketplace usage line built from one signature table"
provides:
  - "PositionalSpec.label (required) in edge/args-schema.ts and the `<label> must not be empty.` message for a supplied empty or blank positional, required or optional"
  - "openMarketplaceCommand's positionalLabel option; the info helper labels its name Marketplace name"
  - "The empty-argument Outline in features/marketplace/usage-errors.feature (eight rows)"
  - "features/plugin/usage-errors.feature with the empty-reference Outline for uninstall, enable, and disable (four rows)"
affects: [08-04, 08-05, plugin install/info/update/fetch/reinstall/list empty-argument messages]

actuals:
  tokens: 9342
  tasks: 2
  commits: 2
plan_head_before: a35338bbf26d9b012d124f6fbabdd3601686b1b0
plan_head_after: 1c2b8ead2605325c3f064ffac4160e26ecec8ef0

tech-stack:
  added: []
  patterns:
    - "Required display label on each positional spec: the parser names the field of an empty value, and the type system forces every call site to supply the name"

key-files:
  created:
    - features/plugin/usage-errors.feature
    - .planning/phases/08-marketplace-help-and-usage-errors/08-03-RED.json
  modified:
    - extensions/pi-claude-marketplace/edge/args-schema.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - features/marketplace/usage-errors.feature
    - tests/edge/args-schema.test.ts
    - tests/edge/handlers/marketplace/shared.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/info.test.ts
    - tests/edge/handlers/marketplace/list.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/edge/handlers/marketplace/autoupdate.test.ts
    - tests/edge/handlers/plugin/shared.test.ts
    - CHANGELOG.md

key-decisions:
  - "PositionalSpec.label is required, not optional with a fallback, so an unlabelled parseCommandArgs call site fails typecheck and no positional can keep a generic empty-value message"
  - "Each label follows the placeholder its usage line prints: Source for marketplace add, Marketplace name for remove, info, update, autoupdate, and noautoupdate, Plugin name for uninstall, enable, and disable"
  - "The explicit-empty args-schema rows for optional and required positionals share one data-driven loop, so the new required rows add no clone group"

patterns-established:
  - "Empty is not omitted: an absent positional reports the usage (mapped to Missing required argument. by the callers), a supplied empty or blank one reports `<label> must not be empty.`"

requirements-completed: [USE-07]

coverage:
  - id: D1
    description: "marketplace add with an empty or blank source reports Source must not be empty.; remove, info, update (empty and blank), autoupdate, and noautoupdate with an empty name report Marketplace name must not be empty.; each as one usage-error payload with the verb's own usage line"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#An empty marketplace argument is rejected with a message that names its field (8 rows)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/{add,info,remove,update,autoupdate}.test.ts machine-mode rows for '\"\"'"
        status: pass
    human_judgment: false
  - id: D2
    description: "uninstall (empty and blank), enable, and disable with an empty <plugin>@<marketplace> report Plugin name must not be empty. with the verb's own usage line"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/plugin/usage-errors.feature#An empty plugin reference is rejected as an empty plugin name (4 rows)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/shared.test.ts#names an explicitly empty ref as an empty plugin name (USE-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An omitted required argument still reports Missing required argument.; the parser reports the usage only for an absent positional"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#A marketplace subcommand without its required argument reports a missing argument"
        status: pass
      - kind: unit
        ref: "tests/edge/args-schema.test.ts#parseCommandArgs reports usage for a required positional given an empty argument string"
        status: pass
    human_judgment: false
  - id: D4
    description: "An empty name never reaches an orchestrator: update '' and autoupdate '' stop with a usage error before any refresh or flip"
    requirement: USE-07
    verification:
      - kind: unit
        ref: "tests/edge/handlers/marketplace/update.test.ts#rejects \"\" before refreshing or cascading"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/shared.test.ts#names an explicitly empty name by its label and never reaches the operation (USE-07)"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-10-20
---

# Phase 8 Plan 03: Name the field of an empty argument Summary

**An explicitly empty or blank argument now fails with `<Field> must not be empty.` on every verb that shares `parseCommandArgs` (`Source` for `marketplace add`, `Marketplace name` for the other marketplace verbs, `Plugin name` for `uninstall`, `enable`, and `disable`), while an omitted one still reports `Missing required argument.`.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-20T12:45:09Z
- **Completed:** 2026-10-20T12:57:00Z
- **Tasks:** 2
- **Files modified:** 20 (2 created: `features/plugin/usage-errors.feature`, `08-03-RED.json`)

## Accomplishments

- `PositionalSpec` gains a required `readonly label: string`. `parseCommandArgs` reports the usage for an omitted required positional, skips an omitted optional one, and reports `<label> must not be empty.` for any supplied value whose `trim()` is empty. The earlier checks keep their order.
- Every call site carries a label (table below). `openMarketplaceCommand` takes a new `positionalLabel` option. The three `Missing required argument.` mappings are unchanged.
- Twelve new real-Pi scenario rows: the eight-row marketplace Outline and the new `features/plugin/usage-errors.feature` with four rows.
- New unit cases: the explicit-empty loop over optional and required positionals in `args-schema.test.ts`, the two `openMarketplaceCommand` label rows and the info-helper case in `marketplace/shared.test.ts`, and the empty-ref case in `plugin/shared.test.ts`.
- The add, info, and list owner headers now state the surplus rejection they pin, and the `shared.test.ts` title for the omitted case says omitted.
- One CHANGELOG `[Unreleased]` bullet with a plugin sub-bullet.

### Label table

| Call site | Verbs | Positional | Label |
| --- | --- | --- | --- |
| `marketplace/shared.ts` `openMarketplaceCommand` (`positionalLabel`) | `add` | `source`, required | `Source` |
| same | `remove` / `rm` | `name`, required | `Marketplace name` |
| `marketplace/shared.ts` `makeSingleNameMarketplaceHandler` | `info` | `name`, required | `Marketplace name` |
| `marketplace/update.ts` | `update` | `name`, optional | `Marketplace name` |
| `marketplace/autoupdate.ts` | `autoupdate`, `noautoupdate` | `name`, optional | `Marketplace name` |
| `marketplace/list.ts` | `list` / `ls` | none | none (`list ''` stays `Too many arguments.`) |
| `plugin/shared.ts` `parseRequiredPluginMarketplaceRef` | `uninstall`, `enable`, `disable` | `ref`, required | `Plugin name` |

## Task Commits

1. **Task 1: Name the field of an empty argument in the shared parser, test-first through a real Pi** - `e9bf66f7` (fix)
2. **Task 2: Record the named empty-argument errors in the CHANGELOG** - `1c2b8ead` (docs)

The tracer gate after Task 1 re-ran its cucumber `<verify>` on the committed tree (`55 scenarios (55 passed)`) before Task 2 started.

## RED Evidence (before the fix)

- **Precondition:** `git diff --quiet 124f2311 -- edge/args-schema.ts edge/handlers/marketplace/shared.ts edge/handlers/plugin/shared.ts` exited 0, and `features/plugin/usage-errors.feature` did not exist.
- **Cucumber:** `npm run --silent test:cucumber -- features/marketplace/usage-errors.feature features/plugin/usage-errors.feature --parallel 1 --name '^(<both Outline titles>)$' --format summary --format junit:<scratch>/08-03-red.xml` exited 1 with `12 scenarios (12 failed)`, `48 steps (36 passed, 12 failed)`. Each failed only at `Then the result has these fields:`, and each diff was the `message` row alone: `Missing required argument.` for `add` (x2), `remove`, `info`, `uninstall` (x2), `enable`, and `disable`, and `Argument must not be empty.` for `update` (x2), `autoupdate`, and `noautoupdate`.
- **Classifier:** `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for all twelve example names (`<Outline title> - #1.N`), each submitted in its own temporary copy; no copy remains. Recorded in `08-03-RED.json` (base commit `a35338bb`, whose `args-schema.ts` has no `label`).
- **Unit:** `node --test tests/edge/args-schema.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/shared.test.ts` exited 1 with 225 tests, 202 passed, 23 failed. Exactly the changed and new expectations failed:
  - 12 machine-mode rows for `'""'`: `appends marketplace/{add,info,remove,update} rejection for "" in json|rpc (enabled)` and `appends marketplace/autoupdate rejection for "" in json|rpc (enabled|disabled)`.
  - `rejects "" before refreshing or cascading` (`update.test.ts`).
  - `names an explicitly empty name by its label and never reaches the operation (USE-07)`, `names an explicitly empty "source" positional by the label "Source" (USE-07)`, and `... "name" positional by the label "Marketplace name" (USE-07)` (`marketplace/shared.test.ts`).
  - `names an explicitly empty ref as an empty plugin name (USE-07)` (`plugin/shared.test.ts`).
  - Six `args-schema.test.ts` cases: the blank optional tail, the blank required positional, and the four explicitly empty optional and required rows.
- **Semantic assessment:** every target ran and failed on the planned assertion for the intended reason (the parser does not name the field). No setup, load, or unrelated failure.

The tests landed with the fix in one commit (`e9bf66f7`), as the plan requires; no red tree was committed.

## Verification Evidence

Node `v26.11.1`, run on this worktree (`features/cucumber-behavioral-tests`).

| Command | Tree | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:cucumber -- features/marketplace/usage-errors.feature features/plugin/usage-errors.feature --parallel 1` | before and after `e9bf66f7` | 0 | `55 scenarios (55 passed)`, `220 steps (220 passed)` |
| `node --test` on args-schema, the seven marketplace owners, plugin `shared`, `uninstall`, `enable-disable`, and `register` | before `e9bf66f7` (same content) | 0 | 572 tests, 572 pass, 0 fail |
| `npm run test:coverage:direct --` the eight changed sources | same | 0 | no coverage shortfall reported |
| `npm run check:features` | same | 0 | no `Feature gate failed` |
| `npx tsc --noEmit -p .` | same | 0 | clean |
| `SKIP=npm-check pre-commit run --files <task files>` | both tasks | 0 | all hooks passed or skipped |
| commit hook `npm run check:commit` | `e9bf66f7` | 0 | Passed (incremental evidence only); skipped for the docs-only `1c2b8ead` |

Acceptance checks, all passing: `Argument must not be empty` appears nowhere under `extensions`, `tests`, `features`, or `docs`; `readonly label: string` appears once in `args-schema.ts`; each labelled call site greps to 1; `features/plugin/usage-errors.feature` starts with `Feature: Plugin usage errors` and neither feature table has a `name`, `source`, `plugin`, or `marketplace` column; `git diff --quiet 124f2311 -- docs/output-catalog.md docs/json-output.md tests/architecture/catalog-uat/ tests/edge/handlers/plugin/uninstall.test.ts tests/edge/handlers/plugin/enable-disable.test.ts tests/edge/register.test.ts` exits 0; the add header greps 0 for the six stale phrases and 1 for `Too many arguments.`; the info header greps 0 / 1 and the list header 0 / 1; the old `shared.test.ts` title greps 0 and the new one 1; the `[Unreleased]` section holds 13 top-level bullets with the new one first. The combined-tree `npm run check` belongs to plan 08-05.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/args-schema.ts` - required `label`, the label message, and the JSDoc list of what the parser reports
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts` - `positionalLabel` option, the info helper's label, and the corrected step list
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,remove,update,autoupdate}.ts` - one label each
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` - `Plugin name` label on the ref
- `features/marketplace/usage-errors.feature` - the eight-row empty-argument Outline
- `features/plugin/usage-errors.feature` - new feature with the four-row empty-reference Outline
- `tests/edge/args-schema.test.ts`, `tests/edge/handlers/marketplace/*.test.ts`, `tests/edge/handlers/plugin/shared.test.ts` - labels, new expectations, new cases, corrected headers and title
- `CHANGELOG.md` - one `[Unreleased]` bullet and its sub-bullet
- `.planning/phases/08-marketplace-help-and-usage-errors/08-03-RED.json` - the RED run before the fix

## Decisions Made

- Label table as planned, with each label taken from the placeholder its usage line prints.
- The explicitly empty required rows join the optional rows in one data-driven loop (`parseCommandArgs names an explicitly empty <optional|required> positional <args> by its label`), so they add no clone group. The omitted-required contrast stays pinned by the existing `reports usage for a required positional given ...` loop.

## Assumption-Delta Decision

`no-change`. The positional is still identified by its `name`, which keys the parsed result. `label` is a required display field beside it, and no required field became optional.

## Deviations from Plan

**1. [Rule 2 - Test quality] One loop for the explicitly empty optional and required rows**
- **Found during:** Task 1, step 3
- **Issue:** The plan asked for a second loop beside the empty-optional loop for the required rows. A copied loop body would add a clone group under `fallow dupes`, which the plan's execution notes forbid.
- **Fix:** The existing loop now iterates four typed rows `{ args, required, presence }` and expects `Marketplace name must not be empty.` for each. Its title names the presence, not the omitted contrast; that contrast is pinned by the existing omitted-argument loop.
- **Files modified:** `tests/edge/args-schema.test.ts`
- **Committed in:** `e9bf66f7`

**2. [Rule 2 - Test quality] Literal expected messages in the openMarketplaceCommand label rows**
- **Found during:** Task 1, step 3
- **Issue:** Interpolating the row's label into the expected message would let a wrong label pass if both sides read the same value.
- **Fix:** Each row carries its expected message as an independent literal (`Source must not be empty.`, `Marketplace name must not be empty.`).
- **Committed in:** `e9bf66f7`

**Total deviations:** 2 (both test-quality adjustments inside planned files). **Impact:** none on the production change or the scenarios.

## Issues Encountered

- `USE-07` is also declared by plans 08-04 and 08-05, so its REQUIREMENTS.md checkbox and traceability row stay `Pending` until the last of those plans finishes (shared-ID gate).

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 08-04: the plugin verbs outside the parser (`install`, `info`, `list`) take the same `Plugin name` and `Marketplace name` wording, and `features/plugin/usage-errors.feature` is in place for their rows.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/edge/args-schema.ts
- FOUND: features/plugin/usage-errors.feature
- FOUND: features/marketplace/usage-errors.feature
- FOUND: .planning/phases/08-marketplace-help-and-usage-errors/08-03-RED.json
- FOUND: e9bf66f7
- FOUND: 1c2b8ead

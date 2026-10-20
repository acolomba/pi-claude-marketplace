---
phase: 08-marketplace-help-and-usage-errors
plan: "04"
subsystem: edge
tags: [cucumber, plugin, usage-errors, install, info, list]
status: complete

requires:
  - phase: 08-marketplace-help-and-usage-errors
    provides: "08-03: the required positional label, the `<Label> must not be empty.` message, and features/plugin/usage-errors.feature"
provides:
  - "parsePluginRef(ref, ctx, run, usage) in edge/handlers/plugin/shared.ts: the one source of the empty-reference and invalid-reference messages for install, info, and parseRequiredPluginMarketplaceRef"
  - "install and info report `Plugin name must not be empty.` for an empty or blank reference"
  - "plugin list rejects an empty or blank marketplace name with `Marketplace name must not be empty.`"
  - "The partly malformed reference Outline (six verbs) in features/plugin/usage-errors.feature"
affects: [08-05, plugin update/fetch/reinstall target parsing]

actuals:
  tokens: 4977
  tasks: 2
  commits: 2
plan_head_before: 0022ea933b1d2279352a1bccbd6a83ab98dda76c
plan_head_after: d986744fcd0e9bd0a09e2e0c1505383197a38274

tech-stack:
  added: []
  patterns:
    - "One exported reference parser per verb family: the empty check runs before the split, so an empty value and a malformed value each have one message source"

key-files:
  created:
    - .planning/phases/08-marketplace-help-and-usage-errors/08-04-RED.json
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - tests/edge/handlers/plugin/shared.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/info.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - features/plugin/usage-errors.feature

key-decisions:
  - "A bare `@` on install and info keeps `Invalid <plugin>@<marketplace> ref: \"@\".`: it is partly malformed, not empty as a whole"
  - "`foo@`, `alpha@`, and `@mp` keep the invalid-reference message; only a value empty or blank as a whole names the field"
  - "parsePluginRef returns the split (or undefined after notifying), so install, info, and parseRequiredPluginMarketplaceRef share one copy of both messages and fallow dupes sees no new clone group"

patterns-established:
  - "Empty before malformed: check `trim() === \"\"` first and name the field, then split and report an invalid reference"

requirements-completed: [USE-07]

coverage:
  - id: D1
    description: "install '' and install '   ' and plugin info '' report `Plugin name must not be empty.` as one usage-error payload with the verb's own usage line"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/plugin/usage-errors.feature#An empty plugin reference is rejected as an empty plugin name (rows #1.5 to #1.7)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/{install,info}.test.ts#rejects an empty reference / a blank reference with its usage error and never reaches the ... workflow (PI-1, USE-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "plugin list '' reports `Marketplace name must not be empty.` with the list usage line instead of an empty listing"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/plugin/usage-errors.feature#Listing the plugins of an empty marketplace name is rejected"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/list.test.ts#rejects an empty / a blank marketplace name with \"Marketplace name must not be empty.\" and never reaches the list workflow (MSG-NC-2, USE-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "parsePluginRef names an empty or blank reference and an invalid one, and returns the split of a valid one"
    requirement: USE-07
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/shared.test.ts#parsePluginRef (7 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A partly malformed reference keeps the invalid-reference message on install, info, uninstall (`@`) and update, fetch, reinstall (`foo@`)"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/plugin/usage-errors.feature#A partly malformed plugin reference keeps the invalid reference message (6 rows)"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-10-20
---

# Phase 8 Plan 04: Name an empty install, info, or list argument Summary

**`install` and plugin `info` now report `Plugin name must not be empty.` for an empty or blank `<plugin>@<marketplace>`, and plugin `list ''` stops with `Marketplace name must not be empty.` instead of listing nothing. One new helper, `parsePluginRef`, is the only source of the empty-reference and invalid-reference messages for `install`, `info`, and the shared required-reference parser.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-10-20T13:00:30Z
- **Completed:** 2026-10-20T13:09:13Z
- **Tasks:** 2
- **Files modified:** 9, plus the new `08-04-RED.json`

## Accomplishments

- `parsePluginRef(ref, ctx, run, usage)` in `edge/handlers/plugin/shared.ts`. A reference whose `trim()` is empty gets `Plugin name must not be empty.`. A reference that `splitPluginMarketplaceRef` cannot split gets `Invalid <plugin>@<marketplace> ref: "<ref>".`. Both return `undefined` after one usage-error notification. A valid reference returns its two halves.
- `parseRequiredPluginMarketplaceRef` (uninstall, enable, disable), `install`, and `info` call `parsePluginRef` and no longer carry their own split-and-notify block. `splitPluginMarketplaceRef` stays exported for `update`, `fetch`, and `reinstall` until plan 08-05.
- Plugin `list` rejects an empty or blank marketplace name after the too-many-arguments check. The `Unknown option: "<x>".` wording is untouched.
- Real-Pi scenarios: three new rows in the empty-reference Outline (`install ''`, `install '   '`, `info ''`), the new `Listing the plugins of an empty marketplace name is rejected` scenario, and the new six-row `A partly malformed plugin reference keeps the invalid reference message` Outline.
- Unit owners: a `parsePluginRef` block in `shared.test.ts` (one split case and six rejection rows); three rows (`@`, `""`, `'   '`) in the reference-rejection loops of `install.test.ts` and `info.test.ts`, retitled to fit every row; the list surplus loop is now a rejection loop that carries each row's sentence, with two new empty and blank rows; and a `'""'` row in the list json/rpc table.

## Task Commits

1. **Task 1: Name an empty install or info reference and an empty plugin list name, test-first through a real Pi** - `4a107fb1` (fix)
2. **Task 2: Pin that partly malformed references keep the invalid-reference message** - `d986744f` (test)

The tracer gate after Task 1 re-ran its cucumber `<verify>` on the committed tree (`8 scenarios (8 passed)`) before Task 2 started.

## RED Evidence (before the fix)

- **Precondition:** `git diff --quiet 124f2311 -- install.ts info.ts list.ts` exited 0.
- **Cucumber:** `npm run --silent test:cucumber -- features/plugin/usage-errors.feature --parallel 1 --name '^(An empty plugin reference is rejected as an empty plugin name|Listing the plugins of an empty marketplace name is rejected)$' --format summary --format junit:<scratch>/08-04-red.xml` exited 1 with `8 scenarios (4 passed, 4 failed)`, `32 steps (28 passed, 4 failed)`.
  - Rows `#1.1` to `#1.4` from plan 08-03 passed.
  - Rows `#1.5` (`install ''`), `#1.6` (`install '   '`), and `#1.7` (`info ''`) failed only at `Then the result has these fields:`, on the `message` row alone: `Invalid <plugin>@<marketplace> ref: "".` (and `"   "`).
  - The list scenario failed at the same step because the payload was `kind cascade`, `severity info`, with no message or usage: the handler listed a marketplace named `""`.
- **Classifier:** `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for `- #1.5`, `- #1.6`, `- #1.7`, and the list title, each in its own temporary copy; no copy remains. Recorded in `08-04-RED.json` (base commit `0022ea93`, whose `install.ts` still splits inline).
- **Unit:** `node --test` on the `shared`, `install`, `info`, and `list` owners exited 1 with 100 tests, 91 passed, 9 failed:
  - Load failure: `tests/edge/handlers/plugin/shared.test.ts` (`does not provide an export named 'parsePluginRef'`), so none of its cases ran.
  - Assertion failures: the empty and blank rows of `install.test.ts` and `info.test.ts` (4), the empty and blank rows of the list rejection loop (2), and `appends plugin/list rejection for "" in json|rpc (enabled)` (2).
  - The new `@` rows in `install.test.ts` and `info.test.ts` passed, as planned: they pin behavior that does not change.
- **Semantic assessment:** every target failed on the planned assertion for the intended reason. No setup or unrelated failure.

The tests landed with the fix in one commit (`4a107fb1`); no red tree was committed.

## Verification Evidence

Node `v26.11.1`, run on this worktree (`features/cucumber-behavioral-tests`), user and project scope sandboxed by the cucumber harness and by `createHermeticEnvironment` in the unit owners.

| Command | Tree | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1` | before `4a107fb1` (same content) and after it | 0 | `8 scenarios (8 passed)` |
| `node --test` on plugin `shared`, `install`, `info`, `list`, `uninstall`, `enable-disable`, `update`, `fetch`, `reinstall`, and `register` | before `4a107fb1` (same content) | 0 | 587 tests, 587 pass, 0 fail |
| `npm run test:coverage:direct --` the four changed sources | same | 0 | no coverage shortfall reported |
| `npx tsc --noEmit -p .` | same | 0 | clean |
| `npx eslint --max-warnings 0` on the eight changed `.ts` files | same | 0 | clean |
| `npx fallow dupes` | same | 0 | no clone group names a changed file |
| `SKIP=npm-check pre-commit run --files <task files>` | both tasks | 0 | all hooks passed |
| commit hook `npm run check:commit` | `4a107fb1`, `d986744f` | 0 | Passed |
| `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1` | `d986744f` | 0 | `14 scenarios (14 passed)`, `56 steps (56 passed)` |
| `npm run check:features` | `d986744f` | 0 | no `Feature gate failed` |

Acceptance checks, all passing: `export function parsePluginRef` greps 1 in `shared.ts`; `parsePluginRef(positional, ctx, run, USAGE)` greps 1 in each of `install.ts` and `info.ts`; `parsePluginRef(parsed.ref, ctx, run, usage)` greps 1 in `shared.ts`; `Marketplace name must not be empty.` and `Unknown option: ` each grep 1 in `list.ts`; `| install ''` and `| info ''` each grep 1 in the feature; the new list section comment line greps 1; the partly malformed Outline title greps 1 and has six rows; no Examples column is named `name`, `source`, `plugin`, or `marketplace`; `git show --stat --format= HEAD -- extensions tests` printed nothing for `d986744f`. The combined-tree `npm run check` belongs to plan 08-05.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` - `parsePluginRef` with its JSDoc; `parseRequiredPluginMarketplaceRef` calls it
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` - calls `parsePluginRef`; header names it
- `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` - calls `parsePluginRef`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` - empty or blank marketplace name check; header step list names it
- `tests/edge/handlers/plugin/{shared,install,info,list}.test.ts` - the new cases and rows, retitled loops, and corrected header comments
- `features/plugin/usage-errors.feature` - three Outline rows, the list scenario, and the partly malformed Outline
- `.planning/phases/08-marketplace-help-and-usage-errors/08-04-RED.json` - the RED run before the fix

## Decisions Made

- The decisions the plan states, as planned: a bare `@` on `install` and `info` keeps the invalid-reference message; `foo@`, `alpha@`, and `@mp` keep it too; a whitespace-only reference counts as empty.
- `parsePluginRef` returns `splitPluginMarketplaceRef`'s value after notifying when it is `undefined`, so the function has one empty check and one split check and stays well under both complexity gates.
- The list handler's new check fits inside the handler without moving the positional checks into a helper: ESLint (sonarjs cognitive complexity) and the commit hook's fallow health passed.

## Deviations from Plan

**1. [Rule 2 - Test quality] Header comments that the new behavior made incomplete**
- **Found during:** Task 1
- **Issue:** The `info.test.ts` header listed three rejections ending with "a malformed reference", and the `list.test.ts` header said one marketplace positional is accepted. The `list.ts` header said the remaining positionals "must be 0 or 1". Each no longer described every rejection.
- **Fix:** `info.test.ts` now says "an empty or malformed reference"; `list.test.ts` adds "One empty or blank name is rejected too (USE-07)"; `list.ts` says "must be 0 or 1, and not empty or blank".
- **Files modified:** `tests/edge/handlers/plugin/info.test.ts`, `tests/edge/handlers/plugin/list.test.ts`, `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`
- **Committed in:** `4a107fb1`

**2. [Rule 2 - Test quality] The list rejection loop names its row field `expectedSentence`**
- **Found during:** Task 1
- **Issue:** The plan asked for rows that carry their sentence. The same file's prelude loop already names that field `expectedSentence`.
- **Fix:** The merged loop uses `{ args, expectedSentence, label, summary }`, in the order the prelude loop uses. `fallow dupes` reports no clone group in the file.
- **Committed in:** `4a107fb1`

**Total deviations:** 2 (both inside planned files). **Impact:** none on the production change or the scenarios.

## Issues Encountered

- `USE-07` is also declared by plan 08-05, so its REQUIREMENTS.md checkbox and traceability row stay `Pending` until 08-05 finishes (shared-ID gate).

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 08-05: `update`, `fetch`, and `reinstall` still split their target with `splitPluginMarketplaceRef`; the partly malformed Outline pins `foo@` on all three, so 08-05's empty-target change has a guard against widening the empty rule.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
- FOUND: features/plugin/usage-errors.feature
- FOUND: .planning/phases/08-marketplace-help-and-usage-errors/08-04-RED.json
- FOUND: 4a107fb1
- FOUND: d986744f

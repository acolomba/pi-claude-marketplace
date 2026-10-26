---
phase: 25-update-and-reinstall-rows
plan: 08
subsystem: update-rows
tags: [update, reinstall, autoupdate, dependency-range, cause-line, UPR-03]

requires:
  - phase: 25-update-and-reinstall-rows
    provides: plan 01's declared-range disclosures and plan 07's tree
provides:
  - optional cause on PluginUpdatedMessage and PluginReinstalledMessage
  - resolveRow turning an updated or reinstalled row's cause into its failure detail, markers still composed
  - update-row.ts::disclosureCause, the one disclosure-to-cause carrier both verbs read
  - constraintCauseFor widened to the updated partition
  - the cause line on the update-current-copy catalog state
affects: []

actuals:
  tokens: 9700
  tasks: 2
  commits: 2
plan_head_before: 5925f91c2a7aeb61cfaa4a4c71e68010fb51358a
plan_head_after: d9655167ca581d951bd6ea60443cfc298f0323a5

tech-stack:
  added: []
  patterns:
    - "One exported carrier (disclosureCause) turns a constraint disclosure into a cause line for the unchanged, updated, and reinstalled rows"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts (mini-spec comment only)
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - features/plugin/update.feature
    - features/plugin/reinstall.feature
    - docs/output-catalog.md
    - docs/json-output.md
    - docs/messaging-style-guide.md
    - docs/dependency-resolution.md
    - test/architecture/catalog-uat/fixtures/plugin-update.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts

key-decisions:
  - "resolveRow handles every updated and reinstalled row in one branch: it composes the markers from dependencies and adds remedyFailure(cause), which is empty when there is no cause"
  - "disclosureCause stayed file-private in task 1 and was exported in task 2, when reinstall.messaging.ts became its outside consumer (fallow's unused-export gate)"

requirements-completed: [UPR-03]

duration: 40min
completed: 2026-10-24
status: complete
---

# Phase 25 Plan 08: Updated and reinstalled rows name the admitting range Summary

**When a dependent's range chose what an update or reinstall installed, the `(updated)` or `(reinstalled)` row now carries the constraint gate's disclosure as its cause line, for example `    cause: constrained to the combined range (^1.0.0) -- required by "app@tools"`. The JSON row carries it as `cause`, with empty `leaks` and `rollbackPartial`. Both verbs and both update cascades read it through one carrier. Status, reasons, and severity are unchanged. An unconstrained row is byte-identical to before.**

## Accomplishments

- `notification-types.ts`: `PluginUpdatedMessage` and `PluginReinstalledMessage` have an optional `cause?: Error`. The doc explains that the disclosure interpolates plugin identifiers, so it rides the cause chain, as on the held `skipped` row.
- `notification-resolve.ts::resolveRow`: a new branch for `updated` and `reinstalled` rows, placed before the generic `dependencies` branch. It composes reasons from `dependencies` as before, and adds `remedyFailure(cause)`. The docs of `ResolvedFailure` and `remedyFailure` now list the two rows. ESLint's and fallow's complexity gates both pass.
- `notification-grammar.ts`: only the mini-spec comment changed. The cause line also follows a realized row whose producer set a cause. `notification-json.ts` and the schema did not change, because `wireRow` already wires any row's failure detail.
- `update-row.ts`: `disclosureCause(constraint)` is exported. `constraintCauseFor` covers the `unchanged` and `updated` partitions through it. The clean `(updated)` form of `updatedRowFromOutcome` spreads the cause when one is present. The `partially-installed` form has no cause slot and is unchanged.
- `reinstall.messaging.ts::reinstalledRowFromOutcome` spreads `disclosureCause(outcome.constraint)`.
- Catalog: `update-current-copy` shows `    cause: constrained to the combined range (^1.0.0) -- required by "alpha@mp"`. Its prose says the disclosure rides the cause line as on the ceiling and held rows. The prose of `reinstall-partial-component` says a range-admitted reinstall carries the same line.
- Guides: in `docs/json-output.md`, the plugin-row `cause` reads "Serialized cause line: a failure, a remedy, or the constraint disclosure of an updated or reinstalled row." `docs/messaging-style-guide.md` names the realized rows that may carry `cause`. `docs/dependency-resolution.md` says an update or reinstall that a range admitted names the range and its holders on its row.

## Task Commits

1. Task 1: an update that a dependent's range admitted names the range on its row. Commit `0ef1536e`.
2. Task 2: a reinstall does the same, and the guides say so. Commit `d9655167`.

## Disclosure clause each scenario pins

Both scenarios pin the range-only clause, because the `dir` marketplace has no release tag, so the gate admitted `^1.0.0` with no pin:

- `update.feature`, "Updating a dependency within the version range its dependent declares updates it": `constrained to the combined range (^1.0.0) -- required by "app@tools"`, `cause truncated` `false`, and empty `leaks` and `rollback partial`. The row keeps `dependency current copy`.
- `reinstall.feature`, new: "Reinstalling a dependency within the version range its dependent declares names the range on its row": `lib` `reinstalled` `dependency current copy` `1.0.0`, with the same cause chain. The reasons cell reads `dependency current copy` because the reinstall fell back to the marketplace's current copy. The plan's text did not name that token, and the run produces it.

## Tests

- `update-row.test.ts`: the carrier's `updated` arm, a whole `Error`. The current-copy case now expects the cause on the `(updated)` row and is retitled. The all-axes case shows that the `partially-installed` form carries none.
- `notification-resolve.test.ts`: one case resolves a constrained `updated` row and a constrained `reinstalled` row into their `failure` detail. Both still compose `requires pi-subagents` under a nothing-loaded snapshot. Two unconstrained rows resolve with no `failure` key. Whole rows are asserted.
- `notification-grammar.test.ts`: the exact bytes of an updated row with its cause line.
- `notification-json.test.ts`: the wire row with `cause`, `leaks: []`, and `rollbackPartial: []`.
- `notification-types.test.ts`: both messages with `cause` under `satisfies`.
- `update-cascade.test.ts` and `marketplace/update.messaging.test.ts`: the constrained updated row with its cause on each cascade.
- `reinstall.messaging.test.ts`: the current-copy reinstall row now carries the cause, and a new constrained row case.
- No existing `update-flow.test.ts` or `reinstall-flow.test.ts` expectation involved a constrained updated or reinstalled row, so neither file changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The disclosure helper is exported in task 2**
- The plan asked for an exported helper in task 1. Its only outside consumer, `reinstall.messaging.ts`, arrives in task 2, and fallow's unused-export gate fails an export that only its own module uses (see the 25-03 and 25-04 summaries). Task 1 kept it file-private, and task 2 exported it.
- Commits: `0ef1536e`, `d9655167`

**2. [Rule 3 - Blocking] Catalog byte total**
- `catalog-contract.test.ts` pins the total UTF-8 bytes of the catalog blocks. The plan's file list left it out. `EXPECTED_UTF8_BYTES` moved from 49_665 to 49_745 (+80, exactly the new cause line). The state count stays at 306.
- Commit: `d9655167`

**3. [Rule 2 - Test hygiene] Literal expectations**
- The new reinstall messaging case asserts a literal `new Error(disclosure)` and does not call the production helper to build its expected value.

No file owned by Phase 26 was staged, and `update-preflight.ts` was not edited.

## Verification

- `npm run test:coverage:direct` on `notification-types.ts`, `notification-resolve.ts`, `notification-grammar.ts`, `notification-json.ts`, `update-row.ts`, `update-cascade.ts`, `update-flow.ts`, and `marketplace/update.messaging.ts` (task 1), and on `reinstall.messaging.ts`, `reinstall-flow.ts`, and `update-row.ts` (task 2): exit 0.
- `npm run test:architecture`: exit 0.
- Cucumber: `update.feature` and `reinstall.feature`, 38 of 38.
- `grep -c "names the range on its row" features/plugin/reinstall.feature`: 1.
- `npm run check` at `d9655167`: exit 0, 758 of 758 scenarios.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-17 is mitigated: the success rows carry the same `describeConstraint` text that the held and ceiling rows already render. That text is built from allowlisted, bounded declared ranges and safe plugin keys, and it reaches the wire through `serializeCauseChain`, which redacts credentials.

## Self-Check: PASSED

- Commits `0ef1536e` and `d9655167` are ancestors of HEAD.
- `export function disclosureCause` is in `update-row.ts`, and `reinstall.messaging.ts` imports it.
- `cause: constrained to the combined range (^1.0.0) -- required by "alpha@mp"` appears in the `update-current-copy` block of `docs/output-catalog.md`.

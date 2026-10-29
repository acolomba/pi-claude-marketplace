---
phase: 03-dependency-cascade-rows-and-status
plan: 03
subsystem: dependency-cascade
tags: [install, dependency-cascade, notification, catalog, cucumber]

requires:
  - phase: 03-dependency-cascade-rows-and-status
    provides: "the invalid-root-id arm and the 324-state catalog from 03-02"
provides:
  - "export interface Unmaterialized { readonly unmaterialized: readonly string[] } in orchestrators/plugin/install-cascade.ts"
  - "unmaterialized (required) on the closure-failed and constraint-failed failure objects and on the member-failed arm"
  - "module-private recordingLookup(lookup, declared), hoisted from walkDependencyGraph; resolveCascade's required declared: DeclaredEdges parameter"
  - "module-private unmaterialized(rootKey, failing, declared, readThrough) exclusion helper"
  - "MaterializedCascade.phaseKeys"
  - "composeCascadeFailureMessage's optional moved?: readonly { readonly name: string }[] argument; module-private unmaterializedOf and unmaterializedRows"
  - "memberCause cuts absolute paths in a dependency's ledger error to basenames (redactAbsolutePaths / redactCauseChain)"
  - "two new install-dependencies.feature scenarios (rolled-back member, moved-once)"
affects: [03-04 (reads the hoisted declared map), 03-06 phase gate and D-PL3 decision records]

actuals:
  tokens: 15800
  tasks: 3
  commits: 3
plan_head_before: fdbedce2465860227831349aeca3dd0976abdeed
plan_head_after: 3e7c93a552631a41c8ee7e69eaac1c7e523e8bdc

tech-stack:
  added: []
  patterns:
    - "A failure arm carries the closure members it did not leave installed; the renderer turns each into a cause-less row with the root row's own token, so no closed set grows"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - test/orchestrators/plugin/install-cascade.messaging.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/plugin/dependency-plan.test.ts
    - features/plugin/install-dependencies.feature
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/plugin-install.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts

key-decisions:
  - "D-PL3-01 / D-PL3-02: every closure member a failed install would have newly materialized and did not gets `(failed) {dependency failed}`, no cause, severity error"
  - "D-PL3-03: walk, constraint, and non-root member ledger failures all carry the list"
  - "D-PL3-15: a key a moved row reports gets no second row; the root's own ledger failure, plan-step failures, and a lookup that throws mid-walk keep one row"
  - "T-03-48 (deviation): a dependency's own ledger error has its absolute paths cut to basenames in the cascade row, as a dependency move's row already does"

patterns-established:
  - "The closure-side list is REQUIRED (every producer answers); the subject-side list is OPTIONAL (subjects built outside the cascade have none)"

requirements-completed: [CAS-01]

coverage:
  - id: D1
    description: "install app@tools with app -> lib -> base (base not offered) lists lib@tools as {dependency failed}"
    requirement: CAS-01
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin with a dependency its marketplace does not offer fails as not in manifest and installs nothing"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#CAS-01 / D-PL3-01 a walk failure below a found dependency lists that dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "the app -> lib@^1.0.0, mid / mid -> lib@^2.0.0 conflict lists mid@tools"
    requirement: CAS-01
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose dependencies ask for versions that do not overlap fails as a version conflict and installs nothing"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#CAS-01 / D-PL3-01 a constraint failure lists the dependency that declared the other range"
        status: pass
    human_judgment: false
  - id: D3
    description: "a member ledger failure lists the members it rolled back and never reached"
    requirement: CAS-01
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose second dependency fails to install lists the dependency it rolled back as failed"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#CAS-01 / D-PL3-03 a member whose ledger fails lists the members rolled back and never reached"
        status: pass
    human_judgment: false
  - id: D4
    description: "a key a moved row reports gets no second row; walls and plan-moved keys get none"
    requirement: CAS-01
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose new dependency fails to install after a disabled dependency moved lists the moved dependency once"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#D-PL3-15 a listed member whose move another row reports gets no dependency-failed row"
        status: pass
    human_judgment: false
  - id: D5
    description: "the catalog's cycle and version-conflict examples show the linter@tools row"
    requirement: CAS-01
    verification:
      - kind: other
        ref: "test/architecture/catalog-uat/catalog-{contract,parser,wire}.test.ts (324 states, 54_539 bytes)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-10-27
status: complete
---

# Phase 3 Plan 03: Dependency Rows of a Failed Install Summary

**A failed install now prints a cause-less `(failed) {dependency failed}` row for every dependency it would have installed and did not: on a walk failure, a version-constraint failure, and a dependency's own install failure. A dependency already reported by a moved row is not listed twice.**

## Performance

- **Duration:** about 70 min
- **Started:** 2026-10-27T04:00Z
- **Completed:** 2026-10-27T05:10Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `resolveCascade` takes a `declared` map and walks with the hoisted `recordingLookup`. The four exported runners pass a fresh map, and `walkDependencyGraph` passes its own, so its behavior is unchanged. On a closure failure or a constraint failure the result carries `unmaterialized`: the keys the walk found, in lookup order, minus the root, minus the failing key (`chain.slice(-1)` for a cycle), and minus every `readThrough` key. Enabled recorded members are walls, so the walk never looks them up and never lists them.
- `materializeCascade` records `phaseKeys` (after the recorded-root filter). `failedCascade` answers `unmaterialized` as the phase keys minus the root and the failing key. The list therefore names members that were rolled back as well as members never reached.
- `composeCascadeFailureMessage` adds one row per listed key that is not the failing key, not the root, and not named by a `moved` row. The row has the root row's shape: `failed`, `{dependency failed}`, `error`, `needsReload: false`, and no cause. The rows go through `sortRows`, also when the failing subject is the root.
- `install-flow.ts`: `unwrapCascade` copies the list onto the member subject. `handleCascadeThrow` passes its moved rows to the composer as `moved`, and still appends them itself.
- `dependency-plan.ts::walkRefusal` is unchanged. A plan walk's failure object already carries the list, so the list reaches the renderer through that path too.
- The catalog's failure-attribution convention, the `dependency-cycle` and `dependency-version-conflict` examples, and the `dependency-install-failed` prose now describe these rows.

## Task Commits

1. **Task 1: A failed walk or constraint check lists every dependency the install would have installed** - `adf95dbe` (fix)
2. **Task 2: A failed member install lists the dependencies it rolled back or never reached, once each** - `7fd3862f` (fix)
3. **Task 3: The output catalog shows every dependency of a failed install** - `3e7c93a5` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `Unmaterialized`, `recordingLookup`, the `unmaterialized` helper, the `declared` parameter, `phaseKeys`, and the list on all three failure arms
- `test/orchestrators/plugin/install-cascade.test.ts` - 26 closure and constraint expectations now carry the list. There is a five-row CAS-01 table (walk below a found member, cycle, constraint, wall, plan-moved key), a middle-member ledger failure, a bare scheduler failure with dependencies, and the recorded-root expectation. The RESV-06 case was renamed so its title no longer says "verbatim".
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` - optional list on all three subject arms, `unmaterializedOf`, `unmaterializedRows`, the `moved` argument, path-redacted `memberCause`, and updated doc comments
- `test/orchestrators/plugin/install-cascade.messaging.test.ts` - walk, constraint, root-subject, and member cases with a list; a `moved` exclusion case; a T-03-48 redaction case; the two catalog-byte cases now carry `linter@tools`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` - `unwrapCascade` and `handleCascadeThrow` only
- `test/orchestrators/plugin/install-flow.test.ts` - the XMKT-01 transitive refusal now shows the `some-other-plugin@beta` row
- `test/orchestrators/plugin/dependency-plan.test.ts` - `unmaterialized: []` in the two `GraphWalkFailure` literals
- `features/plugin/install-dependencies.feature` - the `lib` and `mid` rows, plus two new scenarios
- `docs/output-catalog.md`, `test/architecture/catalog-uat/fixtures/plugin-install.ts`, `test/architecture/catalog-uat/catalog-contract.test.ts` - catalog prose, two example rows, fixtures, and 54_443 -> 54_539 bytes

## Decisions Made

D-PL3-01, D-PL3-02, D-PL3-03, and D-PL3-15 were applied as written. One deviation (T-03-48 path redaction) follows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] A dependency's install error showed an absolute staging path**
- **Found during:** Task 2, scenario B
- **Issue:** When a dependency's own ledger failed in the install cascade, `memberCause` passed the error message through unchanged. The row then showed `EACCES: permission denied, copyfile '<project>/.pi/pi-claude-marketplace/skills-staging/<uuid>/xxx-skill/notes.md'`. That broke the messaging module's own invariant ("no cascade row can carry ... a filesystem path"). The dependency-move row (`dependency-move.ts`) and `apply` already redact this text, and `redactCauseChain`'s doc names this case. Because the path holds a random uuid, the `{unreadable skill file copy error}` token the plan specified could not project, and scenario B could not be written at all.
- **Fix:** `memberCause` now builds the `DependencyCascadeError` from `redactAbsolutePaths(subject.error.message)` and `redactCauseChain(subject.error.cause)`. The root's own error still passes through unchanged.
- **Files modified:** install-cascade.messaging.ts and its test (the new T-03-48 case)
- **Verification:** Scenario B passes with the token. The whole cucumber suite passed, 906 of 906, after the change. So did `test/orchestrators`, `test/edge`, `test/architecture` (7001 tests), and `npm run test:integration`.
- **Committed in:** 7fd3862f

**2. [Rule 3 - Blocking] Scenario B's column layout and row order**
- **Found during:** Task 2
- **Issue:** The plan copied the column layout of the "second dependency move fails" scenario, including `version`. The xxx row carries no version, so the step refuses a stated column that no row fills. `handleCascadeThrow` also appends the moved rows after the composed, sorted rows, so the order is app, xxx, ddd.
- **Fix:** Dropped the `version` column and listed the rows in the order the run prints them.
- **Committed in:** 7fd3862f

**3. [Rule 3 - Blocking] Direct coverage of `install-flow.ts`**
- **Found during:** Task 2
- **Issue:** The planned `moved: movedRows(args.moved).map((row) => row.name)` adds an arrow in `install-flow.ts` that no install-flow test reaches. No test there drives a non-orchestrated cascade failure after a move. Direct coverage went to 104/105 functions.
- **Fix:** `moved` takes the moved rows (`readonly { readonly name: string }[]`). The messaging module maps their names, so the arrow sits where the messaging tests cover it. `handleCascadeThrow` computes `movedRows(args.moved)` once and uses it twice.
- **Committed in:** 7fd3862f

**4. [Rule 1 - Expectation] An install-flow test expectation (planned)**
- The XMKT-01 "direct install refuses a transitive foreign marketplace" case now shows `some-other-plugin@beta (failed) {dependency failed}`. That is a correct multi-member row, and the plan's Task 2 allows exactly this edit. Task 1 caused the row but did not run install-flow.test.ts (it was not in Task 1's verify), so the expectation changed in Task 2.

---

**Total deviations:** 1 security fix, 2 blocking fixes, 1 planned expectation change.
**Impact on plan:** The redaction changes what a user sees: a dependency's install error now shows a basename instead of an absolute path. Scenario B covers it. No closed set changed.

## Issues Encountered

- Before settling on the redaction, I tried two deterministic faults for scenario B: a git-source `xxx` pinned to a missing commit, and an `xxx` with an output style. With both, the plan refused before ddd moved. So the unreadable skill file is the only existing fault that fails a member ledger after a move, as the plan expected.
- RED evidence: scenarios A and the two edited scenarios failed before the code. Scenario B failed before Task 2 and, with the list but without the `moved` exclusion, showed a second `ddd@tools (failed) {dependency failed}` row.

## Touched outside Files

- `orchestrators/plugin/install-flow.ts`: `unwrapCascade` adds the list to the member subject, because only that arm is built field by field. `handleCascadeThrow` passes its moved rows to the composer (D-PL3-15). Nothing else in the file changed.
- `test/orchestrators/plugin/dependency-plan.test.ts`: two `GraphWalkFailure` literals need the now-required list. `dependency-plan.ts` is unchanged.
- `test/orchestrators/plugin/install-flow.test.ts`: one expectation (deviation 4).
- The catalog-UAT fixture and the byte pin.

## Known gaps

Per D-PL3-15, these routes keep their single failure row:

- The root's own ledger failure (`member-failed` with the root key). `unwrapCascade` builds no member subject for it, so the single-row path in `install-flow.ts` reports it. Phase 11 splits that path.
- UPD-DEP-D1 plan-step failures (a step of a dependency move). These are Phase 4's paths.
- `catalogLookup`'s member subject for a lookup that throws during the walk (RESEARCH A3).
- `previewFresh`'s member subject, `dependency-plan.ts::unmovable`, and the three MISS-01 closure literals in `install-flow.ts` build their subjects without a list, so they render as before. `dependency-bindings.ts::dependencyRefusal` keeps only failed rows with a cause, so update's settle refusal never shows the new rows.

## CHANGELOG line

- A failed install now lists every dependency it would have installed, each as `{dependency failed}`, and a dependency's install error no longer shows an absolute path.

## Decision rows

| **D-PL3-01 (plugin-lifecycle, uncertain): a failed install closure gives a row to every member it would have newly materialized but did not** -- beside the failing member's row and the root's row; a member already installed and unchanged by the plan, or one a plan moves, gets none | Claude Code names only the failing member on failure (E1), but it names every member on success, and this extension's row-per-plugin grammar already gives the root its own row | Shipped; unit tables and four `install-dependencies.feature` scenarios. For user review |
| **D-PL3-02 (plugin-lifecycle, uncertain): the row is `(failed) {dependency failed}`, no cause, severity `error`** | Reuses the root row's token, so `Reason`, `StatusToken`, and `PluginStatus` stay closed; the cause belongs to the failing member's row | Shipped. For user review (alternatives: a `skipped` row, a new token, or no row) |
| **D-PL3-03 (plugin-lifecycle): walk, constraint, and member ledger failures all carry the list** -- the walk lists the members it found before failing; a ledger failure lists the members it rolled back and those it never reached | All three routes reach `composeCascadeFailureMessage` with a cascade subject | Shipped |
| **D-PL3-15 (plugin-lifecycle, uncertain): scope of the rows** -- a key a moved row reports gets no second row; the root's own ledger failure and plan-step failures keep one row | The root's single-row path is Phase 11's; plan steps are Phase 4's | Shipped, with the gaps recorded. For user review (alternative: extend `install-flow.ts`'s single-row path now) |

## Backlog dispositions

- `CLOSUREROW-01`: fixed (CAS-01), with the D-PL3-15 gaps recorded under Known gaps.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The redaction in deviation 1 narrows T-03-48's surface: it removes a path from a row.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The catalog holds 324 states and 54_539 bytes; `catalog-wire.test.ts` still pins `PRESENTED.length = 335`. Plan 03-04 can read the `declared` map that `resolveCascade` now fills through `recordingLookup`. Plan 03-06 runs the phase gate (`npm run check`).

## Self-Check: PASSED

- All 11 modified files exist. Commits `adf95dbe`, `7fd3862f`, and `3e7c93a5` are on HEAD. Each lists exactly its task's files. `dependency-plan.ts` and `install-flow.ts` are not in Task 1's commit.
- Acceptance greps: `unmaterialized` in install-cascade.ts 7 and in install-cascade.messaging.ts 6; `recordingLookup` 2; `phaseKeys` 4; `unmaterialized: cascade.unmaterialized` in install-flow.ts 1; `linter@tools (failed) {dependency failed}` in the catalog 2.
- Owner tests (install-cascade, install-cascade.messaging, install-flow, dependency-plan): 500 pass, 0 fail. Direct coverage of the three sources reports nothing (exit 0). `install-dependencies.feature`: 38 of 38 pass. Catalog tests: 73 pass.
- Every commit passed the `npm run check:commit` hook.

---
*Phase: 03-dependency-cascade-rows-and-status*
*Completed: 2026-10-27*

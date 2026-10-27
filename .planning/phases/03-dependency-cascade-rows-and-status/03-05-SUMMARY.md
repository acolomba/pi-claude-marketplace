---
phase: 03-dependency-cascade-rows-and-status
plan: 05
subsystem: dependency-cascade
tags: [install, update, dependency-cascade, refusal, next-step-hint, cucumber, catalog]

requires:
  - phase: 03-dependency-cascade-rows-and-status
    provides: "the hoisted recordingLookup and unmaterialized lists (03-03); the directory pin refusal (03-04); catalog at 324 states / 54_539 bytes"
provides:
  - "optional declaredBy on the installed-unsatisfied arm of CascadeConstraintFailure (install-cascade.ts)"
  - "dependency-plan.ts::unmovable sets declaredBy from the move request's requesters"
  - "install-cascade.messaging.ts::installedUnsatisfiedCause (module-private) and rootKey threaded into constraintFailureFacts / rangeConflictFacts"
  - "install-dependencies.feature scenario for the offline git-dependency move refusal"
  - "catalog byte total 54_615 (state count unchanged at 324)"
affects: [03-06 phase gate and the D-PL3 decision records]

actuals:
  tokens: 8400
  tasks: 2
  commits: 2
plan_head_before: 8b4ba62bfafcee7903181c7ec3d4b28f0a4f148d
plan_head_after: 2c10f4431dc1e288afeaf57e41e807962d791dd9

tech-stack:
  added: []
  patterns:
    - "A refusal's next-step hint is conditioned on data the planner already holds (the move request's requesters), carried on the failure rather than on the request"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - test/orchestrators/plugin/dependency-plan.test.ts
    - test/orchestrators/plugin/install-cascade.messaging.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - features/plugin/install-dependencies.feature
    - features/plugin/update-dependencies.feature
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/plugin-install.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts

key-decisions:
  - "D-PL3-11: a cannot-move refusal ends with 'To look for a version in range, run /claude:plugin update <dependency>.' when the plugin the user named declares the dependency directly, for every source kind; a refusal that judged no move has no hint; DependencyMoveRequest gains no source field"

patterns-established:
  - "The hint joins the refusal with exactly one period: none is added when the refusal text already ends with one"

requirements-completed: [CAS-06]

coverage:
  - id: D1
    description: "An install refused because an installed dependency cannot move names the update to run when the named plugin declares the dependency"
    requirement: CAS-06
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose installed git-source dependency cannot move while the git host drops the connection names the update that looks for a version in range"
        status: pass
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose installed dependency another plugin holds outside its version constraint fails as a version conflict and changes nothing"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#UPD-DEP-D1 / CAS-06 an installed copy the requested plugin declares that cannot move names why and the update to run"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow.test.ts#UPD-DEP-D1: installing refuses a plugin whose installed dependency no release moves inside its range"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hint joins with one period and is absent when the named plugin does not declare the dependency or no move was judged"
    requirement: CAS-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#CAS-06 a move refusal that already ends with a period gets no second one before the update hint"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#CAS-06 a move refusal names no update when the requested plugin does not declare the dependency"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#CAS-06 a move refusal names no update when no declaring plugin is known"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#CAS-06 an installed copy no move was judged for names no update"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-plan.test.ts#UPD-DEP-D1: refuses a dependency no version moves into range, before anything else is judged"
        status: pass
    human_judgment: false
  - id: D3
    description: "Update's settle refusal and the output catalog show the same hint"
    requirement: CAS-06
    verification:
      - kind: e2e
        ref: "features/plugin/update-dependencies.feature#Updating a plugin whose new version needs a dependency version no release offers fails and keeps the installed versions"
        status: pass
      - kind: other
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-27
status: complete
---

# Phase 3 Plan 05: Version-in-Range Next-Step Hint Summary

**When an installed dependency cannot move into the range the named plugin declares, the refusal now ends with Claude Code's next step, `To look for a version in range, run /claude:plugin update <dependency>.`, for every source kind, including the offline git case.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-27T05:42:59Z
- **Completed:** 2026-10-27T05:57:50Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- The `installed-unsatisfied` arm of `CascadeConstraintFailure` gains an optional `declaredBy` (the keys of the plugins that declare the dependency). `checkInstalledMember` is unchanged and never sets it.
- `dependency-plan.ts::unmovable` sets `declaredBy` from `request.requesters`. It is the only producer, and both of its call sites reach it. `DependencyMoveRequest` is unchanged.
- `install-cascade.messaging.ts` threads `rootKey` from `failureFacts` through `constraintFailureFacts` into `rangeConflictFacts`. A new module-private `installedUnsatisfiedCause` builds the sentence. With no `moveRefusal` it keeps `which does not satisfy <range>.`. With a `moveRefusal` it keeps the `cannot move:` sentence. When `declaredBy` includes the root, it then adds one period (none if the refusal already ends with one) and the hint. The separator is a local, so no conditional sits inside a template literal.
- The offline scenario proves the git case end to end. Its lib row reads `... cannot move: the release tags could not be listed (network unreachable) -- required by "app@tools". To look for a version in range, run /claude:plugin update lib@tools.`, and the record keeps `lib@tools 1.0.0`.
- Every existing pin now carries the hint: three install scenarios, the install-flow case, the update scenario, and the catalog example with its fixture. The catalog prose states when the hint appears.

## Task Commits

1. **Task 1: An install refused offline on a git dependency's move names the update that looks for a version in range** - `e6295072` (fix)
2. **Task 2: Update's refusal and the output catalog show the version-in-range hint** - `2c10f443` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `declaredBy` on the installed-unsatisfied arm (type and doc only)
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts` - `unmovable` only: one line
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` - `installedUnsatisfiedCause`, `rootKey` threading
- `test/orchestrators/plugin/dependency-plan.test.ts` - `refusal()` takes `declaredBy`; its two call sites pass the requester keys
- `test/orchestrators/plugin/install-cascade.messaging.test.ts` - updated UPD-DEP-D1 case plus four CAS-06 cases, each a whole emitted notification
- `test/orchestrators/plugin/install-flow.test.ts` - one pinned cause string
- `features/plugin/install-dependencies.feature` - new offline scenario and three updated pins
- `features/plugin/update-dependencies.feature` - one updated pin
- `docs/output-catalog.md` - example bytes and one prose sentence
- `test/architecture/catalog-uat/fixtures/plugin-install.ts` - fixture cause string
- `test/architecture/catalog-uat/catalog-contract.test.ts` - `EXPECTED_UTF8_BYTES` 54_539 -> 54_615, read from the test's failure output

## Decisions Made

D-PL3-11 was applied as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- RED evidence: the new offline scenario failed before the code change, and only on the missing hint. The actual cause was `... -- required by "app@tools"`, which matches the RESEARCH probe exactly.
- Tracer gate: the Task 1 `<verify>` passed end to end before expansion. The three owner test files passed (384 tests, 0 failed). Direct coverage of the three sources reported nothing. `install-dependencies.feature` passed (41 of 41 scenarios).
- The update scenario needed no code change: update's settle passes `widget@tools` as the root, and the requesters include it.

## Touched outside Files

- `orchestrators/plugin/dependency-plan.ts` (`unmovable` only). Only `unmovable` holds the move request's requesters, which the hint's condition needs. This is Phase 4's file. `git diff e6295072^..e6295072 -- extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts` is one added line inside `unmovable`.
- `test/orchestrators/plugin/install-flow.test.ts` (one pinned cause string). `install-flow.ts` itself is unchanged.

## Known gaps

- Claude Code formats the command as `` `claude plugin update <key>` `` with backticks. This extension uses house style, `run /claude:plugin update <key>`, with no backticks, as `shared/notification-mcp.ts` and `reconcile.messaging.ts` do.
- The hint condition is "the named plugin declares the dependency". A dependency that only a transitive member declares gets no hint, as in Claude Code (E5).

## CHANGELOG line

- When an installed dependency cannot move into the range a plugin you install or update asks for, the refusal now tells you to run `/claude:plugin update <dependency>`.

## Decision rows

| **D-PL3-11 (plugin-lifecycle, uncertain): a `cannot move:` refusal ends with `To look for a version in range, run /claude:plugin update <dependency>.` when the plugin the user named declares the dependency directly, for every source kind** -- a refusal that judged no move gets no hint; `DependencyMoveRequest` gains no source field; the failure carries `declaredBy` | Claude Code adds the same next step under the same condition (2.1.310 `omn`, E5), for any source | Shipped; five messaging unit cases, one new offline git scenario, and every existing pin updated. For user review (alternative: limit the hint to git dependencies refused offline, as the backlog text implied) |

## Backlog dispositions

- `UPDDEP-01` b2: fixed. The next step is named for every source kind under Claude Code's condition (CAS-06, D-PL3-11).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-51 is mitigated as planned: the hint interpolates only the dependency key, and it appears only when `declaredBy`, which `unmovable` builds from the plan's own requesters, contains the root key. T-03-52 is accepted as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-06 can proceed. The catalog now holds 324 states and 54_615 bytes. Plan 03-06 runs the phase gate (`npm run check`).

## Self-Check: PASSED

- All eleven modified files exist. Commits `e6295072` and `2c10f443` are ancestors of HEAD, and each lists exactly its task's files.
- Acceptance greps: the hint text appears in install-cascade.messaging.ts 1 time. `declaredBy` appears in dependency-plan.ts 1 time. `To look for a version in range` appears in install-dependencies.feature 4 times, in update-dependencies.feature 1 time, and in docs/output-catalog.md 2 times.
- `grep -rn "cannot move:" features test docs` without the hint finds only the two CAS-06 messaging cases that pin its absence.
- `node --test` over dependency-plan, install-cascade.messaging, and install-flow: 384 pass, 0 fail. Direct coverage of the three sources reported nothing (exit 0). `install-dependencies.feature`: 41 of 41 pass. `update-dependencies.feature`: 16 of 16 pass. The catalog contract, parser, and wire tests: 73 pass, 0 fail, with the state count unchanged.
- Both commits passed the commit hook (`npm run check:commit` passed on each).

---
*Phase: 03-dependency-cascade-rows-and-status*
*Completed: 2026-10-27*

---
phase: 06-assertion-and-module-refinement
plan: 49
subsystem: plugin-list-orchestration
tags: [typescript, plugin-list, row-owners, tdd, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: List hub fixture and owner-extraction sequence from Plan 48
provides:
  - Dedicated installed-inventory row owner with direct exact tests
  - Dedicated candidate row owner with direct exact tests
  - Thin list hub wiring that preserves filtering, folding, ordering, and dispatch behavior
affects: [plugin-list, tool-list-projection, phase-06-hub-refinement, direct-coverage]
plan_head_before: 67cd65291d340cea5a72ec44c1e5f40395a0b64a
actuals:
  tokens: 19631
  tasks: 2
  commits: 8
tech-stack:
  added: []
  patterns:
    - project installed and candidate rows in mirrored, directly tested owner modules
    - keep the list hub responsible for enumeration, filtering, folding, ordering, and dispatch only
    - preserve exact optional fields through conditional object spreads
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
    - tests/orchestrators/plugin/list-installed-row.test.ts
    - tests/orchestrators/plugin/list-candidate-row.test.ts
    - .planning/tdd-evidence/06-49-01.json
    - .planning/tdd-evidence/06-49-02.json
    - .planning/phases/06-assertion-and-module-refinement/06-49-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/orchestrators/plugin/list.test.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
key-decisions:
  - "Keep composeInstalledListRow as the sole installed-inventory projector and pass only validated record, lookup, scope, and filesystem facts into it."
  - "Move availableRowMessage with its existing public name into list-candidate-row.ts so callers retain their API while ownership changes."
  - "Keep enumeration, filter union, orphan folding, stable sorting, and sole dispatch in list.ts; row owners return typed rows and buckets only."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Installed, partial, disabled, state-only, cross-scope, dependency, and upgrade rows keep exact fields and reason order.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/list-installed-row.test.ts and tests/orchestrators/plugin/list.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Available, remote, partial, unavailable, warm-cache, and probe-failure rows keep exact projection while list and tool consumers remain unchanged.
    requirement: TREF-09
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/list-candidate-row.test.ts, tests/orchestrators/plugin/list.test.ts, and tests/edge/handlers/tools.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow
        status: pass
    human_judgment: false
duration: 28min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 49: Plugin List Row Owner Extraction Summary

**Installed inventory and not-installed candidate rows now have separate, directly tested owners while the list hub preserves exact cardinality, order, folding, filtering, and output.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-09T20:28:24Z
- **Completed:** 2026-09-09T20:56:26Z
- **Tasks:** 2
- **Task commits:** 8
- **Files changed by task commits:** 14
- **Realized diff scale:** 19,631 estimate tokens (78,524 diff characters / 4)

## Accomplishments

- Moved every recorded-plugin projection arm into `list-installed-row.ts`, including disabled precedence, manifest absence, dependency markers, partial reasons, upgrade probing, and cross-scope fields.
- Moved every not-installed projection arm into `list-candidate-row.ts`, including cold and warm Git sources, resolver states, install-disabled claims, reason narrowing, and probe-failure fallback.
- Reduced `list.ts` by 692 removed lines while retaining its enumeration, filter union, orphan-fold, stable-sort, and dispatch responsibilities.
- Migrated the two exact projection cases out of the legacy hub suite and added full direct owner suites without duplicating flow assertions.
- Preserved the `availableRowMessage` public name at its new owner path and kept list-tool projection unchanged.

## Task Commits

1. **Task 1 RED: Installed owner contract** - `caf8f190` (test)
2. **Task 1 GREEN: Installed row extraction** - `7ed14682` (feat)
3. **Task 2 RED: Candidate owner contract** - `7956c435` (test)
4. **Task 2 GREEN: Candidate row extraction** - `03fc4048` (feat)
5. **Completeness gate fix: Public result type and static owner pairing** - `0fd92f13` (fix)
6. **Public contract fix: Preserve `availableRowMessage` at the new owner** - `8a0b5c14` (fix)
7. **Test review fix: Narrow fixture overrides** - `beb17e2d` (test)
8. **Lint fix: Keep owner loaders awaitable** - `fbb70f9a` (test)

## Files Created/Modified

- `list-installed-row.ts` and its mirrored test own all installed-inventory projections with exact direct coverage.
- `list-candidate-row.ts` and its mirrored test own all not-installed candidate projections with exact direct coverage.
- `list.ts` now calls the two row owners and retains orchestration-level enumeration, filtering, folding, sorting, and dispatch.
- `list.test.ts` retains flow, cardinality, stable-order, and exact rendered-output coverage while direct projection assertions moved to the owner suites.
- `tools.ts` remains behaviorally unchanged; its complete projection suite proves the moved row producers still feed the same tool rows.
- `info.ts`, `fetch.ts`, `git-source-probe.ts`, `plugin-state-classifier.ts`, and `edge-deps.ts` now name the current row owners in parity comments.

## Decisions Made

- Keep installed version comparison and candidate probing in the installed row owner because they decide the row variant and its exact fields.
- Keep filesystem-only Git presence and three-way resolver projection together in the candidate row owner so `remote`, `available`, `partially-available`, and `unavailable` cannot drift.
- Keep filter selection in the hub. Candidate owners return the typed bucket, but only `list.ts` combines it with user filter options.
- Preserve existing public names when ownership changes. This keeps cross-surface contracts stable while removing behavior from the hub.

## TDD Gate Compliance

- **Task 1 RED:** `caf8f190`; the direct owner suite failed 10/10 because `list-installed-row.ts` did not exist. `.planning/tdd-evidence/06-49-01.json` passed `tdd-red-evidence`.
- **Task 1 GREEN:** `7ed14682`; the installed owner and hub suites passed, and direct owner coverage reached 37/37 branches, 5/5 functions, and 166/166 lines.
- **Task 2 RED:** `7956c435`; the direct owner suite failed 8/8 because `list-candidate-row.ts` did not exist. `.planning/tdd-evidence/06-49-02.json` passed `tdd-red-evidence`.
- **Task 2 GREEN:** `03fc4048`; the candidate owner, hub, and tool suites passed. The final owner suite adds the warm-cache case and reaches 29/29 branches, 8/8 functions, and 186/186 lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Exported the installed owner result type and paired tests statically**

- **Found during:** Overall Fallow and corresponding-test verification
- **Issue:** The installed owner's exported signature referenced a private union, and the intentional RED dynamic imports were invisible to the static corresponding-test scanner.
- **Fix:** Exported `InstalledListRow` and changed both direct tests to static imports while retaining the recorded RED evidence.
- **Files modified:** `list-installed-row.ts`, `list-installed-row.test.ts`, `list-candidate-row.test.ts`
- **Commit:** `0fd92f13`

**2. [Rule 1 - Bug] Preserved the specified candidate public function name**

- **Found during:** Task 2 acceptance review
- **Issue:** The first extraction named the new function `composeCandidateListRow`, but the plan required the existing `availableRowMessage` public contract to move intact.
- **Fix:** Restored `availableRowMessage` at the new owner path and updated the hub and parity references.
- **Files modified:** `list-candidate-row.ts`, `list.ts`, its owner and hub tests, and parity comments
- **Commit:** `8a0b5c14`

**3. [Rule 3 - Blocking issue] Tightened owner-test fixtures and fixed await lint**

- **Found during:** TypeScript unit-test review and full lint verification
- **Issue:** The installed test helpers accepted broad `Partial` production objects, and static owner pairing made the former asynchronous loader calls non-thenable.
- **Fix:** Added narrow fixture override interfaces and returned the statically imported owners through typed resolved promises.
- **Files modified:** `list-installed-row.test.ts`, `list-candidate-row.test.ts`
- **Commits:** `beb17e2d`, `fbb70f9a`

## Verification

- Installed owner plus list hub: **99/99 tests pass** before the candidate extraction.
- Candidate owner plus final list hub and tool projection: **150/150 tests pass**.
- `list-installed-row.ts` direct coverage: **166/166 lines, 5/5 functions, 37/37 branches**.
- `list-candidate-row.ts` direct coverage: **186/186 lines, 8/8 functions, 29/29 branches**.
- `npm run typecheck`: pass.
- `npm run lint`: pass with zero warnings.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- Scoped Prettier over all changed TypeScript and evidence files: pass.
- `git diff --check`: pass.
- Stale owner scan: `installedRowMessage` is absent; `composeInstalledListRow` exists only in its owner, direct test, hub call, and current parity comments; `availableRowMessage` is implemented only in `list-candidate-row.ts` and called by `list.ts`.

## Issues Encountered

- The list integration and tool suites use subprocesses that the workspace sandbox terminates without assertion output. The same commands pass outside the sandbox under the pre-authorized test permission.
- The repository-wide formatting command includes the preserved unrelated untracked `.mcp.json`, so formatting was checked only across Plan 49 files.
- The full unit command retains the known pre-existing `tests/architecture/revalidation.test.ts` sealed Phase 1 mismatch for legitimate TREF-04 through TREF-09 planning. Plan 49 does not modify that test or its sealed contract.
- The linked worktree stores Git metadata outside the sandbox writable root, so atomic commits used the authorized external Git permission.
- Existing unrelated configuration, Phase 1 review artifacts, `.codegraph`, `.mcp.json`, and `AGENTS.md` were preserved and excluded from every commit.
- The optional broken-windows append could not run because the pre-existing rendered table in `.planning/WINDOWS.md` disagrees with its fenced JSON source for rows 9 and 30. This plan did not alter that unrelated ledger drift.

## Known Stubs

None. The legacy list hub's synthetic placeholder name is an intentional, tested failure-row fallback and is not a new or unwired stub.

## Threat Flags

None. The extraction preserves validated manifest/state inputs, typed redacted rows, filesystem-only probes, stable ordering, and the existing sole dispatch boundary. It adds no endpoint, authentication path, schema, or file-access capability.

## User Setup Required

None.

## Next Phase Readiness

- Installed and candidate projection now have mirrored direct owner pairs with complete direct coverage.
- The list hub is smaller and retains only orchestration responsibilities required by Plans 50-51.
- All exact output, ordering, cardinality, fold, filter, tool-projection, type, pairing, lint, and Fallow gates are green.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary, both row owners, both mirrored owner tests, and both RED evidence records exist. All eight task and corrective commits resolve from the persisted plan base, the measured task-commit count is eight, and every required plan gate passes.

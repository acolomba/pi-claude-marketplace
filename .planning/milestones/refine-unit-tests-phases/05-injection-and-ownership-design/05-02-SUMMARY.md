---
phase: 05-injection-and-ownership-design
plan: 02
subsystem: testing
tags: [dependency-injection, hooks, filesystem, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: required-adapter and real-tree patterns from Plan 05-01
provides:
  - required hooks-owned state reader shared by registration and project hydration
  - required four-operation hooks tree inspector with explicit Node composition
  - owner evidence for hydration order, cache replacement, exact faults, and staging containment
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 9807
  tasks: 2
  commits: 7
plan_head_before: fb4ce611e5dde32ddf0b691cd992eecaf795fae3

tech-stack:
  added: []
  patterns:
    - required consumer-owned capability factories
    - private Node adapters bound into existing public operations

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - extensions/pi-claude-marketplace/index.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/index.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
    - tests/bridges/hooks/stage.test.ts

key-decisions:
  - "Keep hydration and staging as separate consumer-owned capabilities because they grant different authority and have different lifetimes."
  - "Expose required factory-bound operations while retaining Node-backed legacy exports so existing integration callers remain valid without optional consumer defaults."
  - "Use case-local inspectors only for irreproducible faults and timing races; ordinary behavior remains on real temporary filesystems."

patterns-established:
  - "Bound capability: one required reader value serves registration, resources-discover hydration, and captured lazy SessionStart hydration."
  - "Narrow inspection: hook staging controls only lstat, readdir, readlink, and realpath; validation, policy, writes, and removals remain real."

requirements-completed: [TREF-04]

coverage:
  - id: D1
    description: "Hooks hydration uses one required state reader across registration, project hydration, and lazy SessionStart while preserving order, cache replacement, and diagnostics."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts"
        status: pass
      - kind: integration
        ref: "tests/index.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hook staging uses one required four-operation tree inspector while real containment, no-follow traversal, bytes, skip behavior, and exact failures remain unchanged."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/stage.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/stage.ts"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 2: Hooks Hydration and Staging Ownership Summary

**Hooks hydration and staging now use separate required capabilities with explicit Node bindings, exact behavioral preservation, and 100% direct coverage.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-07T19:50:06Z
- **Completed:** 2026-09-07T20:22:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Classified HHD-011 as a hooks-owned `loadState` reader shared by registration, project hydration, and the captured lazy SessionStart path.
- Classified HSA-026 as a hooks-staging-owned inspector limited to `lstat`, `readdir`, `readlink`, and `realpath`.
- Preserved real temporary-tree behavior, hydration order, cache replacement, diagnostics, no-follow containment, exact errors and bytes, existing integration callers, and Phase 6 machinery.

## Task Commits

Each TDD phase and compatibility correction was committed separately:

1. **Task 1 RED: hooks hydration reader cases** - `91f7b4e9` (test)
2. **Task 1 GREEN: required hooks hydration reader** - `84d3f0ff` (feat)
3. **Task 1 REFACTOR: public hydration contracts** - `e2040566` (refactor)
4. **Task 2 RED: hooks tree inspector cases** - `b23e7bc8` (test)
5. **Task 2 GREEN: required hooks tree inspector** - `10ae1f06` (feat)
6. **Task 2 REFACTOR: public inspector contracts and real timing race** - `7293e503` (refactor)
7. **Compatibility fix: statically discoverable hydration export** - `4c546fb7` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - Adds the required reader, bound hydration factory, and explicit Node-backed compatibility exports.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` - Re-exports the genuine hydration contracts and factory.
- `extensions/pi-claude-marketplace/index.ts` - Constructs one production hydration binding and reuses it for registration and resources discovery.
- `tests/bridges/hooks/event-router.test.ts` - Proves shared reader identity, user-before-project order, cache replacement, exact degradation, and lazy forwarding.
- `tests/bridges/hooks/index.test.ts` - Proves the barrel exposes the production factory and reader contract.
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` - Adds the required four-operation inspector and Node-bound writer factory.
- `tests/bridges/hooks/stage.test.ts` - Replaces hooks-staging builtin mutation with case-local fault inspectors while preserving real-tree cases.

## Decisions Made

- The state reader and staging inspector remain separate. State hydration and no-follow tree inspection do not share operations, consumers, or lifetimes.
- `createHooksHydration(reader)` and `createWriteHookConfig(inspector)` are the required consumer APIs. Their consumers do not select defaults.
- Existing hydration and staging exports remain genuine Node-backed production operations composed from those required factories.
- TREF-04 remains pending in the project requirement ledger because later Phase 5 plans must classify the remaining roots.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved undeclared integration callers through factory-bound compatibility exports**
- **Found during:** Task 1
- **Issue:** Requiring a reader directly on the two existing public call signatures would require edits to eleven integration files outside this plan's declared ownership.
- **Fix:** Added a required-reader factory and bound the unchanged public exports to one explicit Node reader. `claudeMarketplaceExtension` constructs its own required production binding once, and injection tests call the factory API.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `extensions/pi-claude-marketplace/bridges/hooks/index.ts`, `extensions/pi-claude-marketplace/index.ts`, and their declared owner tests.
- **Verification:** All focused, full-unit, and integration suites pass; direct coverage remains 100%.
- **Committed in:** `84d3f0ff`, `e2040566`

**2. [Rule 1 - Bug] Restored the public hydration function declaration required by the WR-01 architecture scanner**
- **Found during:** Repository-wide unit verification
- **Issue:** Binding the compatibility export as a `const` preserved runtime behavior but made its cache-clear prefix invisible to the existing static architecture test.
- **Fix:** Restored an exported async function declaration that delegates to the same Node-bound factory operation and documents its cache-clear-first contract.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
- **Verification:** `tests/architecture/hooks-lifecycle.test.ts`, focused hydration tests, direct coverage, typecheck, lint, and the full 5,406-test suite pass.
- **Committed in:** `4c546fb7`

---

**Total deviations:** 2 auto-fixed (1 blocking compatibility adjustment, 1 behavior-preserving architecture-test fix).
**Impact on plan:** Both changes stay inside declared files, retain required consumer APIs, and preserve all existing production callers without widening either capability.

## Issues Encountered

- The first stage direct-coverage run exposed the generic rethrow after a resolved target changes type. A real-filesystem timing race now covers that path without global builtin mutation.
- Exact `npm run check` reaches and fails only `format:check` because the pre-existing untracked `.mcp.json` is not formatted. The file was preserved unchanged. Plan-owned formatting and every remaining check stage passed independently.
- Sandbox-only subprocess restrictions initially obscured the direct-coverage negative-control result and three full-suite files. The negative controls and final 5,406-test unit suite passed outside the sandbox; integration passed in the sandbox.
- Best-effort `WINDOWS.md` deviation recording was skipped because its pre-existing rendered table disagrees with its fenced JSON entries for rows 9 and 30. This plan did not alter that shared ledger.

## Verification

- Both task `<verify>` command chains passed exactly.
- Direct coverage: `event-router.ts` 84/84 branches, 25/25 functions, 875/875 lines; hooks barrel 1/1 branch and 27/27 lines; extension index 17/17 branches, 3/3 functions, and 168/168 lines; hooks stage 37/37 branches, 12/12 functions, and 274/274 lines.
- `npm run typecheck`, repository lint, Fallow, and focused ESLint passed with no new suppression.
- Plan-owned Prettier check, corresponding-test gate, corresponding negative controls, and direct-coverage negative controls passed.
- `npm test` passed 5,406 tests with zero failures outside the sandbox.
- `npm run test:integration` passed all 13 integration files.
- `tests/bridges/skills/stage.test.ts` is unchanged, its Phase 6 machinery remains present, and no undeclared source or test file changed.
- `scripts/revalidation.mjs:1124` remains byte-exact: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## TDD Gate Compliance

- Task 1 RED failed because `createHooksHydration` did not exist; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 1 GREEN and REFACTOR passed owner suites, all three direct coverage gates, typecheck, and focused lint.
- Task 2 RED failed because `createWriteHookConfig` did not exist; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 2 GREEN and REFACTOR passed the stage and path-safety suites, 100% stage direct coverage, typecheck, and focused lint.

## Known Stubs

None. The established empty `placeholderCtx` in the modified extension entry point does not flow to rendering and was not introduced or changed by this plan.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

HHD-011 and HSA-026 have terminal, separate classifications. Later Phase 5 ownership work can consume the required factories, and Phase 6 can remove retained global-patch machinery without changing these consumer contracts.

## Self-Check: PASSED

- All seven plan-owned modified files and this summary exist.
- All seven task and corrective commits exist in repository history.
- Summary metadata parses and names the required factories, coverage evidence, decisions, and TREF-04 classification.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_

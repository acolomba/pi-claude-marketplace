---
phase: 05-injection-and-ownership-design
plan: 03
subsystem: testing
tags: [dependency-injection, plugin-fetch, plugin-info, filesystem, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: required consumer-owned capability and real-adapter patterns from Plan 05-01
provides:
  - required fetch-owned status capability for pre/post materialization classification
  - required plugin-info UTF-8 reader and directory-list capability
  - production Node adapters and exact owner evidence for both boundaries
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 11737
  tasks: 2
  commits: 4
plan_head_before: e3d7b33a545f4c53fcf20c0f8cc0e1650a0b025c

tech-stack:
  added: []
  patterns:
    - required consumer-owned capability factories
    - private production adapters bound into unchanged public operations

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "Keep fetch status and plugin-info reads as separate consumer-owned capabilities because they expose different authority and lifetimes."
  - "Limit plugin-info injection to UTF-8 text reads and Node directory-entry listings; containment, parsing, classification, rendering, and notifications remain cohesive in info.ts."
  - "Retain builtin synchronization tests for Phase 6 while adding case-local capability evidence for the newly classified boundaries."

patterns-established:
  - "Fresh status: one required fetch capability controls the pre-materialization presence probe and post-materialization manifest classification."
  - "Cohesive reader: one required info capability exposes only text reads and directory entries while the consumer retains all policy."

requirements-completed: [TREF-04]

coverage:
  - id: D1
    description: "Fetch uses one required status capability before and after real materialization while preserving clone trees, staging, credentials, and exact notifications."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#renders fresh status after materialization through the required capability"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Plugin info uses one required read/list capability while preserving exact failure identity, reason placement, tree safety, diagnostics, and network-free behavior."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#OPIC-F27 required reader cases"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 3: Fetch Status and Plugin Info Ownership Summary

**Fetch status and plugin-info reads now use separate required capabilities with explicit Node bindings, exact public-effect proofs, and 100% direct owner coverage.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-07T20:28:43Z
- **Completed:** 2026-09-07T20:52:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Classified OPEF-F04 as a fetch-owned capability limited to existing source-presence and manifest-entry classification operations.
- Classified OPIC-F27 as an info-owned capability limited to UTF-8 text reads and Node directory-entry listings.
- Preserved real clone and fixture trees, exact failure identity and reason placement, credentials and staging behavior, debug diagnostics, notification bytes, info cohesion, network fences, and retained Phase 6 synchronization machinery.

## Task Commits

Each TDD phase was committed separately:

1. **Task 1 RED: fetch status factory proof** - `1bb5eaa3` (test)
2. **Task 1 GREEN: required fetch status capability** - `5fde1e3d` (feat)
3. **Task 2 RED: plugin-info reader factory proof** - `5ff22a6c` (test)
4. **Task 2 GREEN: required plugin-info reader capability** - `9086a7e0` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` - Adds `FetchStatus`, `createFetchPlugins`, and the explicit Node-backed production status binding.
- `tests/orchestrators/plugin/fetch.test.ts` - Proves required factory exposure and pre/materialize/post freshness through complete clone, staging, credential, and notification effects.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - Adds `PluginInfoReader`, `createGetPluginInfo`, and the explicit Node-backed production reader without splitting the module.
- `tests/orchestrators/plugin/info.test.ts` - Proves selected read/list failure identity, exact reasons, call order, tree safety, and notifications while retaining real-tree and builtin-patch coverage.

## Decisions Made

- Fetch status and plugin-info reads remain separate. Sharing them would create a broad filesystem/status bag across unrelated consumers.
- `createFetchPlugins(status)` and `createGetPluginInfo(reader)` are the required consumer APIs. The unchanged public operations are genuine production bindings, not optional or test-only seams.
- Plugin-info path derivation, containment, parsing, missing/corrupt classification, inventory construction, reason ordering, rendering, diagnostics, and notification delivery remain inside `info.ts`.
- TREF-04 remains pending in the project requirement ledger because later Phase 5 plans classify the remaining roots.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Exact `npm run check` reached and failed only `format:check` because the pre-existing untracked `.mcp.json` is not formatted. The file was preserved unchanged. Plan-owned formatting and every subsequent check stage passed independently.
- The direct-coverage negative controls require child process creation, and two unrelated unit suites require child processes or a Unix socket. Their sandbox runs reported `EPERM`; all three passed unchanged with the required process permissions.

## Verification

- Both task `<verify>` command chains passed exactly.
- Direct coverage passed at 78/78 branches, 15/15 functions, and 572/572 lines for `fetch.ts`; and 314/314 branches, 66/66 functions, and 2485/2485 lines for `info.ts`.
- Repository typecheck, lint, Fallow, corresponding-test gates, corresponding negative controls, direct-coverage negative controls, and focused ESLint passed.
- The aggregate unit run passed 246 of 248 files in the sandbox; the two sandbox-restricted files then passed independently with 136/136 and 57/57 tests.
- `npm run test:integration` passed all 13 integration files.
- The owned diff contains only the four declared source/test files, introduces no suppression, keeps info network-free and cohesive, and retains the existing global patch machinery.
- `scripts/revalidation.mjs:1124` remains byte-exact: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## TDD Gate Compliance

- Task 1 RED failed because `createFetchPlugins` was absent; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 1 GREEN passed the owner suite, 100% direct coverage, typecheck, focused lint, and the tracer feedback gate.
- Task 2 RED failed because `createGetPluginInfo` was absent; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 2 GREEN passed the owner suite, 100% direct coverage, typecheck, and focused lint.

## Known Stubs

None. The newly added empty arrays are test-only call logs populated by exercised operations; none flows to UI rendering or represents placeholder data.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

OPEF-F04 and OPIC-F27 now have terminal, separate classifications. Later Phase 5 work can classify the remaining ownership roots, and Phase 6 can remove retained builtin patching against these production-used contracts without broadening either capability.

## Self-Check: PASSED

- All four plan-owned modified files and this summary exist.
- All four task commits exist in repository history.
- Summary metadata records the required factories, coverage evidence, decisions, measured actuals, and TREF-04 classification.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_

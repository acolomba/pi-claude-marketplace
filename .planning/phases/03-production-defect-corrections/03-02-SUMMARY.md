---
phase: 03-production-defect-corrections
plan: "02"
subsystem: agent-component-staging
tags: [typescript, agents, multi-directory, first-wins, node-test]

requires:
  - phase: 01-live-evidence-revalidation
    provides: Terminal multi-directory agent finding BA-015
provides:
  - Ordered multi-directory agent discovery and staging contract
  - Install preview and live staging agreement across all resolved agent directories
  - Deterministic first-wins duplicate handling with warnings across directories
affects: [phase-03, plugin-install, plugin-update, plugin-reinstall, agent-staging]

actuals:
  tokens: 8090
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - Carry resolver-owned component path arrays without collapsing them
    - Use one ordered agent-directory list for preview and live materialization

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/bridges/agents/types.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/orchestrators/plugin/discover-names.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "Treat resolver order as authoritative and retain the first generated agent when later directories declare the same name."
  - "Use the same ordered `agentsDirs` value for install conflict preview and live staging so they cannot disagree."
  - "Export a temporary typed singular-input compatibility union for update/reinstall; Plan 03-03 removes it after migrating those callers."

patterns-established:
  - "Ordered component propagation: map every resolver path to an absolute path once, then pass the list unchanged through discovery and staging."
  - "Cross-directory duplicates: preserve the first artifact and surface every later collision through the existing warning channel."

requirements-completed: [PDEF-01]

coverage:
  - id: D1
    description: "Empty, single, and multiple ordered agent-directory inputs stage correctly, including first-wins duplicates."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/bridges/agents/stage.test.ts#multi-directory agent staging"
        status: pass
    human_judgment: false
  - id: D2
    description: "Install preview detects agents in later directories and live staging materializes the same ordered set."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#multi-directory agents"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/discover-names.test.ts#multi-directory agents"
        status: pass
    human_judgment: false
  - id: D3
    description: "All four production owners have complete direct line, branch, and function coverage."
    requirement: PDEF-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- <each Plan 03-02 production owner>"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 02: Ordered Multi-Directory Agent Staging Summary

**Install preview and live staging now consume every resolver-ordered agent directory, preserve the first duplicate, and emit the existing warning for later collisions.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-07T04:48:43-04:00
- **Completed:** 2026-09-07T05:01:54-04:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Promoted `agentsDirs` to the canonical bridge and install context representation without collapsing resolver output to one directory.
- Kept conflict preview and live materialization on the same ordered directory list, including agents found only in later directories.
- Proved empty, singleton, multiple-directory, and declared/conventional duplicate cases with hermetic fixtures.
- Preserved containment validation, generated destination naming, first-wins behavior, and warning text.

## Task Commits

Each TDD transition and completion-gate correction was committed atomically:

1. **Task 1 RED: Add failing multi-directory agent staging tests** - `629f0262` (test)
2. **Task 1 GREEN: Stage ordered agent directories** - `aadb7e31` (feat)
3. **Task 2 RED: Add failing install agent-directory tests** - `e99dcbbf` (test)
4. **Task 2 GREEN: Install all resolved agent directories** - `811d302f` (feat)
5. **Completion gate: Export the temporary compatibility contract and simplify the fixture helper** - `c7b47090` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - Defines list-valued staging input and the temporary typed migration union.
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` - Canonicalizes compatibility input once and discovers every ordered directory.
- `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` - Resolves all agent component paths and previews their complete generated-name set.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Carries the preview list into live staging unchanged.
- `tests/bridges/agents/types.test.ts` - Locks the list-valued bridge contract.
- `tests/bridges/agents/stage.test.ts` - Covers empty, singleton, multiple-directory, and duplicate staging behavior.
- `tests/orchestrators/plugin/discover-names.test.ts` - Covers ordered discovery and cross-directory warnings.
- `tests/orchestrators/plugin/install.test.ts` - Covers later-directory conflicts and successful multi-directory materialization.

## Decisions Made

- Resolver order is the stable tie-breaker. A later directory never replaces an earlier generated agent with the same name.
- Preview and live staging share the same `agentsDirs` value; reconstructing or independently selecting the live paths would permit drift.
- Update and reinstall still pass the singular field until Plan 03-03. The bridge accepts that field only through an explicit temporary union and immediately converts it to a list.

## Deviations from Plan

### Temporary compatibility type had to be exported

- Fallow correctly reported that exported `prepareStagePluginAgents` leaked a private input type.
- The migration union moved to the public bridge type module, with a removal marker tied to Plan 03-03.
- No runtime behavior or public command surface changed.

### Test fixture helper was extracted

- The new directory/description fixture options raised `writePluginComponents` above the cognitive-complexity threshold.
- Agent-file creation moved to `writeAgentComponent`, restoring the Fallow gate without a suppression.

## Issues Encountered

- The first Fallow run found the private exported-signature type; the second found fixture-helper complexity. Both were corrected structurally, and the final full Fallow run passed.
- No containment, symlink, ordering, warning, or preview/live disagreement regression was found.

## Verification

- All four plan-owned test suites passed together.
- Direct coverage passed for `types.ts`, `stage.ts`, `discover-names.ts`, and `install.ts`; each target reached 100% lines, branches, and functions (or the type-only equivalent).
- `npm run typecheck` passed.
- Focused ESLint over all eight plan-owned TypeScript files passed with zero warnings.
- Focused Prettier verification passed.
- `npm run fallow` passed dead-code, health, and duplicate gates.
- TypeScript Google Style and unit-testing review found no test-only production seam, order-dependent global mutation, network access, or real-home access.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The install path is fully list-valued.
- Plan 03-03 can migrate update/reinstall and delete `agentsSourceDir`, `PrepareStageAgentsInput`, and `pickAgentsSourceDir`.
- PDEF-01 remains phase-shared until every mapped consumer plan completes.

## Self-Check: PASSED

- All eight plan-owned source/test files and this summary exist.
- All five implementation/test commits are present in git history.

---

_Phase: 03-production-defect-corrections_
_Completed: 2026-09-07_

---
phase: 113-orchestrator-support-and-presenters
plan: 28
subsystem: plugin-update-messaging
tags: [typescript, node-test, update-row, messaging, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: Root orchestrator outcome contracts from P113-35
provides:
  - Complete direct ownership of updated and partially-installed update-row composition
  - Exact reason, dependency, severity, scope, version, and reload contracts
  - True optional-reasons omission for clean updated rows
affects:
  - Manual update and marketplace autoupdate presenters
  - MOD-06 orchestrator-support verification
actuals:
  tokens: 4400
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Complete fresh typed outcomes with independently authored whole-row expectations
    - Behavior-bearing reason and dependency order asserted as literal arrays
key-files:
  created:
    - tests/orchestrators/plugin/update-row.test.ts
  modified: []
key-decisions:
  - Covered the four dependency cells as separate complete cases instead of deriving expected markers.
  - Treated newly-versus-already-degraded severity as caller policy and asserted both inputs explicitly.
  - Proved optional reasons by both complete equality and an own-property absence assertion.
requirements-completed: [MOD-06]
coverage:
  - id: D1
    description: Updated rows preserve exact version transitions, scope, reload, dependencies, severity, and optional omission.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/update-row.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Partial rows preserve orphan, malformed, and unsupported reason order plus already/newly-degraded severity policy.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
        status: pass
    human_judgment: false
duration: 10 min
completed: 2026-09-01
status: complete
---

# Phase 113 Plan 28: Update Row Composition Summary

**Update-row composition now has one direct owner proving every dependency, degradation, reason, severity, version, reload, and optional-omission partition at 100% direct coverage.**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-09-01
- **Tasks:** 1
- **Files created:** 1 owner test

## Accomplishments

- Added ten independent cases covering both returned row forms.
- Proved the agents/MCP dependency four-cell matrix and agents-before-MCP order.
- Proved absent and empty partial degradation remain normal updated rows with no `reasons` key.
- Proved orphan-rewake, malformed skill/command, and dropped-kind reasons compose in their exact public order.
- Proved malformed content overrides base severity while orphan rewake does not.
- Proved already-degraded and newly-degraded partial rows retain the caller's explicit info/warning policy.
- Proved exact from/to transitions, partial-row version, scope, and `needsReload: true` on every realized update.
- Reached 100% direct coverage for `update-row.ts`: 17/17 branches, 2/2 functions, and 147/147 lines.

## Task Commit

1. **Task 1: Exhaust public partitions and consolidate direct assertions** - `34a59f38` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/update-row.test.ts` - Sole mirrored owner for update-row composition.

Production `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` is unchanged.

## Supplemental Disposition

- Retained `tests/domain/source.test.ts` unchanged. It owns parsed-source behavior and carries no direct update-row assertion; its focused suite passes.
- No supplemental duplicated this previously unowned leaf pair, so no file was changed or removed.

## Decisions Made

- Used complete literals for every outcome and expected row; no scenario table or production-like expected-value conditional was introduced.
- Preserved reason and dependency order because both determine rendered bytes.
- Kept invalid `PluginUpdateOutcome` combinations in the P113-35 compile-only owner rather than forging runtime values.
- Kept the owner pure and offline because the production pair has no filesystem, environment, subprocess, network, or injected collaborator boundary.

## Verification

- `node --test tests/orchestrators/plugin/update-row.test.ts` - passed; 10 named cases.
- `node --test tests/domain/source.test.ts` - passed.
- `npm run typecheck` - passed on the full concurrent working tree.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` - passed at 17/17 branches, 2/2 functions, and 147/147 lines.
- Targeted ESLint and Prettier checks - passed.
- Lowercase-AAA, no-skip, no-ignore, no-impossible-cast, and `git diff --check` gates - passed.

## Deviations from Plan

None - the new direct owner follows the planned boundary exactly.

## Issues Encountered

None.

## User Setup Required

None.

## Known Stubs

None.

## Security Review

T-113-28 is mitigated: complete typed outcomes cannot silently drop degradation reasons or dependencies, malformed outcomes cannot render with clean severity, and clean rows prove actual optional-key omission rather than an `undefined` placeholder.

## Next Phase Readiness

The update-row leaf is singularly owned and ready for both update presenter surfaces. No blocker remains.

## Self-Check: PASSED

- The direct owner and this summary exist.
- Commit `34a59f38` contains only the P113-28 owner.
- Production `update-row.ts` is unchanged.
- Focused execution, retained domain execution, global typecheck, exact direct coverage, lint, format, structural scans, and diff checks pass.
- No generated oracle, external boundary, impossible cast, test seam, skip, coverage ignore, or second Phase 113 pair was introduced.

---

_Phase: 113-orchestrator-support-and-presenters_
_Completed: 2026-09-01_

---
phase: 10-lifecycle-test-and-harness-gaps
plan: "04"
subsystem: plugin-lifecycle-orchestration
tags: [apply, import, marketplace-source, rollback, cucumber]
requires:
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "03"
    provides: typed dependency-install failure carriers and complete cascade rows
  - phase: 06-import-marketplace-planning
    provides: import source re-add path and batched config post-pass
provides:
  - MISS-01 apply rollback-partial detail with typed staging warnings and MCP notices
  - Idempotent apply/load replacement of changed marketplace sources through the locked add path
  - Import re-add write-back to the marketplace declaration's owning local layer
  - Bare JSON ids for import-owned marketplace failure rows
affects: [phase-10-verification, phase-11-install-flow-split, plugin-lifecycle]
actuals:
  tokens: 19254
  tasks: 3
  commits: 3
plan_head_before: a3fbb6de07458eacb60636ebe1b4b1ca2a227e30
plan_head_after: 86ecfbf9271293512c22c91fdbee7516b8bb2cfd
tech-stack:
  added: []
  patterns:
    - source replacements reuse the locked marketplace-add transaction instead of mutating clones or state directly
    - tagged staging diagnostics cross orchestrator boundaries without collapsing discovery and hygiene warnings
    - import carries config claim name and layer together through its batched post-pass
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - features/plugin/apply.feature
    - features/plugin/import.feature
key-decisions:
  - "A changed declared marketplace source becomes a replacement add while the original source-mismatch fact remains available for failure reporting; the official built-in fallback is suppressed as already current."
  - "A re-add whose winning declaration is local rewrites that local entry; when base already declares the marketplace, its source bytes stay unchanged and only its plugin patch is extended."
  - "Import's synthetic marketplace failure child marks marketplaceSubject so JSON uses the bare marketplace name."
requirements-completed: [MIM-05, XPH-01]
coverage:
  - id: D1
    description: Apply reports rollback phase children for a partially rolled-back missing dependency and preserves move notices.
    requirement: MIM-05
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply shows the phase detail of a partially rolled back missing dependency"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts and apply-outcomes.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: Apply and load replace changed marketplace sources idempotently through marketplace add while preserving tagged add warnings.
    requirement: XPH-01
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature and features/marketplace/add.feature#four named source/warning/revision scenarios"
        status: pass
      - kind: unit
        ref: "direct coverage for apply, read-pass, add, update, install-flow, apply-outcomes, and types"
        status: pass
    human_judgment: false
  - id: D3
    description: Import rewrites a stale local-layer source in that layer and emits a bare marketplace failure id.
    requirement: XPH-01
    verification:
      - kind: e2e
        ref: "features/plugin/import.feature (30 scenarios, 360 steps)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/import/execute.test.ts#D-PL10-25 owner and race cases"
        status: pass
    human_judgment: false
duration: 30min
completed: 2026-10-27
status: complete
---

# Phase 10 Plan 04: Rollback Detail and Source Convergence Summary

**Apply now exposes missing-dependency rollback phases, converges changed marketplace sources through the locked add path, and import repairs the exact local layer that owns a stale source.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-28T00:18:12Z
- **Completed:** 2026-10-28T00:48:13Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Reused install's rollback-partial grammar for apply's missing-dependency failures, including redacted phase children, and retained move-time staging warnings and MCP notices.
- Converted declared source mismatches into replacement marketplace-add operations, treated the official fallback as current, and proved a second apply is empty.
- Preserved discovery versus hygiene warning tags across add, update, apply, and missing-dependency boundaries; a post-move read observes the revision that actually landed.
- Carried import config claim provenance through write-back so a stale local source is replaced in the local file without rewriting an existing base source.
- Marked import's synthetic marketplace failure row as a marketplace subject, producing a bare JSON id, and updated the shorthand citation to D-PL5-13.

## Task Commits

1. **Task 1: Show MISS-01 rollback children and preserve apply move notices** - `e261fc14`
2. **Task 2: Re-add changed marketplace sources and route add warnings** - `7a512c51`
3. **Task 3: Repair import re-add ownership and row identity** - `86ecfbf9`

## Verification

| Check | Result |
| --- | --- |
| Task 1 apply/apply-outcomes owner tests | Passed |
| Task 1 named apply scenarios | 2 scenarios passed |
| Task 2 apply/add owner tests | 376 tests passed |
| Task 2 named source, fallback, warning, and landed-revision scenarios | 4 scenarios, 57 steps passed |
| Task 2 direct coverage for all changed source/test pairs | 100% passed |
| Import executor owner suite | 106 tests passed through direct coverage |
| Complete import feature | 30 scenarios, 360 steps passed |
| Import execute/marketplaces direct coverage | 100% passed |
| TypeScript typecheck | Passed |
| Commit hooks (`npm run check:commit`) | Passed on all three task commits |

## Decisions Made

- The planner keeps its typed source-mismatch detail for error reporting while also planning a same-name replacement add. This lets apply report a failed replacement without bypassing marketplace add's validation, temporary clone, and locked commit.
- Tagged warnings stay structured until each command's existing staging-diagnostics renderer. Free-text warning parsing is not used to select the discovery or hygiene channel.
- Import records both the config alias and the winning layer. If a local declaration still exists at post-pass time, import patches that entry atomically. If it was removed between the read and post-pass locks, import does not recreate it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical carrier] Extended the shared warning carrier to every add-time consumer**

- **Found during:** Task 2
- **Issue:** The planned add warning could not retain its typed hygiene channel through `ScopeDependencyInstallResult`; update and apply consumed the same move result.
- **Fix:** Added optional staging diagnostics to the shared result and installed outcome, and routed them through add/update/apply's existing renderer.
- **Files modified:** `orchestrators/types.ts`, `plugin/install-flow.ts`, `reconcile/apply-outcomes.ts`, `marketplace/update.ts`, and their owner tests.
- **Verification:** Direct coverage passed for every added carrier branch; the add-warning and apply-move scenarios passed.
- **Committed in:** `7a512c51`

**2. [Rule 3 - Blocking coverage] Added owner cases for report-only mismatches and diagnostic projection**

- **Found during:** Task 2 direct coverage and commit hook
- **Issue:** The new read-pass report-only arm, installed staging verb, and non-empty scope diagnostic branch were not owned by their paired test modules.
- **Fix:** Added exact owner cases in `read-pass.test.ts`, `apply-outcomes.test.ts`, and `apply.test.ts`.
- **Verification:** The commit hook's direct-coverage gate passed.
- **Committed in:** `7a512c51`

**3. [Rule 2 - Concurrency correctness] Kept a removed local declaration removed**

- **Found during:** Task 3 direct coverage
- **Issue:** The source-owning local entry can be removed after import's read-pass lock releases and before its post-pass lock is acquired.
- **Fix:** Re-read the local config under the post-pass lock; patch the source only if the local entry still exists, otherwise keep the base ensure patch.
- **Verification:** The race owner case and direct coverage pass.
- **Committed in:** `86ecfbf9`

**Total deviations:** 3 auto-fixed (2 missing correctness/coverage, 1 concurrency correctness).
**Impact on plan:** The extra files and cases are the minimum shared-carrier and race coverage needed to make the planned behavior type-safe and retry-safe. No new command surface was added.

## Issues Encountered

- The commit hook exposed owner-pair coverage that broader scenario tests could not satisfy. Each uncovered branch received a direct owner case before its task commit.
- Import's existing lock-held scenario also used the duplicated marketplace id. It was updated to the same bare-id contract as the new failed re-add scenario.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

The apply/import source-convergence and MISS-01 barrier is complete. Phase 10's remaining plans can verify cross-orchestrator carriers against these typed outcomes; Phase 11 may consume the verified install-flow behavior after Phase 10's final phase gate.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The planned mitigations are present: source replacement uses marketplace add's existing containment, validation, temporary materialization, and locked state commit; layer writes remain atomic; rollback causes are redacted before projection.

## Self-Check: PASSED

- All 18 modified files exist.
- Commits `e261fc14`, `7a512c51`, and `86ecfbf9` are ancestors of `HEAD`.
- The named scenarios, owner suites, direct coverage pairs, and each task commit hook pass.

---

*Phase: 10-lifecycle-test-and-harness-gaps*
*Completed: 2026-10-27*

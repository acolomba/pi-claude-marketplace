---
phase: 03-production-defect-corrections
plan: "07"
subsystem: typed-failure-routing-and-cleanup-context
tags: [typescript, errors, update, uninstall, cleanup, node-test]

requires:
  - phase: 03-production-defect-corrections
    plan: "03"
    provides: Stable failure reason and cause-chain foundations
provides:
  - Message-independent typed reason routing for uninstall, update, and marketplace failures
  - Immutable structured cleanup-failure context that preserves the primary update error
  - Exact residual-path evidence for failed update staging cleanup
affects: [phase-03, uninstall, update, marketplace, diagnostics]

actuals:
  tokens: 31000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - User-facing reasons derive from error classes, discriminants, and stable errno codes
    - Secondary cleanup failures wrap but never replace the primary operational error
    - Cleanup descriptors remain frozen and structured until cause-chain rendering

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-07-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - tests/shared/errors.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/shared.test.ts

key-decisions:
  - "Treat diagnostic message text as display data only; known reason selection uses typed identity or stable errno codes."
  - "Keep the original operational Error as CleanupContextError.primary and Error.cause while exposing frozen cleanup descriptors separately."
  - "Represent only cleanup work that can actually fail: MCP prepare and abort are in-memory no-ops, while MCP commit failures remain typed phase failures."
  - "Expose cleanup descriptors on internal update outcomes so callers do not have to parse rendered notes."

patterns-established:
  - "Keyword-bearing unknown errors cannot impersonate known outcomes."
  - "Successful cleanup stays silent; failed cleanup reports lifecycle, artifact, exact internal path, and underlying Error."
  - "Rendered diagnostics reduce cleanup paths to basenames while structured internal context retains exact paths."

requirements-completed: [PDEF-05, PDEF-06]

coverage:
  - id: D1
    description: "StateLockHeldError selects lock-held output independently of message wording."
    requirement: PDEF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Update and marketplace known failures route by class, discriminant, or errno; unknown keyword messages use honest fallback reasons."
    requirement: PDEF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts and tests/orchestrators/marketplace/shared.test.ts"
        status: pass
      - kind: other
        ref: "direct coverage for plugin/update.ts and marketplace/shared.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Update cleanup failures retain immutable lifecycle, artifact, path, and cause descriptors without changing the primary reason."
    requirement: PDEF-06
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts and tests/orchestrators/plugin/update.test.ts"
        status: pass
      - kind: other
        ref: "direct coverage for shared/errors.ts and plugin/update.ts"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 07: Typed Failure Routing and Cleanup Context Summary

**Uninstall, update, and marketplace failures now classify known outcomes by typed identity, while failed update cleanup retains immutable structured context without replacing the primary failure.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-07T06:26:23-04:00
- **Completed:** 2026-09-07T07:00:00-04:00
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Made uninstall lock-contention output depend on `StateLockHeldError`, not its mutable display wording.
- Replaced update and marketplace keyword heuristics with error classes, discriminants, transport classifiers, and errno codes.
- Added regressions proving varied known-error messages retain their reason and keyword-bearing unknown errors cannot spoof known outcomes.
- Added frozen `CleanupFailure` descriptors and `CleanupContextError`, preserving the original error as both `primary` and `cause`.
- Captured previously discarded skill, command, and agent cleanup diagnostics during prepare, abort, and commit paths.
- Proved failed cleanup leaves the exact residual staging path while successful cleanup emits no descriptor.
- Kept user-facing paths basename-redacted while retaining exact internal paths for programmatic diagnostics.

## Task Commits

1. **Task 1 RED: Specify typed uninstall lock reason** - `a9ec0bbd` (test)
2. **Task 1 GREEN: Classify uninstall lock contention by type** - `2adc703d` (fix)
3. **Task 2 RED: Specify typed update failure routing** - `04bea104` (test)
4. **Task 2 GREEN: Route update failures by typed identity** - `71826cc6` (fix)
5. **Task 3 RED: Specify structured cleanup context** - `b8b91c3e` (test)
6. **Task 3 GREEN: Preserve structured update cleanup context** - `9fadc21c` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors.ts` - Defines typed concurrency and immutable cleanup-context errors and rendering.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - Narrows lock contention by `StateLockHeldError`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Routes typed failures and captures cleanup descriptors.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - Removes message-substring reason classification.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - Carries cleanup descriptors through failed update outcomes.
- `tests/shared/errors.test.ts` - Pins immutability, merging, bounded traversal, rendering, and path redaction.
- `tests/orchestrators/plugin/uninstall.test.ts` - Proves message-independent lock routing.
- `tests/orchestrators/plugin/update.test.ts` - Proves typed routing, primary-cause preservation, residual paths, and cleanup silence.
- `tests/orchestrators/marketplace/shared.test.ts` - Proves sibling typed routing and honest fallback behavior.

## Decisions Made

- Added `PluginUpdateConcurrencyError` because marketplace removal, plugin removal, and version drift are distinct stable outcomes that lacked a typed producer fact.
- Reused existing `MarketplaceNotFoundError`, `PluginShapeError`, `InvalidMarketplaceManifestError`, git transport classifiers, and errno codes instead of creating parallel reason taxonomies.
- Structured cleanup data is available on failed outcomes; rendered notes remain a presentation boundary and are never reparsed.
- MCP prepare and abort intentionally produce no cleanup descriptor because they mutate only in-memory state. MCP commit failures remain ordinary phase failures because no secondary cleanup operation occurs there.

## Deviations from Plan

### Public update outcome types also needed the structured context

- The plan named the shared error and update owners but did not list `orchestrators/types.ts`.
- That type surface had to expose `cleanupFailures` so the structured facts survive across the orchestrator boundary instead of existing only in rendered text.

### Cleanup descriptors model real cleanup operations, not synthetic ones

- The lifecycle union includes rollback for cleanup performed during bridge rollback paths.
- MCP prepare and abort are documented no-ops, and MCP commit has no secondary cleanup return, so the implementation does not invent empty or misleading MCP cleanup failures.

## Issues Encountered

- One fixture artifact named `rollback-server` previously looked like classification evidence; its expected result was corrected to prove keyword text cannot affect the typed outcome.
- Full-project Prettier inspection also sees the user's unrelated untracked `.mcp.json`. All nine plan-owned files pass focused Prettier checks, and that unrelated file was left untouched.
- Fallow's human formatter prints `✗ 0 above threshold` and duplicate findings while returning success; the gate exited zero with no dead-code or enforced-health issues.

## Verification

- All four focused owner suites passed together.
- Direct coverage passed at 100% lines, branches, and functions for `shared/errors.ts`, `plugin/uninstall.ts`, `plugin/update.ts`, and `marketplace/shared.ts`.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed for every plan-owned source and test file.
- `git diff --check` passed.
- `npm run fallow` passed dead-code, health, and duplicate gates with no new suppression.

## User Setup Required

None.

## Next Phase Readiness

- Typed reason routing and structured cleanup context are closed for the update owner.
- Plan 03-10 is next in Wave 3.

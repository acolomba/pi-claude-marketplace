---
phase: 09-reinstall-edge-bulk-ux
plan: 03
subsystem: edge-completions
tags: [reinstall, completions, force, tab-completion]

requires:
  - phase: 09-02
    provides: routed reinstall command and reinstall-specific --force handler
provides:
  - top-level reinstall command completion
  - installed-only reinstall plugin-ref completions
  - marketplace-wide reinstall target completions
  - reinstall-specific --force flag completion and positional skipping

affects: [reinstall-docs, phase-9-validation]

tech-stack:
  added: []
  patterns:
    - completion mode extension for installed-only lifecycle verbs
    - command-specific boolean flag skipping in positional extraction
    - plugin-ref completion config helper to bound dispatcher complexity

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - tests/edge/completions/provider.test.ts

key-decisions:
  - "Reinstall completions are installed-only like update and uninstall, not install-like absent-plugin suggestions."
  - "Only reinstall passes --force as a boolean flag to positional extraction so list filters and other command flags keep existing behavior."
  - "Reinstall allows marketplace-only @marketplace completions to match update's bulk target form."

patterns-established:
  - "Completion boolean flags are opt-in per command through extractPositionals(tokens, booleanFlags)."
  - "Lifecycle plugin-ref branches share a small mode/config helper to keep provider complexity under lint thresholds."

requirements-completed: [PRL-16]

duration: 20min
completed: 2026-05-14
---

# Phase 09 Plan 03 Summary

**Installed-only reinstall tab completion with marketplace targets, --force support, and failure-semantics coverage**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-14T09:55:00Z
- **Completed:** 2026-05-14T10:15:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `reinstall` to top-level `/claude:plugin` completions with trailing-space behavior.
- Extended completion data filtering so reinstall completes only installed plugin refs, matching update and uninstall semantics.
- Added reinstall marketplace-only `@marketplace` completion support for marketplace-wide reinstall targets.
- Added reinstall-specific `--force` flag completion and boolean-flag positional skipping so `reinstall --force <TAB>` still reaches installed refs.
- Hardened PRL-16 tests for trailing-space behavior, multi-marketplace half completions, per-marketplace manifest soft-fail, and state-error propagation.

## Task Commits

1. **Tasks 1-3: Reinstall completion mode, provider branches, and failure-semantics coverage** - `eb2f12a` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/completions/data.ts` - adds reinstall completion mode and opt-in boolean flag positional skipping.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - adds top-level reinstall, reinstall-only `--force`, marketplace-only target completions, and shared plugin-ref completion config.
- `tests/edge/completions/provider.test.ts` - adds PRL-16 coverage for reinstall command, refs, force flag, trailing spaces, soft-fail, and state-error propagation.

## Decisions Made

- Reinstall completion mode reuses the installed-only filter from update/uninstall because reinstall must never suggest absent plugins.
- `--force` is skipped only when the positional head is reinstall; arbitrary flags remain positional for existing command behavior unless explicitly opted in.
- A `pluginRefCompletionConfig` helper replaces repeated install/uninstall/update branches so adding reinstall does not push provider complexity over the lint limit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Refactored provider branch complexity for lint**

- **Found during:** Task 3 validation
- **Issue:** Adding a fourth lifecycle branch raised `getArgumentCompletions` cognitive complexity above the lint threshold.
- **Fix:** Extracted lifecycle plugin-ref mode/marketplace-only selection into `pluginRefCompletionConfig`.
- **Files modified:** `extensions/pi-claude-marketplace/edge/completions/provider.ts`
- **Verification:** `npm run lint -- --quiet`, focused completion tests, and pre-commit passed.
- **Committed in:** `eb2f12a`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The refactor preserved planned behavior while keeping the provider within existing lint constraints.

## Issues Encountered

- Prettier reformatted long test assertions during pre-commit; no behavior changes were required.
- An unrelated pre-existing `.planning/config.json` newline issue appeared in an initial pre-commit format check and was restored to its prior state before the Plan 09-03 commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-04 can document reinstall syntax and semantics, add README contract coverage, and run full Phase 9 validation.

## Validation

- `node --test tests/edge/completions/provider.test.ts` passed.
- `npm run typecheck` passed.
- `npm run lint -- --quiet` passed.
- `pre-commit run --files extensions/pi-claude-marketplace/edge/completions/data.ts extensions/pi-claude-marketplace/edge/completions/provider.ts tests/edge/completions/provider.test.ts` passed.

## Self-Check: PASSED

- Key modified files exist on disk.
- `git log --oneline --all --grep="09-03"` returns commit `eb2f12a`.
- Required PRL-16 test names and assertions are present.

---

_Phase: 09-reinstall-edge-bulk-ux_
_Completed: 2026-05-14_

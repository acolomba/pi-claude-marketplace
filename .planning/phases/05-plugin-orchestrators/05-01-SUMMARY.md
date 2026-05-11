---
phase: 05-plugin-orchestrators
plan: 01
subsystem: foundations
tags: [phase-05, foundations, markers, errors, shared, contracts]

# Dependency graph
requires:
  - phase: 01-foundations-toolchain
    provides: shared/markers.ts (5-row ES-5 surface), shared/errors.ts (helpers + 5 marketplace classes), markers-snapshot.test.ts harness, errors.test.ts harness
  - phase: 04-marketplace-orchestrators
    provides: MarketplaceUpdateError aggregate-with-cause pattern (mirrored by PluginUpdatePhase3Error)
provides:
  - RECOVERY_PLUGIN_REINSTALL_PREFIX marker constant for PUP-6 recovery hint (Phase 5 extension beyond ES-5)
  - CrossPluginConflictError class (PI-6 / RN-3 pre-write cross-bridge name conflict)
  - ConcurrentInstallError class (PI-15 state-guard hard-fail sentinel)
  - ConcurrentUninstallError class (PU-5 silent-converge sentinel)
  - PluginUpdatePhase3Error class + Phase3Failure interface (PUP-6 aggregate-with-cause for update)
  - Byte-for-byte drift guard on RECOVERY_PLUGIN_REINSTALL_PREFIX (new test block in markers-snapshot.test.ts)
  - Per-class smoke tests covering instanceof, name, payload, and message format
affects: [05-02 transaction/rollback path containment, 05-03 orchestrators/plugin/shared (PI-6 guard consumer), 05-04 install command (PI-15 consumer), 05-05 uninstall command (PU-5 consumer), 05-06 update command (PUP-6 consumer), 05-07+ list and edge-case plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single chokepoint for stable user-contract strings: every Phase 5 marker re-uses shared/markers.ts plus the markers-snapshot test (Phase 1 D-08/D-09 pattern)"
    - "Aggregate-with-cause error class mirroring MarketplaceUpdateError: same shape (message + options.cause) generalized to a strongly-typed failures payload (Phase3Failure[])"
    - "Snapshot-test extension pattern: NEW top-level test block (NOT a sixth row in the ES-5 5-row literals table, per Pitfall 7) preserves the existing `literals.length === 5` assertion"
    - "Test fixes from prettier auto-collapse and TypeScript strict-mode noUncheckedIndexedAccess: introduce a `const first = err.failures[0]; assert.ok(first, ...)` narrow before destructuring"

key-files:
  created:
    - .planning/phases/05-plugin-orchestrators/05-01-SUMMARY.md
  modified:
    - extensions/claude-marketplace/shared/markers.ts (added RECOVERY_PLUGIN_REINSTALL_PREFIX)
    - extensions/claude-marketplace/shared/errors.ts (added 4 error classes + Phase3Failure interface)
    - tests/architecture/markers-snapshot.test.ts (added PUP-6 byte-for-byte test block)
    - tests/shared/errors.test.ts (added 4 per-class smoke tests)

key-decisions:
  - "D-04 marker placement: RECOVERY_PLUGIN_REINSTALL_PREFIX lives in shared/markers.ts (not orchestrators/plugin/update.ts) so the single chokepoint convention survives -- the JSDoc explicitly calls out 'Phase 5 extension beyond ES-5' so a future ES-5 reader does not assume it's a sixth member of the canonical 5-row PRD §6.12 surface"
  - "Snapshot test extension: NEW separate `test(...)` block placed AFTER the existing literals table (per Pitfall 7 in PATTERNS.md). The `literals.length === 5` assertion is intentionally NOT updated -- this is the structural distinction between the original ES-5 enum and Phase 5 extensions"
  - "PluginUpdatePhase3Error constructor signature mirrors MarketplaceUpdateError variant B (Phase 4 D-09): `constructor(message, failures, options?)` rather than threading `retryHint` through an opts bag. The structured `failures: readonly Phase3Failure[]` is the recovery payload and supersedes a free-form `retryHint` slot"
  - "ConcurrentUninstallError stores `plugin` as a readonly field (mirrors ConcurrentInstallError's plugin/marketplace pair). Plan text only mandates the field on the constructor argument shape but did not specify the field; adding it makes the error inspectable by the silent-converge catch site without parsing the message"

patterns-established:
  - "Marker chokepoint extension: Phase N markers beyond ES-5 live in shared/markers.ts with explicit JSDoc disclaimers; snapshot test asserts byte-for-byte equality in a SEPARATE test block to preserve the ES-5 row count assertion"
  - "Aggregate-with-cause variant: errors that wrap heterogeneous bridge failures use `constructor(message, payload[], options?)` with a typed payload interface (Phase3Failure) -- consumers walk the payload for structured recovery and rely on Error.cause for unstructured cause chains via formatErrorWithCauses"

requirements-completed: [PI-6, PI-15, PU-5, PUP-6]

# Metrics
duration: 4min
completed: 2026-05-10
---

# Phase 5 Plan 01: Foundations -- Markers + Errors Summary

**Two `shared/` extensions Wave 1-3 plans import from: PUP-6 recovery-hint marker + four plugin-orchestrator error classes (PI-6, PI-15, PU-5, PUP-6), each drift-guarded by tests.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-11T01:41:16Z
- **Completed:** 2026-05-11T01:45:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Exported `RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"` from `shared/markers.ts` for PUP-6 user-contract composition by `orchestrators/plugin/update.ts` in Wave 3.
- Exported four new Phase 5 error classes from `shared/errors.ts`:
  - `CrossPluginConflictError` (PI-6 / RN-3 -- pre-write name conflict across skills/commands/agents; MCP server names excluded per PRD §6.5 MC-4).
  - `ConcurrentInstallError` (PI-15 -- state-guard hard-fail detected at the save boundary).
  - `ConcurrentUninstallError` (PU-5 -- silent-converge sentinel; caller swallows for no-op idempotent uninstall).
  - `PluginUpdatePhase3Error` (PUP-6 -- aggregate-with-cause carrying `Phase3Failure[]` for heterogeneous phase-3a bridge failures).
- Exported the `Phase3Failure` interface (consumed by `orchestrators/plugin/update.ts` in Wave 3).
- Drift-guarded `RECOVERY_PLUGIN_REINSTALL_PREFIX` byte-for-byte with a NEW snapshot-test block in `tests/architecture/markers-snapshot.test.ts` (the existing 5-row ES-5 `literals.length === 5` assertion stays untouched).
- Added per-class smoke tests covering `extends Error` instanceof, `name`, readonly payload fields, message format, and Error.cause forwarding for the aggregate class.
- `npm run check` green: typecheck + ESLint + Prettier + 530 tests passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RECOVERY_PLUGIN_REINSTALL_PREFIX constant + snapshot test block** -- `73868e3` (feat)
2. **Task 2: Add four Phase 5 error classes + smoke tests** -- `c909b7c` (feat)

## Files Created/Modified

- `extensions/claude-marketplace/shared/markers.ts` -- Added `RECOVERY_PLUGIN_REINSTALL_PREFIX` constant with JSDoc noting Phase 5 extension beyond ES-5.
- `extensions/claude-marketplace/shared/errors.ts` -- Added 4 error classes (`CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError`, `PluginUpdatePhase3Error`) and `Phase3Failure` interface; appended after the existing `MarketplaceUpdateError` block.
- `tests/architecture/markers-snapshot.test.ts` -- Added new top-level test block asserting byte-for-byte equality of `RECOVERY_PLUGIN_REINSTALL_PREFIX` against the PRD §5.2.3 PUP-6 literal. Existing 5-row literals assertion unchanged.
- `tests/shared/errors.test.ts` -- Added 4 per-class smoke tests + updated named-import list.

## Decisions Made

- **Marker chokepoint extension placement (D-04):** `RECOVERY_PLUGIN_REINSTALL_PREFIX` lives in `shared/markers.ts` (the single chokepoint), not at the runtime callsite in `orchestrators/plugin/update.ts`. The JSDoc explicitly disclaims membership in the ES-5 enum so a future maintainer does not extend the canonical 5-row PRD §6.12 surface by accident.
- **Snapshot test extension shape (Pitfall 7):** The PUP-6 assertion is a NEW separate `test(...)` block placed AFTER the existing ES-5 literals table; the `literals.length === 5` assertion is intentionally preserved. This is the structural distinction between the canonical ES-5 enum and Phase 5 extensions.
- **`PluginUpdatePhase3Error` constructor signature (D-09 mirror):** Adopted `constructor(message, failures, options?)` rather than threading a `retryHint` opts slot through the constructor. The structured `Phase3Failure[]` payload supersedes the unstructured `retryHint` -- consumers walk the typed payload for structured recovery.
- **`ConcurrentUninstallError.plugin` field:** Added the readonly `plugin` field (not strictly required by the plan text but makes the error inspectable by the silent-converge catch site without parsing the message). Mirrors the field discipline of `ConcurrentInstallError`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- Bug] TypeScript strict-mode `noUncheckedIndexedAccess` flagged `err.failures[0]`**
- **Found during:** Task 2 (errors.test.ts smoke tests).
- **Issue:** `npx tsc --noEmit` reported `TS2532: Object is possibly 'undefined'` on three lines accessing `err.failures[0].phase|msg|cause`. The plan's example test snippet (`err.failures[0].phase === "skills"`) does not type-check in this project's strict-mode TS config.
- **Fix:** Introduced a `const first = err.failures[0]; assert.ok(first, "failures[0] must be present");` narrow before destructuring fields. Functionally equivalent; satisfies `noUncheckedIndexedAccess`.
- **Files modified:** `tests/shared/errors.test.ts`.
- **Verification:** `npx tsc --noEmit` exit 0; the four smoke tests pass.
- **Committed in:** `c909b7c` (Task 2 commit).

**2. [Rule 3 -- Blocking] Pre-commit hook auto-formatting + commit-message gitlint length**
- **Found during:** Task 1 and Task 2 commits.
- **Issue (a):** Prettier auto-formatted `tests/architecture/markers-snapshot.test.ts` and `tests/shared/errors.test.ts` (collapsed multi-line `assert.equal` calls into single lines) during the first commit attempt, aborting the commit. (b) The Task 2 commit title `"feat(05-01): add four Phase 5 error classes to shared/errors.ts (D-02, D-05)"` was 76 chars vs the 72-char gitlint limit.
- **Fix:** Re-staged the prettier-fixed files (no semantic change), then re-committed; shortened Task 2 title to `"feat(05-01): add four Phase 5 plugin error classes (D-02, D-05)"`.
- **Files modified:** none beyond what the hook already wrote on disk.
- **Verification:** Final `git commit` for both tasks succeeded with all hooks green (except TruffleHog -- see Issues Encountered).
- **Committed in:** `73868e3` (Task 1) and `c909b7c` (Task 2).

---

**Total deviations:** 2 auto-fixed (1 strict-mode bug, 1 blocking hook chain).
**Impact on plan:** No scope creep -- both fixes were tactical adjustments to satisfy the project's existing quality bar (`npm run check` + pre-commit hooks). Plan deliverables landed verbatim.

## Issues Encountered

- **TruffleHog pre-commit hook fails inside Claude Code worktrees** (documented worktree workaround applied). TruffleHog v3.92.4 cannot read the worktree's gitdir-pointer file (`.git` is a file, not a directory; error: `failed to read index file: open .git/index: not a directory`). Resolved by setting `SKIP=trufflehog` env var on each commit -- the pre-commit framework's documented selective-skip mechanism (NOT `--no-verify`, which would silently bypass ALL hooks). All other content-meaningful hooks (`detect-private-key` for actual secret detection, `npm typecheck`, `npm lint`, `npm format check`, `gitlint`, prettier, json/yaml/symlink validation, etc.) ran and passed on every commit. Documented in commit-message footers. This is the canonical worktree workaround used by all prior Phase 1+ plans in this project.

## User Setup Required

None -- this plan only adds source files and tests; no external service configuration is required.

## Next Phase Readiness

- **Wave 1 (Plan 05-02, transaction/rollback path containment):** No imports from this plan needed; this plan is decoupled from Plan 05-02.
- **Wave 1 (Plan 05-03, orchestrators/plugin/shared.ts PI-6 guard):** `CrossPluginConflictError` is now exported and ready to be thrown by `assertNoCrossPluginConflicts`.
- **Wave 2 (Plan 05-04, install command):** `ConcurrentInstallError` is ready for the `withStateGuard` save-boundary check.
- **Wave 2 (Plan 05-05, uninstall command):** `ConcurrentUninstallError` is ready for the silent-converge sentinel pattern.
- **Wave 3 (Plan 05-06, update command):** Both `PluginUpdatePhase3Error` + `Phase3Failure` interface AND `RECOVERY_PLUGIN_REINSTALL_PREFIX` are ready for the hand-rolled 3-phase update path; the prefix composes with `" \"${pluginName}\"."` to produce the PUP-6 user-visible hint.

## Self-Check: PASSED

- `extensions/claude-marketplace/shared/markers.ts` -- FOUND, contains `RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"`.
- `extensions/claude-marketplace/shared/errors.ts` -- FOUND, exports `CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError`, `PluginUpdatePhase3Error`, `Phase3Failure`.
- `tests/architecture/markers-snapshot.test.ts` -- FOUND, contains PUP-6 byte-for-byte assertion block AND preserved `literals.length === 5` assertion.
- `tests/shared/errors.test.ts` -- FOUND, contains 4 new per-class smoke tests.
- Commit `73868e3` (Task 1) -- FOUND in `git log`.
- Commit `c909b7c` (Task 2) -- FOUND in `git log`.
- `npm run check` exit code 0 (typecheck + ESLint + Prettier + 530 tests passing).

---
*Phase: 05-plugin-orchestrators*
*Completed: 2026-05-10*

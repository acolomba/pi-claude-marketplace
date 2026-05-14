---
phase: 09-reinstall-edge-bulk-ux
plan: 02
subsystem: edge
tags: [reinstall, router, handler, force, scope]

requires:
  - phase: 09-01
    provides: bulk reinstall orchestrator and quiet single-plugin rendering
provides:
  - /claude:plugin reinstall top-level routing
  - reinstall edge handler for bare, marketplace, and plugin targets
  - reinstall-specific --force parsing and registration wiring

affects: [reinstall-completions, reinstall-docs]

tech-stack:
  added: []
  patterns:
    - thin edge handler over orchestrator target union
    - command-specific flag parsing outside shared lifecycle parser
    - route/register tests with hermetic HOME/cwd

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/edge/router.test.ts
    - tests/edge/register.test.ts

key-decisions:
  - "Reinstall parses --force in its own handler so install/update/uninstall semantics remain unchanged."
  - "Invalid reinstall flags and extra positionals stop in the edge handler with reinstall-specific usage."
  - "Router and registration expose reinstall now; top-level completion labels remain owned by Plan 09-03."

patterns-established:
  - "Reinstall handler target parsing mirrors update target forms while adding a local force flag pass-through."
  - "Registration smoke for a routed command can assert behavior through a fresh hermetic empty state."

requirements-completed: [PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15]

duration: 35min
completed: 2026-05-14
---

# Phase 09 Plan 02 Summary

**Reinstall command edge handler, router dispatch, registration, and force/scope parsing**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-14T03:10:00Z
- **Completed:** 2026-05-14T03:45:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `makeReinstallHandler` for `/claude:plugin reinstall` with bare, `@marketplace`, and `plugin@marketplace` target parsing.
- Accepted `--scope user|project` at any position through the existing parser and passed it to `reinstallPlugins`.
- Added reinstall-specific `--force` support without changing install/update/uninstall parsing.
- Rejected unknown flags, `--force=true`, invalid refs, and extra positionals with reinstall usage output.
- Wired `reinstall` into top-level router usage and dispatch.
- Registered the reinstall handler in `/claude:plugin` command wiring and updated the command description.
- Added handler, router, and registration tests for the new command path.

## Task Commits

Plan executed inline as one implementation slice; commit hash recorded by git history for `feat(09-02): wire reinstall edge command`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` - new thin handler over `reinstallPlugins` with reinstall-specific `--force` parsing.
- `tests/edge/handlers/plugin/reinstall.test.ts` - target-form, `--scope`, `--force`, and invalid-argument coverage.
- `extensions/pi-claude-marketplace/edge/router.ts` - added reinstall handler interface, usage line, and dispatch branch.
- `tests/edge/router.test.ts` - added reinstall dispatch and usage assertions.
- `extensions/pi-claude-marketplace/edge/register.ts` - imported and wired `makeReinstallHandler`; updated command description.
- `tests/edge/register.test.ts` - added description and registered-command routing coverage.

## Decisions Made

- `--force` is parsed by the reinstall handler from positional tokens returned by `parseArgs`; this keeps the shared parser and other lifecycle commands unchanged.
- Bulk reinstall failures surfaced through `reinstallPlugins` remain part of deterministic batch output, so a single-plugin foreign-content default attempt reports a `Failed:` partition rather than a separate handler error.
- Plan 09-03 still owns adding `reinstall` to completion labels and installed-only completion behavior.

## Deviations from Plan

- The `--force` handler test asserts the default foreign-content path through the batch `Failed:` partition rather than an error-severity notification, matching the Plan 09-01 bulk renderer semantics.

## Issues Encountered

- ESLint import ordering required the local `Scope` type import to appear before the external Pi API type import in the new handler test.

## User Setup Required

None.

## Next Phase Readiness

- Plan 09-03 can add reinstall completions on top of the routed command.
- Plan 09-04 can document the command syntax and run final validation/traceability.

## Validation

- `node --test tests/edge/handlers/plugin/reinstall.test.ts tests/edge/router.test.ts tests/edge/register.test.ts` passed.
- `npm run typecheck` passed.
- `npm run lint -- --quiet` passed.
- LSP diagnostics for modified TypeScript sources reported no diagnostics.

## Self-Check: PASSED

- New handler file exists and exports `makeReinstallHandler`.
- Router usage includes reinstall and `--force`.
- Register wiring includes `reinstall: makeReinstallHandler(pi)`.
- Tests cover bare, marketplace, plugin, scope, force, invalid argument, router, and registration paths.

---

_Phase: 09-reinstall-edge-bulk-ux_
_Completed: 2026-05-14_

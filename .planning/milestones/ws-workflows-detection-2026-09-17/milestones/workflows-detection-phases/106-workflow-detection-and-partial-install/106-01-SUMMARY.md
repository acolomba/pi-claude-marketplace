---
phase: 106-workflow-detection-and-partial-install
plan: 01
subsystem: resolver
tags: [typescript, workflows, partial-install, compatibility, node-test]

requires:
  - phase: 105
    provides: Existing partial-install gates, ledgers, and notification grammar
provides:
  - Conventional workflows directory detection as one unsupported component kind
  - A dedicated workflows reason across resolver and notification contracts
  - End-to-end install coverage for partial consent and structural precedence
affects: [106-02, 106-03, 106-04, resolver, notifications, partial-install]

actuals:
  tokens: 4234
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - Fixed-literal unsupported directory detection
    - Shared typed-kind reason narrowing

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts

key-decisions:
  - "Detect only the fixed workflows directory. Do not inspect its content or use a manifest path."
  - "Keep the normal rejection aligned with existing unsupported components, including its early no-version row."
  - "Preserve structural failure precedence when partial consent is present."

patterns-established:
  - "Unsupported convention: add the typed kind, fixed stat rule, shared reason, and closed-set locks together."
  - "Non-materialization proof: keep a source sentinel and search every target below the scope root."

requirements-completed: [WDET-02, WDET-03, WDET-04, WDET-05, WDET-06]

coverage:
  - id: D1
    description: A conventional workflows directory is detected without a manifest declaration.
    requirement: WDET-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 conventional workflow directory tracer"
        status: pass
    human_judgment: false
  - id: D2
    description: The resolver returns one workflows unsupported kind for a sound plugin.
    requirement: WDET-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 conventional workflow directory tracer"
        status: pass
    human_judgment: false
  - id: D3
    description: The shared notification path renders the dedicated workflows reason.
    requirement: WDET-04
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08 reason set"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 conventional workflow directory tracer"
        status: pass
    human_judgment: false
  - id: D4
    description: Normal install rejects, while partial install stages supported content only.
    requirement: WDET-05
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 conventional workflow directory tracer"
        status: pass
    human_judgment: false
  - id: D5
    description: No workflow content enters state resources, target files, or an execution path.
    requirement: WDET-06
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 conventional workflow directory tracer"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#D-106-06 structural precedence"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-29
status: complete
---

# Phase 106 Plan 01: Workflow Detection Tracer Summary

**Fixed-directory workflow detection now reaches partial install without materializing or executing workflow files.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-29T18:38:53Z
- **Completed:** 2026-08-29T19:13:13Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added `workflows` to the resolver's unsupported-kind tail with one fixed directory convention.
- Mapped the typed kind to one closed notification reason and increased the reason lock from 39 to 40.
- Proved normal rejection, partial installation, resource compatibility, sentinel containment, and structural precedence through the public install path.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add the failing workflow install tracer** - `a651f3a6` (test)
2. **Task 1 GREEN: Detect unsupported workflow directories** - `b0e4bef6` (feat)
3. **Task 2: Preserve workflow structural precedence** - `c53de414` (test)
4. **Rule 3 follow-up: Extend the inherited compatibility lock** - `4192327b` (test)

The TDD tracer has separate RED and GREEN commits.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/resolver.ts` - Adds the unsupported kind and fixed directory stat rule.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` - Maps the typed kind to the workflows reason.
- `extensions/pi-claude-marketplace/shared/notify.ts` - Appends the workflows reason to the 40-member tuple.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - Adds workflows to the unsupported topic coverage proof.
- `tests/orchestrators/plugin/install.test.ts` - Seeds workflow fixtures and proves install behavior and containment.
- `tests/architecture/notify-closed-set-locks.test.ts` - Pins the deliberate reason-count increase.
- `tests/architecture/compat-01-no-expansion.test.ts` - Appends workflows to the inherited reason enumeration.
- `.planning/WINDOWS.md` - Records the compatibility-lock deviation as fixed.

## Decisions Made

- The resolver stats only `<pluginRoot>/workflows` as a directory. It does not read workflow files or accept a declared workflow path.
- The normal rejection keeps the existing unsupported-component timing. Its row omits the version because version resolution occurs after this gate.
- A malformed structural field remains unavailable even when a workflows directory and partial consent are both present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking contract] Updated the inherited compatibility lock**

- **Found during:** Overall verification after Task 2
- **Issue:** The full unit suite still pinned the 39-member `REASONS` enumeration.
- **Fix:** Appended `workflows` to the inherited enumeration without changing any other member.
- **Files modified:** `tests/architecture/compat-01-no-expansion.test.ts`
- **Verification:** The focused compatibility test and the complete unit suite pass.
- **Committed in:** `4192327b`

---

**Total deviations:** 1 auto-fixed Rule 3 issue.
**Impact on plan:** The change completes the same closed-set contract. It adds no runtime scope.

## Issues Encountered

- The patch helper initially resolved a relative path against the main checkout. The exact patch was reversed before work continued. All committed changes are in the required worktree, and the main checkout is clean.
- Restricted test execution blocked local socket and network fixtures. The same complete unit suite passed with the required local fixture access.

## Validation Results

- Focused workflow and reason-lock tests: pass.
- TypeScript typecheck: pass.
- Complete unit suite: 3,635 pass, 0 fail, 1 intentional platform skip.
- Integration suite: 10 pass, 0 fail.
- Per-commit TruffleHog filesystem scans: 0 verified and 0 unverified secrets.
- Per-commit pre-commit hooks: pass with only TruffleHog skipped after each filesystem scan.
- Stub scan: no new stub, placeholder, skipped test, or unrun verification.
- Threat scan: no new endpoint, authentication path, schema boundary, bridge, ledger, or executor.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plans 106-02 through 106-04 can reuse the typed workflow kind and shared reason.
- No blocker remains from this plan.

## Self-Check: PASSED

- The summary file exists in the Phase 106 directory.
- All four implementation and test commits exist in git history.
- Every key file listed in this summary exists.

---

*Phase: 106-workflow-detection-and-partial-install*
*Completed: 2026-08-29*

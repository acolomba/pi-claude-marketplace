---
phase: 10-lifecycle-test-and-harness-gaps
plan: "02"
subsystem: testing
tags: [cucumber, pty, tui, autoupdate, completion]
requires:
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "01"
    provides: fail-closed lifecycle harness ownership
provides:
  - Python-standard-library PTY bridge and bounded production TUI driver
  - TUI background-update, notice-deduplication, bounded-abort, and RPC-negative scenarios
  - Complete-set completion capture with uncompared-result cleanup enforcement
affects: [phase-10-lifecycle-tests, plugin-lifecycle-verification]
actuals:
  tokens: 11896
  tasks: 3
  commits: 3
plan_head_before: b84a4bcc5f19ace9dec10eae167258b4ecf94218
plan_head_after: fa1c60b0
tech-stack:
  added: []
  patterns:
    - checked-in Python standard-library PTY bridge
    - event-driven terminal readiness, quiet, request, and shutdown waits
    - World-owned complete completion and TUI notice sets
key-files:
  created:
    - features/lib/pi-tui-pty.py
    - features/lib/pi-tui.ts
    - features/lib/plugin-completions.ts
    - features/step_definitions/completion.steps.ts
  modified:
    - features/marketplace/background-update.feature
    - features/marketplace/market-alias.feature
    - features/plugin/list.feature
    - features/support/world.ts
    - test/e2e/_rpc.ts
key-decisions:
  - "Select Pi's interactive TUI through a real PTY and the CLI default because the installed runtime rejects the nonexistent literal --mode tui value."
  - "Use the existing D-PL8-09 zero-delay setting for deterministic background acceptance coverage; add no production test hook or dependency."
  - "Treat the background gate's 30-second wait cap as a ceiling because the hosted-manifest adapter aborts its held request at its own 10-second deadline first."
requirements-completed: [TST-01, TST-02, XPH-01]
duration: 2h 35min
completed: 2026-10-27
status: complete
---

# Phase 10 Plan 02: PTY TUI and Completion Harnesses Summary

**A real pseudoterminal now drives Pi's production TUI under the Cucumber sandbox, while complete TUI notices and registered-provider completion sets fail closed when no step compares them.**

## Performance

- **Duration:** 2h 35 min
- **Completed:** 2026-10-27
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added a fixed Python `pty.openpty` bridge using `select`, `os.read`, and `os.write`, with the TypeScript owner enforcing the existing RPC realpath sandbox, allowlisted environment, event-driven readiness, and process-group cleanup.
- Proved TUI-only background refresh and plugin update, first-seen bare-name notice deduplication with both install rows retained, bounded foreground recovery from a held loopback request, and the existing RPC negative control.
- Captured complete completion sets from the command provider, proved `market` and `marketplace` expose the same labels and descriptions, and proved partial update completion follows list's installed git-version rule.
- Added World cleanup checks for uncompared TUI notice sets and completion results.

## Task Commits

1. **Task 1: Smoke one contained TUI session** - `3e355406`
2. **Task 2: Prove background autoupdate through TUI** - `3428f338`
3. **Task 3: Capture and compare completions** - `fa1c60b0`

## Verification

| Check | Result |
| --- | --- |
| `python3 -c 'import os,pty; ... assert os.isatty(slave)'` | Passed |
| `node --test test/e2e/adapter-detection-rpc.test.ts` | 7/7 passed; the plan's `_rpc.test.ts` path does not exist |
| PTY readiness scenario | 1 scenario, 4 steps passed |
| `node --test test/architecture/https-git-host-server.test.ts` | 8/8 passed |
| `npx cucumber-js features/marketplace/background-update.feature` | 5 scenarios, 64 steps passed |
| `npm run check:features` | Passed |
| Focused completion scenarios | 2 scenarios, 18 steps passed |
| Commit hooks | `npm run check:commit` passed for all three task commits |

## Decisions Made

- Reused only RPC containment and process lifecycle. Terminal control removal, input, readiness, quiet detection, and notice capture remain TUI-specific.
- Readiness requires the completed hermetic startup screen, not merely the first terminal bytes. This prevents CLI errors and the interim "Startup is still in progress" screen from producing false positives.
- The completion adapter invokes the same provider target, cwd resolver, and lifecycle cache shape used by the registered command. It does not parse logs or read completion-cache files.
- `update --partial` is the discriminating completion mode: ordinary update intentionally offers the whole installed inventory, while partial update admits only records list classifies as upgradable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rejected false TUI readiness**

- **Found during:** Task 2 positive scenario
- **Issue:** The initial smoke accepted Pi's `Invalid mode "tui"` error as rendered output. The installed Pi CLI exposes explicit `text`, `json`, and `rpc` values; its interactive TUI is the PTY-selected default.
- **Fix:** Omit the invalid mode pair for the TUI child and require the completed offline startup screen before input.
- **Files modified:** `test/e2e/_rpc.ts`, `features/lib/pi-tui.ts`
- **Commit:** `3428f338`

**2. [Rule 3 - Blocking] Allowed the fixed Python bridge in the feature layout gate**

- **Found during:** Task 1 feature verification
- **Issue:** `check:features` rejected every non-TypeScript file under `features/lib`, including the plan's required checked-in bridge.
- **Fix:** Allow exactly `features/lib/pi-tui-pty.py` and document that single exception in the Cucumber layout rule.
- **Files modified:** `scripts/check-features.mjs`, `.agents/skills/cucumber/rules/layout.md`
- **Commit:** `3e355406`

**3. [Rule 2 - Missing critical functionality] Added an abortable loopback hold arm**

- **Found during:** Task 2 bounded-abort scenario
- **Issue:** The existing git host could fail immediately but could not keep a request in flight for background/foreground lifecycle proof.
- **Fix:** Add a `hold` arm plus event-driven request-arrival and request-settlement waits, with an owner test.
- **Files modified:** `features/lib/https-git-host/server.ts`, `features/step_definitions/git-host.steps.ts`, `test/architecture/https-git-host-server.test.ts`
- **Commit:** `3428f338`

## Issues Encountered

- A held git transport request ended at its five-second transport deadline, and a hosted-manifest request ended at its ten-second adapter deadline. The acceptance case therefore proves foreground work resumes and the request is dropped within the background gate's recorded 30-second ceiling; unit coverage continues to pin the exact gate-cap abort path.
- The plan named `test/e2e/_rpc.test.ts`, which does not exist. The existing RPC owner suite is `test/e2e/adapter-detection-rpc.test.ts` and passed.
- The plan's lowercase scenario-name examples conflict with the repository rule requiring sentence-case titles. Verification used the compliant exact titles.

## Known Stubs

None.

## User Setup Required

None. Python standard-library `pty` is the only host prerequisite, and the fail-early probe passed.

## Next Phase Readiness

The PTY/background and completion harness gaps are closed. Phase 10 can proceed to the CAS-08 install-flow scenario barrier in Plan 10-03.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The planned mitigations are present: the bridge receives an argument array without shell interpolation; sandbox locations resolve under the OS temporary root and outside the repository; the child environment is allowlisted; network fixtures bind loopback; all waits are bounded and event-driven; and release kills the detached process group.

## Self-Check: PASSED

- All four created files exist.
- Commits `3e355406`, `3428f338`, and `fa1c60b0` are ancestors of `HEAD`.
- No generated `features/lib/__pycache__/` directory is present.

---

*Phase: 10-lifecycle-test-and-harness-gaps*
*Completed: 2026-10-27*

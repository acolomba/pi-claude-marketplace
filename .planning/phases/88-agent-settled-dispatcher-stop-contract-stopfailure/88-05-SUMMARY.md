---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
plan: 05
subsystem: testing
tags: [live-uat, pi-runtime, hooks-bridge, agent_settled, stop-contract, canary]

# Dependency graph
requires:
  - phase: 88-04
    provides: settle.ts dispatcher, Stop decision arms, 8-block override cap, StopFailure arm
provides:
  - Live-runtime UAT harness (tests/live-uat/stop-canary.mjs) proving agent_settled dispatch (STOP-01) and block re-entry (STOP-03) on real Pi
  - Human-verification checklist (tests/live-uat/README.md) routing the four D-88-03b runtime questions to human_needed
affects: [phase-89-docs-reconcile, stop-contract-verification, milestone-close-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone live-runtime UAT driver (.mjs) that installs a fixture plugin via the real /claude:plugin machinery, drives a real pi -p --mode json turn, and asserts on the JSON event stream + a hook marker file"
    - "Honesty contract: a live harness exits non-zero routing human_needed rather than reporting an observable it could not sustain (no false pass)"

key-files:
  created:
    - tests/live-uat/stop-canary.mjs
    - tests/live-uat/README.md
  modified:
    - eslint.config.js
    - tests/bridges/hooks/payloads/stop-failure.test.ts

key-decisions:
  - "Drive pi via spawn with stdin ignore (not execFile): an open stdin pipe makes non-interactive pi wait for input after the re-entry turn instead of hitting EOF and exiting"
  - "Assert re-entry structurally via two turn_start events in the --mode json stream (the documented extra-turn-boundary divergence), not by text scrape"
  - "The 8-block cap loop is not autonomously driveable (no PTY tooling; pi -p/stdin tear down after the first re-entry turn) -- route it to human_needed, item 4 of the checklist"

patterns-established:
  - "Pattern: sandbox containment (T-88-08) -- the harness refuses any PI_CODING_AGENT_DIR outside tmp/pi-uat and always uninstalls the canary in a finally block"

requirements-completed: [STOP-01, STOP-07]

coverage:
  - id: D1
    description: "agent_settled fires once and dispatches the Stop bucket end-to-end on real Pi (stopReason stop) -- STOP-01"
    requirement: STOP-01
    verification:
      - kind: e2e
        ref: "PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs (PASS STOP-01 line)"
        status: pass
    human_judgment: true
    rationale: "Live-runtime observation against a real pi 0.80.10; the harness exits non-zero overall (cap routed to human), so a human confirms the STOP-01 PASS line rather than an exit-0 auto-pass."
  - id: D2
    description: "A decision:block Stop hook re-enters the idle agent loop, starting a new turn (STOP-03)"
    requirement: STOP-01
    verification:
      - kind: e2e
        ref: "tests/live-uat/stop-canary.mjs (PASS STOP-03 line; 2 turn_start for one prompt)"
        status: pass
    human_judgment: true
    rationale: "Live-runtime observation; confirmed via the harness output, which exits non-zero by design."
  - id: D3
    description: "The 8-consecutive-block override cap bounds the always-block canary and fires the one-shot warning once (STOP-07)"
    requirement: STOP-07
    verification: []
    human_judgment: true
    rationale: "Headless pi cannot sustain the settle->block->re-enter loop to the cap (no PTY tooling; pi -p/stdin exit after the first re-entry turn). Requires an interactive TTY session -- README human checklist item 4."
  - id: D4
    description: "Abort mid-tool-call fires neither Stop nor StopFailure and carries stopReason aborted (STOP-01)"
    requirement: STOP-01
    verification: []
    human_judgment: true
    rationale: "Unscriptable interrupt timing; documented as README human checklist item 1."
  - id: D5
    description: "Settle timing with queued user messages -- one agent_settled after the queue drains (STOP-01)"
    requirement: STOP-01
    verification: []
    human_judgment: true
    rationale: "Unscriptable queue-drain timing; documented as README human checklist item 2."
  - id: D6
    description: "sendMessage re-entry does not self-clear stop_hook_active; only a genuine input clears it (STOP-07)"
    requirement: STOP-07
    verification: []
    human_judgment: true
    rationale: "Requires inspecting stop_hook_active across consecutive interactive re-entries; documented as README human checklist item 3."

# Metrics
duration: 55min
completed: 2026-07-30
status: complete
---

# Phase 88 Plan 05: Live Stop-contract runtime UAT Summary

**A standalone live-Pi canary that proves agent_settled dispatch (STOP-01) and block re-entry (STOP-03) on real Pi 0.80.10, plus a human-verification checklist routing the four D-88-03b runtime questions (abort, queue timing, input self-clear, the 8-block cap loop) to human_needed.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-30T14:47:35Z
- **Completed:** 2026-07-30T15:43:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Proved, end-to-end on a real Pi 0.80.10 session, that `agent_settled` fires and dispatches the Stop bucket (STOP-01) and that a `decision: block` Stop hook re-enters the idle agent loop, starting a new turn (STOP-03) — the observables the mocked settle tests (88-01..04) only approximate.
- Discovered and documented the concrete headless limit: a non-interactive `pi` (both `-p` and piped stdin) STARTS the first hook-driven re-entry turn, then tears down before it settles again, so the full 8-block cap loop cannot be driven autonomously (no PTY tooling available). Routed honestly to `human_needed` rather than faked.
- Delivered a human-verification checklist with exact repro / expected / failure-signature for the three unscriptable items plus the cap loop, framed so the verifier routes `human_needed`.

## Task Commits

1. **Task 1: Scripted ralph-wiggum canary (STOP-01/STOP-03; cap->human)** - `593b5958` (feat)
2. **Task 2: Human-verification checklist for the unscriptable items** - `c8650ee1` (docs)

Deviation (pre-Task-1 unblock):

- **Pad blank line in stop-failure test** - `fd1da827` (style)

## Files Created/Modified

- `tests/live-uat/stop-canary.mjs` - Standalone live UAT: installs a Stop-only always-block canary into the tmp/pi-uat sandbox via the real `/claude:plugin` machinery, drives a real `pi -p --mode json --no-tools --offline` turn, asserts STOP-01 + STOP-03 from the JSON event stream + hook marker file, and exits non-zero routing the STOP-07 cap loop to `human_needed`. Always uninstalls the canary in a `finally` block.
- `tests/live-uat/README.md` - Repro command, pass criteria, the observed live result, and the human-verification checklist (items 1–4).
- `eslint.config.js` - Ignore `tests/live-uat/` (standalone `.mjs` outside the typed source tree; not in `npm run check`).
- `tests/bridges/hooks/payloads/stop-failure.test.ts` - Added a required blank line (pre-existing `@stylistic/padding-line-between-statements` error surfaced by the repo-wide `eslint .` commit gate).

## Decisions Made

- **spawn + stdin "ignore" over execFile:** `execFile` leaves stdin an open pipe, which made non-interactive `pi` hang waiting for input after the re-entry turn (a 3-minute stall). `spawn` with `stdio: ["ignore", …]` gives the child `/dev/null` on stdin → EOF → pi tears down cleanly (~15s).
- **`--offline` on the drive:** the sandbox carries a github-source marketplace with autoupdate; a load-time reconcile otherwise blocked on a network fetch. `--offline` disables only Pi's startup network ops, not the model call (matches NFR-5).
- **Structural re-entry assertion:** two `turn_start` events for one user prompt (the documented extra-turn-boundary divergence) is the re-entry proof, read from `--mode json`, not a text scrape.
- **Cap loop → human_needed:** with no PTY tooling (`script(1)` absent, no `node-pty` dep, Node has no built-in PTY), the interactive loop the cap requires cannot be driven autonomously. The harness proves the re-entry START and routes the loop to human_needed — the plan-sanctioned honest fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Padded a pre-existing lint error in stop-failure.test.ts**
- **Found during:** Task 1 (pre-commit gate)
- **Issue:** The `npm-lint` pre-commit hook runs `eslint .` repo-wide and failed on a pre-existing `@stylistic/padding-line-between-statements` error at `tests/bridges/hooks/payloads/stop-failure.test.ts:29` (committed in `feat(88-04)`), blocking every commit.
- **Fix:** Added the required blank line after the closed-vocab guard's closing brace.
- **Files modified:** tests/bridges/hooks/payloads/stop-failure.test.ts
- **Verification:** `eslint` on the file passes; the full commit gate passed.
- **Committed in:** `fd1da827` (separate style commit to keep Task 1 atomic)

**2. [Rule 3 - Blocking] Ignored tests/live-uat/ from eslint**
- **Found during:** Task 1
- **Issue:** The standalone `.mjs` harness lives outside the typed source tree; `eslint .` (the `lint` gate) crashed on it (typed-linting requires type info the `.mjs` has none of), which would break `npm run check` for everyone.
- **Fix:** Added `tests/live-uat/` to `eslint.config.js` ignores (mirrors the existing `tmp/` precedent). The harness is deliberately excluded from `npm run check`.
- **Files modified:** eslint.config.js
- **Verification:** `eslint` reports the `.mjs` as ignored (no crash); config lints clean.
- **Committed in:** `593b5958` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking commit-gate issues)
**Impact on plan:** Both were necessary to land the plan's artifacts through the repo-wide commit gate. No scope creep into feature behavior.

## Issues Encountered

- **Initial 300s hang on the drive:** the first harness runs timed out with zero output. Root-caused to (a) the sandbox's github marketplace autoupdate blocking load (fixed with `--offline`) and (b) `execFile` leaving stdin an open pipe so pi waited for input after re-entry (fixed by switching to `spawn` with stdin `ignore`). After both fixes the harness runs in ~15s.
- **The 8-block cap cannot be scripted:** empirically confirmed via `pi -p`, piped stdin, and an attempted PTY drive (`script(1)` is not installed). Non-interactive pi observes exactly one block then exits after starting the re-entry turn. This is a real Pi lifecycle behaviour, documented and routed to human_needed (checklist item 4), not a defect in the dispatcher.

## Human Verification Required

This plan is a live UAT; per D-88-03b the following are recorded in `tests/live-uat/README.md` as explicit `human_needed` items (the verifier must route human_needed, not silently pass):

1. Abort mid-tool-call fires neither Stop nor StopFailure and carries `stopReason: "aborted"` (STOP-01).
2. Settle timing with queued user messages — one `agent_settled` after the queue drains (STOP-01).
3. `sendMessage` re-entry does not self-clear `stop_hook_active`; only a genuine `input` clears it (STOP-07).
4. The 8-consecutive-block override cap trips exactly once with the one-shot warning (STOP-07) — the scripted harness proves only the first re-entry.

## User Setup Required

None beyond the live-UAT prerequisites documented in `tests/live-uat/README.md` (a `pi` >= 0.80.5 binary, the `tmp/pi-uat/agent` sandbox with a working provider). The scripted canary is standalone and NOT part of `npm run check`.

## Next Phase Readiness

- The live half of the D-88-03 verification harness is in place; STOP-01 and STOP-03 are proven on real Pi, and the runtime residue is a well-specified human checklist.
- Phase 89 (docs reconcile) can cite `tests/live-uat/` for the observed extra-turn-boundary divergence and the headless-vs-interactive cap behaviour.
- Milestone-close UAT should execute the four checklist items against an interactive Pi session before archiving.

## Self-Check: PASSED

- Created files verified on disk: `tests/live-uat/stop-canary.mjs`, `tests/live-uat/README.md`, `88-05-SUMMARY.md`.
- Task commits verified in git: `fd1da827` (style unblock), `593b5958` (Task 1), `c8650ee1` (Task 2).

---
*Phase: 88-agent-settled-dispatcher-stop-contract-stopfailure*
*Completed: 2026-07-30*

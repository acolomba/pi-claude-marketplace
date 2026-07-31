---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
plan: 03
subsystem: hooks
tags: [stop-hook, loop-protection, stop_hook_active, override-cap, notify, agent_settled]

# Dependency graph
requires:
  - phase: 88-02
    provides: collectBucketOutcomes seam + aggregate Stop precedence (D-88-05) the STOP-07 counter arms hang off
  - phase: 88-01
    provides: settle dispatcher (agent_end cache + agent_settled stopReason gate) and the Stop block re-entry lane
provides:
  - "stop_hook_active per-session flag threaded into the Stop stdin payload (set on block re-entry, cleared only on genuine input)"
  - "8-consecutive-block override cap (D-88-06) suppressing the 8th re-entry with a one-shot warning latch"
  - "notifyStopHookOverrideCap warning-severity bridge seam + byte-stable docs/output-catalog.md entry"
  - "dedicated pi.on(input) STOP-07 reset subscription (registration count 10 -> 11, distinct event-name set unchanged)"
affects: [89-documentation-reconcile, stop-hooks-live-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bridge diagnostic notify seam reconciled with the notify-grammar invariant WITHOUT a NotificationMessage fixture: dedicated byte-test reads the catalog block (mirrors notifyAsyncRewakeSummary)"
    - "Consecutive-counter + one-shot latch loop protection: increment-before-decide on the block arm, reset on any non-block outcome"

key-files:
  created:
    - tests/architecture/hooks-cap-notify.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - docs/output-catalog.md
    - tests/bridges/hooks/settle.test.ts
    - tests/architecture/hooks-dispatch.test.ts
    - tests/shared/index-smoke.test.ts

key-decisions:
  - "Cap literal 8 duplicated in shared/notify.ts rather than imported from the bridge layer, so shared/ never depends on bridges/ (layering)"
  - "stop_hook_active is cleared ONLY on a genuine input event; a non-block outcome resets the counter + latch but leaves the flag (per key_links)"
  - "Executed task 2 (notify seam) before task 1 (wiring) because task 1's block arm calls the seam — build order keeps each commit green"
  - "D-88-07 reconciled honestly: the cap-trip is a bridge diagnostic, not a NotificationMessage, so it lives in a dedicated byte-test + the catalog Out-of-band section (which catalog-uat structurally skips), NOT silently exempted"

patterns-established:
  - "STOP-07 reset lives in a dedicated second input subscription; Pi supports multiple handlers per event"

requirements-completed: [STOP-07]

coverage:
  - id: D1
    description: "stop_hook_active flag threads into the next Stop payload, survives a bridge re-entry, and clears only on a genuine input"
    requirement: STOP-07
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#STOP-07: stop_hook_active threads into the next payload, survives a bridge re-entry, and clears only on a genuine input"
        status: pass
    human_judgment: false
  - id: D2
    description: "8-consecutive-block cap: 7 blocks re-enter, the 8th suppresses re-entry + trips a one-shot warning, a 9th does not re-notify; D-88-06 counter resets on any non-block outcome and re-arms the latch"
    requirement: STOP-07
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#STOP-07 boundary/adjacency: 7 blocks re-enter; the 8th suppresses re-entry and trips the cap once; a 9th does not re-notify"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#STOP-07 ordering/precision: a non-block outcome resets the consecutive counter and re-arms the latch"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cap-trip warning ships through the sanctioned notify boundary at warning severity, byte-stable in the catalog"
    requirement: STOP-07
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-cap-notify.test.ts#STOP-07 / D-88-01: cap-trip output is byte-equal to the docs/output-catalog.md `stop-override-cap` block"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dedicated input-reset subscription wired; DISP-01 registration pins updated (10 -> 11 calls, event-name set unchanged)"
    requirement: STOP-07
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-dispatch.test.ts#DISP-01: registerHooksBridge calls pi.on exactly 11 times with the locked Pi event names (input twice)"
        status: pass
      - kind: unit
        ref: "tests/shared/index-smoke.test.ts#registers command, read-only tools, session_start, and resources_discover exactly once"
        status: pass
    human_judgment: false
  - id: D5
    description: "Transparency prohibition (P-88-01): a livelocking Stop hook's suppressed block is never silent — the user sees the warning end-to-end"
    requirement: STOP-07
    verification: []
    human_judgment: true
    rationale: "The offline tests prove notifyStopHookOverrideCap fires once at warning severity, but that the warning is actually surfaced to the user in a real Pi session (the D-88-03 ralph-wiggum canary through the 8-block cap) is a runtime judgment reserved for the phase live UAT."

# Metrics
duration: 40min
completed: 2026-07-30
status: complete
---

# Phase 88 Plan 03: STOP-07 loop protections Summary

**stop_hook_active flag + 8-consecutive-block override cap with a one-shot warning through a sanctioned notify seam, plus the input-driven reset that keeps a livelocking Stop hook bounded and visible.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-30T12:50:00Z (approx)
- **Completed:** 2026-07-30T13:30:00Z (approx)
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- Realized the STOP-07 loop-protection state machine in `settle.ts`: a `stopHookActive` flag threaded into the Stop stdin payload, a consecutive-block counter with D-88-06 reset-on-any-non-block semantics, and a one-shot cap latch. The 8th consecutive block suppresses re-entry and fires the override warning exactly once; a 9th does not re-notify until a reset re-arms the latch.
- Added `notifyStopHookOverrideCap` — a warning-severity `ctx.ui.notify` bridge seam modeled on `notifyDiagnostic` — with a non-empty summary first line, a `\n\n` detail block naming the plugin (D-88-01), a byte-stable `docs/output-catalog.md` entry, and a dedicated byte-equality test.
- Wired a dedicated `pi.on("input")` reset subscription (distinct from the UserPromptSubmit dispatch handler) so `stop_hook_active` clears only on genuine user input — never on a bridge-injected re-entry. Registration count 10 → 11; the distinct event-name set stays 10 (`input` subscribed twice).

## Task Commits

Each task was committed atomically (task 2 committed first — task 1's block arm depends on task 2's seam):

1. **Task 2: cap-trip warning seam + catalog entry + byte-equality coverage** - `a6dcfdf0` (feat)
2. **Task 1: stop_hook_active flag, 8-consecutive-block cap, input reset** - `3a90c034` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - `notifyStopHookOverrideCap` warning-severity bridge seam (cap literal `8` kept local to avoid a `bridges/` import)
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` - loop-state cells (`stopHookActive`, `consecutiveBlockCount`, `capNotifiedThisSession`), `resetSettleState` extension, `resetConsecutiveBlockState`, `handleBlockOutcome`, `inputResetHandlerFor`, `_peekLoopStateForTest`; `runStopBucket` now sources the flag and applies the cap
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - dedicated `pi.on("input", inputResetHandlerFor(...))` reset subscription + doc-comment count 10 → 11
- `docs/output-catalog.md` - `stop-override-cap` Out-of-band entry (catalog-uat structurally skips this section)
- `tests/architecture/hooks-cap-notify.test.ts` - byte-equality + single-call/warning-severity/structural-summary pins for the seam
- `tests/bridges/hooks/settle.test.ts` - STOP-07 boundary / adjacency / empty / ordering / precision + flag-threading + STOP-05-resets-counter cases
- `tests/architecture/hooks-dispatch.test.ts` - DISP-01 pin 10 → 11 (input subscribed twice, event-name set unchanged)
- `tests/shared/index-smoke.test.ts` - corrected the pi.on registration-set pin

## Decisions Made

- **Cap literal duplicated, not imported.** `notifyStopHookOverrideCap` lives in `shared/notify.ts`; importing the `STOP_OVERRIDE_CAP` constant from `bridges/hooks/settle.ts` would make `shared/` depend on `bridges/`. The cap is a fixed contract value (8), so the literal is duplicated with a comment on both sides.
- **stop_hook_active clears only on input.** Per the plan `key_links`, a non-block outcome resets the counter + re-arms the latch but leaves `stopHookActive`; only a genuine `input` event clears the flag. This matches upstream: the flag means "we are inside a stop-hook-driven continuation" and stays set until the user actually types.
- **Task order reversed for build hygiene.** Task 2 (the notify seam) was committed before task 1 (the wiring) because task 1's block arm calls the seam; committing in plan-number order would have left a non-compiling intermediate commit. Substance is unchanged.
- **D-88-07 reconciled honestly.** The cap-trip is a bridge diagnostic (like `notifyDiagnostic` / `notifyAsyncRewakeSummary`), NOT a marketplace `NotificationMessage`. It satisfies the notify-grammar invariant's STRUCTURAL rule (non-empty summary first line + `\n\n` block) — the same shape those seams already ship — and the invariant only walks `NotificationMessage` fixtures, so it is not tripped and not silently exempted. Byte coverage lives in the dedicated `hooks-cap-notify.test.ts`; the catalog entry sits in the Out-of-band section that `catalog-uat` structurally skips.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / Rule 1 - Pre-existing defect] Corrected the `index-smoke.test.ts` pi.on registration-set pin**
- **Found during:** Task 1 (dedicated input subscription)
- **Issue:** `tests/shared/index-smoke.test.ts` pins the full `pi.on` registration set via a single `deepEqual`. My STOP-07 change adds a second `input` subscription, which breaks that pin. On inspection, the pin was ALREADY stale from plan 88-01: it never listed `agent_end` / `agent_settled` (added when the settle dispatcher landed), so the test had been red since 88-01 (confirmed by temporarily unstaging my bridge edits — the failure persisted). The `deepEqual` is all-or-nothing, so I could not fix my second-`input` change without also correcting the 88-01 omission.
- **Fix:** Updated the expected event-name array to the true set (`agent_end`, `agent_settled`, the second `input`) and rewrote the accompanying comment to reflect the 11-registration reality.
- **Files modified:** tests/shared/index-smoke.test.ts
- **Verification:** `node --test tests/shared/index-smoke.test.ts` green; full unit suite 3108 pass / 0 fail / 1 skip.
- **Committed in:** `3a90c034` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking-adjacent / pre-existing defect correction)
**Impact on plan:** The correction was mandatory for my change to pass and unavoidably absorbed a pre-existing 88-01 pin gap. No scope creep — it is the same registration-set invariant the plan's DISP-01 update targets, in a second test file the plan did not enumerate.

## Issues Encountered

- The plan's DISP-01 note ("now at 10 from plan 01") referenced only `tests/architecture/hooks-dispatch.test.ts`; a second, stale registration-set pin in `tests/shared/index-smoke.test.ts` surfaced during task 1 (see Deviations). Resolved by correcting the full set.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STOP-07 loop protections complete: `stop_hook_active`, 8-consecutive-block cap, one-shot warning, input reset, D-88-06 counter semantics — all offline-verified.
- The transparency guarantee (P-88-01) and the D-88-03 ralph-wiggum end-to-end canary through the 8-block cap remain a runtime judgment for the phase live UAT (flagged as `human_judgment: true`, coverage D5).
- Phase 89 (DOC-04 / DOC-05) can now describe the shipped Stop loop-protection behavior, including the one irreducible re-entry timing shift.

## Self-Check: PASSED

---
*Phase: 88-agent-settled-dispatcher-stop-contract-stopfailure*
*Completed: 2026-07-30*

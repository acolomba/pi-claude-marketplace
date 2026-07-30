---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
plan: 04
subsystem: api
tags: [hooks, stopfailure, settle-dispatcher, error-classifier, pi-events]

# Dependency graph
requires:
  - phase: 88-01
    provides: settle dispatcher tracer (agent_end cache, agent_settled stopReason gate, runStopFailure stub)
  - phase: 88-03
    provides: STOP-07 loop protections (stop_hook_active, 8-block cap, input reset) the StopFailure arm must never touch
provides:
  - StopFailure observation-only settle arm (error/length -> reduceBucket -> result discarded)
  - Finalized StopFailureStdin envelope + translate (error, optional error_details, last_assistant_message)
  - errorMessage-only classifier into the closed 10-value error-type vocabulary with unknown fallback
affects: [89-documentation-reconcile, stopfailure-error-matcher-row]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Observation-only bucket dispatch: run reduceBucket for side effects, discard the reduced result (no re-entry lane)"
    - "Closed-vocabulary classifier: ordered case-insensitive substring table with a total in-vocabulary fallback, membership-asserted against the domain closed set"

key-files:
  created:
    - tests/bridges/hooks/payloads/stop-failure.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts

key-decisions:
  - "StopFailure arm never touches sendMessage, stop_hook_active, or the block counter (SFAIL-01 observation-only)"
  - "Classifier is errorMessage-only per D-88-02: no after_provider_response subscription, no HTTP-status cell; length -> max_output_tokens is deterministic"
  - "oauth_org_not_allowed left unsynthesized (A2): org-policy errors fall through to the unknown fallback rather than guessing a substring"

patterns-established:
  - "Observation-only dispatch: reduceBucket result dropped; loop-state cells left untouched"
  - "Substring classifier grounded in Pi's own retry/limit regexes, output membership-pinned to NON_TOOL_EVENT_CLOSED_SETS.StopFailure"

requirements-completed: [SFAIL-01, SFAIL-02, SFAIL-03]

coverage:
  - id: D1
    description: "StopFailure fires observation-only at settle on stopReason error and length: the bucket runs and the result is discarded -- no sendMessage, no stop_hook_active/counter/latch mutation, even on a blocking or exit-2 hook; empty bucket -> no dispatch"
    requirement: SFAIL-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#SFAIL-01: stopReason error runs the StopFailure bucket observation-only even when the hook blocks"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#SFAIL-01: a StopFailure hook exiting 2 produces no re-entry (result discarded)"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#SFAIL-01: an empty StopFailure bucket dispatches nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "StopFailureStdin envelope carries session_id, transcript_path, cwd, hook_event_name, error (classified), optional error_details (omitted when absent), and last_assistant_message = the verbatim errorMessage (empty when absent)"
    requirement: SFAIL-02
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop-failure.test.ts#stop-failure: emits the StopFailure envelope with error + details + message"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop-failure.test.ts#stop-failure: error_details is omitted (not just falsy) when absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "errorMessage-only classifier maps into the closed 10-value vocab (unknown fallback); length -> max_output_tokens deterministically; case-insensitive substring matching; every output is a member of NON_TOOL_EVENT_CLOSED_SETS.StopFailure"
    requirement: SFAIL-03
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop-failure.test.ts#SFAIL-03 classifier fixtures (20 cases) + case-insensitivity + closed-vocab membership"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-dispatch.test.ts#DISP-01 pi.on count stays 11 (no new subscription this plan)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-30
status: complete
---

# Phase 88 Plan 04: StopFailure observation-only arm + errorMessage classifier Summary

**Observation-only StopFailure settle arm (error/length -> reduceBucket, result discarded) plus the finalized StopFailure stdin envelope and an errorMessage-only substring classifier mapping into the closed 10-value error-type vocab with an unknown fallback and a deterministic length -> max_output_tokens map.**

## Performance

- **Duration:** ~25 min (resumed after a transient API cut-off mid-run)
- **Completed:** 2026-07-30
- **Tasks:** 2
- **Files modified:** 3 (2 source, 1 new test) + settle.test.ts (RED, committed pre-resume)

## Accomplishments
- Filled `runStopFailure` in `settle.ts`: `error`/`length` endings run the StopFailure bucket via `reduceBucket` and DISCARD the reduced result — no re-entry, no `sendMessage`, and zero mutation of `stop_hook_active` / the consecutive-block counter / the cap latch, proven even when the hook blocks or exits 2 (SFAIL-01).
- Finalized `StopFailureStdin` + `translate`: common three fields from `TranslationContext` plus `error`, optional `error_details` (omitted when absent), and `last_assistant_message` = the verbatim `errorMessage` (SFAIL-02).
- Implemented `classifyStopFailure`: `length` -> `max_output_tokens` deterministically; otherwise an ordered case-insensitive substring table grounded in Pi's own retry/limit regexes maps into the closed vocab, falling back to `unknown` (SFAIL-03, D-88-02).
- Pinned classifier output to `NON_TOOL_EVENT_CLOSED_SETS.StopFailure` membership so no input can escape the closed 10-value set (T-88-07 mitigation).

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: StopFailure observation-only arm + envelope** — RED `f56a426c` (test, pre-resume) → GREEN `7b735a6f` (feat)
2. **Task 2: errorMessage-only classifier** — RED `e1166480` (test) → GREEN `509173fa` (feat)

_Task 1's GREEN incorporated the cut-off agent's in-flight edits to settle.ts + stop-failure.ts (verified against the plan, completed, and committed rather than reimplemented)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` - `runStopFailure` observation-only arm (reduceBucket + discard); gate wires the classifier into the `error` arm, `length` deterministic.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts` - Finalized `StopFailureStdin` + `translate`; `classifyStopFailure` with the ordered substring `CLASSIFIER_TABLE`.
- `tests/bridges/hooks/payloads/stop-failure.test.ts` - Classifier fixtures (20 cases + case-insensitivity), envelope shape, closed-vocab membership assertion.

## Decisions Made
- Completed the cut-off agent's partial GREEN edits (they are this plan's own files and matched the plan contract) rather than resetting and reimplementing — lower risk, no rework.
- Classifier `CLASSIFIER_TABLE` ordered billing → rate_limit → overloaded → auth → server_error → model_not_found → invalid_request, so specific limit/billing forms win before the broad HTTP-status forms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] import-x/order lint on the pi-api type import**
- **Found during:** Task 1 (pre-commit)
- **Issue:** `../../../platform/pi-api.ts` type import was ordered after `../translation-context.ts`, tripping `import-x/order`.
- **Fix:** Swapped the two type-import lines so the deeper relative path precedes the sibling.
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
- **Verification:** `pre-commit run` clean; typecheck green.
- **Committed in:** 7b735a6f (Task 1 GREEN)

**2. [Rule 3 - Blocking] TS18048 on the closed-vocab test const**
- **Found during:** Task 2 (typecheck)
- **Issue:** `NON_TOOL_EVENT_CLOSED_SETS` is a `Partial<Record<...>>`, so `.StopFailure` is `ReadonlySet<string> | undefined` — `CLOSED_VOCAB.has(...)` failed strict typecheck.
- **Fix:** Narrowed the test const with an explicit `undefined` guard that throws, yielding a `ReadonlySet<string>`.
- **Files modified:** tests/bridges/hooks/payloads/stop-failure.test.ts
- **Verification:** typecheck green; 25 tests pass.
- **Committed in:** 509173fa (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both were mechanical toolchain fixes with no behavioral change. No scope creep.

## Issues Encountered
- The RED commit's pre-commit passed at commit time but a standalone `npm run typecheck` later surfaced the TS18048 on the test const (Partial-record access); fixed in the GREEN commit. No functional impact.

## Verification
- `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/payloads/stop-failure.test.ts tests/architecture/hooks-dispatch.test.ts` — 57 tests, all pass.
- `npm run typecheck` — green.
- Subscription count pinned at 11 (unchanged; no new `pi.on` added this plan — D-88-02).
- The two GLOBAL-peer integration tests (skill-path-resolution, provenance-invisibility) remain env-flaky, not regressions.

## Next Phase Readiness
- SFAIL-01..03 delivered; StopFailure closes at the same fidelity bar as Stop, observation-only per upstream.
- Phase 88 dispatch is complete (Stop + StopFailure). Phase 89 documentation reconcile can now describe the shipped StopFailure error-type matcher row and the timing-shift caveat.

## Self-Check: PASSED

All created/modified files exist on disk; all task commits (`7b735a6f`, `e1166480`, `509173fa`) present in git history.

---
*Phase: 88-agent-settled-dispatcher-stop-contract-stopfailure*
*Completed: 2026-07-30*

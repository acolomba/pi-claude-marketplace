---
phase: 87-bucket-a-admission-platform-floor
plan: 02
subsystem: hooks
tags: [hooks, admission, typescript, discriminated-union, peer-floor]

# Dependency graph
requires:
  - phase: 87-bucket-a-admission-platform-floor
    provides: "DISPATCHABLE_EVENTS subset + DispatchableEvent type (Plan 01, D-87-04); Notification as the canonical unsupported example"
provides:
  - "BUCKET_A_EVENTS = 10 (adds Stop, StopFailure as the turn-boundary lifecycle tail); admission auto-follows via BUCKET_A_MEMBERS (ADMIT-01)"
  - "Stop null no-matcher sentinel + StopFailure closed 10-value error-type set in the NON_TOOL_EVENT tables (WR-04, SFAIL-03)"
  - "ClaudeHookEvent widened to 10 in lockstep"
  - "DISPATCHABLE_MEMBERS + isDispatchableEvent type guard; the two dispatch index sites narrowed to DispatchableEvent (D-87-04 belt)"
  - "@earendil-works/pi-coding-agent peer floor >=0.80.5, declarative only (FLOOR-01, D-87-01, D-87-05)"
affects: [88-agent-settled-dispatcher-stop-contract-stopfailure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Superset admission union / dispatchable subset: BucketAEvent now properly contains DispatchableEvent; dispatch-path functions key on the subset and narrow BucketAEvent via isDispatchableEvent before indexing translator tables"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - tests/architecture/hooks-supportability.test.ts
    - tests/architecture/hooks-translators.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/domain/components/hooks.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Tuple order: Stop then StopFailure appended after SessionEnd as the deterministic turn-boundary lifecycle tail (Claude's Discretion, ADMIT-01)"
  - "dispatch.ts adaptForEvent/entryFires/compositeHandlerFor re-keyed Exclude<BucketAEvent> -> Exclude<DispatchableEvent> as a Rule-3 blocking-fix (the widen made two exhaustive switches non-exhaustive); consistent with the Plan 01 D-87-04 decoupling, no behavior change"
  - "StopFailure field label 'error' is [ASSUMED] and non-load-bearing; the closed set is the load-bearing gate; field-name confirmation deferred to Phase 89"

patterns-established:
  - "isDispatchableEvent type guard narrows the admitted union to the dispatchable subset at the translator index sites; the non-dispatchable arm is a defensive debug-log + noop (statically unreachable this milestone)"

requirements-completed: [ADMIT-01, FLOOR-01]

# Metrics
duration: 21min
completed: 2026-07-29
status: complete
---

# Phase 87 Plan 02: Admission Cutover & Platform Floor Summary

**BUCKET_A_EVENTS grows 8->10 (Stop null-sentinel + StopFailure closed 10-value error-type set) with ClaudeHookEvent widened in lockstep, the two dispatch index sites narrowed to DispatchableEvent, and the peer floor raised to >=0.80.5 declaratively — full unit/architecture/resolver suites green.**

## Performance

- **Duration:** ~21 min
- **Completed:** 2026-07-29
- **Tasks:** 2
- **Files modified:** 11 (5 source + 4 test + package.json + package-lock.json)

## Accomplishments

- Appended `Stop` then `StopFailure` to `BUCKET_A_EVENTS` (turn-boundary lifecycle tail) and widened `ClaudeHookEvent` in lockstep so the `as const satisfies readonly ClaudeHookEvent[]` pin holds (ADMIT-01). Admission auto-follows via `BUCKET_A_MEMBERS` — no new admission code needed.
- Landed both matcher dispositions in `hook-events.ts`: `Stop` = `null` in `NON_TOOL_EVENT_FIELDS` and omitted from `NON_TOOL_EVENT_CLOSED_SETS` (UserPromptSubmit precedent); `StopFailure` = `"error"` field + the closed 10-value error-type set — both `StopFailure` table entries in the same edit (WR-04 desync guard).
- Added `DISPATCHABLE_MEMBERS` + `isDispatchableEvent` type guard and guarded the two dispatch index sites (`dispatch-exec.buildPayload`, `async-rewake/registry`) — the defensive non-dispatchable arm is a debug-log + noop, unreachable this milestone (D-87-04).
- Updated the drift guards: 10-tuple locked-order deepEqual in `hooks-supportability.test.ts`, and a `BUCKET_A_EVENTS.length === 10` companion pin alongside the existing `DISPATCHABLE_EVENTS.length === 8` in `hooks-translators.test.ts` (the two key domains pinned separately).
- Added the inline end-to-end tracer proof (config -> partitionHooks -> resolver): a match-all `Stop` group alongside a supported event resolves `installable` with no `{unsupported hooks}` drop.
- Added the disposition unit pins in `hooks.test.ts` (Stop no-matcher-support vs match-all; StopFailure in-vocabulary admit; out-of-vocabulary + pipe-compound closed-set drop) and the architecture pins in `hooks-supportability.test.ts`.
- Raised the `@earendil-works/pi-coding-agent` peer floor `>=0.74.0` -> `>=0.80.5` declaratively (FLOOR-01, D-87-01, D-87-05) and synced `package-lock.json` (only the peer-range line changed).

## Task Commits

1. **Task 1 (tracer): Admission cutover — widen BUCKET_A_EVENTS 8->10 with both dispositions, wired end-to-end** — `9ff93e5a` (feat)
2. **Task 2: Matcher-disposition unit pins + peer-floor bump** — `133d171b` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — tuple widened to 10; `Stop`/`StopFailure` dispositions; `DISPATCHABLE_MEMBERS` + `isDispatchableEvent`; doc-comments rewritten to drop the stale "eight v1.13-supported" / version narration
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` — `ClaudeHookEvent` widened to 10; stale "8 supported" comment corrected
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` — `isDispatchableEvent` guard before `buildPayload`
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` — `isDispatchableEvent` guard before the `TRANSLATORS` index
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` — `adaptForEvent` / `entryFires` / `compositeHandlerFor` re-keyed on `DispatchableEvent` (Rule-3 blocking fix, see Deviations)
- `tests/architecture/hooks-supportability.test.ts` — 10-tuple deepEqual; Stop/StopFailure disposition pins
- `tests/architecture/hooks-translators.test.ts` — `BUCKET_A_EVENTS.length === 10` companion pin
- `tests/domain/resolver-strict.test.ts` — inline Stop-resolves-installable tracer proof
- `tests/domain/components/hooks.test.ts` — Stop/StopFailure matcher-disposition unit cases
- `package.json` / `package-lock.json` — peer floor `>=0.80.5`

## Decisions Made

- **Tuple order:** `Stop` then `StopFailure` appended after `SessionEnd` as the deterministic turn-boundary lifecycle tail (Claude's Discretion under ADMIT-01) — documented in the `BUCKET_A_EVENTS` doc-comment.
- **StopFailure `"error"` field label is [ASSUMED] and non-load-bearing.** The gate compares the raw matcher string to the closed set regardless of the label; field-name confirmation against the upstream contract is deferred to Phase 89 (per 87-RESEARCH A2). Recorded as an `[ASSUMED — field-name label]` note in-code.
- **No pipe-OR tokenization** added to the non-tool closed-set gate: `StopFailure` stays exact whole-string membership, so `rate_limit|server_error` drops as `closed-set` — pinned by a dedicated unit case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-keyed dispatch.ts switch functions to DispatchableEvent**
- **Found during:** Task 1 (typecheck after the tuple widen)
- **Issue:** Growing `BUCKET_A_EVENTS` to 10 made two exhaustive `switch` statements in `bridges/hooks/dispatch.ts` (`adaptForEvent`, `entryFires`, both typed `Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">`, plus the `compositeHandlerFor` generic constraint) non-exhaustive — `tsc` failed with TS7030 (not all code paths return) and TS2366 (function lacks ending return). `dispatch.ts` was not in the plan's `files_modified` list.
- **Fix:** Re-keyed the three sites from `Exclude<BucketAEvent, ...>` to `Exclude<DispatchableEvent, ...>` — the exact D-87-04 decoupling pattern already applied to the translator tables in Plan 01. Verified every `compositeHandlerFor` callsite in `event-router.ts` only ever passes dispatchable events (SessionStart, SessionEnd, PreCompact, PostCompact, UserPromptSubmit, PreToolUse), so the narrower constraint is sound. No behavior change; the two switches regain exhaustiveness.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`
- **Commit:** `9ff93e5a`

### Note (not a deviation)

- The plan's Task-1 `read_first` referenced `assert.equal(BUCKET_A_EVENTS.length, 8, ...)` at `hooks-translators.test.ts:176`, but Plan 01 had already re-keyed that assertion to `DISPATCHABLE_EVENTS.length === 8`. Rather than "change 8 -> 10", the plan's intent ("translator count and admission-tuple length pinned separately") was met by ADDING a `BUCKET_A_EVENTS.length === 10` companion pin alongside the existing `DISPATCHABLE_EVENTS.length === 8`.

## Issues Encountered

- The known local-environment integration failures (`tests/integration/skill-path-resolution.test.ts`, `provenance-invisibility.test.ts`) resolve the `pi-subagents` optional peer from the global `npm root -g` and fail on a stale/absent global version — documented environment issue, unrelated to hook admission, not re-run here. Typecheck, lint, format, and the touched unit/architecture/resolver suites are green.
- The installed `node_modules` copy of `@earendil-works/pi-coding-agent` is 0.79.10 (stale dev tree), but the declared `devDependency` (`^0.82.1`) satisfies the new `>=0.80.5` floor and `package-lock.json` resolved 0.82.1, so no lockfile churn beyond the single peer-range line. Per project rule, no full `npm install`/`npm ci` was run.

## Verification

- `npm run typecheck` — exit 0 (no `Record<BucketAEvent>` totality site demands a Stop/StopFailure translator).
- Task suites green: `hooks-supportability` (12), `hooks-translators`, `resolver-strict` (99 incl. new tracer proof), `dispatch-exec`, `hooks` (62 incl. new disposition cases).
- Broader spot-check green: all `tests/architecture/*`, `tests/domain/components/*`, `plugin/info`, `plugin/install`, `notify-v2` — 685 pass / 1 env-skip / 0 fail.
- `tests/architecture/catalog-uat.test.ts` passes WITHOUT any edit to `docs/output-catalog.md` (D-87-06 confirmed — no lockstep doc edit needed).
- The 8-entry `pi.on` subscription assertion (`hooks-dispatch.test.ts:203`) is untouched and green (no `agent_settled` subscription added).
- `grep -c "0.74.0" package.json` = 0; peer floor reads `>=0.80.5`.

## Known Stubs

None. `Stop`/`StopFailure` are admitted-but-not-dispatched by design this phase (D-87-04); the non-dispatchable arm is a defensive belt, not a stub — dispatch is Phase 88.

## Next Phase Readiness

- Phase 88 can fold `DispatchableEvent` back into `BucketAEvent`, add the `agent_settled` subscriber + Stop/StopFailure translators, and remove the `isDispatchableEvent` guards once every admitted event is dispatchable.
- No blockers.

## Self-Check: PASSED

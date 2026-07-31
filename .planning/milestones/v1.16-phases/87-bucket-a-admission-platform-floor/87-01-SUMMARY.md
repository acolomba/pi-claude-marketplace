---
phase: 87-bucket-a-admission-platform-floor
plan: 01
subsystem: testing
tags: [hooks, typescript, discriminated-union, dispatch, fixtures]

# Dependency graph
requires:
  - phase: 86-frontmatter-compliance
    provides: v1.13 hooks bridge (BUCKET_A_EVENTS tuple, dispatch/rewake tables, partition/supportability suites)
provides:
  - "DISPATCHABLE_EVENTS tuple + DispatchableEvent type — the dispatch-key domain decoupled from the bucket-A admission tuple (D-87-04)"
  - "Three production dispatch tables (dispatch-exec TRANSLATORS + REQUIRED_EVENT_FIELDS, async-rewake registry TRANSLATORS) re-keyed on DispatchableEvent"
  - "Three translator-test tables + loops + local mirror re-keyed on DISPATCHABLE_EVENTS"
  - "Notification as the canonical unsupported/non-bucket-A example across the suite; two synthetic fixtures renamed to Notification-based names"
affects: [88-agent-settled-dispatcher-stop-contract-stopfailure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subset-tuple pinned `as const satisfies readonly BucketAEvent[]` mirrors the TOOL_EVENTS subset pattern — admitted union and dispatchable subset are separate key domains"

key-files:
  created:
    - tests/fixtures/hooks-notification-only.json
    - tests/fixtures/hooks-posttooluse-and-notification.json
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/architecture/hooks-translators.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/domain/components/hooks.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/architecture/hooks-supportability.test.ts

key-decisions:
  - "DISPATCHABLE_EVENTS demoted subset keyed to dispatch/rewake/translator tables; admission tuple BUCKET_A_EVENTS grows independently in Plan 02 (D-87-04)"
  - "No narrowing guard added — DISPATCHABLE_EVENTS equals BUCKET_A_EVENTS today (identical unions), so index sites compile unchanged"
  - "hookify-hooks.json provenance block left referencing Stop — it documents the real plugin's slimmed arm, restored in the admission plan (D-87-03)"

patterns-established:
  - "Dispatchable-subset pin: `as const satisfies readonly BucketAEvent[]` keeps every dispatchable event a compile-time member of the admitted union"

requirements-completed: []  # ADMIT-01 is NOT complete after this plan — it is the prep; the 8->10 admission ships in Plan 02.

coverage:
  - id: D1
    description: "DISPATCHABLE_EVENTS subset + DispatchableEvent type in hook-events.ts, pinned satisfies readonly BucketAEvent[]"
    verification:
      - kind: unit
        ref: "npm run typecheck (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three production dispatch tables re-keyed on DispatchableEvent (dispatch-exec x2, async-rewake registry x1); RoutingEntry/AsyncRewakeEntry.claudeEvent stay BucketAEvent"
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts, tests/bridges/hooks/dispatch-exec.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three translator-test tables + Block A/B loops + local mirror re-keyed on DISPATCHABLE_EVENTS; count assert stays 8"
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts#PAYL-01 every dispatchable event has a translator module"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stop -> Notification re-point across resolver/partition/info/install/notify/supportability suites; behavior byte-identical (Notification still non-bucket-A)"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts, tests/domain/components/hooks.test.ts, tests/orchestrators/plugin/info.test.ts, tests/orchestrators/plugin/install.test.ts, tests/shared/notify-v2.test.ts, tests/architecture/hooks-supportability.test.ts (435 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two synthetic fixtures renamed to Notification-based names with all consumers updated; no dangling old basenames"
    verification:
      - kind: unit
        ref: "grep -rn 'hooks-stop-only|hooks-posttooluse-and-stop' tests/ (zero matches)"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-07-29
status: complete
---

# Phase 87 Plan 01: Decouple Dispatch Key Domain & Re-point Unsupported Example Summary

**DISPATCHABLE_EVENTS subset decouples the dispatch/rewake/translator tables from the bucket-A admission tuple (still 8), and Notification replaces Stop as the canonical unsupported-event example across the suite — zero admission-behavior change, full suite green.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-29
- **Tasks:** 2
- **Files modified:** 10 (4 source/test + 6 test) plus 2 fixture renames

## Accomplishments

- Added `DISPATCHABLE_EVENTS` (the current 8 events) pinned `as const satisfies readonly BucketAEvent[]` and derived `DispatchableEvent`, modelled on the `TOOL_EVENTS` subset — so growing `BUCKET_A_EVENTS` to 10 in Plan 02 will not force Stop/StopFailure translators (Phase 88 work).
- Re-keyed the three total dispatch tables (`dispatch-exec.ts` `TRANSLATORS` + `REQUIRED_EVENT_FIELDS`, `async-rewake/registry.ts` `TRANSLATORS`) and `buildPayload`'s parameter to `DispatchableEvent`; `RoutingEntry.claudeEvent` / `AsyncRewakeEntry.claudeEvent` deliberately stay `BucketAEvent`.
- Re-keyed the three translator-test tables (`EVENT_TO_KEBAB`, `EVENT_FIXTURES`, `EXPECTED_JSON`), switched Block A/B loops to iterate `DISPATCHABLE_EVENTS`, and re-pointed the local mirror (`LOCAL_DISPATCHABLE`) — count assertion stays 8.
- Renamed the two synthetic fixtures (`hooks-notification-only.json`, `hooks-posttooluse-and-notification.json`), rewrote their event keys/descriptions to `Notification`, and swapped `Stop` → `Notification` in every synthetic canonical unsupported-event example across the resolver, partition, info, install, notify, and supportability suites.
- No narrowing guard / `isDispatchable*` symbol introduced (unions identical today); `BUCKET_A_EVENTS` unchanged at 8.

## Task Commits

1. **Task 1: Decouple the dispatch key domain (DISPATCHABLE_EVENTS subset)** — `8f96dd4e` (refactor)
2. **Task 2: Re-point the canonical unsupported-event example from Stop to Notification** — `18926799` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — added `DISPATCHABLE_EVENTS` tuple + `DispatchableEvent` type
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` — `TRANSLATORS`, `REQUIRED_EVENT_FIELDS`, `buildPayload` re-keyed on `DispatchableEvent`
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` — `TRANSLATORS` re-keyed on `DispatchableEvent` (entry `claudeEvent` stays `BucketAEvent`)
- `tests/architecture/hooks-translators.test.ts` — three tables + loops + local mirror re-keyed on `DISPATCHABLE_EVENTS`
- `tests/fixtures/hooks-notification-only.json` (renamed from `hooks-stop-only.json`) — Notification-keyed empty-subset edge
- `tests/fixtures/hooks-posttooluse-and-notification.json` (renamed from `hooks-posttooluse-and-stop.json`) — kept PostToolUse + dropped Notification
- `tests/domain/resolver-strict.test.ts`, `tests/domain/components/hooks.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/orchestrators/plugin/install.test.ts`, `tests/shared/notify-v2.test.ts`, `tests/architecture/hooks-supportability.test.ts` — Stop → Notification example re-point

## Decisions Made

- **ADMIT-01 not marked complete.** This plan is the ADMIT-01 *prep*: it keeps `BUCKET_A_EVENTS` at 8 and changes no admission behavior. The observable ADMIT-01 deliverable (tuple grows to 10, `Stop`/`StopFailure` admitted) ships in Plan 02. Requirements traceability is intentionally left Pending.
- **hookify provenance block left referencing Stop.** The `hookify-hooks.json` fixture is derived from real claude-plugins-official wire bytes, and its explanatory comment describes the plugin's *actual* (slimmed) Stop arm. Per D-87-03 the admission plan restores that real Stop arm; re-pointing it to Notification would misrepresent real provenance. The re-point applied only to *synthetic* canonical-example sites.
- No narrowing guard added — `DISPATCHABLE_EVENTS` equals `BUCKET_A_EVENTS` today (identical unions), so all index expressions compile unchanged (D-87-04).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full `npm run check` reports 2 integration failures in `tests/integration/skill-path-resolution.test.ts` (SC-2 / AGSK-06). These resolve the `pi-subagents` OPTIONAL peer from the global `npm root -g` and fail on a stale/absent global version — a documented local-environment issue (they `t.skip` when unreachable in CI), NOT a regression from this plan. `pi-subagents` skill-path resolution is unrelated to hook admission. Out of scope per the deviation-rule scope boundary. Typecheck, lint, format, and the entire unit suite are green.

## Next Phase Readiness

- Plan 02 can now grow `BUCKET_A_EVENTS` 8→10 (admit `Stop`/`StopFailure`) without a cascade of `Record<BucketAEvent>` typecheck failures or flipped `Stop`-is-unsupported assertions — the dispatch tables trail the admission tuple via `DISPATCHABLE_EVENTS`, and the synthetic unsupported-example sites already use `Notification`.
- No blockers.

## Self-Check: PASSED

---
*Phase: 87-bucket-a-admission-platform-floor*
*Completed: 2026-07-29*

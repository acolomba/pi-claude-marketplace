---
phase: 81-fetch-verb-info-fetch
plan: 01
subsystem: ui
tags: [notify, command-context, render-map, discriminated-union, typescript]

# Dependency graph
requires:
  - phase: 80-remote-status
    provides: "PluginRemoteMessage / ICON_REMOTE and the fs-only warm-tree three-way classifier whose rows fetch renders"
  - phase: prior-command-migrations
    provides: "shared/notify-context.ts CommandContext + RenderFn spine; update.messaging.ts / list.messaging.ts render-map precedent; shared/notify.ts row helpers and message shapes"
provides:
  - "orchestrators/plugin/fetch.messaging.ts exporting FETCH_STATUSES, FetchStatus, FetchMsg, FETCH_CONTEXT (+ internal FETCH_RENDER)"
  - "A total, compiler-enforced render map for fetch's six outcome statuses ready for Plan 02 to import"
affects: [81-02-fetch-orchestrator, 81-04-fetch-edge-handler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command-local messaging module: private status tuple + Msg union + total render map + as-const-satisfies CommandContext (clone of list/update.messaging.ts)"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  modified: []

key-decisions:
  - "D-81-02: no-op fetch renders (skipped) via pluginRow at info severity carrying the existing up-to-date REASONS member; no fetched token added"
  - "Render arms cloned byte-for-byte from list.messaging.ts (available/partially-available/unavailable/remote) and update.messaging.ts (skipped/failed); no row-building logic duplicated beyond the established list-surface joinTokens precedent"

patterns-established:
  - "fetch.messaging.ts mirrors the list/update messaging-module shape so the whole command family stays structurally identical"

requirements-completed: [FTCH-02]

coverage:
  - id: D1
    description: "fetch.messaging.ts exports a total FETCH_CONTEXT render map over fetch's six statuses; a missing arm is a TypeScript compile error"
    requirement: "FTCH-02"
    verification:
      - kind: other
        ref: "tsc --noEmit -p tsconfig.json (clean); totality proven by transiently removing the remote arm -> TS2741 at the satisfies site, then restoring"
        status: pass
    human_judgment: false
  - id: D2
    description: "No new ICON / STATUS_TOKEN / PLUGIN_STATUS / REASONS member introduced (closed sets do not grow)"
    requirement: "FTCH-02"
    verification:
      - kind: other
        ref: "grep -aE 'ICON_[A-Z]+ =|STATUS_TOKENS =|PLUGIN_STATUSES =|REASONS =' fetch.messaging.ts -> empty (file only imports/consumes)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-14
status: complete
---

# Phase 81 Plan 01: fetch messaging vocabulary Summary

**`fetch.messaging.ts` exports a compiler-total `FETCH_CONTEXT` render map over fetch's six outcome statuses (available / partially-available / unavailable / remote / skipped / failed), cloning the list + update messaging-module precedent and growing no closed set.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created `fetch.messaging.ts` exporting `FETCH_STATUSES`, `type FetchStatus`, `type FetchMsg`, and `FETCH_CONTEXT` (with internal `FETCH_RENDER`).
- Render map is total over fetch's own statuses via `as const satisfies CommandContext<FetchStatus, FetchMsg>` — a deleted arm raises TS2741 (proven and restored).
- Every render arm CALLS shared `shared/notify.ts` helpers verbatim: the four not-installed arms use `joinTokens` + `renderScopeBracket`/`renderVersion`/`composeReasons` (identical to `list.messaging.ts`); `skipped` and `failed` route through `pluginRow` (identical to `update.messaging.ts`). No row-building logic duplicated.
- No new ICON / STATUS_TOKEN / PLUGIN_STATUS / REASONS member — the file only imports and consumes existing closed-set members.

## Task Commits

1. **Task 1: Create fetch.messaging.ts (FETCH_CONTEXT render vocabulary)** - `4bc6beea` (feat)

**Plan metadata:** `<hash>` (docs: complete plan)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts` - fetch's command-local render vocabulary: status tuple, message union, total render map, and `FETCH_CONTEXT`.

## Decisions Made
- None beyond the locked phase decisions. D-81-02's `(skipped)` no-op arm carries the existing `up-to-date` reason at info severity through `pluginRow` (parity with the update verb). Reason-member selection (`up-to-date`) is carried in the row's `reasons` by the Plan 02 producer, not hardcoded in the render arm — the render arm is reason-agnostic, matching the central switch.

## Deviations from Plan

None functional. One documentation note: the plan's automated verify command referenced `extensions/pi-claude-marketplace/tsconfig.json`, but the extension's tsconfig lives at the repository root (`./tsconfig.json`, driving `npm run typecheck`). Verification was run against the actual root tsconfig with the repo's `tsc`; result is clean. No code change resulted.

## Issues Encountered
- The worktree has no `node_modules`; typecheck / prettier / eslint were run using the main checkout's binaries against the worktree's `tsconfig.json` and source. All three pass clean. No symlink was created (nothing to clean up).

## Next Phase Readiness
- `FETCH_CONTEXT` is ready for Plan 02 (`fetch.ts` orchestrator) to import and thread through `notifyWithContext`.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts` exists.
- Commit `4bc6beea` present in git history.

---
*Phase: 81-fetch-verb-info-fetch*
*Completed: 2026-07-14*

---
phase: 60-hook-execution-payload-translators-env-vars
plan: 01
subsystem: bridges
tags: [hooks, claude-code, payload-translation, tool-name-map, typebox, esm, node-test]

requires:
  - phase: 57-schema-component-type-payload-extension-tolerance
    provides: HooksConfig schema + parsed-handler shape consumed by the dispatch path
  - phase: 58-matcher-parser-tool-name-mapping-supportability-gate
    provides: TOOL-01 const map at domain/components/hook-tool-names.ts + BUCKET_A_EVENTS / TOOL_EVENTS closed sets
  - phase: 59-bridge-dispatch-core-debug-seam
    provides: registerHooksBridge + composite handler + dispatchHookExec no-op stub + hookDebugLog seam
provides:
  - mapPiToClaudeToolName helper colocated with TOOL-01 const map (one-way Pi -> Claude tool-name lookup with CustomToolCallEvent passthrough)
  - TranslationContext type + buildTranslationContext factory (sessionId / transcriptPath / cwd snapshot from ExtensionContext, empty-string fallback per D-60-06)
  - 8 bucket-A payload translators at bridges/hooks/payloads/<event>.ts -- hand-authored translate(event, ctx): ClaudeStdin per file (D-60-04)
  - tests/architecture/hooks-translators.test.ts Wave 0 architecture pin (Block A presence, B round-trip x 8, C TOOL-01 x 3, D CustomToolCallEvent passthrough x 3)
affects:
  - 60-02 (exec body fill -- dispatch-exec.ts consumes the 8 translators + TranslationContext to build child stdin)
  - 60-03 (reducer + per-event adapter -- result-side of the same plumbing)
  - 60-04 (lifecycle hardening WR-01 + WR-03)

tech-stack:
  added: []
  patterns:
    - "Hand-authored per-event translators (D-60-04) -- ~30 LoC per event, no schema-driven engine"
    - "Closed-set architecture pin (Wave 0) -- BUCKET_A_EVENTS tuple from domain layer drives dynamic-import sweep of bridges/hooks/payloads/<kebab>.ts"
    - "Bridge-internal modules not re-exported through bridges/hooks/index.ts (D-01 opaque-handle discipline)"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts
    - tests/bridges/hooks/translation-context.test.ts
    - tests/bridges/hooks/payloads/session-start.test.ts
    - tests/bridges/hooks/payloads/user-prompt-submit.test.ts
    - tests/bridges/hooks/payloads/pre-tool-use.test.ts
    - tests/bridges/hooks/payloads/post-tool-use.test.ts
    - tests/bridges/hooks/payloads/post-tool-use-failure.test.ts
    - tests/bridges/hooks/payloads/pre-compact.test.ts
    - tests/bridges/hooks/payloads/post-compact.test.ts
    - tests/bridges/hooks/payloads/session-end.test.ts
    - tests/architecture/hooks-translators.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts (added mapPiToClaudeToolName helper after the const map)
    - tests/architecture/hooks-tool-name-map.test.ts (added Block 4 for the helper)

key-decisions:
  - "Synthesized PreCompact/PostCompact trigger field as 'auto' -- Pi's SessionBeforeCompactEvent / SessionCompactEvent do not expose a trigger source, and 'auto' matches Claude's documented default for context-pressure-driven compaction; documented in source comments"
  - "SessionStart.source receives Pi's reason field verbatim (including Pi-only 'reload' / 'new' / 'fork' arms with no Claude equivalent) -- D-60-04 hand-authored expressivity preferred over synthesizing a fake 'clear'/'compact' value"
  - "PostToolUse / PostToolUseFailure tool_response is populated from event.content -- Pi's ToolResultEvent stores the tool's output array in content, not output"

patterns-established:
  - "Per-event translator file -- imports per-event Pi type from platform/pi-api.ts, imports TranslationContext from ../translation-context.ts, optionally imports mapPiToClaudeToolName for tool events, exports `interface <Event>Stdin` + `function translate(event, ctx): <Event>Stdin`. JSDoc header anchors PAYL-01, TOOL-01 (when applicable), D-60-04, Pitfall 1 equivalent."
  - "Wave 0 architecture pin -- dynamic-import of every translator keyed by BUCKET_A_EVENTS closed set; round-trip JSON fixture per event; TOOL-01 application gate + CustomToolCallEvent passthrough gate per tool event."

requirements-completed: [PAYL-01]

duration: ~45min
completed: 2026-06-14
---

# Phase 60 Plan 01: Translator + Tool-Name Helper Foundation Summary

**8 hand-authored Pi -> Claude payload translators under `bridges/hooks/payloads/`, the `mapPiToClaudeToolName` TOOL-01 reuse helper colocated with the const map, and a `TranslationContext` factory ready for the Plan 60-02 exec body to consume.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-14T17:30:00Z (approx)
- **Completed:** 2026-06-14T18:15:44Z
- **Tasks:** 3
- **Files modified:** 21 (19 created + 2 modified)

## Accomplishments

- `mapPiToClaudeToolName(name)` helper at `domain/components/hook-tool-names.ts` -- one-way Pi -> Claude lookup with CustomToolCallEvent (`mcp__server__tool`) passthrough via `??` fallback. Single tested call site for the three tool-event translators.
- `TranslationContext` interface + `buildTranslationContext(ctx)` factory at `bridges/hooks/translation-context.ts` -- snapshots `sessionId` / `transcriptPath` / `cwd` from Pi's `ExtensionContext`; `transcriptPath` defaults to empty string when `getSessionFile()` returns undefined (D-60-06 / Pitfall 7).
- 8 `translate(event, ctx): ClaudeStdin` translators -- `session-start`, `user-prompt-submit`, `pre-tool-use`, `post-tool-use`, `post-tool-use-failure`, `pre-compact`, `post-compact`, `session-end`. The three tool-event translators route `event.toolName` through `mapPiToClaudeToolName` for TOOL-01 reuse.
- 8 per-event unit tests under `tests/bridges/hooks/payloads/` -- byte-equal JSON fixtures for the happy path + CustomToolCallEvent passthrough + TOOL-01 capitalization (where applicable).
- Wave 0 architecture pin `tests/architecture/hooks-translators.test.ts` -- four blocks (A presence, B round-trip x 8, C TOOL-01 x 3, D passthrough x 3) green.
- `npm test` GREEN: 1999/1999.

## Task Commits

1. **Task 1: Add `mapPiToClaudeToolName` helper and define `TranslationContext` foundation** -- `cc395d9` (feat)
2. **Task 2: Implement 8 bucket-A payload translators with per-event fixtures** -- `974e4d6` (feat)
3. **Task 3: Wave 0 architecture-test scaffold pinning PAYL-01 + D-60-04 round-trip invariant** -- `6b7dd7f` (test)

## Files Created/Modified

### Created

- `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` -- `TranslationContext` interface + `buildTranslationContext` factory.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts` -- `translate(SessionStartEvent, ctx): SessionStartStdin`; Pi `reason` -> Claude `source`.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts` -- `translate(InputEvent, ctx): UserPromptSubmitStdin`; Pi `text` -> Claude `prompt`.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts` -- `translate(ToolCallEvent, ctx): PreToolUseStdin`; TOOL-01 capitalization + `tool_input` from `event.input`.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts` -- `translate(ToolResultEvent, ctx): PostToolUseStdin`; TOOL-01 capitalization + `tool_input` from `event.input` + `tool_response` from `event.content`.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts` -- `translate(ToolResultEvent, ctx): PostToolUseFailureStdin`; same field map as PostToolUse, propagates errored content payload.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts` -- `translate(SessionBeforeCompactEvent, ctx): PreCompactStdin`; synthesizes `trigger: "auto"`.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts` -- `translate(SessionCompactEvent, ctx): PostCompactStdin`; synthesizes `trigger: "auto"`.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts` -- `translate(SessionShutdownEvent, ctx): SessionEndStdin`; Pi `reason` -> Claude `reason`.
- `tests/bridges/hooks/translation-context.test.ts` -- two blocks: happy-path snapshot, empty-string fallback.
- `tests/bridges/hooks/payloads/{session-start,user-prompt-submit,pre-tool-use,post-tool-use,post-tool-use-failure,pre-compact,post-compact,session-end}.test.ts` -- 8 per-event unit tests.
- `tests/architecture/hooks-translators.test.ts` -- Wave 0 architecture pin (4 blocks).

### Modified

- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` -- appended `mapPiToClaudeToolName(name: string): string` helper after `CLAUDE_TO_PI_TOOL_NAMES`. Existing const map untouched.
- `tests/architecture/hooks-tool-name-map.test.ts` -- imported `mapPiToClaudeToolName`; added Block 4 (helper unit tests: 7-mapping sweep, CustomToolCallEvent passthrough, already-Claude-form passthrough).

## Decisions Made

- **PreCompact / PostCompact `trigger` field synthesized as `"auto"`** -- Pi's `SessionBeforeCompactEvent` / `SessionCompactEvent` do not expose a trigger source; `"auto"` matches Claude's documented default for context-pressure-driven compaction and is the only Pi-initiated path observed today. A future `/compact` shell-out arm would flip the value to `"manual"` as a requirements-tracked amendment.
- **SessionStart `source` propagates Pi `reason` verbatim** -- including Pi-only arms (`"reload"`, `"new"`, `"fork"`) that have no direct Claude equivalent. D-60-04 hand-authored expressivity preferred over synthesizing a fake `"clear"`/`"compact"` value.
- **PostToolUse / PostToolUseFailure `tool_response` populated from `event.content`** (not a hypothetical `event.output`) -- Pi's `ToolResultEvent` stores the tool's output payload in `content: (TextContent|ImageContent)[]`.

## Pi-field -> Claude-field traceability table

| Event | Pi event type | Pi source field | Claude target field | Notes |
| --- | --- | --- | --- | --- |
| SessionStart | `SessionStartEvent` | `event.reason` | `source` | Verbatim; Pi `"reload"`/`"new"`/`"fork"` pass through |
| UserPromptSubmit | `InputEvent` | `event.text` | `prompt` | Verbatim |
| PreToolUse | `ToolCallEvent` | `event.toolName` | `tool_name` | Via `mapPiToClaudeToolName` (TOOL-01) |
| PreToolUse | `ToolCallEvent` | `event.input` | `tool_input` | Verbatim |
| PostToolUse | `ToolResultEvent` (isError=false) | `event.toolName` | `tool_name` | Via `mapPiToClaudeToolName` |
| PostToolUse | `ToolResultEvent` | `event.input` | `tool_input` | Verbatim |
| PostToolUse | `ToolResultEvent` | `event.content` | `tool_response` | The output content array |
| PostToolUseFailure | `ToolResultEvent` (isError=true) | (same as PostToolUse) | (same as PostToolUse) | Same shape; isError-routed at the dispatcher |
| PreCompact | `SessionBeforeCompactEvent` | -- | `trigger: "auto"` | Synthesized; Pi has no trigger source |
| PostCompact | `SessionCompactEvent` | -- | `trigger: "auto"` | Synthesized; Pi has no trigger source |
| SessionEnd | `SessionShutdownEvent` | `event.reason` | `reason` | Verbatim |

Every translator additionally populates the common envelope (`session_id`, `transcript_path`, `cwd`, `hook_event_name`) from the supplied `TranslationContext` (`session_id <- ctx.sessionId`, `transcript_path <- ctx.transcriptPath`, `cwd <- ctx.cwd`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] eslint `import-x/order` violations on Task 2 + Task 3 test files**

- **Found during:** Task 2 (pre-commit pre-commit re-run after initial Write of the 8 translators + 8 tests + 1 architecture test) and Task 1 (single re-order on `translation-context.test.ts`).
- **Issue:** ESLint flat-config `import-x/order` requires (a) at most one blank line within an import group and (b) at least one blank line between groups. The initial Writes interleaved `import` and `import type` between bridge-internal and platform paths in an order eslint did not accept; the translator source files additionally had a blank line between the helper import and the per-event Pi type import that violated the "no blank within group" rule.
- **Fix:** `npx eslint --fix` for the translator source files + test files; pre-commit re-run green. No functional changes (the fix is import-group ordering / blank-line-only).
- **Files modified:** All 8 translator source files + all 8 per-event test files + `tests/bridges/hooks/translation-context.test.ts`.
- **Verification:** `pre-commit run --files ...` green; `node --test` green (18 unit tests + 4 architecture-test blocks + the 8 helper / translation-context tests).
- **Committed in:** `974e4d6` (Task 2 commit -- the fixes landed atomically with the Task 2 surface, and the one Task 1 re-order was bundled into `cc395d9`).

---

**Total deviations:** 1 auto-fixed (1 blocking / mechanical lint fix-up).
**Impact on plan:** Lint-only mechanical churn; no scope creep.

## Issues Encountered

None significant. The pattern-driven test scaffolding picked up promptly from the Phase 58 / 59 baseline (per-block layout, closed-set tuple, ESLint flat-config conventions).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` exists -- FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` exists -- FOUND
- All 8 translator files exist at `extensions/pi-claude-marketplace/bridges/hooks/payloads/` -- FOUND
- All 8 per-event test files exist at `tests/bridges/hooks/payloads/` -- FOUND
- `tests/bridges/hooks/translation-context.test.ts` exists -- FOUND
- `tests/architecture/hooks-translators.test.ts` exists -- FOUND
- Task 1 commit `cc395d9` -- FOUND in git log
- Task 2 commit `974e4d6` -- FOUND in git log
- Task 3 commit `6b7dd7f` -- FOUND in git log
- `npm test` -- 1999/1999 GREEN
- `npx tsc --noEmit -p tsconfig.json` -- exit 0
- Comment policy gate -- no `Phase N` / `Plan N` / `Pitfall N` / `Pattern N` offenders in any of the new/modified source files

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Plan 60-02 (`dispatchHookExec` body fill: spawn + payload translation + env-var construction + timeout/grace/SIGKILL + wire-protocol-to-HookExecResult parsing) can now:

1. Import any of the 8 translators from `bridges/hooks/payloads/<event>.ts` and call `translate(event, ctx)` to get a Claude-shaped `Stdin` object.
2. Call `buildTranslationContext(ctx)` once per `dispatchHookExec` invocation to obtain the `TranslationContext`.
3. Rely on the `tests/architecture/hooks-translators.test.ts` Wave 0 architecture pin to catch translator-side regressions throughout Plan 60-02 / 60-03 iteration.

No blockers. The translator-side contract is frozen for the rest of Phase 60.

---
*Phase: 60-hook-execution-payload-translators-env-vars*
*Completed: 2026-06-14*

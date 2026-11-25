---
phase: quick-261123-jdc
verified: 2026-11-23T16:00:00Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - ".planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-PLAN.md"
  - ".planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-SUMMARY.md"
  - "docs/hooks-compatibility.md"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts"
  - "extensions/pi-claude-marketplace/index.ts"
  - "features/hook/session.feature"
covered_digest: "v4:sha256:2e2b230499018d20cba12e02adf2ed0f585240ca714db5945617ca909ce98985"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261123-jdc (HOOKLATESS-01): Verification Report

**Goal:** In print, json and rpc mode, a plugin that the load's autoapply activates runs its
SessionStart hooks in the same session (Claude Code 2.1.330 headless parity). Nothing runs in tui, on
reload, after a command install, in a new session, or in a pi-subagents child. The first prompt waits
at most 10 s. Pi's `nextTurn` is the one recorded gap.
**Verified:** 2026-11-23, HEAD 68ddb79, branch claude/stoic-shannon-la9q7o
**Re-verification:** No (initial)

The orchestrator is running the full gate (`npm run check`, cucumber, coverage) on 68ddb79 elsewhere.
This report did not run them. It relies on the executor's evidence logs for those, and on a fresh run of
the five named unit files.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The late run fires only in print, json and rpc. It covers only plugins that gained a SessionStart route since the session's own dispatch (the autoapply activations). It sends the session's first source. | VERIFIED | `event-router.ts` `LATE_SESSION_START_MODES = new Set(["print","json","rpc"])`. `lateSessionStartRun` takes `ledger.takeLateRun(bucket)` first, then returns unless `late !== undefined && reason === "startup" && mode in set` (mode read last). `late-session-start.ts:59-67` computes `plugins` as bucket minus `taken.seen`, keyed `<plugin>@<marketplace>`, with `taken.source`. `recordDispatch` runs inside the session_start dispatch block, and only for `startup`, `resume` and `fork`. `dispatch.ts` `entryFires` calls `sessionStartRunsPlugin`. Router rows pass for print, json and rpc, and for a resumed launch (source `resume`). The scenario at `features/hook/session.feature:584` is green: 14/14 steps. |
| 2 | No late run in tui, on `/reload`, after a command install, in a new session, or in a pi-subagents child. | VERIFIED | tui: the mode set excludes it (router row "a tui load runs no late SessionStart"). `/reload`: the `session_start` reload branch returns before `recordDispatch`, and `reason !== "startup"` returns (rows "a reload runs none", "a second load runs none"). Command install: the only call site is `index.ts` `prepareResources`, the `resources_discover` handler, and the ledger is taken at the first load. New session: source `clear` is not in `START_SOURCES`, so nothing is recorded (row "a load after a new session runs none"). Child: `dispatchesInCurrentSession("SessionStart")` is false (`CHILD_EVENT_POLICY.SessionStart = "SubagentStart"`), so nothing is recorded (row "a load in a pi-subagents child runs none"). Pi 1.5.1 passes reason `startup` to `resources_discover` for every non-reload `session_start` (`agent-session.js:2778`), which the new-session row covers. |
| 3 | The first prompt waits at most 10 s. A run that passes 10 s sends its context with `deliverAs: "nextTurn"`. | VERIFIED | `LATE_SESSION_START_WAIT_MS = 10_000`. `settlesWithin` races the run against a timer and clears it in `finally`. `wentAhead = !(await settlesWithin(...))`, and the event's `heldForNextPrompt: () => wentAhead`. `event-adapters.ts` `sendSessionStartContext` passes `nextTurn: start.event.heldForNextPrompt?.() === true`. `contextDelivery` returns `{deliverAs:"nextTurn"}` for it. Fake-timer router rows: a run within 10 s gives hint `false`, and a run past `tick(10_000)` gives the load ended with the hook still running and hint `true`. The adapter row checks `nextTurn` delivery. |
| 4 | NFR-2: no throw escapes a Pi event. The detached run has its own catch. | VERIFIED | The whole body of `lateSessionStartRun` is inside `try/catch`, which logs `late SessionStart skipped: ...`. `run = sessionStartHandler(event, ctx).catch(...)` logs `late SessionStart failed: ...`, so the detached promise never rejects after the race. `sendHookContextMessage` keeps its sync try/catch for the later `sendMessage`. Rows: the unsupported-mode `web` row gives the `skipped` line, and the hook-failure row gives the `failed` line with the load ending. `index.ts` calls it as the last statement of `prepareResources`, inside the handler's own guard. |
| 5 | The `pi.on` count is still 15. | VERIFIED | `grep -c 'pi\.on('` in `event-router.ts` gives 15. The diff adds no `pi.on`. The late run is returned as a `HooksBridge` handle from `registerHooksBridge`. |
| 6 | HOOKLATESS-D1 records exactly one Pi capability gap and no open divergence. | VERIFIED | `.planning/PROJECT.md:2543`: the one gap is "Pi keeps a next-turn message in memory only (`core/agent-session.js:1956-1958`) ... a held context is lost when Pi ends before that prompt". I confirmed it at `agent-session.js:1946-1984` (`_pendingNextTurnMessages.push`, in memory). The row says upstream parity, D-CF5-03 stays, and Locked. It names no divergence. The "Residual" (a project scope whose hook read failed at session start and works at the load counts as activated) is an edge of the route-diff rule. It matches upstream's "plugin loaded after the session started" semantics, so it is not a divergence. |
| 7 | Nothing else in `docs/hooks-compatibility.md` contradicts the change (D-CF5-03, reload paragraphs). | VERIFIED | The section "Plugins that a load activates" is at line 145, before `### Compaction`. The `/reload` table row (135) and the new line 157 both say no hook runs on reload (D-CF5-03). The child table (line 41, SessionStart "does not run") agrees with new line 160. The new-session row (130) and new line 159 agree (`clear`). The line-474 context-delivery row says startup context goes in "as soon as the hooks finish ... before your first prompt". That holds for a late run within 10 s, and the 10 s / next-prompt case is in the new section. The D-CF5-03 row in PROJECT.md is unchanged and still true. `grep` found no doc text that says a plugin activated by autoapply gets no SessionStart. |
| 8 | Proof discipline: the scenario failed before the fix, breaks B1-B3 fail it on the bound commit, and coverage, static and the neighbouring features pass (per the executor's logs). | VERIFIED (logs) | R0 `1 scenario (1 failed)`, failing `Then ... runs.steps.ts:164`, `RED-PROOFS OK`. B1, B2, B3 each fail the same `Then`, with `restored=clean`. `green-adapter.log` and `bound-adapter.log`: 1 scenario passed, 14/14 steps. `bound-coverage.log`: 100% branches, functions and lines for the six sources. `bound-check-static.log`: `exit=0`. `hook-adapter.log`: 316 scenarios pass. `autoapply-adapter.log`: 56 scenarios pass. Fresh unit run here: late-session-start 14/14, dispatch 304/304, event-router 301/301, event-adapters 156/156, payloads/session-start 26/26, with 0 failures. |

**Score:** 8/8 truths verified. No behavior-dependent truth was left unverified. Each behavior truth has a passing named test
or scenario.

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `bridges/hooks/late-session-start.ts` | VERIFIED | 82 lines. Exports `LateSessionStart`, `LateSessionStartLedger`, `createLateSessionStartLedger` and `sessionStartRunsPlugin`. The ledger is imported by the router and the filter by dispatch, so both are wired. |
| `test/bridges/hooks/late-session-start.test.ts` | VERIFIED | 14 cases pass. |
| `bridges/hooks/event-router.ts` | VERIFIED | Contains `LATE_SESSION_START_WAIT_MS`, `settlesWithin`, `lateSessionStartRun`, `HooksBridge`, and the `recordDispatch` call. |
| `bridges/hooks/event-adapters.ts` | VERIFIED | `contextDelivery` and `nextTurn`. |
| `features/hook/session.feature:584` | VERIFIED | The scenario is at line 584. It uses existing steps, carries no MCP tag, and the builtin profile selects none of the file's scenarios (executor log). |
| `docs/hooks-compatibility.md:145` | VERIFIED | The heading `### Plugins that a load activates` is present. |
| `.planning/PROJECT.md` HOOKLATESS-D1 | VERIFIED | Row at line 2543, Locked. |

## Key Link Verification

| From | To | Status |
|------|----|--------|
| `index.ts` `prepareResources` | `hooksBridge.runLateSessionStart(event.reason, ctx)`, the last statement | WIRED |
| `event-router.ts` session_start callback | `lateSessionStart.recordDispatch(source, routingState.getRoutingBucket("SessionStart"))` | WIRED |
| `event-router.ts` late run | `sessionStartHandler(event, ctx).catch(...)`, then `settlesWithin` | WIRED |
| `dispatch.ts` `entryFires` | `sessionStartRunsPlugin(view.event, entry)` | WIRED |
| `event-router.ts` event `heldForNextPrompt` | `event-adapters.ts` `start.event.heldForNextPrompt?.()` | WIRED |

## Anti-Patterns

None found in the changed source. There are no TODO, FIXME or XXX markers. There are no stubs.

## Findings

No BLOCKER and no WARNING.

- INFO. The scenario has 14 steps. The plan text said 11, which was a miscount in the plan. The logs agree with the 14.
- INFO. The plan said "uses the session's first source". The ledger keeps the latest `startup`, `resume` or `fork`
  dispatch. One runtime has only one such dispatch, so the two are the same in practice.
- INFO. The docs table row at line 474 does not mention the next-prompt hold. The new section does, and
  it is not a contradiction.

## Human Verification Required

None.

## Gaps Summary

No gaps. The late run, its gating (mode, reason, ledger, child), the 10 s bound and `nextTurn` delivery, the
NFR-2 catches, the 15 `pi.on` sites, the single Pi gap in HOOKLATESS-D1, and the docs all match the plan
and the upstream parity requirement. The full `npm run check` on 68ddb79 remains the orchestrator's
verdict. This verification did not re-run it.

---

_Verified: 2026-11-23_
_Verifier: Claude (gsd-verifier)_

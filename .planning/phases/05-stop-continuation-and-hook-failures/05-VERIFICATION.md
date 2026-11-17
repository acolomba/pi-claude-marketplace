---
phase: 05-stop-continuation-and-hook-failures
verified: 2026-11-16T06:58:01Z
status: human_needed
score: 55/56 must-haves verified (51 VERIFIED, 4 PASSED (override); 1 uncertain, CI item)
covered_files: [".planning/phases/05-stop-continuation-and-hook-failures/05-01-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-01-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-02-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-02-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-03-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-03-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-04-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-04-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-05-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-05-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-06-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-06-SUMMARY.md","CHANGELOG.md","docs/hooks-compatibility.md","docs/output-catalog.md","docs/research/claude-hooks-vs-pi-events.md","docs/research/issue-103-stop-stopfailure-promotion.md","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts","extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts","extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts","extensions/pi-claude-marketplace/bridges/hooks/timeout.ts","extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts","extensions/pi-claude-marketplace/domain/components/hook-events.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","extensions/pi-claude-marketplace/shared/atomic-json.ts","extensions/pi-claude-marketplace/shared/notification-run.ts","features/hook/additional-context.feature","features/hook/async.feature","features/hook/failures.feature","features/hook/messages.feature","features/hook/prompt-and-stop.feature","features/lib/boundary-continuer.ts","features/lib/boundary-refuser.ts","features/lib/hook-files.ts","features/lib/hook-recorder.ts","features/lib/run-start-probe.ts","features/plugin/subagent-child.feature","features/step_definitions/hook/additional-context.steps.ts","features/step_definitions/hook/async.steps.ts","features/step_definitions/hook/messages.steps.ts","features/step_definitions/hook/prompt-and-stop.steps.ts","features/step_definitions/plugin/subagent-hooks.steps.ts","features/support/world.ts","test/architecture/closed-set-enrollment.test.ts","test/architecture/hooks-lifecycle.test.ts","test/architecture/hooks-notice-notify.test.ts","test/bridges/hooks/async-rewake/async-answer.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/context-cap.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/dispatch.test.ts","test/bridges/hooks/event-adapters.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/exec-result.test.ts","test/bridges/hooks/exec-timer.test.ts","test/bridges/hooks/hook-labels.test.ts","test/bridges/hooks/hook-output-files.test.ts","test/bridges/hooks/on-failure.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/settle.test.ts","test/bridges/hooks/stream-text.test.ts","test/bridges/hooks/wire-protocol.test.ts","test/e2e/_rpc.ts","test/index.test.ts","test/live-uat/README.md","test/live-uat/manifest-absence-canary.mjs","test/live-uat/openai-stub-server.mjs","test/pi-runtime.ts","test/platform/pi-api.test.ts","test/shared/atomic-json.test.ts"]
covered_digest: "v4:sha256:c66e12bdb34bd7c01a64802393f3d6fc54c33f8642e0f01833c46aa93d6ef604"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "a reload still stops a plain async hook that is running"
    reason: "Met on Linux, where the orphan reap can prove a live process is the hook (D-62-05). On macOS and Windows a reload never stopped a live async hook process (the reap is Linux-only, async-rewake/registry.ts:886-891), and D-PG5-18 accepts that a plain async hook that never ends has no bound there. The compatibility page states this residual (docs/hooks-compatibility.md:350,351,557; 6580f5f8). Re-checked 2026-11-16: unchanged. Also carries the 05-05 truth that a /reload, the next start, and a child shutdown still stop a running plain async hook."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-14T18:55:15Z"
  - must_have: "The hooks bridge registers 13 `pi.on` call sites, with `agent_before_settle` between `agent_end` and `agent_settled`; a pi-subagents child registers it and runs no `Stop` hook"
    reason: "Superseded in its count by decision D-PG6-18 (PROJECT.md:2409, Phase 6, confirmed by the maintainer review 2026-11-16): the UserPromptExpansion dispatch is a second `input` handler registered directly after the UserPromptSubmit one, so the bridge now has 14 `pi.on` call sites (event-router.ts:1444-1650; test/architecture/hooks-lifecycle.test.ts:386-403 pins the 14-entry order). The rest holds: `agent_before_settle` sits between `agent_end` and `agent_settled` (event-router.ts:1615-1640), and a pi-subagents child registers it and runs no Stop hook (`dispatchesInCurrentSession(\"Stop\")`, :1624; :188-190; features/plugin/subagent-child.feature:247)."
    accepted_by: "project decision D-PG6-18 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T06:58:01Z"
  - must_have: "`Stop` runs on `agent_before_settle` in `tui`, `print`, `json`, and `rpc` through one handler, with no `ctx.mode` branch and no `agent_settled` fallback path"
    reason: "The bridge side holds in code: one registration (event-router.ts:1619-1626), `requireNotificationMode` admits all four modes (shared/notification-run.ts:13-19), no `ctx.mode` comparison exists in settle.ts or event-router.ts, and `agent_settled` runs no Stop (settle.ts:311-312). That Pi raises the event and honors `continue: true` the same way in json and print mode was measured once in research (05-RESEARCH.md M2, M3, M6) and is recorded by decisions D-PG5-01/D-PG5-02 (PROJECT.md:2396, outcome Good), which name the missing committed check as the residual BACKLOG STOPMODECHECK-01 (BACKLOG.md:5373). The committed scenarios drive rpc and the terminal only."
    accepted_by: "project decision D-PG5-01/D-PG5-02 (PROJECT.md decision log, outcome Good; residual BACKLOG STOPMODECHECK-01)"
    accepted_at: "2026-11-16T06:58:01Z"
re_verification:
  previous_status: passed
  previous_score: 6/6 (1 override)
  reason: "staleness: Phases 6-11, the gaps-agents/gaps-mcp merges and later fixes changed 37 of the 69 covered non-planning files after the previous report (c7370035, 2026-11-14T18:59:02Z)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  status_correction: "The previous report set `passed` while its body listed three human items (the judgment-tier prohibition, json/print Stop continuation, A9 on Node 24). Step 9 allows `passed` only with no human items. This pass carries json/print by an override under D-PG5-01/D-PG5-02 (residual STOPMODECHECK-01). The other two remain open, so the status is `human_needed`. Nothing regressed."
  score_correction: "The previous score counted the five roadmap criteria and one 05-06 doc truth. This pass checks all 51 plan truths as well, so the denominator is 56."
human_verification:
  - test: "Read docs/hooks-compatibility.md:472-476 and CHANGELOG.md:23 (05-06 judgment-tier prohibition: hook output is not kept in files without telling the user)."
    expected: "A user learns that over-limit hook output is saved, the folder in each scope, that the project-scope folder lies inside the project directory (with the version-control note), and that files older than 30 days are removed."
    why_human: "Judgment-tier prohibition. The verifier's non-authoritative verdict is that it holds (unverified-prohibition, human review recommended)."
    status: resolved
    resolution: "passed: the maintainer reviewed it on 2026-11-16 and asked for a CHANGELOG clause, which 594ea843 added (CHANGELOG.md:23-24: files older than 30 days are removed; a project plugin's folder is inside the project under `.pi/`, with the version-control note)."
  - test: "Run CI on Node 24 (the PR's `behavioral` job) and check features/hook/failures.feature:157 \"A prompt hook that cannot start lets the prompt through and shows its error\" (research assumption A9)."
    expected: "The scenario passes on Node 24: the notice reads `... Error occurred while executing hook command: spawn missing-guard.sh ENOENT`."
    why_human: "Gate G ran on Node 26.13.1. This pass measured the spawn ENOENT message on Node 22.22.2 and 26.13.1 (both `spawn <path> ENOENT`). No Node 24 is installed here, and features/gaps has no PR, so no CI run has covered it."
---

# Phase 5: Stop Continuation and Hook Failures Verification Report

**Phase Goal:** A `Stop` hook that blocks continues the same run, as in Claude Code. A hook that fails, names a missing script, returns too much context, or runs in the background behaves as it does there.
**Verified:** 2026-11-16T06:58:01Z
**Status:** human_needed. The code meets every roadmap criterion. One item waits for CI: the Node 24 wording of a spawn `ENOENT` (A9). The judgment-tier prohibition passed at the maintainer review of 2026-11-16. Four truths pass by override: one existing orchestrator override and three new decision overrides (D-PG6-18, D-PG5-01/02). The maintainer review of 2026-11-16 accepted all four.
**Re-verification:** Yes. The previous report (passed, 6/6, one override, 2026-11-14T18:55:15Z) became stale, because later work changed 37 of its 69 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `cb5ee48c`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its caller, and the test or scenario that exercises it were read again. Citations are current line numbers. **H/** means `extensions/pi-claude-marketplace/bridges/hooks/`.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). Then the unpaired and integration tests passed, with pi-subagents 0.88.1, pi-mcp-adapter 7.0.1 and pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387). Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD, including the five phase features (`prompt-and-stop`, `failures`, `messages`, `additional-context`, `async`) and `features/plugin/subagent-child.feature`. The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** 13 named single tests, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. Each reported `tests 1, pass 1, fail 0`. One probe measured the spawn `ENOENT` message on the two local Node lines. `query verify.artifacts` and `query verify.key-links` ran for all six plans.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 5 must-haves |
| --- | --- | --- |
| D-PG6-18 (Phase 6, confirmed by the maintainer review 2026-11-16) | A second `input` handler, for `UserPromptExpansion`, registers directly after the `UserPromptSubmit` one. The bridge now has 14 `pi.on` call sites (H/event-router.ts:1444-1650). | The 05-01 count of 13 is out of date. An override carries it. The order that matters still holds: `agent_end`, `agent_before_settle`, `agent_settled` (:1615-1640), pinned by test/architecture/hooks-lifecycle.test.ts:386-403. |
| D-PG6-19/20/21 (Phase 6, confirmed by the maintainer review 2026-11-16) | `UserPromptExpansion` became an admitted event. It shows failure notices (H/dispatch.ts:671-687) and `Operation stopped by hook[: <reason>]` on `continue: false`. | This extends the 05-02 and 05-03 event lists and changes none of their arms. The missing-script rule still covers only `Stop` and `UserPromptSubmit` (H/wire-protocol.ts:59), so a `UserPromptExpansion` exit 2 still blocks (docs/hooks-compatibility.md:212). That keeps the 05-03 truth "no other event gets the rule". |
| D-PG6-06 (Phase 6) | `agent_end` also drops the tool-call marks of calls that never reached a result (H/settle.ts:151). | This is additive. The cache and held-reason logic of 05-01 and 05-03 is unchanged (:152-158). |
| D-PG10-08/10 (Phase 10) | A hook that names a plugin option with no value fails with Claude Code's message, through the same failure notice. | Additive scenarios at failures.feature:184 and :211. The 05-02 notice forms are unchanged. |
| Review fix IN-04 (in-phase, da55855a, before the previous report) | The runtime's `claimStartFailureNotice` became `startFailureNoticeShown(key)` and `recordStartFailureNotice(key)`. The key is recorded only after the notice shows (H/dispatch.ts:767-779). | `verify.artifacts` and `verify.key-links` for 05-02 report the literal `claimStartFailureNotice` as missing. The truth still holds under the new names: one notice per load per event and resolved command, the set lives in the runtime (H/runtime.ts:340, 501-507), and a bridge load empties it (:364). This is a pattern miss, not a stub. It is a review finding, not a decision, so no override was added. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| SC1 | A run that a `Stop` hook blocks twice raises one `agent_settled` event and shows no second run start. An always-blocking hook still makes eight re-entries before the limit notice (PG-HOOK-02). | ✓ VERIFIED | **Code:** the Stop bucket runs on `agent_before_settle` (H/event-router.ts:1619-1626 -> H/settle.ts:183-226). The handler returns `{ entries: [...event.entries, stopBlockDraft(continuation)], continue: true }` (:218-220). The draft is a hidden `custom_message` of type `claude-hook-stop-block` (:75, :249-257). The handler never returns `continue: false`. `agent_settled` runs no Stop for a `stop` ending (:311-312) and keeps StopFailure (:314-325). No Stop path calls `pi.sendMessage` (the only mention is the comment at :562). The cap is `STOP_OVERRIDE_CAP = 8` (H/runtime.ts:27), applied through `recordStopReentry` (:489-500) and `continuesBounded` (H/settle.ts:629-645). **Scenarios (in G):** prompt-and-stop.feature:39 gives counts `run starts 1, model calls 3` (:72-74). The step header explains why three model calls in a turn that ends at its first `agent_settled` prove one settlement (prompt-and-stop.steps.ts:21-28). Run starts come from the `before_agent_start` probe (features/lib/run-start-probe.ts; loaded at steps :205-208). prompt-and-stop.feature:130 shows nine replies, `stop hook active` true from the second, cap notice count 1 (:165), and counts `1 / 9` (:166-168). **Named tests:** S1, S2. |
| SC2 | A `Stop` hook that names a missing script lets the run end and shows one failure notice. A prompt hook that names a missing script does not block the prompt (PG-HOOK-23). | ✓ VERIFIED | **Code:** H/wire-protocol.ts:59-68 matches only `Stop` and `UserPromptSubmit`, with blank stdout and stderr matching `/no such file\|can't open/i`. `exitTwoResult` returns a `noop` that carries a `missing-script` failure (:146-150). The notice text is built in H/hook-labels.ts:208-214 and :226-229. **Scenarios (in G):** failures.feature:86 (Stop) gives one model call and exactly one notice. failures.feature:60 (UserPromptSubmit) shows that the prompt reaches the model, with one notice. The `the hooks show the user these messages` step compares the whole notice list (messages.steps.ts:96-104). The Outline at failures.feature:7 keeps `onFailure: block` blocking. **Named tests:** S5, S6. |
| SC3 | A hook that exits 1 with `boom` on stderr shows one notice that holds `boom`. A `UserPromptSubmit` `continue: false` with a `stopReason` shows that reason (PG-HOOK-14). | ✓ VERIFIED | **Code:** `nonZeroExitResult` returns a noop with an `exit` failure (H/wire-protocol.ts:171-184). `failureNotices` builds one notice per hook and folds edit-pair duplicates (H/dispatch.ts:731-760). `failureLine` keeps the first non-blank line and cuts it at 200 characters (H/hook-labels.ts:174-179). The UserPromptSubmit stop arm shows `promptStoppedText` and returns `handled` (H/event-adapters.ts:731-739; H/hook-labels.ts:249-253). **Scenarios (in G):** failures.feature:34 shows exactly `UserPromptSubmit hook error: Failed with non-blocking status code: boom`, and the prompt still reaches the model. messages.feature:245 shows `Operation stopped by hook: not now`. |
| SC4 | A hook that prints 12,000 characters of context sends at most 10,000 to the model (PG-HOOK-14). | ✓ VERIFIED | **Code:** `capHookContext` (H/context-cap.ts:79-95) passes a string of 10,000 or fewer units unchanged. A longer string is saved through the injected writer and replaced by the `<persisted-output>` wrapper (:52-62). If the write fails, the fallback is cut to 10,000 (:66-73). The synchronous lane calls it in `withCappedContext` (H/dispatch-exec.ts:280-296), and the plain-async answer lane in `sendAsyncAnswer` (H/async-rewake/registry.ts:723-726). **Scenario (in G):** additional-context.feature:120 checks size `11.7KB`, a 2000-character preview, 12000 saved characters, and a path under `_shared/hook-output/`. The step asserts that the file starts with the preview and that `wrapper.length <= 10000` (additional-context.steps.ts:78-79). **Named tests:** S7, S8. |
| SC5 | A plain `async` hook with `timeout: 1` that sleeps 3 seconds writes its end marker, and a reload still stops a plain `async` hook that is running (PG-HOOK-21). | ✓ VERIFIED (timeout clause); PASSED (override) (reload clause outside Linux) | **Code:** `laneOf` picks `rewake` only for `asyncRewake: true` (H/async-rewake/registry.ts:203-205). For the plain lane, `ladderFor` returns `INERT_TIMER_LADDER` and debug-logs the ignored `timeout` (:254-264). The rewake lane keeps `installTimerLadder` (:266-275). The ladder is chosen before the spawn (:381). The inert ladder never fires (H/exec-timer.ts:118-121). **Scenarios (in G):** async.feature:261 expects `slow \| end \| 3`; the hook reaches its own `exit 3` only when nothing kills it during `sleep 3`. async.feature:432 shows no hook process running after a terminal `/reload`. async.feature:470 shows that a background hook that ignores SIGTERM still stops at its timeout. **Named test:** S9. **Reload clause:** the stop goes through the orphan reap, which kills a live process only on Linux (registry.ts:886-891). The existing D-PG5-18 override carries macOS and Windows. |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truths | Status | Current evidence |
|------|--------|--------|----------|
| 05-01 | 12 (two-block count; four modes, one handler; draft shape, never `continue: false`, no `sendMessage`; stop-only cache read, StopFailure once at settle; cap of eight and its resets, `stop_hook_active`, env var not read; `continue: false` returns nothing; rewake mark inside the boundary; rewake scenario before and after the move; no imitated run start; 13 `pi.on` sites; child main-session scenario under both profiles; no red commit) | ✓ 10/12 VERIFIED, 2 PASSED (override) | Two-block count and cap: SC1. Four modes: the bridge side holds in code, and the D-PG5-01/02 override carries the json and print residual (STOPMODECHECK-01). Draft shape: one `Stop hook feedback:` part per value in routing order and `details.pluginId` (H/settle.ts:249-257, `stopFeedback` at :539). Stop-only read: `takeStopEnding` (H/runtime.ts:451-458) returns only a `stop` ending, so `length`/`error` stay cached for `agent_settled` (H/settle.ts:314-325); S3, S12. Cap resets: tool call and stop non-reentry (`finishStopSequence`, H/runtime.ts:509-511), user input (:536-539), bridge load (`prepareSettleForRegistration`, :358-367); S4, S13. `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` appears nowhere under `extensions/`. `continue: false`: `holdStopReason` plus `recordStopNonReentry`, returns `undefined` (H/settle.ts:524-532). Rewake mark: `recordRewakeSent` sets the mark only while the boundary is open (H/runtime.ts:479-483), called after the wake send (H/async-rewake/registry.ts:790), and the boundary is opened and closed around the bucket (H/settle.ts:231-243). Rewake scenario: async.feature:325 passes in G. Its run on the pre-move tree is a historical record (05-01-SUMMARY) that cannot be re-run here; it adds nothing the current tree needs. No imitated run start: the bridge registers no synthetic `before_agent_start`, and `recordRunStart` (H/runtime.ts:541-543) is called only from the handler of Pi's own `before_agent_start` (`startRun`, H/event-router.ts:383-389). 13 `pi.on` sites: the D-PG6-18 override (now 14). Child scenario: subagent-child.feature:302 (main session) and :247 (child ignores Stop), both profiles in G. No red commit: a per-commit process claim; HEAD is green in G. |
| 05-02 | 8 (boom notice; events with and without the notice; 200-unit cut and `No stderr output`; spawn and runner texts redacted, same text on every machine; once per load per event and command; notice order and per-hook dedupe; failure rides each hook's own result; every notice through `notifyHookNotice`) | ✓ 7/8 VERIFIED, 1 UNCERTAIN (A9, CI item) | Boom notice: SC3. Events: `showsFailures` admits PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, SessionStart, PreCompact and Stop, and refuses SessionEnd and PostCompact (H/dispatch.ts:671-687; UserPromptExpansion was added by D-PG6-20). Timeout: `withoutTimeoutFailure` drops the failure (H/dispatch-exec.ts:304-310). JSON before a failed exit applies whole (H/wire-protocol.ts:177-184). Cut: H/hook-labels.ts:174-179, 183-195. Spawn and run texts: H/dispatch-exec.ts:240-242, 449-451, both through `redactAbsolutePaths`. The redaction makes the text independent of the path. Its Node 24 wording is A9: this pass measured `spawn <path> ENOENT` on Node 22.22.2 and 26.13.1, but no Node 24 run exists, so the "every machine" clause is uncertain for Node 24 only (see Human Verification). Once per load: `startFailureKey` (H/dispatch.ts:692-698), `showHookNotice` (:767-779), cleared at a load (H/runtime.ts:364); S10; failures.feature:157 in G. Order and dedupe: `hookNotices` puts decision notices first, then failure notices; `failureNotices` dedupes equal text of one entry only (H/dispatch.ts:751-754); failures.feature:248. Per-hook result: notices are built from `outcomes`, not from the fold. Chokepoint: test/architecture/hooks-notice-notify.test.ts passes in G. |
| 05-03 | 9 (Stop missing script; UserPromptSubmit missing script and `onFailure: block`; no other event, stdout keeps the block, other stderr keeps the block, async lanes unchanged; per-run decision, signal or timeout never a missing script; notice text, not cut; Stop failure notice, StopFailure none; UserPromptSubmit stop text; PreToolUse stop text; Stop stop text and silent arms) | ✓ 9/9 VERIFIED | Missing script: SC2. `onFailure`: H/on-failure.ts:82 reads the `missing-script` failure; Stop ignores `onFailure` (:94-95). Other events: `MISSING_SCRIPT_EVENTS` (H/wire-protocol.ts:59); S6. A signal or another exit code is a failed exit, never a missing script (`exitCode === 2` only, :82-84; owner case `reads an exit … with a missing-file stderr as a failed exit`, wire-protocol.test.ts:168). Notice text: H/hook-labels.ts:208-214, not passed through `failureLine` (:227-229); failures.feature:82-84 asserts the full text with the em dash. Stop failure notice: `showStopNotices` (H/settle.ts:422-442) calls `failureNotices("Stop", "Stop", …)`; `runStopFailure` drops every notice (:566-614). Stop texts: H/event-adapters.ts:418-424 (PreToolUse), :731-739 (UserPromptSubmit); the held Stop reason is shown at `agent_settled` (H/settle.ts:291-298) and dropped when the run goes on (:152-154). Scenarios in G: messages.feature:162, :188, :219, :245, :265. |
| 05-04 | 9 (12,000-character wrapper; which strings are capped; length in units and surrogate pairs; empty adds nothing; preview cut, size label, tag escape; write-failure line within 10,000; one pure function, never rejects, settlement once, order kept; atomic contained file name; 30-day sweep) | ✓ 9/9 VERIFIED | Wrapper: SC4. Strings capped: the synchronous lane caps only `additionalContext`, which also carries plain stdout context (H/dispatch-exec.ts:286-296); the async lane caps each answer text, `systemMessage` first (H/async-rewake/registry.ts:723-735). Units and pairs: `safeEnd` (H/context-cap.ts:29-32). Empty: an absent context returns early (H/dispatch-exec.ts:287-289); `capHookContext` returns short strings unchanged. Preview and label: :36-50. Failure line: :66-73; S8. Pure with injected writer: :79-95. File: `saveHookOutput` checks `assertPathInside` before `atomicWriteText` (H/hook-output-files.ts:41-50; shared/atomic-json.ts:43); the name is a bridge-made UUID and a source (`SAVED_NAME`, :30). Sweep: regular files with a saved name only (:85-103), run at each reaped scope (H/event-router.ts:1424, :1670); S11. |
| 05-05 | 4 (timeout scenario; plain no timer, rewake ladder, both flags is rewake; what stops a hook does not change; terminal reload stops a plain hook) | ✓ 3/4 VERIFIED, 1 PASSED (override) | Timeout and lanes: SC5. `shutdownChildren` still cancels each ladder and then kills the child (H/runtime.ts:663-675). The reap path is unchanged in shape (H/async-rewake/registry.ts:881-905). Terminal reload: async.feature:432 in G (Linux). "What stops a hook does not change" on macOS and Windows: the existing D-PG5-18 override. The timeout header names the plain-lane exception (H/timeout.ts:117-118). |
| 05-06 | 9 (Stop continuation section; what stays different; failure, missing-script, stop notices on the page; limit, folder and 30-day removal; `timeout` and `async` rows; catalog prose; research notes; CHANGELOG; canary removed) | ✓ 9/9 VERIFIED | docs/hooks-compatibility.md: Stop continuation :160-179 (one `agent_settled`, no second `before_agent_start`, no mode keeps a fallback, the scenario cited at :165); the differences and the two unmeasured source-read edges :167-178; failure rows :413-416, `decision: "block"` :417, `onFailure` :376-390, `Messages to the user` :480-505; limit and saved folder :433-478; `timeout` :350 and `async` :351 rows say a plain `async` hook has no timeout and that on macOS and Windows nothing stops one that never ends; `Long-running handlers` :557. docs/output-catalog.md:5548 lists the new notices; the fenced `hook-notice` block is unchanged, and hooks-notice-notify.test.ts compares it in G. docs/research/issue-103-stop-stopfailure-promotion.md:3 carries the dated D-PG5-01 note; claude-hooks-vs-pi-events.md:14 and :148 name `agent_before_settle`. CHANGELOG.md:19-24 has the six lines under Unreleased. The scripted Stop canary is gone (test/live-uat/ holds none), and README.md:284-290 points at the three scenarios that replace it. No stale marker names it. |

**Score:** 55/56 truths verified: 5 success criteria and 51 plan truths. 51 are VERIFIED directly and 4 are PASSED (override): SC5's reload clause and the 05-05 stop truth (D-PG5-18), the 05-01 four-mode truth (D-PG5-01/02), and the 05-01 registration count (D-PG6-18). One, the Node 24 wording of the 05-02 start-failure truth (A9), is uncertain and waits for CI. None is behavior-unverified: every behavior-dependent truth has a passing named test from this pass or a scenario in G.

### Prohibitions

| Plan | Statement | Tier | Disposition |
|------|-----------|------|-------------|
| 05-06 | MUST NOT keep hook output in files without telling the user: the page names the folder of each scope, says that a project-scope folder lies inside the project directory, and states the 30-day removal. | judgment | Non-authoritative LLM verdict: holds. docs/hooks-compatibility.md:472 names both folders, says the project folder lies inside the project directory with the version-control note, and states the 30-day removal and the sweep's limits (:474-476). CHANGELOG.md:23 names the folder. **Flagged: unverified-prohibition, human review recommended** (Human Verification item 1). |

## Required Artifacts

`query verify.artifacts`: 05-01 6/6, 05-03 8/8, 05-04 7/7, 05-05 4/4, 05-06 5/5. 05-02 gives 4/5: the miss is the literal `claimStartFailureNotice` in runtime.ts, which review fix IN-04 split into two members (see Superseded). Every artifact exists, is substantive, and is wired:

| Artifact | Status | Details |
|----------|--------|---------|
| H/settle.ts | ✓ VERIFIED | `beforeSettleHandlerFor` :183; `settleHandlerFor` :273; `hookStoppedText` :47, :296; wired at H/event-router.ts:1622, :1630 |
| H/event-router.ts | ✓ VERIFIED | `agent_before_settle` :1619-1626; sweeps :1424, :1670 |
| H/runtime.ts | ✓ VERIFIED (pattern renamed) | `takeStopEnding` :451; `recordRewakeSent` :479; start-failure set `startFailureNoticeShown`/`recordStartFailureNotice` :501-507 (was `claimStartFailureNotice`, IN-04) |
| H/exec-result.ts, H/wire-protocol.ts, H/on-failure.ts | ✓ VERIFIED | `HookFailure` on `noop`; D-PG5-08 rule :56-68; `missing-script` :82 |
| H/hook-labels.ts | ✓ VERIFIED | exports `hookFailureText` :226, `hookStoppedText` :239, `promptStoppedText` :249 |
| H/dispatch.ts, H/dispatch-exec.ts, H/event-adapters.ts | ✓ VERIFIED | `failureNotices` :731; `withCappedContext` :280; `promptStoppedText` :736 |
| H/context-cap.ts, H/hook-output-files.ts, shared/atomic-json.ts | ✓ VERIFIED | `capHookContext` :79; `saveHookOutput` :41, `sweepHookOutput` :85; `atomicWriteText` :43 |
| H/exec-timer.ts, H/async-rewake/registry.ts, H/timeout.ts | ✓ VERIFIED | `INERT_TIMER_LADDER` :118; `D-PG5-17` at registry :13, :252; timeout :118 |
| features/lib/run-start-probe.ts | ✓ VERIFIED | `before_agent_start` log; used by prompt-and-stop.steps.ts:55, :208 |
| Five hook features, messages.steps.ts, additional-context.steps.ts | ✓ VERIFIED | all scenarios in G; no `@skip`/`@wip` tag |
| docs/hooks-compatibility.md, docs/output-catalog.md, docs/research/issue-103-stop-stopfailure-promotion.md, CHANGELOG.md, test/live-uat/README.md | ✓ VERIFIED | see 05-06 row |

## Key Link Verification

`query verify.key-links`: 05-01 4/4, 05-03 3/3, 05-04 4/4, 05-05 2/2, 05-06 2/2. 05-02 gives 3/4; the miss is the same `claimStartFailureNotice` literal.

| Plan | From -> To | Current connection | Status |
| --- | --- | --- | --- |
| 01 | event-router -> settle | `beforeSettleHandlerFor` registered on `agent_before_settle` between `agent_end` and `agent_settled` :1615-1640 | WIRED |
| 01 | settle -> runtime | `takeStopEnding` :204; `openStopBoundary`/`closeStopBoundary` :236-241 | WIRED |
| 01 | registry -> runtime | `runtime.recordRewakeSent()` :790 | WIRED |
| 01 | prompt-and-stop.steps -> run-start-probe | `RUN_START_PROBE_EXTENSION` :55, :208 | WIRED |
| 02 | wire-protocol -> exec-result | `failure` on the noop :149, :180 | WIRED |
| 02 | dispatch-exec -> exec-result | spawn and run failures :242, :451; timeout drop :304-310 | WIRED |
| 02 | dispatch -> hook-labels | `hookFailureText` :746 | WIRED |
| 02 | dispatch -> runtime | `startFailureNoticeShown`/`recordStartFailureNotice` :772-777 | WIRED (renamed, IN-04) |
| 03 | on-failure -> wire-protocol | `missing-script` failure read at :82 | WIRED |
| 03 | settle -> dispatch | `failureNotices("Stop", "Stop", outcomes)` :435 | WIRED |
| 03 | event-adapters -> hook-labels | `hookStoppedText` :421, `promptStoppedText` :736 | WIRED |
| 04 | dispatch-exec -> context-cap | `capHookContext` :294 | WIRED |
| 04 | registry -> context-cap | `capHookContext` :725 | WIRED |
| 04 | hook-output-files -> atomic-json | `atomicWriteText` after `assertPathInside` :48-49 | WIRED |
| 04 | event-router -> hook-output-files | `sweepHookOutput` :1424, :1670 | WIRED |
| 05 | registry -> exec-timer | `INERT_TIMER_LADDER` :264, `installTimerLadder` :275 | WIRED |
| 05 | runtime -> exec-timer | `entry.ladder.cancel()` :666 | WIRED |
| 06 | hooks-compatibility -> prompt-and-stop.feature | cited at :33, :165 | WIRED |
| 06 | output-catalog -> hooks-notice-notify.test.ts | `hook-notice` block compared byte for byte | WIRED |

## Data-Flow Trace (Level 4)

| Value | Source -> consumer | Real data | Status |
| --- | --- | --- | --- |
| Stop feedback | hook stdout -> `parseHookStdout` -> `stopFeedback` -> hidden draft -> boundary entries -> next model call | Yes. The model receives `Stop hook feedback:\nkeep going` (prompt-and-stop.feature:61-71). | FLOWING |
| Failure notice | child exit and stderr -> `noop.failure` -> `failureNotices` -> `notifyHookNotice` | Yes. The exact notice text is asserted. | FLOWING |
| Capped context | hook context -> `capHookContext` -> saved file and wrapper -> model prompt | Yes. The size, path, preview and saved length are asserted. | FLOWING |
| Plain async lifetime | spawn -> inert ladder -> hook's own exit | Yes. The lifecycle log shows `end \| 3`. | FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each gave `tests 1 / pass 1 / fail 0`.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| S1 | a block continues the run with its reason as stop hook feedback (STOP-03 / D-CF5-25) | test/bridges/hooks/settle.test.ts | PASS |
| S2 | the ninth consecutive block is suppressed and warns only once | test/bridges/hooks/settle.test.ts | PASS |
| S3 | settle runs no hook for a stop ending that the boundary took (D-PG5-03) | test/bridges/hooks/settle.test.ts | PASS |
| S4 | a live input clears active state and resets the cap | test/bridges/hooks/settle.test.ts | PASS |
| S5 | passes on Stop with an interpreter that cannot open its file, carrying the stderr as written | test/bridges/hooks/wire-protocol.test.ts | PASS |
| S6 | keeps the exit-2 block of a missing script on PreToolUse | test/bridges/hooks/wire-protocol.test.ts | PASS |
| S7 | D-PG5-15: wraps 12,000 characters with the 11.7KB label and a 2,000-character preview | test/bridges/hooks/context-cap.test.ts | PASS |
| S8 | D-PG5-16: cuts the failure line of a 20,000-character error to 10,000 units | test/bridges/hooks/context-cap.test.ts | PASS |
| S9 | a plain async hook receives no signal past its declared timeout (D-PG5-17) | test/bridges/hooks/async-rewake/registry.test.ts | PASS |
| S10 | shows a start failure at the next event when its notice failed to show | test/bridges/hooks/dispatch.test.ts | PASS |
| S11 | D-PG5-15: removes a saved file older than 30 days and keeps one of 30 days and a newer one | test/bridges/hooks/hook-output-files.test.ts | PASS |
| S12 | takes a cached stop ending once and returns nothing without one (D-PG5-03) | test/bridges/hooks/runtime.test.ts | PASS |
| S13 | keeps terminal Stop callbacks bounded and notifies only once | test/bridges/hooks/runtime.test.ts | PASS |
| P | `child_process.spawn` of a missing absolute path, `error.message` | /usr/bin/node v22.22.2, linuxbrew node v26.13.1, scratch only | both `spawn <path>/missing-guard.sh ENOENT`; no Node 24 available |
| G | `npm run check` at `1183aae3` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` is in scope. The research probes (M1 to M20) are one-time measurements that 05-RESEARCH.md records, not committed probes. Not applicable.

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| PG-HOOK-02 | 05-01, 05-06 | ✓ SATISFIED (json/print by override, STOPMODECHECK-01) | SC1. REQUIREMENTS.md:28 `[x]`, trace :179 Complete |
| PG-HOOK-23 | 05-03 | ✓ SATISFIED | SC2. REQUIREMENTS.md:31 `[x]`, trace :182 Complete |
| PG-HOOK-14 | 05-02, 05-03, 05-04 | ✓ SATISFIED (A9 Node 24 wording pending CI) | SC3, SC4. REQUIREMENTS.md:32 `[x]`, trace :183 Complete |
| PG-HOOK-21 | 05-05 | ✓ SATISFIED (reload bound Linux-only, D-PG5-18 override) | SC5. REQUIREMENTS.md:33 `[x]`, trace :184 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 5, and each appears in plan frontmatter.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| The 16 phase source files under H/ and shared/atomic-json.ts, the five hook features, run-start-probe.ts and the three hook step files | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | None | No match |
| Same features | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- 05-02-SUMMARY and the 05-02 plan patterns still name `claimStartFailureNotice`. The code follows 05-REVIEW-FIX.md IN-04 (:68-76).
- The previous report cited the saved-file disclosure at docs/hooks-compatibility.md:400-404 and the async rows at :292-293. Later rows moved them to :472-476 and :350-351. The text is the same in substance.
- Accepted residuals still tracked in BACKLOG: STOPMODECHECK-01 (:5373), PRETOOLSTOPREASON-01 (:5377), STOPREASONCONV-01 (:5381), the Stop async-answer residual (:5371), and HOOKTIMEDOUTEXIT2-01 (05-REVIEW IN-01).
- A1 (a follow-up typed while a Stop hook runs may lose its UserPromptSubmit context) and A3 (upstream delivery of an async answer after a Stop block) stay marked as unmeasured on the page (docs/hooks-compatibility.md:175-178). No criterion depends on them.

## Human Verification Required

### 1. Saved hook output disclosure (judgment-tier prohibition, 05-06) -- passed

**Result:** passed. The maintainer reviewed it on 2026-11-16 and asked for a CHANGELOG clause, which 594ea843 added (CHANGELOG.md:23-24).

**Test:** Read docs/hooks-compatibility.md:472-476 and CHANGELOG.md:23.
**Expected:** A user learns that over-limit hook output is saved, the folder in each scope, that the project folder lies inside the project directory, and that files older than 30 days are removed.
**Why human:** This is a judgment-tier prohibition. The verifier's verdict (holds) is not authoritative.

### 2. A9: the start-failure text on Node 24

**Test:** The CI `behavioral` job of the PR, on Node 24.
**Expected:** failures.feature:157 "A prompt hook that cannot start lets the prompt through and shows its error" passes, with the notice ending in `spawn missing-guard.sh ENOENT`.
**Why human/CI:** G ran on Node 26.13.1, and this pass measured Node 22.22.2 and 26.13.1 only. No Node 24 is installed here, and `features/gaps` has no PR yet. If the wording differs, 05-02-SUMMARY:149 names the fix: a run token in `features/lib/run-tokens.ts`, without loosening the comparison.

## Maintainer Review

The maintainer review of 2026-11-16 accepted items 1 to 3. None is a gap:

1. **D-PG5-18 (existing override):** on macOS and Windows, a `/reload` does not stop a running plain `async` hook, and nothing bounds one that never ends. The page says so.
2. **D-PG6-18 (new override):** the bridge has 14 `pi.on` sites. This replaces the 05-01 count of 13.
3. **D-PG5-01/02 (new override, outcome Good):** json and print mode Stop continuation has no committed scenario (STOPMODECHECK-01).
4. **The judgment prohibition (passed 2026-11-16) and A9 (open until PR CI):** see Human Verification.

D-PG5-10/11/13, D-PG5-14/15/16 and D-PG5-17/18 are product decisions that the maintainer review of 2026-11-16 locked as confirmed (PROJECT.md:2398-2400). They are implemented as decided.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria and 50 of the 51 plan truths of Phase 5 hold, and all citations now point at current lines. Later work changed three things that the phase relies on, and none of them breaks a criterion:

- Phase 6 added the `UserPromptExpansion` input handler, so the bridge has 14 `pi.on` sites (D-PG6-18). An override carries the old count.
- `UserPromptExpansion` now shows failure and stop notices. It stays outside the missing-script rule, as the 05-03 truth requires.
- Review fix IN-04 renamed the start-failure members. The two tool-pattern misses are only that rename.

The status moves from `passed` to `human_needed`. This is not a regression. The previous report listed three human items in its body but set `passed`. One of them, json/print mode, is now carried by a decision override. The other two, the judgment prohibition and A9 on Node 24, remain open.

---

_Verified: 2026-11-16T06:58:01Z_
_Verifier: Claude (gsd-verifier)_

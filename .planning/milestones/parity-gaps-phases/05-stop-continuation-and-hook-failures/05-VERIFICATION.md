---
phase: 05-stop-continuation-and-hook-failures
verified: 2026-11-17T03:39:23Z
status: human_needed
score: 55/56 must-haves verified (51 VERIFIED, 4 PASSED (override); 1 uncertain, CI item)
covered_files: [".planning/phases/05-stop-continuation-and-hook-failures/05-01-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-01-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-02-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-02-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-03-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-03-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-04-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-04-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-05-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-05-SUMMARY.md",".planning/phases/05-stop-continuation-and-hook-failures/05-06-PLAN.md",".planning/phases/05-stop-continuation-and-hook-failures/05-06-SUMMARY.md","CHANGELOG.md","docs/hooks-compatibility.md","docs/output-catalog.md","docs/research/claude-hooks-vs-pi-events.md","docs/research/issue-103-stop-stopfailure-promotion.md","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts","extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts","extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts","extensions/pi-claude-marketplace/bridges/hooks/timeout.ts","extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts","extensions/pi-claude-marketplace/domain/components/hook-events.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","extensions/pi-claude-marketplace/shared/atomic-json.ts","extensions/pi-claude-marketplace/shared/notification-run.ts","features/hook/additional-context.feature","features/hook/async.feature","features/hook/failures.feature","features/hook/messages.feature","features/hook/prompt-and-stop.feature","features/lib/boundary-continuer.ts","features/lib/boundary-refuser.ts","features/lib/hook-files.ts","features/lib/hook-recorder.ts","features/lib/run-start-probe.ts","features/plugin/subagent-child.feature","features/step_definitions/hook/additional-context.steps.ts","features/step_definitions/hook/async.steps.ts","features/step_definitions/hook/messages.steps.ts","features/step_definitions/hook/prompt-and-stop.steps.ts","features/step_definitions/plugin/subagent-hooks.steps.ts","features/support/world.ts","test/architecture/closed-set-enrollment.test.ts","test/architecture/hooks-lifecycle.test.ts","test/architecture/hooks-notice-notify.test.ts","test/bridges/hooks/async-rewake/async-answer.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/context-cap.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/dispatch.test.ts","test/bridges/hooks/event-adapters.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/exec-result.test.ts","test/bridges/hooks/exec-timer.test.ts","test/bridges/hooks/hook-labels.test.ts","test/bridges/hooks/hook-output-files.test.ts","test/bridges/hooks/on-failure.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/settle.test.ts","test/bridges/hooks/stream-text.test.ts","test/bridges/hooks/wire-protocol.test.ts","test/e2e/_rpc.ts","test/index.test.ts","test/live-uat/README.md","test/live-uat/manifest-absence-canary.mjs","test/live-uat/openai-stub-server.mjs","test/pi-runtime.ts","test/platform/pi-api.test.ts","test/shared/atomic-json.test.ts"]
covered_digest: "v4:sha256:f12eeb6a3f391f07c36110a9bb58a40edf17e6163b8d9c1fa3362b6122b707f2"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "a reload still stops a plain async hook that is running"
    reason: "Met on Linux, where the orphan reap can prove a live process is the hook (D-62-05). On macOS and Windows a reload never stopped a live async hook process (the reap is Linux-only, async-rewake/registry.ts:886-891), and D-PG5-18 accepts that a plain async hook that never ends has no bound there. The compatibility page states this residual (docs/hooks-compatibility.md:350,351,560; 6580f5f8). Re-checked 2026-11-17: unchanged. Also carries the 05-05 truth that a /reload, the next start, and a child shutdown still stop a running plain async hook."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-14T18:55:15Z"
  - must_have: "The hooks bridge registers 13 `pi.on` call sites, with `agent_before_settle` between `agent_end` and `agent_settled`; a pi-subagents child registers it and runs no `Stop` hook"
    reason: "Superseded in its count by decision D-PG6-18 (PROJECT.md:2409, Phase 6, confirmed by the maintainer review 2026-11-16): the UserPromptExpansion dispatch is a second `input` handler registered directly after the UserPromptSubmit one, so the bridge now has 14 `pi.on` call sites (event-router.ts:1444-1650; test/architecture/hooks-lifecycle.test.ts:386-403 pins the 14-entry order). The rest holds: `agent_before_settle` sits between `agent_end` and `agent_settled` (event-router.ts:1615-1640), and a pi-subagents child registers it and runs no Stop hook (`dispatchesInCurrentSession(\"Stop\")`, :1624; :188-190; features/plugin/subagent-child.feature:247)."
    accepted_by: "project decision D-PG6-18 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T06:58:01Z"
  - must_have: "`Stop` runs on `agent_before_settle` in `tui`, `print`, `json`, and `rpc` through one handler, with no `ctx.mode` branch and no `agent_settled` fallback path"
    reason: "The bridge side holds in code: one registration (event-router.ts:1619-1626), `requireNotificationMode` admits all four modes (shared/notification-run.ts:13-19), no `ctx.mode` comparison exists in settle.ts or event-router.ts, and `agent_settled` runs no Stop (settle.ts:311-312). That Pi raises the event and honors `continue: true` the same way in json and print mode was measured once in research (05-RESEARCH.md M2, M3, M6) and is recorded by decisions D-PG5-01/D-PG5-02 (PROJECT.md:2396, outcome Good), which name the missing committed check as the residual BACKLOG STOPMODECHECK-01 (BACKLOG.md:5379). The committed scenarios drive rpc and the terminal only."
    accepted_by: "project decision D-PG5-01/D-PG5-02 (PROJECT.md decision log, outcome Good; residual BACKLOG STOPMODECHECK-01); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T06:58:01Z"
re_verification:
  previous_status: human_needed
  previous_score: 55/56 (4 overrides; 1 uncertain, CI item)
  reason: "staleness: after the previous report (commit 14c9d489, tree 5749bbf5, 2026-11-17T02:37:02Z), 421863f6 (docs: align decision wording with the maintainer review) changed one covered file, docs/hooks-compatibility.md: line 376 now calls D-PG10-19 confirmed by the maintainer, not pending maintainer review. That line is Phase 10 scope; no Phase 5 citation moved (598 lines before and after). ebcce31e changed only docs/mcp-compatibility.md, which is not covered. No source, test, or feature file changed."
  earlier_pass_reason: "the pass before (tree cb5ee48c, 2026-11-16T06:58:01Z) went stale through 4d6825ba, 8c64be00, 6d9a3cdd, 594ea843 and b5692689; the 2026-11-17T02:37:02Z pass checked them."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  human_items_closed:
    - "Saved hook output disclosure (05-06 judgment-tier prohibition): passed at the maintainer review of 2026-11-16, after 594ea843 added the CHANGELOG clause."
human_verification:
  - test: "Read docs/hooks-compatibility.md:475-479 and CHANGELOG.md:23-24 (05-06 judgment-tier prohibition: hook output is not kept in files without telling the user)."
    expected: "A user learns that over-limit hook output is saved, the folder in each scope, that the project-scope folder lies inside the project directory (with the version-control note), and that files older than 30 days are removed."
    why_human: "Judgment-tier prohibition. The verifier's non-authoritative verdict is that it holds."
    status: resolved
    resolution: "passed: the maintainer reviewed it on 2026-11-16 and asked for a CHANGELOG clause, which 594ea843 added (CHANGELOG.md:23-24: files older than 30 days are removed; a project plugin's folder is inside the project under `.pi/`, with the version-control note)."
  - test: "Run CI on Node 24 (the PR's `behavioral` job) and check features/hook/failures.feature:157 \"A prompt hook that cannot start lets the prompt through and shows its error\" (research assumption A9)."
    expected: "The scenario passes on Node 24: the notice reads `... Error occurred while executing hook command: spawn missing-guard.sh ENOENT`."
    why_human: "Gate G ran on Node 26.13.1. An earlier pass measured the spawn ENOENT message on Node 22.22.2 and 26.13.1 (both `spawn <path> ENOENT`). No Node 24 is installed here, and features/gaps has no PR, so no CI run has covered it."
audit_acknowledged:
  milestone: parity-gaps
  at: 2026-11-17
  status: human_needed
---

# Phase 5: Stop Continuation and Hook Failures Verification Report

**Phase Goal:** A `Stop` hook that blocks continues the same run, as in Claude Code. A hook that fails, names a missing script, returns too much context, or runs in the background behaves as it does there.
**Verified:** 2026-11-17T03:39:23Z
**Status:** human_needed. The code meets every roadmap criterion. One item waits for CI: the Node 24 wording of a spawn `ENOENT` (A9). The judgment-tier prohibition passed at the maintainer review of 2026-11-16. Four truths pass by override. The maintainer review of 2026-11-16 accepted all four.
**Re-verification:** Yes. The previous report (human_needed, 55/56, four overrides, 2026-11-17T02:37:02Z, commit 14c9d489) became stale, because 421863f6 changed one line of docs/hooks-compatibility.md. The line is a Phase 10 decision status (D-PG10-19), so no truth, score, or override changed.

## Verification Basis

This pass checked the tree `features/gaps` at `41292897`. Summaries were not taken as evidence. The diff `git diff 14c9d489 HEAD` was read whole. It changes one covered file, docs/hooks-compatibility.md, at one line (:376). Every docs/hooks-compatibility.md line that this report cites was read again at its line (:165, :175-178, :350-351, :390, :415-419, :475-479, :560); the file has 598 lines before and after, so no citation moved. The rest of this section records the previous pass, which checked tree `5749bbf5`. In that pass, for each changed covered file, the diff since the tree before (`cb5ee48c`) was read, and each phase truth that the diff touches was checked again against the code, its caller, and the test or scenario that exercises it. For each unchanged covered file, the earlier citations were spot-checked at their current lines. Citations are current line numbers. **H/** means `extensions/pi-claude-marketplace/bridges/hooks/`.

**Changes since the previous report (commit 14c9d489):**

| Commit | Covered files | Effect |
| --- | --- | --- |
| 421863f6 | docs/hooks-compatibility.md:376 | "D-PG10-19, pending maintainer review" became "D-PG10-19, confirmed by the maintainer", which matches PROJECT.md:2438. The sentence is about plugin option defaults in a hook's environment (Phase 10). No Phase 5 truth cites it. The commit's other files (docs/env-vars.md, docs/mcp-compatibility.md, docs/prd/parity-gaps-prd.md, ROADMAP.md, the Phase 10 and 11 SECURITY.md files, 11-CONTEXT.md) are not covered by this report. |
| ebcce31e | none | One sentence of docs/mcp-compatibility.md:435 (D-PG7-17). Not covered. |

After ebcce31e, only VERIFICATION.md files changed (`git diff --name-only 421863f6 HEAD`).

**Changes checked by the previous pass (since cb5ee48c):**

| Commit | Phase-5 files | Effect |
| --- | --- | --- |
| 4d6825ba | H/dispatch.ts, H/exec-result.ts, H/hook-labels.ts, H/wire-protocol.ts | `UserPromptExpansion` block notice ends with `Original prompt:` (D-PG6-20). A `suppressOriginalPrompt` field on a `block` result. Phase 6 scope. No Phase 5 arm changed. |
| 8c64be00 | H/dispatch.ts, H/hook-labels.ts, H/on-failure.ts, H/wire-protocol.ts, messages.feature, docs/hooks-compatibility.md, CHANGELOG.md | The `UserPromptSubmit` block notice also ends with `Original prompt: <prompt>` (`originalPromptOf`, H/dispatch.ts:1666-1672). `suppressOriginalPrompt` counts only under the hook's own `hookEventName` (H/wire-protocol.ts:205-217). An `onFailure: "block"` block always sets `suppressOriginalPrompt: true` (H/on-failure.ts:143-147). See the 05-03 row. |
| 6d9a3cdd | H/spawn-helpers.ts, failures.feature | An unreadable recorded option fails the hook run through the existing `Failed to run:` notice (D-PG10-25). This is additive. The new scenario is at failures.feature:211. |
| 594ea843 | CHANGELOG.md | Adds "Files older than 30 days are removed." and the project-folder line (CHANGELOG.md:23-24). |
| b5692689 | docs/output-catalog.md | The `hook-notice` prose names the `Original prompt:` part (:5564). The fenced block and the catalog counts are unchanged. |

No commit after `cb5ee48c` changed H/settle.ts, H/runtime.ts, H/event-router.ts, H/event-adapters.ts, H/dispatch-exec.ts, H/context-cap.ts, H/hook-output-files.ts, H/async-rewake/registry.ts, H/exec-timer.ts, H/timeout.ts, shared/atomic-json.ts, or the prompt-and-stop, additional-context, async, and subagent-child features.

**Gate G (reused, not re-run):** `npm run check` exited 0 at `421863f6` (log `/tmp/pg-final2.log`, read by the verifier), on Node v26.13.1 with a hermetic `PI_CODING_AGENT_DIR`. This is the local Node version only; it does not close A9. The static checks passed, then the unpaired and integration tests, with pi-subagents 0.88.1, pi-mcp-adapter 7.0.1 and pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 115283). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 836824). Direct coverage merged 376 LCOV records. The log ends with `exit=0`. `git diff --name-only 421863f6 HEAD` names four planning `VERIFICATION.md` files and docs/mcp-compatibility.md (ebcce31e, one sentence; docs are not build inputs), so G covers every executable input of HEAD. Between the previous gate (`333784b7`) and `421863f6`, only docs and planning files changed. The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass, tree 41292897):** test/bridges/hooks/on-failure.test.ts (27/27) and test/bridges/hooks/wire-protocol.test.ts (98/98) were run whole under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, on Node v26.13.1. `query verification.fingerprint` was run with the unchanged covered_files list.

**Independent checks (previous pass, tree 5749bbf5, same executable inputs):** five owner test files of the changed sources were run whole under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap <file>` on Node v26.13.1. The named start-failure test S10 was also run alone. `query verify.artifacts`, `query verify.key-links`, and `query check.decision-coverage-verify` ran for the phase.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 5 must-haves |
| --- | --- | --- |
| D-PG6-18 (Phase 6, confirmed by the maintainer review 2026-11-16) | A second `input` handler, for `UserPromptExpansion`, registers directly after the `UserPromptSubmit` one. The bridge now has 14 `pi.on` call sites (H/event-router.ts:1444-1650). | The 05-01 count of 13 is out of date. An override carries it. The order that matters still holds: `agent_end`, `agent_before_settle`, `agent_settled` (:1615-1640), pinned by test/architecture/hooks-lifecycle.test.ts:386-403. |
| D-PG6-19/20/21 (Phase 6, confirmed by the maintainer review 2026-11-16) | `UserPromptExpansion` became an admitted event. It shows failure notices (H/dispatch.ts:686-701, `UserPromptExpansion` at :693) and `Operation stopped by hook[: <reason>]` on `continue: false`. | This extends the 05-02 and 05-03 event lists and changes none of their arms. The missing-script rule still covers only `Stop` and `UserPromptSubmit` (H/wire-protocol.ts:60), so a `UserPromptExpansion` exit 2 still blocks. That keeps the 05-03 truth "no other event gets the rule". |
| D-PG6-20 restored (8c64be00, maintainer decision 2026-11-16, closes HOOKORIGPROMPT-01) | A blocked `UserPromptSubmit` notice ends with a blank line and `Original prompt: <prompt>`, unless the first blocking hook's JSON sets `suppressOriginalPrompt: true` under its own `hookEventName`, or the block comes from `onFailure: "block"`. | No Phase 5 truth covers the plain block notice. The 05-03 truth "with `onFailure` set to `block` it blocks the prompt with the existing `onFailure` reason" still holds. `onFailureBlock` marks its block `suppressOriginalPrompt: true` (H/on-failure.ts:143-147), so the notice keeps the plain `onFailure` reason. The failures.feature:7 Outline compares the whole notice list (rows :29-32, no `Original prompt:` part) and passes in G. |
| D-PG6-06 (Phase 6) | `agent_end` also drops the tool-call marks of calls that never reached a result (H/settle.ts:151). | This is additive. The cache and held-reason logic of 05-01 and 05-03 is unchanged (:152-158). |
| D-PG10-08/10/25 (Phase 10) | A hook that names a plugin option with no value, or whose record's options do not parse, fails with Claude Code's message through the same failure notice. | Additive scenarios at failures.feature:184, :211 and :257. The 05-02 notice forms are unchanged. |
| Review fix IN-04 (in-phase, da55855a) | The runtime's `claimStartFailureNotice` became `startFailureNoticeShown(key)` and `recordStartFailureNotice(key)`. The key is recorded only after the notice shows (H/dispatch.ts:780-794). | `verify.artifacts` and `verify.key-links` for 05-02 still report the literal `claimStartFailureNotice` as missing. The truth holds under the new names: one notice per load per event and resolved command, the set lives in the runtime (H/runtime.ts:501-507), and a bridge load empties it (:364). This is a pattern miss, not a stub. It is a review finding, not a decision, so no override was added. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| SC1 | A run that a `Stop` hook blocks twice raises one `agent_settled` event and shows no second run start. An always-blocking hook still makes eight re-entries before the limit notice (PG-HOOK-02). | ✓ VERIFIED | **Code (unchanged since the previous report):** the Stop bucket runs on `agent_before_settle` (H/event-router.ts:1619-1626 -> H/settle.ts:183). The handler returns `{ entries: [...event.entries, stopBlockDraft(continuation)], continue: true }` (:218-220). The draft is a hidden `custom_message` of type `claude-hook-stop-block` (:249-257). `agent_settled` runs no Stop for a `stop` ending (:311-312). The cap is `STOP_OVERRIDE_CAP = 8` (H/runtime.ts:27). **Scenarios (in G):** prompt-and-stop.feature:39 (one run start, three model calls) and :130 (eight continuations, one cap notice). |
| SC2 | A `Stop` hook that names a missing script lets the run end and shows one failure notice. A prompt hook that names a missing script does not block the prompt (PG-HOOK-23). | ✓ VERIFIED | **Code:** `MISSING_SCRIPT_EVENTS` is `Stop` and `UserPromptSubmit` (H/wire-protocol.ts:60), with blank stdout and a stderr that matches `/no such file\|can't open/i` (:61-69). `exitTwoResult` returns a `noop` with a `missing-script` failure (:147-150). The notice text is built in H/hook-labels.ts:212-218 and :230-233. **Scenarios (in G):** failures.feature:86 (Stop, one model call, one notice) and :60 (UserPromptSubmit, the prompt reaches the model). **Owner file:** wire-protocol.test.ts, 98/98 in this pass. |
| SC3 | A hook that exits 1 with `boom` on stderr shows one notice that holds `boom`. A `UserPromptSubmit` `continue: false` with a `stopReason` shows that reason (PG-HOOK-14). | ✓ VERIFIED | **Code:** `nonZeroExitResult` returns a noop with an `exit` failure when stdout is not a JSON object (H/wire-protocol.ts:172-186). `failureNotices` builds one notice per hook and folds the duplicates of one entry (H/dispatch.ts:745-773). `failureLine` keeps the first non-blank line and cuts it at 200 units (H/hook-labels.ts:176-183). The UserPromptSubmit stop arm shows `promptStoppedText` (H/event-adapters.ts:731-739; H/hook-labels.ts:253-257). **Scenarios (in G):** failures.feature:34 shows exactly `UserPromptSubmit hook error: Failed with non-blocking status code: boom`. messages.feature:266 shows `Operation stopped by hook: not now`. |
| SC4 | A hook that prints 12,000 characters of context sends at most 10,000 to the model (PG-HOOK-14). | ✓ VERIFIED | **Code (unchanged):** `capHookContext` (H/context-cap.ts:79-95), called by `withCappedContext` (H/dispatch-exec.ts:294) and `sendAsyncAnswer` (H/async-rewake/registry.ts:725). **Scenario (in G):** additional-context.feature:120 checks the `11.7KB` label, the 2,000-character preview, the 12,000 saved characters, and `wrapper.length <= 10000`. |
| SC5 | A plain `async` hook with `timeout: 1` that sleeps 3 seconds writes its end marker, and a reload still stops a plain `async` hook that is running (PG-HOOK-21). | ✓ VERIFIED (timeout clause); PASSED (override) (reload clause outside Linux) | **Code (unchanged):** `laneOf` picks `rewake` only for `asyncRewake: true` (H/async-rewake/registry.ts:203-205). `ladderFor` gives the plain lane `INERT_TIMER_LADDER` (:254-264; H/exec-timer.ts:118). **Scenarios (in G):** async.feature:261 (`slow \| end \| 3`), :432 (terminal `/reload`), :470 (SIGTERM-ignoring background hook stops at its timeout). **Reload clause:** the orphan reap kills a live process only on Linux (registry.ts:886-891). The D-PG5-18 override carries macOS and Windows. |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truths | Status | Current evidence |
|------|--------|--------|----------|
| 05-01 | 12 | ✓ 10/12 VERIFIED, 2 PASSED (override) | No file of this plan changed after the previous report. The citations there were spot-checked at the same lines: `takeStopEnding` (H/runtime.ts:451), `recordRewakeSent` (:479), the agent_before_settle registration (H/event-router.ts:1619-1626), `beforeSettleHandlerFor` (H/settle.ts:183). Four modes: the D-PG5-01/02 override (residual STOPMODECHECK-01, BACKLOG.md:5379). 13 `pi.on` sites: the D-PG6-18 override (now 14). The child scenarios subagent-child.feature:302 and :247 pass under both profiles in G. |
| 05-02 | 8 | ✓ 7/8 VERIFIED, 1 UNCERTAIN (A9, CI item) | Events: `showsFailures` (H/dispatch.ts:686-701). Timeout drop: `withoutTimeoutFailure` (H/dispatch-exec.ts:304-310). Cut and `No stderr output`: H/hook-labels.ts:176-198. Spawn and run texts pass `redactAbsolutePaths` (H/dispatch-exec.ts:240-242, :449-451). The Node 24 wording is A9 (see Human Verification). Once per load: `startFailureKey` (H/dispatch.ts:706-712), `showHookNotice` (:780-794), cleared at a load (H/runtime.ts:364); S10 passes alone in this pass. Order and dedupe: `hookNotices` puts decision notices first, then failure notices (H/dispatch.ts:817-827); equal text of one entry shows once (:766-769); failures.feature:294. 8c64be00 adds the `Original prompt:` part to block notices only. Failure notices and their order are unchanged. Chokepoint: test/architecture/hooks-notice-notify.test.ts passes in G. |
| 05-03 | 9 | ✓ 9/9 VERIFIED | Missing script: SC2. `onFailure`: `isFailure` reads the `missing-script` failure (H/on-failure.ts:83); Stop ignores `onFailure` (:95-96). The block keeps the existing reason, and since 8c64be00 it never adds an `Original prompt:` part (`suppressOriginalPrompt: true`, :143-147), so failures.feature:7 rows :29-32 still show only the reason, compared as the whole notice list in G. No other event: `MISSING_SCRIPT_EVENTS` (H/wire-protocol.ts:60). A signal or another exit code is never a missing script (`exitCode === 2` only, :83). Notice text: H/hook-labels.ts:212-218, not cut by `failureLine` (:230-233); failures.feature:82-84. Stop failure notice: `showStopNotices` calls `failureNotices("Stop", "Stop", …)` (H/settle.ts:422-442); `runStopFailure` drops every notice (:566-614). Stop texts: H/event-adapters.ts:418-424 (PreToolUse), :731-739 (UserPromptSubmit); the held Stop reason shows at `agent_settled` (H/settle.ts:291-298). Scenarios in G: messages.feature:183, :209, :240, :266, :286. Owner files on-failure.test.ts (27/27), wire-protocol.test.ts (98/98) and hook-labels.test.ts (52/52) pass in this pass. |
| 05-04 | 9 | ✓ 9/9 VERIFIED | No file of this plan changed. Citations as in SC4, plus `safeEnd` (H/context-cap.ts:29-32), `saveHookOutput` with `assertPathInside` before `atomicWriteText` (H/hook-output-files.ts:41-50; shared/atomic-json.ts:43), and the sweep (:85-103) at each reaped scope (H/event-router.ts:1424, :1670). |
| 05-05 | 4 | ✓ 3/4 VERIFIED, 1 PASSED (override) | No file of this plan changed. `shutdownChildren` still cancels each ladder and then kills the child (H/runtime.ts:663-675). Terminal reload: async.feature:432 in G (Linux). macOS and Windows: the D-PG5-18 override. |
| 05-06 | 9 | ✓ 9/9 VERIFIED | docs/hooks-compatibility.md: Stop continuation :161-180 (cites prompt-and-stop.feature at :165; unmeasured edges :175-178); failure rows :415-419; `onFailure` :378-393 (8c64be00 adds that an `onFailure` block notice has no `Original prompt:` part, :390); `Messages to the user` :483-511; limit and saved folder :436-482, disclosure :475-479; `timeout` :350 and `async` :351; `Long-running handlers` :560. docs/output-catalog.md:5564 lists the notices; b5692689 changed only this prose, and hooks-notice-notify.test.ts compares the fenced block in G. docs/research/issue-103-stop-stopfailure-promotion.md:3 carries the D-PG5-01 note; claude-hooks-vs-pi-events.md:14 and :148 name `agent_before_settle`. CHANGELOG.md:19-25 holds the phase lines under Unreleased: :23 the folder and the 30-day removal, :24 the project folder with the version-control note (594ea843). test/live-uat/ holds no Stop canary; test/live-uat/README.md:284-290 names the three scenarios that replace it. |

**Score:** 55/56 truths verified: 5 success criteria and 51 plan truths. 51 are VERIFIED directly and 4 are PASSED (override): SC5's reload clause and the 05-05 stop truth (D-PG5-18), the 05-01 four-mode truth (D-PG5-01/02), and the 05-01 registration count (D-PG6-18). One, the Node 24 wording of the 05-02 start-failure truth (A9), is uncertain and waits for CI. None is behavior-unverified: every behavior-dependent truth has a passing owner test or a scenario in G.

### Prohibitions

| Plan | Statement | Tier | Disposition |
|------|-----------|------|-------------|
| 05-06 | MUST NOT keep hook output in files without telling the user: the page names the folder of each scope, says that a project-scope folder lies inside the project directory, and states the 30-day removal. | judgment | **Resolved: passed by the maintainer review of 2026-11-16.** The maintainer asked for a CHANGELOG clause, which 594ea843 added (CHANGELOG.md:23-24). docs/hooks-compatibility.md:475 names both folders, says the project folder lies inside the project directory with the version-control note, and states the 30-day removal; :476-479 give the sweep's limits. |

## Required Artifacts

`query verify.artifacts`: 05-01 6/6, 05-03 8/8, 05-04 7/7, 05-05 4/4, 05-06 5/5. 05-02 gives 4/5: the miss is the literal `claimStartFailureNotice` in runtime.ts, which review fix IN-04 split into two members (see Superseded). Every artifact exists, is substantive, and is wired:

| Artifact | Status | Details |
|----------|--------|---------|
| H/settle.ts | ✓ VERIFIED | `beforeSettleHandlerFor` :183; `settleHandlerFor` :273; wired at H/event-router.ts:1622, :1630 |
| H/event-router.ts | ✓ VERIFIED | `agent_before_settle` :1619-1626; sweeps :1424, :1670 |
| H/runtime.ts | ✓ VERIFIED (pattern renamed) | `takeStopEnding` :451; `recordRewakeSent` :479; `startFailureNoticeShown`/`recordStartFailureNotice` :501-507 (was `claimStartFailureNotice`, IN-04) |
| H/exec-result.ts, H/wire-protocol.ts, H/on-failure.ts | ✓ VERIFIED | `HookFailure` on `noop`; D-PG5-08 rule :57-69; `missing-script` :83 |
| H/hook-labels.ts | ✓ VERIFIED | exports `hookFailureText` :230, `hookStoppedText` :243, `promptStoppedText` :253 |
| H/dispatch.ts, H/dispatch-exec.ts, H/event-adapters.ts | ✓ VERIFIED | `failureNotices` :745; `withCappedContext` :280; `promptStoppedText` :736 |
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
| 02 | wire-protocol -> exec-result | `failure` on the noop :150, :182 | WIRED |
| 02 | dispatch-exec -> exec-result | spawn and run failures :242, :451; timeout drop :304-310 | WIRED |
| 02 | dispatch -> hook-labels | `hookFailureText` :760 | WIRED |
| 02 | dispatch -> runtime | `startFailureNoticeShown`/`recordStartFailureNotice` :786, :792 | WIRED (renamed, IN-04) |
| 03 | on-failure -> wire-protocol | `missing-script` failure read at :83 | WIRED |
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
| `onFailure` block notice | failed hook -> `onFailureBlock` (`suppressOriginalPrompt: true`) -> `blockNotices` -> notice without `Original prompt:` | Yes. failures.feature:7 asserts the whole notice list. | FLOWING |
| Capped context | hook context -> `capHookContext` -> saved file and wrapper -> model prompt | Yes. The size, path, preview and saved length are asserted. | FLOWING |
| Plain async lifetime | spawn -> inert ladder -> hook's own exit | Yes. The lifecycle log shows `end \| 3`. | FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, Node v26.13.1, no services. The on-failure and wire-protocol rows ran again in this pass on tree 41292897 with the same result. The other owner rows are from the previous pass, on the same executable inputs.

| Check | Command | Result | Status |
| --- | --- | --- | --- |
| on-failure owner (suppression of the original prompt on an `onFailure` block) | `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none test/bridges/hooks/on-failure.test.ts` | tests 27, pass 27, fail 0 | ✓ PASS |
| wire-protocol owner (missing-script rule S5/S6, `hookEventName` gate) | same, test/bridges/hooks/wire-protocol.test.ts | tests 98, pass 98, fail 0 | ✓ PASS |
| hook-labels owner (failure, missing-script, stop and block texts) | same, test/bridges/hooks/hook-labels.test.ts | tests 52, pass 52, fail 0 | ✓ PASS |
| dispatch owner (failure notices, block notices, start-failure set) | same, test/bridges/hooks/dispatch.test.ts | tests 301, pass 301, fail 0 | ✓ PASS |
| dispatch-exec owner (spawn and run failures, cap, timeout drop) | same, test/bridges/hooks/dispatch-exec.test.ts | tests 118, pass 118, fail 0 | ✓ PASS |
| S10 "shows a start failure at the next event when its notice failed to show" | `--test-name-pattern '^…$'` test/bridges/hooks/dispatch.test.ts | tests 1, pass 1, fail 0 | ✓ PASS |
| G | `npm run check` at `421863f6` (same executable inputs as HEAD) | exit 0; adapter 2100/2100, builtin 204/204; 376 LCOV records | ✓ PASS (reused) |

The named tests S1-S9 and S11-S13 of the previous report exercise files that no later commit changed. They also ran inside G.

## Probe Execution

No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` is in scope. The research probes (M1 to M20) are one-time measurements that 05-RESEARCH.md records. Not applicable.

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| PG-HOOK-02 | 05-01, 05-06 | ✓ SATISFIED (json/print by override, STOPMODECHECK-01) | SC1. REQUIREMENTS.md:28 `[x]`, trace :179 Complete |
| PG-HOOK-23 | 05-03 | ✓ SATISFIED | SC2. REQUIREMENTS.md:31 `[x]`, trace :182 Complete |
| PG-HOOK-14 | 05-02, 05-03, 05-04 | ✓ SATISFIED (A9 Node 24 wording waits for CI) | SC3, SC4. REQUIREMENTS.md:32 `[x]`, trace :183 Complete |
| PG-HOOK-21 | 05-05 | ✓ SATISFIED (reload bound Linux-only, D-PG5-18 override) | SC5. REQUIREMENTS.md:33 `[x]`, trace :184 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 5, and each appears in plan frontmatter.

### Decision Coverage

`query check.decision-coverage-verify` (exit 0): all 20 trackable CONTEXT.md decisions are honored by shipped artifacts; none is missing. The D-PG5 rows of PROJECT.md (:2396-2400) and D-PG6-18 to D-PG6-22 (:2409) read as confirmed by the maintainer review of 2026-11-16.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| Files changed after the previous report (H/dispatch.ts, H/hook-labels.ts, H/on-failure.ts, H/wire-protocol.ts, H/exec-result.ts, H/spawn-helpers.ts, messages.feature, failures.feature, prompt-commands.feature, prompt-expansion.feature) | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | None | No match |
| features/hook/*.feature | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- 05-02-SUMMARY and the 05-02 plan patterns still name `claimStartFailureNotice`. The code follows 05-REVIEW-FIX.md IN-04.
- The previous report cited the saved-file disclosure at docs/hooks-compatibility.md:472-476, the `onFailure` section at :376-390, the catalog prose at :5548, and messages.feature:162-265. Later additions moved them to :475-479, :378-393, :5564 and messages.feature:183-286. The text is the same in substance.
- Accepted residuals still tracked in BACKLOG: STOPMODECHECK-01 (:5379), PRETOOLSTOPREASON-01 (:5383), STOPREASONCONV-01 (:5387), STOPASYNCANSWER-01 (:5375), STOPFOLLOWUPCTX-01 (:5371), and HOOKTIMEDOUTEXIT2-01 (:5399).
- The compatibility page marks A1 (a follow-up typed while a Stop hook runs may lose its UserPromptSubmit context) and A3 as unmeasured (docs/hooks-compatibility.md:175-178). No criterion depends on them.
- 421863f6 aligned docs/hooks-compatibility.md:376 with PROJECT.md:2438: D-PG10-19 reads as confirmed by the maintainer. It is a Phase 10 line. This report calls no locked decision pending.
- docs/hooks-compatibility.md now says that upstream rejects the whole output for a wrong `hookEventName`, while the bridge ignores only `suppressOriginalPrompt` (8c64be00). This is a Phase 6 (D-PG6-20) residual, not a Phase 5 truth.

## Human Verification Required

### 1. Saved hook output disclosure (judgment-tier prohibition, 05-06): passed

**Result:** passed. The maintainer reviewed it on 2026-11-16 and asked for a CHANGELOG clause, which 594ea843 added (CHANGELOG.md:23-24).

**Test:** Read docs/hooks-compatibility.md:475-479 and CHANGELOG.md:23-24.
**Expected:** A user learns that over-limit hook output is saved, the folder in each scope, that the project folder lies inside the project directory, and that files older than 30 days are removed.
**Why human:** This is a judgment-tier prohibition. The verifier's verdict (holds) is not authoritative.

### 2. A9: the start-failure text on Node 24 (open until PR CI)

**Test:** The CI `behavioral` job of the PR, on Node 24.
**Expected:** failures.feature:157 "A prompt hook that cannot start lets the prompt through and shows its error" passes, with the notice ending in `spawn missing-guard.sh ENOENT`.
**Why human/CI:** G ran on Node 26.13.1 (at `421863f6`), and an earlier pass measured Node 22.22.2 and 26.13.1 only. No Node 24 is installed here, and `features/gaps` has no PR yet. If the wording differs, 05-02-SUMMARY:149 names the fix: a run token in `features/lib/run-tokens.ts`, without loosening the comparison.

## Maintainer Review

The maintainer review of 2026-11-16 settled every item that the autonomous run left open. None is a gap:

1. **D-PG5-18 (override):** on macOS and Windows, a `/reload` does not stop a running plain `async` hook, and nothing bounds one that never ends. The page says so. Accepted.
2. **D-PG6-18 (override):** the bridge has 14 `pi.on` sites. This replaces the 05-01 count of 13. Accepted.
3. **D-PG5-01/02 (override, outcome Good):** json and print mode Stop continuation has no committed scenario (STOPMODECHECK-01). Accepted.
4. **The judgment prohibition:** passed, after the CHANGELOG clause of 594ea843.

D-PG5-10/11/13, D-PG5-14/15/16 and D-PG5-17/18 are product decisions that the maintainer review of 2026-11-16 locked as confirmed (PROJECT.md:2398-2400). They are implemented as decided. A9 is a CI measurement, not a decision, and stays open until the PR's Node 24 run.

## Gaps Summary

There are no gaps and no regressions. Since the previous report, 421863f6 changed one Phase 10 line of docs/hooks-compatibility.md (:376, D-PG10-19 status), and no Phase 5 citation moved. In the pass before, the maintainer review fixes changed four phase source files, but no Phase 5 arm. 8c64be00 adds the `Original prompt:` part to a blocked `UserPromptSubmit` notice. It also makes an `onFailure: "block"` block leave that part out, so the 05-03 `onFailure` truth keeps its plain reason, and the failures.feature:7 Outline proves this in G. 594ea843 adds the CHANGELOG clause that closed the judgment prohibition. All citations now point at current lines.

The status stays `human_needed` for one item only: A9, the Node 24 wording of the spawn `ENOENT` notice, which the PR's CI run will measure.

---

_Verified: 2026-11-17T03:39:23Z_
_Verifier: Claude (gsd-verifier)_

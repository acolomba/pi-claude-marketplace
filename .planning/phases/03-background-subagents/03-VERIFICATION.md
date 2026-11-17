---
phase: 03-background-subagents
verified: 2026-11-17T03:28:27Z
status: passed
score: 31/31 must-haves verified
covered_files: [".planning/phases/03-background-subagents/03-01-PLAN.md",".planning/phases/03-background-subagents/03-01-SUMMARY.md",".planning/phases/03-background-subagents/03-02-PLAN.md",".planning/phases/03-background-subagents/03-02-SUMMARY.md",".planning/phases/03-background-subagents/03-03-PLAN.md",".planning/phases/03-background-subagents/03-03-SUMMARY.md",".planning/phases/03-background-subagents/03-04-PLAN.md",".planning/phases/03-background-subagents/03-04-SUMMARY.md",".planning/phases/03-background-subagents/03-05-PLAN.md",".planning/phases/03-background-subagents/03-05-SUMMARY.md",".planning/phases/03-background-subagents/03-06-PLAN.md",".planning/phases/03-background-subagents/03-06-SUMMARY.md",".planning/phases/03-background-subagents/03-07-PLAN.md",".planning/phases/03-background-subagents/03-07-SUMMARY.md",".planning/phases/03-background-subagents/03-08-PLAN.md",".planning/phases/03-background-subagents/03-08-SUMMARY.md","docs/hooks-compatibility.md","docs/mcp-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts","extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts","extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts","extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts","extensions/pi-claude-marketplace/platform/subagent-child.ts","features/agent/frontmatter.feature","features/agent/invocation.feature","features/lib/agent-files.ts","features/lib/field-rows.ts","features/lib/real-subagent-child.ts","features/lib/subagent-hook-session.ts","features/mcp-server/agent-grants.feature","features/mcp-server/verdict-markers.feature","features/plugin/subagent-child.feature","features/step_definitions/agent/listing.steps.ts","features/step_definitions/hook/runs.steps.ts","features/step_definitions/mcp-server/agent-grants.steps.ts","features/step_definitions/plugin/subagent-hooks.steps.ts","features/support/pi-process.ts","test/bridges/agents/convert.test.ts","test/bridges/agents/grant-forms.test.ts","test/bridges/agents/grant-rewrite.test.ts","test/bridges/agents/legacy-grant-form.test.ts","test/bridges/agents/mcp-async-warning.test.ts","test/bridges/agents/stage.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/payloads/post-tool-use-failure.test.ts","test/bridges/hooks/payloads/post-tool-use.test.ts","test/bridges/hooks/payloads/pre-tool-use.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/translation-context.test.ts","test/integration/hooks-dispatch-end-to-end.test.ts","test/integration/pi-subagents-child-identity.test.ts","test/integration/subagent-hook-ownership.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts","test/orchestrators/plugin/install-outcome.test.ts","test/orchestrators/plugin/reinstall-flow.test.ts","test/orchestrators/plugin/update-swap.test.ts"]
covered_digest: "v4:sha256:433d94947c5be57d7b372cfa2418b98276d7756cbfacf2f104dc44e3f7d626ce"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 31/31
  reason: "staleness: commit 421863f6 (docs: align decision wording with the maintainer review) changed docs/hooks-compatibility.md and docs/mcp-compatibility.md, two covered files. It only drops 'pending maintainer review' wording for locked decisions (D-PG10-19, D-PG9-01/08/14/15/16, D-PG9-07) and points the workflow-tools question at BACKLOG AGTWORKFLOWAMBIENT-01; no line was added or removed, so every citation below still holds. The other covered-file changes since the previous report commit 171d884f (4d6825ba, b35b86d1, 6826f6f6, 8c64be00, b5692689) touch test/bridges/hooks/dispatch-exec.test.ts (suppressOriginalPrompt in onFailure block outcomes), test/orchestrators/plugin/install-flow-ledger.test.ts (WLIF-01 now fails prepare with ENOTDIR, D-PG8-07 keep-last) and the same two docs outside the Phase 3 sections; none touches a Phase 3 truth."
  previous_verified: 2026-11-16T06:37:40Z
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_removed: # carried from the 2026-11-16T06:37:40Z pass; no override exists now
    - must_have: "PG-HOOK-07a unclassified probe row: child tool hook session_id, transcript_path and CLAUDE_CODE_SESSION_ID"
      why: "No longer needed. D-PG6-01/02/03 (parity-gaps Phase 6) shipped the behavior the override deferred: a background child's tool hooks name the launching session in session_id, transcript_path, CLAUDE_CODE_SESSION_ID and CLAUDE_SESSION_ID, and agent_id names the child (H/translation-context.ts:131-152; features/plugin/subagent-child.feature:542, features/agent/frontmatter.feature:410,423). PROJECT.md:2401 records that the decision closes this row; BACKLOG CHILDSESSIONID-01 is CLOSED (BACKLOG.md:5327). It was never one of the 31 counted truths."
advisory:
  - finding: "Since D-PG6-01 (commit f3250f3b), the real-child tests can no longer see a hook run of a child's lifecycle event. test/integration/pi-subagents-child-identity.test.ts:119-121 (childRuns) and the cucumber step at features/step_definitions/plugin/subagent-hooks.steps.ts:612-645 select a child's runs by agent_id, which only the three tool payloads carry. A child SessionStart/UserPromptSubmit/Stop/SessionEnd run, if one happened, would carry the launching session's session_id and no agent_id, so it would read as a main run; the main-session checks take only the first six main runs (.slice(0, 6), pi-subagents-child-identity.test.ts:201 and subagent-hooks.steps.ts:657). Before f3250f3b, runsOf filtered by session_id === child and asserted the child's full run list."
    category: other
    reason: "Test evidence narrowed, not a behavior defect. The invariant still holds: the stand-in child scenarios assert every run of a real Pi process that has the child marker (subagent-child.feature:202,247,275,503), the owner cases drive each registered handler in a child (event-router.test.ts:5285), and this verifier's scratch probe dumped every hook run of a real pi-subagents 0.88.1 ordinary child and found only its PreToolUse/PostToolUse rows (the last Stop row carries stop_hook_active true, the main session's re-entry). To resolve: give the real-child assertions a discriminator for child processes (for example count the main session's lifecycle runs exactly, or record a child marker in the hook recorder) so a child lifecycle run fails the test again."
    evidence_status: "reproducible by reading the two filters and git show f3250f3b; no failing test"
decision_coverage:
  honored: 9
  total: 9
  not_honored: []
human_verification: []
---

# Phase 3: Background Subagents Verification Report

**Phase Goal:** A bridged agent starts as a Claude Code subagent starts by default: in the launch mode that pi-subagents chooses, which is the background. A pi-subagents child that loads this extension runs the plugin's tool hooks and none of its main-session hooks.

**Verified:** 2026-11-17T03:28:27Z
**Status:** passed
**Re-verification:** Yes. The previous report (passed, 31/31, no override, 2026-11-16T06:37:40Z, commit `171d884f`) became stale when `421863f6` ("docs: align decision wording with the maintainer review") edited two covered docs. That commit changed wording only. It dropped "pending maintainer review" from D-PG10-19, D-PG9-01, D-PG9-07, D-PG9-08, D-PG9-14, D-PG9-15 and D-PG9-16, and pointed the workflow-tools question at BACKLOG AGTWORKFLOWAMBIENT-01. It added and removed no line in either file, and it changed no source, test or feature file. The Phase 3 sections of both docs (hooks-compatibility.md:35-85, mcp-compatibility.md:484-505) were read again and still state what P08.3 needs.

## Re-verification of 2026-11-17 (staleness only)

- **What moved since `171d884f`:** `git log 171d884f..HEAD` over the 68 covered files names six commits. `421863f6`, `b5692689` and `6826f6f6` edit docs/hooks-compatibility.md and docs/mcp-compatibility.md. Apart from the wording of `421863f6`, no hunk falls in the cited Phase 3 ranges. The nearest, mcp-compatibility.md:507 (`b5692689`), corrects the pi-subagents version of the measured foreground MCP refusal from 0.88.0 to 0.88.1 (D-CF6-10). `4d6825ba` and `8c64be00` add `suppressOriginalPrompt: true` to the expected `onFailure` block outcomes in test/bridges/hooks/dispatch-exec.test.ts. `b35b86d1` (D-PG8-07, last of two scripts with one name, PROJECT.md:2422) makes the WLIF-01 case in test/orchestrators/plugin/install-flow-ledger.test.ts fail with `ENOTDIR` in place of the removed `WorkflowNameCollisionError`. None of these touches a Phase 3 truth or a cited line. No covered source file under `extensions/` changed since `f48729e3`, so the source citations below still hold.
- **Gate G2 (reused, not re-run):** `npm run check` exited 0 at `421863f6` (log `/tmp/pg-final2.log`, ends `exit=0`): adapter profile 2100/2100 scenarios, builtin profile 204/204 scenarios and 2762 steps, direct coverage merged 376 LCOV records. `git diff --name-only 421863f6 HEAD` names only the Phase 1 and Phase 2 VERIFICATION.md files, so G2 covers every executable input of HEAD (`cd85fe2f`).
- **Named checks (this pass):** S9 (in the changed dispatch-exec.test.ts), S1, S4, S6 and S14 were run again, each under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. Each gave `tests 1, pass 1, fail 0, cancelled 0, skipped 0`.
- **Decision status:** checked against PROJECT.md. D-PG6-01/02/03 (:2401) and D-PG6-18 (:2409) are Locked by the maintainer review 2026-11-16. D-PG5-01 (:2396) and D-PG7-05 (:2413) are Good. The phase's own D-PG3-01..09 have no PROJECT.md row; D-CF4-05 (:2166) records their amendment. This report calls none of them pending.
- **Result:** no gap closed, no gap remaining, no regression. The score stays 31/31. The advisory below still applies: the real-child test filters were not changed.

## Verification Basis

The full re-check below is from the 2026-11-16T06:37:40Z pass. This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `f48729e3`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its caller, and the test or scenario that exercises it were read again. Citations are current line numbers. **H/** means `extensions/pi-claude-marketplace/bridges/hooks/`, and **A/** means `extensions/pi-claude-marketplace/bridges/agents/`.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`, Node v26.13.1). The log was inspected: all seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), then the unpaired and integration tests, whose diagnostics show real pi-subagents 0.88.1 children (`demo:runner`, `demo:granted`, `demo:plain`) in mode `background`, state `complete`, one `demo:plain` in mode `foreground`, and two concurrent generations of `demo:alpha`/`demo:beta` in one runner PID. The adapter profile ran 2098/2098 scenarios and 25964 steps (seed 700460). The builtin profile ran 204/204 scenarios and 2762 steps (seed 547387). Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD. The project's reuse rule applies, and the suite was not repeated.

**Independent named checks (this pass):** 16 single tests were run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>`, each under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. Each reported `tests 1, pass 1, fail 0, cancelled 0, skipped 0` (see Behavioral Spot-Checks). One extra scratch probe (not committed) dumped every hook run of a real ordinary child; see the advisory.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 3 must-haves |
| --- | --- | --- |
| D-PG6-01/02/03 (Phase 6, confirmed by the maintainer review 2026-11-16) | In a background child whose identity is known and whose launching session was resolved, tool hooks get the launching session in `session_id`, `transcript_path`, `CLAUDE_CODE_SESSION_ID` and `CLAUDE_SESSION_ID`. `agent_id` stays the child's own session. Internal keys (env file, journal owner, identity guard) stay on `ownSessionId` (H/translation-context.ts:57-74,131-152). | R4 and P03.1/P05.1/P06.1 still hold: `agent_type` and `agent_id` (the child's own session) are present in a child and absent in main. The "current child Pi session ID" now travels only in `agent_id`. Real children's rows now read `session main`, `transcript path session file of main`, `CLAUDE_CODE_SESSION_ID main` (subagent-child.feature:552-558). The earlier override for the unclassified probe row is resolved and **removed**. The real-child tests' filter moved from `session_id` to `agent_id`; see the advisory. |
| D-PG6-18 (Phase 6, confirmed by the maintainer review 2026-11-16) | `UserPromptExpansion` admitted and suppressed in a child (H/event-router.ts:177-178, :1135). | Additive. P01.2's "ten-event policy" is now eleven events, still exhaustive (`satisfies Record<BucketAEvent, ChildEventOutcome>`, :179) and still dispatching only the three tool events in a child. Test titles read "eleven-event policy" (event-router.test.ts:5285). |
| D-PG5-01 (Phase 5, Good) | `Stop` moved from `agent_settled` to `agent_before_settle`. | P05.2/P06.4 still hold on the new event: the child gate wraps both `agent_before_settle` (:1620-1626) and `agent_settled` (:1628-1638), the latter also dropping the cached last-assistant message. |
| D-PG7-05 (Phase 7, Good) | Agent frontmatter goes through YAML; `background` counts only `true` or `"true"`, both read as text `true` (A/convert.ts:1137-1139). | P07.2 still holds (frontmatter.feature:7 shows `async true` for both). Additive: `'"true"'` writes no `async` key (frontmatter.feature:73). |

## Goal Achievement

### Roadmap Success Criteria

| ID | Roadmap truth | Status | Current evidence |
| --- | --- | --- | --- |
| R1 | `subagent get` shows no `async false` line for a plain bridged agent; `background: true` and plugin-MCP agents still show the background mode; the old foreground-default scenario is replaced. | VERIFIED | A/convert.ts:1090 spreads `async: true` only for `backgroundForMcp \|\| isTrueBackground(raw.background)` (:1020, :1137). frontmatter.feature:7 asserts the exact `subagent get` results: no `async` line for `demo:plain`, `async true` for `true` and `"true"`, and the exact generated file with no `async` key. MCP agents: frontmatter.feature:423 runs `granted` and `granted-false` as background children under `asyncByDefault: false`. The old title "A call that leaves the launch mode open runs a bridged agent in the foreground" appears nowhere in `features/` or `test/`. Passed in G. |
| R2 | The MCP warning no longer says Claude Code runs agents in the foreground; a file holding the earlier warning still follows an MCP implementation switch at the next session start. | VERIFIED | A/mcp-async-warning.ts:39-41 emits `CORRECTED_WARNINGS` (:16-18,32-35). `isMcpAsyncWarning` (:44-46) and `rewriteMcpAsyncWarning` (:49-57) recognize both generations exactly and keep the found one; consumers A/grant-rewrite.ts:131, A/legacy-grant-form.ts:88,112. Exact public rows: verdict-markers.feature:338,372. Switch scenarios: agent-grants.feature:689 (old warning), :705 (reverse), :721 (implementation-less outline), :742 (user edit), :759 (near match). Passed in G; S6 here. |
| R3 | In the stand-in child of `subagent-child.feature`, recording `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd` hooks record no run, and `PreToolUse` still runs. | VERIFIED | H/event-router.ts:166-179 `CHILD_EVENT_POLICY`, :188-190 `dispatchesInCurrentSession`, gating `session_start` (:1504), `input` UPS (:1565), `session_before_compact` (:1538), `session_compact` (:1293), `session_shutdown` (:1226), `agent_before_settle` (:1624), `agent_settled` (:1632). Scenario subagent-child.feature:202 asserts the full run table (`recordTable` adds any unstated column, features/lib/field-rows.ts:93-99; exact compare at runs.steps.ts:164-167): only the four tool rows. SessionEnd fires at shutdown, after that table is read, so its half rests on the owner case `child routes SessionEnd by the eleven-event policy` (S1, drives the registered `session_shutdown` handler) and on this verifier's real-child probe (advisory). |
| R4 | A child tool hook receives `agent_type`, and `agent_id` when knowable; the same hook in a main session receives neither. | VERIFIED | Capture: H/runtime.ts:55 anchored prefix, :551-578 `captureChildIdentity` from Pi's structured prompt options, :580-593 `childIdentityFor` (main outside a child, unavailable for another session). Context: H/translation-context.ts:81-91,136,145-147 keeps the identity only for its own session. Translators spread both fields only then: payloads/pre-tool-use.ts:56-58, post-tool-use.ts:82-84, post-tool-use-failure.ts:78-80. Scenarios :401 (4 examples incl. entity decoding and a spoofed body), :443 (main: the table states no `agent type`/`agent id` column, so any present field would fail), :471, :503; real children :542, :568, frontmatter.feature:410,423. Passed in G; S11-S16 here. |

### Plan Observable Truths

| ID | Truth | Status | Current evidence |
| --- | --- | --- | --- |
| P01.1 | A child never reaps or rewrites the parent legacy PID table or another live runtime's journal. | VERIFIED | `reapOrphans` returns at once in a child (H/async-rewake/registry.ts:855-857). Child persistence goes to `childJournalPath(owner)` (:972, :997-1001) with `pidTableEntries(loc, owner)` (:975; H/runtime.ts:639-660 filters by owner). `ownerIsDead` (:1129-1136) gates journal reaping. S10 and S15 here; registry journal cases in G. |
| P01.2 | The exhaustive child event policy admits only the three tool events while retaining internal setup and owned cleanup. | VERIFIED | `CHILD_EVENT_POLICY` (now eleven events, see Superseded). Setup still runs before the gates (session_start routing rebuild and data directories at :1491-1494 precede the SessionStart gate at :1504). Child-only drain in `sessionShutdownCallback`'s `finally` (:1233-1235). S1-S3 here; 22 `{main,child} routes <event>` cases in G. |
| P01.3 | The anchored structured prefix yields a factory-local session identity; malformed or missing metadata clears stale identity with a bounded diagnostic. | VERIFIED | `resetChildIdentity` at registration (H/event-router.ts:1396; runtime.ts:545-549); capture/diagnostic at event-router.ts:331-335 (`CHILD_IDENTITY_DIAGNOSTIC`, :181-182). Scenario :503 asserts the diagnostic line and the cleared identity. Passed in G. |
| P02.1 | Recognition admits only complete exact strings; a near-match never gains migration eligibility. | VERIFIED | Strict `===` over `WARNING_GENERATIONS` (mcp-async-warning.ts:36,45). S6 here; agent-grants.feature:759 in G. |
| P02.2 | Both warning generations survive adapter/builtin round trips, including implementation-less rows. | VERIFIED | `rewriteMcpAsyncWarning` returns `forms[id]` of the found generation (:49-57); legacy-grant-form.ts:88,112; agent-grants.feature:689,705,721 in both profiles in G. |
| P02.3 | A user-edited generated file is preserved with provenance; locks, containment, atomic replacement and retry recovery stay intact. | VERIFIED | grant-rewrite.ts:131 changes only the candidate predicate; agent-grants.feature:742 in G; grant-rewrite owner cases in G. |
| P03.1 | PreToolUse includes actual `agent_type` and the child's own Pi session id on sync, plain async and asyncRewake. | VERIFIED | Sync: H/dispatch-exec.ts:228-229. Async lanes: registry.ts:364-365, translator at :369. Both use `childHookIdentityOf` + `buildTranslationContext`. The own session id is in `agent_id` (D-PG6-01). S14 and the registry identity cases in G. |
| P03.2 | Main, unavailable and stale-session contexts own neither identity property. | VERIFIED | translation-context.ts:136 drops an identity of another session; `childHookIdentityOf` gives none for main/unavailable (:82-84). S9 (`omits stale child identity from synchronous stdin`) here. |
| P03.3 | A captured payload keeps its identity when another runtime/session starts; Phase 2 translation and process ownership stay intact. | VERIFIED | Immutable snapshot copied into the context; persistence owner captured per dispatch (registry.ts:366-368). Scenario :471 in G; Phase 2 hook suites in G. |
| P04.1 | Fresh adapter/builtin output explains that MCP requires background and keeps the implementation suffix. | VERIFIED | `CORRECTED_WARNINGS` reuse `ADAPTER_SUFFIX`/`BUILTIN_SUFFIX` (:19-21,32-35); mcp-async-warning owner cases in G. |
| P04.2 | Conversion, staging, install and public diagnostics carry the corrected warning without duplicate or lost messages. | VERIFIED | convert.ts:1020-1022 pushes it once; verdict-markers.feature:338,372 exact rows; S5 (`either order ... with one warning`) here. |
| P04.3 | Historical stored warnings still switch exactly and user edits stay protected under both profiles. | VERIFIED | Same as R2/P02.3, both cucumber profiles in G. |
| P05.1 | Successful and failed child tool hooks carry the same identity as PreToolUse, Phase 2 semantics preserved. | VERIFIED | post-tool-use.ts:82-84, post-tool-use-failure.ts:78-80; scenario :401 asserts all four tool rows; real children in S12/S13. |
| P05.2 | A child's blocking main-session Stop hook cannot stop child completion; lifecycle and compaction hooks stay absent while main controls run. | VERIFIED | Stop gates at event-router.ts:1620-1638 (D-PG5-01 events). Scenarios :247 (Stop), :275 (compaction), :302 (main control) in G; real children reach `complete` with a blocking Stop hook (S12, S13). |
| P05.3 | Parent and sibling hook processes survive child load, writes, exit and reload; a verified dead owner is recoverable. | VERIFIED | Scenario :359 in G; S15 (`a child's load, hook, new session, and stop leave the parent's and a sibling's waiting hooks running with their records`) and S16 (`a main load stops the waiting hook of a child whose Pi died and keeps a live sibling's`) here. |
| P06.1 | Each child tool event carries identity through sync, plain async and asyncRewake, with main/stale/missing controls. | VERIFIED | dispatch-exec.ts:228-229, registry.ts:364-369; dispatch-exec and registry identity cases in G; S9. |
| P06.2 | The installed companion completes detached children with loopback fixtures and dummy credentials, without hand-injected identity. | VERIFIED | S12: `detached adapter children ... hook with their own identity`; identity comes from pi-subagents' own tag; G diagnostics show `providerModels` scripted runs under 0.88.1. |
| P06.3 | Concurrent same-PID children keep distinct sessions/types through append/replace modes, repeated runs and cleanup. | VERIFIED | Scenario :568 (four sessions, one runner PID) in G; integration case `concurrent child sessions in one runner process ...` (pi-subagents-child-identity.test.ts:367) in G. These children have no launch variable, so they keep their own `session_id` (D-PG6-01 fallback). |
| P06.4 | A main Stop hook that would block cannot prevent child completion; no parent/sibling process or journal is damaged. | VERIFIED | S12/S13 children `state: complete`; S15/S16. |
| P07.1 | Ordinary absent/false background emits no async key, including an empty body. | VERIFIED | convert.ts:1090; S4 (`D-PG3-01: an ordinary agent with an empty body leaves its launch mode to pi-subagents`). |
| P07.2 | Accepted true parsing and effective MCP grants emit async true; MCP wins over source false. | VERIFIED | Same expression; `granted-false` runs in the background (frontmatter.feature:423) in G. Parsing now per D-PG7-05 (see Superseded). |
| P07.3 | Reversing equivalent MCP grant order leaves launch preference and warning unchanged. | VERIFIED | S5 here (adapter); the builtin case in G. |
| P07.4 | The real companion picks its default or configured mode when preference is absent; explicit foreground controls keep their meaning. | VERIFIED | frontmatter.feature:410 (default: background), :423 (`asyncByDefault: false`: `demo:plain` foreground); S11 (`an ordinary agent runs in the foreground when pi-subagents' configuration makes the foreground its default`). |
| P08.1 | A normal load preserves earlier ordinary bytes; update and reinstall regenerate atomically and safely on retry. | VERIFIED | S7 (update-swap.test.ts:3264) and S8 (reinstall-flow.test.ts:1070) here; frontmatter.feature:145 (update) and :282 (reinstall) in G. |
| P08.2 | A real ordinary empty-body child with no call override completes with correct identity, three tool outcomes, zero lifecycle hooks, and preserved concurrent/main controls. | VERIFIED | S13 (`an ordinary builtin agent with an empty body runs detached ...`, pi-subagents-child-identity.test.ts:139-221) passes; the adapter case passes in G. "Zero lifecycle hooks" is no longer asserted by that test (advisory); the verifier's scratch probe of a real ordinary child observed none, and the stand-in scenarios assert it exactly. |
| P08.3 | Compatibility docs state event policy, identity provenance, conservative recovery, default/forced modes and migration boundaries. | VERIFIED | docs/hooks-compatibility.md:35-55 (policy), :57-79 (identity, incl. D-PG6-01 fields and the foreground gap), :81-85 (journals and recovery); docs/mcp-compatibility.md:484-505 (modes, the two `async: true` cases, migration at update/reinstall, both warning generations). Checked against the code above. |

**Score:** 31/31 truths verified (4 roadmap + 27 plan, 0 present but behavior-unverified). Every behavior-dependent truth has a passing named test from this pass or from G.

### Decision Coverage

D-PG3-01..09 honored (9/9, traced by hand; `query check.decision-coverage-verify` returned `skipped: CONTEXT.md missing` for this phase directory although `03-CONTEXT.md` exists, so the tool gave no verdict). 01/02 in convert.ts:1090,1137; 03 in S7/S8 and two-generation recognition; 04/05 in `CHILD_EVENT_POLICY` and the retained setup and drain; 06 in prompt-tag identity with session binding and no fabrication (now with D-PG6-01's root fields beside it); 07 in the Phase 2 suites under G; 08 in the replaced and added scenarios; 09 in the real-companion driver and integration tests (S11-S16).

### Required Artifacts

`query verify.artifacts` exited 0 for all eight plans: **31/31** declared artifacts exist and are substantive. All 48 previously covered non-planning files still exist; none was deleted or renamed.

### Key Link Verification

`query verify.key-links` exited 0 for all eight plans (16/16). Current connections:

| Plan | From -> To | Current connection | Status |
| --- | --- | --- | --- |
| 01 | event-router -> runtime | `captureChildIdentity` :331, `childIdentityFor` :332 | WIRED |
| 01 | registry -> runtime | `persistenceOwner` :367, `pidTableEntries(loc, owner)` :975 | WIRED |
| 02 | legacy-grant-form -> mcp-async-warning | `rewriteMcpAsyncWarning` :88,:112 | WIRED |
| 02 | grant-rewrite -> mcp-async-warning | `isMcpAsyncWarning` :131 | WIRED |
| 03 | dispatch-exec -> translation-context | `childIdentityFor` + `buildTranslationContext` :228-229 | WIRED |
| 03 | registry -> payloads/pre-tool-use | `buildTranslationContext` :365, `TRANSLATORS[...]` :369 | WIRED |
| 04 | convert -> mcp-async-warning | `mcpAsyncWarning` :1022 | WIRED |
| 04 | agent-grants.feature -> verdict-markers.feature | both-profile migration and diagnostics | WIRED |
| 05 | translation-context -> payloads/post-tool-use | `ctx.childIdentity` :82-84 | WIRED |
| 05 | subagent-hooks.steps -> subagent-hook-session | `createSubagentHookSession` | WIRED |
| 06 | real-subagent-child -> companions | `resolveCompanion` | WIRED |
| 06 | integration test -> real-subagent-child | `runRealSubagentChild` / `runConcurrentRealSubagentChildren` (:36-40) | WIRED |
| 07 | convert -> grant-forms | `async` / `backgroundForMcp` | WIRED |
| 07 | frontmatter.feature -> real-subagent-child | `asyncByDefault` (:411,:424) | WIRED |
| 08 | frontmatter.feature -> update-swap.test | update/reinstall scenarios :145,:282 | WIRED |
| 08 | integration test -> real-subagent-child | `runRealSubagentChild` | WIRED |

### Data-Flow Trace (Level 4)

| Value | Source -> consumer | Real data | Status |
| --- | --- | --- | --- |
| `agent_type` | pi-subagents `<active_agent>` tag in Pi's prompt options -> `captureChildIdentity` -> context -> translators -> hook stdin | Yes. Real children in S12/S13 carry the agent name. | FLOWING |
| `agent_id` | Child's own `sessionManager.getSessionId()` -> `childId` -> context `childIdentity.sessionId` -> stdin | Yes. Equals the child session id the driver records. | FLOWING |
| `session_id` in a child | `PI_SUBAGENT_PARENT_SESSION` + header `parentSession` -> `recordChildRoot` -> context (D-PG6-01) | Yes. Rows read `main`. | FLOWING |
| Generated `async` | Source `background` / MCP grants -> convert.ts:1090 -> agent file -> `subagent get` | Yes. Exact file and get output asserted. | FLOWING |
| MCP warning | `mcpAsyncWarning` -> staging warnings -> notification row | Yes. Exact rows in verdict-markers. | FLOWING |

### Behavioral Spot-Checks

All runs used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each gave `tests 1 / pass 1 / fail 0 / cancelled 0 / skipped 0`.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| S1 | child routes SessionEnd by the eleven-event policy | test/bridges/hooks/event-router.test.ts | PASS |
| S2 | child routes Stop by the eleven-event policy | test/bridges/hooks/event-router.test.ts | PASS |
| S3 | child routes PreToolUse by the eleven-event policy | test/bridges/hooks/event-router.test.ts | PASS |
| S4 | D-PG3-01: an ordinary agent with an empty body leaves its launch mode to pi-subagents | test/bridges/agents/convert.test.ts | PASS |
| S5 | D-PG3-02: either order of equivalent adapter MCP grants runs in the background with one warning | test/bridges/agents/convert.test.ts | PASS |
| S6 | recognizes only the complete historical warning for its implementation | test/bridges/agents/mcp-async-warning.test.ts | PASS |
| S7 | D-PG3-03: a load keeps an earlier ordinary agent's async false bytes and an update regenerates the agent without a launch preference | test/orchestrators/plugin/update-swap.test.ts | PASS |
| S8 | D-PG3-03 / NFR-3: a reinstall whose state save fails restores an earlier ordinary agent's async false bytes, and its retry regenerates the agent | test/orchestrators/plugin/reinstall-flow.test.ts | PASS |
| S9 | omits stale child identity from synchronous stdin | test/bridges/hooks/dispatch-exec.test.ts | PASS |
| S10 | keeps journal owners and PID rows separate by session and runtime | test/bridges/hooks/runtime.test.ts | PASS |
| S11 | an ordinary agent runs in the foreground when pi-subagents' configuration makes the foreground its default | test/integration/pi-subagents-child-identity.test.ts | PASS |
| S12 | detached adapter children of a background agent and an MCP agent hook with their own identity | test/integration/pi-subagents-child-identity.test.ts | PASS |
| S13 | an ordinary builtin agent with an empty body runs detached in pi-subagents' default mode and hooks only its tools with its own identity | test/integration/pi-subagents-child-identity.test.ts | PASS |
| S14 | gives a known child's root with its identity (D-PG6-02) | test/bridges/hooks/translation-context.test.ts | PASS |
| S15 | a child's load, hook, new session, and stop leave the parent's and a sibling's waiting hooks running with their records | test/integration/subagent-hook-ownership.test.ts | PASS |
| S16 | a main load stops the waiting hook of a child whose Pi died and keeps a live sibling's | test/integration/subagent-hook-ownership.test.ts | PASS |
| P | scratch probe: every hook run of a real ordinary adapter child (not committed) | scratchpad only | child rows: PreToolUse/PostToolUse Bash only; no child lifecycle run |
| G | `npm run check` at `1183aae3` (earlier pass) | root scripts, both cucumber profiles | PASS (reused) |
| G2 | `npm run check` at `421863f6` (same executable inputs as HEAD `cd85fe2f`) | root scripts, both cucumber profiles, `/tmp/pg-final2.log` | PASS (reused) |

### Probe Execution

No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` is in scope. Not applicable.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-AGENT-01 | 03-02, 03-04, 03-06, 03-07, 03-08 | SATISFIED | R1, R2, P02, P04, P07, P08.1. REQUIREMENTS.md:38 `[x]`, trace :186 Complete. The migration clause (REQUIREMENTS.md:16) is met: `async: false` changes at update/reinstall, not at load. |
| PG-HOOK-07a | 03-01, 03-03, 03-05, 03-06, 03-08 | SATISFIED | R3, R4, P01, P03, P05, P06, P08.2. REQUIREMENTS.md:27 `[x]`, trace :178 Complete. Its unclassified probe row is closed by D-PG6-01 (PROJECT.md:2401). |

No orphaned requirement: REQUIREMENTS maps only these two IDs to Phase 3, and both appear in plan frontmatter.

### Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| All 52 covered non-planning files | Unreferenced TBD / FIXME / XXX / TODO / HACK | None | No match |
| Same scope | `.skip` / `.only` / `.todo`, `@skip`/`@wip` | None | One platform-conditional `{ skip: FIFO_SKIP }` at reinstall-flow.test.ts:7551, unrelated to Phase 3 |
| A/mcp-async-warning.ts:1-8 | Stale header (flagged last time) | None | Fixed: the header now says MCP agents always launch in the background (D-PG3-02) and that the first generation's foreground claim stays recognized for stored rows (D-PG3-03) |
| Real-child test filters | Child lifecycle runs no longer observable | Advisory | See below |
| Files changed since `171d884f` (two docs, two tests) | Unreferenced TBD / FIXME / XXX | None | No match |
| docs/mcp-compatibility.md:435 | "This display is part of the pending review of D-PG7-17." | Info | Outside Phase 3 (a Phase 7 decision). D-PG7-17 is Locked (PROJECT.md:2416), so the sentence is stale; `421863f6` did not change it. Not edited here: this pass edits only this report |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why advisory |
| --- | --- | --- | --- |
| 1 | Since f3250f3b (D-PG6-01), `childRuns` (pi-subagents-child-identity.test.ts:119-121) and the cucumber real-child step (subagent-hooks.steps.ts:612-645) select a child's runs by `agent_id`, which only tool payloads carry, and the main controls take only the first six main runs (`.slice(0, 6)`). A child lifecycle run would now pass unseen, because it would carry the launching session's `session_id` and no `agent_id`. Before f3250f3b, `runsOf` filtered by `session_id === child`. | other | No behavior defect: the stand-in scenarios assert every run of a child-marked Pi exactly, the owner cases cover each event, and the scratch probe of a real child saw no lifecycle run. To resolve: give the real-child assertions a child discriminator so such a run fails again. |

### Human Verification Required

None. The earlier report's single item (the child session fields) was decided by D-PG6-01 and shipped, and its override is removed.

### Gaps Summary

No gaps and no regressions. The 2026-11-17 pass found that the staleness came from wording-only doc edits and two unrelated test changes, and it changes no verdict. On the current tree, all four roadmap criteria and all 27 plan must-haves of Phase 3 still hold, with citations updated to current lines. Four later decisions changed mechanisms that the phase relies on, all without breaking a criterion. D-PG6-01/02/03 moved the child's `session_id` family to the launching session and kept `agent_id` on the child, which closes the old override. D-PG6-18 grew the child policy to eleven events. D-PG5-01 moved Stop to `agent_before_settle`. D-PG7-05 changed how `background` is parsed. One advisory: the real-child tests lost their view of a child's lifecycle runs when D-PG6-01 changed their filter. The behavior still holds, and other tests cover it.

---

_Verified: 2026-11-17T03:28:27Z (staleness re-check; full re-check 2026-11-16T06:37:40Z)_
_Verifier: Claude (gsd-verifier)_

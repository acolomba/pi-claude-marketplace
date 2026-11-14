---
phase: 05-stop-continuation-and-hook-failures
verified: 2026-11-14T18:55:15Z
status: passed
score: 6/6 must-haves verified (1 override)
covered_files:
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-01-PLAN.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-01-SUMMARY.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-02-PLAN.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-02-SUMMARY.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-03-PLAN.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-03-SUMMARY.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-04-PLAN.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-04-SUMMARY.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-05-PLAN.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-05-SUMMARY.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-06-PLAN.md"
  - ".planning/phases/05-stop-continuation-and-hook-failures/05-06-SUMMARY.md"
  - "CHANGELOG.md"
  - "docs/hooks-compatibility.md"
  - "docs/output-catalog.md"
  - "docs/research/claude-hooks-vs-pi-events.md"
  - "docs/research/issue-103-stop-stopfailure-promotion.md"
  - "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/runtime.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/settle.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/timeout.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts"
  - "extensions/pi-claude-marketplace/domain/components/hook-events.ts"
  - "extensions/pi-claude-marketplace/platform/pi-api.ts"
  - "extensions/pi-claude-marketplace/shared/atomic-json.ts"
  - "features/hook/additional-context.feature"
  - "features/hook/async.feature"
  - "features/hook/failures.feature"
  - "features/hook/messages.feature"
  - "features/hook/prompt-and-stop.feature"
  - "features/lib/boundary-continuer.ts"
  - "features/lib/boundary-refuser.ts"
  - "features/lib/hook-files.ts"
  - "features/lib/hook-recorder.ts"
  - "features/lib/run-start-probe.ts"
  - "features/plugin/subagent-child.feature"
  - "features/step_definitions/hook/additional-context.steps.ts"
  - "features/step_definitions/hook/async.steps.ts"
  - "features/step_definitions/hook/messages.steps.ts"
  - "features/step_definitions/hook/prompt-and-stop.steps.ts"
  - "features/step_definitions/plugin/subagent-hooks.steps.ts"
  - "features/support/world.ts"
  - "test/architecture/closed-set-enrollment.test.ts"
  - "test/architecture/hooks-lifecycle.test.ts"
  - "test/bridges/hooks/async-rewake/async-answer.test.ts"
  - "test/bridges/hooks/async-rewake/registry.test.ts"
  - "test/bridges/hooks/context-cap.test.ts"
  - "test/bridges/hooks/dispatch-exec.test.ts"
  - "test/bridges/hooks/dispatch.test.ts"
  - "test/bridges/hooks/event-adapters.test.ts"
  - "test/bridges/hooks/event-router.test.ts"
  - "test/bridges/hooks/exec-result.test.ts"
  - "test/bridges/hooks/exec-timer.test.ts"
  - "test/bridges/hooks/hook-labels.test.ts"
  - "test/bridges/hooks/hook-output-files.test.ts"
  - "test/bridges/hooks/on-failure.test.ts"
  - "test/bridges/hooks/runtime.test.ts"
  - "test/bridges/hooks/settle.test.ts"
  - "test/bridges/hooks/stream-text.test.ts"
  - "test/bridges/hooks/wire-protocol.test.ts"
  - "test/e2e/_rpc.ts"
  - "test/index.test.ts"
  - "test/live-uat/README.md"
  - "test/live-uat/manifest-absence-canary.mjs"
  - "test/live-uat/openai-stub-server.mjs"
  - "test/pi-runtime.ts"
  - "test/platform/pi-api.test.ts"
  - "test/shared/atomic-json.test.ts"
covered_digest: "v4:sha256:fa2b56c33cb6d057f6e1725716eb54c1e852e835dd99ffe3850955033cc941a8"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "a reload still stops a plain async hook that is running"
    reason: "Met on Linux, where the orphan reap can prove a live process is the hook (D-62-05). On macOS and Windows a reload never stopped a live async hook process (the reap is Linux-only), and D-PG5-18 accepts that a plain async hook that never ends has no bound there. The compatibility page states this residual (6580f5f8)."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T18:55:15Z"
gaps_closed:
  - truth: "The page says in the `timeout` and `async` rows that a plain `async` hook has no timeout, and that on macOS and Windows nothing stops one that never ends"
    closed_by: "6580f5f8 docs(hooks): say a reload stops plain async hooks only on Linux (rows `timeout`, `async`, `Long-running handlers`; 05-06-SUMMARY Deviation 3 correction note)"
---

# Phase 5: Stop Continuation and Hook Failures Verification Report

**Phase Goal:** A `Stop` hook that blocks continues the same run, as in Claude Code. A hook that fails, names a missing script, returns too much context, or runs in the background behaves as it does there.
**Verified:** 2026-11-14T18:55:15Z
**Status:** passed (gap 1 closed by 6580f5f8 after initial verification; one override)
**Re-verification:** No, initial verification

All five roadmap success criteria hold in the code at HEAD. Each has a cucumber scenario and owner tests, and they passed in the phase gate. One plan must-have fails: the compatibility page understates the platform residual of D-PG5-18. That is a documentation gap only, and the fix is small. The code does not change.

## Gate evidence

- Phase gate, which the orchestrator ran and I did not rerun: `/tmp/pg5-phasegate-check.log` names commit `59e6f5f7`. The log was written 14 minutes after that commit. The chain is `check:static && test:unpaired && test:integration && test:cucumber && test:coverage:direct:all`, so `exit=0` covers every member. The `adapter` profile ran 1935 scenarios and the `builtin` profile ran 184, all passed, with none skipped or undefined. The merged direct coverage has 364 records.
- `git diff --stat 59e6f5f7..HEAD` shows one changed file, `05-VALIDATION.md`. So the build inputs at HEAD are the same as those the gate checked.
- My spot checks, all under `test/platform/isolated-pi-home.ts`, none of which touched the real `~/.pi/agent`:
  - `settle`, `wire-protocol`, `context-cap`, `hook-labels`, and `exec-timer` owner tests: 274/274 pass.
  - `registry.test.ts --test-name-pattern=plain`: 29/29 pass.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (PG-HOOK-02): a run that a `Stop` hook blocks twice raises one `agent_settled` and shows no second run start. An always-blocking hook still makes eight re-entries before the limit notice. | VERIFIED | **Code:** the Stop bucket runs on `agent_before_settle` (`event-router.ts:1322-1328` -> `settle.ts:181-224`). The handler returns `{ entries: [...event.entries, stopBlockDraft], continue: true }` (`settle.ts:216-218`). The draft is a hidden `custom_message` of type `claude-hook-stop-block` (`settle.ts:247-255`). The handler never returns `continue: false`. `agent_settled` runs no Stop (`settle.ts:309-310`) and keeps StopFailure (`:312-323`). `pi.sendMessage` followUp re-entry is gone from `settle.ts`. The cap is `STOP_OVERRIDE_CAP = 8` (`runtime.ts:20`) through `continuesBounded` (`settle.ts:627-643`). **Scenarios:** `prompt-and-stop.feature:39` gives counts `run starts 1, model calls 3`. The turn ends at its first `agent_settled` (steps header `prompt-and-stop.steps.ts:24-28`), so three model calls inside that turn prove that only one settlement happened. Run starts come from the `before_agent_start` probe (`features/lib/run-start-probe.ts`). `prompt-and-stop.feature:130` shows nine replies, `stop hook active` true from the second, cap notice count 1, and counts `1 / 9`. **Gate:** `test/architecture/hooks-lifecycle.test.ts:398` pins the registration. |
| 2 | SC2 (PG-HOOK-23): a `Stop` hook that names a missing script lets the run end and shows one failure notice. A prompt hook that names a missing script does not block the prompt. | VERIFIED | **Code:** `wire-protocol.ts:57-66` matches only `Stop` and `UserPromptSubmit`, with blank stdout and stderr matching `/no such file\|can't open/i`. `exitTwoResult` returns a `noop` that carries a `missing-script` failure (`:144-148`). The notice text is built in `hook-labels.ts:203-227`. **Scenarios:** `failures.feature:86` (Stop) gives one model call and exactly one notice. `failures.feature:60` (UserPromptSubmit) shows that the prompt reaches the model, with one notice. The `messages.steps.ts:96-104` step compares the notice list exactly. The Outline row at `failures.feature:7` keeps `onFailure: block` blocking. **Owner:** `wire-protocol.test.ts` "the exit 2 of a missing script" (the eight other events still block). |
| 3 | SC3 (PG-HOOK-14): a hook that exits 1 with `boom` on stderr shows one notice that holds `boom`. A `UserPromptSubmit` `continue: false` with a `stopReason` shows that reason. | VERIFIED | **Code:** `wire-protocol.ts:169-179` returns a noop with an `exit` failure. `dispatch.ts:702-731` builds `failureNotices`, with one notice per hook and the edit-pair duplicates folded. `hook-labels.ts:172-227` keeps the first stderr line and cuts it at 200 characters. `event-adapters.ts:687-695` shows `promptStoppedText` and returns `handled`. **Scenarios:** `failures.feature:34` shows exactly one notice, `UserPromptSubmit hook error: Failed with non-blocking status code: boom`, and the prompt still reaches the model. `messages.feature:245` shows `Operation stopped by hook: not now`. The PreToolUse and Stop stop reasons are at `messages.feature:265`, `:162`, `:188`, and `:219`. |
| 4 | SC4 (PG-HOOK-14): a hook that prints 12,000 characters of context sends at most 10,000 to the model. | VERIFIED | **Code:** `context-cap.ts:81-95` passes a string of 10,000 characters or fewer unchanged. A longer string is saved through an injected writer and replaced by the `<persisted-output>` wrapper. If the write fails, the fallback text is cut to 10,000 (`:69-76`). The synchronous lane calls the cap at `dispatch-exec.ts:279-295`, and the plain-async answer lane at `async-rewake/registry.ts:723`. **Scenario:** `additional-context.feature:120` checks size `11.7KB`, a 2000-character preview, 12000 saved characters, and the path under `_shared/hook-output/`. The step asserts `wrapper.length <= 10000` and that the file starts with the preview (`additional-context.steps.ts:77-79`). **Owner:** `context-cap.test.ts` (the 10,000 boundary, the write failure). |
| 5 | SC5 (PG-HOOK-21): a plain `async` hook with `timeout: 1` that sleeps 3 seconds writes its end marker, and a reload still stops a plain `async` hook that is running. | VERIFIED (Linux) | **Code:** `registry.ts:247-258`: in the plain lane, `ladderFor` returns `INERT_TIMER_LADDER` and debug-logs the ignored `timeout`. The `asyncRewake` lane keeps `installTimerLadder` (`:260-268`). **Scenarios:** `async.feature:261` expects `slow \| end \| 3`. The hook reaches its own `exit 3` only when nothing kills it during `sleep 3`, and the 05-05 red run gave `end \| 0` on the old tree. `async.feature:432` shows no hook process running after `/reload`; its red run with `killOrphanGroup` neutralized left the pid running. `async.feature:470` shows that `asyncRewake` keeps its ladder. **Owner:** `registry.test.ts:3544`, `:3581`, plus 29 plain-lane cases (all pass). The reload stop goes through the Linux-only reap (`registry.ts:884-889`). Before this phase, a reload also stopped the hook through the reap only, so "still" holds on every platform. Outside Linux, though, a reload does not stop a running plain hook. See the proposed override and gap 1. |
| 6 | 05-06 must-have: the page says in the `timeout` and `async` rows that a plain `async` hook has no timeout, and that on macOS and Windows nothing stops one that never ends. | VERIFIED (after fix 6580f5f8; initially FAILED) | The `docs/hooks-compatibility.md:292-293` rows carry no platform residual. Row `:293` implies that `/reload` stops the hook everywhere. Row `:482` limits the residual to "quits or crashes", based on an incorrect deviation claim (05-06-SUMMARY:117-119). See `gaps`. |

**Score:** 5/6 truths verified (0 present, behavior-unverified)

### Other plan must-haves spot-checked (all VERIFIED)

- `Stop` still does not run in a subagent child (D-PG3-04): `event-router.ts:1327` (`dispatchesInCurrentSession("Stop")`); the `features/plugin/subagent-child.feature` main-session scenario.
- `StopFailure` shows no notice and stays on `agent_settled` (D-PG5-03): `settle.ts:564-612`.
- A `continue: false` Stop line is held and shown only at `agent_settled`, and dropped when the run goes on (D-PG5-13, WR2-01, IN3-04): `settle.ts:151-153`, `:289-296`, `:528`; `messages.feature:188` (now asserts the second run's distinct `finished for today`), `:219`.
- Saved hook output disclosure (05-06 judgment-tier prohibition): `docs/hooks-compatibility.md:400-404` names both scope folders, the project-folder-in-VCS note, the 30-day removal, and the sweep's limits. CHANGELOG.md:23 names the folder. The LLM-judge verdict, which is not authoritative, is **satisfied**. It is flagged for human confirmation.
- CHANGELOG.md:19-24 holds six reader-facing lines under Unreleased.
- No mode branch: `requireNotificationMode` accepts `tui`, `print`, `json`, and `rpc` (`shared/notification-run.ts:13-19`). The one boundary handler serves all four.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `bridges/hooks/settle.ts` | `beforeSettleHandlerFor`, boundary continuation, held stop reason | VERIFIED | Substantive (643 lines); wired at `event-router.ts:1325`, `:1333` |
| `bridges/hooks/wire-protocol.ts` | missing-script rule, non-blocking failure noop | VERIFIED | `:57-66`, `:144-148`, `:169-179` |
| `bridges/hooks/hook-labels.ts` | failure, missing-script, and stop texts | VERIFIED | consumed by `dispatch.ts`, `event-adapters.ts`, `settle.ts` |
| `bridges/hooks/context-cap.ts` | 10,000-character cap with injected writer | VERIFIED | called at `dispatch-exec.ts:293`, `registry.ts:723` |
| `bridges/hooks/hook-output-files.ts` | atomic, contained save; 30-day sweep | VERIFIED | sweep wired at `event-router.ts:1145`, `:1373` |
| `bridges/hooks/async-rewake/registry.ts` | no timer on the plain lane; stream bound | VERIFIED | `ladderFor` `:247-268`, `streamBoundFor` `:207-238` |
| `features/lib/run-start-probe.ts` | `before_agent_start` counter | VERIFIED | used by `prompt-and-stop.steps.ts:208` |
| `docs/hooks-compatibility.md` | corrected Stop, failure, limit, and async statements | PARTIAL | Stop, failure, limit, and saved-file passages correct; async platform residual wrong (gap 1) |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `event-router.ts` | `settle.ts beforeSettleHandlerFor` | `pi.on("agent_before_settle")` `:1322-1328` | WIRED |
| `settle.ts` | `dispatch.ts failureNotices/showHookNotice` | `showStopNotices` `:420-440` | WIRED |
| `dispatch-exec.ts` | `context-cap.ts capHookContext` | `withCappedContext` `:279-295` | WIRED |
| `registry.ts` | `context-cap.ts capHookContext` | plain answer send `:723` | WIRED |
| `registry.ts spawn` | `ladderFor` (inert for plain) | `:379` | WIRED |
| `event-adapters.ts adaptInputResult` | `promptStoppedText` | `:687-695` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Stop boundary, cap, notices, cap function, labels, timer | `node --import test/platform/isolated-pi-home.ts --test settle/wire-protocol/context-cap/hook-labels/exec-timer` | 274/274 pass | PASS |
| Plain async lane (no timer, reload walk, reap, answer cap, stream bound) | `... --test-name-pattern=plain registry.test.ts` | 29/29 pass | PASS |
| All scenarios cited above | phase gate log (not rerun) | 1935 + 184 passed, exit 0 | PASS |

### Probe Execution

Not applicable. The phase declares no `scripts/*/tests/probe-*.sh`. The one-time research probes (M2-M17) are measurements that `05-RESEARCH.md` records. They are not committed probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| PG-HOOK-02 | 05-01, 05-06 | SATISFIED | Truth 1 |
| PG-HOOK-23 | 05-03 | SATISFIED | Truth 2 |
| PG-HOOK-14 | 05-02, 05-03, 05-04 | SATISFIED | Truths 3, 4 |
| PG-HOOK-21 | 05-05 | SATISFIED (Linux bound for reload; see override) | Truth 5 |

No orphaned requirements. REQUIREMENTS.md maps exactly these four IDs to Phase 5 (rows 179 and 182-184). Their checkboxes still read Pending. The orchestrator updates them at phase completion.

### Anti-Patterns Found

The added lines of the phase's 70 changed files under `extensions/`, `features/`, `test/`, and `docs/`, plus `CHANGELOG.md` (`11ec103b..HEAD`), hold no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` marker. I found no stub.

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `docs/hooks-compatibility.md` | 293, 482 | Platform residual misstated | Warning (counted as gap 1) | A macOS or Windows user who reads that `/reload` stops a plain `async` hook is wrong |

### Known items classified

| Item | Classification |
|---|---|
| IN-01, skipped and tracked as BACKLOG HOOKTIMEDOUTEXIT2-01 | Deferred by record; not a phase-5 criterion. No gap. |
| A1 (a follow-up typed while a Stop hook runs may lose its UserPromptSubmit context) | Source-read edge, marked unmeasured on the page (D-PG5-07). Info. No criterion depends on it. |
| A3 (does upstream deliver an async answer to the call after a Stop block?) | Upstream unknown, marked on the page. Info. |
| A6 (probes ran on Linux only) | Platform residual. It is the source of the SC5 override and of gap 1's doc correction. |
| A9 (Node 24 wording of a spawn `ENOENT`) | Open until CI runs on Node 24. The `failures.feature` start-failure scenario pins `spawn missing-guard.sh ENOENT`. The local gate ran on Node 26.13.1. The PR's CI run settles it. Human/CI item. |
| json and print mode Stop continuation, with no scenario | Warning, human item. The one handler has no mode branch, and `requireNotificationMode` admits all four modes. Research measured both modes once (M2, M3, M6, M7). The harness drives `rpc` and the terminal only. |
| WR3-01, IN3-01..04 (review iteration 3) | All fixed per 05-REVIEW-FIX.md. IN3-04 confirmed in `messages.feature:188`, which now has a distinct second-run reason. |
| D-PG5-10, -11, -13, -15, -18 pending maintainer review | Product decisions, implemented as decided. Not a verification gap. |

### Human Verification Required

These items are recorded here so that they are not lost under `gaps_found`.

1. **Saved hook output disclosure (judgment-tier prohibition, 05-06).**
   - **Test:** Read `docs/hooks-compatibility.md:400-404` and `CHANGELOG.md:23`.
   - **Expected:** A user learns where hook output is saved, in each scope, and that it is removed after 30 days.
   - **Why human:** This is a judgment-tier prohibition. The LLM verdict (satisfied) is not authoritative.
2. **Stop continuation in `json` and `print` mode.**
   - **Test:** Run `pi -p` or `--mode json` with an always-blocking Stop hook and the scripted model.
   - **Expected:** Eight continuations, one cap notice, and one `agent_settled`.
   - **Why human:** No committed scenario covers these modes. Research measured them once.
3. **A9 on Node 24.**
   - **Test:** The CI run of the PR.
   - **Expected:** `failures.feature` "A prompt hook that cannot start lets the prompt through and shows its error" passes on Node 24.
   - **Why human/CI:** The local gate ran on Node 26 only.

### Proposed override (for the orchestrator to record)

SC5's second clause holds on Linux, the platform that CI and every scenario use. On macOS and Windows, a `/reload` does not stop a running plain `async` hook. The orphan reap is the only production stop, and it kills a live process only on Linux (D-62-05). D-PG5-18 accepts that residual, pending maintainer review. This is a recorded decision, not a missing implementation:

```yaml
overrides:
  - must_have: "a reload still stops a plain async hook that is running"
    reason: "Met on Linux, where the orphan reap can prove a live process is the hook (D-62-05). On macOS and Windows a reload never stopped a live async hook process (the reap is Linux-only), and D-PG5-18 accepts that a plain async hook that never ends has no bound there. The compatibility page must state this residual (see gap 1)."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T18:55:15Z"
```

Gap 1 still stands after this override. The override accepts the behavior. The gap is that the page does not tell the user about it.

### Gaps Summary

One gap, documentation only. The 05-06 executor believed that `/reload` stops a plain `async` hook on every system through `runtime.shutdownChildren()` (05-06-SUMMARY Deviation 3). It therefore placed the macOS and Windows residual only in the `Long-running handlers` row and limited it to quit or crash. It also left the `timeout` and `async` rows without the residual that the plan's must-have requires.

The code says otherwise. Pi builds a new hooks runtime for every load, and `event-router.ts:1124-1130` says so. A `/reload` therefore stops an earlier load's hook only through the orphan reap, which is Linux-only. The 05-05 red run (async.feature:432 with `killOrphanGroup` neutralized) demonstrates it.

The fix is a few sentences in `docs/hooks-compatibility.md` rows 292, 293, and 482, plus a correction to the 05-06 summary record. No code changes. With the override recorded and the page corrected, the phase passes, and the three human items above remain for UAT.

---

_Verified: 2026-11-14T18:55:15Z_
_Verifier: Claude (gsd-verifier)_

## Gap closure (orchestrator, 2026-11-14)

Gap 1 is closed by 6580f5f8. The `timeout` and `async` rows now state that on macOS and Windows nothing stops a plain `async` hook that never ends, and that on Linux a `/reload` or the next start stops it. The `Long-running handlers` row now covers `/reload`, a new session and the next start. 05-06-SUMMARY Deviation 3 carries a correction note. The change is docs-only, so the phase gate at 59e6f5f7 still covers the code. The override above is recorded, pending maintainer review.

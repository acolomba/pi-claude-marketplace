# Phase 5: Stop Continuation and Hook Failures - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 05-stop-continuation-and-hook-failures
**Areas discussed:** Stop continuation, Missing script, Failure notices and `stopReason`, The 10,000-character limit, Plain `async` hooks, Records and evidence
**Mode:** autonomous discuss (`--auto`). The user said "just go ahead without asking me", so no question was asked. Each question took its recommended answer. The answers that are product calls or hard to undo are marked **pending maintainer review**.

[--auto] Selected all gray areas: Stop continuation, Missing script, Failure notices and `stopReason`, The 10,000-character limit, Plain `async` hooks, Records and evidence.
[auto] No todo matched this phase (`todo.match-phase 5` returned none). No CONTEXT.md, checkpoint, plan, or SPEC.md existed.

---

## Stop continuation (PG-HOOK-02)

### Q1 (costly to undo): On which event does `Stop` run, and in which modes?

| Option | Description | Selected |
|--------|-------------|----------|
| `agent_before_settle` in every mode | The handler appends one hidden message and returns `continue: true`. One `agent_settled` for a run. | ✓ |
| `agent_before_settle` in print mode, `agent_settled` elsewhere | Ships only what spike S1 measured. Leaves the false "finished" events in the terminal and RPC modes. | |
| Keep `agent_settled` | The PRD rejected it as the main path after spike S1. | |

**Choice:** `agent_before_settle` in every mode. Not held for review: the requirement names the event.
**Notes:** Pi 1.5.0 source shows one run loop for every mode. `event.outcome` is `completed` for a `length` ending too, so the handler still reads the last assistant message's `stopReason`.

### Q2 (reversible): Does a fallback path ship?

| Option | Description | Selected |
|--------|-------------|----------|
| Only if research measures a mode that fails | Research runs the unmeasured cases first. A failing mode alone keeps the `agent_settled` re-entry. | ✓ |
| Always ship both paths | Two paths to test and document for a case nobody has seen. | |

**Choice:** decided autonomously, only on a measured need. The cucumber harness already runs Pi 1.5.0 over RPC, so the phase's own scenarios measure two of the open cases.

### Q3 (reversible): Where does `StopFailure` run?

Decided autonomously: it stays on `agent_settled` with the `agent_end` cache. Only the `Stop` arm moves. The hooks report proposes the same.

### Q4 (reversible): Do the limit of eight and `stop_hook_active` change?

Decided autonomously: no. The counters move with the handler. `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` is not read, because REQUIREMENTS lists it as out of scope.

### Q5 (reversible): What does `continue: false` from a `Stop` hook return to Pi?

Decided autonomously: nothing for `continue`. The bridge asks for no continuation and does not veto one that another extension asked for.

### Q6 (reversible): Does the `asyncRewake` wake move too?

Decided autonomously: no. A wake starts a run when Pi is idle, which is what upstream does.

### Q7 (reversible): Does the bridge imitate the run start it no longer gets?

Decided autonomously: no. Research lists what relied on the extra run start (context drains, `nextTurn` answers of `async` hooks, the rewake mark) and confirms that none needs it.

---

## Missing script (PG-HOOK-23)

### Q1 (reversible): Which runs count as a missing script?

| Option | Description | Selected |
|--------|-------------|----------|
| The 2.1.323 rule | Exit 2, empty stdout, stderr matches `/no such file\|can't open/i`, on `Stop` and `UserPromptSubmit`, synchronous hooks. | ✓ |
| Every event that can block | Wider than upstream: a `PreToolUse` policy hook with a broken path would stop guarding without `onFailure`. | |
| Check the script path on disk | Not what upstream does, and a shell-form command has no single path to check. | |

**Choice:** decided autonomously, the 2.1.323 rule.

### Q2 (reversible): What does such a run do?

Decided autonomously: it decides nothing. `Stop` asks for no continuation, and the prompt goes on. It is a failure like an exit 1, so `onFailure: "block"` on `UserPromptSubmit` blocks it. The `asyncRewake` lane does not change. Upstream's handling of those two cases was not verified.

---

## Failure notices and `stopReason` (PG-HOOK-14)

### Q1 (product): Which failed hooks show a notice?

| Option | Description | Selected |
|--------|-------------|----------|
| Exit other than 0 and 2, missing script, cannot start; synchronous hooks; seven events | Matches the requirement's "first line of its stderr". `SessionEnd`, `PostCompact`, `StopFailure`, background hooks, timeouts, and JSON failures show nothing. | ✓ |
| Every non-blocking error upstream reports | Adds the timeout and the JSON parse and schema notices, which need texts and an output schema the bridge does not have. | |
| Tool and prompt events only | Leaves out `Stop`, which success criterion 2 needs. | |

**Choice:** the first option. **Pending maintainer review.**
**Notes:** A hook that exits 1 on purpose becomes visible on every run. Upstream has the same.

### Q2 (product): What does the notice say?

| Option | Description | Selected |
|--------|-------------|----------|
| One line: `<label> hook error: Failed with non-blocking status code: <first line>` | The form `hookErrorText` already writes, and upstream's `Stop` summary form. First line that is not blank, cut at 200 characters. | ✓ |
| Two lines, as upstream's transcript rows | `<label> hook error`, then the reason on its own line. | |
| The whole stderr | Upstream shows the whole text only in its `Stop` summary. The requirement says the first line. | |

**Choice:** one line. **Pending maintainer review.**
**Notes:** The missing-script notice keeps upstream's sentence and names `/claude:plugin reinstall` in place of `/plugin`.

### Q3 (reversible): How many notices?

Decided autonomously: one for each failed hook in routing order. Equal notices of one hook across the pairs of one edit show once. A hook that cannot start shows once per hook and bridge load.

### Q4 (product): Where is a `stopReason` shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Where the bridge honors the stop: `UserPromptSubmit`, `PreToolUse`, `Stop` | `Operation stopped by hook: <reason>`; `<label> hook stopped continuation: <reason>`. | ✓ |
| `UserPromptSubmit` only | The least that success criterion 3 needs. Leaves a `Stop` hook's reason unseen. | |
| Every event | Would show "stopped" on `PostToolUse`, where the bridge cannot stop. | |

**Choice:** the first option. **Pending maintainer review** for the `Stop` line, which adapts upstream's summary row.

### Q5 (reversible): Does the `stopReason` also stay in the conversation?

Decided autonomously: not in this phase. The requirement asks for the user-visible part. Recorded as a deferred idea.

---

## The 10,000-character limit (PG-HOOK-14)

### Q1 (reversible): Which strings does the limit cover?

Decided autonomously: each `additionalContext`, plain stdout that counts as context, and a plain `async` hook's `systemMessage`, each measured alone. Not a block reason, an exit-2 stderr, a rewake text, or a replaced tool output.

### Q2 (product): What happens to a string over the limit?

| Option | Description | Selected |
|--------|-------------|----------|
| Save the whole text to a file; send the path and the first 2,000 characters | What Claude Code does. Needs a file home inside the extension's paths and a clean-up rule. | ✓ |
| Cut at 10,000 characters and add a marker | No file. Also meets success criterion 4, but the model cannot reach the rest. | |
| Drop the string and show a notice | Loses context that upstream keeps. | |

**Choice:** save to a file. **Pending maintainer review.**
**Notes:** The file goes under the scope's data root in `_shared/hook-output/`, because Pi's session directory is outside the paths this extension may write (NFR-10). Files older than 30 days are removed when the bridge loads. If the write fails, the model gets the head and a marker, within 10,000 characters.

### Q3 (reversible): Where is the cap applied?

Decided autonomously: in one pure function with an injected writer, at the point where a hook result becomes model context, for both lanes.

---

## Plain `async` hooks (PG-HOOK-21)

### Q1 (reversible): Which hooks lose the timer?

Decided autonomously: a hook with `async: true` and no `asyncRewake: true`. Its `timeout` is ignored. An `asyncRewake` hook keeps its timeout and the ladder.

### Q2 (product): What stops a plain `async` hook that never ends?

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing new: the existing stops stay | A `/reload` and the next start reap it (Linux only for a live process); a child stops its own; a main session that quits leaves it running. | ✓ |
| A main session kills its own background hooks on `/reload` | Works on every platform, but changes the shutdown path that `0b49ad9e` just fixed and touches ASYNCRELOADTABLE-01. | |
| Keep a long safety timer | Not what upstream does. | |

**Choice:** nothing new. **Pending maintainer review.**
**Notes:** Outside Linux a plain `async` hook that never ends has no bound any more. The compatibility page says so. ASYNCRELOADTABLE-01 and ASYNCLIFECYCLE-01 stay in the backlog.

---

## Records and evidence

### Q1 (reversible): Which documents change?

Decided autonomously: the passages of `docs/hooks-compatibility.md` that the ROADMAP names (now at `:144-148` and `:329`), plus the rows that the four requirements make wrong, the `hook-notice` text of `docs/output-catalog.md`, and the CHANGELOG.

### Q2 (reversible): What proves each requirement?

Decided autonomously: one cucumber scenario per success criterion that fails without its change, the existing `Stop` and failure scenarios updated, and owner unit tests for the edge arms.

---

## Decided autonomously

[auto] [Stop continuation] — Q: "Does a fallback path ship?" → Selected: "Only if research measures a mode that fails" (reversible technical — decided autonomously: one registration per mode)
[auto] [Stop continuation] — Q: "Where does StopFailure run?" → Selected: "It stays on agent_settled" (reversible technical — decided autonomously: no behavior change)
[auto] [Stop continuation] — Q: "Do the limit of eight and stop_hook_active change?" → Selected: "No; the cap variable is not read" (reversible technical — decided autonomously: the counters are unchanged)
[auto] [Stop continuation] — Q: "What does continue: false return to Pi?" → Selected: "No continue field" (reversible technical — decided autonomously: one return value)
[auto] [Stop continuation] — Q: "Does the asyncRewake wake move too?" → Selected: "No" (reversible technical — decided autonomously: out of the requirement)
[auto] [Stop continuation] — Q: "Does the bridge imitate the run start?" → Selected: "No; research confirms nothing needs it" (reversible technical — decided autonomously: no code)
[auto] [Missing script] — Q: "Which runs count as a missing script?" → Selected: "The 2.1.323 rule" (reversible technical — decided autonomously: one predicate)
[auto] [Missing script] — Q: "What does such a run do?" → Selected: "It decides nothing and counts as a failure" (reversible technical — decided autonomously: one arm of the wire protocol)
[auto] [Failure notices] — Q: "How many notices?" → Selected: "One for each failed hook; equal notices of one hook show once" (reversible technical — decided autonomously: presentation only)
[auto] [Failure notices] — Q: "Does the stopReason stay in the conversation?" → Selected: "Not in this phase" (reversible technical — decided autonomously: deferred)
[auto] [The 10,000-character limit] — Q: "Which strings does the limit cover?" → Selected: "Each context string, measured alone" (reversible technical — decided autonomously: one list)
[auto] [The 10,000-character limit] — Q: "Where is the cap applied?" → Selected: "One pure function with an injected writer" (reversible technical — decided autonomously: internal shape)
[auto] [Plain async hooks] — Q: "Which hooks lose the timer?" → Selected: "async: true without asyncRewake: true" (reversible technical — decided autonomously: one branch)
[auto] [Records and evidence] — Q: "Which documents change?" → Selected: "The named passages, the rows the requirements make wrong, the output catalog, the CHANGELOG" (reversible technical — decided autonomously: documentation)
[auto] [Records and evidence] — Q: "What proves each requirement?" → Selected: "One failing-without-change scenario per success criterion plus owner unit tests" (reversible technical — decided autonomously: test approach)

## Claude's Discretion

Module and type names, the source of the last assistant message in the new handler, the file name pattern for saved hook output, the exact reinstall sentence, the harness seam that counts `agent_settled` and run starts, and plan splits.

## Deferred Ideas

A `stopReason` that stays in the conversation. The `Original prompt:` line, a notice for a blocking `Stop` hook, and a severity per notice. Notices for a `SessionEnd` failure, a timeout, and a JSON failure. Reading `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`. Stopping `async` hooks when a print run ends. A bound for a plain `async` hook outside Linux. `Stop` before a queued follow-up. The per-entry and per-dispatch context limits. The missing-script rule in the `asyncRewake` lane. `PostToolBatch` and `SubagentStop`.

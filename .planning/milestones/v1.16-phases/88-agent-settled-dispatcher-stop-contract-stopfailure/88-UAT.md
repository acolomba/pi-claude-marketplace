---
status: complete
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
source: [88-VERIFICATION.md]
started: 2026-07-30T12:00:00Z
updated: 2026-07-31T03:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Abort mid-tool-call suppresses Stop/StopFailure
expected: Interrupt a live Pi run mid-tool-call; final message carries stopReason "aborted"; no Stop/StopFailure dispatch (repro steps: tests/live-uat/README.md item 1)
result: pass
observed: "Live pi 0.80.x, openai-codex/gpt-5.5, sandbox tmp/pi-uat. Esc mid `bash -c 'sleep 30'`: session 019fb627 final assistant message stopReason 'aborted' (errorMessage 'Operation aborted', tool result isError); stop-observe plugin installed with Stop+StopFailure observers, stdin.log never created — neither bucket dispatched."

### 2. Queued-message settle timing
expected: With user messages queued during a run, agent_settled fires once after the queue drains (not per response); any divergence from upstream's per-response Stop cadence gets documented for Phase 89 (repro: tests/live-uat/README.md item 2)
result: pass
observed: "Session 019fb62b: tool-call turn with a user message queued mid-tool; queue drained in-turn (tool result + queued message + final response). Two assistant responses, exactly ONE Stop payload in stdin.log, carrying last_assistant_message 'hello' (post-drain) and stop_hook_active false. Matches the documented per-settle cadence (upstream per-response would have been 2); no new divergence to document for Phase 89."

### 3. sendMessage re-entry does not self-clear stop_hook_active
expected: A bridge block re-entry does NOT fire Pi's input event — stop_hook_active stays true across the injected continuation and clears only on genuine user input (repro: tests/live-uat/README.md item 3)
result: pass
observed: "Always-block observer (flag-file variant): stdin.log payload 1 stop_hook_active false, payloads 2-8 ALL true — the injected sendMessage continuations never self-cleared the flag. After the cap tripped and the block flag was removed, a genuine user prompt settled with payload 9 stop_hook_active false — only real input clears it."

### 4. 8-consecutive-block cap trips once with warning (live loop)
expected: A ralph-wiggum-shaped always-block Stop hook in a live interactive session re-enters 7 times; the 8th consecutive re-entry is suppressed, the "Stop hook override cap reached." warning fires exactly once, and the turn ends (repro: tests/live-uat/README.md item 4; the scripted canary already proved the first re-entry on real Pi 0.80.10)
result: pass
observed: "Live interactive TTY, one prompt, no further input: the loop ran settle→block→re-enter to exactly 8 block invocations in stdin.log, then the run went idle (no livelock — T-88-02 bound held). User observed the 'Stop hook override cap reached.' warning exactly once in the TUI."

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-88-D1
  truth: "tests/live-uat/README.md 'Interactive setup' launches a usable interactive session"
  status: resolved
  resolved_by: "inline doc fix during this UAT session (drop --mode json; point evidence reads at session JSONL + stdin.log)"
  resolved_at: 2026-07-31
  reason: "User reported: running the documented interactive setup (with --mode json) printed the session header and exited immediately — pi's json mode is a non-interactive output mode, not a TUI side-stream"
  severity: minor
  test: 1
  root_cause: "README.md line ~73 includes --mode json in the shared interactive setup; --mode json expects piped input and exits on a TTY, so the documented command cannot host the human checklist items"
  artifacts:
    - path: "tests/live-uat/README.md"
      issue: "interactive setup block passes --mode json; stopReason observability should instead point at the session JSONL under the sandbox sessions dir"
  missing:
    - "Drop --mode json from the interactive setup block; note that stopReason/settle evidence is read from the session file (PI_CODING_AGENT_SESSION_DIR) and the stop-observe stdin.log"
  debug_session: ""

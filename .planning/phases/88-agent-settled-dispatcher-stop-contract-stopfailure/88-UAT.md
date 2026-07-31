---
status: testing
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
source: [88-VERIFICATION.md]
started: 2026-07-30T12:00:00Z
updated: 2026-07-30T12:00:00Z
---

## Current Test

number: 1
name: Abort mid-tool-call suppresses Stop/StopFailure
expected: |
  Interrupting a live Pi run mid-tool-call yields a final assistant message
  with stopReason "aborted"; neither Stop nor StopFailure hooks fire on any
  interrupt path.
awaiting: user response

## Tests

### 1. Abort mid-tool-call suppresses Stop/StopFailure
expected: Interrupt a live Pi run mid-tool-call; final message carries stopReason "aborted"; no Stop/StopFailure dispatch (repro steps: tests/live-uat/README.md item 1)
result: [pending]

### 2. Queued-message settle timing
expected: With user messages queued during a run, agent_settled fires once after the queue drains (not per response); any divergence from upstream's per-response Stop cadence gets documented for Phase 89 (repro: tests/live-uat/README.md item 2)
result: [pending]

### 3. sendMessage re-entry does not self-clear stop_hook_active
expected: A bridge block re-entry does NOT fire Pi's input event — stop_hook_active stays true across the injected continuation and clears only on genuine user input (repro: tests/live-uat/README.md item 3)
result: [pending]

### 4. 8-consecutive-block cap trips once with warning (live loop)
expected: A ralph-wiggum-shaped always-block Stop hook in a live interactive session re-enters 7 times; the 8th consecutive re-entry is suppressed, the "Stop hook override cap reached." warning fires exactly once, and the turn ends (repro: tests/live-uat/README.md item 4; the scripted canary already proved the first re-entry on real Pi 0.80.10)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

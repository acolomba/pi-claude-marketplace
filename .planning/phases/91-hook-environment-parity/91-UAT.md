---
status: complete
phase: 91-hook-environment-parity
source: [91-01-SUMMARY.md]
started: 2026-08-04T00:00:00Z
updated: 2026-08-05T00:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sync hook lane session env visibility
expected: A plugin hook (e.g. PreToolUse) dispatched in a live Pi session sees CLAUDECODE=1, CLAUDE_CODE_SESSION_ID and CLAUDE_SESSION_ID both equal to the current Pi session id (HENV-01, D-91-02).
result: pass
note: "Verified live 2026-08-04 with disposable fixture tmp/henv-uat-mkt (plugin env-observe, sandbox home tmp/pi-uat). lane=sync event=PreToolUse block shows CLAUDECODE=1, both id keys equal to the session id observed in the bash-child env; rewake marker unset (sync dispatch path confirmed). Note: hooks fire only on agent tool calls — a user-typed $ shell escape bypasses the tool_call pipeline (expected, matches upstream)."

### 2. Async-rewake hook lane env parity
expected: A hook spawned through the async-rewake lane (e.g. a Stop hook re-armed asynchronously) sees the same three session env keys with the same values as a sync hook — no missing or stale keys on the async path (HENV-02).
result: issue
reported: "still absent" (no lane=async block in env.log after /reload + agent tool call; an asyncRewake:true PreToolUse handler in the same matcher group as the working sync handler never spawned its child)
severity: major

### 3. Session-id snapshot freshness across /new
expected: After starting a new session (/new), a triggered hook sees the NEW session id in both CLAUDE_CODE_SESSION_ID and CLAUDE_SESSION_ID — never a stale id left in process.env from the previous session (snapshot-wins precedence).
result: pass
note: "Verified live 2026-08-04: after /new the newest lane=sync block shows the new session id (019fcf54-…51b5) in both keys, matching the bash-child env; old id (019fccce-…50f2) only in pre-/new blocks."

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-91-2
  truth: "A hook handler declaring asyncRewake: true on a dispatchable event (e.g. PreToolUse) spawns its child through the async-rewake lane with Claude-Code-parity session env (HENV-02) in a live Pi session"
  status: failed
  reason: "User reported: still absent — fixture plugin env-observe (tmp/henv-uat-mkt, sandbox home tmp/pi-uat) with a sync + asyncRewake:true handler pair on PreToolUse produced only the lane=sync block in env.log after /reload and an agent tool call; the async child never ran"
  severity: major
  test: 2
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
  notes: |
    Inline pre-diagnosis (all in current branch source, features/env-parity):
    - Stop + asyncRewake is inert BY DESIGN (collectBucketOutcomes degrades to
      noop; D-87-04 "no async Pi surface") — first fixture attempt used Stop,
      that absence was expected behavior, not the gap.
    - Live path that SHOULD spawn: pi.on("tool_call") -> compositeHandlerFor
      ("PreToolUse", epoch, pi) -> reduceBucket (no asyncRewake filter) ->
      dispatchHookExec async arm (dispatch-exec.ts:182) -> spawnAndRegister
      (registry.ts:231) -> isDispatchableEvent(PreToolUse)=true -> spawn.
    - Ruled out: pi undefined at wiring (event-router.ts:862 threads pi);
      handlerDecl stripping (flattenPluginIntoBuckets passes raw parsed
      handler, event-router.ts:487-505); version-floor gate (none in source);
      trust gate (none in hook bridge); fixture script error (sync lane uses
      the same script and logs fine).
    - Every failure arm is silent hookDebugLog (stderr, only with
      PI_CLAUDE_MARKETPLACE_DEBUG=1) — repro with that env var set should
      name the exact arm: "asyncRewake entry cannot yield" (wrong reducer),
      "pi missing on async dispatch", "spawnAndRegister threw", "spawn threw",
      or silence (handler never in routing bucket -> hydrate/parse drop).
    - Sync-lane caveat for the fix verifier: test 1's pass does NOT prove the
      explicit HENV-01 keys (child would inherit identical values from
      process.env via the spread); only a divergent-sentinel or /new
      staleness check distinguishes them.

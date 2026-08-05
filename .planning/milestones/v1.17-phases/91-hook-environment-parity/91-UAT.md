---
status: complete
phase: 91-hook-environment-parity
source: [91-01-SUMMARY.md]
started: 2026-08-04T00:00:00Z
updated: 2026-08-05T01:15:00Z
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
result: pass
note: "Passed on retest 2026-08-04 21:08 after reinstall re-staged the fixture hooks.json: one tool call produced both blocks — lane=sync (marker unset) and lane=async (PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=c00ad146-…) — with identical CLAUDECODE=1 and current-session ids (HENV-02 parity live). Initial 'still absent' report was a stale staged copy (see gap G-91-2 root_cause), not a product defect."

### 3. Session-id snapshot freshness across /new
expected: After starting a new session (/new), a triggered hook sees the NEW session id in both CLAUDE_CODE_SESSION_ID and CLAUDE_SESSION_ID — never a stale id left in process.env from the previous session (snapshot-wins precedence).
result: pass
note: "Verified live 2026-08-04: after /new the newest lane=sync block shows the new session id (019fcf54-…51b5) in both keys, matching the bash-child env; old id (019fccce-…50f2) only in pre-/new blocks."

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-91-2
  truth: "A hook handler declaring asyncRewake: true on a dispatchable event (e.g. PreToolUse) spawns its child through the async-rewake lane with Claude-Code-parity session env (HENV-02) in a live Pi session"
  status: resolved
  resolved_by: "live retest after fixture re-stage (no code change; root cause was UAT procedure — stale staged hooks.json)"
  resolved_at: 2026-08-04
  reason: "User reported: still absent — fixture plugin env-observe (tmp/henv-uat-mkt, sandbox home tmp/pi-uat) with a sync + asyncRewake:true handler pair on PreToolUse produced only the lane=sync block in env.log after /reload and an agent tool call; the async child never ran"
  severity: major
  test: 2
  root_cause: "Stale staged hooks.json — NOT a product defect. The router hydrates hook configs from the install-time staged copy (<scope>/pi-claude-marketplace/hooks/<slug>/hooks.json, event-router.ts hydrateScopeFromState); /reload re-reads the staged copy, and only install/reinstall/update re-stage it. The UAT edited the marketplace source after install without re-staging, so the session still routed the first fixture attempt (async handler on Stop — inert by design, D-87-04). A throwaway seam test driving the real parse->cache->rebuild->dispatch path with the edited config spawns BOTH children with full HENV-02 env parity."
  artifacts:
    - path: "tmp/pi-uat/agent/pi-claude-marketplace/hooks/env-observe/hooks.json"
      issue: "stale staged copy (first fixture attempt); mtime == installedAt, never re-staged after source edit"
  missing:
    - "Re-stage the fixture (reinstall env-observe@henv-uat-mkt) and re-run Test 2 live"
    - "Optional docs note: plugin-source hooks.json edits require reinstall/update, not just /reload"
  debug_session: ".planning/debug/async-rewake-lane-inert.md"
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

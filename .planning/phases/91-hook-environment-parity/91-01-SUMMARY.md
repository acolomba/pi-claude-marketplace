---
phase: 91-hook-environment-parity
plan: "01"
subsystem: bridges/hooks
tags: [hooks, env-parity, session-env, drift-guard]
requires:
  - "Phase 90 session-env foundation (transCtx.sessionId snapshot, applySessionEnv)"
provides:
  - "Claude-Code-parity session env on both hook spawn lanes (CLAUDECODE, CLAUDE_CODE_SESSION_ID, CLAUDE_SESSION_ID)"
  - "HENV-02 behavioral drift guard pinning the two hand-mirrored env builders"
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
tech-stack:
  added: []
  patterns:
    - "Explicit env keys after the ...process.env spread (later-key-wins snapshot precedence)"
    - "Behavioral drift guard via dual spawn spy (wireBoth) — no source-text snapshot"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/bridges/hooks/dispatch-exec.test.ts
    - tests/architecture/hooks-async-rewake.test.ts
decisions:
  - "D-91-01: HENV-02 drift guard is a behavioral comparison (key-set symmetric difference + per-key value equality), not a source-text snapshot"
  - "D-91-02: CLAUDE_SESSION_ID pi-only alias explicitly pinned from transCtx.sessionId on both lanes"
  - "Local literals with mirrored comments (not a shared constant import) — the anti-drift mechanism is the behavioral guard, not a shared name constant"
metrics:
  duration: "~15m"
  completed: 2026-08-03
status: complete
actuals:
  tokens: 3400
  tasks: 3
  commits: 3
---

# Phase 91 Plan 01: Hook environment parity Summary

Both hook spawn lanes now carry Claude-Code-parity session env — `CLAUDECODE="1"`,
`CLAUDE_CODE_SESSION_ID` and the pi-only alias `CLAUDE_SESSION_ID` (all from the
`transCtx.sessionId` snapshot) — pinned together by a behavioral drift guard.

## What was built

- **Sync lane (`prepareEnv`, `dispatch-exec.ts`):** three keys added after the
  `...process.env` spread and after the existing `CLAUDE_*` set, so the
  authoritative per-dispatch snapshot wins over whatever Phase 90's
  `applySessionEnv` last wrote to the live `process.env` (HENV-01, D-91-02). The
  `SessionStart`-only `CLAUDE_ENV_FILE` block is untouched.
- **Async-rewake lane (`prepareAsyncEnv`, `registry.ts`):** the identical three
  keys mirrored in, keeping `[MARKER_ENV]: dispatchId` as the sole async-only
  delta (HENV-02, D-91-02).
- **Lane-local tests:** the sync "EXEC-01 + HOOK-05" test and the async
  "EXEC-05 env marker" test each gained the three key assertions; a new sync
  snapshot-wins test seeds a divergent `process.env.CLAUDE_CODE_SESSION_ID`
  sentinel and proves the ctx snapshot value reaches the child, not the sentinel.
- **Drift guard:** a new `describe("hook env parity (HENV-02)")` block drives both
  public entry points (`dispatchHookExec` sync, `spawnAndRegister` async) through
  the `wireBoth` dual spawn spy and compares captured child envs by key set
  (symmetric difference) plus per-key value equality — asserting only-async ===
  `[MARKER_ENV]` and only-sync === `[]`. It runs for a PreToolUse fixture
  (`CLAUDE_ENV_FILE` absent in both) and a SessionStart fixture (`CLAUDE_ENV_FILE`
  present, equal, matching the `…/data/_shared/claude-env-<sid>.env` scheme) so
  the conditional's parity is guarded too (D-91-01).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | Sync-lane session env (prepareEnv) end-to-end | 306e099c | dispatch-exec.ts, dispatch-exec.test.ts |
| 2 | Mirror the three keys to the async-rewake lane | c9c97bac | registry.ts, hooks-async-rewake.test.ts |
| 3 | HENV-02 behavioral drift guard (both lanes, both events) | 00e2acee | hooks-async-rewake.test.ts |

## Decisions

- **Local literals over a shared constant (single-source-of-truth discretion):**
  chose to duplicate the three literals locally with mirrored comments rather than
  add exported constants to `shared/session-env.ts` and thread them through
  Phase 90's `applySessionEnv`. The genuine anti-drift mechanism is the behavioral
  drift guard (D-91-01), not a shared name constant; the refactor would not trace
  to HENV-01/02 and would violate the CLAUDE.md surgical / no-single-use-abstraction
  bias.
- **Tracer feedback gate:** the plan's tracer `<verify>` is purely automated
  (`node --test`) and the plan is `autonomous: true`; the tracer verify was
  re-run end-to-end and passed (17/17) before expanding, rather than returning a
  human-verify checkpoint (nothing here is human-visual, and a checkpoint would
  strand a non-resumable parallel executor).

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `node --test tests/bridges/hooks/dispatch-exec.test.ts` — 17/17 pass.
- `node --test tests/architecture/hooks-async-rewake.test.ts` — 41 pass, 1 skipped
  (pre-existing non-Linux platform skip, unrelated).
- Combined targeted run (both files) — 58 pass, 1 pre-existing skip, 0 fail.
- `npm run typecheck` exit 0; `npm run lint` exit 0.
- Comment-policy check: no phase/plan/wave/Pitfall tokens in any added comment or
  test title; only HENV-01/HENV-02/D-91-01/D-91-02 anchors used.

Note: full `npm run check` (typecheck + lint + format + tests + integration) is
the wave-merge gate owned by the orchestrator; typecheck and lint were run here
and pass. `node_modules` is absent in the worktree but the pinned tsc/eslint
resolved and ran clean.

## Threat Flags

None — no new network, file-write, or spawn surface introduced. The three added
values are the constant `"1"` and the Pi session id (already exposed to the child
via Phase 90's `process.env` mutation and the stdin envelope). `assertPathInside`
containment on `CLAUDE_PLUGIN_DATA` / `CLAUDE_ENV_FILE` is byte-for-byte unchanged.
T-91-02 (mirror drift) is mitigated by the new drift guard as planned.

## Self-Check: PASSED

All modified production files exist on disk; all four task/summary commits
(306e099c, c9c97bac, 00e2acee, 20c38728) are present in the branch history.

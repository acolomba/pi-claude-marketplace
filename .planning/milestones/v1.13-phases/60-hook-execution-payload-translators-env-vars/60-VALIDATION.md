---
phase: 60
slug: hook-execution-payload-translators-env-vars
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node 20 built-in; carry-forward from Phases 57-59) |
| **Config file** | none — `node --test "tests/**/*.test.ts"` discovers all |
| **Quick run command** | `npm test -- tests/bridges/hooks/` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~25-45 seconds full suite (carry-forward from Phase 59 baseline) |

---

## Sampling Rate

- **After every task commit:** Run scoped tests for files touched in that task (`npm test -- tests/bridges/hooks/` for exec/dispatch/translators; `npm test -- tests/architecture/` for invariant pins)
- **After every plan wave:** Run `npm run check` (typecheck + lint + format + full test suite + 10 integration tests)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds (full suite; scoped sub-suites ~10s)

---

## Per-REQ Verification Map

| REQ ID | What's pinned | Test Type | Test File(s) | Status |
|--------|---------------|-----------|--------------|--------|
| EXEC-01 | spawn invocation: cwd = ctx.cwd; env merges process.env + CLAUDE_* + PI_* | unit + architecture | `tests/bridges/hooks/dispatch-exec.test.ts` (mock spawn, assert opts); `tests/architecture/hooks-exec.test.ts` Block A | ⬜ pending |
| EXEC-02 | Timeout escalation: SIGTERM → 5s grace → SIGKILL; maxBuffer 1MB stdout cap; 256KB stdin truncation with `_truncated: true` marker | unit (mock-timers) + architecture | `tests/bridges/hooks/dispatch-exec.test.ts` (t.mock.timers — fire SIGTERM at hookTimeout, no exit, advance 5s, assert SIGKILL); `tests/architecture/hooks-exec.test.ts` Block B | ⬜ pending |
| EXEC-03 | Hook stderr → hookDebugLog ONLY; never ctx.ui.notify at runtime; install-time errors continue through notify | architecture (import-graph + grep) | `tests/architecture/hooks-exec.test.ts` Block C (verifies stderr path goes through shared/debug-log.ts; greps dispatch-exec.ts for `ctx.ui.notify` — must be zero) | ⬜ pending |
| EXEC-04 | args=[string,...] → exec-form spawn(cmd, args, opts); no args → shell-form; `shell` field selects shell binary for shell-form only | unit | `tests/bridges/hooks/dispatch-exec.test.ts` (mock spawn, 3 cases: args present, args absent, shell field set) | ⬜ pending |
| PAYL-01 | 8 bucket-A events round-trip cleanly via translator fixtures; PreToolUse/PostToolUse/PostToolUseFailure additionally map Pi toolName → Claude tool_name | architecture (8 fixtures) | `tests/architecture/hooks-translators.test.ts` (one fixture per event: Pi input → expected Claude stdin JSON) | ⬜ pending |
| HOOK-05 | Every child sees CLAUDE_PROJECT_DIR + CLAUDE_PLUGIN_ROOT + CLAUDE_PLUGIN_DATA; CLAUDE_ENV_FILE only for SessionStart in v1.13; CLAUDE_CODE_REMOTE intentionally unset | architecture (per-event env-set fixtures) | `tests/architecture/hooks-exec.test.ts` Block D (8 fixtures — one per event; asserts env shape) | ⬜ pending |

---

## Per-Decision Verification Map (D-60-01..06)

| Decision | What's pinned | Test |
|----------|---------------|------|
| D-60-01 | HookExecResult discriminated union: parser maps exit 0 + valid JSON → kind by outcome; exit 0 + invalid/empty → noop; exit 2 + stderr → block with stderr as reason; other → noop + debug-log | `tests/bridges/hooks/wire-protocol.test.ts` (5 fixtures: structured-allow, structured-deny, structured-mutate, exit-2, exit-1) |
| D-60-02 | First-block-wins short-circuit: entry-2 dispatchHookExec NOT invoked when entry-1 returns block; mutate composition: entry-2 sees entry-1's updatedInput; stop-on-first-stop | `tests/architecture/hooks-reducer.test.ts` (3 fixtures) |
| D-60-03 | Per-event adapter return shapes: tool_call → `{block, reason}` or mutate event.input; tool_result → `{block, reason}` or mutate event.output; input → `{action: 'handled'}` or `{action: 'transform', text}`; session_* → void | `tests/architecture/hooks-adapters.test.ts` (4 adapter fixtures × 2-3 result kinds) |
| D-60-04 | 8 translate() functions exist; each is invoked from dispatch-exec.ts via a single dispatch site; TOOL-01 mapping applied via mapPiToClaudeToolName helper (or PI_TO_CLAUDE_TOOL_NAMES const map lookup per researcher correction) | `tests/architecture/hooks-translators.test.ts` (same as PAYL-01) |
| D-60-05 | WR-01 clear-cache prefix in hydrateProjectScopeForCwd verified (cache.delete on project arm before re-hydrate); WR-03 install.ts + uninstall.ts call rebuildRoutingTables after cache mutation; reinstall.ts + update.ts call wire explicitly | `tests/architecture/hooks-lifecycle.test.ts` (call-site greps + behavioral fixtures); `tests/bridges/hooks/event-router.test.ts` extended for clear-cache test |
| D-60-06 | CLAUDE_ENV_FILE path = <scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env; mkdir-p at registerHooksBridge factory time; assertPathInside containment | unit (mock fs) + architecture | `tests/bridges/hooks/event-router.test.ts` (mkdir-p call assertion); `tests/architecture/hooks-exec.test.ts` Block E |

---

## Wave 0 Requirements

Phase 59's `tests/architecture/hooks-dispatch.test.ts` + `tests/bridges/hooks/event-router.test.ts` + `tests/bridges/hooks/dispatch-exec.test.ts` already provide the seam infrastructure. Phase 60 adds new test files:

- [ ] `tests/architecture/hooks-exec.test.ts` (NEW) — Blocks A-E pinning EXEC-01..04 + HOOK-05 + D-60-06 invariants
- [ ] `tests/architecture/hooks-translators.test.ts` (NEW) — 8 per-event round-trip fixtures (PAYL-01 + D-60-04)
- [ ] `tests/architecture/hooks-reducer.test.ts` (NEW) — D-60-02 first-block-wins + mutate-composition + stop fixtures
- [ ] `tests/architecture/hooks-adapters.test.ts` (NEW) — D-60-03 per-Pi-event adapter fixtures
- [ ] `tests/architecture/hooks-lifecycle.test.ts` (NEW) — D-60-05 WR-01/WR-03 carry-forward fixtures
- [ ] `tests/bridges/hooks/wire-protocol.test.ts` (NEW) — D-60-01 stdout JSON → HookExecResult parser fixtures
- [ ] Extensions to existing `tests/bridges/hooks/event-router.test.ts` and `tests/bridges/hooks/dispatch-exec.test.ts` for new mock-spawn / mock-timers cases

*All test infrastructure exists — no `npm install` step required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end hook fires from a real plugin during a Pi session | EXEC-01..04 + PAYL-01 + HOOK-05 | Pi runtime can't be reliably mocked at the e2e level; tests cover the bridge layer | Install a plugin with a SessionStart hook that writes to `$CLAUDE_ENV_FILE`; reload Pi; observe env vars persist into subsequent bash tool calls |
| Cross-plugin env-var accumulation via shared `_shared/claude-env-<sessionId>.env` | D-60-06 | Tests cover the path-generation contract; observing accumulation across plugin boundaries requires two real plugins in the same Pi session | Install plugin-A (SessionStart hook writes `FOO=1`) and plugin-B (SessionStart hook writes `BAR=2`); reload Pi; assert both env vars visible to subsequent bash tool calls |
| Hook timeout escalation kills a stuck child after grace period | EXEC-02 | t.mock.timers covers the timer-ladder unit invariant; observing a real stuck child requires a manual test plugin | Install a plugin with a hook that runs `sleep 9999`; configure hook timeout=2; observe SIGTERM at 2s; observe SIGKILL at 7s (`ps` shows child exit) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (test command per task) or Wave 0 dependencies (new test file paths above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — `npm run check` runs at every plan wave close
- [ ] Wave 0 covers all 6 new test file paths above
- [ ] No watch-mode flags (node:test runs to completion)
- [ ] Feedback latency < 60s (full suite ~25-45s)
- [ ] `nyquist_compliant: true` set in frontmatter after planner verifies coverage

**Approval:** pending

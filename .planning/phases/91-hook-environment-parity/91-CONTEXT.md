# Phase 91: Hook environment parity - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A plugin hook process — on BOTH the synchronous dispatch lane and the
async-rewake lane — receives `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID`
alongside the existing `CLAUDE_PROJECT_DIR`/`CLAUDE_PLUGIN_ROOT`/
`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` set, matching what a hook sees under
Claude Code. The session id comes from the authoritative per-dispatch snapshot
(`transCtx.sessionId`), never from the `process.env` spread. The two
hand-mirrored spawn sites are pinned together by a drift-guard test.

Requirements: HENV-01, HENV-02.

</domain>

<decisions>
## Implementation Decisions

### Locked by ROADMAP/REQUIREMENTS (restated, not re-decided)
- Keys added: `CLAUDECODE: "1"` and `CLAUDE_CODE_SESSION_ID: transCtx.sessionId` in BOTH `prepareEnv` (`bridges/hooks/dispatch-exec.ts`) and `prepareAsyncEnv` (`bridges/hooks/async-rewake/registry.ts`).
- Value source is the per-dispatch `transCtx.sessionId` snapshot — explicit assignment AFTER the `...process.env` spread so it always wins over whatever Phase 90 last set (freshness under session switching).
- The existing env set (`CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, conditional `CLAUDE_ENV_FILE`, async-only `MARKER_ENV` dispatch id) stays byte-for-byte unchanged.
- A drift-guard test pins the two lanes together (HENV-02).

### Drift-guard shape
- **D-91-01:** The HENV-02 drift guard is a **behavioral comparison test**: invoke both `prepareEnv` and `prepareAsyncEnv` with identical fixtures (same `RoutingEntry`, `TranslationContext`, and — for async — the matching `ScopedLocations`) and assert the resulting env objects are identical **modulo the documented known deltas** (async adds the `MARKER_ENV` dispatch-id key; nothing else may differ). Test lives with the existing hooks architecture tests (`tests/architecture/` convention). No source-text snapshot lock — behavioral comparison catches semantic drift and survives refactors.

### CLAUDE_SESSION_ID alias in hook env
- **D-91-02:** Both lanes **explicitly pin** the pi-only alias: `CLAUDE_SESSION_ID: transCtx.sessionId`. All three id-related keys (`CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`, plus `CLAUDECODE`) are internally consistent within a single dispatch even during a session-switch race window (the spread's value could otherwise briefly diverge from the snapshot). Documented as the pi-only shim riding the hook env — under Claude Code this variable does not exist (Phase 94 docs record it).

### Claude's Discretion
- Whether the `"1"` literal / key names are imported from `shared/session-env.ts` (Phase 90's module) or duplicated locally — prefer a single source of truth if the import direction is legal (bridges/ may import shared/).
- Exact test-file placement and naming within the established conventions (`tests/architecture/` for the drift guard; existing `tests/bridges/hooks/dispatch-exec.test.ts` and `tests/architecture/hooks-async-rewake.test.ts` for lane-local assertions).
- Comment wording (IDs allowed: HENV-01, HENV-02, D-91-01, D-91-02; no phase/plan refs per `.claude/rules/typescript-comments.md`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and ground truth
- `.planning/REQUIREMENTS.md` — HENV-01, HENV-02
- `.planning/ROADMAP.md` — Phase 91 entry (goal, success criteria)
- `.planning/PROJECT.md` — "Current Milestone: v1.17 env-parity" section (Claude Code v2.1.212 hook-env ground truth)
- `.planning/phases/90-session-environment-initialization/90-CONTEXT.md` — Phase 90 decisions this phase builds on (session-var foundation, pi-only alias semantics)

No phase-specific external spec docs exist.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `transCtx.sessionId` — already snapshotted per dispatch (`bridges/hooks/translation-context.ts:56`, source `ctx.sessionManager.getSessionId()`).
- Phase 90's `shared/session-env.ts` — exports the session-env constants/logic; candidate single source for the `"1"` literal and key names.
- Existing test homes: `tests/bridges/hooks/dispatch-exec.test.ts`, `tests/architecture/hooks-async-rewake.test.ts`, `tests/architecture/hooks-exec.test.ts`.

### Established Patterns
- The two env builders are deliberate hand-mirrors with documented mirror comments (`prepareAsyncEnv` header cites `dispatch-exec.ts::prepareEnv` as its contract source) — the new keys must land in BOTH with mirrored comments.
- `prepareEnv`: `dispatch-exec.ts:294-328`; env literal at 312-317 (spread, then CLAUDE_PROJECT_DIR/CLAUDE_PLUGIN_ROOT/CLAUDE_PLUGIN_DATA; conditional CLAUDE_ENV_FILE for SessionStart at 319-323).
- `prepareAsyncEnv`: `async-rewake/registry.ts:594-624`; identical shape plus `[MARKER_ENV]: dispatchId` at 614.
- Comment policy: requirement/decision IDs only (`.claude/rules/typescript-comments.md`).

### Integration Points
- Only the two functions above change in production code; no new files in `bridges/hooks/` expected beyond tests.
- Phase 90 already put the same keys on `process.env` — the hook-lane explicit assignments intentionally shadow the spread (authoritative snapshot wins).

</code_context>

<specifics>
## Specific Ideas

- The drift-guard's known-delta list must be exhaustive and documented in the test: `MARKER_ENV` (async only) is the ONLY allowed difference; `CLAUDE_ENV_FILE` conditionality must behave identically in both lanes (same SessionStart-only rule), so fixtures should cover both a SessionStart and a non-SessionStart event.
- Verification expectation: unit/architecture tests only — no live-Pi item is inherent to this phase (hook spawn env is fully assertable in-process); phase 90's deferred UAT already covers the underlying session-var freshness end-to-end.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Coverage sweep: test rare failure arms in update/reinstall/install" — keyword-matched this phase again; decision carried forward from Phase 90 review: unrelated, stays pending.

</deferred>

---

*Phase: 91-hook-environment-parity*
*Context gathered: 2026-08-03*

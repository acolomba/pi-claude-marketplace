# Phase 91: Hook environment parity - Research

**Researched:** 2026-08-03
**Domain:** Node.js child-process env construction in the hooks bridge (two hand-mirrored spawn lanes) + node:test behavioral drift-guard
**Confidence:** HIGH (all claims verified against source files read this session; no external packages; in-process assertable)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keys added: `CLAUDECODE: "1"` and `CLAUDE_CODE_SESSION_ID: transCtx.sessionId` in BOTH `prepareEnv` (`bridges/hooks/dispatch-exec.ts`) and `prepareAsyncEnv` (`bridges/hooks/async-rewake/registry.ts`).
- Value source is the per-dispatch `transCtx.sessionId` snapshot — explicit assignment AFTER the `...process.env` spread so it always wins over whatever Phase 90 last set (freshness under session switching).
- The existing env set (`CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, conditional `CLAUDE_ENV_FILE`, async-only `MARKER_ENV` dispatch id) stays byte-for-byte unchanged.
- A drift-guard test pins the two lanes together (HENV-02).

### D-91-01 (Drift-guard shape)
The HENV-02 drift guard is a **behavioral comparison test**: invoke both `prepareEnv` and `prepareAsyncEnv` with identical fixtures (same `RoutingEntry`, `TranslationContext`, and — for async — the matching `ScopedLocations`) and assert the resulting env objects are identical **modulo the documented known deltas** (async adds the `MARKER_ENV` dispatch-id key; nothing else may differ). Test lives with the existing hooks architecture tests (`tests/architecture/` convention). No source-text snapshot lock — behavioral comparison catches semantic drift and survives refactors.

### D-91-02 (CLAUDE_SESSION_ID alias in hook env)
Both lanes **explicitly pin** the pi-only alias: `CLAUDE_SESSION_ID: transCtx.sessionId`. All three id-related keys (`CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`, plus `CLAUDECODE`) are internally consistent within a single dispatch even during a session-switch race window (the spread's value could otherwise briefly diverge from the snapshot). Documented as the pi-only shim riding the hook env — under Claude Code this variable does not exist (Phase 94 docs record it).

### Claude's Discretion
- Whether the `"1"` literal / key names are imported from `shared/session-env.ts` (Phase 90's module) or duplicated locally — prefer a single source of truth if the import direction is legal (bridges/ may import shared/).
- Exact test-file placement and naming within the established conventions (`tests/architecture/` for the drift guard; existing `tests/bridges/hooks/dispatch-exec.test.ts` and `tests/architecture/hooks-async-rewake.test.ts` for lane-local assertions).
- Comment wording (IDs allowed: HENV-01, HENV-02, D-91-01, D-91-02; no phase/plan refs per `.claude/rules/typescript-comments.md`).

### Deferred Ideas (OUT OF SCOPE)
- "Coverage sweep: test rare failure arms in update/reinstall/install" — keyword-matched this phase again; carried forward from Phase 90 review: unrelated, stays pending.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HENV-01 | A plugin hook process (sync dispatch lane) receives `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` alongside the existing `CLAUDE_PROJECT_DIR`/`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` set | `prepareEnv` env literal at `dispatch-exec.ts:312-317` — add the three keys after the spread; existing test `tests/bridges/hooks/dispatch-exec.test.ts` "EXEC-01 + HOOK-05" asserts env content via spawn spy. |
| HENV-02 | The async-rewake lane delivers an identical env set — mirror parity between `prepareEnv` and `prepareAsyncEnv`, drift-guarded by test | `prepareAsyncEnv` env literal at `registry.ts:609-615`; behavioral drift-guard (D-91-01) invoking both lanes via public entry points with dual spawn spy; `MARKER_ENV` is the only allowed delta. |
</phase_requirements>

## Summary

This is a small, mechanically-precise phase. Two hand-mirrored `async function`s build the env object a plugin hook child receives: `prepareEnv` (sync dispatch lane, `dispatch-exec.ts`) and `prepareAsyncEnv` (async-rewake lane, `async-rewake/registry.ts`). Both currently produce `{ ...process.env, CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA }` (async adds `[MARKER_ENV]: dispatchId`), plus a `SessionStart`-only conditional `CLAUDE_ENV_FILE`. Phase 91 adds **three** explicit keys to each literal — `CLAUDECODE: "1"`, `CLAUDE_CODE_SESSION_ID: transCtx.sessionId`, `CLAUDE_SESSION_ID: transCtx.sessionId` — placed **after** the `...process.env` spread so the authoritative per-dispatch snapshot always wins over whatever Phase 90's `applySessionEnv` last wrote to the live `process.env`. `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:312-323]` `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:609-621]`

The requirement text (HENV-01/02) names only `CLAUDECODE` and `CLAUDE_CODE_SESSION_ID`; the third key `CLAUDE_SESSION_ID` is a decided addition (D-91-02) for race-window consistency, not a requirement-literal — the planner must include it even though the requirement rows omit it.

Neither `prepareEnv` nor `prepareAsyncEnv` is exported. The house convention reaches env content **indirectly** through the public entry points (`dispatchHookExec`, `spawnAndRegister`) with a mocked `spawn` seam, then asserts on `spawnSpy.calls[0].options.env`. The HENV-02 drift guard (D-91-01) should use this same indirect route with **both** spawn seams wired, capturing each lane's env and comparing modulo `MARKER_ENV` — no new export surface is needed. `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:294,139-146]` `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:594,168-175]`

**Primary recommendation:** Add three keys after the spread in each of the two env literals (mirrored comment on each carrying `HENV-01`/`HENV-02` IDs); add lane-local env assertions to the existing test homes; add one behavioral drift-guard in `tests/architecture/` that drives both lanes through their public entry points with dual spawn spies and asserts key-set symmetric-difference `=== {MARKER_ENV}` plus equal values on all shared keys. Import the three key-name literals + `"1"` from `shared/session-env.ts` **only if** the planner first adds exported constants there (none exist today — see Don't Hand-Roll / Open Questions).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build hook child env (sync lane) | Bridge (`bridges/hooks/dispatch-exec.ts::prepareEnv`) | — | Env is assembled at dispatch time from `RoutingEntry` + `TranslationContext`; owned by the hooks bridge. |
| Build hook child env (async lane) | Bridge (`bridges/hooks/async-rewake/registry.ts::prepareAsyncEnv`) | — | Deliberate hand-mirror of the sync lane plus the orphan-reap marker; same tier. |
| Session-id snapshot | Bridge (`bridges/hooks/translation-context.ts::buildTranslationContext`) | Platform (`ctx.sessionManager.getSessionId()`) | `transCtx.sessionId` is snapshotted once per dispatch from the Pi session manager. |
| Session-var name/value constants | Shared (`shared/session-env.ts`) — *candidate, not yet present* | — | If a single source of truth is adopted, constants live in the pure `shared/` leaf that Phase 90 created. |
| Drift-guard test | Test (`tests/architecture/`) | — | Cross-file behavioral invariant; house convention places it with the other hooks architecture pins. |

## Standard Stack

No external packages. This phase uses only in-repo modules and Node built-ins already in use.

| Module | Role | Location |
|--------|------|----------|
| `node:test` + `node:assert/strict` | Test runner + assertions (house standard) | Test script globs `tests/{architecture,bridges,...}/**/*.test.ts` `[VERIFIED: package.json:82]` |
| `node:child_process` `spawn` | Spawn seam (mocked in tests via `_setSpawnForTest`) | Both lanes; whitelisted 3-site set |
| `bridges/hooks/translation-context.ts` | `TranslationContext` + `buildTranslationContext` | `sessionId`/`transcriptPath`/`cwd` `[VERIFIED: bridges/hooks/translation-context.ts:36-40]` |
| `shared/session-env.ts` | Phase 90 session-var primitives (`applySessionEnv`, `PATH_LEDGER_ENV`, `applyPathLedger`) | `[VERIFIED: shared/session-env.ts:32-36,46,61]` |

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. All work is in-repo TypeScript plus Node built-ins already whitelisted (`node:child_process`, `node:test`).

## Architecture Patterns

### System data flow (both lanes)

```
Pi event ─▶ dispatchHookExec(entry, event, ctx, pi)         [dispatch-exec.ts]
             │
             ├─ asyncRewake === true ──▶ spawnAndRegister(entry,event,ctx,pi,loc)  [registry.ts]
             │                              │
             │                              ├─ buildTranslationContext(ctx) ─▶ transCtx { sessionId, cwd, ... }
             │                              ├─ prepareAsyncEnv(entry, transCtx, loc, dispatchId)
             │                              │     env = { ...process.env,
             │                              │             CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA,
             │                              │             [MARKER_ENV]: dispatchId,        ◀── async-only delta
             │                              │             + NEW: CLAUDECODE, CLAUDE_CODE_SESSION_ID, CLAUDE_SESSION_ID }
             │                              │     if SessionStart: env.CLAUDE_ENV_FILE = <dataRoot>/_shared/claude-env-<sid>.env
             │                              └─ activeSpawn(cmd,args,{ cwd: env.CLAUDE_PROJECT_DIR, env, ... })
             │
             └─ else (sync EXEC path)
                    ├─ buildTranslationContext(ctx) ─▶ transCtx
                    ├─ prepareEnv(entry, transCtx)
                    │     env = { ...process.env,
                    │             CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA,
                    │             + NEW: CLAUDECODE, CLAUDE_CODE_SESSION_ID, CLAUDE_SESSION_ID }
                    │     if SessionStart: env.CLAUDE_ENV_FILE = <dataRoot>/_shared/claude-env-<sid>.env
                    └─ spawnAndCollect(entry, env, stdinJson)
```

### Pattern 1: Explicit keys after the spread win

**What:** Object-literal later-key-wins semantics. `{ ...process.env, CLAUDE_CODE_SESSION_ID: transCtx.sessionId }` overrides whatever `process.env.CLAUDE_CODE_SESSION_ID` held.
**When to use:** Every added key MUST sit inside the same literal, after `...process.env`. The current three CLAUDE_* keys already do. `[VERIFIED: dispatch-exec.ts:312-317]`
**Example (target shape for `prepareEnv`):**
```typescript
// Existing (dispatch-exec.ts:312-317), with the three HENV keys added.
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CLAUDE_PROJECT_DIR: transCtx.cwd,
  CLAUDE_PLUGIN_ROOT: pluginRoot,
  CLAUDE_PLUGIN_DATA: pluginData,
  // HENV-01: Claude-Code-parity session env; the authoritative per-dispatch
  // snapshot wins over the process.env spread (D-91-02 race-window safety).
  CLAUDECODE: "1",
  CLAUDE_CODE_SESSION_ID: transCtx.sessionId,
  CLAUDE_SESSION_ID: transCtx.sessionId, // D-91-02 pi-only alias
};
```
`prepareAsyncEnv` gets the identical three keys; its literal keeps `[MARKER_ENV]: dispatchId` as the only delta. `[VERIFIED: async-rewake/registry.ts:609-615]`

### Pattern 2: Env asserted through the public entry point, not the private fn

**What:** `prepareEnv`/`prepareAsyncEnv` are module-internal `async function`s (not exported). Tests substitute `spawn` via the exported `_setSpawnForTest` seam, invoke the public entry point, then read `spawnSpy.calls[0].options.env`.
**When to use:** Both lane-local env assertions AND the drift guard. Existing precedent:
- Sync: `tests/bridges/hooks/dispatch-exec.test.ts` "EXEC-01 + HOOK-05 …" reads `spy.calls[0]?.options.env` after `dispatchHookExec(...)`. `[VERIFIED: tests/bridges/hooks/dispatch-exec.test.ts:259-285]`
- Async: `tests/architecture/hooks-async-rewake.test.ts` "EXEC-05: PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH …" reads `spy.calls[0]?.options.env` after `spawnAndRegister(...)`. `[VERIFIED: tests/architecture/hooks-async-rewake.test.ts:419-439]`

### Pattern 3: Dual-lane spawn spy (already exists)

**What:** `installSpawnSpy(configure, { wireBoth: true })` in the async test file installs one fake `spawn` on BOTH lanes by calling `_setSpawnForTest` (async registry) and `_setExecSpawnForTest` (aliased `_setSpawnForTest` from dispatch-exec). Reset in `afterEach` via `_resetSpawnForTest` + `_resetExecSpawnForTest`.
**When to use:** The drift guard needs both lanes' env captured in one test run. `wireBoth` is exactly this machinery. `[VERIFIED: tests/architecture/hooks-async-rewake.test.ts:165-202,381-388]`
**Example (drift-guard skeleton):**
```typescript
// HENV-02 drift guard: prepareEnv and prepareAsyncEnv must agree modulo MARKER_ENV.
// Behavioral (D-91-01): drive both public entry points, compare captured env.
const tmp = await makeTempLocations();            // user-scope loc (see Pitfall 1)
const syncSpy = /* spawn spy on the sync lane */;
const asyncSpy = /* spawn spy on the async lane */;
const ctx = makeMockCtx(tmp.loc.scopeRoot);       // same cwd for both lanes
const pi = makeMockPi();
const entry = makeEntry({ claudeEvent: "PreToolUse" });

await dispatchHookExec(entry, { toolName: "bash", input: {} }, ctx.ctx);       // sync
await spawnAndRegister(entry, { toolName: "bash", input: {} }, ctx.ctx, pi.pi, tmp.loc); // async

const syncEnv = syncSpy.calls[0]!.options.env!;
const asyncEnv = asyncSpy.calls[0]!.options.env!;
// Known-delta comparison: the async lane's ONLY extra key is MARKER_ENV.
const syncKeys = new Set(Object.keys(syncEnv));
const asyncKeys = new Set(Object.keys(asyncEnv));
const onlyAsync = [...asyncKeys].filter((k) => !syncKeys.has(k));
const onlySync = [...syncKeys].filter((k) => !asyncKeys.has(k));
assert.deepEqual(onlyAsync, [MARKER_ENV], "MARKER_ENV is the sole async-only key");
assert.deepEqual(onlySync, [], "sync must not carry keys the async lane lacks");
for (const k of syncKeys) assert.equal(asyncEnv[k], syncEnv[k], `key ${k} must match across lanes`);
```
Repeat the assertion for a `SessionStart` fixture so the `CLAUDE_ENV_FILE` conditional's parity is guarded too (see Pitfall 2).

### Anti-Patterns to Avoid
- **Reading session id from the `process.env` spread instead of `transCtx.sessionId`.** The whole point of D-91-02 is that the explicit assignment from the authoritative snapshot wins; do not rely on Phase 90 having set `process.env.CLAUDE_CODE_SESSION_ID`.
- **Exporting `prepareEnv`/`prepareAsyncEnv` for the drift guard.** Unnecessary new surface; the spawn-spy indirect route is the established convention.
- **Snapshotting source text.** D-91-01 explicitly rejects a text snapshot; behavioral comparison is mandated (survives refactors).
- **Placing a new key before `...process.env`.** It would be overwritten by the spread — silent loss of the session id.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session-id snapshot | Re-read `ctx.sessionManager.getSessionId()` inside `prepareEnv` | `transCtx.sessionId` (already snapshotted per dispatch) | `buildTranslationContext` snapshots it once; re-reading risks a mid-dispatch drift. `[VERIFIED: bridges/hooks/translation-context.ts:36-40]` |
| Spawn mocking | New ad-hoc `spawn` monkeypatch | `_setSpawnForTest`/`_resetSpawnForTest` (both lanes) + `wireBoth` helper | Existing seams; reset hygiene already in `afterEach`. `[VERIFIED: tests/architecture/hooks-async-rewake.test.ts:373-388]` |
| Temp user-scope locations | Hand-built `ScopedLocations` | `makeTempLocations()` in the async test file | Lays out `_shared` + `plugins` dirs so `assertPathInside` succeeds. `[VERIFIED: tests/architecture/hooks-async-rewake.test.ts:328-367]` |

**Key insight (single-source-of-truth for constants):** `shared/session-env.ts` does **not** currently export the key names or the `"1"` literal — they are inline literals inside `applySessionEnv` (`process.env.CLAUDECODE = "1"`, etc.). `[VERIFIED: shared/session-env.ts:32-36]` So the discretion "import from `shared/session-env.ts`" requires the planner to FIRST add exported constants there (e.g. `export const CLAUDECODE_VALUE = "1"` and key-name consts), then refactor both `applySessionEnv` and the two hook lanes to use them. That is a legal import direction (bridges → shared is permitted; see User Constraints / Common Pitfall 4) but a larger change than duplicating three literals with mirrored comments. Recommend the planner weigh: (a) add exported constants to `shared/session-env.ts` and thread them through all three call sites (one true source, more churn), or (b) duplicate the three literals locally with mirrored `HENV-01`/`HENV-02` comments (matches the existing deliberate hand-mirror posture the two functions already document). Both satisfy the constraints; (b) is smaller and consistent with the CLAUDE.md "surgical / simplicity" bias.

## Common Pitfalls

### Pitfall 1: Lane divergence on `CLAUDE_PLUGIN_DATA` under project scope
**What goes wrong:** The drift guard shows a false failure because the two lanes compute a different `CLAUDE_PLUGIN_DATA`.
**Why it happens:** The sync `prepareEnv` derives its own `loc` via `locationsFor(entry.scope, transCtx.cwd)` (`dispatch-exec.ts:298`), while `prepareAsyncEnv` receives `loc` from the caller (`registry.ts:597`). For **user** scope, `cwd` is irrelevant and both agree; for **project** scope they could diverge if the fixture's `loc` and `transCtx.cwd` don't correspond. `[VERIFIED: dispatch-exec.ts:298]` `[VERIFIED: async-rewake/registry.ts:594-607]`
**How to avoid:** Use a **user-scope** fixture for the drift guard (as `makeTempLocations()` already produces), so `locationsFor("user", …)` yields the same `dataRoot` regardless of `cwd`. Keep `ctx.cwd` identical across both invocations so `CLAUDE_PROJECT_DIR` matches.
**Warning signs:** `CLAUDE_PLUGIN_DATA` mismatch in the per-key comparison.

### Pitfall 2: `CLAUDE_ENV_FILE` conditional parity untested
**What goes wrong:** A future edit changes the `SessionStart`-only rule in one lane but not the other; a `PreToolUse`-only drift guard misses it.
**Why it happens:** Both lanes gate `CLAUDE_ENV_FILE` on `entry.claudeEvent === "SessionStart"`. `[VERIFIED: dispatch-exec.ts:319-323]` `[VERIFIED: async-rewake/registry.ts:617-621]`
**How to avoid:** The drift guard must run its comparison for BOTH a `SessionStart` fixture (asserts `CLAUDE_ENV_FILE` present and equal, path scheme `…/data/_shared/claude-env-<sid>.env`) and a non-`SessionStart` fixture (asserts absent in both). CONTEXT `<specifics>` mandates this.
**Warning signs:** Only one of the two lanes sets `CLAUDE_ENV_FILE`, or the paths differ (they must not — both use `transCtx.sessionId`).

### Pitfall 3: Snapshot value differs from the spread value
**What goes wrong:** In a session-switch race, `process.env.CLAUDE_CODE_SESSION_ID` (set by Phase 90) briefly diverges from `transCtx.sessionId`.
**Why it happens:** Phase 90's `applySessionEnv` mutates live `process.env` on `session_start`; a dispatch snapshot taken at a different instant could observe a stale spread value. `[VERIFIED: shared/session-env.ts:32-36]`
**How to avoid:** Assign all three id-related keys explicitly from `transCtx.sessionId` **after** the spread (D-91-02). This is the reason `CLAUDE_SESSION_ID` is pinned explicitly rather than left to the spread. A unit test can prove this by setting `process.env.CLAUDE_CODE_SESSION_ID` to a sentinel that differs from the ctx session id, then asserting the spawned env carries the ctx value, not the sentinel.
**Warning signs:** Test that seeds a divergent `process.env` value still passes when the key is read from the spread — indicates the explicit assignment is missing or mis-ordered.

### Pitfall 4: Import-direction confusion for `shared/session-env.ts`
**What goes wrong:** Planner assumes `bridges/hooks/*` cannot import `shared/`.
**Why it happens:** `session-env.ts`'s own docstring says it imports "nothing outside `platform/`" — but that is a constraint on `shared/session-env.ts` as an importer, not on who may import it. `[VERIFIED: shared/session-env.ts:11-14]`
**How to avoid:** The D-11 matrix forbids `bridges` from importing only `edge`, `orchestrators`, `transaction` — NOT `shared`. `[VERIFIED: tests/architecture/import-boundaries.test.ts:69-73]` Both hook lanes already import `../../shared/*` (`debug-log`, `errors`, `path-safety`). `[VERIFIED: dispatch-exec.ts:58-60]` So `bridges/hooks → shared/session-env` is legal.
**Warning signs:** ESLint `import-x/no-restricted-paths` error — would only fire if importing a forbidden zone, which `shared` is not.

## Code Examples

### Reading the captured env from a spawn spy (sync lane)
```typescript
// tests/bridges/hooks/dispatch-exec.test.ts:270-284 (verified)
await dispatchHookExec(
  makeEntry({ claudeEvent: "PreToolUse" }),
  { toolName: "bash", input: {} },
  makeCtx("/tmp/proj"),
);
const env = spy.calls[0]?.options.env ?? {};
assert.equal(env.CLAUDE_PROJECT_DIR, "/tmp/proj");
assert.equal(env.CLAUDE_PLUGIN_ROOT, asAbsolutePluginRoot("/test/plugin-root"));
// NEW assertions this phase adds:
// assert.equal(env.CLAUDECODE, "1");
// assert.equal(env.CLAUDE_CODE_SESSION_ID, "session-xyz");   // makeCtx sessionId
// assert.equal(env.CLAUDE_SESSION_ID, "session-xyz");
```
Note: `makeCtx` in the sync test returns `getSessionId: () => "session-xyz"`. `[VERIFIED: tests/bridges/hooks/dispatch-exec.test.ts:201-209]` The async test's `makeMockCtx` returns `"session-rewake"`. `[VERIFIED: tests/architecture/hooks-async-rewake.test.ts:229-244]`

### Reading the captured env from a spawn spy (async lane)
```typescript
// tests/architecture/hooks-async-rewake.test.ts:426-435 (verified)
await spawnAndRegister(
  makeEntry({}),
  { toolName: "bash", input: {} },
  ctx.ctx, pi.pi, tmp.loc,
);
const env = spy.calls[0]?.options.env ?? {};
assert.equal(env[MARKER_ENV], "fixed-uuid-marker");
// NEW assertions this phase adds mirror the sync ones (session id "session-rewake").
```

## State of the Art

Not applicable — no library/version churn. In-repo mechanics only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommending duplication-with-mirrored-comments (option b) over adding exported constants (option a) is consistent with house posture | Don't Hand-Roll | Low — both satisfy constraints; this is a discretion call the planner/operator finalizes. The two functions already self-document as deliberate hand-mirrors (`registry.ts:582-592`), so local literals fit; but the operator's "single source of truth" preference (CONTEXT discretion) may favor (a). |

**All other claims are `[VERIFIED]` against source files read this session.** No compliance/retention/security assumptions.

## Open Questions

1. **Single source of truth for the key names + `"1"`?**
   - What we know: `shared/session-env.ts` exports `applySessionEnv`, `PATH_LEDGER_ENV`, `applyPathLedger` — but NOT the key-name strings or `"1"` (inline literals). `[VERIFIED: shared/session-env.ts:32-36,46,61]` The import direction bridges→shared is legal.
   - What's unclear: whether to add exported constants (more churn across 3 call sites incl. `applySessionEnv`) or duplicate 3 literals locally.
   - Recommendation: Operator/planner decides per CONTEXT discretion. If chosen, add `export const CLAUDECODE_VALUE = "1"` plus name constants to `session-env.ts`, refactor `applySessionEnv` to use them, then import into both hook lanes — one atomic change so the SoT is real, not partial.

2. **Drift-guard test placement.**
   - What we know: `tests/architecture/hooks-async-rewake.test.ts` already wires both lanes (`wireBoth`) and has all fixtures (`makeEntry`, `makeMockCtx`, `makeMockPi`, `makeTempLocations`). `[VERIFIED: tests/architecture/hooks-async-rewake.test.ts:37-73,165-202]`
   - What's unclear: new file (`tests/architecture/hooks-env-parity.test.ts`) vs. a new `describe` block in the async file.
   - Recommendation: A new `describe("hook env parity (HENV-02)")` block in `hooks-async-rewake.test.ts` reuses the dual-lane machinery with zero duplication; a dedicated file would re-import all of it. Prefer the in-file describe unless the operator wants an independently-named artifact.

## Environment Availability

Skipped — no external dependencies. All work is in-repo TypeScript + Node built-ins already present and whitelisted.

## Validation Architecture

`workflow.nyquist_validation` is `true` `[VERIFIED: .planning/config.json:19]` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict` |
| Config file | none — glob-driven test script `[VERIFIED: package.json:82]` |
| Quick run command | `node --test "tests/bridges/hooks/**/*.test.ts" "tests/architecture/hooks-*.test.ts"` |
| Full suite command | `npm test` (globs `tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HENV-01 | Sync lane env carries `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID` (from `transCtx.sessionId`), alongside existing set | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ✅ (extend "EXEC-01 + HOOK-05" block) |
| HENV-01 | Session id read from snapshot, not the spread (seed divergent `process.env`, assert snapshot wins) | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ❌ Wave 0 (new assertion) |
| HENV-02 | Async lane env carries the same three keys | unit | `node --test tests/architecture/hooks-async-rewake.test.ts` | ✅ (extend spawn-and-register block) |
| HENV-02 | Both lanes identical modulo `MARKER_ENV` — PreToolUse fixture | architecture | `node --test tests/architecture/hooks-async-rewake.test.ts` | ❌ Wave 0 (new drift-guard describe) |
| HENV-02 | Both lanes identical modulo `MARKER_ENV` — SessionStart fixture (incl. `CLAUDE_ENV_FILE` parity) | architecture | `node --test tests/architecture/hooks-async-rewake.test.ts` | ❌ Wave 0 (new drift-guard case) |

### Sampling Rate
- **Per task commit:** `node --test tests/bridges/hooks/dispatch-exec.test.ts tests/architecture/hooks-async-rewake.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green (typecheck + lint + format + test + integration) `[VERIFIED: package.json:77]` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] New HENV drift-guard `describe` (or file) covering PreToolUse + SessionStart fixtures — covers HENV-02 mirror parity.
- [ ] New sync-lane assertion: divergent-`process.env` snapshot-wins case — covers HENV-01 / D-91-02.
- [ ] Extend existing "EXEC-01 + HOOK-05" (sync) and spawn-and-register env (async) blocks with the three new keys.
- Framework install: none — `node:test` + all fixtures already present.

## Security Domain

`security_enforcement` not present in the sampled config; the milestone is env-parity plumbing. This phase adds no new attack surface:
- No new file writes, no new network, no new spawn sites (the whitelisted 3-site set is unchanged). `[VERIFIED: dispatch-exec.ts:43-50]`
- Path containment for `CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` is unchanged — `assertPathInside` calls stay byte-for-byte. `[VERIFIED: dispatch-exec.ts:310,321]` `[VERIFIED: async-rewake/registry.ts:607,619]`
- The three added values are a constant `"1"` and the Pi session id (already exposed to the child via Phase 90's `process.env` mutation and via the stdin envelope's `session_id`). No secret is newly exposed.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No new external input; values are internal constants/snapshots |
| V6 Cryptography | no | — |
| V12 File handling | unchanged | Existing `assertPathInside` containment (NFR-10) preserved |

## Project Constraints (from CLAUDE.md)

- **Simplicity / surgical changes:** Add exactly three keys per literal; do not refactor adjacent code. Every changed line traces to HENV-01/02 or D-91-01/02.
- **Comment policy** (`.claude/rules/typescript-comments.md`): allowed IDs only — `HENV-01`, `HENV-02`, `D-91-01`, `D-91-02`, `NFR-*`; NO phase/plan/wave refs, no bare `Pitfall N`. `[VERIFIED: .claude/rules/typescript-comments.md]`
- **Output channel (IL-2):** unaffected — no `notify`/`console`/`process.stdout` added; the ESLint `no-restricted-syntax` gate targets output calls, not env assignment. `[VERIFIED: eslint.config.js:95-135]`
- **Quality bar (NFR-6):** `npm run check` must stay green.
- **TypeScript strict / ESM:** both lanes are ESM `.ts`; `NodeJS.ProcessEnv` typing already in place.
- **Git:** never commit to `main`; conventional commits; run `pre-commit run --files <changed>` before commit; worktree commits prefix `SKIP=trufflehog`.

## Sources

### Primary (HIGH confidence — files read this session)
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` — `prepareEnv` shape, env literal 312-323, spawn seam, whitelist docstring.
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` — `prepareAsyncEnv` shape 594-624, `MARKER_ENV` 81, spawn seams 168-175.
- `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` — `TranslationContext` fields + `buildTranslationContext`.
- `extensions/pi-claude-marketplace/shared/session-env.ts` — `applySessionEnv` inline literals; no exported name/value constants.
- `tests/bridges/hooks/dispatch-exec.test.ts` — sync lane env-assertion precedent + fixtures.
- `tests/architecture/hooks-async-rewake.test.ts` — async lane env-assertion precedent, `wireBoth` dual-spy, `makeTempLocations`.
- `tests/architecture/hooks-exec.test.ts` — hooks-exec invariant-pin conventions (header block map).
- `tests/architecture/import-boundaries.test.ts` — D-11 zone matrix (bridges→shared legal).
- `tests/shared/session-env.test.ts` — session-env contract test conventions (targeted key save/restore).
- `package.json`, `.planning/config.json`, `eslint.config.js`, `.claude/rules/typescript-comments.md`.

### Secondary
- `.planning/phases/91-hook-environment-parity/91-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external packages; all modules read this session.
- Architecture / mechanics: HIGH — both env literals, both spawn seams, and both test homes read verbatim.
- Pitfalls: HIGH — lane loc-derivation asymmetry and `CLAUDE_ENV_FILE` conditional confirmed in source.
- Single-source-of-truth constants: HIGH on the fact (no constants exported today); the choice between duplicate vs. extract is the one open discretion (A1).

**Research date:** 2026-08-03
**Valid until:** 2026-09-02 (stable in-repo mechanics; only invalidated by edits to the two lanes or the test fixtures).

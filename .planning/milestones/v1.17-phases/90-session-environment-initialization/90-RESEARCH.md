# Phase 90: Session environment initialization - Research

**Researched:** 2026-08-03
**Domain:** Pi extension runtime env injection (`process.env` mutation at session-start / load) + host loader/reload semantics
**Confidence:** HIGH (all load-bearing claims verified against installed source, file+line cited)

## Summary

This phase sets three env keys (`CLAUDECODE="1"`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`, `CLAUDE_SESSION_ID=<same>`) on Pi's live `process.env` at session start, and appends each installed **enabled** plugin's `<pluginRoot>/bin` to `process.env.PATH` (PENV-01). Pi's bash tool rebuilds every child env fresh at each spawn by spreading the full live `process.env`, with no `PI_*`-prefix scrub — so these mutations reach every later bash child. All four host-mechanism claims from the phase goal were verified against the installed peer `@earendil-works/pi-coding-agent@0.82.1`.

**The D-90-02 blocker is RESOLVED with a decisive answer: extension module-level state does NOT survive `/reload`.** On `/reload` (after first load) the host calls `clearExtensionCache()`, which bumps a generation counter and clears the factory cache; the next load creates a jiti instance with `moduleCache: false` and re-evaluates the extension module fresh. A module-level `let` baseline therefore resets to its initial value on every `/reload`, while `process.env` (in-process, no Node restart) retains the entries appended by the *previous* load. This exactly breaks the D-90-01 stale-PATH-cleanup design: after a reload the fresh (empty) baseline removes nothing, so PATH entries for since-uninstalled plugins leak permanently. Per D-90-02, the orchestrator MUST STOP and ask the user — do not silently fall back to the runner-up ledger design.

**Primary recommendation:** Register a `session_start` handler (factory-time, idempotent) for the three session vars using `ctx.sessionManager.getSessionId()`; run the PATH recompute in the existing `resources_discover` handler after `applyReconcile` (D-90-03). BEFORE planning the PATH-cleanup mechanism, surface the D-90-02 finding to the user — the module-level baseline (D-90-01) is unsound across `/reload`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Set `CLAUDECODE`/`CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` on `process.env` | Extension (host process, session_start) | — | Session-scoped runtime values; need `ctx.sessionManager`, only available on a session event |
| Append plugin `<pluginRoot>/bin` to `process.env.PATH` | Extension (host process, resources_discover) | Persistence (install state) | Recomputed from reconciled install state; `event.cwd` is authoritative for project scope |
| Deliver env to bash children | Pi host (`getShellEnv`/`resolveSpawnContext`) | — | Owned by the peer; extension only mutates `process.env`, host spreads it |
| Deliver env to MCP servers | pi-mcp-adapter (spread of `process.env`) | — | Out of this phase; documented in STATE (Phase 94) |

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. It uses only:
- Node built-ins (`node:os`, `node:path`) — bundled with Node.
- The existing peer dependency `@earendil-works/pi-coding-agent@0.82.1` (already installed; the extension's host).
- In-repo modules (`persistence/state-io.ts`, `persistence/locations.ts`, `platform/pi-api.ts`, `shared/debug-log.ts`).

No `npm install` step. No `package.json` dependency change expected.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SENV-01 | Bash child sees `CLAUDECODE=1` whenever extension is loaded | `session_start` fires on startup+reload (`agent-session.js:151,2069`); `getShellEnv` spreads `process.env` unscrubbed (`shell.js:103-114`); `resolveSpawnContext` touches only 5 `PI_*` keys (`bash.js:114-133`) — a `CLAUDECODE` set on `process.env` reaches every child |
| SENV-02 | Bash child sees `CLAUDE_CODE_SESSION_ID` = current Pi session id, fresh after switch/`/reload` | Overwrite value on every `session_start` (fires startup/reload/new/resume/fork — `agent-session-runtime.js:138,162,208,226,243,280` + `agent-session.js:151,2069`); source `ctx.sessionManager.getSessionId()` (in-repo precedent `translation-context.ts:56`) |
| SENV-03 | `CLAUDE_SESSION_ID` alias = same value (pi-only shim) | Same handler sets a third key to the same value; no host support needed — reaches children via the same unscrubbed spread |
| PENV-01 | Append each enabled plugin `<pluginRoot>/bin` to PATH; appended/dedup/idempotent/recomputed/added-even-if-absent | `state.marketplaces[mp].plugins[name]` with `enabled: boolean` (`state-io.ts:77`) and `resolvedSource == pluginRoot` (`dispatch-exec.ts:307`); both scopes via `locationsFor(scope, cwd).extensionRoot` → `loadState` (`locations.ts:144-147`, `state-io.ts:251`); recompute point = after `applyReconcile` in `resources_discover` (`index.ts:77`). **Cleanup mechanism blocked by D-90-02 — see Critical Finding.** |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Exact keys and values: `CLAUDECODE="1"`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`, `CLAUDE_SESSION_ID` alias with the same value (documented pi-only shim).
- Values overwritten fresh on every `session_start` (fires for startup/reload/new/resume/fork) — SENV-02 freshness after session switch / `/reload`.
- Session id source: `ctx.sessionManager.getSessionId()` (the `session_start` payload carries no session id).
- PATH semantics: appended never prepended; deduplicated; idempotent across repeated events; recomputed from install state; entry added even if the `bin/` directory does not exist (Claude Code 2.1.212 parity).
- Non-interference: only these keys are added; nothing else in `process.env` is touched.
- **D-90-01:** recompute tracks ownership via a **module-level baseline** — the extension remembers (in module state) the exact set of PATH entries it appended, removes exactly those on the next recompute, then appends the freshly derived set. No bookkeeping env var; no pattern-filtering (path-source marketplace plugins have `resolvedSource` roots outside managed containment dirs). Entries already on PATH that the extension did not append are never removed.
- **D-90-02 (BLOCKER contingency):** D-90-01 assumes extension module state survives `/reload`. **If module state does NOT survive `/reload`, STOP and ask the user** — do not silently fall back. (Runner-up not chosen: a pi-only `process.env` ledger var holding the appended-entry list.) Reversible — ownership mechanism localized to the recompute helper.
- **D-90-03:** PENV-01 PATH recompute runs in the existing **`resources_discover` handler, immediately after `applyReconcile`** (`index.ts`). PENV-01's "at session start" interpreted as "at load time" (document this reading). Three session vars stay in a `session_start` handler (they need `ctx.sessionManager`).
- **D-90-04:** **Both scopes contribute** bin dirs — user-scope AND project-scope installed enabled plugins. Project scope resolves via `event.cwd`.

### Claude's Discretion
- Module placement and naming for the new session-env code (a new shared/edge module registered from `index.ts` is the expected shape — match house structure).
- Deterministic append ordering (e.g. user scope before project scope, stable order within a scope) — pick one, make it testable.
- Failure behavior when state load fails during recompute: follow the house load-time convention (swallow, `debug-log`, never block Pi load — NFR-2).
- Test structure, including any drift-guard style tests.

### Deferred Ideas (OUT OF SCOPE)
- "Coverage sweep: test rare failure arms in update/reinstall/install" (`.planning/todos/pending/2026-06-12-...`) — keyword match only; unrelated to session env initialization. Left pending.
</user_constraints>

## CRITICAL FINDING — D-90-02 Blocker Resolution

**Question:** Does Pi's `/reload` re-import extension modules fresh (module-level state lost) or reuse the loaded module instance (module state survives)?

**Answer: Module-level state does NOT survive `/reload`. It is reset to its initial value on every reload.** `[VERIFIED: node_modules/@earendil-works/pi-coding-agent@0.82.1]`

**Evidence chain (installed peer 0.82.1):**

1. On `/reload`, the resource loader clears the extension cache when already loaded:
   `[VERIFIED: dist/core/resource-loader.js:219-223]`
   ```js
   async reload(options) {
       resetTimings("extensions");
       if (this.loaded) {
           clearExtensionCache();
       }
   ```

2. `clearExtensionCache()` empties the factory cache and bumps a generation counter:
   `[VERIFIED: dist/core/extensions/loader.js:111-118]`
   ```js
   let extensionCacheCwd;
   let extensionCacheGeneration = 0;
   const extensionCache = new Map();
   export function clearExtensionCache() {
       extensionCache.clear();
       extensionCacheCwd = undefined;
       extensionCacheGeneration++;
   }
   ```

3. The next load asks for a cache token with the *bumped* generation; because the cache was cleared, `loadExtensionModule` misses and re-imports through a jiti instance created with `moduleCache: false`, which re-evaluates the module fresh:
   `[VERIFIED: dist/core/extensions/loader.js:318-340]`
   ```js
   async function loadExtensionModule(extensionPath, cacheToken) {
       if (isCurrentCacheToken(cacheToken)) {
           const cachedFactory = extensionCache.get(extensionPath);
           if (cachedFactory) { return cachedFactory; }
       }
       const jiti = createJiti(import.meta.url, { moduleCache: false, ... });
       const module = await jiti.import(extensionPath, { default: true });
       ...
   ```
   `isCurrentCacheToken` requires both `extensionCacheCwd === cacheToken.cwd` AND `extensionCacheGeneration === cacheToken.generation` `[VERIFIED: dist/core/extensions/loader.js:313-317]`. After `clearExtensionCache()` the map is empty, so even when the token matches, `.get()` returns `undefined` and the fresh `jiti.import` runs — re-evaluating the module top-level (module `let` state reset).

**Corollary — `process.env` DOES survive `/reload`:** `reload()` is an in-process async method (`agent-session.js:2051-2072`); it does not respawn Node (consistent with the project's own NFR-2: "no fix may require a Pi process restart; `Run /reload` must suffice"). So PATH entries appended during the *previous* load remain on `process.env.PATH`, but the module's memory of *which* entries it appended is wiped.

**Why this breaks D-90-01:** After a `/reload`, the recompute runs with a **fresh (empty) baseline**. It removes nothing (baseline empty), then appends the freshly derived set. Dedupe (needed for idempotency) means still-installed plugins' entries — already on PATH from the prior load — are not duplicated. BUT entries for plugins **uninstalled between the two loads** are still on PATH from the prior load and are absent from the new baseline, so they are **never removed → permanent stale-PATH leak.** This is precisely the failure D-90-02 anticipated.

**Note on the runner-up (not a decision — informational for the user):** The rejected alternative — a pi-only `process.env` ledger var holding the appended-entry list — *would* survive `/reload` because `process.env` survives. It is the natural fix. But D-90-02 mandates STOP-and-ask rather than silent substitution.

**Routing:** Per D-90-02, the orchestrator MUST STOP and ask the user before the PATH-cleanup mechanism is planned. Present: (1) this verified finding, (2) that D-90-01's module-baseline leaks stale entries across `/reload`, (3) that the runner-up ledger survives. Everything else in this phase (the three session vars, the append/dedupe/recompute of currently-enabled plugins) is unaffected and can be planned normally.

## Verified Host Mechanism (pi-coding-agent 0.82.1)

All four mechanism claims in the phase goal are confirmed against the installed peer. **Installed version: `@earendil-works/pi-coding-agent@0.82.1`** `[VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json]` (matches the "re-verified 2026-08-02 against pi-coding-agent 0.82.1" note in REQUIREMENTS.md).

### `session_start` fires for all five reasons
`[VERIFIED: dist/core/agent-session-runtime.js:138,162,208,226,243,280]` — `reason: "resume"` (138, 280), `"new"` (162), `"fork"` (208, 226, 243).
`[VERIFIED: dist/core/agent-session.js:151]` — startup default: `config.sessionStartEvent ?? { type: "session_start", reason: "startup" }`.
`[VERIFIED: dist/core/agent-session.js:2069]` — reload: `emit({ type: "session_start", reason: "reload" })`.

### Ordering: `session_start` ALWAYS precedes `resources_discover`
- Startup path `[VERIFIED: dist/core/agent-session.js:1761-1762]`:
  ```js
  await this._extensionRunner.emit(this._sessionStartEvent);
  await this.extendResourcesFromExtensions(this._sessionStartEvent.reason === "reload" ? "reload" : "startup");
  ```
- Reload path `[VERIFIED: dist/core/agent-session.js:2069-2070]`: `emit(session_start)` then `extendResourcesFromExtensions("reload")`.
- `resources_discover` is emitted *inside* `extendResourcesFromExtensions`, and only if a handler is registered `[VERIFIED: dist/core/agent-session.js:1764-1768]`:
  ```js
  async extendResourcesFromExtensions(reason) {
      if (!this._extensionRunner.hasHandlers("resources_discover")) { return; }
      const { skillPaths, promptPaths, themePaths } = await this._extensionRunner.emitResourcesDiscover(this._cwd, reason);
  ```
  Implication for D-90-03: the session vars (in `session_start`) are set BEFORE the PATH recompute (in `resources_discover`) on every load/reload. This is consistent and harmless — the two handlers touch disjoint keys.

### `getShellEnv()` — spreads live `process.env`, only prepends Pi's bin dir, no `PI_*` scrub
`[VERIFIED: dist/utils/shell.js:103-114]`
```js
export function getShellEnv() {
    const binDir = getBinDir();
    const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
    const currentPath = process.env[pathKey] ?? "";
    const pathEntries = currentPath.split(delimiter).filter(Boolean);
    const hasBinDir = pathEntries.includes(binDir);
    const updatedPath = hasBinDir ? currentPath : [binDir, currentPath].filter(Boolean).join(delimiter);
    return { ...process.env, [pathKey]: updatedPath };
}
```
Notes: (a) PATH key looked up case-insensitively. (b) Pi prepends its managed bin dir (`getBinDir()`, `[VERIFIED: dist/config.js:440]`) — this is a **prepend**, so it takes precedence over the extension's **appended** plugin bin dirs (no conflict; system/Pi binaries win, matching Claude Code's append semantics for plugin bins). (c) No `PI_*`-prefix filtering — every `process.env` key is spread verbatim.

### `resolveSpawnContext()` — deletes/re-derives exactly five named `PI_*` keys, no prefix scrub
`[VERIFIED: dist/core/tools/bash.js:114-133]`
```js
function resolveSpawnContext(command, cwd, spawnHook, exposeSessionEnvironment, ctx) {
    const env = { ...getShellEnv() };
    delete env.PI_SESSION_ID;
    delete env.PI_SESSION_FILE;
    delete env.PI_PROVIDER;
    delete env.PI_MODEL;
    delete env.PI_REASONING_LEVEL;
    if (exposeSessionEnvironment && ctx) {
        env.PI_SESSION_ID = ctx.sessionManager.getSessionId();
        ...
    }
```
Implication: the extension's non-`PI_*` mutations (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`, and appended PATH entries) survive the spawn-context derivation and reach every bash child. The five deleted keys are unrelated to this phase.

## Standard Stack

No new libraries. Confirmed building blocks (all in-repo or Node built-ins):

| Building block | Source | Purpose |
|----------------|--------|---------|
| `ctx.sessionManager.getSessionId()` | peer API via `ExtensionContext` (`platform/pi-api.ts:47` re-export) | Current Pi session id — SENV-02/03 value. In-repo precedent: `bridges/hooks/translation-context.ts:56` |
| `pi.on("session_start", handler)` | peer API | Register the session-var handler at factory time. Idempotent-registration precedent: `edge/register.ts:116` |
| `resources_discover` handler | `index.ts:56-103` | Host for the PATH recompute after `applyReconcile` (`index.ts:77`) — D-90-03 |
| `loadState(extensionRoot)` | `persistence/state-io.ts:251` | Read install state per scope; returns `{ schemaVersion, marketplaces }`, missing file → default `{ schemaVersion: 2, marketplaces: {} }` (never throws on ENOENT) |
| `PluginInstallRecord` | `persistence/state-io.ts:54-83` | `enabled: boolean` (line 77, required — ENBL-02), `resolvedSource: string` (line 56, == pluginRoot) |
| `locationsFor(scope, cwd)` | `persistence/locations.ts:144` | `.extensionRoot` (line 147) feeds `loadState`; user scope ignores cwd (`getAgentDir()`), project scope = `<cwd>/.pi` (line 145) |
| `node:path` `join` | built-in | Build `<pluginRoot>/bin`; parse/join PATH via `path.delimiter` |
| `hookDebugLog` seam pattern | `shared/debug-log.ts:21` | Reference for a load-time swallow+debug seam (see Pitfall 3) |

## Architecture Patterns

### System Architecture Diagram

```
                          Pi host process (single Node process; survives /reload)
                                              │
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │                                                                                │
   │   session_start (startup/reload/new/resume/fork)   ── fires 1st ──►            │
   │        │                                                                       │
   │        ▼  [NEW session-env handler]                                            │
   │   process.env.CLAUDECODE          = "1"                                        │
   │   process.env.CLAUDE_CODE_SESSION = ctx.sessionManager.getSessionId()          │
   │   process.env.CLAUDE_SESSION_ID   = <same>          (overwrite fresh each time) │
   │                                                                                │
   │   resources_discover (startup/reload)              ── fires 2nd ──►            │
   │        │  index.ts: hydrate → applyReconcile → [NEW PATH recompute] → discover │
   │        ▼                                                                       │
   │   loadState(user)   ┐                                                          │
   │   loadState(project)┘→ enabled plugins → <resolvedSource>/bin                  │
   │        │                                                                       │
   │        ▼  remove prior-owned entries (⚠ baseline lost on /reload — D-90-02)    │
   │   process.env.PATH += dedup(<pluginRoot>/bin ...)   (appended, even if absent) │
   │                                                                                │
   └───────────────────────────────┬────────────────────────────────────────────────┘
                                    │  every bash-tool spawn rebuilds env fresh
                                    ▼
        getShellEnv(): { ...process.env, PATH: binDir + PATH }   (no PI_* scrub)
                                    │
                                    ▼
        resolveSpawnContext(): delete+re-derive 5 PI_* keys only
                                    │
                                    ▼
                            bash child env  ← sees CLAUDECODE, CLAUDE_CODE_SESSION_ID,
                                               CLAUDE_SESSION_ID, appended PATH
```

### Pattern 1: Two disjoint handlers, disjoint key sets
**What:** Session vars in `session_start` (needs `ctx.sessionManager`); PATH recompute in `resources_discover` (needs reconciled install state + `event.cwd`).
**When to use:** Always, per D-90-03. They fire in a fixed order (session_start first) but touch disjoint keys, so ordering is immaterial to correctness.
**Example (session vars — new handler, factory time):**
```typescript
// SENV-01/02/03: refresh Claude-Code session env on every session_start
// (startup/reload/new/resume/fork). Overwrite unconditionally so the value
// tracks the active session (SENV-02 freshness).
pi.on("session_start", (_event, ctx) => {
  const sessionId = ctx.sessionManager.getSessionId();
  process.env.CLAUDECODE = "1";
  process.env.CLAUDE_CODE_SESSION_ID = sessionId;
  process.env.CLAUDE_SESSION_ID = sessionId; // SENV-03 pi-only shim
});
```
`[CITED: edge/register.ts:116]` for the `pi.on("session_start", (_event, ctx) => {...})` shape and idempotent-registration convention.

### Pattern 2: Recompute from reconciled state, both scopes
**What:** After `applyReconcile`, load state for user + project scope, collect `<resolvedSource>/bin` for `enabled === true` records across all `marketplaces[*].plugins[*]`, dedupe, append.
**When to use:** Inside the `resources_discover` handler, after line 77 (`applyReconcile`), before `aggregateDiscoveredResources` (line 95). D-90-03/04.
**Iteration shape** (state is nested `marketplaces[mp].plugins[name]` — `state-io.ts:151,169`):
```typescript
const collectBinDirs = (state: ExtensionState): string[] => {
  const dirs: string[] = [];
  for (const mp of Object.values(state.marketplaces)) {
    for (const rec of Object.values(mp.plugins)) {
      if (rec.enabled) dirs.push(path.join(rec.resolvedSource, "bin"));
    }
  }
  return dirs;
};
```
`[VERIFIED: persistence/state-io.ts:54-83,151,169]` (record + nesting), `[VERIFIED: bridges/hooks/dispatch-exec.ts:307]` (`resolvedSource` == pluginRoot).

### Anti-Patterns to Avoid
- **Pattern-filtering PATH entries by prefix** to identify owned entries. Rejected in D-90-01: path-source marketplace plugins have `resolvedSource` roots outside managed containment dirs (`orchestrators/marketplace/add.ts` — "path sources have no clone dir"), so no prefix reliably matches.
- **Prepending plugin bin dirs.** PENV-01 mandates append (Claude Code parity); prepend would let a plugin shadow system binaries.
- **Skipping the append when `bin/` is absent.** PENV-01 requires the entry added even if the directory does not exist (Claude Code 2.1.212 appends unconditionally).
- **Reading the session id inside `resources_discover`.** The session vars belong in `session_start`; `resources_discover`'s `ExtensionContext` is available but the decision (D-90-03) keeps the two concerns separated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read install state | Custom JSON reader | `loadState(extensionRoot)` | Handles ENOENT→default, schema validation, migration (`state-io.ts:251`) |
| Per-scope roots | Manual `path.join(cwd, ".pi", ...)` | `locationsFor(scope, cwd)` | Encapsulates user (`getAgentDir`) vs project (`<cwd>/.pi`) + `PI_CODING_AGENT_DIR` honoring (`locations.ts:144-147`) |
| Plugin-root derivation | Re-derive from source spec | `record.resolvedSource` | Established mapping (`dispatch-exec.ts:307`) |
| Session id | Read `session_start` payload | `ctx.sessionManager.getSessionId()` | Payload carries no session id; sessionManager is the source of truth (`translation-context.ts:14`) |

## Common Pitfalls

### Pitfall 1: Assuming module state survives `/reload`
**What goes wrong:** A module-level `let baseline` (D-90-01) is silently reset to empty on every `/reload`, leaking stale PATH entries for uninstalled plugins.
**Why it happens:** `clearExtensionCache()` + `moduleCache: false` re-evaluate the module fresh (see Critical Finding).
**How to avoid:** Do not plan the D-90-01 mechanism until the user resolves D-90-02. Ownership must be tracked in something that survives `/reload` (e.g. `process.env` itself) — but that is a user decision, not a silent substitution.
**Warning signs:** A unit test that stubs a single load will pass; a test that simulates load→uninstall→reload→recompute would reveal the leak (recommend adding one once the mechanism is chosen).

### Pitfall 2: Non-interference violation (SENV-04 success criterion)
**What goes wrong:** Touching keys beyond the three session vars + PATH append breaks success criterion 4.
**Why it happens:** Convenience mutations (e.g. clearing unrelated vars) or replacing PATH wholesale instead of appending.
**How to avoid:** Only assign the three named keys; for PATH, read → split on `path.delimiter` → append missing → join. Never delete keys.
**Warning signs:** A non-interference unit test snapshotting `process.env` before/after should show exactly the intended delta.

### Pitfall 3: Blocking Pi load on state-read failure (NFR-2)
**What goes wrong:** An unhandled throw in the recompute propagates past `resources_discover` and blocks Pi load.
**Why it happens:** `loadState` can throw on malformed JSON / schema-invalid state (it only swallows ENOENT — `state-io.ts:257-263`).
**How to avoid:** Wrap the recompute in try/catch that swallows + debug-logs (house convention — `index.ts:61-92` `hydrateProjectScopeForCwd` / `applyReconcile` pattern). Discretion: reuse a debug seam like `shared/debug-log.ts:21` or add a session-env-scoped equivalent (note IL-2/IL-3 — direct `console.*` needs the per-file ESLint override, as `debug-log.ts` documents).
**Warning signs:** A test injecting a malformed state should confirm the handler returns normally and does not throw.

### Pitfall 4: PATH key case / delimiter portability
**What goes wrong:** Hard-coding `"PATH"` and `":"`.
**Why it happens:** Windows uses a case-insensitive PATH key and `;` delimiter; the host looks up PATH case-insensitively (`shell.js:105`).
**How to avoid:** Use `path.delimiter`; for the key, prefer mutating `process.env.PATH` (Node normalizes the common case) or mirror the host's case-insensitive lookup if targeting Windows parity. Given the repo's Unix-first posture, `process.env.PATH` + `path.delimiter` is acceptable; document the choice.

## Runtime State Inventory

This phase does not rename/refactor/migrate stored identifiers. However, because the core question is about state surviving `/reload`, the relevant runtime-state facts:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope (`marketplaces[*].plugins[*].resolvedSource`, `.enabled`) — read-only input to the recompute | None (read only) |
| Live process state | `process.env` (survives `/reload`; PATH mutated by this phase) and **extension module-level `let` state (does NOT survive `/reload`** — Critical Finding) | Drives D-90-02 user decision |
| OS-registered state | None | None — verified: no OS registration in scope |
| Secrets/env vars | Three new session env keys + PATH append on `process.env`; no secret material | None |
| Build artifacts | None | None |

## Code Examples

Verified in-repo integration point — the `resources_discover` handler to extend:
```typescript
// index.ts:76-98 (existing) — PATH recompute inserts between applyReconcile and
// aggregateDiscoveredResources, inside the same NFR-2 try/catch discipline.
try {
  await applyReconcile({ ctx, pi, cwd: event.cwd });
  // [NEW] PENV-01 PATH recompute here (D-90-03): both scopes (D-90-04),
  // wrapped so a state-read failure never blocks load (Pitfall 3).
} catch (err) { /* swallow + notify, NFR-2 */ }

const discovered = await aggregateDiscoveredResources(
  locationsFor("user", homedir()),
  locationsFor("project", event.cwd),
);
```
`[VERIFIED: extensions/pi-claude-marketplace/index.ts:76-98]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Assume `/reload` reuses module instances | `/reload` re-imports via jiti with `moduleCache: false` after `clearExtensionCache()` | pi-coding-agent 0.82.1 (current) | Module-level singletons reset each reload; only `process.env` and on-disk state persist |

**Deprecated/outdated:** none relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Mutating `process.env.PATH` (rather than a case-resolved key) is acceptable for this Unix-first repo | Pitfall 4 | Low — Windows PATH-key casing edge; host itself resolves PATH case-insensitively so a lowercase mismatch is unlikely in practice |

**All load-bearing claims (reload semantics, event firing/ordering, `getShellEnv`/`resolveSpawnContext`, state shape, integration points) are `[VERIFIED]` with file+line evidence — not assumed.**

## Open Questions

1. **D-90-02 PATH-ownership mechanism (BLOCKER — user decision required).**
   - What we know: module-level state does NOT survive `/reload` (verified); `process.env` does.
   - What's unclear: which reload-durable mechanism the user wants (the runner-up `process.env` ledger var, or another).
   - Recommendation: STOP and surface the Critical Finding to the user per D-90-02 before planning the cleanup helper. The three session vars and the append/dedupe of currently-enabled plugins can be planned independently.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@earendil-works/pi-coding-agent` | Host API (`session_start`, `ctx.sessionManager`, `getShellEnv`) | ✓ | 0.82.1 | — |
| Node built-ins (`os`, `path`) | PATH/join, homedir | ✓ | bundled | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node:test`) |
| Config file | none — glob-driven `test` script in `package.json` |
| Quick run command | `node --test "tests/shared/<new>.test.ts"` (scope to the new module's test) |
| Full suite command | `npm test` (unit) / `npm run check` (typecheck + lint + format + unit + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SENV-01 | `CLAUDECODE="1"` set on session_start | unit | `node --test tests/<path>/session-env.test.ts` | ❌ Wave 0 |
| SENV-02 | `CLAUDE_CODE_SESSION_ID` = getSessionId(), refreshed each event | unit | same | ❌ Wave 0 |
| SENV-03 | `CLAUDE_SESSION_ID` alias equals same value | unit | same | ❌ Wave 0 |
| SENV (non-interference) | only the 3 keys added; `process.env` otherwise undisturbed | unit | same | ❌ Wave 0 |
| PENV-01 | append/dedupe/idempotent; both scopes; enabled-only; added even if bin absent; recomputed | unit | `node --test tests/<path>/plugin-path.test.ts` | ❌ Wave 0 |
| PENV-01 (reload cleanup) | stale entries removed on recompute across reload | unit | same — **depends on D-90-02 resolution** | ❌ Wave 0 (blocked) |
| SENV-01..03 / PENV-01 | live: `env \| grep CLAUDE` through bash tool | manual-only | live-Pi UAT (repo convention: `tests/live-uat/`) | — |

### Sampling Rate
- **Per task commit:** `node --test` scoped to the new module's test file(s).
- **Per wave merge:** `npm test` (full unit suite).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`; live-UAT (`env | grep CLAUDE`) as the human-verification item.

### Wave 0 Gaps
- [ ] `tests/<placement>/session-env.test.ts` — SENV-01/02/03 + non-interference (mock `ctx.sessionManager.getSessionId`, snapshot `process.env`).
- [ ] `tests/<placement>/plugin-path.test.ts` — PENV-01 append/dedupe/idempotency/enabled-filter/both-scopes/absent-dir (mock `loadState` per scope).
- [ ] (Blocked) reload-cleanup test — author only after D-90-02 mechanism is chosen.
- Framework install: none — `node:test` already in use.

## Security Domain

`security_enforcement` is not set to `false` (treated as enabled). This phase's surface is narrow (env mutation), but note:

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | partial | Plugin `resolvedSource` originates from install state written by the extension's own validated install path; not free user input at this layer |
| V10/V12 (config/file paths) | partial | PATH entries are **appended** (lowest precedence) so a malicious plugin `bin/` cannot shadow system binaries; containment (NFR-10) governs writes, not PATH reads |
| V6 Cryptography | no | none |
| V2/V3/V4 (auth/session/access) | no | `CLAUDE_CODE_SESSION_ID` is a non-secret session identifier, not an auth token |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plugin bin shadowing system binaries | Elevation of Privilege | Append (never prepend) — PENV-01 already mandates this |
| Stale PATH entry pointing at a removed/replaced dir | Tampering | Recompute from install state; but note the D-90-02 leak makes stale entries persist across reload — a reason the ownership mechanism matters |
| Env var injection into child processes | Tampering | Values are fixed literals / a session id from `sessionManager`; no untrusted interpolation |

## Sources

### Primary (HIGH confidence)
- `node_modules/@earendil-works/pi-coding-agent@0.82.1` — `dist/core/resource-loader.js` (reload/clearExtensionCache), `dist/core/extensions/loader.js` (jiti `moduleCache:false`, cache generation), `dist/core/agent-session.js` + `dist/core/agent-session-runtime.js` (session_start reasons + ordering vs resources_discover), `dist/utils/shell.js` (`getShellEnv`), `dist/core/tools/bash.js` (`resolveSpawnContext`), `dist/config.js` (`getBinDir`).
- In-repo: `extensions/pi-claude-marketplace/index.ts`, `persistence/state-io.ts`, `persistence/locations.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/translation-context.ts`, `edge/register.ts`, `platform/pi-api.ts`, `shared/debug-log.ts`.
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/90-.../90-CONTEXT.md`.

### Secondary (MEDIUM confidence)
- none — no web research required; this is an internal-codebase phase.

### Tertiary (LOW confidence)
- none.

## Metadata

**Confidence breakdown:**
- Reload/module-state semantics (D-90-02): HIGH — direct source, full evidence chain.
- Event firing + ordering: HIGH — emit sites cited.
- `getShellEnv`/`resolveSpawnContext`: HIGH — full function bodies cited.
- State shape + integration points: HIGH — in-repo source cited with line ranges.

**Research date:** 2026-08-03
**Valid until:** tied to `@earendil-works/pi-coding-agent@0.82.1` — re-verify the reload/loader claims if the peer version changes.

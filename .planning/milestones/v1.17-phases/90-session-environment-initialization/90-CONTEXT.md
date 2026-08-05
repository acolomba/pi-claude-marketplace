# Phase 90: Session environment initialization - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

At session start the extension sets the two Claude Code session-scoped env vars
(`CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`) plus the pi-only
`CLAUDE_SESSION_ID` shim on Pi's live `process.env`, and appends each installed
enabled plugin's `<pluginRoot>/bin` to `process.env.PATH` (PENV-01) — so every
bash child spawned by Pi's bash tool sees Claude-Code-parity environment
variables. Pi's bash tool spreads the full live `process.env` at each spawn
(`getShellEnv()`; no `PI_*`-prefix scrub — only five named `PI_*` keys are
re-derived), so extension mutations reach every later bash child. This is the
shared runtime-injection groundwork Phase 91 (hook env) leans on.

Requirements: SENV-01, SENV-02, SENV-03, PENV-01.

</domain>

<decisions>
## Implementation Decisions

### Locked by ROADMAP/REQUIREMENTS (restated, not re-decided)
- Exact keys and values: `CLAUDECODE="1"`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`, `CLAUDE_SESSION_ID` alias with the same value (documented pi-only shim).
- Values overwritten fresh on every `session_start` (fires for startup/reload/new/resume/fork) — SENV-02 freshness after session switch / `/reload`.
- Session id source: `ctx.sessionManager.getSessionId()` (the `session_start` payload carries no session id).
- PATH semantics: appended never prepended; deduplicated; idempotent across repeated events; recomputed from install state; entry added even if the `bin/` directory does not exist (Claude Code 2.1.212 parity).
- Non-interference: only these keys are added; nothing else in `process.env` is touched.

### Stale PATH cleanup (ownership of appended entries)
- **D-90-01 (revised 2026-08-03 after research):** The recompute tracks ownership via a **pi-only env-var ledger** — a dedicated `process.env` bookkeeping variable (e.g. `PI_CLAUDE_MARKETPLACE_PATH`; exact name at planner's discretion, clearly extension-scoped) holding the list of PATH entries the extension appended. Recompute = remove exactly the ledger entries from `PATH`, re-derive the fresh set from install state, append, rewrite the ledger. The ledger's lifetime is exactly coupled to the `process.env` it describes: it survives `/reload` together with the PATH mutations and dies with the process. It is visible to child processes — a documented pi-only bookkeeping var (Phase 94 docs note it). No pattern-filtering (impossible anyway: path-source marketplace plugins have `resolvedSource` roots outside the managed containment dirs — `orchestrators/marketplace/add.ts` "path sources have no clone dir"). Entries already on PATH that the extension did not append are never removed (dedupe skips appending them, so they never enter the ledger). — **Reversibility:** reversible — the ownership mechanism is localized to the recompute helper; swapping it later touches one module and its tests.
- **D-90-02 [informational] (RESOLVED 2026-08-03):** The original module-level-baseline choice carried a blocker contingency: verify module state survives `/reload`. Research **falsified** it — `/reload` calls `clearExtensionCache()` (`resource-loader.js:222`) and re-imports extensions through jiti with `moduleCache: false` (`loader.js:325-332`), re-evaluating module top-level fresh, while `process.env` survives (in-process reload). Per the contingency the user was asked and selected the **env-var ledger** (over a pid-guarded disk ledger and over accepting the stale-entry gap). D-90-01 above is the operative decision.

### PATH recompute trigger + scope coverage
- **D-90-03:** The PENV-01 PATH recompute runs in the existing **`resources_discover` handler, immediately after `applyReconcile`** (`index.ts`) — `event.cwd` is the authoritative project cwd, install state was just reconciled, and the event fires on every load/reload, which is exactly the "installs/uninstalls reflected after reload" contract. PENV-01's "at session start" is interpreted as "at load time" (document this reading). The three session vars stay in a `session_start` handler (they need `ctx.sessionManager`).
- **D-90-04:** **Both scopes contribute** bin dirs: user-scope AND project-scope installed enabled plugins (Claude Code appends `<pluginRoot>/bin` for all enabled plugins regardless of scope). Project scope resolves via `event.cwd`, same as the rest of the extension.

### Claude's Discretion
- Module placement and naming for the new session-env code (a new shared/edge module registered from `index.ts` is the expected shape — match house structure).
- Deterministic append ordering (e.g. user scope before project scope, stable order within a scope) — pick one, make it testable.
- Failure behavior when state load fails during recompute: follow the house load-time convention (swallow, `debug-log`, never block Pi load — NFR-2).
- Test structure, including any drift-guard style tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and ground truth
- `.planning/REQUIREMENTS.md` — SENV-01..03, PENV-01 (the phase's four requirements; includes the verified `getShellEnv()`/`resolveSpawnContext()` mechanism notes)
- `.planning/ROADMAP.md` — Phase 90 entry (goal, five success criteria)
- `.planning/PROJECT.md` — "Current Milestone: v1.17 env-parity" section (Claude Code v2.1.212 ground-truth verification notes: what a live Claude Code bash child carries, PENV-01 live verification, out-of-scope var list)

No phase-specific external spec docs exist — the ground truth is captured in the three planning docs above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ctx.sessionManager.getSessionId()` — established session-id source; same pattern used at `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts:56`.
- `pluginRoot == record.resolvedSource` — the established install-record → plugin-root mapping (`extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:307` derives `CLAUDE_PLUGIN_ROOT` this way).
- `loadState` / `PluginInstallRecord` (`persistence/state-io.ts`) — `enabled: boolean` is required (ENBL-02); filter `enabled: true` records per scope.
- `locationsFor(scope, cwd)` (`persistence/locations.ts:144`) — per-scope roots; user scope ignores cwd, project scope is `<cwd>/.pi`.

### Established Patterns
- `session_start` registration precedent: `edge/register.ts:116` (TC-7 autocomplete wrapper) — idempotent-handler convention documented there.
- Load-time failure convention: swallow + debug-log, never propagate past the event handler (NFR-2) — see `index.ts` `resources_discover` try/catch structure and `hydrateProjectScopeForCwd`.
- Comment policy: decision/requirement IDs allowed, no phase/plan references (`.claude/rules/typescript-comments.md`).

### Integration Points
- `extensions/pi-claude-marketplace/index.ts` — the `resources_discover` handler (hydrate → `applyReconcile` → `aggregateDiscoveredResources`): PATH recompute inserts after `applyReconcile` (D-90-03). A `session_start` registration for the session vars is added at factory time (alongside existing registrations).
- Path-source marketplaces are referenced in place — no clone dir (`orchestrators/marketplace/add.ts:444` comment) — so plugin roots are NOT all under managed containment roots; this is why pattern-based PATH cleanup was rejected (D-90-01).

</code_context>

<specifics>
## Specific Ideas

- **Research question (feeds D-90-02 blocker):** verify in `@earendil-works/pi-coding-agent` source whether `/reload` re-imports extension modules fresh (module-level state lost) or reuses loaded module instances. Also confirm `session_start` fires for startup/reload/new/resume/fork as the roadmap asserts, and the relative ordering of `session_start` vs `resources_discover` at load.
- Verification expectation: unit tests assert the `process.env` mutations (keys set, PATH append/dedupe/removal on recompute, non-interference); a live-Pi check (e.g. `env | grep CLAUDE` through the bash tool) is the natural human-verification item, matching this repo's live-UAT convention.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Coverage sweep: test rare failure arms in update/reinstall/install" (`.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`) — keyword match only (install/extensions/claude); targets update/reinstall failure-arm test coverage, unrelated to session env initialization. Left pending for a future testing-focused effort.

</deferred>

---

*Phase: 90-session-environment-initialization*
*Context gathered: 2026-08-03*

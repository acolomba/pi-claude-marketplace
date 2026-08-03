# Phase 92: MCP staging parity - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A plugin's MCP servers are written to `mcp.json` with Claude-Code-equivalent
environment delivery — the milestone's biggest gap (`stampServers` writes
entries verbatim today). At stage time the substitution set
`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and — project-scope installs
only — `${CLAUDE_PROJECT_DIR}` is substituted with real install paths, and
`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (plus `CLAUDE_PROJECT_DIR` for
project-scope installs) are injected into each stdio server's `env` map,
plugin-declared keys winning. `update`/`reinstall` re-derive on every re-stage
so a plugin-root change never leaves stale paths. Atomic writes (NFR-1) and
containment (NFR-10) hold.

Requirements: MENV-01, MENV-02, MENV-03, MENV-04.

</domain>

<decisions>
## Implementation Decisions

### Locked by ROADMAP/REQUIREMENTS (restated, not re-decided)
- Substitution set: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${CLAUDE_PROJECT_DIR}` for project-scope installs ONLY (user-scope `${CLAUDE_PROJECT_DIR}` is a documented absence — unknowable at install time; passes through untouched).
- Injection keys: `CLAUDE_PLUGIN_ROOT` + `CLAUDE_PLUGIN_DATA` always (for injected entries); `CLAUDE_PROJECT_DIR` additionally for project-scope installs only.
- Precedence: plugin-declared env keys WIN over injected defaults (Claude Code's spread order — injected first, declared spread over).
- Rationale (verified): Claude Code substitutes at config load; pi-mcp-adapter does NOT interpolate `command`/`args` at all and interpolates env values against `process.env` replacing unknown `${VAR}` with the empty string — stage-time substitution is the only delivery path for `command`/`args` and the only correct one for per-plugin `env` values.
- MENV-04: `update`/`reinstall` re-stage paths re-derive substitution + injection from the CURRENT resolved plugin root — a new sha-addressed clone dir never leaves stale paths in `mcp.json`.
- All disk mutations atomic (NFR-1); containment (NFR-10); no network (NFR-5).

### Substitution surface
- **D-92-01:** Substitution is **whole-entry, deep**: walk every string value in each server entry at any nesting depth (`command`, `args`, `env`, `cwd`, `headers`, `url`, transport-specific fields…) and substitute the three-var set. Matches Claude Code's config-load semantics; rescues `cwd`/`headers` references that pi-mcp-adapter would otherwise interpolate to empty string against `process.env` (the per-plugin vars are never in `process.env`). Unknown `${...}` tokens pass through untouched (pi-mcp-adapter's own env-value interpolation and SENV-03's shell expansion remain downstream). Only string VALUES are substituted — never object keys, never the extension's own `_piClaudeMarketplace` marker.

### Env injection targeting
- **D-92-02:** Injection applies to **stdio-shaped entries only** — entries with a `command` field (the ones pi-mcp-adapter spawns with an env). Remote http/sse (url-type) entries keep their declared `env` untouched: upstream's injection is a property of the stdio spawn, and env keys on url-type entries are dead weight in the user's `mcp.json`. Substitution (D-92-01) still applies to url-type entries' string values.

### Claude's Discretion
- Where the deep-substitution walker lives (extend `shared/vars.ts` vs an mcp-bridge-local helper) — respect the D-11 import matrix; note Phase 93 will extend `substituteClaudeVars`'s variable set for content substitution, so keep the concerns cleanly separable (per-surface variable sets differ: MCP gets the project-scope `${CLAUDE_PROJECT_DIR}` arm; content substitution's set is Phase 93's).
- How pluginRoot/pluginData/scope thread into `StageMcpInput` (new fields resolved by the install/update/reinstall orchestrators, which already hold them).
- Test structure; fixture design for nested entries and precedence.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and ground truth
- `.planning/REQUIREMENTS.md` — MENV-01..04 (incl. the pi-mcp-adapter interpolation rationale)
- `.planning/ROADMAP.md` — Phase 92 entry (goal, success criteria)
- `.planning/PROJECT.md` — "Current Milestone: v1.17 env-parity" section (Claude Code v2.1.212 + pi-mcp-adapter 2.10.0 verified findings: `resolveEnv` spawns stdio servers with `{...process.env, ...interpolated(config.env)}`; `${VAR}` interpolation on env/cwd/headers/bearerToken with unknown → empty string, NOT command/args)

No phase-specific external spec docs exist.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stampServers` (`bridges/mcp/stage.ts:144-158`) — the single choke point where every staged entry is rewritten (marker stamp today; substitution + injection land here or adjacent).
- `prepareStageMcpServers` (`stage.ts:171+`) — the MC-6 prepare seam all three lifecycle paths call; `StageMcpInput` (`bridges/mcp/types.ts:52-62`) currently carries locations/cwd/marketplaceName/pluginName/servers/sourcePath — pluginRoot/pluginData/scope must be threaded in.
- `substituteClaudeVars` + `ClaudePluginVars` (`shared/vars.ts`) — the established pure substitution primitive (replaceAll, no recursion, T-03-01 no-re-expansion property); Phase 93 extends its variable set for content — keep MCP's walker separable.
- Call sites: `orchestrators/plugin/install.ts`, `orchestrators/plugin/update.ts`, `orchestrators/plugin/reinstall.ts:1528` (all already resolve pluginRoot = resolver output / `record.resolvedSource`, and pluginData via `locations.pluginDataDir(mp, plugin)`).

### Established Patterns
- Marker partition (`ours` vs `theirs`) preserves foreign entries verbatim — substitution/injection must apply ONLY to the plugin's own staged entries, never `theirs`.
- Atomic JSON write path already exists for `mcp.json` (NFR-1); collision checks (MC-4) unchanged.
- `entryObj` guard in `stampServers` tolerates non-object entries — the walker must keep that tolerance (malformed entries stay verbatim + marker).
- Comment policy: `.claude/rules/typescript-comments.md`.

### Integration Points
- `bridges/mcp/stage.ts` (substitution + injection at stamp time), `bridges/mcp/types.ts` (input type), the three orchestrator call sites (threading pluginRoot/pluginData/scope).
- MENV-04 falls out naturally: update/reinstall call the same prepare seam with freshly-resolved roots — a test should pin re-derivation (stale old-root path absent after re-stage with a new root).

</code_context>

<specifics>
## Specific Ideas

- Precedence implementation shape: injected defaults first, then spread the plugin-declared env over them (`{ ...injected, ...declared }`) — matches Claude's spread order and makes "declared wins" structural.
- Verification expectation: unit tests on the walker (nesting, arrays, non-string leaves, marker untouched, unknown-var pass-through), injection targeting (stdio vs url entries), precedence, project-vs-user scope arms, and an MENV-04 re-stage test. No live-Pi item inherent (mcp.json content is fully assertable); the deferred Phase 90 UAT covers runtime env end-to-end.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Coverage sweep: test rare failure arms in update/reinstall/install" — keyword-matched again; decision carried forward from Phase 90: unrelated, stays pending.

</deferred>

---

*Phase: 92-mcp-staging-parity*
*Context gathered: 2026-08-03*

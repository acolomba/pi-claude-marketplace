# Requirements: pi-claude-marketplace — Milestone v1.17 env-parity

**Defined:** 2026-08-01
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Installed Claude plugins see the same environment variables, delivered the same way, as they would under Claude Code — runtime env injection for session-scoped values, install-time textual substitution for install-stable per-plugin values — across all five component surfaces (skills, commands, agents, hooks, MCP servers).

Ground truth verified 2026-08-01 against the Claude Code v2.1.212 binary (string-literal extraction of its env-builder and substitution functions) and a live session environment. Key facts the requirements rest on: Claude Code's bash children carry `CLAUDECODE=1` + `CLAUDE_CODE_SESSION_ID` (+ `CLAUDE_EFFORT`) but NOT `CLAUDE_PROJECT_DIR` (hooks/MCP only); Pi's bash tool builds every child env from live `process.env` (`getShellEnv()` spreads it, scrubbing only `PI_*` keys); plugin MCP entries are currently written to `mcp.json` verbatim, so `${CLAUDE_PLUGIN_ROOT}` references reach pi-mcp-adapter unexpanded.

## v1 Requirements

### Session Environment

- [ ] **SENV-01**: A skill/command script run through Pi's bash tool sees `CLAUDECODE=1` in its environment whenever the extension is loaded
- [ ] **SENV-02**: The same script sees `CLAUDE_CODE_SESSION_ID` equal to the current Pi session id, and the value tracks the active session (fresh after session switch / `/reload`)
- [ ] **SENV-03**: `CLAUDE_SESSION_ID` is set to the same value — documented pi-only shim so un-substituted `${CLAUDE_SESSION_ID}` template literals still expand in shell contexts

### Hook Environment

- [ ] **HENV-01**: A plugin hook process (sync dispatch lane) receives `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` alongside the existing `CLAUDE_PROJECT_DIR`/`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` set
- [ ] **HENV-02**: The async-rewake lane delivers an identical env set — mirror parity between `prepareEnv` (`bridges/hooks/dispatch-exec.ts`) and `prepareAsyncEnv` (`bridges/hooks/async-rewake/registry.ts`), drift-guarded by test

### MCP Environment Parity

- [ ] **MENV-01**: A plugin MCP server whose `command`/`args`/`env` values contain `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_DATA}` is written to `mcp.json` with real install paths substituted
- [ ] **MENV-02**: Every installed plugin MCP server's `env` map carries `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`; plugin-declared env keys take precedence over injected defaults (Claude Code's spread order)
- [ ] **MENV-03**: Project-scope installs additionally inject `CLAUDE_PROJECT_DIR` into each server's `env`; user-scope absence is documented
- [ ] **MENV-04**: `update`/`reinstall` re-derive substituted paths and injected env — a plugin-root change (e.g. new sha-addressed clone dir) never leaves stale paths in `mcp.json`

### Substitution Completion

- [ ] **SUB-01**: `${CLAUDE_SKILL_DIR}` in a skill's content resolves at stage time to the skill's installed directory
- [ ] **SUB-02**: `${CLAUDE_PROJECT_DIR}` in project-scope skills/commands/agents resolves at stage time to the project root; user-scope occurrences pass through untouched (documented)

### Documentation

<!-- DOC numbering continues from v1.16 (DOC-04/05). -->

- [ ] **DOC-06**: New `docs/env-vars.md` — per-variable × per-surface matrix (Claude Code ground truth vs Pi delivery), the two-mechanism model (install-time textual substitution for install-stable per-plugin values vs runtime env injection for session-scoped values), documented absences; includes the resolved answer on whether pi-mcp-adapter spawns servers inheriting Pi's `process.env`
- [ ] **DOC-07**: `docs/hooks-compatibility.md` environment-variable table reconciled against `docs/env-vars.md`

## v2 Requirements

### Effort Mapping

- **EFRT-01**: `CLAUDE_EFFORT` derived from Pi's `thinkingLevel` (env + hook env + substitution) — deferred; semantically approximate mapping needs its own design pass

## Out of Scope

| Feature | Reason |
|---------|--------|
| `CLAUDE_EFFORT` (env + substitution) | Pi `thinkingLevel` mapping is semantically approximate; document-only in v1.17, tracked as EFRT-01 |
| `${user_config.*}` / `CLAUDE_PLUGIN_OPTION_*` | Requires a plugin-options feature Pi doesn't have |
| `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_EXECPATH` | Identity/internal semantics of a different host; setting them would misrepresent Pi |
| headersHelper vars (`CLAUDE_CODE_MCP_SERVER_NAME`/`_URL`) | pi-mcp-adapter spawns the servers, not this extension |
| `${CLAUDE_SESSION_ID}`/`${CLAUDE_EFFORT}` textual substitution in content | Runtime values cannot be baked into files materialized once at install; SENV-03's shell expansion covers bash contexts |
| `CLAUDE_ENV_FILE` beyond SessionStart | The other emitting events (Setup/CwdChanged/FileChanged) are unsupported in the bridge |
| `CLAUDE_WORKING_DIR` | Does not exist in Claude Code (zero hits in the v2.1.212 binary) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**

- v1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---

*Requirements defined: 2026-08-01*
*Last updated: 2026-08-01 after initial definition*

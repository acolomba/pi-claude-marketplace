# Requirements: pi-claude-marketplace -- mcp-4 (MCP 4)

**Defined:** 2026-10-02
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after
`/reload`, have every supported Claude plugin component appear as a working Pi-native artifact --
atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Make Pi 1.0 the baseline and deliver plugin MCP servers through
pi-mcp-adapter 5's own `mcp-adapter.json`, with Claude Code tool names, tool search, variable
expansion and live status -- without adopting Pi's built-in MCP.

Research: `.planning/research/SUMMARY.md` (and STACK, FEATURES, ARCHITECTURE, PITFALLS).

## Milestone Requirements

### Dependency floor (PIFL)

- [ ] **PIFL-01**: A user on Pi 1.0 can install the extension: the `@earendil-works/pi-coding-agent`
  peer floor is `>=1.0.0`, dev dependencies are `^1.0.0` for pi-coding-agent and pi-tui, and the
  FLOOR-01 gate pins the new literal.
- [ ] **PIFL-02**: The optional `pi-subagents` peer floor is `>=0.74.0`, and both pi-subagents peer
  integration tests run (zero skips) against 0.74.0 through `PI_SUBAGENTS_ROOT`.
- [ ] **PIFL-03**: `pi-mcp-adapter >=5.0.0` is declared as an optional peer dependency (never a
  devDependency), and the README states the floor and the adapter's `pi-ai` peer gap at Pi 1.0 as
  an upstream issue.
- [ ] **PIFL-04**: The Pi 0.99 typing fixes and peer-test fixes from features/mcp (`74162ca6`,
  `5b1d8ef6`, `dac3a245`, `69e0870a`) are re-implemented at the 1.0 floor, with the `types.d.ts`
  contract pins re-derived from the installed Pi 1.0 types.
- [ ] **PIFL-05**: Every devDependency is at its latest release except TypeScript, held at
  `^6.0.3` because typescript-eslint does not admit 7.x; the new `no-unsafe-enum-assignment`
  finding is fixed in code, and the fallow `lint.yml` action SHA matches the bumped fallow.
- [ ] **PIFL-06**: `engines.node` is raised to the floor Pi 1.0 and `write-file-atomic@8` actually
  require, and NFR-4 is amended to match in AGENTS.md and PROJECT.md.
- [ ] **PIFL-07**: The Stop canary (features/mcp `4f82096f`, re-run, not cherry-picked) and the
  workflow-engine canary pass live on Pi 1.0 with `@quintinshaw/pi-dynamic-workflows` 3.13.1, and
  `scripts/pi.sh` pins adapter 5.0.0, pi-subagents 0.74.0 and engine 3.13.1.

### Adapter detection (ADET)

- [ ] **ADET-01**: When only Pi's built-in MCP is active (no pi-mcp-adapter), install, list and
  info report the plugin's MCP component as needing pi-mcp-adapter, proven by a built-in-only
  negative test.
- [ ] **ADET-02**: The adapter is detected through its `mcp-adapter` command or a
  `pi-mcp-adapter` source, so installs with `disableProxyTool` or from a fork still count as
  present; a bare tool named `mcp` from another extension does not count (amended in Phase 1
  discussion, D-01-05).

### Adapter-file delivery (AFILE)

- [ ] **AFILE-01**: Installing a plugin writes its MCP servers as marked entries into
  `<scopeRoot>/mcp-adapter.json` (user: `<Pi agent dir>/mcp-adapter.json`; project:
  `<cwd>/.pi/mcp-adapter.json`), and uninstalling removes exactly those entries; the NFR-10 write
  set includes the new file.
- [ ] **AFILE-02**: A user's `mcp-adapter.json` with comments, trailing commas or a BOM is read the
  way the adapter reads it; a file that cannot be parsed is refused with a typed error and never
  replaced, and every foreign key (`settings`, `imports`, `claudePlugins`, user servers) survives
  a write.
- [ ] **AFILE-03**: When the existing file uses the legacy `mcp-servers` key, our entries go under
  that key, so the user's servers keep loading.
- [ ] **AFILE-04**: When a rewrite would drop the user's JSONC comments, the user is warned once.
- [ ] **AFILE-05**: Collision detection follows adapter 5's nine-source precedence (later source
  wins) and treats a partial entry (no `command`/`url`/`socket`) as an override, not a collision
  (closes MCPSRC-01).
- [ ] **AFILE-06**: A user override written into our entry (for example `/mcp-adapter disable`)
  survives a plugin update or reinstall; the carried-forward field set is closed and recorded as a
  decision.

### Entry translation (ANAME, AVAR)

- [ ] **ANAME-01**: A plugin MCP server's tools reach the model as Claude Code names them,
  `mcp__plugin_<plugin>_<server>__<tool>`, by writing the server key `plugin_<plugin>_<server>_`
  (Claude's normalization: every character outside `[A-Za-z0-9_-]` becomes `_`) with
  `toolPrefix: "mcp"` pinned on the entry.
- [ ] **ANAME-02**: Plugin hook matchers and agent `tools:` entries that name the plugin's own MCP
  tools in Claude form match the delivered tools.
- [ ] **ANAME-03**: Two servers whose normalized keys collide, or whose tool names exceed the
  length Pi 1.0 accepts (measured first), are refused or warned at install with a clear reason.
- [ ] **ANAME-04**: Plugin MCP tools are loaded on demand through Pi's tool search
  (`directTools: "search"`), and a server marked `alwaysLoad` gets `directTools: true`.
- [ ] **ANAME-05**: Entries leave `lifecycle` unset (adapter default `lazy`); the divergence from
  Claude Code's session-long connection is documented.
- [ ] **ANAME-06**: The server `description` from the plugin manifest is written to the entry.
- [ ] **ANAME-07**: Claude transport and option fields are translated to adapter fields (`sse` ->
  `httpTransport`, request timeout, OAuth callback port); fields with no adapter equivalent (`ws`,
  `headersHelper`) produce an install warning.
- [ ] **AVAR-01**: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and project-scope
  `${CLAUDE_PROJECT_DIR}` are expanded at install time, in Claude's fields only (stdio `command`,
  `args`, `env` values; remote `url`, `headers`).
- [ ] **AVAR-02**: `${VAR:-default}` is resolved at install time with Claude's rule (an empty value
  counts as set); plain `${VAR}` is left for the adapter to expand at runtime, so no environment
  value is ever written to disk.
- [ ] **AVAR-03**: A leading `!` in values the adapter would run as a shell command is escaped as
  `!!`, and fields where the adapter re-expands with no escape produce a warning instead of a
  parity claim (closes MENVX-01, ENVLIT-01).
- [ ] **AVAR-04**: A referenced variable that is unset with no default produces a missing-variable
  warning at install, as Claude Code warns.
- [ ] **AVAR-05**: Claude's credential deny-list (`ANTHROPIC_API_KEY` and peers) is applied to
  `url` and `headers` expansion and tested as a security control.

### Migration (AMIG)

- [ ] **AMIG-01**: After upgrading, `/reload` moves each installed plugin's marked entries from
  `<scopeRoot>/mcp.json` into `mcp-adapter.json` in their final translated shape, with no
  reinstall; the pass is idempotent and retries after a partial failure (NFR-2, NFR-3).
- [ ] **AMIG-02**: The move adds to `mcp-adapter.json` before removing from `mcp.json`, so a
  failure between the two writes never loses a server, proven by a fault-injection test.
- [ ] **AMIG-03**: The user sees one migration notice listing `old -> new` server names, the
  re-sign-in and project re-approval the rename causes, and the reload hint (the adapter picks up
  the move one `/reload` later).
- [ ] **AMIG-04**: A marked legacy entry with no owning install record is left in place with a
  warning.

### Live status (ASTAT)

- [ ] **ASTAT-01**: `/claude:plugin info` shows each plugin MCP server's adapter state (for example
  connected, cached, needs-auth, failed) from the adapter's `pi-mcp-adapter/status/v1` events,
  without importing the adapter and without connecting servers.
- [ ] **ASTAT-02**: Before the first status snapshot, or when the adapter is absent, info shows an
  explicit unknown state instead of guessing; new status tokens are closed-catalog amendments in
  `docs/output-catalog.md`.

### Docs and live proof (ADOC)

- [ ] **ADOC-01**: README, `docs/env-vars.md` (ENVDOC-01), `docs/hooks-compatibility.md` and the
  PRD/NFR-10 text describe adapter-file delivery, naming, tool search, variable rules and the
  documented divergences.
- [ ] **ADOC-02**: A live UAT in a sandboxed agent directory proves adapter 5 loads our entries,
  migrates a seeded legacy entry (counting reloads), finds plugin tools through tool search, and
  shows status in info.
- [ ] **ADOC-03**: CHANGELOG records the milestone, and a version bump is offered before the PR.

## Future Requirements

- Upstream adapter request: a `__` tool-separator mode, which would remove the trailing-underscore
  key (ANAME-01).
- Upstream adapter request: `${VAR:-default}` support at runtime.
- Remove `<scopeRoot>/mcp.json` from the NFR-10 write set after the migration window.
- Credential blanking for Pi provider keys passed to plugin servers.
- PreToolUse parity through the adapter's approval broker (hooks milestone).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pi built-in MCP (`pi.registerMcpServer()`) | features/mcp milestone abandoned: dropping pi-mcp-adapter regresses users; adapter treats registered servers as proxy-only |
| Built-in MCP as a soft-dep fallback | Operator decision: adapter only |
| Writing Pi-format `mcp.json` or dual-writing both files | Adapter-native file reaches every adapter field; dual writes run servers twice |
| Resolving every `${VAR}` at install time | Writes secrets to disk |
| `keep-alive` lifecycle | Operator chose the adapter's lazy default |
| Comment-preserving JSONC editor | Operator chose warn-once; avoids a new runtime dependency |
| TypeScript 7 | typescript-eslint and the compiler-API scripts do not support it yet |
| Touching adapter cache, keyring or approval files | Outside the NFR-10 write set |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIFL-01 | Phase 1 | Pending |
| PIFL-02 | Phase 1 | Pending |
| PIFL-03 | Phase 1 | Pending |
| PIFL-04 | Phase 1 | Pending |
| PIFL-05 | Phase 1 | Pending |
| PIFL-06 | Phase 1 | Pending |
| PIFL-07 | Phase 1 | Pending |
| ADET-01 | Phase 1 | Pending |
| ADET-02 | Phase 1 | Pending |
| AFILE-01 | Phase 2 | Pending |
| AFILE-02 | Phase 2 | Pending |
| AFILE-03 | Phase 2 | Pending |
| AFILE-04 | Phase 2 | Pending |
| AFILE-05 | Phase 2 | Pending |
| AFILE-06 | Phase 2 | Pending |
| ANAME-01 | Phase 3 | Pending |
| ANAME-02 | Phase 3 | Pending |
| ANAME-03 | Phase 3 | Pending |
| ANAME-04 | Phase 3 | Pending |
| ANAME-05 | Phase 3 | Pending |
| ANAME-06 | Phase 3 | Pending |
| ANAME-07 | Phase 3 | Pending |
| AVAR-01 | Phase 4 | Pending |
| AVAR-02 | Phase 4 | Pending |
| AVAR-03 | Phase 4 | Pending |
| AVAR-04 | Phase 4 | Pending |
| AVAR-05 | Phase 4 | Pending |
| AMIG-01 | Phase 5 | Pending |
| AMIG-02 | Phase 5 | Pending |
| AMIG-03 | Phase 5 | Pending |
| AMIG-04 | Phase 5 | Pending |
| ASTAT-01 | Phase 6 | Pending |
| ASTAT-02 | Phase 6 | Pending |
| ADOC-01 | Phase 7 | Pending |
| ADOC-02 | Phase 7 | Pending |
| ADOC-03 | Phase 7 | Pending |

**Coverage:**

- Milestone requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---

*Requirements defined: 2026-10-02*
*Last updated: 2026-10-02 after roadmap creation (7 phases)*

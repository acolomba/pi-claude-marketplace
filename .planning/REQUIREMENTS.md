# Requirements: pi-claude-marketplace — mcp-builtin

**Defined:** 2026-11-04
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Milestone goal:** A plugin's MCP servers run through pi-mcp-adapter when it is installed and through Pi's built-in MCP when it is not. The two are equal implementations, and a switch between them never needs action from the user.

Inputs: the user's brief, kept verbatim with its amendment, in
`.planning/inputs/mcp-builtin/BRIEF.md`; research in
`.planning/research/SUMMARY.md` and its four dimension files.

**Equal implementations:** design every seam as if either implementation
could be the richer one. Each implementation owns its translation, its
verdict table (supported, blocked, malformed), its materialization, its status
reader, its naming, and its agent-grant form. There is no switch command: the
trigger is installing or uninstalling pi-mcp-adapter.

**Upstream parity:** every expected behavior is Claude Code's (binary 2.1.318
and code.claude.com docs) unless a recorded decision with an ID or a Pi
capability gap licenses a divergence. A gap with no license goes to the user.

**Behavioral tests:** each user-visible requirement is met by a cucumber
scenario under `features/` that fails without the behavior and observes what
Pi or a companion reports, never the files the bridge wrote. Every MCP
scenario runs under both the adapter and the built-in profile unless its
expectation is specific to one implementation, in which case it is a separate,
tagged scenario.

**Decisions taken while defining the milestone (user, 2026-11-04):**

- D-MB-01 (replaces brief decision 1): the extension never edits Pi settings;
  NFR-10 is not amended. With no active implementation, a plugin with MCP
  servers stays installed and carries a `{requires ...}` soft-dependency
  marker (D-MB-07); the user turns on Pi's built-in MCP or installs
  pi-mcp-adapter.
- D-MB-02 (brief decision 2): built-in plugin servers get
  `exposure: "deferred"`; a server with `alwaysLoad: true` gets `"direct"`.
- D-MB-03: amends APL-D1. A load may rewrite generated agent files whose MCP
  grants differ for the active implementation.
- D-MB-04: install records each server in its Claude form before plugin-variable
  substitution; each implementation encodes it at materialization.
- D-MB-05: installing a plugin while no implementation is active needs no
  `--partial` consent; the install shows the `{requires ...}` marker.
- D-MB-06: `--partial` consent is asked only on an install or update the user
  runs, against the active implementation; enable, apply, reinstall, import,
  and cascades never ask because of a switch.
- D-MB-07: the MCP soft-dependency marker names the implementation that
  would run every server of the plugin: `requires mcp` when either would,
  `requires pi-mcp-adapter` when only the adapter would, and
  `requires builtin mcp` when only Pi's built-in MCP would. It shows when no
  implementation is active, and also beside `{unsupported mcp}` when the
  active implementation cannot run a server that the other one can (for
  example `{unsupported mcp, requires pi-mcp-adapter}` for an `sse` server
  under built-in). A server neither implementation can run shows
  `{unsupported mcp}` only. `info`'s `requires:` line uses the same names
  with `(missing)`. The existing `requires pi-mcp-adapter` reason is kept.

Defaults taken by the parity rule and existing decisions (IDs assigned in
Phase 1): hook matchers see Claude's server segment (with `-`), and only the
tool segment's `-`→`_` fold is a licensed Pi gap; trust comes from Pi alone
(D-LOC-01); built-in servers are registered at `session_start` and again after
the load reconcile, not immediately on install; the OAuth client name is set
as Claude Code sets it; background subagent children never write files.

**Parallel work:** Phase 1 is the only serial prerequisite. It freezes the
shared files and cross-phase interfaces. Phases 2-5 each run in their own
child session and worktree, on their own `features/mcp-builtin-phase-N`
branch that the session pushes to GitHub, and the parent merges the branches into
`features/mcp-builtin` (merge commits, never rebase). Child phases never edit
frozen files, `CHANGELOG.md`, the READMEs, PROJECT.md Key Decisions, or
`BACKLOG.md`; they list those lines as parent lines in their last SUMMARY.
Phase 6 runs in the parent session after the last merge, because only the
parent may edit the CHANGELOG, the READMEs, and closed-set entries.

## v1 Requirements

### Pi 1.5.0

- [x] **PI15-01**: `package.json` declares `@earendil-works/pi-coding-agent` peer `>=1.5.0` and dev `^1.5.0`, `@earendil-works/pi-tui` dev `^1.5.0`, and `@earendil-works/pi-ai` dev at exactly `1.5.0`; `package-lock.json` matches and `npm run check` passes
- [x] **PI15-02**: The floor tests (`test/architecture/peer-floor.test.ts`, `test/e2e/pi-peer-floor`, `test/e2e/pi-json-output.test.ts`) prove Pi 1.5.0, and the README, `README.es.md`, the compatibility docs, `AGENTS.md`, `.planning/codebase/STACK.md`, and the PROJECT.md Pi API constraint name it
- [x] **PI15-03**: Whatever Pi 1.5.0 breaks (the pi-schema validation move, the `isProjectTrusted()` fix, the `oauth.clientRegistration` `"auto"` default) is fixed in the same phase, and the whole unit, integration, and cucumber suites pass on 1.5.0

### Implementation selection

- [x] **MSEL-01**: Each command run, load, and session sees one active MCP implementation: pi-mcp-adapter when `/mcp-adapter` is loaded, built-in when `/mcp` comes from `builtin:mcp`, otherwise none; nothing reads it before every extension has loaded
- [x] **MSEL-02**: After the active implementation changes (the user installs or uninstalls pi-mcp-adapter, or turns Pi's built-in MCP on or off) and runs `/reload` or starts Pi again, every installed plugin's MCP servers run through the new active implementation with no reinstall, `apply`, or other plugin action. Turning built-in MCP back on after the adapter turned it off is the user's step (D-MB-01)
- [x] **MSEL-03**: The extension never registers a server with Pi while the adapter is active or while no implementation is active, so Pi reports no extension error for an unconnected registration
- [x] **MSEL-04**: Adapter entries keep being written at install whatever the active implementation, so a switch from built-in to the adapter serves every server without rewriting `mcp-adapter.json` at load

### Records and verdicts

- [x] **MREC-01**: Install, update, reinstall, enable, and import record every declared MCP server in its Claude form before plugin-variable substitution (D-MB-04), including servers the active implementation cannot run; `state.json` still holds no absolute paths
- [x] **MREC-02**: A plugin installed before this milestone, whose record lists no servers, materializes correctly under either implementation with no reinstall
- [ ] **MREC-03**: `list`, `info`, `install`, `update`, `pending`, and `apply` compute a plugin's available or partially available state against the active implementation, so one installed plugin can be available under one implementation and partially available under the other
- [ ] **MREC-04**: `info` shows each server's verdict for the active implementation with that implementation's reason tokens (for example, an `sse` server is blocked under built-in and runs under the adapter)
- [ ] **MREC-05**: With no active implementation, a plugin with MCP servers stays `installed` and its row carries `{requires mcp}`, `{requires pi-mcp-adapter}`, or `{requires builtin mcp}`, naming the implementation that would run every server (D-MB-01, D-MB-07); installing it needs no `--partial` (D-MB-05)
- [ ] **MREC-06**: `--partial` consent is asked only on an install or update the user runs, against the active implementation; enable, apply, reinstall, import, and cascades never ask because of a switch (D-MB-06)
- [ ] **MREC-07**: When the active implementation cannot run a server that the other implementation can, the row carries that implementation's `requires` marker beside `{unsupported mcp}`, and `info`'s `requires:` line names it with `(missing)` (D-MB-07); a server neither can run shows `{unsupported mcp}` only; the two new reasons are documented in the CHANGELOG and `docs/json-output.md`

### Built-in materialization

- [x] **BLT-01**: Under built-in, every enabled plugin's runnable servers are registered with `pi.registerMcpServer` on every startup and `/reload`, and the model can call their tools: through `tool_search` for `exposure: "deferred"`, and directly for an `alwaysLoad: true` server (D-MB-02)
- [x] **BLT-02**: A built-in server receives the values Claude Code would give it: stdio and streamable HTTP transports, `command`, `args`, `url`, `env`, and `headers` with Claude's variable expansion (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${VAR}`, `${VAR:-default}`), `timeout` converted from milliseconds to seconds, and the OAuth fields; no plugin value is reinterpreted by Pi, so a `$` or a leading `!` never expands or runs a shell command
- [x] **BLT-03**: A project-scope plugin's servers are registered only when Pi trusts the project
- [x] **BLT-04**: A built-in server is named `plugin_<plugin>_<server>` and its tools `mcp__plugin_<plugin>_<server>__<tool>` with Pi's `-`→`_` fold recorded as a divergence; a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent
- [x] **BLT-05**: `info` shows each built-in server's status as far as Pi exposes it (connected, not connected, disabled, overridden by `mcp.json`, project not trusted)
- [x] **BLT-06**: Under built-in, disable and uninstall remove a plugin's servers from the next session, enable restores them, and update replaces them with the new declaration

### Agent grants

- [ ] **MGRT-01**: A generated pi-subagents agent's MCP grants name the active implementation's server, and after a switch and `/reload` the load rewrites only the agent files whose grants changed, atomically, with no user action (D-MB-03); with no active implementation the files stay as they are
- [ ] **MGRT-02**: A background subagent child that loads the extension never rewrites agent files or any other installation state

### Hook naming

- [ ] **MHK-01**: A plugin hook whose matcher names a plugin MCP tool fires on the built-in tool call with the server segment matched in Claude's form (with `-`); only the tool segment's fold is a recorded divergence licensed by a Pi capability gap
- [ ] **MHK-02**: The pi-mcp-adapter `mcp` proxy special case in hook dispatch applies only while the adapter is active

### Dual-profile behavioral tests

- [x] **DUAL-01**: The cucumber suite has an adapter profile and a built-in profile; every MCP feature runs under both with shared step definitions, and implementation-specific expectations live in their own tagged scenarios
- [x] **DUAL-02**: Each profile's Pi proves which implementation is active, and an architecture test fails when an MCP scenario runs under only one profile without an implementation tag
- [x] **DUAL-03**: CI runs both profiles within the behavioral job timeouts
- [ ] **DUAL-04**: A switch scenario installs a plugin and reaches its server under the adapter; after the adapter is removed it shows `{requires mcp}` while built-in MCP is off; after built-in MCP is on it reaches the server under built-in; and after the adapter is added again it reaches the server under the adapter, with no plugin command in between

### Documentation and decisions

- [x] **MDOC-01**: `docs/mcp-compatibility.md` has a built-in column, and each built-in statement cites a scenario or the Pi 1.5.0 source
- [ ] **MDOC-02**: CHANGELOG, README, `README.es.md`, and `docs/hooks-compatibility.md` describe built-in MCP support, the three `requires` markers, and the naming divergence; the docs say to turn on built-in MCP or install pi-mcp-adapter, and list what the adapter adds
- [x] **MDEC-01**: D-MB-01 to D-MB-07 and the defaults above carry IDs in PROJECT.md Key Decisions, and the APL-D1 and Current Milestone text reflect them

## v2 Requirements

- **MCPV2-01**: Register and unregister built-in servers immediately on install, uninstall, enable, and disable, without waiting for `/reload`
- **MCPV2-02**: Map Claude permission deny rules to built-in `toolExposure: "hidden"`
- **MCPV2-03**: Re-prove background (`async: true`) agents calling plugin MCP tools under built-in once the pi-subagents fixes land (MCPBG-01)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editing `~/.pi/agent/settings.json` (removing the adapter's `-builtin:mcp`) | D-MB-01: the extension never edits Pi settings; the `{requires ...}` marker tells the user what to do |
| A command that switches implementations | The trigger is installing or uninstalling pi-mcp-adapter |
| Registering through Pi for the adapter | The adapter connects Pi registrations proxy-only and drops `directTools`, so `alwaysLoad` is lost |
| SSE, `headersHelper`, MCP prompts, elicitation, and sampling under built-in | Pi 1.5.0 has none of them; each is a blocked verdict or a recorded gap |
| Foreground agents calling plugin MCP tools | pi-subagents design, accepted as D-CF6-10 |
| A trust gate stronger than Pi's | D-LOC-01: trust comes from Pi alone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PI15-01 | Phase 1 | Complete |
| PI15-02 | Phase 1 | Complete |
| PI15-03 | Phase 1 | Complete |
| MSEL-01 | Phase 1 | Complete |
| MSEL-02 | Phase 2 | Complete |
| MSEL-03 | Phase 2 | Complete |
| MSEL-04 | Phase 2 | Complete |
| MREC-01 | Phase 1 | Complete |
| MREC-02 | Phase 2 | Complete |
| MREC-03 | Phase 3 | Pending |
| MREC-04 | Phase 3 | Pending |
| MREC-05 | Phase 3 | Pending |
| MREC-06 | Phase 3 | Pending |
| MREC-07 | Phase 3 | Pending |
| BLT-01 | Phase 2 | Complete |
| BLT-02 | Phase 2 | Complete |
| BLT-03 | Phase 2 | Complete |
| BLT-04 | Phase 2 | Complete |
| BLT-05 | Phase 2 | Complete |
| BLT-06 | Phase 2 | Complete |
| MGRT-01 | Phase 4 | Pending |
| MGRT-02 | Phase 4 | Pending |
| MHK-01 | Phase 5 | Pending |
| MHK-02 | Phase 5 | Pending |
| DUAL-01 | Phase 1 | Complete |
| DUAL-02 | Phase 1 | Complete |
| DUAL-03 | Phase 1 | Complete |
| DUAL-04 | Phase 6 | Pending |
| MDOC-01 | Phase 2 | Complete |
| MDOC-02 | Phase 6 | Pending |
| MDEC-01 | Phase 1 | Complete |

**Coverage:**

- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0
- Per phase: Phase 1: 9, Phase 2: 11, Phase 3: 5, Phase 4: 2, Phase 5: 2, Phase 6: 2

---

*Requirements defined: 2026-11-04*
*Last updated: 2026-11-04 after roadmap creation (31/31 mapped)*

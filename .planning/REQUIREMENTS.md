# Requirements: pi-claude-marketplace -- behavioral-gaps

**Defined:** 2026-11-07
**Core Value:** A Pi user can install a Claude plugin and load each supported component as a working Pi artifact.

Every requirement is met by cucumber scenarios under `features/` that fail without the behavior they name and pass `npm run test:cucumber`, which runs the `adapter` profile and then the `builtin` profile. A scenario with an MCP surface carries `@mcp` and runs under both profiles, a pair of `@adapter-only` and `@builtin-only` scenarios splits one whose expectation differs by implementation, and any other scenario runs once, under `adapter` (DUAL-02, D-BG-04). A scenario that exposes a product bug fixes it in the same phase, with Claude Code as the reference. The thin-spot requirements (BROWSE, PRUNE, BOOT, MLOCK) are first drafts that each phase's research may refine toward upstream behavior.

## Milestone Requirements

### Foundation

- [x] **FND-01**: The shared harness provides every stand-in, fixture writer, and shared step the stream phases name, each proven by a seed scenario that passes `npm run test:cucumber` (D-BG-04).
- [x] **FND-02**: Before the streams fork, the foundation files are listed as frozen in the roadmap, a child-session brief exists, and the combined tree passes `npm run check`.

### Async hooks

- [ ] **ASYNC-01**: An `asyncRewake` hook that exits 2 gets its `rewakeMessage` and output into the model's context, which the model sees on its next turn.
- [ ] **ASYNC-02**: An `asyncRewake` hook that exits with any code other than 2 adds nothing to the model's context and shows the user nothing; one that exits 2 shows the user its `rewakeSummary`, or `Stop hook feedback` when it declares none, as Claude Code does (D-BG-204).
- [ ] **ASYNC-03**: An `asyncRewake` hook never blocks or delays the event it fired on; a `PreToolUse` async hook does not block the tool.
- [ ] **ASYNC-04**: `/reload` stops the async hook processes still running, and the next load reaps the ones an earlier Pi process left behind.
- [ ] **ASYNC-05**: A hook declaring plain `async: true` behaves as Claude Code does, or the divergence is recorded with its license.

### Hook events

- [x] **STOPF-01**: `StopFailure` hooks run when a turn ends in an error, with Claude Code's payload, and matchers select them by error type.
- [ ] **TFAIL-01**: `PostToolUseFailure` hooks run on a failed tool call with Claude Code's payload, matchers select them by tool, and a `PostToolUse` hook does not run on the failure.
- [x] **PCOMP-01**: `PostCompact` hooks run after a compaction with its trigger (`manual` or `auto`), and matchers select them by trigger.
- [x] **SEND-01**: `SessionEnd` hooks run with each reason Pi can produce, matchers select them by reason, and a failing `SessionEnd` hook does not keep the session from ending.

### Upgrades

- [x] **STMIG-01**: After an upgrade from an older `state.json` schema, the first load lists every recorded plugin as installed, its components work, and the state file is rewritten in the current schema.
- [x] **STMIG-02**: A `state.json` from a newer, unsupported schema is refused as unreadable, and nothing is changed.
- [x] **CFGMIG-01**: The first load with a `state.json` and no `claude-plugins.json` writes a config declaring every recorded marketplace and plugin, carrying the enabled state and the legacy `autoupdate` field.
- [x] **CFGMIG-02**: Later loads never rewrite the config, so the user's edits survive, and an invalid existing config is never overwritten.
- [x] **AMIG-01**: On load, a plugin's entries in a legacy `mcp.json` move to `mcp-adapter.json`, and its servers still run.
- [x] **AMIG-02**: The move leaves the user's own, unmarked `mcp.json` entries untouched.

### Model-facing tools

- [x] **TOOL-01**: A model calling `pi_claude_marketplace_list` gets the configured marketplaces of both scopes, or of the scope it asks for.
- [x] **TOOL-02**: A model calling `pi_claude_marketplace_plugin_list` gets each plugin's compatibility and install status, filtered as it asks (installed, available, unavailable).
- [x] **TOOL-03**: A call naming an unknown marketplace or scope gets an error result, and neither tool changes anything on disk.

### Device Flow

- [x] **DFLOW-01**: Adding a GitHub marketplace that needs a credential the user has not stored shows a user code and a verification URL, then clones once the user authorizes.
- [x] **DFLOW-02**: An authorization that is denied or expires fails as authentication required and records nothing.
- [x] **DFLOW-03**: An install from a GitHub git source runs the same flow on a cache miss.
- [x] **DFLOW-04**: The background autoupdate pass never starts a Device Flow; it uses stored credentials only.

### Thin spots

- [x] **BROWSE-01**: In the terminal UI, `browse` and a bare `/claude:plugin` open the plugin picker, which lists the marketplaces and plugins of both scopes.
- [x] **BROWSE-02**: Choosing a plugin in the picker installs it in its marketplace's scope; cancelling installs nothing.
- [x] **PRUNE-01**: `prune` without `--scope` behaves as Claude Code does, `--scope user|project` combines with `--dry-run`, and its usage errors are covered.
- [x] **PRUNE-02**: `prune` while another process holds the state lock fails as lock held and removes nothing, and a dependency only a disabled plugin needs is handled as upstream does.
- [x] **BOOT-01**: `bootstrap` refuses `--scope` and arguments, and its json and rpc output carry the same outcome as the terminal UI.
- [x] **BOOT-02**: `bootstrap` while another process holds the user scope's state lock fails as lock held and records nothing.
- [x] **MLOCK-01**: `marketplace autoupdate` and `noautoupdate` while another process holds the state lock fail as lock held and change nothing.
- [x] **MLOCK-02**: A lock file left by a process that has died does not block the marketplace verbs, as `proper-lockfile`'s stale handling defines.
- [x] **CHILD-01**: A load in a pi-subagents background child, with `autoapply` on and a pending change, installs, uninstalls, and updates nothing.
- [x] **CHILD-02**: A load in a background child moves no legacy `mcp.json` entry and rewrites no agent grant, yet still loads the installed components.

## Future Requirements

None.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hook events Pi cannot support (`SubagentStop`, `PermissionRequest`, and the like) | Pi has no event to bridge them to; not a coverage gap |
| LSP servers, `userConfig`, channels | Unsupported plugin features; partial-install behavior is already covered |
| Product features beyond the bugs a scenario exposes | Milestone adds coverage, not features |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| ASYNC-01 | Phase 2 | Pending |
| ASYNC-02 | Phase 2 | Pending |
| ASYNC-03 | Phase 2 | Pending |
| ASYNC-04 | Phase 2 | Pending |
| ASYNC-05 | Phase 2 | Pending |
| STOPF-01 | Phase 3 | Complete |
| TFAIL-01 | Phase 4 | Pending |
| PCOMP-01 | Phase 5 | Complete |
| SEND-01 | Phase 6 | Complete |
| STMIG-01 | Phase 7 | Complete |
| STMIG-02 | Phase 7 | Complete |
| CFGMIG-01 | Phase 8 | Complete |
| CFGMIG-02 | Phase 8 | Complete |
| AMIG-01 | Phase 9 | Complete |
| AMIG-02 | Phase 9 | Complete |
| TOOL-01 | Phase 10 | Complete |
| TOOL-02 | Phase 10 | Complete |
| TOOL-03 | Phase 10 | Complete |
| DFLOW-01 | Phase 11 | Complete |
| DFLOW-02 | Phase 11 | Complete |
| DFLOW-03 | Phase 11 | Complete |
| DFLOW-04 | Phase 11 | Complete |
| BROWSE-01 | Phase 12 | Complete |
| BROWSE-02 | Phase 12 | Complete |
| PRUNE-01 | Phase 13 | Complete |
| PRUNE-02 | Phase 13 | Complete |
| BOOT-01 | Phase 14 | Complete |
| BOOT-02 | Phase 14 | Complete |
| MLOCK-01 | Phase 15 | Complete |
| MLOCK-02 | Phase 15 | Complete |
| CHILD-01 | Phase 16 | Complete |
| CHILD-02 | Phase 16 | Complete |

**Coverage:**
- Milestone requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-07*
*Last updated: 2026-11-07 in Phase 1, which corrected the profile wording of the preamble and FND-01 (D-BG-04)*

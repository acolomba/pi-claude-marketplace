# Phase 5: Automatic migration on /reload - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

On `/reload`, each installed plugin's marked MCP entries move from
`<scopeRoot>/mcp.json` into `<scopeRoot>/mcp-adapter.json` in their final
Phase 3/4 shape. The move adds before it removes, is idempotent and retries
after a partial failure, and ends with one notice that lists the renames and
what they cost the user. A marked legacy entry with no owning install record
stays where it is, with a warning.

Requirements: AMIG-01..04. Entry shape is final (Phases 3 and 4). Live status
is Phase 6, docs and the live UAT are Phase 7.

**The scenario.** Released builds (main, npm 0.19.x) wrote a plugin's servers
into `mcp.json` keyed by the declared name (`github`), expanding only
`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and project-scope
`${CLAUDE_PROJECT_DIR}`, and passing every other field through. This milestone
writes them into `mcp-adapter.json` as `plugin_<plugin>_<server>_`. Update and
reinstall now write only `mcp-adapter.json`, so nothing else moves the old
entries.

**Settled going in (not re-discussed):** settled decision #7 (one notice;
AMIG-04 unowned entries stay with a warning); COMPAT-01 (no migration flag,
the file an entry sits in tells whether it is translated); the migration is
its own reconcile step with its own per-scope state lock, run before the
reconcile plan is applied, and it must not depend on the backfill gate, which
stamps unconditionally; D-02-12 (unstage removes marked legacy entries);
D-04-10 (the migration reports both variable notices); D-02-06/D-03-04 carried
fields; D-02-21..23 and D-03-05 kept stubs and write-back.

</domain>

<decisions>
## Implementation Decisions

Decision IDs are milestone-scoped and collide with older IDs cited in source.
Source comments cite requirement IDs (AMIG-0N), never `D-05-NN`.

### Entry source (settles ROADMAP open decision #5)
- **D-05-01:** A migrated entry is re-staged from the plugin's cached source,
  offline, through the same MCP stage path install uses
  (`prepareStageMcpServers` and the closed translator). It gets the final key,
  `toolPrefix`, `directTools`, `description`, the Phase 4 escapes and deny-list,
  the D-03-10 partial handling and the D-04-10 notices. The source is the one
  reinstall reads: the warm sha-pinned plugin clone for git sources, the
  marketplace clone for path sources. No network (NFR-5). The existing
  load-time resolver (`resolveRecordedPluginOffline`, backfill) passes no
  clone-cache resolver, so git sources resolve `unavailable` there; the
  migration must add a warm-cache-only read. Hand edits outside the carried
  set are dropped, as an update drops them.
- **D-05-02:** When the source cannot be read offline (git clone cache miss,
  missing marketplace clone, unreadable manifest), that plugin's entries stay
  in `mcp.json` and keep working under their old names. A warning names the
  plugin and suggests `reinstall` (which may fetch the clone). The next
  `/reload` retries. No verbatim move, no in-place translation.
- **D-05-03:** The move is MCP-only. Skills, agents, hooks and workflows are
  untouched and no `reinstalled` row is emitted. Per plugin: stage into
  `mcp-adapter.json`, then remove the plugin's marked entries from `mcp.json`.
  (Reinstall's `replacePreparedMcp` writes only `mcp-adapter.json`, so it would
  not finish the move on its own.)

### Entries the record or the rules no longer admit
- **D-05-04:** A marked legacy entry for a plugin installed in this scope,
  whose server the re-staged source no longer declares, is deleted in the same
  `mcp.json` write and listed in the notice as removed. A kept override stub,
  if the entry holds one, is written back per D-02-21..23. Claude parity: a
  server the installed plugin does not declare does not run. (Settles the
  ROADMAP "Carried from Phase 2 review (IN-02)" note.)
- **D-05-05 (operator rule, amends D-03-10 and D-03-20):** if a server would
  not work the way it works in Claude Code, it is not installed; if it works
  and only a Claude-side restriction is lost, it is installed with a warning.
  Classification:
  - Not installed (`{unsupported mcp}`, unchanged): `ws`, `sse-ide`, `ws-ide`,
    `sdk`, `claudeai-proxy` (no adapter transport); `headersHelper`,
    `oauth.xaa` (missing auth, the server mostly fails);
    `bareElicitationCapability: true` (the adapter always advertises
    `elicitation: { form: {}, url? }` with no per-server switch, so a server
    flagged for the bare shape may not work); a leading `~` in `command` or
    `args` (D-04-06, confirmed below).
  - Installed with a warning (NEW): `tools[].permission_policy` and a
    non-empty `toolPermissions`. The server works, but the plugin's per-tool
    restrictions are not enforced. This applies to install, update, reinstall,
    enable, import, reconcile and the migration alike, so a fresh install and
    a migrated one match. The warning names the server and the field, as a
    closed-catalog amendment.
  — **Reversibility:** costly — it changes the closed `{unsupported mcp}`
  feature set and its catalog pins, and which plugins install without
  `--partial`.
- **D-05-06:** An unsupported server (D-05-05 "not installed") in an installed
  plugin: its legacy entry is deleted and not written; the plugin's other
  servers move; the record becomes `partially-installed`, the same result as
  `install --partial`; the notice names the server and the blocking feature,
  and `info` shows the `{unsupported mcp}` breakdown.
- **D-05-07 (revised 2026-10-08 after research):** A plugin with a server
  that is malformed under Claude's schema (D-03-18) follows the fresh-install
  rule: its MCP component is unavailable, so the migration deletes all of the
  plugin's marked legacy entries and writes none, and the record's MCP
  inventory is emptied. The notice names the malformed server with the
  `{malformed mcp}` detail. No new "partially-installed from malformed" record
  state exists, so `info`, `list`, `reinstall` and `update` need no special
  case. (Supersedes the earlier "drop only the bad server" answer.)
- **D-05-08 (extended 2026-10-08):** Every path that writes a plugin's servers
  into a scope's `mcp-adapter.json` (install, enable, reconcile install,
  import, reinstall, update) then removes that plugin's marked legacy entries
  from the same scope's `mcp.json`, plus the D-05-10 old-name leftovers (add
  before remove; reinstall and update keep their byte rollback). This closes
  the duplicate after the D-05-02 "run reinstall" remedy and after an AMIG-04
  unowned entry's plugin is installed by reconcile; the AMIG-04 warning then
  fires only for plugins that really are not installed in that scope.
  Extends D-02-12.

### Old entries are cleanup, not input (operator, 2026-10-08)
- **D-05-09 (revised):** Nothing is carried over from a legacy entry. The
  migration deletes our old marked entries as cleanup of the old
  implementation and installs the plugin's servers as a fresh install would,
  as if the old entries never existed. The only thing read from a legacy entry
  is its marker (which plugin and marketplace own it). Research showed the
  adapter reads `mcp.json` in Pi's format under Pi 1.0, so adapter-native
  fields in a legacy entry are inert today; carrying them would have switched
  on plugin-declared fields such as `approveTools`. A user's Pi-format disable
  (`enabled: false`) is not carried either. (Supersedes the D-02-06 carry.)
- **D-05-10 (revised):** Adapter-written leftovers under an OLD name are
  deleted as cleanup and listed in the notice: the `/mcp-adapter disable` stub
  (`github: { "disabled": true }`, written to the project `mcp-adapter.json`
  even for a user-scope plugin) and the panel's direct-tools full copy (the
  whole server definition plus `directTools`, written under the old name into
  the same scope's `mcp-adapter.json`, adapter 5.1.0 `config.ts:1972-2011`,
  which would otherwise keep running beside the new key). A leftover is
  removed only when all of these hold: it has no marker; it sits under an old
  name one of the moved legacy entries used; it is an override stub, or a full
  definition carrying `directTools` (the panel copy); and it is in a file the
  adapter writes for that server (the same scope's `mcp-adapter.json`; for
  disable stubs also the project file). A marker-less full definition without
  `directTools` is the user's own server and is never removed. No kept-stub
  absorption, no write-back on uninstall.
  — **Reversibility:** costly — it deletes marker-less content the user's
  adapter wrote; the matching rule is the only guard.
- **D-05-11:** A full server already defined at the new key in any of the
  adapter's nine sources is a collision, as at install (D-02-03): that plugin
  moves nothing, its legacy entries stay running under their old names, and a
  warning names the colliding key and its source. Next `/reload` retries. The
  move is all-or-nothing per plugin, so a plugin's servers never end up split
  across the two files (except the D-05-06 drops and D-05-07 removals, which
  are deletions).

### Post-research decisions (2026-10-08)
- **D-05-16:** Write order per scope is `mcp-adapter.json`, then `state.json`,
  then `mcp.json`. The marked legacy entries are the only trigger (COMPAT-01),
  so they are removed last: every crash point re-triggers on the next
  `/reload` and converges to identical bytes. With no legacy entries left the
  step returns before taking a lock or writing (a second `/reload` changes no
  bytes); an `mcp-adapter.json` rewrite that would produce identical bytes is
  skipped.
- **D-05-17:** The step runs inside `applyReconcileWithReader`'s per-scope
  loop, after `readPassForScope` and before `applyPlan`, under its own
  `withLockedStateTransaction`. With the plan in hand it skips the AMIG-04
  warning for a plugin reconcile installs in the same reload (D-05-08 sweeps
  those entries). A migration failure becomes its own warning row, never an
  `invalid-block` reconcile row or an exception out of `applyReconcile`
  (NFR-2). The notice is emitted even when reconcile has no outcomes.
- **D-05-18:** The offline source read for git sources is an fs-only presence
  probe keyed on the record's `resolvedSha` (not the manifest `source.sha`);
  `probeReinstallClone` and `materializePluginClone` clone on a miss and are
  never called (NFR-5).
- **D-05-19:** An unparseable `mcp.json` or `mcp-adapter.json` in a scope: no
  write in that scope, one left-in-place row naming the scope and file
  (D-02-14 precedent).

### Notice
- **D-05-12:** One migration notice per `/reload`, covering both scopes, rows
  ordered project before user (MSG-GR-3), emitted separately from and before
  the reconcile cascade notice. Silent when nothing moved, was removed or was
  left behind.
- **D-05-13:** Renames show the adapter key: `github -> plugin_acme_github_`
  with the plugin and scope (for example
  `github -> plugin_acme_github_ (acme) [user]`). It is the name the
  `/mcp-adapter` panel, sign-in prompts and project approvals show.
- **D-05-14:** Severity follows the house tri-state: `info` when every owned
  entry moved; `warning` when anything was left in place (D-05-02, D-05-11,
  AMIG-04 unowned) or dropped (D-05-06, D-05-07), or when a D-05-10 leftover
  was removed. D-05-04 removals of
  undeclared servers do not by themselves make it a warning.
- **D-05-15:** One body in a fixed order: moved rows; removed or dropped rows
  with their reason (not declared, `{unsupported mcp}` + feature,
  `{malformed mcp}`); left-in-place rows with their remedy (reinstall, resolve
  the collision, AMIG-04 unowned); one cost line (sign in again, re-approve
  project servers); the D-04-10 variable and credential notices and the
  D-05-05 permission-policy warnings for the moved servers; the D-05-10
  leftovers removed; the reload hint once at the end. Research: Pi emits
  `session_start` (where the adapter reads its config) before
  `resources_discover`, and in the common lazy path the adapter re-reads at
  the first MCP operation, so in the migration session old-name tools may be
  listed while their server is gone; the hint says to `/reload` now.
  Wording is drafted as closed-catalog amendments in `docs/output-catalog.md`
  for operator review in the plans.

### Claude's Discretion
- Where the step sits in `resources_discover` and how it shares or takes the
  per-scope lock; batching writes per scope file versus per plugin, provided
  every `mcp-adapter.json` write precedes the matching `mcp.json` removal and
  a failure in one plugin does not block the others.
- How a re-run detects the half-done state (entry present in both files) and
  finishes it without a duplicate or a second notice row beyond what the
  user needs (AMIG-02).
- Legacy entries owned by a disabled record (none should exist, since disable
  unstages): planner's choice, defaulting to removal with no re-stage
  (ENBL-08: a disabled plugin's MCP servers are never restored at load).
- Legacy entries of a plugin installed only in the other scope: AMIG-04
  unowned in this scope (leave + warn); confirm with the D-02-13/D-02-17
  same-plugin reasoning.
- The fault-injection test design (assert the write order, not only the end
  state) and how the `partially-installed` record write is ordered relative to
  the two file writes.
- Whether repeated left-in-place warnings every `/reload` need damping
  (COMPAT-01 forbids persisted state, so damping must be derivable).

</decisions>

<compat_evidence>
## Claude Code evidence records

- **Plugin MCP servers are never persisted in a config file.** Claude Code
  loads `.mcp.json` at the plugin root, then each `mcpServers` shape in
  `plugin.json`, on every load; a later name replaces an earlier one. Evidence:
  https://code.claude.com/docs/en/plugins-reference (fetched 2026-10-08).
  Confidence high. Consequence: the migration itself has no upstream analogue
  and is decided from Pi and project constraints; a server the installed
  plugin no longer declares does not run (basis for D-05-04).
- **A user's per-server disable survives plugin updates.** From
  `02-CONTEXT.md` (2.1.287 binary, high). Not applied to the migration:
  the operator ruled the old entries cleanup, not input (D-05-09/D-05-10);
  the release that ships phases 2-5 already costs sign-ins and approvals.
- **Claude skips only an invalid server and loads the plugin's others**
  (03-RESEARCH E2, 2.1.291, medium-high). Not followed: D-05-07 applies the
  fresh-install rule (D-03-18), the project's existing, stricter divergence.
- **Leading `~` is never expanded by Claude Code** (researched 2026-10-08,
  Claude Code 2.1.294 at
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.294/claude`).
  The plugin MCP config pass substitutes only `${CLAUDE_PLUGIN_ROOT}`,
  `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_DATA}`, `${user_config.*}`, then
  `${VAR}` / `${VAR:-default}`; the stdio transport spawns through
  `cross-spawn` with `shell:false` and `cwd` = project dir; the optional cgroup
  wrap uses a quoted `"$@"`. A sandboxed probe (`env -i`, temp `HOME`,
  `CLAUDE_CONFIG_DIR` in the tree, user-scope and `--plugin-dir` servers) ran
  `<projectDir>/~/bin/mcp.sh`, not the home copy, and passed `args`
  `~/argval ~ ~\x ~root/x` and an `env` value `~/envval` literally; without the
  `./~` copy the spawn failed `ENOENT`. Confidence high on POSIX, medium on
  Windows (not probed; same code path). Adapter 5.1.0 (`dist/utils.js:223-240`,
  `dist/server-manager.js:886-914`): `expandHomePath` turns `~` and `~/x` into
  the home directory for `command` (via `resolveConfigPath`) and `args`;
  `~\x` only on win32; `~user` untouched; `env` is not home-expanded. So
  writing `~` unchanged would run a different file or pass a different path
  than Claude for `command` and `args`; D-04-06 stands. Unresolved: Claude's
  opt-in `CLAUDE_CODE_SHELL_PREFIX` routes commands through a shell; whether it
  exposes `~` was not checked.
- **`bareElicitationCapability`.** `true` makes Claude advertise the bare
  `elicitation` capability to that server (2.1.291,
  `...bareElicitationCapability===!0)?Ufn():WFt()`, 03-RESEARCH E6, high for
  the code, medium for the effect); pi-mcp-adapter always advertises
  `{ form: {}, url? }` (`server-manager.ts:1409-1426`).
- **Permission policies.** Claude's schema carries `tools[].permission_policy`
  and `toolPermissions` for remote servers; whether Claude enforces them for
  plugin `.mcp.json` servers is unresolved (03-RESEARCH E1). The adapter has no
  per-tool policy field. D-05-05 installs with a warning on the operator's
  "works, restriction lost" rule.

</compat_evidence>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — AMIG-01..04
- `.planning/ROADMAP.md` §Phase 5 (criteria, notes, IN-02 carry), "Release rule", "Settled going in" #7, "Open decisions" #5

### Prior decisions
- `.planning/phases/02-adapter-file-delivery/02-CONTEXT.md` — D-02-03 collisions, D-02-06 carried set, D-02-07 stubs, D-02-09 notice route, D-02-12 legacy sweep, D-02-13/17 same-plugin exemptions, D-02-21..23 kept stubs and write-back
- `.planning/phases/03-claude-code-tool-names-and-tool-search/03-CONTEXT.md` — D-03-01 key, D-03-04/05 carried-field ownership, D-03-07 closed translator, D-03-10/D-03-20 unsupported set (amended by D-05-05), D-03-16 shown name, D-03-18 malformed
- `.planning/phases/03-claude-code-tool-names-and-tool-search/03-RESEARCH.md` — E1, E2, E6 and the unsupported-feature table
- `.planning/phases/04-variable-expansion-at-claude-code-parity/04-CONTEXT.md` — D-04-03 `!!`, D-04-06 `~`, D-04-10 notices on every staging path

### Milestone research
- `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md` — migration, one-reload lag, adapter panel copies of our entries

### Upstream and companions
- `skills/claude-code-compat-research/SKILL.md` — evidence method
- https://code.claude.com/docs/en/plugins-reference, https://code.claude.com/docs/en/mcp
- pi-mcp-adapter 5.1.0 scratch install at `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter` (`dist/utils.js`, `dist/server-manager.js`, `dist/elicitation-handler.js`)

### Output vocabulary
- `docs/output-catalog.md` — `{unsupported mcp}` breakdown, the new permission-policy warning, the migration notice rows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bridges/mcp/stage.ts` `prepareStageMcpServers` / `commitPreparedMcp`: the install stage path the migration re-uses (D-05-01, D-05-03).
- `bridges/mcp/unstage.ts` `unstageMcpServers` / `readUnstageTarget`: already reads the legacy `mcp.json` through `PI_MCP_SERVER_KEYS` and partitions by marker; the model for the removal half.
- `bridges/mcp/adapter-doc.ts` (`readMcpConfigDoc`, `partitionServers`, `withPluginServers`, `restoredOverrideNames`), `bridges/mcp/marker.ts` (`_piClaudeMarketplace`, kept stub), `bridges/mcp/adapter-entry.ts` (`stampServers`, carried fields), `bridges/mcp/collision-slots.ts` (nine-source walk).
- `domain/mcp-server-features.ts` `McpUnsupportedFeature` / `classifyMcpServer`: D-05-05 moves `tools[].permission_policy` and `toolPermissions` out of the blocking set into a warning.
- `orchestrators/reconcile/backfill.ts` `resolveRecordedPluginOffline`: precedent for offline re-resolution at load; git sources need the warm clone read (`orchestrators/plugin/clone-cache.ts` `pluginCloneKey`, warm-cache check without network).
- `orchestrators/reconcile/apply.ts` `applyReconcileWithReader`, `readPassForScope`, `runScopeIsolated`: per-scope isolation and the single-notify pattern.
- `shared/notification-dispatch.ts` `notifyMcpConfigNotices` and the `McpConfigNotice` family: route for the D-04-10 notices.

### Established Patterns
- Partial install: resolver `partially-available`, aggregate reason, `--partial`, `info` breakdown.
- Add-before-remove with byte restore (D-02-11, D-02-19/20) and `written` bytes in `UnstageMcpResult` (NFR-3).
- Closed-catalog amendments pinned by `tests/architecture/compat-01-no-expansion.test.ts` and `notify-closed-set-locks.test.ts`.

### Integration Points
- `index.ts` `resources_discover` handler (before `applyReconcile`); never throws past the lifecycle event (NFR-2).
- Install, enable, import, reconcile, reinstall and update staging paths gain the D-05-08 legacy sweep.
- Every staging path gains the D-05-05 permission-policy warning.

</code_context>

<specifics>
## Specific Ideas

- Fixtures: a legacy `mcp.json` as main writes it (declared-name keys, three
  path variables expanded, pass-through fields, `_piClaudeMarketplace` marker),
  plus a `github: { "disabled": true }` stub in `mcp-adapter.json`.
- Cases: one plugin with a still-declared, a dropped, an unsupported (`ws`)
  and a malformed server; a git-source plugin with a warm clone and one with a
  cache miss; an unowned entry whose plugin `claude-plugins.json` declares; a
  full user server at `plugin_acme_github_`.
- Fault injection: kill between the `mcp-adapter.json` write and the
  `mcp.json` removal; the next run finishes with no duplicate, and the test
  asserts the order of writes.

</specifics>

<deferred>
## Deferred Ideas

- `CLAUDE_CODE_SHELL_PREFIX`: check whether Claude's opt-in shell prefix
  exposes a leading `~` to expansion (D-04-06 assumes it does not).
- pi-subagents `mcp:<old-name>` overrides and agent files that name old server
  or tool names are not rewritten by the migration; consider a note in the
  Phase 7 docs.

</deferred>

---

*Phase: 05-automatic-migration-on-reload*
*Context gathered: 2026-10-08*

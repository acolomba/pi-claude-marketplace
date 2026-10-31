# Phase 6: Live MCP status in info - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

`/claude:plugin info` shows, for each MCP server an installed plugin wrote,
the state pi-mcp-adapter reports for it on its `pi-mcp-adapter/status/v1`
event channel. The extension never imports the adapter and never connects a
server. When info cannot know the state, it says so with an explicit token
instead of a guess. Every new token is a closed-catalog amendment in
`docs/output-catalog.md`.

Requirements: ASTAT-01, ASTAT-02. Server names are final (Phase 3,
`plugin:<plugin>:<server>` shown, `plugin_<plugin>_<server>_` adapter key).
Docs and the live UAT are Phase 7.

**Settled going in (not re-discussed):** the tracker is created in the
extension factory and injected through `EdgeDeps`, the way `completionCache`
is, never held as a module global (ROADMAP note); the adapter is a soft
dependency and is never imported (STACK, RH-4); the status channel is
push-only, so info reads the last cached snapshot; ADET-01's
`requires: pi-mcp-adapter (missing)` tag stays as it is; ANAME-01 server
names; the AVAR-04/05 `unset` / `withheld` lists stay in the per-server
parentheses.

</domain>

<decisions>
## Implementation Decisions

### Status wording (Claude Code parity, see evidence record E1)
- **D-06-01:** Each adapter status renders in Claude Code's words, with one
  addition. Adapter `connected` -> `connected`; `cached` ->
  `cached, connects on first use`; `needs-auth` -> `needs authentication`;
  `blocked` -> `pending approval`; `disabled` -> `disabled`;
  `not-connected` -> `not connected`; `failed` -> `failed`. Claude's text map
  says `not connected` for a failed server; the adapter has a separate
  `failed` (failure backoff) and `not-connected` (never discovered, no cached
  tools), so `failed` takes Claude's `/mcp` panel word to keep a failure
  visible. — **Reversibility:** costly — closed-catalog tokens with byte
  locks; renaming them later changes pinned output.
- **D-06-02:** Claude's `cached (connects on first use)` renders with a comma,
  `cached, connects on first use`, because the status sits inside info's
  per-server parentheses and nested parentheses would read badly.

### Placement on the row
- **D-06-03:** The status is the first item inside the server's existing
  parentheses on the `mcp:` line; the AVAR-04/05 lists follow after `;`.
  Example: `mcp: plugin:analytics:api (needs authentication; unset
  ANALYTICS_TOKEN), plugin:analytics:db (connected)`. A server with no other
  detail gets parentheses holding the status alone.
- **D-06-04:** No extra adapter details: no tool count, no failure age, no
  block reason. The adapter's own panel carries them.
- **D-06-05:** No remedy hint. Claude's status text gives none either.

### Unknown states
- **D-06-06:** Two unknown tokens. `status unknown` when there is no usable
  snapshot: the adapter is absent, it has not published yet, or its last
  snapshot is the empty shutdown snapshot. `not loaded` when a usable
  snapshot exists but does not list the server's adapter key (for example
  the plugin was installed this session and the adapter has not read its
  config yet).
- **D-06-06a (operator, 2026-10-09, after research):** adapter 5.1.0 sends an
  empty snapshot at every `session_start` and, in a deferred session (every
  server lazy, none from a project file, every tool list cached), nothing
  more until the first MCP use. So `status unknown` is the normal view in
  such a session. Keep the token; the catalog prose says the adapter reports
  status only after its first MCP activity in a session. Phase 7 UAT checks
  it live.
- **D-06-07:** When the adapter is not loaded, each server still shows
  `status unknown`, alongside the existing `requires: pi-mcp-adapter
  (missing)` line. One rule for every installed server (ASTAT-02 as written).

### Rows, scopes, severity
- **D-06-08:** Only `(installed)` and `(partially-installed)` rows carry a
  status, and only on servers the record says were written. A `(disabled)`
  row shows none (its servers are out of the adapter config by design,
  ENBL-08); not-installed rows show none; a left-out server keeps its
  `(unsupported <feature>)` detail and gets no status.
- **D-06-09:** When the same plugin is installed in both scopes, both scopes'
  `mcp-adapter.json` hold the same key and the snapshot has one entry. Only
  the scope row whose entry the adapter actually loads shows the snapshot's
  status; the other row's server shows a closed token that says it is
  shadowed by the other scope (wording drafted as a catalog amendment).
  **Settled 2026-10-09 after research:** the case occurs (the collision check
  skips entries marked for the same plugin and marketplace), and the
  adapter reads `<cwd>/.pi/mcp-adapter.json` last, so the project row owns
  the snapshot entry. The user row's server shows `overridden by project
  scope` (Claude Code 2.1.294 "overridden by" wording). It appears only when
  a usable snapshot exists; with none, both rows show `status unknown`
  (D-06-07). A failed read of the project state counts as not overridden. — **Reversibility:** costly — adds a closed-catalog token.
- **D-06-10:** Status never changes info's severity; info stays `info`, as
  the `(missing)` companion tag does.

### Claude's Discretion
- Snapshot validation shape (typebox schema of only the fields read), how a
  malformed or newer-version snapshot is treated (as no usable snapshot ->
  `status unknown` is the expected reading), tracker module name and
  location, and the subscription lifecycle across `/reload` and
  `session_shutdown`.
- Installed rows with unresolved components (cold git clone) have no `mcp:`
  line today and get no status.

</decisions>

<compat_evidence>
## Claude Code evidence records

### E1: How Claude Code names MCP server states
- **Behavior:** Claude Code 2.1.294 carries a status text map
  `{connected:"connected", cached:"cached (connects on first use)",
  pending:"connecting", disabled:"disabled", failed:"not connected",
  "needs-auth":"needs authentication", "needs-approval":"pending approval"}`.
  Its `/mcp` panel labels are `connected`, `connecting…`, `needs sign-in`,
  `failed`, `disabled`, `not configured`. `claude mcp list` (which connects)
  prints `✓ Connected`, `! Needs authentication`, `✗ Failed to connect`.
- **Evidence:** `grep -oa` over
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.294/claude`,
  2026-10-09.
- **Confidence:** high for the strings; medium for which surface uses the text
  map (it sits near `/mcp` subcommand handling and host/server listings).
- **Unresolved:** Claude Code has no `info`-style plugin surface showing
  status, so placement (D-06-03..05) has no upstream position.
- **Pi constraints:** pi-mcp-adapter 5.1.0 reports `connected`, `cached`,
  `failed`, `needs-auth`, `not-connected`, `blocked`, `disabled`
  (`mcp-status.ts`), push-only, with an empty snapshot at shutdown; its own
  panel says `needs auth`, `blocked by project trust`, `failed`, `idle`.
- **Divergence:** `failed` kept distinct from `not connected` (D-06-01). Not
  covered by either license; the operator chose it on 2026-10-09 because the
  adapter distinguishes the two states and Claude's own panel says `failed`.

</compat_evidence>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — ASTAT-01, ASTAT-02
- `.planning/ROADMAP.md` — Phase 6 success criteria and the `EdgeDeps` note

### Milestone research
- `.planning/research/ARCHITECTURE.md` — status tracker shape
  (`platform/mcp-status.ts`, `createMcpStatusTracker`), event channel row
- `.planning/research/FEATURES.md` — A9 snapshot payload
- `.planning/research/PITFALLS.md` — push-only channel, lazy servers rest in
  `cached` / `not-connected`, empty shutdown snapshot
- `.planning/research/STACK.md` — never import the adapter; string channel and
  locally typed, typebox-validated snapshot

### Adapter (pi-mcp-adapter 5.1.0, scratch install)
- `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter/mcp-status.ts` —
  snapshot construction, status precedence, shutdown snapshot
- `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter/types.ts` —
  `MCP_STATUS_EVENT`, `McpStatusSnapshot`, `McpServerStatusSnapshot`
- `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter/project-server-trust.ts`
  — `blocked` reasons
- `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter/config.ts` — source
  merge order (needed for D-06-09)

### Prior decisions
- `.planning/phases/03-claude-code-tool-names-and-tool-search/03-CONTEXT.md` —
  names and key (D-03-01, D-03-16)
- `.planning/phases/04-variable-expansion-at-claude-code-parity/04-CONTEXT.md`
  — info `unset` / `withheld` lists (D-04-10)
- `.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/` — ADET-01
  companion probe and `(missing)` tag

### Output vocabulary
- `docs/output-catalog.md` — info surface (`### Installed -- an MCP server's
  variables`, `### Not installed -- an MCP server is left out`, the
  `requires:` line rules)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extensions/pi-claude-marketplace/index.ts` — factory creates
  `completionCache` and threads it into `EdgeDeps`; the tracker follows the
  same route.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — builds the
  per-server `unset` / `withheld` details; the status joins the same
  per-server detail.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` /
  `notification-types.ts` — closed vocabulary and `mcp:` line rendering.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` — sole Pi peer import
  (NFR-11 chokepoint); `pi.events` access belongs there.

### Established Patterns
- Commands determine state and stamp it; the renderer only formats
  (notify-is-a-dumb-renderer).
- Process-lifetime state lives in an explicitly owned object passed as a
  dependency (`bridges/hooks/routing-state.ts`, `completionCache`).
- Closed-catalog amendments carry byte locks in `tests/architecture/`.

### Integration Points
- Factory (`index.ts`) subscribes at load; `session_shutdown` drops the
  subscription.
- `info` reads the tracker through `EdgeDeps`.

</code_context>

<specifics>
## Specific Ideas

- Target row shape: `mcp: plugin:analytics:api (needs authentication; unset
  ANALYTICS_TOKEN), plugin:analytics:db (cached, connects on first use)`.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

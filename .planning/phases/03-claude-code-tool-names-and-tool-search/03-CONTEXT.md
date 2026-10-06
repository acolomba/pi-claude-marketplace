# Phase 3: Claude Code tool names and tool search - Context

**Gathered:** 2026-10-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Each plugin MCP server is written to `<scopeRoot>/mcp-adapter.json` under the
name Claude Code gives it (key `plugin_<plugin>_<server>_`, `toolPrefix: "mcp"`,
so the model sees `mcp__plugin_<plugin>_<server>__<tool>`). Its tools load on
demand through Pi's tool search. A closed translator turns the Claude server
config into adapter fields (transport, timeout, OAuth, `description`). Plugin
hook matchers, `if:` predicates and agent `tools:` entries that name the
plugin's own MCP tools in Claude form reach the delivered tools. A Claude MCP
feature the adapter cannot honor makes the plugin partially available.

Requirements: ANAME-01..07. Variable expansion is Phase 4; moving existing
`mcp.json` entries is Phase 5; live status is Phase 6. The entry shape fixed
here is final before Phase 5 (a second rename costs users a second round of
sign-ins and approvals).

</domain>

<decisions>
## Implementation Decisions

Decision IDs are milestone-scoped and collide with older IDs already cited in
source; source comments cite requirement IDs (ANAME-0N), never `D-03-NN`.

### Locked by requirements (recorded, not re-discussed)
- **D-03-01:** Server key `plugin_<plugin>_<server>_`, built by Claude's
  normalization (every character outside `[A-Za-z0-9_-]` becomes `_`) from
  `plugin:<plugin>:<server>`, with `toolPrefix: "mcp"` pinned on the entry.
  One name builder in `domain/` produces every generated server name (ANAME-01).
- **D-03-02:** `directTools: "search"` on every entry; a server with
  `alwaysLoad: true` gets `directTools: true` (ANAME-04). `lifecycle` is never
  written; the divergence from Claude's session-long connection is documented
  in this phase (ANAME-05). `directTools` and `toolPrefix` stay owned by this
  extension and are always rewritten (D-02-06).
- **D-03-03:** The tool-name length Pi 1.0 accepts is measured with a long
  fixture in a sandboxed real Pi 1.0 run during research, before planning
  (ANAME-03). If the measurement shows no effective limit, the length check is
  dropped and the measurement is recorded.

### Plugin values vs user overrides (resolves the D-02-06 / D-02-22 hand-off)
- **D-03-04:** A carried field (D-02-06 set) that the plugin's translated entry
  sets belongs to the plugin: on update and reinstall the new manifest value is
  written and carry-forward skips that field. A user override survives only for
  carried fields the plugin leaves unset (as `disabled` does). Under D-03-07 the
  only such field today is `requestTimeoutMs`. Matches Claude Code, where a user
  cannot override a plugin server's timeout at all. Amends D-02-06.
  — **Reversibility:** costly — changes which user choices survive updates.
- **D-03-05:** Write-back (uninstall, disable, prune, every unstage) restores,
  for a carried field the plugin set, the kept stub's own value, not the live
  value. The marker records only the names of the carried fields the plugin set
  (no values), because uninstall can run after the plugin source is gone. Other
  carried fields keep the D-02-22/D-02-23 live-value rule. Amends D-02-23.
- **D-03-06:** At install, a kept stub's value for a plugin-set carried field
  stops applying, so it joins the D-02-21 "fields that stop applying" warning.

### Closed translation (ANAME-06, ANAME-07)
- **D-03-07:** The translator is closed. A written entry holds only adapter
  fields mapped from Claude's server schema (2.1.291: stdio `command`, `args`,
  `env`, `timeout`, `alwaysLoad`; remote `url`, `headers`, `oauth{clientId,
  callbackPort, authServerMetadataUrl, scopes}`, `timeout`,
  `request_timeout_ms` folded into `timeout` as Claude does, `type` incl.
  `sse` -> `httpTransport: "sse"`), plus the fields this extension owns
  (`directTools`, `toolPrefix`, `description`), carried user fields and the
  marker. Every other key the plugin declares is dropped. This replaces today's
  whole-entry pass-through, which let a plugin set adapter-only powers Claude
  never grants (`approveTools`, `requestHeadersCommand`, `inheritEnv`, `auth`,
  `cwd`, `lifecycle`). — **Reversibility:** costly — it is the entry shape
  Phase 5 migrates into; changing it again re-keys approvals.
- **D-03-08:** Keys Claude itself ignores (`cwd`, adapter-only fields, any
  unknown key) are dropped silently, as Claude drops them.
- **D-03-09:** `description` is the plugin's `plugin.json` description,
  falling back to the marketplace entry's description, omitted when neither
  exists. (Claude's server schema has no `description`.)

### Unsupported MCP features -> partial install (amends ANAME-03, ANAME-07)
- **D-03-10:** A Claude MCP feature the adapter cannot honor follows the house
  partial-install pattern, never "install and warn". Features: a `ws`
  transport, `headersHelper`, `oauth.xaa`, per-tool permission policies
  (`tools[].permission_policy`, `toolPermissions`), and any other field Claude
  honors with no adapter equivalent found by research; plus a server whose
  prefix `mcp__plugin_<p>_<s>__` alone reaches the measured length limit (no
  tool name can fit). The resolver marks the plugin `partially-available` with
  one aggregate reason `{unsupported mcp}` (closed-catalog amendment, parallel
  to `{unsupported hooks}`). A normal install refuses with the `--partial`
  hint. `--partial` installs everything except the affected servers (the whole
  server is left out, like unsupportable hook handlers); the record derives
  `partially-installed`. `info` names each affected server and the feature
  that blocks it. REQUIREMENTS.md ANAME-03/ANAME-07 and ROADMAP Phase 3
  criteria 3 and 5 are amended with this context.
  — **Reversibility:** costly — new catalog token and states pinned by gates.
- **D-03-11:** No "little room left" length warning: a prefix that leaves any
  room installs normally.

### Name clashes (ANAME-03)
- **D-03-12:** Two servers of one plugin that normalize to the same key refuse
  the install before any write, with a typed error naming both servers and the
  key (same handling as a cross-plugin collision, D-02-03).
- **D-03-13:** Keys that differ only by `-` versus `_` share one Pi
  deferred-tool namespace (`mcp__` + key with `-` folded). The collision walk
  compares keys with `-` folded to `_` and refuses exactly as for an equal key,
  within a plugin, across plugins and against user servers. Claude keeps `-`,
  so this is a Pi-only refusal (license: Pi capability gap).

### Hooks and agent tools (ANAME-02)
- **D-03-14:** Hook matchers accept exactly the form `mcp__<segment>__.*` as a
  server-prefix match on `mcp__<segment>__`, implemented as a string prefix
  test with no regex engine; every other regex matcher stays dropped
  (MATCH-02). Literal `mcp__<server>__<tool>` matchers and the `if:` forms
  already pass through and need proof against delivered names, not new code.
- **D-03-15:** Agent `tools:` (and `disallowedTools:` where pi-subagents
  supports it) map only names whose server is one this plugin actually writes:
  `mcp__plugin_<p>_<s>__<tool>` -> `mcp:plugin_<p>_<s>_/<tool>`, and
  `mcp__plugin_<p>_<s>` or `mcp__plugin_<p>_<s>__*` -> `mcp:plugin_<p>_<s>_`.
  Every other `mcp__` name keeps today's drop warning. Servers left out by
  D-03-10 are not mapped.

### Shown name
- **D-03-16:** `info` and the plugin rows show a plugin MCP server as Claude
  names it, `plugin:<plugin>:<server>`. Consistency with servers installed in
  Pi directly is not a goal. The adapter key stays internal and is derived by
  the name builder wherever needed (entry write, Phase 6 status join); the
  record may keep declared names (planner's choice, weigh the Phase 5 rename
  map). Skills need no rewrite: they name tools, which ANAME-01 delivers
  exactly.

### Claude's Discretion
- Module layout of the translator (extend `bridges/mcp/adapter-entry.ts` or
  split a pure translation module), staying under fallow and sonarjs ceilings.
- Exact `info` breakdown wording for `{unsupported mcp}` and the marker field
  name for D-03-05, as closed-catalog amendments in `docs/output-catalog.md`.
- Where the lifecycle divergence (ANAME-05) is documented in this phase.

</decisions>

<compat_evidence>
## Claude Code Evidence Records

All grepped from the Claude Code 2.1.291 binary
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.291/claude`,
2026-10-06).

- **Tool name form.** `Ni(server, tool) = "mcp__" + Cn(server) + "__" + Cn(tool)`,
  `Cn = s.replace(/[^a-zA-Z0-9_-]/g, "_")`; plugin servers are named
  `plugin:<plugin>:<server>`. High confidence. Matches ANAME-01.
- **Length.** The builder does not truncate or hash; a schema description says
  "the 64-character limit applies to the name as sent". No install-time check
  upstream. Medium confidence. Divergence D-03-10 (length arm) licensed by the
  Pi/adapter gap: the adapter controls final names and cannot shorten them.
- **Server schema.** stdio `{type?, command, args, env, timeout, alwaysLoad,
  bareElicitationCapability, role}`; sse/http `{url, headers, headersHelper,
  oauth{clientId, callbackPort, authServerMetadataUrl, scopes, xaa}, timeout,
  request_timeout_ms, tools[{name, permission_policy}], alwaysLoad, ...}`.
  `request_timeout_ms` is "@internal ... folded into timeout at parse"
  (`timeout ??= min(request_timeout_ms, cap)`). No `description`, no `cwd`.
  Configs pass through zod objects, so unknown keys are very likely stripped.
  Medium-high confidence. Basis for D-03-07/D-03-08.
- **Whole-server tool names.** Permission rules accept `mcp__<server>` and
  `mcp__<server>__*`; hook matchers are regexes and Claude documents
  `mcp__<server>__.*`. High confidence. Basis for D-03-14/D-03-15.
- **Collisions.** No upstream detection of normalized-name collisions known;
  `-`/`_` folding does not collide upstream. D-03-12/D-03-13 are licensed by
  the adapter keying servers by one key and Pi's folded deferred namespace.
- **Timeout override.** Users cannot override a plugin server's timeout in
  Claude Code; the plugin's value applies (D-03-04).

</compat_evidence>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — ANAME-01..07 (ANAME-03, ANAME-07 amended by D-03-10)
- `.planning/ROADMAP.md` §Phase 3 — success criteria and notes (criteria 3, 5 amended)

### Prior decisions
- `.planning/phases/02-adapter-file-delivery/02-CONTEXT.md` — D-02-06 carried set,
  D-02-21..23 kept stub and write-back (amended by D-03-04/D-03-05)
- `.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-CONTEXT.md` — marker and detection decisions

### Milestone research
- `.planning/research/FEATURES.md` — U3/U4/U7/U10 (Claude), A5/A7/A8 (adapter `ServerEntry`, `formatToolName`, deferred namespace), G-1, G-6..G-11, D-2..D-4
- `.planning/research/PITFALLS.md` — naming collisions, `-`/`_` folding, 59-char namespace hashing, `scripts/pi.sh --no-extensions` vs `builtin:tool-search`
- `.planning/research/ARCHITECTURE.md` — `adapter-entry.ts`, `generatedMcpServerName`
- `.planning/research/STACK.md` — pi-mcp-adapter 5.0.0 facts

### Upstream and companions
- `skills/claude-code-compat-research/SKILL.md` — evidence method
- https://code.claude.com/docs/en/mcp, https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/plugins-reference
- pi-subagents `docs/agents.md` (0.71.0 local copy at `~/.cache/pi-claude-marketplace/pi-runtime/node_modules/pi-subagents/docs/agents.md`; re-check at 0.74.0) — `mcp:<server>` and `mcp:<server>/<tool>` tokens, strict allowlist

### Output vocabulary
- `docs/output-catalog.md` — `{unsupported hooks}` partial pattern (lines ~147, ~492-497), info breakdown; `{unsupported mcp}` amendment goes here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bridges/mcp/adapter-entry.ts`: `stampServers`, `CARRIED_FIELDS`, `restoredOverride` — home of translation and the D-03-04/05 rules.
- `bridges/mcp/marker.ts`: marker shape (`plugin`, `marketplace`, `keptOverride`) — gains the plugin-set field names.
- `bridges/mcp/substitute.ts`: whole-entry deep substitution (Phase 4 narrows it; Phase 3 must not regress it).
- `domain/name.ts`: `generated*Name` builders — add the MCP name builder here.
- `domain/components/hooks/matcher.ts`: `parseMatcher`, `isMcpLiteral`, `SAFE_MATCHER_CHARS` — D-03-14 lands here.
- `bridges/agents/convert.ts`: `mapToolTokens` / `TOOL_MAP` drop `mcp__` tokens today — D-03-15 lands here.
- `domain/plugin-resolver.ts`, `domain/resolver-types.ts`, `domain/unsupported-components.ts`, `shared/probe-classifiers.ts::narrowUnsupportedKinds`: the partial-availability path `{unsupported hooks}` uses — D-03-10 mirrors it.

### Established Patterns
- Partial install: resolver `partially-available` + aggregate reason + `--partial` + info breakdown (hooks: PHOOK-04, D-71-04/05).
- Collisions throw `McpServerCollisionError` before any write (`bridges/mcp/stage.ts`).
- Closed-catalog amendments for new tokens, pinned by `tests/architecture/compat-01-no-expansion.test.ts` and `notify-closed-set-locks.test.ts`.

### Integration Points
- `orchestrators/plugin/info.ts` lists MCP servers from `resolved.mcpServers` / `record.resources.mcpServers` keys — D-03-16 display.
- Phase 6 status join and Phase 5 rename map consume the name builder.

</code_context>

<specifics>
## Specific Ideas

Research must settle before planning:
- Measure the tool-name limit on Pi 1.0 (sandboxed `PI_CODING_AGENT_DIR`, real adapter 5, long fixture); record what happens past it.
- Claude `timeout` semantics and units vs adapter `requestTimeoutMs`; the cap Claude applies when folding `request_timeout_ms`.
- The full Claude -> adapter field table (oauth fields, `callbackPort` -> `redirectUri: http://127.0.0.1:<port>/callback`), and the closed list of "Claude honors, adapter cannot" fields for D-03-10.
- pi-subagents 0.74.0: `mcp:` tokens against `directTools: "search"` servers, raw vs normalized tool names in `mcp:<key>/<tool>`, behavior when the adapter is absent.
- Whether a tool called through the adapter's `mcp` proxy tool bypasses hook matching.
- Confirm the adapter ignores the new marker content under `_piClaudeMarketplace`.

</specifics>

<deferred>
## Deferred Ideas

- Map agent `tools:` names of a dependency plugin's MCP servers (beyond ANAME-02).

</deferred>

---

*Phase: 03-claude-code-tool-names-and-tool-search*
*Context gathered: 2026-10-06*

# Phase 3: Claude Code tool names and tool search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-06
**Phase:** 03-claude-code-tool-names-and-tool-search
**Areas discussed:** Plugin vs user values, Non-Claude fields, Name clashes and length, Hooks and agent tools, Shown name, Unsupported-feature mechanism

---

## Plugin vs user values

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin wins | Carry-forward skips carried fields the plugin sets | ✓ |
| Track plugin's value | Marker records plugin values; a changed value is kept | |
| User wins (today) | Carried value always wins; plugin timeout changes never apply | |

**User's choice:** Plugin wins.

| Option | Description | Selected |
|--------|-------------|----------|
| User's 5000 | Write-back restores the kept value for plugin-set fields; marker records field names | ✓ |
| Live 30000 | D-02-23 as written; plugin value leaks into the user's entry | |

**User's choice:** User's kept value.

---

## Non-Claude fields

| Option | Description | Selected |
|--------|-------------|----------|
| Closed | Only fields mapped from Claude's schema, owned fields, carried fields, marker | ✓ |
| Pass-through | Today's behavior | |
| Closed + allowlist | Closed plus harmless adapter fields | |

| Option | Description | Selected |
|--------|-------------|----------|
| Claude-only effects | Warn for Claude-honored fields with no adapter equivalent; silent for keys Claude ignores | ✓ (later superseded) |
| Every dropped field | Warn for all | |
| Only ws and headersHelper | As ANAME-07 named | |

| Option | Description | Selected |
|--------|-------------|----------|
| Skip it, warn | No entry for a ws server | ✓ (later superseded) |
| Write it, warn | Dead entry shown as failed | |

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin description | plugin.json, fallback marketplace entry | ✓ |
| Provenance label | "Claude plugin p@mp" | |
| Both | Combined | |

---

## Name clashes and length

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse install | Same-plugin key collision refuses before any write | ✓ |
| Keep first, warn | Skip the second server | |

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as collision | `-`/`_` folded keys refuse like equal keys | ✓ |
| Warn and install | | |
| Research decides | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse if none fit | Refuse when the prefix reaches the limit; warn when little room is left | ✓ (later superseded) |
| Warn only | | |
| Refuse below threshold | | |

---

## Hooks and agent tools

| Option | Description | Selected |
|--------|-------------|----------|
| Accept that one form | `mcp__<seg>__.*` as a string prefix match | ✓ |
| Keep dropping it | | |

| Option | Description | Selected |
|--------|-------------|----------|
| This plugin's own | Map only servers this plugin writes | ✓ |
| Own + dependencies | | |
| Every mcp__ name | | |

---

## Shown name

Offered: adapter key `plugin_p_s_` / Claude form `plugin:p:s` / declared name.
**User's choice (free text):** Skills reference MCP tools in Claude form, so show the Claude name; consistency with servers installed in Pi directly is not needed. -> Claude form `plugin:<p>:<s>`; skills need no rewrite because tool names are delivered exactly.

---

## Unsupported-feature mechanism (user correction)

**User's note:** Unsupported plugin features are never "install and warn". The house mechanism makes the plugin partially installable, with an inline reason in the cascade and details in `info`, as for hooks. The earlier warning answers deviated from it.

| Question | Options | Selected |
|----------|---------|----------|
| Reason token | `{unsupported mcp}` / `{unsupported component}` | `{unsupported mcp}` |
| `--partial` subset | Drop affected server / keep server, drop feature | Drop affected server |
| Prefix too long for any tool | Unsupported mcp / refuse install | Unsupported mcp |

The "little room left" length warning was dropped. The ANAME-03/07 and roadmap wording was amended.

## Claude's Discretion

- Translator module layout; `{unsupported mcp}` info wording; marker field name for plugin-set fields; where the lifecycle divergence is documented.

## Deferred Ideas

- Map agent `tools:` names of a dependency plugin's MCP servers.

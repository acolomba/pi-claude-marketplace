# Phase 5: Automatic migration on /reload - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 05-automatic-migration-on-reload
**Areas discussed:** Entry source + fallback, Entries the record omits, User edits + key collisions, Notice shape

---

## Entry source + fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Re-stage from cache | Offline, install translator, final shape | ✓ |
| Translate in place | Closed translator over the legacy entry | |

| Option | Description | Selected |
|--------|-------------|----------|
| Leave + warn, retry | Old entries keep working; reinstall remedy | ✓ |
| Move verbatim | Final key, non-final content | |
| Translate in place | Only when the source is missing | |

| Option | Description | Selected |
|--------|-------------|----------|
| MCP-only | Stage into mcp-adapter.json, remove from mcp.json | ✓ |
| Full reinstall | Reinstall each plugin, plus the legacy removal | |

**Notes:** The operator asked for the scenario in concrete terms (upgrade from the
released build, `github` in mcp.json -> `plugin_acme_github_` in mcp-adapter.json),
then checked that `claude-plugins.json` (desired state) and `state.json` stay
backward compatible: the config schema never changed; state.json v1-v3 all load.

## Entries the record omits

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | Server no longer declared; Claude parity | ✓ |
| Keep + warn | Like AMIG-04 | |

Unsupported servers: first answered "leave + warn"; after the operator asked why
`ws` is unsupported (the adapter has no WebSocket transport) and what
"working-but-unsupported" means, the operator set the rule: if a server would not
work as in Claude, it is not installed; missing auth does not work well; ignored
restrictions only warrant a warning because the plugin still works.

| Option | Description | Selected |
|--------|-------------|----------|
| Both (install and migration) | Permission policies warn everywhere | ✓ |
| Migration only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Not installed (bareElicitationCapability) | Adapter cannot send the bare shape | ✓ |
| Install, warn | | |

Leading `~`: the operator expected Claude to reach the home directory, so the
difference would only be expansion timing. A research subagent (2.1.294 binary +
sandboxed probe) refuted it: Claude never expands `~`. D-04-06 stands.

| Option | Description | Selected |
|--------|-------------|----------|
| Drop unsupported server, mark partial | Like install --partial | ✓ |
| Leave plugin untouched + warn | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Drop malformed server, move rest | Claude skips only the bad server | ✓ |
| Leave untouched + warn | | |
| Remove all plugin MCP | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Install sweeps same-plugin legacy entries | Avoids duplicate after reconcile install | ✓ |
| Leave both + warn | | |

## User edits + key collisions

| Option | Description | Selected |
|--------|-------------|----------|
| D-02-06 set, as update | With the D-03-04 ownership rule | ✓ |
| Nothing | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Absorb old-name stub under new name | Kept verbatim in marker, written back on uninstall | ✓ |
| Carry fields, leave stub | | |
| Ignore it | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Skip plugin + warn on collision | All-or-nothing per plugin | ✓ |
| Skip only that server | | |

## Notice shape

| Option | Description | Selected |
|--------|-------------|----------|
| One, both scopes | Before the reconcile notice | ✓ |
| Fold into reconcile | | |
| One per scope | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter key | `github -> plugin_acme_github_` | ✓ |
| Claude form | `plugin:acme:github` | |
| Both | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Info, warning if short | House tri-state | ✓ |
| Always warning | | |

| Option | Description | Selected |
|--------|-------------|----------|
| One body, fixed order | Rows, cost line, variable notices, reload hint | ✓ |
| Main + separate notices | | |

## Post-research revisions (2026-10-08)

Research found that the adapter reads `mcp.json` in Pi's format, so fields in
legacy entries are inert today, and that the adapter panel writes full copies
under the old name. The operator asked what "user edits" meant (only hand edits
to our marked entries) and ruled: no carry-over at all; delete the old entries
as cleanup and install as if they never existed. Follow-ups:

| Question | Selected |
|----------|----------|
| Old-name disable stubs and panel full copies | Delete both as cleanup, list in notice |
| Reinstall/update also sweep legacy entries | Yes, every path |
| Malformed server in an installed plugin | Fresh-install rule (replaces "drop only that server") |

## Claude's Discretion

Step placement and locking, write batching, half-done detection, disabled-record
leftovers, other-scope leftovers, fault-injection design, warning damping.

## Deferred Ideas

- `CLAUDE_CODE_SHELL_PREFIX` and `~`.
- pi-subagents `mcp:<old-name>` overrides are not rewritten; Phase 7 docs note.

# Phase 4: Variable expansion at Claude Code parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-07
**Phase:** 4-variable-expansion-at-claude-code-parity
**Areas discussed:** Unescapable re-expansion, Credential deny-list, User-scope PROJECT_DIR, Warning surfaces

---

## Unescapable re-expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Partial install | `{unsupported mcp}`, `--partial` leaves the server out | |
| Split by form | `$env:`/`{env:}` partial, `~/` warns | |
| Install and warn | AVAR-03 as written | |

**User's choice:** Free text: "can we turn it into something literal then?"
**Notes:** Answered by reading the adapter source and probing its real functions.
`$env:`/`{env:}` can be made literal with a split-token construction and an
empty reserved variable. A leading `~/` cannot. Asked "Claude Code never expands
variables in… what?": answered that Claude expands the five fields but only the
`${NAME}`/`${NAME:-default}` syntax. Asked whether the adapter's syntax is
incidental and could be fixed upstream: it is documented and intentional, and
the maintainer declined an external literal mode in #570. Asked about raising
the adapter floor to 5.1.0: interpolation is unchanged in 5.1.0, but it is the
first release supporting Pi 1.0. Decision: go to 5.1.0.

| Option | Description | Selected |
|--------|-------------|----------|
| Split-token literal for `$env:`/`{env:}` | Reserved empty variable set by the extension | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Partial install for leading `~/` | House rule | ✓ |
| Install and warn | | |

**Notes:** User: "a claude code plugin shouldn't have that ~, right? (can you
survey the plugins with mcp in the official marketplace?)". Survey of 315
plugins / 217 servers found no `~`, `$env:`, `{env:}`, leading `!` or bare
`$NAME`. User confirmed the Pi floor stays `>=1.0.0`.

---

## Credential deny-list

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Claude | Plain list in all five fields, remote-sink list in url/headers, version-pinned snapshot | ✓ |
| AVAR-05 as written | Own credentials, url/headers only | |
| Mirror + Pi keys | Pulls in a Future requirement | |

| Option | Description | Selected |
|--------|-------------|----------|
| Claude's output at install | Never left for the adapter | ✓ |
| Always empty | | |

---

## User-scope PROJECT_DIR

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve at runtime | Export `CLAUDE_PROJECT_DIR` at session start | ✓ |
| Partial install | | |
| Install and warn | | |

---

## Warning surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Every staging path | D-02-09 notice route | ✓ |
| Install only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| info shows them live | Names only, current env | ✓ |
| No | | |

---

## Claude's Discretion

- Reserved variable name and set point; conformance-test harness; escape-matrix
  scope (every written field); module layout; threat model at planning.

## Deferred Ideas

- Upstream `claudePlugins` loader bug report (needs operator go-ahead).
- Upstream JSON-settable Claude-syntax mode request.
- Blanking Pi provider keys (Future requirement).
- Phase 3 follow-up on `type: "streamable-http"` / `"url"` in official plugins.

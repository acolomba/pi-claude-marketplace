# Phase 6: Live MCP status in info - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-09
**Phase:** 6-live-mcp-status-in-info
**Areas discussed:** Status wording, Placement on the row, Unknown cases, Rows/scopes/severity

---

## Status wording

| Option | Description | Selected |
|--------|-------------|----------|
| Claude text map + failed | Claude's words; `failed` kept distinct from `not connected` | ✓ |
| Claude text map strictly | adapter `failed` and `not-connected` both `not connected` | |
| Adapter's own words | connected, cached, failed, needs auth, blocked by project trust, disabled, idle | |

**User's choice:** Claude text map + failed

| Option | Description | Selected |
|--------|-------------|----------|
| cached, connects on first use | comma instead of nested parentheses | ✓ |
| cached | short token | |
| You decide | | |

**User's choice:** cached, connects on first use

---

## Placement on the row

| Option | Description | Selected |
|--------|-------------|----------|
| First in its parentheses | status leads, unset/withheld follow | ✓ |
| Last in its parentheses | appended after existing lists | |
| Separate status line | new `mcp status:` line | |

| Option | Description | Selected |
|--------|-------------|----------|
| None | state only | ✓ |
| Failure age only | `failed 42s ago` | |
| Block reason only | why approval is pending | |

| Option | Description | Selected |
|--------|-------------|----------|
| No hint | plain inventory | ✓ |
| One note line | point to /mcp | |

---

## Unknown cases

| Option | Description | Selected |
|--------|-------------|----------|
| Two tokens | `status unknown` / `not loaded` | ✓ |
| One token | `status unknown` everywhere | |
| Name every cause | four tokens | |

| Option | Description | Selected |
|--------|-------------|----------|
| Unknown on each server | literal ASTAT-02 | ✓ |
| No status at all | rely on `(missing)` tag | |

---

## Rows, scopes, severity

| Option | Description | Selected |
|--------|-------------|----------|
| Installed rows only | installed / partially-installed written servers | ✓ |
| Disabled rows too | disabled rows show `not loaded` | |

| Option | Description | Selected |
|--------|-------------|----------|
| Only the scope the adapter uses | other scope gets a shadowed token; research confirms precedence | ✓ |
| Same status on both | simpler, may misstate | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, stays info | read-only inventory surface | ✓ |
| Warning | failure states raise severity | |

---

## Claude's Discretion

- Snapshot validation, malformed/newer-version handling, tracker module and lifecycle.
- Wording of the shadowed token, drafted for operator review.

## Deferred Ideas

None.

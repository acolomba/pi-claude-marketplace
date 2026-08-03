# Phase 92: MCP staging parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 92-mcp-staging-parity
**Areas discussed:** Substitution surface, Env injection targeting

---

## Substitution surface

| Option | Description | Selected |
|--------|-------------|----------|
| Whole entry, deep | Walk every string value at any nesting (command, args, env, cwd, headers, url…); matches Claude config-load semantics; rescues cwd/header refs pi-mcp-adapter would blank; unknown ${...} pass through. (Recommended) | ✓ |
| Strict command/args/env only | Literal requirement text; leaves ${CLAUDE_PLUGIN_ROOT} in cwd to interpolate to empty at spawn. | |

**User's choice:** Whole entry, deep (Recommended) → D-92-01

---

## Env injection targeting

| Option | Description | Selected |
|--------|-------------|----------|
| Stdio-shaped only | Inject env only into entries with a command; url-type entries keep declared env untouched. (Recommended) | ✓ |
| All entries | Simpler predicate; meaningless env blocks on url-type entries. | |

**User's choice:** Stdio-shaped only (Recommended) → D-92-02

---

## Claude's Discretion

- Walker placement (shared/vars.ts vs mcp-bridge-local) respecting D-11 + Phase 93 separability
- StageMcpInput threading shape
- Test/fixture design

## Deferred Ideas

- Coverage-sweep todo: carried forward as reviewed-not-folded (decision from Phase 90).

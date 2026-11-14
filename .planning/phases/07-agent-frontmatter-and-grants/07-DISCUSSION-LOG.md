# Phase 7: Agent Frontmatter and Grants - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 07-agent-frontmatter-and-grants
**Areas discussed:** YAML parse order, repair trigger set, unparseable agent, quoted-name rename, nested delegation, nesting depth, model inherit, both tool lists, proof
**Mode:** `--auto`. Every area was auto-selected and took the recommended (upstream-parity) option. Upstream evidence: Claude Code 2.1.323 binary grep and the sub-agents docs, 2026-11-14.

---

## YAML parse order

| Option | Description | Selected |
|--------|-------------|----------|
| Parse, repair only on failure | Upstream order (`zWn`); comments stripped on the first pass | ✓ |
| Repair always, then parse | Skills bridge order | |
| YAML with whole-file line-reader fallback | Rejected by PRD 7.7 | |

[auto] YAML parse order — Q: "When does the colon repair run?" → Selected: "Parse, repair only on failure" (recommended default)

## Repair trigger set

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the skills trigger (unquoted `: `) | ROADMAP names the skills leniency; record upstream's wider set as residual | ✓ |
| Widen to upstream's `xu` set and tab rule | Changes skills too; outside the ROADMAP note | |

[auto] Repair trigger set → Selected: "Keep the skills trigger" (recommended default; pending maintainer review)

## Unparseable agent

| Option | Description | Selected |
|--------|-------------|----------|
| Load with no fields plus a warning | Upstream `NIn` behavior; warning is this project's install channel | ✓ |
| Refuse the agent | Not upstream | |
| Fall back to the line reader | Rejected by PRD 7.7 | |

[auto] Unparseable agent → Selected: "Load with no fields plus a warning" (recommended default; wording pending maintainer review)

## Quoted-name rename

| Option | Description | Selected |
|--------|-------------|----------|
| Rename at the next update or reinstall through the per-plugin unstage | No load-time migration (APL-D1) | ✓ |
| Migrate at load | Violates APL-D1 | |

[auto] Quoted-name rename → Selected: "Rename at next update/reinstall" (recommended default; pending maintainer review)

## Nested delegation

| Option | Description | Selected |
|--------|-------------|----------|
| `Agent`/`Task` → `subagent`; omitted tools → `allowNestedSubagents: true`; no `allowedAgents` | Upstream ignores the type list in a subagent | ✓ |
| Write the type list as `allowedAgents` | Narrows beyond upstream | |

[auto] Nested delegation → Selected: first option (recommended default)

## Nesting depth

| Option | Description | Selected |
|--------|-------------|----------|
| Leave pi-subagents' default (2) and user settings; document | Requirement does not ask for depth parity | ✓ |
| Write a per-agent depth of 3 | Overrides the user's pi-subagents setting | |

[auto] Nesting depth → Selected: "Leave default; document" (pending maintainer review)

## Model inherit

| Option | Description | Selected |
|--------|-------------|----------|
| Always write `model: inherit` | Upstream ranks frontmatter inherit above the env setting | ✓ |
| Only with `--map-model` | Leaves `subagents.defaultModel` above it | |

[auto] Model inherit → Selected: "Always write" (recommended default)

## Both tool lists

| Option | Description | Selected |
|--------|-------------|----------|
| Deny first; per-tool MCP deny to `excludeTools` beside `tools`; remove both warnings | Upstream runtime order; pi-subagents 0.62+ applies `excludeTools` to an explicit list | ✓ |
| Keep warnings | Stale below-floor statements | |

[auto] Both tool lists → Selected: first option (recommended default; research verifies the `mcp:` selector case)

## Proof

[auto] Proof → Selected: cucumber scenarios per requirement; an integration test against installed pi-subagents carries the real-child call if the harness cannot (recommended default)

---

## Claude's Discretion

Module home for the shared repair, helper names, warning wording, plan split, deletion of the line reader in the same plan.

## Deferred Ideas

Wider repair trigger set; depth parity; PG-AGENT-07c; AGENT-04/06/08/10/11; PG-WF-05; AGTLONGNAME-01.

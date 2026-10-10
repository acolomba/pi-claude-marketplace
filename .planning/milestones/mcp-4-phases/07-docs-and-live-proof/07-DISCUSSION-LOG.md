# Phase 7: Docs and live proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-09
**Phase:** 7-docs-and-live-proof
**Areas discussed:** Live UAT design, Document-only divergences, Upgrade notes + CHANGELOG, Docs structure

---

## Live UAT design

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted stub | Keyless stub replays mcp({search}), tool_search, then the found tool | ✓ |
| Real model | One session with a provider key | |
| Both | Scripted canary plus one recorded real-model session | |

| Option | Description | Selected |
|--------|-------------|----------|
| Operator canary | tests/live-uat/mcp-adapter-canary.mjs, outside npm run check | ✓ |
| CI e2e test | Real adapter, stub and MCP fixture in the e2e job | |
| Canary + nightly later | Canary now, nightly drift run in BACKLOG | |

| Option | Description | Selected |
|--------|-------------|----------|
| 5.1.0 and 5.2.0 | Floor and current release | |
| 5.2.0 only | What users install today | ✓ |
| 5.1.0 only | Matches existing pins | |

| Option | Description | Selected |
|--------|-------------|----------|
| Captured from v0.19.2 | One-time capture committed as a fixture | ✓ |
| Live upgrade each run | Install with 0.19.2 each run, then reload on the branch | |
| Hand-written seed | Write the entry from the known marker format | |

**User's choice:** scripted stub; operator canary; 5.2.0 only; seed captured from v0.19.2.
**Notes:** The user asked why an older Pi (0.9x) appeared in the seed options. Clarified that
0.19.2's peer range admits Pi 1.0 and its on-disk output does not depend on the Pi version. The
user chose "captured from pi 1.x": the capture runs 0.19.2 on Pi 1.x.

---

## Document-only divergences

| Option | Description | Selected |
|--------|-------------|----------|
| Document only | Both items join the divergence list | ✓ |
| Document + upstream asks | Plus draft feature requests to pi-mcp-adapter | |

| Option | Description | Selected |
|--------|-------------|----------|
| Document them | Section on exclusive mode, --mcp-config, MCP_DIRECT_TOOLS | ✓ |
| Link only | One sentence linking the adapter docs | |
| Leave out | Adapter docs cover them | |

| Option | Description | Selected |
|--------|-------------|----------|
| Raise to 5.2.0 | Peer >=5.2.0 <6, all pins and conformance tests move | ✓ |
| Keep 5.1.0, recommend 5.2.0 | Docs-only recommendation | |
| Keep 5.1.0, no mention | No change | |

**User's choice:** document only; document the adapter settings; raise the floor to 5.2.0.
**Notes:** The user first picked "Document + upstream asks". In the follow-up they corrected it:
"i meant to say 1, document only".

---

## Upgrade notes + CHANGELOG

| Option | Description | Selected |
|--------|-------------|----------|
| Docs + CHANGELOG | Upgrading section in mcp-compatibility.md plus a short action bullet | ✓ |
| CHANGELOG only | Everything in the CHANGELOG bullet | |
| README section | Upgrading from 0.19 section in README and README.es | |

| Option | Description | Selected |
|--------|-------------|----------|
| 0.20.0 | Minor bump, the semver 0.x rule for breaking changes | ✓ |
| 1.0.0 | Declares a stable public surface | |
| Decide at PR time | Leave the number to the bump offer | |

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped bullets | Existing style with nested sub-bullets | ✓ |
| One summary bullet | A few lines plus a link | |
| One bullet per requirement | About 30 bullets | |

**User's choice:** docs + CHANGELOG; 0.20.0; grouped bullets.

---

## Docs structure

| Option | Description | Selected |
|--------|-------------|----------|
| mcp-compatibility.md | New sections there; README links | ✓ |
| README carries them | Full sections in README and README.es | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep prose bullets | Append new items under short subheadings | ✓ |
| One table | Behavior / Claude Code / Pi / License table | |

| Option | Description | Selected |
|--------|-------------|----------|
| Every MCP mention | Overview, 5.8, SC-2/NFR-10, 7.2 journey, diagrams | ✓ |
| Requirements text only | NFR-10, SC-2 and 5.8 rows only | |

**User's choice:** mcp-compatibility.md; prose bullets; every MCP mention.

---

## Claude's Discretion

- The MCP server fixture, the stub script format, and how the canary drives `/reload` and `info`.
- What to do if `--no-extensions` drops `builtin:tool-search`.
- How deep the env-vars.md (ENVDOC-01) rewrite goes, and which hooks-compatibility claims change.
- Plan split and wave order.

## Deferred Ideas

- A nightly canary run against the latest 5.x adapter.
- Upstream adapter requests for per-tool alwaysLoad and approval persistence.
- The upstream claudePlugins loader bug report carried from phase 4.

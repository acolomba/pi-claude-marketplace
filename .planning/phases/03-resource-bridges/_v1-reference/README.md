# Phase 3 V1 Reference Files

Static snapshots of V1 source files extracted from `features/initial` branch on 2026-05-10.
These files are checked-in references for plan executors so they can read the V1 algorithm
without depending on a branch that may move. Per W-02 fix.

| File | V1 Source |
|------|-----------|
| `agent-frontmatter.ts` | `features/initial:extensions/claude-marketplace/agent/frontmatter.ts` (226 lines) |
| `agent-convert.ts` | `features/initial:extensions/claude-marketplace/agent/convert.ts` (478 lines) |
| `agent-stage.ts` | `features/initial:extensions/claude-marketplace/agent/stage.ts` (663 lines) |
| `mcp-marker.ts` | `features/initial:extensions/claude-marketplace/mcp/marker.ts` (41 lines) |
| `mcp-parse.ts` | `features/initial:extensions/claude-marketplace/mcp/parse.ts` (100 lines) |
| `mcp-effective-config.ts` | `features/initial:extensions/claude-marketplace/mcp/effective-config.ts` (55 lines) |
| `mcp-stage.ts` | `features/initial:extensions/claude-marketplace/mcp/stage.ts` (206 lines) |
| `resource-stage.ts` | `features/initial:extensions/claude-marketplace/resource/stage.ts` (combined skills+commands) |
| `plugin-vars.ts` | `features/initial:extensions/claude-marketplace/plugin/vars.ts` (V1 substitutePluginVars) |

**Usage:** Plan executors should read these files INSTEAD of running `git show features/initial:...`.
The plan `<read_first>` blocks reference paths under this directory.

**Do not edit.** These are immutable snapshots; if V1 ever changes (it should not -- this is the
historical reference), the snapshot here remains the planning baseline.

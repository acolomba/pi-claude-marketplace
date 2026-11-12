# pi-subagents: granted adapter tool names over 64 characters

Patch: no patch exists; this report is not filed.
Repository: https://github.com/nicobailon/pi-subagents
Package version: 0.88.0, measured 2026-11-11.

## Problem: a granted adapter tool keeps a name the adapter cuts

`src/runs/shared/mcp-direct-tool-grant.js:104-113` defines pi-subagents' `formatToolName`. It replaces each `.` with `_` and joins the server prefix and tool name. It does not limit the result's length. pi-mcp-adapter 7.0.1 `types.ts:963-1003` uses `formatToolName` to cut a joined name over 64 characters to 55 characters, `_`, and eight hash digits.

`planMcpDirectToolGrant` puts pi-subagents' uncut name in `selections`. `src/runs/shared/child-tool-plan.js:245,265-273` makes that name a required child tool. The adapter registers the cut name instead. The child reports `requested unavailable child tools: <full name>` and does not launch. A whole-server grant also selects the long tool.

### What the adapter registers

For `plugin_demo_warehouse_` and `list_every_table_in_the_warehouse_with_row_counts`, pi-mcp-adapter 7.0.1 registers `mcp__plugin_demo_warehouse__list_every_table_in_the_war_17c0721b`. Its `types.ts` hashes the full joined name. The agents bridge's adapter profile computes the same name.

### Where pi-subagents reads the grant

`src/runs/shared/mcp-direct-tool-allowlist.js` reads `mcp-adapter.json` and `mcp-cache.json`, checks the server config hash, and calls `planMcpDirectToolGrant`. The resolver returns the uncut `mcp__plugin_demo_warehouse__list_every_table_in_the_warehouse_with_row_counts` for the bridge's `mcp:plugin_demo_warehouse_/list_every_table_in_the_warehouse_with_row_counts` selector. The child tool plan requires that name.

### Evidence and test

Measured by `test/integration/agents-adapter-grant-conformance.test.ts` with pi-subagents 0.88.0 and hermetic config and cache fixtures. The test passes while the resolver returns the uncut 77-character name and the adapter profile returns the cut name. The built-in conformance test also passed. No live background child was run; the phase verification retains that human check.

## Draft issue

**Title:** Match pi-mcp-adapter's 64-character tool names in MCP grant resolution

**Body:**

```markdown
pi-subagents 0.88.0's `formatToolName` in `src/runs/shared/mcp-direct-tool-grant.js` joins the server and tool names without pi-mcp-adapter 7.0.1's 64-character cut. For a granted tool, the name becomes required in the child. The adapter registers the cut name, so the child reports `requested unavailable child tools` and does not launch. A whole-server grant is affected when it includes one long tool.

Example selector: `mcp:plugin_demo_warehouse_/list_every_table_in_the_warehouse_with_row_counts`
Required by pi-subagents: `mcp__plugin_demo_warehouse__list_every_table_in_the_warehouse_with_row_counts`
Registered by pi-mcp-adapter: `mcp__plugin_demo_warehouse__list_every_table_in_the_war_17c0721b`

Please fit the name in grant resolution as pi-mcp-adapter's `formatToolName` does. A conformance fixture with a matching `mcp-adapter.json` and `mcp-cache.json` shows the mismatch without starting a child.
```

# pi-mcp-adapter: no per-server switch to withhold sampling

Patch: no patch exists; this report is not filed.
Repository: https://github.com/nicobailon/pi-mcp-adapter
Package version: 7.0.1, read as source, 2026-11-14.

## Problem: sampling is on for every server or for none

pi-mcp-adapter decides once per session whether servers may sample through Pi models. `init.ts:184-185` reads `settings.samplingAutoApprove` and turns sampling on when `settings.sampling` is not `false` and the session has UI approval or `samplingAutoApprove` is `true`. `server-manager.ts:1511-1528` (`buildClientCapabilities`) then adds `sampling: {}` to the client capabilities of every server, because it reads the manager-wide `this.samplingConfig` at line 1517 and nothing from the server's definition.

The same function already reads per-server fields of the definition. At line 1514, `openUi === false` on an entry removes the MCP Apps UI extension for that server only (`types.ts:497`), and `rootsFor` (lines 1531-1532) leaves out `roots` when the entry holds `roots: false` (`types.ts:501`). No entry field removes `sampling`. The only switch is the global `settings.sampling` (`types.ts:690-691`, `docs/configuration.md`), and it also removes the power from servers the user added and wants to sample.

The adapter guards each request. In `sampling-handler.ts:168-177`, `confirmSampling` asks the user to confirm in a UI session and refuses without UI unless `samplingAutoApprove` is set. That guard is the same for every server.

### Why a per-server switch matters here

pi-claude-marketplace installs Claude Code plugins and writes one `mcp-adapter.json` entry for each MCP server a plugin declares. It owns those entries and not the user's `settings`. With 7.0.1 it has nothing to write on a plugin entry that withholds sampling from that server alone. The measured `initialize` request of a plugin server (pi-mcp-adapter 7.0.1, Pi 1.5.0, 2026-11-14) holds `sampling: {}`.

### Claude Code, for contrast

Claude Code 2.1.323 declares the client capabilities `{roots: {listChanged: true}, elicitation: {}}` to an MCP server, and adds the MCP Apps UI extension only when `CLAUDE_CODE_MCP_APPS_HOST` is set, which the CLI does not set (read in the CLI binary). The object holds no `sampling` member, so a plugin server under Claude Code cannot sample.

## Draft issue

**Title:** Add a per-server `sampling` field, read like `openUi`

**Body:**

```markdown
pi-mcp-adapter 7.0.1 declares `sampling: {}` to every server when `settings.sampling` is not `false` and the session has UI approval or `samplingAutoApprove` (`init.ts:184-185`, `server-manager.ts:1517`). The only way to withhold it from one server is to turn it off for all of them.

`buildClientCapabilities` already reads per-server fields: `openUi: false` on an entry removes the MCP Apps UI extension for that server only (`server-manager.ts:1514`), and `roots: false` removes `roots` (`server-manager.ts:1532`).

Please add a `sampling?: boolean` field to a server entry and read it in `buildClientCapabilities` the same way: when an entry holds `sampling: false`, leave `sampling: {}` out of that server's capabilities. The global `settings.sampling` stays the default for every entry that does not set the field.

Use case: a tool that writes entries for servers it installs (for example, the MCP servers of Claude Code plugins, which cannot sample under Claude Code) can withhold sampling from those servers without changing the user's own servers or settings.
```

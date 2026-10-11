# API Coverage — Claude Code plugin MCP server configuration

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Surface: the plugin MCP server configuration that Claude Code 2.1.291 accepts (`.mcp.json`, `plugin.json` `mcpServers`), translated into pi-mcp-adapter 5.0.0 `mcp-adapter.json` entries. This phase calls no network API; the surface is the server schema and its runtime naming. Decisions come from 03-CONTEXT.md (D-03-02, D-03-07, D-03-08, D-03-10, D-03-20).

| capability | decision | reason |
|---|---|---|
| stdio transport (`command`, `args`, `env`) | INTEGRATE | |
| sse transport (`type: "sse"`, `url`, `headers`) | INTEGRATE | |
| http transport (`type: "http"` / `"streamable-http"`, `url`, `headers`) | INTEGRATE | |
| per-call `timeout` | INTEGRATE | |
| `request_timeout_ms` (folded into `timeout`) | INTEGRATE | |
| `alwaysLoad` | INTEGRATE | |
| `oauth.clientId` | INTEGRATE | |
| `oauth.callbackPort` | INTEGRATE | |
| `oauth.authServerMetadataUrl` | INTEGRATE | |
| `oauth.scopes` | INTEGRATE | |
| plugin tool names `mcp__plugin_<plugin>_<server>__<tool>` | INTEGRATE | |
| deferred loading behind tool search | INTEGRATE | |
| `ws` transport | OPT-OUT | explicitly out of scope: pi-mcp-adapter 5 has no WebSocket transport; the plugin resolves partially available with `{unsupported mcp}` (D-03-10) |
| host-only types `sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy` | OPT-OUT | explicitly out of scope: not runnable from a plugin under the adapter; partial install (D-03-20) |
| `headersHelper` | OPT-OUT | explicitly out of scope: the adapter's `requestHeadersCommand` has a different contract; partial install (D-03-10) |
| `oauth.xaa` (cross-app access) | OPT-OUT | explicitly out of scope: no cross-app-access flow in the adapter's OAuth config; partial install (D-03-10) |
| `tools[].permission_policy` | OPT-OUT | explicitly out of scope: the adapter has no per-tool policy field; partial install (D-03-10) |
| `toolPermissions` | OPT-OUT | explicitly out of scope: same gap as per-tool policies; partial install (D-03-10) |
| `bareElicitationCapability` | OPT-OUT | explicitly out of scope: the adapter always advertises form and URL elicitation; partial install (D-03-20) |
| `role` | OPT-OUT | not needed: Claude's internal coordinator-mode hint, which has no plugin use; dropped silently (D-03-20) |
| `discoveryCache` | OPT-OUT | not needed: the adapter caches discovery by default; dropped silently (D-03-20) |
| `cwd` | OPT-OUT | not needed: absent from Claude's schema, which strips it; dropped silently (D-03-08) |
| session-long background connection | OPT-OUT | explicitly out of scope: operator decision to keep the adapter's lazy lifecycle; documented divergence (ANAME-05) |

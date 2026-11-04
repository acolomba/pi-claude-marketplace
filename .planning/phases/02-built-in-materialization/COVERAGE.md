# API Coverage — Pi 1.5.0 built-in MCP, as seen by an extension

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

The surface is what `@earendil-works/pi-coding-agent` 1.5.0 offers an extension for MCP servers: the `ExtensionAPI` registry calls, the trust check, the tool inventory, and the `McpServerConfig` fields (`dist/core/mcp-servers.d.ts`). The extension never connects a server itself; Pi's built-in MCP does. A field is integrated when the extension writes it from a plugin's Claude Code declaration; an opt-out is a field Claude Code has no counterpart for, or one a decision keeps out.

| capability | decision | reason |
|---|---|---|
| `pi.registerMcpServer(name, config)` | INTEGRATE | |
| `pi.unregisterMcpServer(name)` | INTEGRATE | |
| `pi.getMcpServers()` (sync compare and status) | INTEGRATE | |
| `RegisteredMcpServer.extensionPath` (the owner of a listed registration) | OPT-OUT | not reachable: Pi 1.5.0 gives an extension no reliable way to learn the `extensionPath` it records for the extension's own registrations, and the status reader's parameter is frozen, so info cannot tell a same-name registration by another extension from this extension's (P2-DC-46); a BACKLOG parent line carries the fix |
| `pi.getAllTools()` tool `namespace` and `exposure` (status in info) | INTEGRATE | |
| `ctx.isProjectTrusted()` (project trust gate) | INTEGRATE | |
| `mcp_servers_change` event handler | OPT-OUT | explicitly out of scope: a handler would make this extension the connector in place of Pi's built-in MCP (PI-11) |
| stdio `type`, `command`, `args`, `env` | INTEGRATE | |
| stdio `cwd` | OPT-OUT | not a Claude Code field; Pi then starts the server in the session directory (CC-1, P2-DC-04) |
| streamable HTTP `type: "http"`, `url`, `headers` | INTEGRATE | |
| HTTP `auth.provider` (a Pi login token) | OPT-OUT | a Pi-only credential power with no Claude Code field; a plugin must never choose it (CC-1) |
| `oauth.clientId` | INTEGRATE | |
| `oauth.callbackUrl` | INTEGRATE | written from Claude Code's `callbackPort` as `http://localhost:<port>/callback` (CC-7, P2-DC-20) |
| `oauth.callbackPort` | OPT-OUT | not needed: the port travels in `callbackUrl`, which keeps Claude Code's `localhost` redirect (P2-DC-20) |
| `oauth.scope` | INTEGRATE | |
| `oauth.authServerMetadataUrl` | INTEGRATE | |
| `oauth.clientSecret` | OPT-OUT | explicitly out of scope: a plugin passes only Claude Code's OAuth fields, so Pi never resolves a secret from a plugin value (D-MB-11 as amended, PI-6) |
| `oauth.clientName` and `oauth.clientRegistration` | OPT-OUT | explicitly out of scope: never written, so Pi keeps its client ID metadata document (D-MB-11 as amended) |
| `timeout` (seconds) | INTEGRATE | |
| `exposure` values `deferred` and `direct` | INTEGRATE | |
| `exposure` values `codemode` and `hidden` | OPT-OUT | no Claude Code counterpart; turning deny rules into `hidden` is MCPV2-02, deferred to a later milestone |
| `toolExposure` (per-tool exposure) | OPT-OUT | not needed yet: per-tool exposure from deny rules is MCPV2-02, deferred |
| `enabled: false` | OPT-OUT | not needed: a disabled plugin's server is not registered at all (BLT-06) |
| `description` | INTEGRATE | the plugin's description, as the adapter entry writes it; dropped only if its reader would be an unreviewable clone (P2-DC-23) |
| `mcp.json` server names (user file, and the project file while trusted) | INTEGRATE | read only, for the `overridden by mcp.json` status in info (BLT-04, P2-DC-08) |
| writing `mcp.json` or Pi settings | OPT-OUT | explicitly out of scope: registration writes no file, and turning built-in MCP on is the user's step (D-MB-01, D-MB-04) |
| Pi's `/mcp` manager actions | OPT-OUT | Pi's own session-only UI; the status reader reads their effect on the tool list (BLT-05) |

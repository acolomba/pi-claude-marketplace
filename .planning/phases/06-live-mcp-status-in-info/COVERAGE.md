# API Coverage — pi-mcp-adapter extension API (runtime status snapshots)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

The phase consumes one surface of pi-mcp-adapter 5.1.0's extension API (`docs/extension-api.md`, "Runtime status snapshots"). The other surfaces of that document are listed so their absence is a decision, not a gap.

| capability | decision | reason |
|---|---|---|
| subscription to `pi-mcp-adapter/status/v1` through `pi.events.on` | INTEGRATE | |
| snapshot `version` (accept 1 only) | INTEGRATE | |
| empty snapshot at session start and shutdown | INTEGRATE | |
| per-server `name` (exact join on the config key) | INTEGRATE | |
| per-server `status` (the seven values) | INTEGRATE | |
| per-server `toolCount`, `directToolCount`, `resourceCount` | OPT-OUT | explicitly out of scope: D-06-04, info shows no tool count; the adapter's own panel shows it |
| per-server `failedAgoSeconds` | OPT-OUT | explicitly out of scope: D-06-04, no failure age on info |
| per-server `blockedReason` | OPT-OUT | explicitly out of scope: D-06-04, no block reason; payload strings are never rendered (T-06-02) |
| per-server `disabled`, `listenState`, `catalogStale` | OPT-OUT | not needed: `status` already carries `disabled`; listen state and catalog staleness are adapter panel detail (D-06-04) |
| snapshot `totalTools`, `totalResources`, `connectedCount`, `disabledCount` | OPT-OUT | not needed: info reports a state per server only (D-06-03) |
| importing `MCP_STATUS_EVENT` or `McpStatusSnapshot` from the package | OPT-OUT | explicitly out of scope: the adapter is a soft dependency and is never imported; the channel string is pinned by the conformance test |
| runtime server registration from other extensions | OPT-OUT | explicitly out of scope: plugin servers are delivered as `mcp-adapter.json` entries (ROADMAP settled decision 1) |
| runtime tool calls from other extensions (`dispatch`, linked resources) | OPT-OUT | explicitly out of scope: info never connects a server or calls a tool (ASTAT-01) |
| agent plugins, local Claude plugin bundles, Pi package manifests | OPT-OUT | explicitly out of scope: this extension writes adapter config entries instead (milestone delivery decision) |
| SDK configuration and host-managed embedding | OPT-OUT | explicitly out of scope: the adapter runs as its own Pi extension and is never embedded |
| parsing `/mcp-adapter` or `mcp({})` text output | OPT-OUT | not needed: the status channel replaces text parsing |

# API Coverage — pi-mcp-adapter 5.2.0 `ServerEntry` user choices across the plugin lifecycle

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Surface: the per-server fields of pi-mcp-adapter 5.2.0's `ServerEntry` (`types.ts`, pinned as `SERVER_ENTRY_KEYS` in `tests/bridges/mcp/adapter-entry.test.ts`) that a user can set in `mcp-adapter.json`, and which of them this extension keeps when it re-stages, disables, enables, uninstalls or reinstalls a plugin's MCP servers. The phase calls no network API; the other adapter surfaces stay as the Phase 3, 4 and 6 matrices decided them. Decisions come from 08-CONTEXT.md (D-08-01, D-08-02, D-08-04) and AFILE-06.

| capability | decision | reason |
|---|---|---|
| carried choices kept across update and reinstall | INTEGRATE | |
| carried choices kept across plugin disable then enable | INTEGRATE | |
| carried choices kept across uninstall then reinstall | INTEGRATE | |
| `disabled` carried | INTEGRATE | |
| `approveTools` carried | INTEGRATE | |
| `includeTools` carried | INTEGRATE | |
| `excludeTools` carried | INTEGRATE | |
| `lifecycle` carried | INTEGRATE | |
| `idleTimeout` carried | INTEGRATE | |
| `requestTimeoutMs` carried | INTEGRATE | |
| `debug` carried | INTEGRATE | |
| `searchKeywords` carried | INTEGRATE | |
| `openUi` carried | INTEGRATE | |
| `trace` carried | INTEGRATE | |
| choice store `_piClaudeMarketplace.serverChoices` (top-level member) | INTEGRATE | |
| `auth: "oauth"` beside `headers` without `Authorization` | INTEGRATE | |
| carried field that the plugin's own entry sets | OPT-OUT | explicitly out of scope: a field the plugin sets belongs to the plugin, so the plugin's value wins (ANAME-07) |
| `directTools` carried | OPT-OUT | explicitly out of scope: owned by this extension and written on every stage (AFILE-06, ANAME-04) |
| `toolPrefix` carried | OPT-OUT | explicitly out of scope: owned by this extension and written on every stage (AFILE-06, ANAME-01) |
| `description` carried | OPT-OUT | explicitly out of scope: owned by this extension and written on every stage (AFILE-06) |
| `env` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `headers` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `requestHeadersCommand` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `auth` carried | OPT-OUT | explicitly out of scope: an auth field from the plugin's entry; never carried or stored, so no credential setting leaks (AFILE-06, D-08-02) |
| `bearerToken` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `bearerTokenEnv` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `bearerTokenStore` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `oauth` carried | OPT-OUT | explicitly out of scope: a credential-bearing field from the plugin's entry; never carried or stored, so no credential leaks (AFILE-06, D-08-02) |
| `command` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `args` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `socket` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `inheritEnv` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `cwd` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `url` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `caFile` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `exposeResources` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `httpTransport` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `pluginDataDir` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `literalEnv` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `protocolVersion` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| `tasks` carried | OPT-OUT | explicitly out of scope: taken from the plugin's translated entry on every stage (AFILE-06); D-08-01 adds only `openUi` and `trace` |
| choices keyed per project, as Claude Code's `disabledMcpServers` is | OPT-OUT | explicitly out of scope: a Pi capability gap; choices are kept per scope file, a divergence documented in docs/mcp-compatibility.md (D-08-02) |

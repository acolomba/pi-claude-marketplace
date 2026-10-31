---
phase: "03"
slug: "claude-code-tool-names-and-tool-search"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-06"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin manifest -> `mcp-adapter.json` key | An untrusted plugin author's plugin and server names become the adapter's server key | Plugin and server names |
| user settings -> tool names | A user's global `settings.toolPrefix` could rename the plugin's tools | Adapter settings |
| plugin `hooks.json` -> hook dispatch | An untrusted plugin author's matcher text decides which tool calls run its hook | Matcher strings |
| plugin `.mcp.json` / `mcpServers` -> `mcp-adapter.json` entry | An untrusted plugin author's server object becomes a definition pi-mcp-adapter runs and authenticates | Commands, URLs, headers, env, OAuth settings |
| `mcp-adapter.json` entry -> model context | The plugin description becomes model-visible namespace text | Description text |
| plugin server config -> resolver verdict | An untrusted plugin author's server object decides whether the plugin installs, partially installs or is refused | Server objects |
| plugin server names -> adapter server keys | Names can be chosen to land on another server's key or folded namespace | Server names |
| plugin manifest -> `info` output | Author-controlled plugin and server names are printed on the info surface | Names |
| plugin agent frontmatter -> pi-subagents tool grants | An untrusted plugin author's `tools:` and `disallowedTools:` decide which MCP tools a generated agent may call | Tool names |
| user override stub -> plugin entry marker | Values the user wrote are kept inside the marker and written back later | Override fields; only field names in `pluginSetFields` |
| documentation -> user settings | Users follow the docs to change their own Pi settings | Setting names |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-SC (03-01..09) | Tampering | npm/pip/cargo installs | low | accept | These plans install no package | closed |
| T-03-01 | Spoofing | `generatedMcpServerKey` (lossy normalization) | medium | mitigate | The collision walk in `bridges/mcp/stage.ts` compares generated keys and refuses a cross-plugin clash with `McpServerCollisionError`; T-03-13 adds the same-plugin and folded checks | closed |
| T-03-02 | Tampering | `adapter-entry.ts` owned fields | low | mitigate | `translateMcpServer` writes `directTools` and `toolPrefix: "mcp"` on every entry (`domain/mcp-server-features.ts`); ANAME-01 and ANAME-04 cases in `adapter-entry.test.ts` assert that a plugin value never survives | closed |
| T-03-03 | Repudiation | `cascadeUnstagePlugin` record fold | low | mitigate | `orchestrators/marketplace/shared.ts` maps each removed key back to its declared name, under the generated or the declared key (TR-03); ANAME-01 case in `shared.test.ts` | closed |
| T-03-04 | Denial of service | `parseMatcher` prefix form | medium | mitigate | `domain/components/hooks/matcher.ts` uses `startsWith`, `endsWith`, `slice` and the fixed `MCP_SEGMENT` pattern; it builds no `RegExp` from matcher text | closed |
| T-03-05 | Elevation of privilege | adapter `mcp` proxy calls | medium | accept | Pi capability gap, documented in `docs/hooks-compatibility.md`; see AR-03-01 | closed |
| T-03-06 | Information disclosure | `translateMcpServer` | high | mitigate | Closed table: `auth`, `bearerToken`, `bearerTokenEnv`, `bearerTokenStore` and every other adapter key are never read (they appear only in comments); the sse hostile-input row in `mcp-server-features.test.ts` asserts the exact entry | closed |
| T-03-07 | Elevation of privilege | `translateMcpServer` | high | mitigate | `approveTools`, `requestHeadersCommand`, `inheritEnv`, `cwd`, `socket`, `caFile` and `lifecycle` are never copied; the same hostile-input row drops `approveTools`, `requestHeadersCommand`, `cwd` and `lifecycle` | closed |
| T-03-08 | Spoofing | `translateMcpServer` oauth | medium | mitigate | The OAuth mapping keeps only `clientId`, `callbackPort` (written as `http://localhost:<port>/callback`), an `https://` `authServerMetadataUrl` and `scopes`; the hostile-input row drops `clientSecret`, `skipIssuerMetadataValidation` and a plugin `redirectUri` | closed |
| T-03-09 | Tampering | description in the deferred namespace | low | accept | Same exposure class as Claude Code's server instructions; see AR-03-02 | closed |
| T-03-10 | Elevation of privilege | `classifyMcpServer` blocked features | high | mitigate | `ws`, `headersHelper`, `oauth.xaa`, `tools[].permission_policy`, `toolPermissions` and `bareElicitationCapability` give a `blocked` verdict, so the plugin is `partially-available` with `{unsupported mcp}`; a normal install refuses and `--partial` leaves the server out; `^ANAME-07` install-flow cases | closed |
| T-03-11 | Tampering | `classifyMcpServer` schemas | medium | mitigate | A config that Claude Code's schema rejects gets a `malformed` verdict, and `domain/mcp-resolution.ts` makes the plugin `unavailable` with `{malformed mcp}`; classifier rows in `mcp-server-features.test.ts` | closed |
| T-03-12 | Denial of service | over-long tool names | low | accept | Measured: Pi and the adapter accept any length; the 64 and 128 character provider limits are documented in `docs/mcp-compatibility.md` (D-03-17); see AR-03-03 | closed |
| T-03-13 | Spoofing | `stage.ts` collision walk | medium | mitigate | A normalized or folded clash refuses before any write: `McpServerKeyCollisionError` within a plugin, `McpServerCollisionError` with `definedAs` across all nine sources; `^ANAME-03` install-outcome case and `stage.test.ts` | closed |
| T-03-14 | Spoofing | info display names | low | accept | No new channel; the `plugin:<plugin>:` prefix ties each name to its plugin; see AR-03-04 | closed |
| T-03-15 | Elevation of privilege | `convert.ts` grant table | medium | mitigate | Only servers this install writes are granted; `convert.test.ts` drops another plugin's, a user's and an unwritten server's names, and `install-outcome.test.ts` asserts a server left out by `--partial` is not granted | closed |
| T-03-16 | Tampering | `convert.ts` disallow handling | medium | mitigate | A disallow removes the grant, becomes `excludeTools`, or warns that it cannot narrow a whole-server grant; four ANAME-02 disallow cases in `convert.test.ts` | closed |
| T-03-17 | Information disclosure | marker `pluginSetFields` | low | mitigate | `bridges/mcp/marker.ts` keeps `pluginSetFields` only as a string array of field names; the values stay in the entry or the inert kept stub; marker cases | closed |
| T-03-18 | Tampering | carry-forward and write-back | low | mitigate | `adapter-entry.ts` excludes the previous marker's plugin-set names from the carried values, and write-back restores the user's own stub value; `update-flow.test.ts` and `mcp-override-lifecycle.test.ts` cases | closed |
| T-03-19 | Tampering | `docs/mcp-compatibility.md` tool search section | low | mitigate | The doc names `"defaultTools": ["+tool_search"]` as the user's own setting and states "This extension never edits Pi settings files." (NFR-10) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-05 | A call through pi-mcp-adapter's `mcp` proxy reaches hooks as tool `mcp`, so a plugin's MCP matchers and `if` predicates do not fire for it. Pi reports the proxy's name, not the called tool's (a Pi capability gap). The adapter's approval broker is a later fix outside this milestone | operator (plan approval) | 2026-10-06 |
| AR-03-02 | T-03-09 | The plugin's server description is written verbatim into model-visible namespace text, the same exposure class as Claude Code's server instructions | operator (plan approval) | 2026-10-06 |
| AR-03-03 | T-03-12 | Pi and pi-mcp-adapter accept tool names of any length (measured 2026-10-06); a provider may reject a name over 64 or 128 characters. The limits are documented and no install-time check exists (D-03-17) | operator (plan approval) | 2026-10-06 |
| AR-03-04 | T-03-14 | Server names were already printed verbatim on `info`; the `plugin:<plugin>:` prefix makes a look-alike name from another plugin easier to spot | operator (plan approval) | 2026-10-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-06 | 20 | 20 | 0 | secure-phase orchestrator (L1 grep evidence; auditor skipped by the ASVS 1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-06

---
phase: "6"
slug: "mcp-servers"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| feature doc string -> published plugin files | A scenario's JSON is expanded and written into the published fixture (06-01) | Scenario-authored JSON (`.mcp.json`, `plugin.json`, marketplace entry `mcpServers`), written under the published root |
| profile Pi -> harness logs | The stub and the scripted model log into the sandbox harness directory that the steps read (06-01) | Stub JSON-RPC requests, model call logs, pid files |
| profile Pi -> loopback HTTP stand-in | pi-mcp-adapter's HTTP client sends the plugin's headers to a socket the worker opened (06-02) | HTTP requests with fixture headers (`Authorization: Bearer t0k3n`, `X-Team: core`) and JSON-RPC bodies |
| plugin `.mcp.json` -> adapter env and headers | Fixture values flow through the bridge's install-time rewrite into a server process or request (06-02) | `env`, `headers`, `url`, `command`, `args` values with `${NAME}` expansions |
| plugin author -> resolver | `.mcp.json`, `plugin.json`, referenced files, and the marketplace entry are untrusted JSON; a bad file source is skipped, and an inline defect refuses the plugin (06-03, 06-07) | Untrusted server maps, reference strings, bundle paths |
| resolver -> filesystem | A reference string chooses a path the resolver reads; containment decides before any read (06-03, 06-07) | Relative or absolute path strings, symlinks under the plugin root |
| plugin agent -> pi-subagents child | A plugin's agent frontmatter decides which tools a child may use (06-04) | `tools:` selectors such as `mcp__plugin_demo_stub__echo` |
| project plugin -> pi-mcp-adapter trust gate | A project-scope plugin's server runs only if the adapter's trust and approval rules admit it (06-05) | Project `mcp-adapter.json` entries, Pi project trust, `settings.projectServers` |
| plugin verbs -> user's `mcp-adapter.json` entries | Install, update, disable, and uninstall rewrite entries that also hold the user's own fields (06-06) | Generated server entries plus user fields such as `disabled: true` |
| doc -> user | Users configure servers, trust, and overrides from what `docs/mcp-compatibility.md` says (06-08) | Compatibility claims about pi-mcp-adapter 7.0.0 on Pi 1.4.0 |
| phase -> public tracker | The pi-subagents gap report is text for the user to file (06-09) | Draft issue text in `06-09-SUMMARY.md` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Tampering | `publishStubServersFile`, `setPublishedEntryMcpServers`, `removePublishedPluginManifest` writing outside the publication | medium | mitigate | `features/lib/published-marketplace.ts` `ownedTarget` through `writePublishedPluginFiles`; `rewritePublishedManifest` writes the recorded manifest path; `features/lib/mcp-server-files.ts` `removePublishedPluginManifest` refuses git and hosted publications and paths outside the root | closed |
| T-06-02 | Information disclosure | Steps reading the stub log and the model call log | low | accept | Logs live in `<sandbox home>/harness`, which the next scenario's `Before()` empties (HAR-05, `features/support/pi-process.ts`) | closed |
| T-06-03 | Denial of service | The listing wait polling for a server that never lists | low | mitigate | `features/step_definitions/mcp-server/listing.steps.ts` `TOOL_LISTING_TIMEOUT_MS = 15_000`, failing with the seen requests; `configuration.steps.ts` `HTTP_LISTING_TIMEOUT_MS = 15_000` | closed |
| T-06-04 | Tampering | `mcp-server-http.ts` reachable from another host | medium | mitigate | `features/lib/mcp-server-http.ts` `McpHttpServer.start`: `listen({ port: 0, host: "127.0.0.1" })` only | closed |
| T-06-05 | Information disclosure | Header values written to the harness log | low | accept | Only fixture values (`Bearer t0k3n`, `core`) are logged, inside the per-scenario sandbox (HAR-05) | closed |
| T-06-06 | Denial of service | A stand-in left listening after a failed scenario | low | mitigate | `configuration.steps.ts` registers `http.close()` before Pi starts; `features/support/world.ts` `release()` runs in reverse order and continues after errors; `After` calls it in `finally` | closed |
| T-06-07 | Information disclosure | A reference that is absolute, uses `..`, or crosses a symlink out of the plugin root | high | mitigate | `domain/mcp-resolution.ts` `locateReference` -> `resolveContainedComponentPath` -> `assertPathInside` before any read; the refusal is a fatal note (`plugin-resolver.ts` `decideResolution` -> `unavailable`); unit cases "rejects an absolute/traversing string reference without reading it" and "rejects a string reference that crosses a symlink without reading it" | closed |
| T-06-08 | Tampering | A server named `__proto__` during the merge | medium | mitigate | `mcp-resolution.ts` `Map` accumulator plus `Object.fromEntries` in `recordMergedServers`; unit case "ANAME-07: keeps a server named __proto__ as an own server" | closed |
| T-06-09 | Elevation of privilege | An `.mcpb`/`.dxt` bundle a plugin ships | medium | mitigate | `mcp-resolution.ts` `isMcpBundle`: never read, `mcpServers` unsupported; unit case "marks the bundle reference ... unsupported without reading it"; scenario `sources.feature` "An .mcpb bundle source makes the plugin partially available" (normal install refused) | closed |
| T-06-10 | Elevation of privilege | A foreground child reaching a plugin MCP tool its agent was not meant to have | low | mitigate | `features/mcp-server/invocation.feature` "A foreground agent without a tools list runs without the plugin's MCP tools" and "A foreground run of an agent granted a plugin MCP tool is refused before the child runs" | closed |
| T-06-11 | Repudiation | A pi-subagents release silently changing the foreground behavior | low | mitigate | Both D-CF6-10 scenarios compare whole results (`model.steps.ts` "the model receives these calls", `listing.steps.ts` "the model calls are offered these tools" and "receives these messages", all `deepStrictEqual`) | closed |
| T-06-12 | Elevation of privilege | A project-scope plugin server running in an untrusted project or without approval | high | mitigate | `features/mcp-server/project-scope.feature` headless-blocked and untrusted-project scenarios with exact blocked texts and "no stub mcp server receives a message"; no `mcp-project-approvals` write anywhere in `extensions/` (NFR-10, D-CF6-03) | closed |
| T-06-13 | Tampering | The user-global allow setting written by a Given | low | accept | Sandbox fixture written before the profile Pi starts and removed by a release (`mcp-configuration.steps.ts` "pi-mcp-adapter allows project mcp servers for the user") | closed |
| T-06-14 | Tampering | A plugin verb dropping the user's `disabled: true` | medium | mitigate | `features/mcp-server/lifecycle.feature`: the disabled choice survives an update, a disable then enable, and an uninstall then install; D-08-02 choice store in `bridges/mcp/adapter-doc.ts` | closed |
| T-06-15 | Elevation of privilege | A disabled or uninstalled plugin's server still reachable from the model | medium | mitigate | `lifecycle.feature` disable and uninstall scenarios: `not found`, `MCP: 0/0 servers, 0 tools`, empty stub log | closed |
| T-06-16 | Information disclosure | A skipped-file path that escapes the plugin root | high | mitigate | `mcp-resolution.ts` `readReferencedMcp`: containment before any read, a refusal stays fatal, and the `unreachable` skip reads nothing; unit cases (absolute, traversing, symlink, ENOTDIR); scenario `invalid-configs.feature` "A server reference outside the plugin root makes the plugin unavailable" | closed |
| T-06-17 | Repudiation | A server dropped with no message | low | accept | Upstream parity (D-CF6-02); `docs/mcp-compatibility.md` "Invalid server configs" states the rule; env-gated `hookDebugLog(..., "mcp")` (`PI_CLAUDE_MARKETPLACE_DEBUG=1`) | closed |
| T-06-18 | Denial of service | An unreadable MCP file that used to fail the whole install | low | accept | Contributes no server, as upstream; Outline row `readable by nobody` in `invalid-configs.feature` | closed |
| T-06-19 | Repudiation | A doc row that claims a behavior nobody measured on 7.0.0 | medium | mitigate | `docs/mcp-compatibility.md` rows cite a scenario, the 2026-11-01 run, or the 7.0.0 source; `06-08-SUMMARY.md` "Per-row account of the FG-30 checklist" | closed |
| T-06-20 | Tampering | A gate fix weakening a test or a scenario to pass | medium | mitigate | Bug policy in 06-09 Task 1; `git diff eb31ac7..HEAD -- test features extensions` is empty (no test, scenario, or source change) | closed |
| T-06-21 | Repudiation | Posting the pi-subagents report on the user's behalf | low | mitigate | `06-09-SUMMARY.md` "pi-subagents gap report (D-CF6-10, drafted, not filed)" | closed |
| T-06-SC | Tampering | Package installs (all nine plans) | low | accept | No plan installs a package; `package.json` and `package-lock.json` are unchanged across the phase | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Observation (outside the register):** `<pluginRoot>/.mcp.json` itself is read through `stat` and `readFile`, which follow symlinks, with no containment check (`mcp-resolution.ts`, `plugin-resolver.ts`). This predates Phase 6; T-06-07 covers reference strings only. It is a candidate row for a future threat model.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-02 | The stub log and the model call log live in the per-scenario sandbox harness directory, which the next scenario's `Before()` empties (HAR-05); no real home directory or network is read | plan threat model (Phase 6 planner) | 2026-11-01 |
| AR-06-02 | T-06-05 | Only fixture header values (`Bearer t0k3n`, `core`) are logged, inside the per-scenario sandbox that the next `Before()` empties (HAR-05) | plan threat model (Phase 6 planner) | 2026-11-01 |
| AR-06-03 | T-06-13 | The user-global allow setting is a sandbox fixture written before the profile Pi starts and released with the scenario (frozen step) | plan threat model (Phase 6 planner) | 2026-11-01 |
| AR-06-04 | T-06-17 | Upstream parity (D-CF6-02): Claude Code's loader drops a bad file source silently; `docs/mcp-compatibility.md` states the rule, and an env-gated debug line records each skip | plan threat model (Phase 6 planner) | 2026-11-01 |
| AR-06-05 | T-06-18 | An unreadable MCP file now contributes no server, as upstream; the invalid-configs Outline's `readable by nobody` row pins it | plan threat model (Phase 6 planner) | 2026-11-01 |
| AR-06-06 | T-06-SC | No Phase 6 plan installs a package; the scratch probes use only the peer cache that `scripts/install-test-peers.mjs` fills at its declared floors | plan threat model (Phase 6 planner) | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 22 | 22 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed

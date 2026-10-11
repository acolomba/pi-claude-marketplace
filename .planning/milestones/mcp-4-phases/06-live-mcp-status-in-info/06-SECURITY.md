---
phase: "6"
slug: "live-mcp-status-in-info"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-09"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (06-01..06-03 `<threat_model>` blocks); mitigations verified by
> gsd-security-auditor at ASVS L1, block_on high, 2026-10-09. T-06-SC appears in all three plans
> and is counted once. Paths are relative to the repo root; `ext/` = `extensions/pi-claude-marketplace/`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Pi event bus → status tracker | Any extension in the same Pi process can publish on `pi-mcp-adapter/status/v1` | server names and status strings (untrusted, display-only) |
| Status tracker → info output | Only closed `McpServerStatus` tokens may cross | closed token set |
| Project `state.json` → user-scope info | Read-only, `persistMigration: false` | install records (local, user-owned) |
| `PI_MCP_ADAPTER_ROOT` → test process | Tests import the adapter's `dist/types.js` | third-party constants module (test-only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Spoofing | `createMcpStatusTracker` | medium | accept | Display-only state: never persisted, never sets severity (`ext/orchestrators/plugin/info-mcp-status.ts:107-131`, `ext/shared/notification-grammar.ts:1403`); catalog says "last reported" (`docs/output-catalog.md:2592`) | closed |
| T-06-02 | Tampering | `withMcpServerStatus`, `mcpEntryText` | high | mitigate | Names used only as Map keys, statuses checked against a closed record, tokens from a closed map (`ext/platform/mcp-status.ts:44-56,79,108`; `ext/orchestrators/plugin/info-mcp-status.ts:36-56,89-94`); tests `tests/platform/mcp-status.test.ts:154-175`, `tests/orchestrators/plugin/info.test.ts:7550` | closed |
| T-06-03 | Denial of service | tracker handler | medium | mitigate | Compiled boolean `Check`, `try`/`catch` in the handler (`ext/platform/mcp-status.ts:33-38,75,89-96`); tests `tests/platform/mcp-status.test.ts:124-151,235-252` | closed |
| T-06-04 | Information disclosure | tracker | low | mitigate | Schema reads only `version`, `servers[].name`, `servers[].status` (`ext/platform/mcp-status.ts:33-38,79,88`) | closed |
| T-06-05 | Elevation of privilege | factory, info | medium | mitigate | No adapter import, no `.emit(` under `ext/`; `on`-only `PiEventSource` (`ext/platform/pi-api.ts:169-171`); strict bus mock (`tests/index.test.ts:277-283,432`) | closed |
| T-06-06 | Repudiation | tracker lifetime | low | mitigate | Each payload replaces `latest`; one tracker per load (`ext/platform/mcp-status.ts:89-96`, `ext/index.ts:77`); tests `tests/platform/mcp-status.test.ts:177-215`, `tests/index.test.ts:1052` | closed |
| T-06-07 | Tampering | `readProjectInstallRecord` | medium | mitigate | `persistMigration: false` (`ext/orchestrators/plugin/info.ts:3024-3026`, `ext/persistence/state-io.ts:526`); test `tests/orchestrators/plugin/info.test.ts:7387` | closed |
| T-06-08 | Denial of service | `readProjectInstallRecord` | medium | mitigate | `try`/`catch` → not overridden; read once (`ext/orchestrators/plugin/info.ts:3023-3033,3091,3118,3158`); test `info.test.ts:7387` | closed |
| T-06-09 | Spoofing | shadow attribution | low | accept | Display-only; config-mode imprecision documented (`docs/output-catalog.md:3052`) | closed |
| T-06-10 | Tampering | `loadPiMcpAdapterModule(peer, "types")` | low | accept | Root validated by name and peer range (`tests/integration/optional-peer.ts:48-62`); CI installs the 5.1.0 pin with `--ignore-scripts` (`.github/workflows/ci.yml:121`) | closed |
| T-06-11 | Tampering | status contract drift | low | mitigate | Drift guard on `dist/types.d.ts` (`tests/integration/mcp-status-conformance.test.ts:188-213`); runs in CI (`.github/workflows/ci.yml:120-126`) | closed |
| T-06-SC | Tampering | package installs | low | accept | No package, lockfile or workflow change in the phase (`git diff ec66f204..HEAD -- package.json package-lock.json .github/` empty) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-01 | Pi's bus carries no sender identity, so a forged snapshot can make info show a wrong state. The state is display-only: never persisted, never decides severity, never triggers an action; the catalog says info shows what the adapter last reported. | plan-time disposition (06-01), verified by gsd-security-auditor | 2026-10-09 |
| AR-06-02 | T-06-09 | Exclusive config mode, `--mcp-config`, or a hand-edited cross-marketplace pair with the same key can make the user row read `overridden by project scope` wrongly. Display-only; the catalog documents the config-mode case. | plan-time disposition (06-02), verified by gsd-security-auditor | 2026-10-09 |
| AR-06-03 | T-06-10 | The conformance test imports the adapter's constants module in place; the root is validated and CI installs the pinned 5.1.0 with `--ignore-scripts`. Same exposure as the AVAR-03 conformance test. | plan-time disposition (06-03), verified by gsd-security-auditor | 2026-10-09 |
| AR-06-04 | T-06-SC | No package was installed in this phase; the scratch and CI adapter installs already existed. | plan-time disposition, verified by gsd-security-auditor | 2026-10-09 |

---

## Auditor Observations (not counted)

- **Getter swap after validation** (L2/L3 depth, T-06-01 actor): `readSnapshot` validates, then re-reads `server.name`/`server.status` (`ext/platform/mcp-status.ts:75,79`). A getter payload can pass the check, then return an object whose `toString` yields `constructor`, so `RUNTIME_STATUS_TOKENS[answer]` (`ext/orchestrators/plugin/info-mcp-status.ts:55`) returns `Object` and the line renders native function text; a throwing `toString` makes `lookup` throw during `/claude:plugin info`. Routed to the phase code review. Suggested fix: copy and `typeof`-check the values in `readSnapshot`, and look tokens up with `Object.hasOwn` or a null-prototype map.
- **No older-schema test** for T-06-07 under `--scope user`; the `state-io.ts:526` guard closes it at L1.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-09 | 12 | 12 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed

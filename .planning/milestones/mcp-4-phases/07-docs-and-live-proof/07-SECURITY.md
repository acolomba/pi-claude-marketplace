---
phase: "7"
slug: "docs-and-live-proof"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-09"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register was authored at plan time in the `<threat_model>` blocks of 07-01..07-05. The
> orchestrator verified the mitigations at ASVS L1, block_on high, on 2026-10-09, by L1 grep
> plus each plan's acceptance evidence (no auditor spawn: threats_open 0, register authored at
> plan time, L1). T-07-SC appears in all five plans and is counted once, with the strictest
> disposition.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → developer machine | The adapter 5.2.0 and 0.19.2 scratch installs come from the registry | third-party package code (integrity-checked) |
| package.json → users | The published peer range decides which adapter releases users run | version range |
| canary → Pi child processes | Real Pi sessions load three extensions and spawn MCP servers | allowlisted env, sandbox paths |
| Pi → stub | Model requests go to a loopback stub | prompts, tool calls (no keys) |
| canary → repository | The capture fixture and the README transcript become committed files | sanitized paths |
| docs → users | Users act on credential, approval and adapter-version guidance | guidance text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Tampering | 5.2.0 scratch read by the re-check and the conformance suites | medium | mitigate | Registry integrity and publisher checked before use (07-01 SUMMARY); `--ignore-scripts`; read-only comparison | closed |
| T-07-02 | Information disclosure | peer range admitting the SDK of GHSA-6qxp-vccf-f47h | high | mitigate | `package.json:61` `">=5.2.0 <6"`; `peer-floor.test.ts` gate; CI installs `pi-mcp-adapter@5.2.0`; a 5.1.0 root is refused by the peer loader | closed |
| T-07-03 | Tampering | regenerated package-lock.json | medium | mitigate | `--package-lock-only --ignore-scripts`; numstat `1 1` (07-01 SUMMARY) | closed |
| T-07-04 | Elevation of privilege | `-e builtin:tool-search` in scripts/pi.sh | low | accept | Lock-pinned builtin; `tool_search` stays off until the user's settings add it | closed |
| T-07-05 | Tampering | Pi children writing into the real `~/.pi/agent` | high | mitigate | `mcp-adapter-canary.mjs`: allowlisted env, HOME and PI_CODING_AGENT_DIR inside a realpath'd `mkdtemp` sandbox, removed in `finally` | closed |
| T-07-06 | Information disclosure | a provider key reaching the stub or a provider | high | mitigate | Allowlisted env; `PI_OFFLINE` and `--offline`; stub binds `127.0.0.1`, `apiKey: "stub"`, headers never logged | closed |
| T-07-07 | Information disclosure | committed fixture holding developer paths | medium | mitigate | Fixture uses `@@SANDBOX@@`; grep finds no home path in `legacy-v0.19.2.json` | closed |
| T-07-08 | Denial of service | orphaned Pi, stub or MCP server processes | low | mitigate | Detached process groups killed on close; 07-02 verify found no leftover process | closed |
| T-07-09 | Elevation of privilege | third-party code (adapter, 0.19.2) in the sandbox | medium | mitigate | Operator-named exact versions, integrity-checked, `--ignore-scripts`, sandboxed HOME with no credentials | closed |
| T-07-10 | Repudiation | a canary PASS for something not observed | medium | mitigate | Every assertion reads a live observable; `--invert` control exits 2 at A3 (07-02, 07-04) | closed |
| T-07-11 | Information disclosure | CHANGELOG advisory and redirect text | medium | mitigate | Restates pi-mcp-adapter 5.2.0's own Security entry; GHSA ID present once | closed |
| T-07-12 | Information disclosure | env-vars.md credential guidance | medium | mitigate | States that stdio servers inherit Pi's environment; no over-claim (07-03 SUMMARY) | closed |
| T-07-13 | Tampering | extra `--no-extensions` probe sessions | low | accept | Same sandbox and allowlisted env; result recorded, never asserted | closed |
| T-07-14 | Information disclosure | README transcript | low | accept | Canary prints `<sandbox>` and no header, key or env value | closed |
| T-07-15 | Repudiation | a recorded PASS no run produced | medium | mitigate | Every log line is in the README verbatim; canary sha256 unchanged after the final runs (07-04 SUMMARY) | closed |
| T-07-16 | Elevation of privilege | docs about project-server approval | medium | mitigate | `docs/mcp-compatibility.md` never mentions `projectServers` and never tells users to edit approval files; states the extension never writes them | closed |
| T-07-17 | Denial of service | users unaware an adapter setting drops plugin servers | low | mitigate | Adapter-settings section and divergence bullet name each setting and say no warning is given | closed |
| T-07-18 | Information disclosure | advisory and redirect text in the MCP docs | medium | mitigate | Floor paragraph restates the adapter's Security entry only | closed |
| T-07-SC | Tampering | npm installs | high | mitigate | No package enters package.json or the lock beyond the metadata-only range change; scratch installs are the operator-named versions (D-07-03/04/07), integrity-checked, `--ignore-scripts` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-04 | A lock-pinned Pi builtin that only provides `tool_search`, off until the user's settings enable it | plan 07-01 | 2026-10-09 |
| AR-07-02 | T-07-13 | Probe sessions share the canary's sandbox and allowlisted env; observations only | plan 07-04 | 2026-10-09 |
| AR-07-03 | T-07-14 | Transcript prints no secrets; the repository path is already in earlier canary records | plan 07-04 | 2026-10-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-09 | 19 | 19 | 0 | orchestrator (L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-09

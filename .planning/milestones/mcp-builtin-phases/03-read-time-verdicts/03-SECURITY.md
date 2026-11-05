---
phase: "3"
slug: "read-time-verdicts"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-04"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `state.json` record to read surfaces | `list`, `info`, `pending`, and completions read a record's stored verdict and recorded MCP configs | plugin records (local, user-writable) |
| Cached marketplace clone to legacy re-resolve | a legacy record re-resolves offline from its recorded source | plugin manifests and MCP configs (third-party content) |
| Command to state writers | install, update, enable, apply, and AMIG-01 write the neutral verdict and basis under the state lock | plugin records |
| User's Pi settings | the extension must never write `settings.json` (D-MB-01) | Pi configuration |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Information Disclosure | `readRecordMcpVerdict` legacy re-resolve on `list` | medium | mitigate | offline reader pinned to `record.resolvedSource` (`recorded-servers.ts:110-128`); ESLint BLOCK F applies (not a NETWORK_SEAM) | closed |
| T-03-02 | Tampering | hand-edited `compatibilityBasis` | low | accept | blocks recompute from recorded configs; a neutral stored `mcpServers` only adds a block | closed |
| T-03-03 | Denial of Service | `list` re-resolving every legacy record | low | mitigate | no-trace guard with no I/O for basis-less records (`mcp-verdict-read.ts:41-52`) | closed |
| T-03-04 | Repudiation | emit site keeping the old boolean | low | mitigate | `declaresMcp: McpDependency \| false` makes the compiler list every site | closed |
| T-03-05 | Denial of Service | import cycle through frozen `recorded-servers.ts` | low | mitigate | pure `mcp-verdict.ts`; fallow cycle run green | closed |
| T-03-06 | Information Disclosure | info server lines reaching network or state | medium | mitigate | reads only through `readRecordMcpVerdict`/`resolutionFor`; BLOCK F green | closed |
| T-03-07 | Spoofing | left-out server shown with a runtime status | low | mitigate | `unsupportedFeature` entries skip status stamping | closed |
| T-03-08 | Tampering | git fixture helper writing outside its repo | low | mitigate | `mcp-verdict-git.ts:31-34` refuses empty, `..`, absolute paths | closed |
| T-03-09 | Tampering | user's Pi `settings.json` | high | mitigate | no production write path; exact-text settings step in no-implementation scenarios | closed |
| T-03-10 | Spoofing | marker naming an implementation that cannot run the server | medium | mitigate | one lookup table, 12 pinned cells (`soft-dep.ts:133-163`) | closed |
| T-03-11 | Elevation of Privilege | install degrading without consent | medium | mitigate | required `consentView`; gate on the active view | closed |
| T-03-12 | Denial of Service | enable or promotion refusing after a switch | medium | mitigate | record-driven sites pass `"none"` and the stored installable | closed |
| T-03-13 | Elevation of Privilege | update degrading without consent | medium | mitigate | required `mcpImplementation`; baseline port only for dependency moves, MCP-only drops | closed |
| T-03-14 | Tampering | verdict saved without its basis, or the reverse | medium | mitigate | `replaceCompatibility` then basis at every writer | closed |
| T-03-15 | Elevation of Privilege | apply moving to a version that newly drops a kind | medium | mitigate | convergence consent on newly dropped kinds; WR-04 readable adapter baseline | closed |
| T-03-16 | Tampering | AMIG-01 writing an adapter verdict into a neutral record | medium | mitigate | `none` view from the recorded version's servers, or no write (WR-05) | closed |
| T-03-17 | Spoofing | `requires:` line disagreeing with the marker | low | mitigate | marker and entry share `mcpRequirement` | closed |
| T-03-18 | Information Disclosure | record-only rows reading a legacy record's source | low | mitigate | reuses the one offline read; no network | closed |
| T-03-19 | Tampering | milestone merge dropping a sibling's change | medium | mitigate | two-parent merge 7d4246c; bridges diff against d1711fd empty | closed |
| T-03-20 | Repudiation | history rewritten | low | mitigate | merges only; no rebase, amend, or reset | closed |
| T-03-SC | Tampering | npm installs | low | mitigate | `package.json`/lockfile unchanged in the phase | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Auditor observation (not a Phase 3 regression): the frozen legacy reader's git-source root callback returns `record.resolvedSource` without a containment check against `plugin-clones/`; only classification output reaches a row. Recorded for the parent as a possible Phase 6 hardening.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-02 | A hand-edited `compatibilityBasis` cannot hide an MCP block: effective reads recompute from recorded configs under every implementation. Editing `state.json` already requires write access to the user's home. | gsd-security-auditor (orchestrator, autonomous run) | 2026-11-04 |
| AR-03-02 | (review WR-03) | `pending` previews `(will partially install)` for a declared plugin that `apply` refuses; it fails closed (no consent bypass) and predates Phase 3 for every kind. BACKLOG parent line proposed (P3-DC-122). | orchestrator (autonomous run) | 2026-11-04 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-04 | 21 | 21 | 0 | gsd-security-auditor (ASVS L1, block_on high), HEAD fa63979 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-04

---
phase: 92
slug: mcp-staging-parity
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-03
---

# Phase 92 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin manifest → written `mcp.json` | Plugin-controlled server entries (names, commands, args, env, nested values) are substituted/injected at stage time and written into the user's scoped `mcp.json`. | Install paths (pluginRoot/pluginData/project cwd), plugin-declared strings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-92-01 | Tampering | substituteLeaf / write target | high | mitigate | Substitution writes into JSON VALUE slots only; `mcpJsonPath` is a hard-coded suffix on `scopeRoot` (NFR-10); `pluginData` containment-checked upstream. Verified by review + tests. | closed |
| T-92-02 | Tampering | substituteLeaf re-expansion | high | mitigate | Single-pass alternation regex with function replacer; output never re-scanned; unknown tokens pass through. Empirically verified in review (incl. `lastIndex` safety). | closed |
| T-92-03 | Tampering | `_piClaudeMarketplace` marker | medium | mitigate | Marker stamped AFTER the walk from `buildMarker`; keys never substituted. Tested. | closed |
| T-92-04 | Tampering | theirs partition isolation | high | mitigate | `substituteAndInject` runs only on the plugin's own `servers`; `theirs` merged verbatim. Tested (incl. re-stage deep-equal). | closed |
| T-92-05 | Tampering | injection targeting (url-type) | medium | mitigate | Injection gated on `typeof entry.command === "string"`; url/http/sse entries never gain a synthesized env. Tested. | closed |
| T-92-06 | Information disclosure | user-scope CLAUDE_PROJECT_DIR | medium | mitigate | User scope omits the map key entirely — token passes through, no env key injected. Tested. | closed |
| T-92-07 | Tampering | stale-path re-derivation | high | mitigate | Re-stage substitutes resolver SOURCE servers (placeholders intact), never a read-back of `mcp.json`. No-stale-substring test green. | closed |
| T-92-08 | Tampering | theirs isolation on re-stage | high | mitigate | `theirs` merged verbatim on every re-stage. Tested. | closed |
| T-92-09 | Tampering | `__proto__` key sinks (post-plan review finding WR-01) | medium | mitigate | All four parsed-key assignment sinks (`deepSubstitute`, `partitionExistingServers`, `stampServers`, `unstage.ts::kept`) route through `bridges/mcp/safe-set.ts::safeSet`; regression tests assert literal `__proto__` names/keys survive verbatim and `Object.prototype` is never polluted (commits 5a408484, 35ba7cc7, 022b782d). | closed |
| T-92-SC | Tampering | npm/pip/cargo installs | low | accept | No package installs in scope — pure in-repo TypeScript (both plans). See Accepted Risks Log. | closed |

*Status: open · closed*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-92-01 | T-92-SC | No package-manager installs occur in this phase (pure in-repo TypeScript, no new dependencies); the Package Legitimacy Gate has nothing to check. | plan-time register (92-01/92-02 threat models), confirmed at audit | 2026-08-03 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-03 | 10 | 10 | 0 | secure-phase short-circuit (plan-time register, ASVS L1, threats_open 0; T-92-09 added from the code-review fix chain) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03

---
phase: 93
slug: substitution-completion
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-03
---

# Phase 93 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin author → materialized skill/command/agent content | Plugin-supplied files carry `${CLAUDE_*}` tokens; substitution values (pluginRoot, pluginData, skillDir, projectDir) are install-derived paths, one of which (projectDir = install cwd) is user/project-controlled | file content (paths inserted verbatim) |
| orchestrator → stage inputs | cwd flows from install/reinstall/update contexts; a dropped thread silently disables projectDir for that path | install cwd (optional field) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-93-01 | Tampering | substituteClaudeVars | medium | mitigate | Single-pass alternation replacer; matched values inserted verbatim, output never re-scanned — a value embedding a `${CLAUDE_*}` literal cannot re-expand. Property-tested in tests/shared/vars.test.ts; confirmed by code review (0C/0W). | closed |
| T-93-02 | Tampering | substituteClaudeVars / skills stage | medium | mitigate | Replacer returns the matched literal when the mapped field is undefined (`value ?? matched`) — absent skillDir/projectDir never collapses to empty string. Tested in vars + skills stage suites. | closed |
| T-93-03 | Information disclosure / Elevation | skills stage write path | low | accept | Substitution alters file content only; write destinations unchanged and assertPathInside-guarded (NFR-10). No path composed from a substituted value. | closed |
| T-93-04 | Tampering | commands/agents stage | medium | mitigate | Scope-gated projectDir (`locations.scope === "project" ? cwd : undefined`); user-scope and absent-cwd pass through via the helper — no empty-string substitution, no user-scope leak. Per-bridge scope-arm tests green. | closed |
| T-93-05 | Tampering / correctness | orchestrator cwd threading | medium | mitigate | Optional cwd not compiler-enforceable across the nine sites; end-to-end project-scope install test asserts real delivery. Review fix (WR-01, commit 9e0fbc00) extended the guard to reinstall and update orchestrators. | closed |
| T-93-06 | Elevation / containment | stage write paths | low | accept | Substitution alters content only; command/agent write destinations remain assertPathInside-guarded (NFR-10); no path composed from projectDir. | closed |
| T-93-SC | Tampering | package installs | n/a | accept | No npm/pip/cargo installs in this phase — supply-chain row not applicable (phase changed only repo source and test files). | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-93-01 | T-93-03 | Content-only substitution; NFR-10 containment guards all write destinations; no new path composition | plan-time disposition (93-01-PLAN) | 2026-08-03 |
| AR-93-02 | T-93-06 | Same containment argument for commands/agents write paths | plan-time disposition (93-02-PLAN) | 2026-08-03 |
| AR-93-03 | T-93-SC | No package installs in phase scope | plan-time disposition (both plans) | 2026-08-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-03 | 7 | 7 | 0 | secure-phase L1 short-circuit (plan-time register; evidence from phase verifier + 2-iteration code review, both read implementation directly) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03

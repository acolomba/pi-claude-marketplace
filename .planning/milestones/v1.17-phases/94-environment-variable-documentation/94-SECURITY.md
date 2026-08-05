---
phase: 94
slug: environment-variable-documentation
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-03
---

# Phase 94 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| (none new) | Documentation-only phase — no source edits, no installs, no runtime change; the doc DESCRIBES existing boundaries whose threats are registered in 91-SECURITY.md and 92-SECURITY.md (cited, not re-adjudicated) | Markdown content only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-94-01 | Information disclosure | docs/env-vars.md content | low | accept | Doc names pi-only vars (CLAUDE_SESSION_ID, PI_CLAUDE_MARKETPLACE_PATH) and env-injection paths already public in shipped code and prior registers; session id is an internal identifier, not a credential (91-SECURITY AR-91-01). | closed |
| T-94-02 | Tampering (quality risk) | doc accuracy vs shipped code | medium | mitigate | Grep-assertable acceptance criteria per task; every claim verified against read_first sources. Held in practice: the 3-iteration review/fix loop verified cells against bridge sources (and corrected the CLAUDE_ENV_FILE overstatement to honest-partial ⚠), and the phase verifier independently confirmed 10/10 truths including the pi-mcp-adapter claim against the installed package source. | closed |
| T-94-SC | Supply chain | package installs | n/a | accept | No package installs, no dependency changes — pure Markdown edits. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-94-01 | T-94-01 | Named vars/paths already public in shipped code; no secret disclosed | plan-time disposition (94-01-PLAN) | 2026-08-03 |
| AR-94-02 | T-94-SC | No installs in phase scope | plan-time disposition (94-01-PLAN) | 2026-08-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-03 | 3 | 3 | 0 | secure-phase L1 short-circuit (plan-time register; accuracy mitigation evidenced by 3-iteration review + verifier cross-checks) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03

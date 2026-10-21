---
phase: "4"
slug: "marketplace-remove-and-list"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-18"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Command to scoped mutation | Scope and layer selection must authorize exactly one removal target. | Marketplace name, scope, layer, and persisted declarations |
| Cascade to persisted state | Plugin outcomes control which records and staged resources survive. | Plugin records, configs, clones, and staged skills |
| Dependency preflight to mutation | Every blocker must be known before any state change. | Dependency graph and refusal rows |
| Persisted state to new session | Clean removal claims must survive reconciliation. | Marketplace and plugin declarations and skill inventory |
| Scoped records to list output | Scope identity, insertion order, and effective details must remain intact. | Marketplace rows, autoupdate state, and timestamps |
| Internal rows to JSON transport | Machine output must report progress, failures, ordering, and reload need exactly. | Schema-valid notification payloads |
| Test fixture to host environment | Behavioral and integration writes must stay hermetic and offline. | Temporary repositories, configs, clones, and skills |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | Scope and layer selection | high | mitigate | Removal scenarios compare both scopes and reject fallback after project-layer selection. | closed |
| T-04-02 | Information disclosure | Source-kind removal fixtures | high | mitigate | Local variants run offline; URL and GitHub variants remain excluded while `check:features` validates their definitions. | closed |
| T-04-03 | Tampering | Ordinary removal cascade | high | mitigate | Ordered cascade scenarios compare every target child and unrelated surviving declarations. | closed |
| T-04-04 | Tampering | Dependency preflight | high | mitigate | The two-blocker scenario proves complete discovery, no eligible removal, unchanged configs, and retained skills. | closed |
| T-04-05 | Repudiation | Clean removal persistence | medium | mitigate | Separate fresh-session scenarios verify skill, plugin-list, marketplace-list, and declaration absence. | closed |
| T-04-06 | Repudiation | List inventory and scope filter | medium | mitigate | Complete ordered inventories, duplicate scoped names, and empty selected scopes detect dropped or leaked rows. | closed |
| T-04-07 | Tampering | Effective autoupdate and time details | medium | mitigate | List scenarios compare local override precedence, every timestamp window, and complete declarations. | closed |
| T-04-08 | Tampering | Mixed removal state | high | mitigate | Integration coverage compares surviving records, unchanged desired config, retained clone data, and staged skills. | closed |
| T-04-09 | Repudiation | Partial and failure-only JSON result | medium | mitigate | Tests compare whole captured entries, validate the schema, and distinguish row order and reload values. | closed |
| T-04-10 | Tampering | Integration fixture isolation | high | mitigate | Cases use the hermetic project-scope fixture and local Git double with case-owned cleanup. | closed |
| T-04-SC | Tampering | Package dependencies | high | mitigate | The phase changed no dependency file and used the installed dependency set. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-18 | 11 | 11 | 0 | Codex security enforcement |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-18

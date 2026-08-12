---
phase: 96
slug: installation-record-backed-plugin-info
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-09
---

# Phase 96 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `state.json` → orchestrator | Installation records (install-ledger-written, user-editable on disk); `resources.*` names are `assertSafeName`-validated at write time | Component names, versions, slugs |
| materialized `hooks.json` → orchestrator | State-supplied slug composes the read path; `assertPathInside` (realpath-resolving) runs before `readFile` | Filtered hooks config |
| remote `marketplace.json` → arm selection | Manifest load outcome selects the info arm; failed loads never reach the state-only arm | Manifest plugin-name set |
| orchestrator → terminal / LLM payload | Closed-set reasons only; no free-form file content in braces | Row text, typed reasons |

No network on the state-only arm (INFO-12 — structural + zero-call-asserted + gate-enforced). No persistence writes.

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Status |
|-----------|----------|-----------|----------|-------------|--------|
| T-96-01 | Spoofing | component names → rendered lines | low | mitigate (assertSafeName provenance) | closed |
| T-96-02 | Tampering | manifest → arm selection | medium | mitigate (arm (a) first; BOUND-01 regression) | closed |
| T-96-03 | Information disclosure | reason brace composition | low | mitigate (closed ContentReason set + lock test) | closed |
| T-96-04 | Repudiation | severity change error→info | low | accept (documented catalog state) | closed |
| T-96-05 | Denial of service | large resources arrays | low | accept (resident data; copy+sort only) | closed |
| T-96-06 | Information disclosure | hooks path composition | high | mitigate (assertPathInside before readFile; traversal test) | closed |
| T-96-07 | Information disclosure | symlinked hooks.json escape | high | mitigate (realpath resolution at same chokepoint) | closed |
| T-96-08 | Denial of service | malformed hooks.json | medium | mitigate (total parse; D-96-03 degradation matrix pinned) | closed |
| T-96-09 | Tampering | hooks text → rendered line | low | mitigate (validated config; closed-set brace) | closed |
| T-96-10 | Elevation of privilege | unreadable file | low | accept (invoking-user permissions; EACCES → permission denied) | closed |
| T-96-11 | Information disclosure | network under --fetch | high | mitigate (no fetchCtx by signature; 5-counter zero-call suite; NFR-5 gate) | closed |
| T-96-12 | Spoofing | skip note false claim | medium | mitigate (arm-keyed emit; two negative controls) | closed |
| T-96-13 | Repudiation | failure hidden in info cascade | medium | mitigate ((failed) separation unchanged, pinned) | closed |
| T-96-14 | Tampering | skip row brace text | low | mitigate (literal reason; validated record fields) | closed |
| T-96-15 | Denial of service | second notification | low | accept (matches disabled-inventory precedent) | closed |
| T-96-16 | Spoofing | cross-record manifest leak under shared root | medium | mitigate (own-manifest authority pinned in 3 directions) | closed |
| T-96-17 | Information disclosure | foreign description under user header | low | mitigate (description pin asserts absence) | closed |
| T-96-18 | Denial of service | failed manifest suppresses rows | medium | accept (deliberate D-96-02/BOUND-01 contract, catalog-recorded, pinned) | closed |
| T-96-19 | Tampering | prose claiming unenforced rules | low | mitigate (every closure paired with a pin) | closed |
| T-96-SC | Tampering | npm / pip / cargo installs | low | accept (no install tasks; Package Legitimacy Audit: not applicable, 0 [SLOP]/[SUS]) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-96-01 | T-96-04 | Severity change is the intended outcome (no longer a failure); catalog-documented | plan-time register (96-01) | 2026-08-09 |
| R-96-02 | T-96-05 | Data already resident; bounded copy+sort | plan-time register (96-01) | 2026-08-09 |
| R-96-03 | T-96-10 | Canon control; runs with invoking-user permissions | plan-time register (96-02) | 2026-08-09 |
| R-96-04 | T-96-15 | One extra notify on one path; matches precedent | plan-time register (96-03) | 2026-08-09 |
| R-96-05 | T-96-18 | Bare (failed) header instead of partial truth is the settled D-96-02/BOUND-01 contract | plan-time register (96-04) + discuss decision | 2026-08-09 |
| R-96-06 | T-96-SC | No external package installed by this phase | plan-time register (all plans) | 2026-08-09 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-09 | 20 | 20 | 0 | gsd-secure-phase (autonomous, State B short-circuit: plan-time registers, ASVS L1, threats_open 0; high-severity mitigations independently confirmed by the phase verifier and the 3-iteration review loop) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-09

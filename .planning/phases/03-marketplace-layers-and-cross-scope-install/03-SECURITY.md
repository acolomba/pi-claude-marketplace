---
phase: "3"
slug: "marketplace-layers-and-cross-scope-install"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited `extensions/` files for one run each | Source text; never committed |
| Marketplace add → plugin mirror cache | The D-SEED-01 fix decides when a marketplace checkout seeds a plugin mirror | Git trees and clone keys |
| Executor worktrees → shared host | Four parallel executors shared CPUs and caches | Process load |

---

## Threat Register

Each plan registered the same classes for its own files (03-01: T-03-01..05, 03-02: T-03-06..10, 03-03: T-03-11..16, 03-04: T-03-17..22); T-03-SC is shared.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01, -06, -11, -17 | Tampering | deliberate breaks in `extensions/` | high | mitigate | 30 break logs end `restored=clean`; the only non-comment `extensions/` diff since `792d2ef` is the reviewed D-SEED-01 fix | closed |
| T-03-02, -07, -12, -18 | Tampering | break helper working directory | high | mitigate | Helpers rooted at their own worktrees (`root=` in logs); manifest-scoped merge | closed |
| T-03-03, -08, -13, -19 | Repudiation | red-proof records | medium | mitigate | Green baselines first; failure lines matched with scenario counts; the fix's natural red recorded before the fix commit; the verifier read every log | closed |
| T-03-04, -09, -14, -20 | Denial of service | shared host and caches | medium | mitigate | `flock` around heavy checks and limited cucumber parallelism; no executor timed out | closed |
| T-03-05, -10, -16, -22 | Tampering | integration deletions and trim | medium | mitigate | Each deleted case maps to a scenario (verifier, review); `marketplace-layer-remove` keeps its three EACCES cases | closed |
| T-03-15 | Tampering | D-SEED-01 fix (a seed taken from the wrong tree) | high | mitigate | Same-repo match is on the parsed url identity (one shared helper); seed key is the plugin's own `canonicalCloneUrl`, unchanged for every previously seeded url; review iterations 1-2 found no false match (`r.git.git`, `#ref`, non-https rejected); unit and scenario rows | closed |
| T-03-21 | Tampering | MA-12 and MA-13 Givens in `checkout.steps.ts` | low | mitigate | Write only inside the scenario's sandbox scope | closed |
| T-03-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `792d2ef` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| — | — | None | — | — |

---

## Security Audit

| Date | Threats found | Closed | Open | Method |
|------|---------------|--------|------|--------|
| 2026-11-22 | 23 | 23 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |

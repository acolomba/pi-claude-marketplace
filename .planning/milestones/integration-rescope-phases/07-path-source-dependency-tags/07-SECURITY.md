---
phase: "7"
slug: "path-source-dependency-tags"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-23"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited files under `extensions/` for one run each | Source text; must never be committed |
| Executor worktree → main checkout | The plan's breaks ran in its worktree; the review fixers' breaks ran in the main checkout, as instructed | Working-tree paths |
| Frozen plan inputs → executor | `plan-07/inputs/` copied by the executor | Checked by `SHA256SUMS` |
| Scenario → git host | The tag step and the github marketplace push to the scenario's bare repositories | Git objects and refs |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Tampering | break runs under `extensions/` | high | mitigate | `git diff 89d17f0 HEAD -- extensions` is empty; 21 of 21 break logs record `restored=clean` | closed |
| T-07-02 | Tampering | the helpers' working directory | high | mitigate | Plan logs record `root=` of `agent-a49325a0548296363` (7); the 14 main-checkout roots are the review fixers' runs, as instructed | closed |
| T-07-03 | Tampering | copies of `plan-07/inputs` over shared harness files | medium | mitigate | Task 1 checked `SHA256SUMS` (hash `379aa6ca…55ee`); every planned file equals its frozen copy (`cmp`) | closed |
| T-07-04 | Repudiation | red-proof record | medium | mitigate | `check-red.mjs` printed `RED-PROOFS OK` for the plan and both review-fix passes (verifier re-ran it on `fix-07b/`) | closed |
| T-07-05 | Information disclosure | git traffic of the tag step and the github marketplace | medium | mitigate | The tag step pushes only to the scenario's bare repositories on the routed git host | closed |
| T-07-06 | Information disclosure | an untracked marketplace file copied into `plugin-clones/` (CR-01) | medium | mitigate | CR-01 stays as the internal guard in the trimmed integration file and passes (2/2) | closed |
| T-07-07 | Tampering | the trim of `path-source-tag-install` | medium | mitigate | Each deleted case failed S1 or S2 under a break first; review CR-01 restored the checkout-snapshot guard (C1 red) | closed |
| T-07-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `89d17f0` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| — | — | None | — | — |

---

## Security Audit

| Date | Threats found | Closed | Open | Method |
|------|---------------|--------|------|--------|
| 2026-11-23 | 8 | 8 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |

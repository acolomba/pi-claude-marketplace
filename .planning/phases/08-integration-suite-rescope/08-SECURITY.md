---
phase: "8"
slug: "integration-suite-rescope"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-23"
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | The breaks of plans 08-01 and 08-02 changed files under `extensions/` for one run each | Source text; must never be committed |
| Frozen plan inputs → executor | Plans apply `plan-08/inputs/` edits with `apply-edits.mjs` | Checked by `SHA256SUMS` (hash `9ad85534…1746`) |
| Combined tree → gate | The ITSCOPE-04 gate must run on the tree that holds every Phase 6.1 and Phase 8 commit | The commit under test |
| Phase 6.1's file → this phase's doc edit | 08-05 edits a sentence of `docs/hooks-compatibility.md` | Doc text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Tampering | breaks B1..B3 | high | mitigate | 3 of 3 break logs in `phase08-plan01/` record `restored=clean`. No Phase 8 commit touches `extensions/`; every `extensions/` commit since `9aa92a1` is a Phase 6.1 hooks fix | closed |
| T-08-02 | Tampering | frozen inputs | medium | mitigate | Each plan's precondition checked `SHA256SUMS` and its hash; `apply-edits.mjs check` passed (SUMMARYs) | closed |
| T-08-03 | Repudiation | red proof of the two moved cases | medium | mitigate | 08-01-SUMMARY records each break failing its covering case; `plan.test.ts` passes 71/71 | closed |
| T-08-04 | Tampering | breaks B4..B7c | high | mitigate | 11 of 11 break logs in `phase08-plan02/` record `restored=clean` | closed |
| T-08-05 | Tampering | helpers' working directory | high | mitigate | `check-red.mjs` compared each `root=` with the plan's checkout (08-02-SUMMARY) | closed |
| T-08-06 | Repudiation | red proof of the four deletions | medium | mitigate | `check-red.mjs` passed; 08-02-SUMMARY records each failure list | closed |
| T-08-07 | Tampering | trims of three integration files | medium | mitigate | Frozen edits applied after the tables passed; the kept cases run green in the final gate (236/236) | closed |
| T-08-08 | Information disclosure | a deleted case guarding a security path | low | accept | None of the deleted cases checks credentials, deny-lists, or containment; `auth-e2e` and the AVAR-05 rows stay | closed |
| T-08-09 | Tampering | frozen header edits | medium | mitigate | `apply-edits.mjs check` passed; 28 of 28 files carry the path line and `(ITSCOPE-01)` | closed |
| T-08-10 | Repudiation | header texts | low | mitigate | Headers were compared with case titles; review fixes `df66399`, `761cb6c`, `e89a9e6` corrected the wording | closed |
| T-08-11 | Information disclosure | AVAR-05 conformance rows | low | accept | Only headers changed; the rows pass in the final gate | closed |
| T-08-12 | Tampering | frozen charter text | low | mitigate | The three places hold the same 10 items (`same-text=true`, 08-05) | closed |
| T-08-13 | Repudiation | a fixer rewrites a skill edit | low | mitigate | No fixer changed a file on commit (08-04-SUMMARY) | closed |
| T-08-14 | Repudiation | ITSCOPE-04 gate record | medium | mitigate | `main_exit=0` (adapter 2285/2285, builtin 260/260) and `cov_exit=0` (376 records) on `b9c0a04`, Node v24.22.3, no reruns | closed |
| T-08-15 | Tampering | hooks doc edit | medium | mitigate | Phase 6.1 was complete first; `EDITS DRY OK`, then `EDITS CHECK OK`; only that sentence changed | closed |
| T-08-16 | Tampering | combined-tree counts | low | mitigate | The count check stopped the plan; the 265→236 and 9→10 changes were traced to `7d76c64`, `f63bc50`, `9403a1c` and accepted by the orchestrator | closed |
| T-08-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` are unchanged since `9aa92a1`; the peer installs use the pinned suite versions only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-08, T-08-11 | Low severity; no security-relevant case was deleted or changed beyond its header | plan-time disposition | 2026-11-23 |

---

## Security Audit

| Date | Threats found | Closed | Open | Method |
|------|---------------|--------|------|--------|
| 2026-11-23 | 17 | 17 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |

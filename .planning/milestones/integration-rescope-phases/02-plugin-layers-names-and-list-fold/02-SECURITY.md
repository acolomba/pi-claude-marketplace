---
phase: "2"
slug: "plugin-layers-names-and-list-fold"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited `extensions/` files for one run each | Source text; never committed |
| Executor worktrees → shared host | Four parallel executors shared CPUs, memory, and `node_modules` caches | Process load |
| Integration suite → cucumber | Deleted and trimmed integration cases move to scenarios | Test coverage |

---

## Threat Register

Each of the four plans registered the same five threat classes for its own files (02-01: T-02-01..05, 02-02: T-02-06..10, 02-03: T-02-11..15, 02-04: T-02-16..20; T-02-21/22 and T-02-SC are shared).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01, -06, -11, -17 | Tampering | deliberate breaks in `extensions/` | high | mitigate | `git diff 8cc0eee HEAD -- extensions` has no non-comment line (the only change is `list-flow.ts` JSDoc); 20 break logs end `restored=clean` | closed |
| T-02-02, -07, -12, -18 | Tampering | break helper working directory | high | mitigate | Each plan's helper rooted at its own worktree (`root=` in logs); worktrees merged by the manifest-scoped cleanup | closed |
| T-02-03, -08, -14, -20 | Repudiation | red-proof records | medium | mitigate | Green baselines first; failures matched on `  N) <title> # <file>:<line>` and scenario counts; the verifier re-ran two breaks itself | closed |
| T-02-04, -09, -15, -21 | Denial of service | shared host and caches | medium | mitigate | `--parallel 1` cucumber runs and `flock` around heavy checks; no executor timed out | closed |
| T-02-05, -10, -16, -22 | Tampering | integration-file trim and deletions | medium | mitigate | Each deleted case maps to a scenario (verifier); `plugin-layer-verbs` keeps its two LAYER-06 tests | closed |
| T-02-13, -19 | Tampering | reserved-name and fold product paths read during breaks | high | mitigate | Same empty non-comment `extensions/` diff | closed |
| T-02-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `8cc0eee` | closed |

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
| 2026-11-21 | 23 | 23 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |

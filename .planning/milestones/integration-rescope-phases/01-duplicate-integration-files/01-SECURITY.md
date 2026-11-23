---
phase: "1"
slug: "duplicate-integration-files"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited files under `extensions/` for one run each | Source text; must never be committed |
| Executor worktree → main checkout | The break helpers ran in agent worktrees | Working-tree paths |
| Docs → readers | Compatibility docs cite the scenarios that replace the deleted tests | Evidence claims |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | breaks E1–E5 in `bridges/hooks/` | high | mitigate | `git diff f67fe6c HEAD -- extensions` is empty; break logs record `restored=clean` | closed |
| T-01-02 | Tampering | break helper working directory | high | mitigate | Plan 01 logs record `root=` of its own worktree (`agent-a6ca81828b13e97f5`) | closed |
| T-01-03 | Repudiation | red-proof record (plan 01) | medium | mitigate | Green baselines first; each break log lists its failing scenarios (summary format `N) title # file:line`, see SUMMARY deviation); evidence re-read by the verifier | closed |
| T-01-04 | Tampering | breaks E6–E11 in `bridges/hooks/`, `bridges/agents/convert.ts` | high | mitigate | Same empty `extensions/` diff; logs record `restored=clean` | closed |
| T-01-05 | Tampering | break helper working directory | high | mitigate | Plan 02 logs record `root=` of its own worktree (`agent-af3e6cfb9254abecf`) | closed |
| T-01-06 | Spoofing | `ACTIVE_AGENT_PREFIX` in `bridges/hooks/runtime.ts` | medium | mitigate | File unchanged; the concurrent scenario's spoof-tag `demo:beta` row passed in the phase gate (adapter 2102/2102) | closed |
| T-01-07 | Repudiation | doc citations | medium | mitigate | No file in `docs/`, `features/`, `test/`, or `scripts/` names a deleted test; review WR-01 fixed the one stale claim | closed |
| T-01-08 | Repudiation | red-proof record (plan 02) | medium | mitigate | The new scenario is in the failure lists of E7 (both profiles), E8, E9; verifier re-read the logs | closed |
| T-01-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `f67fe6c` | closed |

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
| 2026-11-21 | 9 | 9 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |

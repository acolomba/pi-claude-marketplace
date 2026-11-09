---
phase: "13"
slug: "prune"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-08"
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. Verified inline by the Phase 13 session (P13-DC-14).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness to the real user home | Cucumber scenarios and npm test scripts run Pi with temporary homes | Scope state, config, staged artifacts |
| Local red-proof edits to the committed product | A product mutation lives only in the working tree between its run and its restore | Product source lines |
| Phase branch to the milestone branch and siblings | Commits land only on `features/behavioral-gaps-phase-13`; nothing is pushed | Commits |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-13-01 | Tampering | red-proof mutations of `prune.ts`, `dependency-index.ts`, the prune handler, and `with-state-guard.ts` | high | mitigate | Each mutation restored with `git checkout -- <file>`; `git status --short -- extensions` empty after each; `git diff --name-only d099f77f..ccd1f435` lists only `features/plugin/prune.feature` | closed |
| T-13-02 | Information disclosure | test runs and the real `~/.pi` | medium | mitigate | Runs only through `npx cucumber-js` and the npm scripts (temporary Pi homes); `find /home/acolomba/.pi -newer <marker> -type f` printed nothing | closed |
| T-13-03 | Repudiation | gate evidence | medium | mitigate | Each gate part ran alone in the background with its exit code in a file; failures under load rerun once and both runs recorded in 13-01-SUMMARY.md | closed |
| T-13-04 | Tampering | frozen and unowned files | medium | mitigate | Only `features/plugin/prune.feature` and `.planning/` files changed; `usage-errors.feature` and `state-lock.feature` were run, not edited | closed |
| T-13-SC | Tampering | package installs | high | accept | No package installed; the peer cache holds the repository's declared floors | closed |

---

## Accepted Risks

| Risk | Rationale |
|------|-----------|
| T-13-SC | The phase installs no package. |

---

## Audit Trail

- 2026-11-08: threat register verified against the 13-01 commits and the SUMMARY evidence; threats_open 0.

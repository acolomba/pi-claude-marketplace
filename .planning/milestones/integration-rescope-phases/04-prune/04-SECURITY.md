---
phase: "4"
slug: "prune"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited files under `extensions/` for one run each | Source text; must never be committed |
| Executor worktree → main checkout | Break helpers ran in agent worktrees (the review fixer's two runs in the main checkout, as instructed) | Working-tree paths |
| Prune → backup directory | The backup-leak fix walks and widens directory modes before removing a prune backup | File modes under `<scopeRoot>/pi-claude-marketplace/prune-backup-*` |
| Prune → user | The malformed-state failure notice | Paths in error causes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | 27 breaks under `extensions/` (plan 01) | high | mitigate | `git diff ee04e7e HEAD -- extensions` names only `prune-rollback.ts` (the intended fixes); 28 of 28 break logs record `restored=clean`; `git status --porcelain -- extensions` is empty | closed |
| T-04-02 | Tampering | break helper working directory | high | mitigate | Plan 01 logs record `root=` of its own worktree (`agent-a701de1134e75b03c`); plan 02 of `agent-a2c3694f6a7d97d5a`; the review fixer's two runs record the main checkout, where it was told to work | closed |
| T-04-03 | Repudiation | red-proof record (plan 01) | medium | mitigate | Green baseline first; no log holds a step timeout; every new row fails under at least one break (verifier re-read the 28 logs) | closed |
| T-04-04 | Information disclosure | malformed-state notice of `orchestrators/plugin/prune.ts` | medium | mitigate | M01 states the whole redacted row and checks no absolute sandbox path; K3 failed all four M01 rows | closed |
| T-04-05 | Tampering | trim of `standalone-prune.test.ts` | medium | mitigate | Trim followed the break runs; the two carriers stay byte for byte and pass (2/2) | closed |
| T-04-06 | Denial of service | read-only skill directory of F01/F02 | low | accept | Scenario-owned sandbox; release restores owner write without following symlinks | closed |
| T-04-07 | Tampering | `grantBackupWrites` mode walk | medium | mitigate | `lstat` walk inside the backup root only; review WR-02 added a unit case that a `stat` walk fails (outside dir widened to 0o755) | closed |
| T-04-08 | Denial of service | `removeBackupRoot` recursion | high | mitigate | Call sites replaced before helpers; `prune.feature` 41/41 and the pair 56/56 pass with no step timeout | closed |
| T-04-09 | Repudiation | prepare failure path hiding the snapshot refusal | medium | mitigate | Absent-root guard; review WR-01 put the cleanup in its own try/catch (debug-logged) with a unit case red before the fix (`6d229d1`) | closed |
| T-04-10 | Tampering | break B1 in `prune-rollback.ts` | high | mitigate | B1 log `restored=clean`; `extensions/` clean | closed |
| T-04-11 | Repudiation | red-proof record of the fix | medium | mitigate | Red logs predate the fix commit (verifier checked mtimes: `fix-red-adapter.log` 1795312396 < `d24f937` 1795312857) | closed |
| T-04-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `ee04e7e` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-06 | The read-only directory lives in a scenario-owned temporary sandbox that the release step restores | plan 04-01 threat model | 2026-11-22 |
| AR-04-02 | T-04-07 (review IN-01) | A directory swapped for a symlink between the walk's `lstat` and `chmod` would be followed; the walk runs under the scope's state lock on a backup the extension just created | orchestrator (review disposition) | 2026-11-22 |

---

## Security Audit

| Date | Threats found | Closed | Open | Method |
|------|---------------|--------|------|--------|
| 2026-11-22 | 12 | 12 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |

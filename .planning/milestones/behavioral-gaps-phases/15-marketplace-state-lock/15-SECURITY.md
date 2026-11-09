---
phase: "15"
slug: "marketplace-state-lock"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-08"
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The audit ran inline in the phase's child session, against the threat model of 15-01-PLAN.md and the evidence in 15-01-SUMMARY.md (P15-DC-14).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Red-proof mutation to commit | A temporary product mutation must never reach a commit | Product source of `autoupdate.ts` and `with-state-guard.ts` |
| Scenario sandbox to the real home | Every scenario's Pi runs with a sandbox home | Config, state, and lock files of each scope |
| Two Pi processes sharing one scope | The scope's state lock (D-06) guards against a lost update | The `.state-lock` directory, `claude-plugins.json`, `state.json` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-15-01 | Tampering | red-proof mutations of `orchestrators/marketplace/autoupdate.ts` and `transaction/with-state-guard.ts` | high | mitigate | Each mutation was reverted with `git checkout -- <file>` before any pre-commit run or commit. `git diff --stat 7e961d04..HEAD -- extensions features` lists only `features/marketplace/state-lock.feature`, and the commits `b80a2024` and `714d15f8` each contain only that file | closed |
| T-15-02 | Information disclosure | cucumber runs and gates against the real `~/.pi` | medium | mitigate | Every scenario uses the harness sandbox home. `find ~/.pi -newer <marker>` printed nothing after the wave gate and after the phase gate | closed |
| T-15-03 | Tampering | lost update between two Pi processes writing one scope | high | mitigate | The MLOCK-01 Outline pins lock held with unchanged config and record bytes. Red proof A shows it fails when the flip skips the lock | closed |
| T-15-04 | Denial of service | a lock a dead process left blocking every marketplace verb | medium | mitigate | 16 stale twins pin that each verb completes. Red proof B shows they fail under a one-hour stale window | closed |
| T-15-05 | Tampering | takeover of a lock whose live holder stalls past the 10-second stale window | low | accept | proper-lockfile refreshes a held lock every 2 seconds, and Claude Code uses the same 10-second default (D-BG-1502) | closed |
| T-15-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package was added. `package.json` and `package-lock.json` are unchanged in every phase commit | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Evidence: 15-01-SUMMARY.md `## Red proofs`, `## Hermetic home`, and `## Threat Flags`; 15-VERIFICATION.md.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-05 | A live holder keeps its lock fresh every 2 seconds. A holder that stalls more than 10 seconds is treated as dead, the same way Claude Code's default treats it | child session (recommended option, user standing instruction) | 2026-11-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-08 | 6 | 6 | 0 | phase 15 child session (inline) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-08

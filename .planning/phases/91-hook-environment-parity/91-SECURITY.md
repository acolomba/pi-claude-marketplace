---
phase: 91
slug: hook-environment-parity
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-03
---

# Phase 91 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| extension → spawned hook child process | The hook child inherits the env object built by `prepareEnv` / `prepareAsyncEnv`; the three added session-env values cross this boundary. | `CLAUDECODE="1"` (constant), Pi session id (internal identifier, not a secret) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-91-01 | Information disclosure | `CLAUDE_CODE_SESSION_ID` / `CLAUDE_SESSION_ID` in child env | low | accept | Session id already exposed to the hook child via the session-start `process.env` mutation and the stdin envelope's `session_id`; internal identifier, not a secret. See Accepted Risks Log. | closed |
| T-91-02 | Tampering | Drift between the two hand-mirrored env builders | low | mitigate | HENV-02 behavioral drift guard (`assertLaneParity`, D-91-01) fails CI on any lane divergence beyond `MARKER_ENV`, across SessionStart and non-SessionStart fixtures; parity additionally holds by construction via the shared `claudeSessionEnvFor` producer (WR-01 fix). Verified green. | closed |
| T-91-03 | Information disclosure | `CLAUDE_ENV_FILE` path containment | low | mitigate | Existing `assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE")` calls (NFR-10) byte-for-byte unchanged on both lanes; verified by the phase verifier's prohibition checks and code review (no new file writes, no new spawn sites). | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-91-01 | T-91-01 | The Pi session id is an internal session identifier, not a credential; it was already observable by hook children before this phase (session-start `process.env` mutation, stdin envelope `session_id`). No new secret crosses the boundary. | plan-time register (91-01-PLAN threat model), confirmed at audit | 2026-08-03 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-03 | 3 | 3 | 0 | secure-phase short-circuit (plan-time register, ASVS L1, threats_open 0) |

Related decision (code review WR-02, user-decided 2026-08-03): inherited parent `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are intentionally NOT scrubbed from the `...process.env` spread (milestone non-interference stance); the nested-host caveat is documented in Phase 94's DOC-06 rather than mitigated in code.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03

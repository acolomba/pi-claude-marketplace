---
phase: 87
slug: bucket-a-admission-platform-floor
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-30
---

# Phase 87 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin `hooks.json` → domain parser (`partitionHooks` / `tryNonToolEventTrip`) | Untrusted plugin-authored event keys and matcher strings; schema-validated + strict-supportability gated before dispatch | Matcher/event strings (untrusted, low sensitivity) |
| fixture `hooks.json` bytes → offline parser under test | Test-only fixtures derived from published marketplace wire bytes (D-87-03) | Test data only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-87-01 | Tampering | dispatch key-domain decouple (`DispatchableEvent`) | low | accept | Pure type-level refactor; no new runtime input surface, no I/O; `isDispatchableEvent` guards the two dispatch index sites; existing schema validation + exact-set membership unchanged | closed |
| T-87-02 | Tampering | StopFailure closed-set gate | low | mitigate | Exact whole-string membership against the 10-value closed set (D-58-06); out-of-vocabulary and pipe-compound matchers drop rather than translating to a no-op filter; pinned by disposition tests in `tests/domain/components/hooks.test.ts` + `tests/architecture/hooks-supportability.test.ts` (green) | closed |
| T-87-03 | Denial of Service | matcher validation | low | accept | The widened closed set is more restrictive than accepting arbitrary matchers; existing literal/pipe-OR path already avoids catastrophic backtracking (no new regex) | closed |
| T-87-04 | Tampering | test fixtures | low | accept | Fixtures are offline, derived from real published marketplace wire bytes with provenance recorded in each fixture description (D-87-03); no production code, no network (NFR-5) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-87-01 | T-87-01 | Type-level refactor with no new input surface; dispatch unreachable for the new events until Phase 88 wires translators | plan-time register (87-01-PLAN) | 2026-07-30 |
| R-87-02 | T-87-03 | Closed-set validation strictly narrows the accepted input space; no new regex path | plan-time register (87-02-PLAN) | 2026-07-30 |
| R-87-03 | T-87-04 | Offline test-only fixtures with recorded provenance; NFR-5 network policy untouched | plan-time register (87-03-PLAN) | 2026-07-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-30 | 4 | 4 | 0 | secure-phase short-circuit (plan-time register, ASVS L1, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-30

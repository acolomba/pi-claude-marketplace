---
phase: "2"
slug: "apply-ordering-and-installed-declarations"
status: verified
threats_open: 0
asvs_level: 1
audited_commit: "9692623df10a567019acdb7a24e5e3229a72cc80"
created: "2026-10-28"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Catalog and state → reconcile planner | Third-party manifests and editable state select moves, installs, enables, and disables. | Plugin declarations, resolved sources, versions, and scope records |
| Installed plugin copy → dependency reader | A third-party repository's installed manifest controls dependency enable and update constraints. | Plugin roots, manifest links, and dependency declarations |
| Marketplace refresh → dependency install | A newly added or refreshed marketplace can make missing dependencies eligible for installation. | Marketplace records, plugin sources, ranges, and install outcomes |
| Apply result → next Pi session | The final judged state determines which plugins can load after reload. | Enable state, failure rows, and remediation detail |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| 02-01 / T-02-01 | Tampering | planned-install release | medium | mitigate | Scheduled keys come only from the two planned install buckets; unreadable declarations fail the walk closed. | closed |
| 02-01 / T-02-02 | Denial of service | reconcile fixpoints | low | mitigate | Both loops grow bounded sets and stop when a pass adds nothing; cycle coverage passes. | closed |
| 02-01 / T-02-SC | Tampering | package installs | high | accept | Plan 02-01 adds no package-manager operation. | closed |
| 02-02 / T-02-03 | Tampering | installed-copy reader | high | mitigate | The owning root is contained before parsing; unusable manifests fail the declaration walk closed. A distinct installed holder forces this walk under the existing scope lock; the no-holder fast path excludes only the target and requester records that cannot be holders. | closed |
| 02-02 / T-02-04 | Information disclosure | unreadable-declarer diagnostics | medium | mitigate | Fixed phrases omit manifest text, absolute paths, and chained causes. | closed |
| 02-02 / T-02-SC | Tampering | package installs | high | accept | Plan 02-02 adds no package-manager operation. | closed |
| 02-03 / T-02-05 | Elevation of privilege | post-install enables | high | mitigate | Only the fresh post-install plan can enable a waiting record, and final strict judgment disables unsatisfied plugins. | closed |
| 02-03 / T-02-06 | Repudiation | reconcile result rows | medium | mitigate | Install failures and dependent disable/remedy rows remain observable, including failures after prior writes. | closed |
| 02-03 / T-02-SC | Tampering | package installs | high | accept | Plan 02-03 adds no package-manager operation. | closed |
| 02-04 / T-02-07 | Tampering / Information disclosure | installed-copy root | high | mitigate | D-PL2-23 selects one owning root and checks containment before any copy read. | closed |
| 02-04 / T-02-08 | Tampering | linked manifest candidate | high | mitigate | Under D-PL2-17, contained links are allowed inside the manifest boundary: the plugin directory for a per-commit copy, or the plugin and marketplace directories for a path plugin read in place; escapes and loops are refused. | closed |
| 02-04 / T-02-SC | Tampering | package installs | high | accept | Plan 02-04 adds no package-manager operation. | closed |
| 02-05 / T-02-09 | Elevation of privilege | marketplace-add dependency request | high | mitigate | The request keeps the add's scope and selects only dependencies served by the added marketplace. | closed |
| 02-05 / T-02-10 | Tampering | dependency install operation | high | mitigate | The shared install ledger retains cross-marketplace authorization, range checks, containment, and rollback. | closed |
| 02-05 / T-02-11 | Information disclosure | cache-miss network access | medium | accept | D-PL2-15 permits a git-source dependency clone on cache miss; warm SHA-pinned cache operations remain offline. | closed |
| 02-05 / T-02-SC | Tampering | package installs | high | accept | Plan 02-05 adds no package-manager operation. | closed |
| 02-06 / T-02-12 | Elevation of privilege | autoupdate dependency selection | high | mitigate | The step requires autoupdate, preserves scope, and selects only dependencies declared by that refreshed marketplace. | closed |
| 02-06 / T-02-13 | Denial of service | autoupdate cascade | low | mitigate | The step runs once per refreshed marketplace; scope locking and per-item outcomes contain ordinary failures. | closed |
| 02-06 / T-02-SC | Tampering | package installs | high | accept | Plan 02-06 adds no package-manager operation. | closed |

*Status: open · closed · open — below high threshold (non-blocking).*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | 02-01 / T-02-SC | No package-manager operation is introduced. | Phase 02-01 plan decision | 2026-10-28 |
| AR-02-02 | 02-02 / T-02-SC | No package-manager operation is introduced. | Phase 02-02 plan decision | 2026-10-28 |
| AR-02-03 | 02-03 / T-02-SC | No package-manager operation is introduced. | Phase 02-03 plan decision | 2026-10-28 |
| AR-02-04 | 02-04 / T-02-SC | No package-manager operation is introduced. | Phase 02-04 plan decision | 2026-10-28 |
| AR-02-05 | 02-05 / T-02-11 | Git dependency installation may use the network on cache miss; the recorded NFR-5 amendment preserves offline warm-cache behavior. | Phase 02-05 plan decision (D-PL2-15) | 2026-10-28 |
| AR-02-06 | 02-05 / T-02-SC | No package-manager operation is introduced. | Phase 02-05 plan decision | 2026-10-28 |
| AR-02-07 | 02-06 / T-02-SC | No package-manager operation is introduced. | Phase 02-06 plan decision | 2026-10-28 |

The plan-qualified references keep the six repeated supply-chain rationales distinct.

---

## Unregistered Flags

None. All six plan summaries report no security surface outside their registered threat models.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 19 | 19 | 0 | GSD security auditor, ASVS L1 |
| 2026-10-28 | 19 | 19 | 0 | GSD final merged-tree security auditor, ASVS L1 |

The audit verified 12 mitigation rows and recorded the seven PLAN-authorized accepted risks. Counts preserve all six plan-qualified `T-02-SC` occurrences; the deduplicated register contains 14 IDs.

The recheck at `9692623d` verified the installed-declaration lock boundary and the no-potential-holder fast path. Lock acquisition, compromise, and release failures reject the operation; the lock is released before tag probes and candidate resolution. Regression coverage proves held-lock refusal followed by retry, requester and excluded-version folding, and missing-dependency retry after lock release. The full gate passed with 1,122 scenarios, 11,447 steps, and 309 LCOV records.

The final merged-tree recheck at `decf5452` verified all 19 plan-qualified
Phase 2 threats: 12 implementation mitigations and seven documented accepted
risks. The audit re-traced bounded reconcile fixpoints; fail-closed catalog and
installed-copy declaration reads; owning-root and linked-manifest containment;
fixed diagnostics; post-install judgment and outcome ordering; marketplace-add
and autoupdate scope boundaries; the update-constraint lock lifecycle; and the
shared install ledger's authorization, rollback, credential, redaction, and
warm-cache network behavior. All six summary threat flags remain registered.
Nyquist is COMPLIANT 8/8, and the exact integrated full gate passed 1,142
scenarios, 11,734 steps, and 309 LCOV records. No new or reopened threat was
found; `threats_open` remains 0.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer).
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-10-28.

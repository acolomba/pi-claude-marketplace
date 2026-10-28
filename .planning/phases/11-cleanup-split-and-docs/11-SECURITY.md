---
phase: "11"
slug: "cleanup-split-and-docs"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-28"
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Reconcile request → factory collaborator | Apply restores deferred pins through a factory-owned collaborator, not a request option. | Plugin keys, scopes, pins, and lock failures |
| Install root → planning and ledger leaves | The root composes typed planning operations while the ledger retains persistence, rollback, and package order. | Plans, resolved members, state changes, warnings, and rollback details |
| Test process → filesystem and child processes | Shared helpers hold state locks and start bounded local stand-ins. | Lock paths, socket paths, process signals, and cleanup state |
| Implementation evidence → milestone records | Final docs, backlog dispositions, and requirements must describe the verified tree. | Decisions, test references, requirement status, and reader-facing behavior |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| 11-01 / T-11-01 | Tampering | apply collaborator | low | mitigate | Deferred-pin restoration is factory-only; the request-level type fixture rejects injection. | closed |
| 11-01 / T-11-SC | Tampering | package installs | high | accept | Plan 11-01 changes no package or package-manager operation. | closed |
| 11-02 / T-11-02 | Tampering | dependency index | medium | mitigate | Persisted state keys build the disabled set, and the disabled-holder owner test pins the behavior. | closed |
| 11-02 / T-11-SC | Tampering | package installs | high | accept | Plan 11-02 changes no package surface. | closed |
| 11-03 / T-11-03 | Denial of service | state-lock test helper | medium | mitigate | Lock paths come from `ScopedLocations`; cleanup runs through `TestContext.after` and `finally`. | closed |
| 11-03 / T-11-SC | Tampering | package installs | high | accept | Plan 11-03 changes test support only. | closed |
| 11-04 / T-11-04 | Denial of service | marketplace proxy tests | medium | mitigate | Hostile proxy cases are timeout-bounded and preserve cleanup. | closed |
| 11-04 / T-11-SC | Tampering | package installs | high | accept | Plan 11-04 changes handler ownership only. | closed |
| 11-05 / T-11-05 | Repudiation | architecture and project records | medium | mitigate | NFR-5 and the child-process and hosted-manifest fetch chokepoints cite their decisions and rule-pack evidence. | closed |
| 11-05 / T-11-SC | Tampering | package installs | high | accept | Plan 11-05 documents the existing package seam without changing it. | closed |
| 11-06 / T-11-06 | Tampering | install-flow split | high | mitigate | The root binds five consumer-owned planning operations; all six current owner pairs have 100% direct coverage. | closed |
| 11-06 / T-11-SC | Tampering | package install order | high | mitigate | Package execution remains contained and ordered after workflows and before state; rollback capture remains in the ledger. | closed |
| 11-07 / T-11-07 | Denial of service | marketplace add outcome | medium | mitigate | The outcome union is closed; apply and import consume `unchanged`; hostile proxy tests remain bounded. | closed |
| 11-07 / T-11-SC | Tampering | package installs | high | accept | Plan 11-07 changes no package surface. | closed |
| 11-08 / T-11-08 | Tampering | update literals and comments | low | mitigate | Byte-preserving owner expectations pin the split literals. | closed |
| 11-08 / T-11-SC | Tampering | package installs | high | accept | Plan 11-08 changes comments and literals only. | closed |
| 11-09 / T-11-09 | Repudiation | backlog and requirements | medium | mitigate | The UPDDEP-01 closure cites `11-13-SUMMARY.md` and all six current install-flow owner suites. | closed |
| 11-09 / T-11-SC | Tampering | package installs | high | accept | Plan 11-09 changes records only. | closed |
| 11-10 / T-11-10 | Tampering | deferred-pin composition | low | mitigate | The production factory supplies `restorePin`; request-level injection remains absent and rejected. | closed |
| 11-10 / T-11-SC | Tampering | package installs | high | accept | Plan 11-10 changes reconcile composition only. | closed |
| 11-11 / T-11-11 | Denial of service | held-lock tests | medium | mitigate | Migrated cases use `whileStateLockHeld`, which releases through `finally`; four owner modules pass. | closed |
| 11-11 / T-11-SC | Tampering | package installs | high | accept | Plan 11-11 changes tests only. | closed |
| 11-12 / T-11-12 | Tampering | feature descriptions | low | mitigate | Description-only commits leave executable Gherkin unchanged; feature validation passes. | closed |
| 11-12 / T-11-SC | Tampering | package installs | high | accept | Plan 11-12 changes descriptions only. | closed |
| 11-13 / T-11-13 | Tampering | install-flow transaction split | high | mitigate | `install-flow.ts:43-52` binds the same five planning operations. `install-flow-ledger.ts:591-1028` keeps lock, save, hydration, and rollback order visible. Imports remain acyclic, and all six owner pairs have 100% direct coverage. | closed |
| 11-13 / T-11-14 | Elevation of privilege | split install owners | high | mitigate | Commit `4cceceb2` keeps removal operations in the composition root at `install-flow.ts:39-52`. The ledger binds data-directory creation to the current `pluginDataDir` at `install-flow-ledger.ts:427-436`. Cascade, result, and dependency siblings have no raw filesystem, process, Git, fetch, or removal-construction authority. | closed |
| 11-13 / T-11-SC | Tampering | package install order | high | mitigate | The package phase at `install-outcome.ts:1640-1662`, containment in `package-install.ts:294-300`, and the four-site child-process chokepoint remain unchanged. Their architecture tests pass. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | 11-01 / T-11-SC | No package or package-manager operation changes. | Phase 11 plan decision | 2026-10-28 |
| AR-11-02 | 11-02 / T-11-SC | No package surface changes. | Phase 11 plan decision | 2026-10-28 |
| AR-11-03 | 11-03 / T-11-SC | Test-support-only change. | Phase 11 plan decision | 2026-10-28 |
| AR-11-04 | 11-04 / T-11-SC | Handler-ownership-only change. | Phase 11 plan decision | 2026-10-28 |
| AR-11-05 | 11-05 / T-11-SC | Documents an existing package seam without changing it. | Phase 11 plan decision | 2026-10-28 |
| AR-11-07 | 11-07 / T-11-SC | No package surface changes. | Phase 11 plan decision | 2026-10-28 |
| AR-11-08 | 11-08 / T-11-SC | Comment and literal cleanup only. | Phase 11 plan decision | 2026-10-28 |
| AR-11-09 | 11-09 / T-11-SC | Records-only change. | Phase 11 plan decision | 2026-10-28 |
| AR-11-10 | 11-10 / T-11-SC | Reconcile-composition-only change. | Phase 11 plan decision | 2026-10-28 |
| AR-11-11 | 11-11 / T-11-SC | Test-only migration. | Phase 11 plan decision | 2026-10-28 |
| AR-11-12 | 11-12 / T-11-SC | Description-only change. | Phase 11 plan decision | 2026-10-28 |

The plan-qualified references keep the eleven acceptance rationales distinct. Plans 11-06 and 11-13 mitigate their package-install threats and therefore have no accepted-risk rows.

---

## Unregistered Flags

None. Plan 11-13 removed every install-flow large-file exception, which resolved the historical `hook-policy-exception` flag.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 24 | 24 | 0 | GSD security auditor, ASVS L1 |
| 2026-10-28 | 27 | 27 | 0 | GSD security auditor, ASVS L1 |

The final audit verified the remediation at `4cceceb2` and the backlog evidence at `91f46fe7`. The exact build-input tree passed 1,120 scenarios, 11,411 steps, and 309 direct LCOV records. Four focused security architecture suites passed. Every install-flow source meets the size limits, the hook has no install-flow exception, and the import graph has no cycle.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer).
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-10-28.

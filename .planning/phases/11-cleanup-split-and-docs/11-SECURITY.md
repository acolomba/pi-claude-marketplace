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
| 11-06 / T-11-06 | Tampering | install-flow split | high | mitigate | The root binds five consumer-owned planning operations; all three owner pairs have 100% direct coverage. | closed |
| 11-06 / T-11-SC | Tampering | package install order | high | mitigate | Package execution remains contained and ordered after workflows and before state; rollback capture remains in the ledger. | closed |
| 11-07 / T-11-07 | Denial of service | marketplace add outcome | medium | mitigate | The outcome union is closed; apply and import consume `unchanged`; hostile proxy tests remain bounded. | closed |
| 11-07 / T-11-SC | Tampering | package installs | high | accept | Plan 11-07 changes no package surface. | closed |
| 11-08 / T-11-08 | Tampering | update literals and comments | low | mitigate | Byte-preserving owner expectations pin the split literals. | closed |
| 11-08 / T-11-SC | Tampering | package installs | high | accept | Plan 11-08 changes comments and literals only. | closed |
| 11-09 / T-11-09 | Repudiation | backlog and requirements | medium | mitigate | Closures are dated and evidence-linked; CLN-01–04 are complete; carried Phase 10 items remain open. | closed |
| 11-09 / T-11-SC | Tampering | package installs | high | accept | Plan 11-09 changes records only. | closed |
| 11-10 / T-11-10 | Tampering | deferred-pin composition | low | mitigate | The production factory supplies `restorePin`; request-level injection remains absent and rejected. | closed |
| 11-10 / T-11-SC | Tampering | package installs | high | accept | Plan 11-10 changes reconcile composition only. | closed |
| 11-11 / T-11-11 | Denial of service | held-lock tests | medium | mitigate | Migrated cases use `whileStateLockHeld`, which releases through `finally`; four owner modules pass. | closed |
| 11-11 / T-11-SC | Tampering | package installs | high | accept | Plan 11-11 changes tests only. | closed |
| 11-12 / T-11-12 | Tampering | feature descriptions | low | mitigate | Description-only commits leave executable Gherkin unchanged; feature validation passes. | closed |
| 11-12 / T-11-SC | Tampering | package installs | high | accept | Plan 11-12 changes descriptions only. | closed |

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

The plan-qualified references keep the eleven acceptance rationales distinct. Plan 11-06 mitigates its package-install threat and therefore has no accepted-risk row.

---

## Unregistered Flags

- **WARNING — `hook-policy-exception`:** `.pre-commit-config.yaml` excludes exactly `install-flow-ledger.ts` and its paired test from only the 64-KiB added-file check. The alternatives are end-anchored. Secret scanning, lint, Fallow, tests, and coverage still apply. This adds no runtime surface and is non-blocking.
- No other Summary threat flag is unregistered.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 24 | 24 | 0 | GSD security auditor, ASVS L1 |

Evidence was audited at `dc2a61b6`. Phase 11 validation passed 4/4 requirements. The unchanged behavior tree passed 1,120 scenarios, 11,411 steps, and 306 direct LCOV records.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer).
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-10-28.

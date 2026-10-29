---
phase: "3"
slug: dependency-cascade-rows-and-status
status: verified
# threats_open counts OPEN threats at or above workflow.security_block_on.
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_at: be0de0c3
created: "2026-10-29"
---

# Phase 3 — Security

> Threat verification for dependency cascade rows and status. Evidence was checked against the combined tree at `0f40fd4d` after the CAS-03 validation gap closed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Marketplace metadata to notifications | Plugin and manifest versions become refusal and cause text. | Untrusted names, versions, ranges |
| User root ID to scoped lookup | The requested ID is checked against marketplace membership before dependency planning. | User argument, marketplace records |
| Dependency declarations to cascade rows | The closure and install ledger determine which members appear in failure output. | Plugin keys, status and reason fields |
| Directory metadata to pin refusal | Manifest versions and declarers become the directory-pin refusal. | Versions, ranges, plugin names |
| Update preflight to command hint | A recorded move refusal can gain a fixed version-in-range hint. | Dependency key and refusal text |
| Recorded decisions to later behavior | D-PL3-06 and D-PL3-07 define status and git-source behavior. | Documentation and source comments |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-41 | Tampering | Version rendering | medium | mitigate | `truncateForRefusal` bounds versions at 64 code units; dependency-range, constraint-fold, dependency-move, and update behavior tests cover each caller. | closed |
| T-03-42 | Spoofing | Version control/format characters | low | accept | Length is bounded; character normalization remains deferred under T-29-21. See R-03-01. | closed |
| T-03-43 | Spoofing | Invalid-root cause and row | medium | mitigate | `printable` escapes the key in the cause and row; unit and behavioral cases cover invisible characters. | closed |
| T-03-44 | Elevation of privilege | Lookup before invalid-root refusal | low | accept | Lookup uses the valid-root scoped marketplace resolution path. See R-03-02. | closed |
| T-03-45 | Tampering | Prototype-key root names | low | mitigate | Manifest lookup uses equality; record reads use `ownValue`; the `__proto__` integration case proves fail-clean filesystem and record state. | closed |
| T-03-46 | Denial of service | Invalid-root ID length | low | accept | Residual length is bounded by the supplied command argument and tracked under T-06-02. See R-03-03. | closed |
| T-03-47 | Repudiation | Cascade member rows | low | mitigate | Ledger-derived lists exclude root, failing, installed-wall, and moved keys, then deduplicate; install-cascade and messaging tests cover exclusions. | closed |
| T-03-48 | Information disclosure | Additional member rows | low | mitigate | Checked closure keys produce cause-less fixed-field rows; absolute-path redaction has a direct messaging test. | closed |
| T-03-49 | Tampering | Directory-pin refusal fields | medium | mitigate | The plugin, manifest version, ranges, and requirers are cut at 120 characters; unit, catalog, and cucumber cases cover the bounds. | closed |
| T-03-50 | Spoofing | Directory-pin requirers | low | mitigate | Requirers are limited to range-declaring members in the cascade closure; tests exclude unconstrained members. | closed |
| T-03-51 | Spoofing | Version-in-range hint | low | mitigate | The hint requires the root among actual requesters, is suppressed when update is blocked, and interpolates only a checked dependency key. | closed |
| T-03-52 | Information disclosure | Pre-existing move-refusal text | low | accept | The refusal predates this phase; the new hint is fixed text and the current path also redacts absolute paths. See R-03-04. | closed |
| T-03-53 | Repudiation | D-PL3-06 and D-PL3-07 | low | mitigate | Both decisions appear in source/docs, summaries, and project decisions; CAS-03 now has an install/list/info behavioral scenario. | closed |
| T-03-54 | Tampering | Combined-tree verification | low | mitigate | Unpiped `npm run check` exited 0 at `0f40fd4d` on Node `v26.12.1`: 1,121 scenarios, 11,424 steps, and 309 LCOV records. | closed |
| T-03-SC | Tampering | Package installation | low | accept | No Phase 3 plan installs a package. See R-03-05. | closed |

*Only open threats at or above the configured `high` threshold count in `threats_open`.*

---

## Accepted Risks Log

These are the plan-time dispositions from the six Phase 3 threat models. The audit introduces no new acceptance.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-01 | T-03-42 | Version length is bounded; control/format normalization remains deferred under T-29-21. | Phase 3 plan | 2026-10-26 |
| R-03-02 | T-03-44 | Invalid-root lookup uses the valid-root scoped marketplace path and its existing trust decision. | Phase 3 plan | 2026-10-26 |
| R-03-03 | T-03-46 | The root ID comes from the command argument; residual length risk remains tracked under T-06-02. | Phase 3 plan | 2026-10-26 |
| R-03-04 | T-03-52 | Move-refusal text predates the phase; the phase adds only a fixed hint sentence. | Phase 3 plan | 2026-10-26 |
| R-03-05 | T-03-SC | Phase 3 introduces no package installation. | Phase 3 plans | 2026-10-26 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 15 | 15 | 0 | GSD security auditor |
| 2026-10-28 | 15 | 15 | 0 | GSD final merged-tree security auditor |
| 2026-10-29 | 15 | 15 | 0 | GSD final-head security auditor |

The final merged-tree audit at `5c42ac88` reverified all 15 threats: 10
mitigations and five accepted risks. Typed installed and partially-installed
identities, degradation signals, same-ledger authentication, cause/path/rollback
redaction, transaction rollback ordering, and bounded package-process notes
remain intact. All Phase 3 summary flags are registered. Nyquist CAS-01..07 is
COMPLIANT, and the exact integrated full gate passed 1,142 scenarios, 11,734
steps, and 309 LCOV records. No threat reopened; `threats_open` remains 0.

The final-head audit at executable head `be0de0c3` again verified all 15
threats: 10 mitigations and five documented accepted risks. It rechecked
version truncation, printable invalid-root handling, prototype-key refusal,
cascade exclusions and redaction, directory-pin requirer selection, hint
gating, and the D-PL3-06/D-PL3-07 records. Nyquist CAS-01..07 remains
COMPLIANT. The unchanged-input full gate is green with 1,145 scenarios, 11,777
steps, and 309 LCOV records. No unregistered flag or open threat remains.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-29

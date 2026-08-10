---
phase: 98
slug: lifecycle-regression-and-contract-documentation
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-10
---

# Phase 98 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| ledger outcomes → rendered rows | Degradation signals (orphan rewake, malformed kinds, unsupported kinds, soft-dep counts) thread from install/enable/reinstall ledgers into user-visible rows | Closed-set reason tokens only; no plugin-authored text |
| update candidate gate → disabled-record refresh | The record-derived widening admits disabled records to the short-circuit; the refresh writes metadata inside the state guard | Version pin, resolved source/sha, availability discriminant |
| architecture gates → source tree | The COMPAT-01 gate and its delegated network gate read source files directly via the shared helper | Source file contents (read-only) |
| documentation ↔ shipped contract | The DOC-08 sweep edits prose beside byte-pinned fenced blocks | Catalog states under byte-equality gates |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-98-01 | Tampering | `orchestrators/plugin/shared.ts` `LedgerDegradationSignals` | low | mitigate | Type-only interface in the module both orchestrators already import; no-cycle acceptance grep green | closed |
| T-98-02 | Information Disclosure | reconcile installed row `{orphan rewake}` | low | accept | Fixed closed-set literal; no plugin-authored text | closed |
| T-98-03 | Information Disclosure | enable row dependency derivation | low | mitigate | Only staged-name array LENGTHS read; names never rendered | closed |
| T-98-04 | Tampering | hooks path composition during unstage | medium | mitigate | Removal via production `removeHookConfig` through the safe-name + containment chokepoints; confinement asserted | closed |
| T-98-05 | Tampering | mcp.json rewrite during uninstall | medium | mitigate | Differently-owned sibling server entry seeded and asserted surviving | closed |
| T-98-06 | Denial of Service | temporary fixture directories | low | mitigate | Hermetic-home wrapper + finally teardown; no process-global cwd change | closed |
| T-98-07 | Information Disclosure | remediation trailer on failed enable row | low | mitigate | Frozen trailer constant, no interpolation | closed |
| T-98-08 | Tampering | widened render gate admitting the failed status | medium | mitigate | Hint field has exactly one producer; unrelated failed row asserted byte-identical | closed |
| T-98-09 | Elevation of Privilege | record-derived widening of the update gate | medium | mitigate | Widening keyed on the disabled predicate; refresh stages nothing (five empty resources arrays asserted); the WR-01 fix further narrowed admission to non-installable records so a clean disabled record cannot degrade without `--partial` consent | closed |
| T-98-10 | Tampering | source scanning inside the gate | medium | mitigate | All reads via Node fs promises in `tests/helpers/source-scan.ts`; subprocess APIs negative-grepped; the WR-06 fix made missing targets fail loud (ENOENT throw) | closed |
| T-98-11 | Repudiation | enumeration pins | high | mitigate | Hand-written literal member lists; mutation check recorded in the 98-04 summary (planted token → exactly one clause red → reverted green) | closed |
| T-98-12 | Tampering | exporting the install-record schema | low | accept | Test-only widening; schema remains the single validation boundary | closed |
| T-98-13 | Denial of Service | gate execution under concurrent tests | low | mitigate | Gate writes nothing, spawns nothing; asserted by negative-grep | closed |
| T-98-14 | Tampering | end-to-end autoupdate fixture isolation | medium | mitigate | User scope + hermetic home; `process.chdir` negative-grepped | closed |
| T-98-15 | Information Disclosure | rendered cascade row for a manifest-absent record | low | accept | Closed-set literal; no manifest content or path echoed | closed |
| T-98-16 | Tampering | the widened seed helper | low | mitigate | New options optional with today's defaults; pre-existing call sites compile unchanged | closed |
| T-98-17 | Repudiation | the documentation sweep | high | mitigate | Defects corrected in place, never deleted; catalog byte-equality gate + retired-vocabulary guard re-run green after every doc edit | closed |
| T-98-18 | Tampering | catalog fenced blocks | medium | mitigate | No change inside annotated fenced blocks except deliberate state amendments shipped with their FIXTURES entries; byte-equality driver green | closed |
| T-98-19 | Information Disclosure | examples in catalog/design doc | low | mitigate | Fixture names only; trufflehog filesystem scan clean on every commit | closed |
| T-98-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task in any plan; RESEARCH.md Package Legitimacy Audit records "Not applicable" | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-98-01 | T-98-02 | Closed-set token; no injection surface | plan-time register | 2026-08-10 |
| AR-98-02 | T-98-12 | Test-only schema export; no new write path | plan-time register | 2026-08-10 |
| AR-98-03 | T-98-15 | Closed-set literal in the cascade row | plan-time register | 2026-08-10 |
| AR-98-04 | T-98-SC | Phase installs no external packages | plan-time register | 2026-08-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-10 | 20 | 20 | 0 | secure-phase L1 short-circuit (plan-time register; mitigations verified by 98-VERIFICATION.md must-have checks, the recorded mutation checks, and the green full-suite gate) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-10

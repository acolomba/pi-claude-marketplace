---
phase: 97
slug: disabled-state-classification-repair
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-09
---

# Phase 97 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `state.json` → classification surfaces | The persisted record is the single source every surface (list, info, reconcile, update, enable) classifies from | Plugin record fields (`enabled`, `compatibility`, `resources.*`) |
| resolver result → persisted `compatibility` block | Update/enable paths rewrite a record's availability discriminant from the resolution | Availability discriminant + unsupported kind list |
| load-time reconcile → disk materialization | `resources_discover` may stage artifacts (hooks, MCP, `bin/`) without a user command | Plugin artifacts on the child-process PATH |
| `update`/`enable` → staging directories | Three-phase/ledger bodies stage into the extension root and commit by atomic rename | Staged plugin component files |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-97-01 | Elevation of Privilege | `reconcile/apply.ts::backfillOnePluginIsolated` | high | mitigate | Disabled-record early return (`!record.enabled` guard); red-proof + enabled-record positive control in `backfill.test.ts` | closed |
| T-97-02 | Denial of Service | `persistence/state-io.ts::isRecordedButDisabled` | medium | mitigate | `(installable:false, enabled:true) → false` truth-table cell; `plan-convergence` soft-degraded fixture stays an empty plan; classifier pair assertions | closed |
| T-97-03 | Tampering | `update.ts::refreshDisabledRecord` | medium | mitigate | Availability discriminant derived from the resolution; degraded + promotion cases both asserted (mutation-verified) | closed |
| T-97-04 | Elevation of Privilege | `enable-disable.ts::runEnableBranch` | medium | mitigate | Partial-capable gate still rejects the unavailable arm (NFR-7); manifest-absent boundary test proves the pre-ledger throw path | closed |
| T-97-05 | Information Disclosure | `list.ts` / `info.ts` disabled row builders | low | accept | D-97-01 canonical parity: bare `(disabled)` row by construction; detail returns after `enable`; no sensitive data | closed |
| T-97-06 | Tampering | former predicate definition files | medium | mitigate | Whole-tree drift gate (strengthened in the review loop from a four-path allowlist to a full extension-tree walk) asserts no conjunctive twin and single-predicate imports | closed |
| T-97-07 | Repudiation | `persistence/state-io.ts` disabled shape | low | accept | `DisabledPluginRecord` empty-tuple typing makes the contradiction unrepresentable at sanctioned producers; hand-edited `state.json` is outside the trust boundary | closed |
| T-97-08 | Spoofing | `docs/output-catalog.md` prose | low | mitigate | Prose sweep landed; fenced blocks stay under the `catalog-uat` byte gate | closed |
| T-97-09 | Repudiation | the `--fetch` skip note | low | mitigate | True-cause byte pin plus explicit negative assertion on the wrong token | closed |
| T-97-10 | Denial of Service | `with-state-guard.ts` re-entrancy | high | mitigate | Enable keeps the guard-free `runInstallLedger` body — no second lock acquisition; the review-loop clone-GC addition also runs after the guard releases | closed |
| T-97-11 | Tampering | the enable failure path | medium | mitigate | Manifest lookup throws before any ledger phase; ledger rollback composes; boundary test asserts all `resources.*` arrays stay empty | closed |
| T-97-12 | Denial of Service | `reconcile/plan.ts` disable bucket | medium | mitigate | ENBL-05 collapse; two-pass fixed-point test | closed |
| T-97-13 | Tampering | `reconcile/apply.ts` stale seam comment | low | mitigate | Comment corrected in the same commit as the guard | closed |
| T-97-14 | Tampering | `update.ts` three-phase body | medium | mitigate | Disabled short-circuit reached via the ENBL-05 collapse; pinned by the on-disk absence assertion | closed |
| T-97-15 | Denial of Service | `with-state-guard.ts` around the refresh write | low | accept | Non-re-entrant advisory lock rejects the losing concurrent writer with the existing lock error; no second acquisition added | closed |
| T-97-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package-manager install task in any plan; RESEARCH.md Package Legitimacy Audit records "Not applicable" | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-97-01 | T-97-05 | Bare disabled row omits unsupported-kind detail per D-97-01 canonical parity; detail visible after enable | plan-time register (operator discuss) | 2026-08-09 |
| AR-97-02 | T-97-07 | Hand-edited `state.json` outside trust boundary; type system prevents sanctioned producers | plan-time register | 2026-08-09 |
| AR-97-03 | T-97-15 | Existing non-re-entrant lock semantics unchanged; loser fails clean | plan-time register | 2026-08-09 |
| AR-97-04 | T-97-SC | Phase installs no external packages | plan-time register | 2026-08-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-09 | 16 | 16 | 0 | secure-phase L1 short-circuit (plan-time register; mitigations verified by 97-VERIFICATION.md must-have checks and the green full-suite gate) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-09

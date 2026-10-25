---
phase: "29"
slug: "load-converges-on-the-catalog"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-24"
---

# Phase 29 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Pi load (`resources_discover`) → disk | The load reads config, state and the cached catalog and prints the pending block; it makes no plan changes (APL-D1). The AMIG-01 MCP move may still save `state.json` (D-22). | config, state.json, marketplace.json (local, user-controlled) |
| `/claude:plugin apply` → disk and network | Apply makes the pending changes. Network only through the clone-cache seam on a cache miss; no tag search (D-23). | plugin trees, state.json, git clones |
| Manifest / config text → notification rows | Catalog and config text reaches rendered rows and JSON entries. | names, versions, ranges, redacted causes |

---

## Threat Register

Evidence for every row is in the 2026-10-24 audit (gsd-security-auditor, ASVS L1). Paths are under `extensions/pi-claude-marketplace/`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-29-01 | Elevation of privilege | apply | medium | accept | see Accepted Risks | closed |
| T-29-02 | Information disclosure | edge/handlers/plugin/apply.ts | low | mitigate | `withScopeOnlyArgs` rejects positionals and unknown flags with a fixed message | closed |
| T-29-03 | Elevation of privilege | edge/handlers/tools.ts | medium | mitigate | `apply` is not an LLM tool; reached only through the router | closed |
| T-29-04 | Info disclosure / EoP | reconcile/load.ts, read-pass.ts | high | mitigate | outside `NETWORK_SEAMS`; BLOCK F default-deny | closed |
| T-29-05 | Tampering | reconcile/load.ts | high | mitigate | load runs no `applyPlan`, no install, no `tx.save()`; load.test.ts asserts unchanged bytes | closed |
| T-29-06 | Denial of service | reconcile/read-pass.ts | medium | mitigate | `runScopeIsolated` / `readPassFailureOutcome` | closed |
| T-29-07 | Information disclosure | reconcile/read-pass.ts | medium | mitigate | basename rows, `redactAbsolutePaths` | closed |
| T-29-08 | Tampering | JSON wire `needsApply` | low | accept | see Accepted Risks | closed |
| T-29-09 | Information disclosure | shared/notification-grammar.ts | low | mitigate | fixed `APPLY_HINT_TRAILER`, bytes pinned | closed |
| T-29-10 | Tampering | reconcile/apply.ts (empty apply) | medium | mitigate | RECON-05 checks bytes and mtimes unchanged | closed |
| T-29-11 | Elevation of privilege | dependency install on apply | low | accept | see Accepted Risks | closed |
| T-29-12 | Repudiation | notification-summary.ts | low | mitigate | `rowsNeedReload` folds row stamps only | closed |
| T-29-13 | Information disclosure | marketplace `will add/remove` rows | low | mitigate | header interpolates name and scope only | closed |
| T-29-14 | Elevation of privilege | reconcile/pending.ts, notify.ts | medium | mitigate | outside seams; plan-only projection | closed |
| T-29-15 | Denial of service | reconcile/pending.ts | low | accept | see Accepted Risks | closed |
| T-29-16 | Tampering | reconcile/pending.ts | medium | mitigate | no write or lock; byte-identical test | closed |
| T-29-17 | Info disclosure / EoP | `composePendingReport` | high | mitigate | not a seam; fs-only presence probe | closed |
| T-29-18 | Information disclosure | invalid-config block | medium | mitigate | basename row, redacted cause | closed |
| T-29-19 | Repudiation | reconcile/load.ts | low | mitigate | one block per invalid config, one row per corrupt state | closed |
| T-29-20 | Info disclosure / EoP | reconcile/convergence.ts | high | mitigate | not a seam; cold git target reads pin and version only | closed |
| T-29-21 | Information disclosure | catalog version strings in rows | low | accept | see Accepted Risks | closed |
| T-29-22 | Denial of service | reconcile/convergence.ts | low | accept | see Accepted Risks | closed |
| T-29-23 | Elevation of privilege | plugin/constraint-fold.ts | high | mitigate | import closure reaches no seam; no tag search | closed |
| T-29-24 | Info disclosure / Spoofing | plugin/constraint-fold.ts hold-row cause | medium | mitigate | quoted keys, fixed clause, allowlisted ranges present; but `describeConstraint` also interpolates the raw catalog `version` string (unbounded manifest text, predates the phase) | open — below high threshold (non-blocking) |
| T-29-25 | Tampering | reconcile/convergence.ts | high | mitigate | partially-available candidate on a clean record is declined | closed |
| T-29-26 | Info disclosure / EoP | git-source previews | high | mitigate | `coldGitOffer`/`gitOffer`; scenarios assert no git host request | closed |
| T-29-27 | Tampering | path containment | medium | mitigate | `assertPathInside` / `assertSafeName` (unchanged) | closed |
| T-29-28 | Spoofing / Info disclosure | `convergePlugin` | high | mitigate | cascade mode: stored credentials only, no Device Flow | closed |
| T-29-29 | Tampering | `CONVERGE_MATERIALIZATION` | high | mitigate | `overwrite: false`; edited agent kept | closed |
| T-29-30 | Tampering | partial moves | high | mitigate | `partial: move.partial` + runner guard | closed |
| T-29-31 | Denial of service | `convergeScope` loop | medium | mitigate | per-target failure isolation | closed |
| T-29-32 | Information disclosure | failed rows | medium | mitigate | closed-set reason only, no cause | closed |
| T-29-33 | Tampering | growth decline | high | mitigate | decline row, state unchanged | closed |
| T-29-34 | Denial of service | `lastReconciledExtensionVersion` | medium | mitigate | field stays optional and carried through | closed |
| T-29-35 | Tampering | `REMATERIALIZE_MATERIALIZATION` | high | mitigate | flips only `skipSameRevision` | closed |
| T-29-36 | Repudiation | PROJECT.md APL-D1 | low | mitigate | cites upstream sources with confidence | closed |
| T-29-SC | Tampering | dependencies | high | mitigate | no package or lockfile change in the phase | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**T-29-24 closure options (for the user):** bound the manifest `version` string at parse time (a `VERSION_PATTERN`-style allowlist), or amend T-29-24 to accept the stage-two version under T-29-21, since the same strings already render in the `will update` / `updated` version slots. Carried by BACKLOG VERSTR-01.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-29-01 | T-29-01 | `apply` is an explicit user command and `pending` lists every change first (D-02) | plan 29-01 threat model | 2026-10-24 |
| AR-29-02 | T-29-08 | `needsApply` is an optional additive wire field; `schemaVersion` stays 1 | plan 29-03 threat model | 2026-10-24 |
| AR-29-03 | T-29-11 | dependency installs on apply stay inside the cross-marketplace refusal | plan 29-05 threat model | 2026-10-24 |
| AR-29-04 | T-29-15 | `pending` takes no lock; a racing write only makes the preview stale | plan 29-07 threat model | 2026-10-24 |
| AR-29-05 | T-29-21 | catalog version strings render as given in version slots | plan 29-09 threat model | 2026-10-24 |
| AR-29-06 | T-29-22 | an unreadable candidate is logged and skipped | plan 29-09 threat model | 2026-10-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-24 | 37 | 36 | 1 (non-blocking) | gsd-security-auditor (ASVS L1, block_on high) |

**Auditor notes (not gaps):** the value-import closure of convergence.ts reaches `platform/git.ts` through the pre-existing plugin/shared → marketplace/shared edge; only pure symbols are called, but no gate stops a non-seam module from calling a seam function. The load can still save `state.json` through the AMIG-01 MCP move (D-22, intended).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-24

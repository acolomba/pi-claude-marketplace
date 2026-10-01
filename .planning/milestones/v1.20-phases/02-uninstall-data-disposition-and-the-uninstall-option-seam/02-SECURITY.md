---
phase: "02"
slug: "uninstall-data-disposition-and-the-uninstall-option-seam"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-14"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Raw arguments to typed options | Command input can select policy or be mistaken for a reference | CLI tokens -> `keepData: boolean` option |
| Resolved scope to filesystem | Plugin identifiers and data paths cross into recursive removal | scope + marketplace + plugin -> `rm(dataDir, { recursive: true })` |
| Durable uninstall to cleanup | Failed uninstall must retain data; preservation must still retire runtime resources | commit result -> post-commit hygiene phase |
| User argument text to uninstall operation | Unrecognized options must not initiate destructive default behavior | CLI tokens -> rejection vs. mutation |
| Catalog to handler and completion provider | Advertised options must match the accepted command contract | `flag-catalog.ts` -> handler parse set + completions |
| Operation outcome to user notification | Data policy must be explained without contradicting existing output | `keepData` -> rendered notification row |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | `runPostUninstallCleanup` | high | mitigate | `if (!keepData)` confines the data-directory `rm` to the deleting branch only; containment (`pluginDataDir`'s `assertPathInside`) resolves before the `rm` and its refusal propagates rather than being absorbed (operator-confirmed, see D-02-04/WR-07 note below); proven by `tests/orchestrators/plugin/uninstall.test.ts` (68/68, incl. the NFR-10 propagation case and the preservation-bypasses-cleanup case) | closed |
| T-02-02 | Tampering | consuming scanner / `makeUninstallHandler` | high | mitigate | Unknown short/long options rejected before dispatch via `isOptionToken`/`isUnacceptedLongFlag`; `--delete-data`, `-y`, `--yes` explicitly rejected with zero mutation; proven by `tests/edge/handlers/shared.test.ts` + `tests/edge/handlers/plugin/uninstall.test.ts` (3 explicit rejection-case references, part of the 108/108 combined run) | closed |
| T-02-03 | Elevation of privilege | Uninstall runtime cleanup | medium | mitigate | Preservation still retires hook routes, drops the marketplace cache, and runs clone GC — only the data-directory `rm` is skipped; proven by `tests/orchestrators/plugin/uninstall.test.ts::"preservation bypasses the data path while retiring routes, caches and the last clone"` | closed |
| T-02-04 | Denial of service | Reconcile uninstall | medium | mitigate | Omitted disposition (reconcile's only mode) deletes without prompting and a repeated reconcile pass converges silently with no repeated side effect; proven by `tests/orchestrators/reconcile/apply.test.ts` (`dataExistsAfterFirst === false`, 50/50 passing) | closed |
| T-02-05 | Tampering | Catalog and accepted-set guard | medium | mitigate | `flag-catalog.ts` is the sole declaration site for `--keep-data`; `tests/architecture/flag-catalog-drift.test.ts` pins the exact accepted/documented/omitted sets across parse, completion, and (post-WR-02 fix) `TOP_LEVEL_USAGE` text, with a planted-violation control | closed |
| T-02-06 | Information disclosure | Uninstall success output | low | mitigate | No retained-data filesystem path is ever rendered; the deleting branch stays byte-frozen (D-02-01). The code-review fix cycle (WR-06) added a bare `{data kept}` reason token on the preserving branch only — this echoes what the operator already typed, discloses no path or internal detail, and does not weaken the original mitigation's intent (no path trailer, no separate report); proven by `tests/shared/notification-grammar.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`, `tests/edge/handlers/plugin/uninstall.test.ts` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note on T-02-01 / WR-07:** the code-review cycle proposed (and briefly applied, then reverted) moving `pluginDataDir()`'s containment resolution inside the cleanup `try`, which would have made a symlink-containment refusal indistinguishable from an ordinary `rm` leak — silently absorbed rather than propagated. The operator reviewed this specific tradeoff (see `.planning/PROJECT.md` Key Decisions, D-02-04 reaffirmed row) and chose to keep the original propagating behavior. The final tree (commit `eeeb80eb`) matches T-02-01's original mitigation plan exactly: containment failures on the cleanup path still propagate.

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-14 | 6 | 6 | 0 | Claude (orchestrator, grep-level ASVS L1 verification against final source tree, post code-review fix cycle) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-14

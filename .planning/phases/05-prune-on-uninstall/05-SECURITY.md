---
phase: "05"
slug: "prune-on-uninstall"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-16"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Third-party plugin manifest -> uninstall decision | A `dependencies` array authored by a plugin author now decides whether the operator's uninstall proceeds, and which records a `--prune` sweep keeps | declared dependency keys |
| Declarer's on-disk manifest -> notification row | A read failure on another record's files is reported on the row of the plugin the operator named | error messages, field paths |
| `state.json` snapshot -> removal | The declarer set is derived from the same locked snapshot the removal mutates | install records |
| User command line -> multi-record removal | One typed flag (`--prune`) removes records the user did not name | plugin keys |
| Primary's committed removal -> member removals | Members run after the primary's artifacts are off disk and before the only save | artifact paths, data dirs |
| Documentation -> user expectation | Prose that overstates or understates what `--prune` removes misleads a destructive command's user | prose |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Denial of service | `assertNoDependents` / a crafted `dependencies` array | medium | accept | A hostile declaration can only HOLD a plugin (refuse its uninstall via `UninstallRefusedError("dependents remain", ...)`, `uninstall.ts:260`), never cause a removal — the fail-closed direction PRUNE-05 wants. Row text is assembled from allowlisted `name@marketplace` keys (`dependency-index.ts:162`). The remedy is documented at `docs/dependency-resolution.md:132` ("uninstall the dependents first"). See Accepted Risks Log AR-05-01 | closed |
| T-05-02 | Tampering | key matching in `buildScopeDeclarationIndex` | low | accept | Keys are exact `` `${dep.name}@${dep.marketplace ?? marketplace.name}` `` strings with the RESV-02 fill rule (`dependency-index.ts:162`); a declaration naming the target under another marketplace is "not a declarer", which errs toward refusing nothing extra. Best-effort against a declarer that wants its dependency removed, which is upstream's model. See Accepted Risks Log AR-05-02 | closed |
| T-05-03 | Race (TOCTOU) | index build vs record removal | high | mitigate | `assertNoDependents` is called at `uninstall.ts:1041` from inside the `withLockedStateTransaction` closure and builds the index from the locked `state` (`:239-260`); the refusal throws BEFORE `cascade(...)` runs at `:1045`, so no artifact leaves disk; the guard's no-throw-no-save contract (`transaction/with-state-guard.ts`, ST-7) makes "nothing removed" a property of the transaction; confirmed in `05-01-SUMMARY.md` Threat Flags | closed |
| T-05-04 | Information disclosure | the cause line on the refusal row and the reconcile row | medium | mitigate | The dependents arm carries `name@marketplace` tokens only (`uninstall.ts:260`); the declarer arm carries `redactAbsolutePaths(errorMessage(err))` with no `{ cause }` chaining (`dependency-index.ts:121, :141`, header `:38-41`); the reconcile spread is gated on `instanceof UninstallRefusedError` (`reconcile/apply.ts:391, :407`); proven by `tests/orchestrators/plugin/dependency-index.test.ts` ("T-05-04: the load-failure cause line redacts the absolute path and chains no cause") | closed |
| T-05-05 | Elevation of privilege | manifest reads under uninstall | medium | mitigate | `dependency-index.ts` contains no `join(` (grep 0) and `uninstall.ts`'s only `join(` is the string `dependents.join(", ")` (`:260`); every read goes through `loadMarketplaceManifest`, `lookupDeclaredPlugin`, and `readDependencyDeclaration` (`dependency-index.ts:48-49`, header `:15-19`), whose root derivation runs `assertPathInside` (NFR-10, verified in `03-SECURITY.md` T-03-29); `tests/architecture/manifest-read-agreement.test.ts` enrolls the reader and `gate-targets.ts:118` names `dependency-index.ts` | closed |
| T-05-06 | Denial of service | oversized or deeply nested manifest | low | accept | `parseDeclaredDependencies` is linear over one JSON array and `readManifestCandidate` stats before reading (verified in `03-SECURITY.md` T-03-30); no new parser is introduced in this phase. See Accepted Risks Log AR-05-03 | closed |
| T-05-07 | Tampering | `pruneOrphans` candidate set | high | mitigate | `domain/dependency-orphans.ts:119-120`: `.filter((record) => record.provenance === "dependency" && !gone.has(record.key))` runs BEFORE `.filter((record) => !isHeldBy(...))`, so an explicit record is unreachable by the sweep whatever any manifest says (header `:101`); proven by `tests/domain/dependency-orphans.test.ts` (three PRUNE-02 cases: no dependency-provenance record prunes nothing; an explicit record nothing declares survives; an explicit record declared only by the removed plugin survives) and `tests/orchestrators/plugin/uninstall.test.ts` ("PRUNE-02: an explicit record declared only by the named plugin is never pruned") | closed |
| T-05-08 | Denial of service | a crafted `dependencies` array that names every installed key | low | accept | A declaration can only HOLD a record (keep it), never cause a removal — same fail-closed direction as T-05-01; remedy `uninstall <declarer>` documented at `docs/dependency-resolution.md:140`. See Accepted Risks Log AR-05-04 | closed |
| T-05-09 | Repudiation (NFR-3) | member removal after the primary's cascade | high | mitigate | The member body is total (every failure becomes a warning row, never a throw — `uninstall.ts` member loop, header `:60`), `tx.save()` runs exactly once after the loop (`:1068` / `:1101`, WR-04 "ONCE"); proven by four D-05-13 cases in `tests/orchestrators/plugin/uninstall.test.ts` (agents refuse to unstage → warning row, whole record kept, nothing rolled back; partially unstaged → record shrunk; failed member still a declarer; no-cause fallback), each asserting the primary and first member are gone and one state was saved | closed |
| T-05-10 | Elevation of privilege | per-member data-dir and cache removal | medium | mitigate | Every member path comes from `ScopedLocations` getters — `locations.pluginCacheFile(marketplace)` (`uninstall.ts:773`) and `locations.pluginDataDir(marketplace, plugin)` (`:792`, resolved OUTSIDE the try per the NFR-10 comment at `:787`) — which run `assertSafeName` + `assertPathInside`; the sweep joins no path (grep above) | closed |
| T-05-11 | Information disclosure | member failure cause line | low | accept | Same cause channel the primary already uses (the `failure-permission-denied` precedent); no new path surface. See Accepted Risks Log AR-05-05 | closed |
| T-05-12 | Tampering | `--prune` reaching the reconcile path | medium | mitigate | `reconcile/apply.ts:359-367` calls `uninstallPlugin` with `{ ctx, pi, scope, cwd, marketplace, plugin, notifications }` and no `prune` key (grep: the only `prune` mention in `apply.ts` is the D-05-08 "never prunes" comment at `:420`); the edge handler sets `prune` only when the flag is consumed (`edge/handlers/plugin/uninstall.ts:62`, D-05-10 omission default); proven by `tests/orchestrators/plugin/uninstall.test.ts` ("D-05-08: without the option an orphan survives the uninstall of an unrelated plugin") and `tests/orchestrators/reconcile/apply.test.ts` ("D-05-16: a config-driven uninstall of a still-declared plugin is refused on every pass and converges once the dependent is gone"), with the D-04-05 reload-survival control unchanged | closed |
| T-05-13 | Repudiation | `docs/dependency-resolution.md` prune section | medium | mitigate | The section (`:130-162`) states the refusal row `{dependents remain}`, the pruned row `{dependency pruned}`, the `--keep-data` composition, the D-05-13 partial-failure behavior, the recursive sweep (D-05-01/02), and "A reload never prunes" (D-05-08) — each mapping to a pinned case or catalog state; the three load-bearing phrases are present (grep) | closed |
| T-05-14 | Tampering | the doc-agreement gate's failure table | low | mitigate | Both new sections sit before `## Why a dependency can fail`; the section under that heading contains neither `dependency pruned` nor `dependents remain` (grep 0, re-run 2026-09-16); `tests/architecture/dependency-doc-agreement.test.ts` (three RESV-06 cases) passes | closed |
| T-05-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this phase; `05-RESEARCH.md:269` records "this phase adds no package" with a `[VERIFIED]` marker. See Accepted Risks Log AR-05-06 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | A crafted `dependencies` array can only hold a plugin (refuse its uninstall), never cause a removal; this is the fail-closed direction the requirement asks for, the row cannot be forged (allowlisted keys), and the remedy is documented. Medium severity, below the `high` block threshold. | plan 05-01 register, confirmed in `05-01-SUMMARY.md` | 2026-09-16 |
| AR-05-02 | T-05-02 | Exact-key matching errs toward refusing nothing extra; a declarer that wants its dependency removed is upstream's model too. Low severity. | plan 05-01 register | 2026-09-16 |
| AR-05-03 | T-05-06 | No new parser; the existing linear parse and stat-before-read discipline (Phase 3, T-03-30) apply unchanged. Low severity. | plan 05-01 register | 2026-09-16 |
| AR-05-04 | T-05-08 | Same hold-only direction as T-05-01 applied to the prune sweep: a declaration can keep a record, never remove one. Low severity. | plan 05-02 register, confirmed in `05-02-SUMMARY.md` | 2026-09-16 |
| AR-05-05 | T-05-11 | Member failure causes travel the same channel the primary uninstall already uses; no new path surface. Low severity. | plan 05-02 register | 2026-09-16 |
| AR-05-06 | T-05-SC | No package-manager install task exists in this phase. Low severity. | all three plan registers, `05-RESEARCH.md:269` | 2026-09-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-16 | 15 | 15 | 0 | Claude (orchestrator, grep-level ASVS L1 verification against source tree at `8c6b7d02`; 8 mitigate rows verified in code/tests/docs, 7 accept rows verified as documented; the T-05-05 `join(` greps and the T-05-14 section grep re-run live) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-16

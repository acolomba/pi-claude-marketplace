---
phase: 13-conformance-refactor-es-5-supersession
verified: 2026-05-24T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
tests_pass:
  npm_test: 1142/1142
  catalog_uat: 3/3 (tests/architecture/catalog-uat.test.ts)
  no_legacy_markers: 1/1 (tests/architecture/no-legacy-markers.test.ts)
  markers_snapshot: 6/6 (tests/architecture/markers-snapshot.test.ts)
requirements_validated:
  - CMC-01
  - CMC-02
  - CMC-03
  - CMC-04
  - CMC-05
  - CMC-06
  - CMC-07
  - CMC-09
  - CMC-10
  - CMC-12
  - CMC-13
  - CMC-15
  - CMC-16
  - CMC-17
  - CMC-18
  - CMC-20
  - CMC-21
  - CMC-22
  - CMC-23
  - CMC-24
  - CMC-25
  - CMC-26
  - CMC-27
  - CMC-28
  - CMC-29
  - CMC-30
  - CMC-31
  - CMC-32
  - CMC-33
  - CMC-34
  - CMC-35
gaps: []
human_verification: []
---

# Phase 13: Conformance Refactor & ES-5 Supersession Verification Report

**Phase Goal:** Mechanically rewrite every user-visible `ctx.ui.notify` callsite onto Wave 1 composers (compact-line grammar, per-scope rendering, soft-dep markers, reload-hint, manual-recovery, rollback-partial, cause-chain), cascade-severity routing, per-command catalog conformance, and the ES-5 atomic three-file edit. After this phase, every command in `docs/output-catalog.md` renders the documented output.

**Verified:** 2026-05-24
**Status:** passed
**Re-verification:** No -- initial verification
**HEAD:** `32b8456` (branch `gsd/v1.3-replan-catalog`)

## Goal Achievement

### Observable Truths (5 Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Every command in `docs/output-catalog.md` produces byte-identical output to the catalog example | VERIFIED | `tests/architecture/catalog-uat.test.ts` PASS (3/3). Test reads `docs/output-catalog.md` at runtime, walks 45 `<!-- catalog-state: -->` annotations across every per-command H2, pairs each with a programmatic fixture, asserts byte equality against `renderRow` / `cascadeSummary` / `renderManualRecovery` / `renderRollbackPartial` / `renderPluginList` / `renderMarketplaceList` / `appendReloadHint`. Catalog covers all 12 commands listed in SC #1. |
| 2 | The 5 legacy ES-5 marker strings are absent from user-visible emission sites; the atomic supersession commit is in git history as a single 4-file commit | VERIFIED | `git show --stat c4d87d4` -> exactly 4 files: `extensions/pi-claude-marketplace/shared/markers.ts` (5 ES-5 exports deleted, only PUP-6 + D-08 retained), `tests/architecture/markers-snapshot.test.ts` (ES-5 block deleted), `docs/prd/pi-claude-marketplace-prd.md` (§6.12 rewritten to style-guide §15 pointer), `eslint.config.js` (BLOCK E + E-2 rolled back). `tests/architecture/no-legacy-markers.test.ts` PASS (1/1) -- pins the 5 literals byte-for-byte and scans `extensions/pi-claude-marketplace/` + `tests/` with only the 4 documented allow-list entries (markers.ts, markers-snapshot.test.ts, no-legacy-markers.test.ts, phase-ledger.ts header docstring per IN-01). Grep of `extensions/` for the 5 literals returns hits only in `presentation/README.md` (documentation-of-supersession) -- zero matches in user-visible emission paths. |
| 3 | Per-row soft-dep markers (`{requires pi-subagents}` / `{requires pi-mcp}`) fire per CMC-12/13 | VERIFIED | `presentation/compact-line.ts:104-178` declares `declaresAgents?: boolean` / `declaresMcp?: boolean` on `PluginListRow`, `PluginInlineRow`, `PluginCascadeRow`. `composeReasons()` at line 445-458 appends `"requires pi-subagents"` iff `(declaresAgents === true && !probe.piSubagentsLoaded)` and `"requires pi-mcp"` iff `(declaresMcp === true && !probe.piMcpAdapterLoaded)`. `PluginInlineUninstalledRow` (line 110 comment) has NO `declares*` fields -- MSG-SD-3 structurally enforced. Reasons closed-set in `shared/grammar/reasons.ts` extended; `tests/architecture/grammar-frontmatter.test.ts` green. Catalog UAT exercises soft-dep states. Legacy aggregated trailer retired (Plan 13-01-03 SUMMARY confirms `presentation/soft-dep.ts` thinned to probe-only). |
| 4 | Per-scope rendering + orphan-fold + adoption round-trip (CMC-03, CMC-21) | VERIFIED | `orchestrators/plugin/list.ts:7-17,410-486` implements the cross-scope walk + orphan-fold per D-13-19. `presentation/sort.ts:40-41` `compareByNameThenScope` uses `localeCompare(..., { sensitivity: 'base' })` with project-before-user tie-breaker. Plan `13-02d-01-SUMMARY.md` confirms `tests/integration/fold-adoption.test.ts` round-trips the adoption sequence (orphan -> add project-scope mp -> re-list -> adoption). Catalog UAT block at `docs/output-catalog.md:205-213` (orphan fold) exercised. `[<scope>]` bracket per MSG-PL-6 applied universally across surfaces per D-13-18. |
| 5 | Cascade severity routes per MSG-SR-4..6 (CMC-20) | VERIFIED | `presentation/cascade-summary.ts` defines `CascadeSeverity = "success" \| "warning"` (no `error` arm -- MSG-SR-6 structurally enforced); `cascadeSeverity(rows)` returns `warning` on any `failed` / `rollback failed` / `unavailable` / non-trivial `skipped` row, else `success`. Wired into `orchestrators/plugin/reinstall.ts:463`, `orchestrators/plugin/update.ts:809`, and the import / marketplace-remove / marketplace-update orchestrators (per Plans 13-02a-01, 13-02c-01 SUMMARY). Reload-hint MSG-RH-1 single canonical trailer `"/reload to pick up changes"` at `presentation/reload-hint.ts:RELOAD_HINT_TRAILER`. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extensions/pi-claude-marketplace/presentation/compact-line.ts` | RowSpec discriminated union + renderRow grammar composer | VERIFIED | 9 RowSpec variants; MSG-GR-1 token order, MSG-GR-2 @marketplace carve-out, MSG-GR-4 reasons block, MSG-GR-5 marker slot, MSG-IC-1..3 icons, MSG-SD-3 structural |
| `extensions/pi-claude-marketplace/presentation/cascade-summary.ts` | cascadeSummary + cascadeSeverity helper | VERIFIED | Severity literal union forbids `error`; sort applied via `compareByNameThenScope` |
| `extensions/pi-claude-marketplace/presentation/manual-recovery.ts` | renderManualRecovery composer | VERIFIED | MSG-MR-1..2 head + indented orphanDetails |
| `extensions/pi-claude-marketplace/presentation/rollback-partial.ts` | renderRollbackPartial composer | VERIFIED | MSG-RP-1 parent `(failed) {rollback partial}` + 2-space-indented children |
| `extensions/pi-claude-marketplace/presentation/cause-chain.ts` | causeChainTrailer depth-5 walker | VERIFIED | Re-exported from `shared/errors.ts` per D-11 layering |
| `extensions/pi-claude-marketplace/presentation/sort.ts` | compareByNameThenScope | VERIFIED | `localeCompare(..., { sensitivity: 'base' })` + project-before-user tie-breaker |
| `extensions/pi-claude-marketplace/presentation/reload-hint.ts` | appendReloadHint MSG-RH-1 single canonical trailer | VERIFIED | `"/reload to pick up changes"` |
| `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` | STATUS_TOKENS 15 entries (reinstalled added per D-13-20) | VERIFIED | `grammar-frontmatter.test.ts` green |
| `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` | REASONS closed-set extended with v1.3 additions | VERIFIED | 23 reasons per CMC-11 |
| `extensions/pi-claude-marketplace/shared/markers.ts` | Only PUP-6 + D-08 retained (5 ES-5 exports deleted) | VERIFIED | File header documents supersession; `RECOVERY_PLUGIN_REINSTALL_PREFIX` + `STATE_LOCK_HELD_PREFIX` only |
| `tests/architecture/catalog-uat.test.ts` | Byte-equality runner against docs/output-catalog.md | VERIFIED | PASS (3/3); 45 catalog-state annotations exercised |
| `tests/architecture/no-legacy-markers.test.ts` | Static-audit gate for 5 legacy ES-5 literals | VERIFIED | PASS (1/1); 4 allow-list entries documented |
| `tests/architecture/markers-snapshot.test.ts` | Drift-guard with ES-5 block removed | VERIFIED | PASS (6/6); AG-5 / PUP-6 / D-08 / D-09 blocks preserved |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `orchestrators/plugin/reinstall.ts` | `cascadeSummary` | `import { cascadeSummary } from "../../presentation/cascade-summary.ts"` (line 49); destructured `{message, severity}` (line 463) | WIRED |
| `orchestrators/plugin/update.ts` | `cascadeSummary` | `import { cascadeSummary }` (line 67); destructured (line 809) | WIRED |
| `orchestrators/plugin/list.ts` | `compareByNameThenScope` | `import { compareByNameThenScope } from "../../presentation/sort.ts"` (line 61) | WIRED |
| `orchestrators/plugin/list.ts` | orphan-fold computation | `computeOrphanFold` / fold rule at lines 410-486 | WIRED |
| `tests/architecture/catalog-uat.test.ts` | every Wave 1 composer | imports `appendReloadHint`, `cascadeSummary`, `renderManualRecovery`, `renderMarketplaceList`, `renderRow`, `renderPluginList` from `presentation/` (lines 47-54) | WIRED |
| Wave 2 sub-wave 2a orchestrators (reinstall / update / import) | `PluginCascadeRow` + per-row soft-dep | per Plan 13-02a-01 SUMMARY; catalog UAT runs all reinstall/update/import states | WIRED |
| Wave 2 sub-wave 2b orchestrators (install / uninstall / bootstrap) | `PluginInlineRow` / `PluginInlineUninstalledRow` | per Plan 13-02b-01 SUMMARY | WIRED |
| Wave 2 sub-wave 2c orchestrators (marketplace list/add/remove/update/autoupdate) | `MarketplaceRow` + cascadeSummary | per Plan 13-02c-01 SUMMARY | WIRED |
| Wave 2 sub-wave 2d (`/claude:plugin list`) | `PluginListRow` + orphan-fold | per Plan 13-02d-01 SUMMARY; fold-adoption integration test green | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm test` | 1142/1142 pass | PASS |
| Catalog UAT | `node --test tests/architecture/catalog-uat.test.ts` | 3/3 pass (1.7s) | PASS |
| Legacy marker static audit | `node --test tests/architecture/no-legacy-markers.test.ts` | 1/1 pass | PASS |
| Markers snapshot drift-guard | `node --test tests/architecture/markers-snapshot.test.ts` | 6/6 pass | PASS |
| ES-5 atomic commit shape | `git show --stat c4d87d4` | exactly 4 files modified (markers.ts, markers-snapshot.test.ts, prd.md, eslint.config.js) | PASS |
| Legacy ES-5 strings in extension code | `grep -rn "<5 literals>" extensions/pi-claude-marketplace/` | only doc-comment / documentation-of-supersession hits in `presentation/README.md` + `status-tokens.ts` + `reload-hint.ts` comments; zero in emission paths | PASS |

### Requirements Coverage

All 31 in-scope CMC requirements appear in `.planning/REQUIREMENTS.md` (lines 359-420), are referenced across Phase 13 SUMMARY frontmatter, and are validated by catalog UAT + dedicated unit/integration tests per `13-VALIDATION.md`.

| Requirement | Source Plan | Status | Validation Path |
| ----------- | ----------- | ------ | --------------- |
| CMC-01 | 13-01-01 | SATISFIED | catalog UAT (token order on every emission) |
| CMC-02 | 13-01-01, 13-02a-01 | SATISFIED | catalog UAT + structural typing (PluginCascadeRow omits `@<mp>`) |
| CMC-03 | 13-01-01, 13-02d-01 | SATISFIED | `compareByNameThenScope` + per-scope rendering on every surface; catalog UAT |
| CMC-04 | 13-01-01 | SATISFIED | catalog UAT + `grammar-frontmatter.test.ts` |
| CMC-05 | 13-02c-01 | SATISFIED | catalog UAT (marketplace add github / autoupdate enable) |
| CMC-06 | 13-01-01, 13-02d-01 | SATISFIED | catalog UAT (every plugin row) |
| CMC-07 | 13-02c-01 | SATISFIED | catalog UAT |
| CMC-09 | 13-01-01 | SATISFIED | TS structural -- `(upgradable)` restricted to `PluginListRow.status` via `Extract<StatusToken,...>` |
| CMC-10 | 13-02c-01, 13-02d-01 | SATISFIED | catalog UAT (empty bare-token routing via `notifySuccess`) |
| CMC-12 | 13-01-01 | SATISFIED | `requires pi-subagents` / `requires pi-mcp` in REASONS closed set; `grammar-frontmatter.test.ts` |
| CMC-13 | 13-01-01, 13-02a-01, 13-02d-01 | SATISFIED | `composeReasons` + unit `tests/presentation/compact-line.test.ts` |
| CMC-15 | 13-01-02, 13-02c-01 | SATISFIED | catalog UAT (marketplace remove partial; reload above retry, blank line) |
| CMC-16 | 13-01-02, 13-02a-02 | SATISFIED | `renderManualRecovery` + 6 callsites migrated; catalog UAT |
| CMC-17 | 13-01-02, 13-02a-02, 13-02b-01 | SATISFIED | `renderRollbackPartial` + chokepoint + child rows; catalog UAT |
| CMC-18 | 13-01-02 | SATISFIED | `causeChainTrailer` depth-5 walker; unit tests |
| CMC-20 | 13-01-02, 13-02a-01 | SATISFIED | `cascadeSeverity` literal union forbids `error`; unit tests |
| CMC-21 | 13-02d-01 | SATISFIED | orphan-fold + adoption integration test |
| CMC-22 | 13-02d-01 | SATISFIED | catalog UAT (`/claude:plugin list`) |
| CMC-23 | 13-02b-01 | SATISFIED | catalog UAT (`install`) |
| CMC-24 | 13-02b-01 | SATISFIED | catalog UAT (`uninstall`) |
| CMC-25 | 13-02a-01 | SATISFIED | catalog UAT (`reinstall`; `(reinstalled)` token per D-13-20) |
| CMC-26 | 13-02a-01 | SATISFIED | catalog UAT (`update`) |
| CMC-27 | 13-02a-01 | SATISFIED | catalog UAT (`import`) |
| CMC-28 | 13-02b-01 | SATISFIED | catalog UAT (`bootstrap`) |
| CMC-29 | 13-02c-01 | SATISFIED | catalog UAT (`marketplace list`) |
| CMC-30 | 13-02c-01 | SATISFIED | catalog UAT (`marketplace add`) |
| CMC-31 | 13-02c-01 | SATISFIED | catalog UAT (`marketplace remove` conditional bare vs header) |
| CMC-32 | 13-02c-01 | SATISFIED | catalog UAT (`marketplace update` autoupdate-on vs off) |
| CMC-33 | 13-02c-01 | SATISFIED | catalog UAT (`marketplace autoupdate enable\|disable`) |
| CMC-34 | 13-02b-01, 13-02c-01 | SATISFIED | catalog UAT (entity-shape vs usage-error split) + `tests/edge/router.test.ts` |
| CMC-35 | 13-01-03, 13-03-02 | SATISFIED | `no-legacy-markers.test.ts` static audit + ES-5 atomic commit `c4d87d4` |

No orphaned requirements: every CMC ID listed for Phase 13 in REQUIREMENTS.md Coverage table (lines 730-764) appears in at least one Phase 13 plan / SUMMARY.

### Anti-Patterns Found

None blocking. Code-review findings (WR-01 + WR-02 + IN-01 + IN-04 + IN-05) already addressed in commits `6caa431`, `5ae15fe`, `19680a8`, `d104acc`, `3de0c0f`. IN-02 + IN-03 skipped with rationale in `13-REVIEW-FIX.md` (architectural decision + doc-only on historical artefacts).

Spot-checked for `TBD` / `FIXME` / `XXX` debt markers in Phase 13-modified files -- zero unresolved.

### Human Verification Required

None. The phase's contract is byte-equality-with-catalog (`tests/architecture/catalog-uat.test.ts`) and ES-5 marker absence (`tests/architecture/no-legacy-markers.test.ts`), both fully automated. No `<verify><human-check>` blocks deferred in any Phase 13 PLAN. No visual / real-time / external-service surfaces in scope.

### Gaps Summary

None. All 5 success criteria observably met; all 31 in-scope CMC requirements validated; ES-5 atomic commit shape (single 4-file commit `c4d87d4`) confirmed; full test suite 1142/1142 green.

---

_Verified: 2026-05-24_
_Verifier: Claude (gsd-verifier)_

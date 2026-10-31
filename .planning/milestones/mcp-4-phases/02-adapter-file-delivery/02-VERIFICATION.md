---
phase: 02-adapter-file-delivery
verified: 2026-10-09T23:45:56Z
status: passed
score: 5/5 roadmap success criteria verified; both previous gaps closed (gap-closure plans 02-09..02-12, 41 plan truths, 3 backstop); 8 new judgment-tier prohibitions approved by the operator; review IN-04 fixed (6cb09db2, D-02-23)
covered_files:
  - .planning/phases/02-adapter-file-delivery/02-01-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-01-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-02-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-02-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-03-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-03-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-04-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-04-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-05-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-05-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-06-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-06-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-07-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-07-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-08-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-08-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-09-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-09-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-10-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-10-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-11-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-11-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-12-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-12-SUMMARY.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
  - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/shared/atomic-json.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - package.json
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/legacy.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
covered_digest: "v3:sha256:ad2c3e0520642c7e43d03a73d4b67ed3a51c9c4bcebca02365f09283dc7c26fb"
behavior_unverified: 0
re_verification: "scoped; baseline 1b1e39a3; head 3df6309c"
overrides_applied: 0
gap_closure_re_verification:
  previous_status: "gaps_found"
  previous_score: "5/5 roadmap success criteria verified; 2 gaps (stub absorption loses user fields; D-02-NN source citations)"
  gaps_closed:
    - "Install, update, reinstall and uninstall never lose anything the user wrote in mcp-adapter.json, including a marker-less override stub under one of the plugin's server names (D-02-21 as amended by D-02-22)"
    - "Source comments cite requirement IDs, never milestone decision IDs (rg -n 'D-02-(19|20|21|22)' extensions tests prints nothing; the 11 v1.20 D-02-0x lines are unchanged)"
  gaps_remaining: []
  regressions: []
  prior_human_items: "Item 1 (stub absorption) became gap 1 and is closed. Item 2 (the 11 judgment-tier prohibitions of 02-01..02-08) was approved by the operator on 2026-10-04; the gap-closure code does not change their verdict."
human_verification_resolved:
  - item: "8 judgment-tier prohibitions added by gap-closure plans 02-09..02-12"
    resolution: "Operator approved all 8 on 2026-10-04"
  - item: "Review IN-04: plugin-declared carried fields added to the user's written-back override"
    resolution: "Operator chose a fix (D-02-23, amends D-02-22). 6cb09db2 writes back only the carried fields the user's stub had, each with the live entry's value; a carried field the stub lacked is never added"
---

# Phase 2: Adapter-file delivery Verification Report

**Phase Goal:** Install, update, reinstall and uninstall keep a plugin's MCP servers as marked entries in `<scopeRoot>/mcp-adapter.json`, and never lose or corrupt anything the user or the adapter wrote in that file.
**Verified:** 2026-10-04T11:05:00Z; finalized 2026-10-06 after the operator approved the gap-plan prohibitions and 6cb09db2 fixed IN-04 (D-02-23)
**Status:** passed
**Re-verification:** Yes, after gap closure (plans 02-09..02-12, fix commit 4a206e4a for D-02-22, fix commit 6cb09db2 for D-02-23). Verified at a638f5e0; finalized at HEAD 9940d472 (merges of `main` since 15c26e70).

## Gap closure

### Gap 1: a user's marker-less override stub is no longer lost (D-02-21, D-02-22): CLOSED

| Requirement of D-02-21/22 | Code | Behavioral evidence | Status |
|---|---|---|---|
| Stub kept verbatim and inert in `_piClaudeMarketplace.keptOverride` | `stage.ts:285` passes `keptOverrides: { ...keptOverrides, ...overlays }` (raw stub objects) to `stampServers`; `adapter-entry.ts:175-179` puts it in the marker via `buildMarker` (`marker.ts:80-88`, `keptOverride` last) | Independent probe (`/tmp/afile-probe2/probe.ts`, hermetic HOME, real bridge modules, BOM + comments + trailing commas + `mcp-servers` file): marker `keptOverride` equals the stub byte-for-byte, including `env`, `headers`, `directTools` | ✓ VERIFIED |
| Carried fields become active; credentials never do | `carriedFields` reads only the 9 `CARRIED_FIELDS` (`adapter-entry.ts:19-29,87-100`); `restoredOverride` takes non-carried fields only from the kept override (`:124-139`) | Probe: active entry holds `disabled: true`, no `headers`, no `directTools`, `env` holds only injected vars (no `secret-val`); same in `tmp/p2-10-adapter-proof.log` checkA (`envWithoutStubToken`, `noBearerToken`, `noHeaders` all true) | ✓ VERIFIED |
| Carried through update and reinstall | `partitionServers` returns `keptOverrides` for the plugin's own entries (`adapter-doc.ts:227-245,251-271`); restage keeps them | Probe: second stage keeps `keptOverride` identical, emits no notice. Integration test asserts the project entry after update and the bytes after reinstall | ✓ VERIFIED |
| Written back on uninstall and every unstage, live carried fields replacing kept ones (D-02-22), and only the carried fields the stub had (D-02-23) | `survivingEntry` returns `restoredOverride(kept, entry)` for an owned, non-restaged entry (`adapter-doc.ts:307-320`); `unstageMcpServers` writes `withPluginServers(..., {})` (`unstage.ts:157`); its single orchestrator caller is `cascadeUnstagePlugin` (`marketplace/shared.ts:447`), behind uninstall, disable, prune, marketplace remove, cascade undos and reconcile | Probe: after a simulated `/mcp-adapter enable` (deletes `disabled`), unstage writes back `{env, headers, directTools}` under `mcp-servers`; an update that drops the server also writes it back; a tampered full-definition `keptOverride` is not written back. Integration: `AFILE-06: a user-scope plugin disabled in the project keeps that disable ...` asserts project-scope uninstall leaves the project file **byte-identical** to the user's original and the user-scope file unchanged at every step; `... /mcp-adapter enable made while the plugin is installed survives plugin disable, enable and uninstall` covers D-02-22; `AFILE-06: uninstall writes back no carried field the plugin's entry declares and the user's override lacks` covers D-02-23 (6cb09db2) | ✓ VERIFIED |
| Install warns once (`MCP server override kept.`) naming fields that stop applying | `overrideKeptNotices` (`stage.ts:150-174`) uses `inactiveOverrideFields`; seam `notifyMcpConfigNotices` (`notification-dispatch.ts:258-336`) renders field names only and cancels a keep that a later `override-restored` writes back; catalog block `docs/output-catalog.md:4171-4185` byte-locked by `tests/architecture/mcp-config-notices.test.ts` | Integration test asserts exactly one `MCP server override kept.` warning on project install naming `env`, none on update/reinstall/uninstall. Probe: `fields: ["env","headers","directTools"]`, no value in any notice | ✓ VERIFIED |
| Adapter ignores the marker contents | — | `/tmp/pmaverify/package` is `pi-mcp-adapter` 5.0.0; `grep -rl '_piClaudeMarketplace\|keptOverride' dist` finds nothing. `tmp/p2-10-adapter-proof.log` (real adapter loader): effective entry applies no marker field, `consoleCalls: []`, adapter enable writer keeps the marker. The log predates 4a206e4a, but that commit changes only write-back, not the marker shape the adapter reads | ✓ VERIFIED |

Note: the adapter's project-approval hash covers the whole entry, so a change to `keptOverride` changes the hash (stated in plan 02-10's truth; not a loss).

### Gap 2: no milestone decision IDs in source: CLOSED

- `rg -n 'D-02-(19|20|21|22)' extensions tests`: no output (exit 1). `rg -n 'D-02-1[0-9]' extensions tests`: no output.
- `rg -n 'D-02-0[0-9]' extensions tests`: exactly 11 lines (v1.20 citations), and `git diff ceb44007 HEAD -- extensions tests` shows no `D-02-0x` line changed.
- Commit 3ca08c36 (plan 02-09) changes only comment lines and 10 `test(` title lines (D-02-19/20 → NFR-3, one → AFILE-04); no code token changed.

## Goal Achievement

### Observable Truths (ROADMAP success criteria, regression check)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Install writes marked entries into the scope's `mcp-adapter.json`; uninstall removes exactly those; NFR-10 / locations / containment name the file (AFILE-01) | ✓ VERIFIED | Unchanged paths (`locations.ts`, `stage.ts` write target). Uninstall now replaces an owned entry with the user's kept override instead of deleting it; an entry with none is removed as before (probe scenario C, integration). Integration asserts no `mcp.json` is created in either scope. |
| 2 | Comments/trailing commas/BOM file installs and keeps foreign keys; unparseable file refuses with typed error and exact bytes; comment loss warned once (AFILE-02, AFILE-04) | ✓ VERIFIED | `readMcpConfigDoc` unchanged. Probe: `settings`, `zzz`, `mine`, `last` survive install and uninstall of a BOM + comment + trailing-comma file; `comments-dropped` notice emitted before `override-kept`. |
| 3 | Legacy `mcp-servers` key honored (AFILE-03) | ✓ VERIFIED | Probe: entry staged and override written back under `mcp-servers`; no `mcpServers` key added. |
| 4 | Full-definition collisions reported with the winning source; partial entries are overrides (AFILE-05) | ✓ VERIFIED | Collision walk unchanged. `restorableOverride` (`adapter-doc.ts:113-116`) writes back only a partial, marker-less value, so a write-back never creates a collision; integration asserts a later user-scope install is not refused. |
| 5 | User override in our entry survives update and reinstall; closed carried set pinned against `ServerEntry` (AFILE-06) | ✓ VERIFIED | `CARRIED_FIELDS` unchanged (9 fields). Integration asserts `disabled: true` survives update and reinstall. |

**Score:** 5/5 roadmap truths verified, 0 present-but-behavior-unverified. Gap-plan truths (02-09: 5, 02-10: 14, 02-11: 11, 02-12: 9; 3 backstop) map to code and passing tests; the backstops are accepted windows (prepare-to-commit, notice ordering) or title-only renames.

### Required Artifacts (gap plans)

| Artifact | Expected | Status |
|----------|----------|--------|
| `bridges/mcp/marker.ts` | `keptOverride` member, `buildMarker(…, keptOverride?)`, `keptOverrideOf` | ✓ VERIFIED (99 lines; used by adapter-entry, adapter-doc) |
| `bridges/mcp/adapter-doc.ts` | `keptOverrides` partition, in-place write-back, `restoredOverrideNames` | ✓ VERIFIED |
| `bridges/mcp/adapter-entry.ts` | `keptOverrides` input, `inactiveOverrideFields`, `restoredOverride` | ✓ VERIFIED |
| `shared/notification-dispatch.ts` | `override-kept` / `override-restored`, fold, `MCP server override kept.` | ✓ VERIFIED |
| `docs/output-catalog.md` | `catalog-state: mcp-override-kept` | ✓ VERIFIED (`:4173`) |
| `docs/prd/pi-claude-marketplace-prd.md` | MC-5 names `keptOverride` | ✓ VERIFIED (`:480`) |
| `tests/integration/mcp-override-lifecycle.test.ts` | Real-operation lifecycle | ✓ VERIFIED (3 cases, 454 lines) |
| `.planning/BACKLOG.md` MCPOVR-01 | Updated for `keptOverride` | ✓ VERIFIED (`:3765-3772`) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `stage.ts` | `adapter-entry.ts` | `keptOverrides: { ...keptOverrides, ...overlays }` (`:285`) | ✓ WIRED |
| `adapter-doc.ts` | `marker.ts` | `keptOverrideOf(` in `restorableOverride` | ✓ WIRED |
| `unstage.ts` | `adapter-doc.ts` | `withPluginServers(target.config, …, {})` (`:157`), `restoredOverrideNames(` (`:121`) | ✓ WIRED |
| `marketplace/shared.ts` | `unstage.ts` | `unstageMcpServers(` (`:447`), the only orchestrator call site | ✓ WIRED |
| `stage.ts` | `adapter-entry.ts` | `inactiveOverrideFields(` (`:160`) | ✓ WIRED |
| `mcp-config-notices.test.ts` | `output-catalog.md` | byte lock of `mcp-override-kept` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| marker `keptOverride` | user stub | `partitionServers(...).overlays` from the bytes read at prepare | Yes | ✓ FLOWING |
| written-back override | kept override + live carried fields | `keptOverrideOf(entry)` + `carriedFields(entry)` at unstage read | Yes | ✓ FLOWING |
| `override-kept` notice | field names | `inactiveOverrideFields(overlay)` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MCP bridge, notices seam, catalog lock, locations, errors, atomic-json | `node --test tests/bridges/mcp/*.test.ts tests/architecture/mcp-config-notices.test.ts tests/shared/notification-dispatch.test.ts tests/persistence/locations.test.ts tests/shared/errors-bridges.test.ts tests/shared/atomic-json.test.ts` | 558/558 pass | ✓ PASS |
| Real-operation override lifecycle | `node --test tests/integration/mcp-override-lifecycle.test.ts` | 3/3 pass | ✓ PASS |
| Every orchestrator suite (plugin, marketplace, reconcile, import) | `node --test tests/orchestrators/{plugin,marketplace,reconcile,import}/*.test.ts` (log `tmp/verify02r-orch.log`) | 3140/3140 pass | ✓ PASS |
| Phase 1 regression | `node --test tests/architecture/peer-floor.test.ts tests/platform/pi-api.test.ts tests/shared/concerns/soft-dep.test.ts` | 85/85 pass | ✓ PASS |
| Independent stage/update/enable/unstage/drop/tamper probe | `node /tmp/afile-probe2/probe.ts` (hermetic HOME) | all expected (see Gap 1 table) | ✓ PASS |
| No dropped test cases in the gap diff | title diff of `adapter-entry.test.ts` at 7fd15b22 vs HEAD; case counts of uninstall/prune tests | 0 titles lost; 11→20, 99→100, 33→35 | ✓ PASS |
| Full `npm run check` | orchestrator runs | a638f5e0 passed (`tmp/check02c.log` CHECK_EXIT=0, 8875 unit, 68 integration); 6cb09db2 passed its focused hook run (`tmp/d0223-precommit.log`); HEAD 9940d472 after the `main` merges: `tmp/check02d.log` CHECK_EXIT=0 | ✓ PASS |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` declared or present. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| AFILE-01 | 02-01, 02-02, 02-09, 02-10, 02-12 | ✓ SATISFIED | Truth 1; write-back through every unstage |
| AFILE-02 | 02-01, 02-04 | ✓ SATISFIED | Truth 2 |
| AFILE-03 | 02-01, 02-10 | ✓ SATISFIED | Truth 3; override kept/written back under `mcp-servers` |
| AFILE-04 | 02-04..02-09, 02-11, 02-12 | ✓ SATISFIED | Truth 2; comments notice ordered before override notice |
| AFILE-05 | 02-02, 02-10, 02-12 | ✓ SATISFIED | Truth 4 |
| AFILE-06 | 02-03, 02-10, 02-11, 02-12 | ✓ SATISFIED | Truth 5; gap 1 |

No orphaned requirement.

### Prohibitions

The 11 prohibitions of 02-01..02-08 were approved by the operator on 2026-10-04. The gap-closure code does not change their verdict: credential fields still never become active (they live only inside the inert marker), no parser text is surfaced, no new key shadows a user server, and the write-back is always a partial entry.

New judgment-tier prohibitions from the gap plans (verifier verdict non-authoritative; the operator approved all 8 on 2026-10-04):

| Plan | Prohibition | Verdict | Evidence |
|------|-------------|---------|----------|
| 02-09 | MUST NOT change a v1.20 `D-02-0x` citation, any code token, or any other line | Holds | 3ca08c36 changes 24 lines, all comments or `test(` titles; D-02-0x lines unchanged |
| 02-10 | MUST NOT copy a credential-bearing override field into any field outside `keptOverride` | Holds | `carriedFields` is closed to 9 non-credential fields; probe and adapter proof log |
| 02-10 | MUST NOT drop a user override silently | Holds | Kept at stage, carried at restage, written back at unstage and at a stage that drops the server (probe). By D-02-22, a kept carried field the live entry no longer has is left out (the adapter's own enable removed it) |
| 02-10 | MUST NOT rename `_piClaudeMarketplace`, `plugin`, `marketplace`, or make a marker without `keptOverride` unreadable | Holds | `marker.ts:15,41-69` |
| 02-10 | MUST NOT write back a non-override `keptOverride` | Holds | `restorableOverride` requires `isOverlay`; probe scenario C writes nothing back |
| 02-11 | MUST NOT put any override field value in a notice | Holds | `mcpOverrideKeptLine` interpolates plugin, server, scope, file and field names only; probe |
| 02-11 | MUST NOT show override-kept for an override the same command wrote back | Holds | `standingOverrideNotices` fold; notification-dispatch and install-flow tests |
| 02-12 | MUST NOT let a write-back change any file but the one that held the entry | Holds | Integration asserts the user-scope file byte-identical across project install/update/reinstall/uninstall |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 30 files changed since 7fd15b22 | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `tests/orchestrators/plugin/uninstall.test.ts` | 5288 | "Phase 5" planning reference in a comment | ℹ️ Info | Pre-existing (8b6ac3bc6, 2026-10-01), not from this phase |
| `bridges/mcp/adapter-entry.ts` | 127 | `restoredOverride` appended carried fields that only the live entry held, including plugin-declared ones (review IN-04) | ✓ Resolved | Fixed by 6cb09db2 under D-02-23: only the stub's own carried fields come back. Unit test `a carried field the plugin's live entry declares and the kept override lacks is not added`; integration test `uninstall writes back no carried field the plugin's entry declares and the user's override lacks` |
| `bridges/mcp/adapter-doc.ts` | 357-383 | A restaged entry is appended after the kept entries, so a written-back override sits at the end of the map rather than at the stub's original position | ℹ️ Info | Key order only; the adapter does not read order. Matches plan 02-10's stated rule |

Other deferred gap-review Info items (IN-01 fold test, IN-02 asymmetric fact model, IN-03 duplicate `isPlainObject`, IN-05 `{}` write-back, IN-06 comment width) do not threaten the goal.

### Human Verification (resolved)

1. **Gap-closure judgment-tier prohibitions:** the operator approved all 8 on 2026-10-04.
2. **Plugin-declared carried fields in a written-back override (IN-04):** the operator chose a fix over an override (D-02-23). 6cb09db2 writes back only the carried fields the user's stub had; the stub `{"disabled": true}` under a plugin entry that declares `lifecycle` and `debug` now comes back as `{"disabled": true}`.

### Deferred to later phases (not gaps)

- Live adapter loading of the written entries: Phase 7 live UAT (ADOC-02).
- IN-02 (full-phase review) stale legacy `mcp.json` entries after update/reinstall: ROADMAP Phase 5 Notes.
- `requestTimeoutMs` translate-vs-carry, and how write-back treats a carried field that Phase 3's translation writes: ROADMAP Phase 3 Notes ("Carried from Phase 2 (D-02-22)"). D-02-23 already keeps a plugin-declared carried field the stub lacked out of the write-back.
- MCPOVR-01: a choice written into the plugin's own entry with no kept override still does not survive disable/enable (BACKLOG, updated).

### Gaps Summary

Both previous gaps are closed. A user's marker-less override stub is now kept verbatim inside the marker, carried through update and reinstall, and written back on every unstage; the cross-scope integration test proves a project uninstall restores the user's original bytes exactly. No `D-02-19..22` citation remains in source or test titles, and the v1.20 citations are untouched. The five success criteria and AFILE-01..06 show no regression across 3,786 targeted tests and an independent probe. The operator approved the 8 new judgment-tier prohibitions, and 6cb09db2 (D-02-23) fixed review IN-04, so a written-back override no longer gains plugin-declared carried fields. Status is `passed`.

## Re-verification (2026-10-09)

**Scope:** scoped re-verification. Baseline `bf456487` (last write of this report), head `51ebbc07` (branch `features/mcp-4`). The report read `stale` because phases 3 to 7 of the milestone and a merge of `origin/main` edited files in `covered_files`. Phase 2's findings above are kept unchanged. Result: **every truth still holds, as amended**, status stays `passed`.

### Changed covered files since bf456487

- `docs/output-catalog.md`, `package.json` (peer `pi-mcp-adapter` `>=5.0.0` to `>=5.2.0 <6`, D-07-07, D-04-12)
- `bridges/mcp/{adapter-doc,adapter-entry,marker,stage,types}.ts` (`adapter-doc.ts` changed one comment line only)
- `orchestrators/marketplace/shared.ts`, `orchestrators/plugin/{enable-disable,install-cascade,install-disable-cascade,install-flow,install-outcome,reinstall-replace,update-swap}.ts`, `orchestrators/reconcile/apply.ts`
- `persistence/locations.ts` (merge of main, PR #248: comment and doc text about the workflows root only; the `mcpAdapterJsonPath` lines are untouched)
- `shared/errors-bridges.ts` (adds `definedAs` to `McpServerCollisionError` and a new `McpServerKeyCollisionError`), `shared/notification-dispatch.ts` (new notice kinds, section order, fold)
- Untouched since baseline (empty `git diff`): `bridges/mcp/{unstage,collision-slots,collision-ancestors,safe-set}.ts`, `orchestrators/plugin/uninstall.ts`, `shared/atomic-json.ts`. The new bridge modules `adapter-escape.ts`, `legacy.ts`, `substitute.ts` come from phases 4 and 5.

### Amendments that bear on Phase 2 (all deliberate, none breaks a Phase 2 promise)

- **Entry key (ANAME-01, Phase 3):** the entry sits under `plugin_<plugin>_<server>_`, with `toolPrefix: "mcp"` and `directTools: "search"`, so a user override of our entry is a stub under that key. The lifecycle tests were renamed from `srv` to `plugin_hello_srv_`; every assertion about survival and write-back is unchanged.
- **Closed field table and plugin-set fields (ANAME-07, Phase 3):** the carried set (`CARRIED_FIELDS`, 9 fields) is unchanged. The plugin's `timeout` may set `requestTimeoutMs`; the marker then lists it in `pluginSetFields`, carry-forward skips it, and write-back restores the user's own value. This is the decision Phase 2's roadmap note deferred to Phase 3 (D-02-22 carry-over note).
- **Collision walk (ANAME-03, D-03-12, D-03-13, D-03-17):** keys are compared after folding `-` to `_`; a new `McpServerKeyCollisionError` refuses two servers of one plugin that fold to one key. The nine-source later-wins walk and the "partial entry is an override" rule are untouched (`collision-slots.ts` unchanged).
- **Variables and credentials (AVAR, Phase 4):** new notice kinds follow `override-kept` in the notice order; the Phase 2 order `comments-dropped`, `left-unchanged`, `override-kept` is unchanged.
- **Migration (AMIG, Phase 5, D-05-08 to D-05-10):** every staging path finishes the `mcp.json` move after writing `mcp-adapter.json`, with byte rollback. A stage also drops old-name leftovers the adapter wrote for the moved legacy entries: a stub kept while any source still defines the name, a panel copy (`directTools` full definition) always, a user's own full server never. Each removal is announced by a `leftover-removed` notice. D-05-09 states that nothing is carried from a legacy entry (supersedes D-02-06). This narrows "never lose anything the user wrote" to the old-name cleanup that D-05-10 names; it does not touch content under the new key or any unrelated server.
- **Project-scope writes (D-05-08 narrowed 2026-10-09):** a stage writes only its own scope's files; project-file stub removal for a user-scope plugin takes only the project scope lock (`removeProjectDisableStubs`).

### Per-truth table

| Truth | Touched by | Result | Evidence |
|-------|-----------|--------|----------|
| 1. Install writes marked entries into the scope's `mcp-adapter.json`, uninstall removes exactly those; NFR-10 / locations / containment name the file (AFILE-01) | `stage.ts` (key, legacy sweep), `shared.ts` (`cascadeUnstagePlugin` dropped-name mapping), `locations.ts` (comments only) | HOLDS (as amended by ANAME-01, AMIG-02) | `locations.ts:66,212,293` still derive `mcpAdapterJsonPath` as `<scopeRoot>/mcp-adapter.json`; `stage.ts:420,588` write only that file (plus the scope's `mcp.json` removal at `:630`, inside the NFR-10 set, which keeps `mcp.json` for legacy entries); `unstage.ts` unchanged and still the sole path (`shared.ts` `unstageMcpServers`). `tests/persistence/locations.test.ts` and `tests/bridges/mcp/unstage.test.ts` pass; `mcp-override-lifecycle` asserts install, update, reinstall, uninstall bytes. |
| 2. JSONC file with comments, trailing commas, BOM installs and keeps foreign keys; unparseable file refuses with typed error and exact bytes; comment loss warned once (AFILE-02, AFILE-04) | `stage.ts`, `notification-dispatch.ts`, `errors-bridges.ts`, `output-catalog.md` | HOLDS | `readMcpConfigDoc` unchanged (`adapter-doc.ts` comment only). `stage.ts:420-430` still returns `left-unchanged` for a noop and throws `McpConfigFileError` with servers (`readTargetConfig`, `:374-387`); `commentsDroppedNotices` first in `notices` (`:540`). `stage.test.ts` AFILE-02 and AFILE-04 cases (`:443,475,543,579,614`) and `adapter-doc.test.ts` BOM case pass; catalog byte lock `mcp-config-notices.test.ts` passes. |
| 3. Legacy `mcp-servers` key honored (AFILE-03) | `stage.ts`, `adapter-doc.ts` (comment) | HOLDS | `withPluginServers(config, ...)` writes under `config.serverKey` (`stage.ts:514`); `stage.test.ts:641,680,1494,1533` (AFILE-03 cases) pass at HEAD. |
| 4. Full-definition collision reported with the winning source; partial entry is an override (AFILE-05) | `stage.ts` (fold by `-`/`_`), `errors-bridges.ts` (`definedAs`) | HOLDS (as amended by ANAME-03, D-03-12/13/17) | `assertNoMcpCollisions` (`stage.ts:192-219`) still walks `walkMcpSources` (unchanged) and throws `McpServerCollisionError(name, owner.sourcePath, winningPath, owner.key)`; a marker-less partial entry is not a declarer (`isFullDefinition` in `adapter-doc.ts:94`, used at `collision-slots.ts:156`, both unchanged apart from one comment). `stage.test.ts:849-1083` AFILE-05 cases, including the disable-stub case `:994`, pass. |
| 5. User override in our entry survives update and reinstall; closed carried set pinned against `ServerEntry` (AFILE-06) | `adapter-entry.ts`, `marker.ts`, `update-swap.ts`, `reinstall-replace.ts` | HOLDS (as amended by ANAME-07) | `CARRIED_FIELDS` is still the 9 fields. `adapter-entry.test.ts:1061` pins the vendored `ServerEntry` keys against the 5.2.0 floor and ran with 0 skips (`PI_MCP_ADAPTER_ROOT` 5.2.0). Integration `mcp-override-lifecycle` (4 cases, incl. new ANAME-07 case) shows `disabled: true` surviving update and reinstall, `keptOverride` in the marker, byte-identical user file across a project lifecycle, and write-back on uninstall. |
| Gap 1: marker-less stub kept verbatim, written back on every unstage (D-02-21/22/23) | `marker.ts`, `adapter-entry.ts`, `adapter-doc.ts`, `shared.ts` | HOLDS (as amended by ANAME-07, D-05-10) | `restoredOverride` still writes back only the stub's own carried fields with live values (`adapter-entry.ts`, plus the plugin-set branch); `unstage.ts` unchanged. Integration cases `a /mcp-adapter enable made while the plugin is installed survives ...` (D-02-22) and `uninstall writes back no carried field the plugin's entry declares ...` (D-02-23) pass. The only user-content removal added since is the D-05-10 old-name cleanup above, which never touches the new key. |
| Gap 2: no `D-02-19..22` in source or titles; 11 v1.20 `D-02-0x` lines intact | any commit | HOLDS | `rg -n 'D-02-(19\|20\|21\|22\|23)' extensions tests` and `rg -n 'D-02-1[0-9]' extensions tests` print nothing (exit 1); `rg -n 'D-02-0[0-9]' extensions tests` prints 11 lines; `git diff ceb44007 HEAD -- extensions tests` shows no `D-02-0x` line changed. |
| Notice order and wording of `override-kept` (D-02-21, plan 02-11) | `notification-dispatch.ts`, `stage.ts` | HOLDS | Section order is still `comments-dropped`, `left-unchanged`, `override-kept` first, new kinds after; `inactiveOverrideFields` now also lists plugin-set fields. Lifecycle integration asserts the exact `MCP server override kept.` text with the new key. |
| Prohibitions (credentials never active, no value in notices, write-back never a full definition) | `adapter-entry.ts`, `stage.ts`, phase 4 | HOLDS | `CARRIED_FIELDS` carries no credential field; `no-credential-leak.test.ts` and the notices tests pass; `restorableOverride` unchanged. Phase 4 withholds deny-listed credentials before they reach an entry, which strengthens the promise. |

### Commands run (all from the repo root, `TMPDIR=/var/tmp/mcp4-reverify-p2`, `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`)

| Command | Exit | Result |
|---------|------|--------|
| `node --test tests/bridges/mcp/*.test.ts tests/architecture/{mcp-config-notices,mcp-migration-notice,no-credential-leak,peer-floor}.test.ts tests/shared/{notification-dispatch,errors-bridges,atomic-json}.test.ts tests/persistence/locations.test.ts` | 0 | 872 pass, 0 fail, 0 skipped |
| `node --test tests/integration/{mcp-override-lifecycle,mcp-migration,mcp-legacy-sweep,mcp-variable-expansion,mcp-tool-rules,mcp-home-path-partial,standalone-prune}.test.ts` | 0 | 55 pass, 0 fail, 0 skipped |
| `node --test tests/integration/{adapter-expansion-conformance,mcp-status-conformance}.test.ts` | 0 | 55 pass, 0 fail, 0 skipped (real 5.2.0 adapter) |
| `node --test tests/orchestrators/{plugin,marketplace,reconcile,import}/*.test.ts` | 0 | 3318 pass, 0 fail, 0 skipped |
| `rg -n 'D-02-(19\|20\|21\|22\|23)' extensions tests`; `rg -n 'D-02-1[0-9]' extensions tests` | 1, 1 | no output (expected) |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint .planning/phases/02-adapter-file-delivery <covered implementation, test and doc files> legacy.ts mcp-override-lifecycle.test.ts adapter-entry.test.ts stage.test.ts legacy.test.ts` | 0 | `covered_files` and `covered_digest` copied verbatim into the frontmatter |

No test file failed and none needed a re-run. Nothing wrote to the real `~/.pi/agent`.

### Full-gate evidence

`npm run check` on HEAD `51ebbc07` (clean tree), Node v26.11.0, `PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0, `TMPDIR=/var/tmp/mcp4-check-tmp`: **exit 0** (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration, test:coverage:direct:all; merged `coverage/direct.lcov`, 269 records). Run by the orchestrator in this session, cited and not re-run here.

### Result

Status stays `passed`. 5/5 roadmap success criteria and both gap-closure truths hold at HEAD as amended by D-03 (ANAME-01/03/07), D-04, D-05-08..10 and D-07-07. No new gap, no new human-verification item.

## Re-verification (2026-10-10)

**Scope:** scoped re-verification. Baseline `1b1e39a3` (last write of this report), head `3df6309c` (branch `features/mcp-4`). The report read `stale` because Phase 8 (clear milestone debt) edited 28 files in `covered_files`. Phase 2's earlier findings and the 2026-10-09 section stay unchanged. Result: **the five roadmap truths and gap 1 still hold, as amended by Phase 8; gap 2 (no `D-02-19..22` in source) regressed**, so status is `gaps_found` (one cosmetic gap, no behavior gap).

### Changed covered files since 1b1e39a3

| File(s) | Phase 8 change |
|---------|----------------|
| `bridges/mcp/adapter-doc.ts` (+282) | `_piClaudeMarketplace.serverChoices` store: `storedChoicesFor`, `withPluginServersKeepingChoices`, `writtenBackOverride` (an override the user's later `/mcp-adapter enable` emptied is removed, not written back, and `restoredOverrideNames` agrees) (D-08-02, D-08-01) |
| `bridges/mcp/adapter-entry.ts`, `marker.ts`, `types.ts`, `legacy.ts` | `CARRIED_FIELDS` gains `openUi` and `trace` (11 fields); `userCarriedFields`; OAuth `auth` kept only beside clean headers (D-08-04); `isPlainObject` moved to `marker.ts`; `StageMcpInput.env` required (D-08-06) |
| `bridges/mcp/stage.ts` (+88), `unstage.ts` | Stage reads the store (`overStoredChoices`, stub wins field by field) and writes via `withPluginServersKeepingChoices`; `override-restored` notices for a dropped entry whose override comes back; collision self-replace exemption now exact-key only (rename still checked, ANAME-03); unstage composes with the store for `mcp-adapter.json` only, never for legacy `mcp.json` |
| `orchestrators/plugin/{install-flow,update-flow,update-swap,reinstall-flow,reinstall-replace,install-outcome,install-cascade,install-disable-cascade,enable-disable}.ts`, `orchestrators/import/execute.ts` | `env` threaded from the entry point to staging (D-08-06); own-key reads (`ownValue`) on records; enable/import notices (D-08-03) |
| `orchestrators/plugin/prune-rollback.ts` | `holdsBytes` is one guarded `lstat` + read; `ENOENT`/`ENOTDIR`/`EISDIR` read as "not this prune's write" so the occupied-path refusal stands (08-05); optional `readMetadata` op |
| `orchestrators/marketplace/{shared,remove,update}.ts`, `orchestrators/plugin/uninstall.ts`, `orchestrators/reconcile/apply.ts` | own-key reads/writes only; no behavior change to unstage routing |
| `shared/notification-dispatch.ts`, `docs/output-catalog.md` | notice wiring; catalog text for `override-kept` now describes the choice store and the empty-override rule |
| `tests/bridges/mcp/{adapter-entry,stage}.test.ts`, `tests/integration/mcp-override-lifecycle.test.ts` | new cases for D-08-01/02, the emptied override, `override-restored`, rename collision, env |

### Per-truth result

| Truth | Result | Evidence |
|-------|--------|----------|
| 1. Install writes marked entries into the scope's `mcp-adapter.json`; uninstall removes exactly those (AFILE-01) | HOLDS (as amended by D-08-02) | Write target unchanged (`mcpAdapterJsonPath`). Uninstall still removes the plugin's entries; an owned entry with a kept override is replaced by it. New: the leaving entry's other carried choices go to the top-level `_piClaudeMarketplace.serverChoices` in the same single atomic write, only in `mcp-adapter.json` (`unstage.ts` picks `withPluginServersKeepingChoices` by `target.file`). Nothing foreign is touched: the store member and `serverChoices` keep any non-plain-object value as it is (`readChoiceStore`), another plugin's or marketplace's store entry is neither applied nor removed (`ownedChoiceOf`; tests `D-08-02: the stored choice of ... is neither applied nor removed`). Integration cases pass. |
| 2. JSONC file keeps foreign keys; unparseable file refuses with typed error; comment loss warned once (AFILE-02, AFILE-04) | HOLDS | `readMcpConfigDoc` unchanged; store logic only adds/removes its own member and keeps all others. `commentsDroppedNotices` still first in `notices`; `override-restored` is inserted after `override-kept` and before the variable notices. The catalog byte lock (`mcp-config-notices.test.ts`) passes with the updated text. |
| 3. Legacy `mcp-servers` key honored (AFILE-03) | HOLDS | `withPluginServers` still writes under `config.serverKey`; the AFILE-03 stage cases pass; the store sits at top level and is never written to `mcp.json`. |
| 4. Full-definition collisions reported with the winning source; partial entries are overrides (AFILE-05) | HOLDS (tightened) | `assertNoMcpCollisions` now exempts only an owned entry under the exact name (`Object.hasOwn(check.ours, name)`); a rename onto a key the plugin owns only under the other spelling is still checked against other sources. New cases `ANAME-03: a rename onto a key ... still refuses` and `... restaging the exact key ... stays exempt` pass. |
| 5. User override survives update and reinstall; closed carried set pinned against `ServerEntry` (AFILE-06) | HOLDS (set widened) | `CARRIED_FIELDS` is now 11: `openUi` and `trace` added (D-08-01). `adapter-entry.test.ts` pin against the vendored 5.2.0 `ServerEntry` passes with 0 skips; `D-08-01: a restage keeps the user's openUi and trace ...` and integration `a reinstall keeps the user's openUi and trace` pass. Credential fields are still not carried. |
| Gap 1: marker-less stub kept verbatim in `keptOverride`, written back on every unstage (D-02-21/22/23) | HOLDS (as amended) | Stub still lands in `keptOverride` via `stampServers`; `survivingEntry` writes back `writtenBackOverride`. Amendment: a kept override the user's later `/mcp-adapter enable` or `disable` emptied is removed and not named as restored (pi-mcp-adapter's own writer deletes an entry it empties); a kept `{}` stub still comes back as `{}`. Test `AFILE-06: uninstall removes an absorbed disable stub that the user's later enable emptied` and the stage twin pass. Choices outside the written-back override move to the store, so nothing the user chose is dropped (`leavingChoice`); the store survives uninstall then reinstall, disable then enable, and an update that drops then restores the server (3 integration cases). The store entry is consumed by the same plugin and marketplace only. |
| Notices (`override-kept`, `override-restored`) carry names only, never values; restored notice only when the override comes back | HOLDS | `overrideRestoredNotices` uses `restoredOverrideNames` minus staged keys, the same test unstage uses, so an emptied override gives no notice; `mcpOverrideKeptLine` unchanged. |
| Prune rollback race handling | HOLDS | `holdsBytes` maps only `ENOENT`/`ENOTDIR`/`EISDIR` to false, rethrows the rest; nothing is written on the refusal path; `prune-rollback.test.ts` passes (3376-test orchestrator run). |
| Gap 2: no `D-02-19..22` in source or test titles; 11 v1.20 `D-02-0x` lines intact | **FAILED (regression)** | `rg -n 'D-02-(19\|20\|21\|22\|23)' extensions tests` now prints `orchestrators/plugin/prune-rollback.ts:245` (comment) and `tests/orchestrators/plugin/prune-rollback.test.ts:1368` (test title), both added by `b86ad6d3` (Phase 8 plan 08-05). `D-02-1[0-9]` prints the same two lines; `D-02-0[0-9]` still prints 11 lines and no `D-02-0x` line changed. Plan 02-09 replaced these ids with NFR-3 for this very reason. The fix is a comment and a test-title rename, no code token. |
| Prohibitions (credentials never active, no value in notices, write-back never a full definition, no foreign file touched) | HOLDS | `CARRIED_FIELDS` has no credential field (`openUi`, `trace` are display flags); the store holds carried fields only; `no-credential-leak.test.ts` and the notices tests pass; `restorableOverride` still requires a partial, marker-less value. |

### Commands run (repo root, `TMPDIR=/var/tmp/mcp4-reverify-02`, `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`)

| Command | Exit | Result |
|---------|------|--------|
| `node --test tests/bridges/mcp/*.test.ts tests/architecture/{mcp-config-notices,mcp-migration-notice,no-credential-leak,peer-floor}.test.ts tests/shared/{notification-dispatch,errors-bridges,atomic-json}.test.ts tests/persistence/locations.test.ts` | 0 | 923 pass, 0 fail, 0 skipped |
| `node --test tests/integration/{mcp-override-lifecycle,mcp-migration,mcp-legacy-sweep,mcp-variable-expansion,mcp-tool-rules,mcp-home-path-partial,standalone-prune,adapter-expansion-conformance,mcp-status-conformance}.test.ts` | 0 | 117 pass, 0 fail, 0 skipped (real 5.2.0 adapter) |
| `node --test tests/orchestrators/{plugin,marketplace,reconcile,import}/*.test.ts` | 0 | 3376 pass, 0 fail, 0 skipped |
| `rg -n 'D-02-(19\|20\|21\|22\|23)' extensions tests`; `rg -n 'D-02-1[0-9]' extensions tests` | 0, 0 | 2 lines each (prune-rollback.ts:245, prune-rollback.test.ts:1368): gap 2 regression |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint .planning/phases/02-adapter-file-delivery <the 40 non-plan covered files>` | 0 | `covered_files` unchanged (64), `covered_digest` copied verbatim |

`npm run check` was not re-run (the orchestrator ran it on HEAD 6199bc53+, exit 0). Nothing wrote to the real `~/.pi/agent`.

### Result

Status `gaps_found`: one cosmetic gap. Every behavior promise of Phase 2 (AFILE-01..06, the five success criteria, gap 1) holds at HEAD as amended by D-08-01/02/04/06 and the emptied-override rule. The only lost support is the Gap 2 hygiene truth: Phase 8 plan 08-05 re-cited `D-02-19` in `prune-rollback.ts:245` and the title of `prune-rollback.test.ts:1368`. Replacing it with `NFR-3` in both closes it with no code change. Not deferred: no later phase carries it.

---

_Verified: 2026-10-04T11:05:00Z_
_Verifier: Claude (gsd-verifier)_

### Gap closed (orchestrator, 2026-10-10)

The one gap above, gap 2, is closed by 9ed88725 (`docs(prune): cite NFR-3 for
the occupied-path race rule`). The comment at `prune-rollback.ts:245` and the
test title at `prune-rollback.test.ts:1368` now cite `NFR-3`, the ID that plan
02-09 used for this rule; no code token changed. `rg -n 'D-02-(19|20|21|22|23)'
extensions tests` prints nothing (exit 1), and the commit hook's
`npm run check:commit` passed for the pair. Status returns to `passed`; the
covered digest was recomputed over the same 64 files.

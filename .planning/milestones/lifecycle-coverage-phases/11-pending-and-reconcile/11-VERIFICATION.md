---
phase: 11-pending-and-reconcile
verified: 2026-10-23T12:00:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/11-pending-and-reconcile/11-01-PLAN.md
  - .planning/phases/11-pending-and-reconcile/11-01-SUMMARY.md
  - CHANGELOG.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - features/plugin/pending.feature
  - features/plugin/reconcile.feature
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - test/integration/mcp-migration.test.ts
  - test/integration/plugin-layer-consistency.test.ts
  - test/integration/reserved-record-keys.test.ts
  - test/orchestrators/reconcile/apply.test.ts
covered_digest: "v3:sha256:ae247b31bf1a4e7e04012d195f07f063c4641e4dc0322ea7c8abd387cc5466b5"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "D-10: a plugin whose catalog dropped it, or whose marketplace manifest is invalid, is reported failed {unreadable} on every new session without a cause chain"
    addressed_in: "BACKLOG.md STALE-DECLARER-01 (no ROADMAP carrier)"
    evidence: "11-CONTEXT.md D-10; .planning/BACKLOG.md:3543 STALE-DECLARER-01 describes the same abort-on-first-unreadable-declarer behavior. features/marketplace/update.feature:819 still pins the {unreadable} rows. Not a Phase 11 success criterion."
---

# Phase 11: Pending and Reconcile Verification Report

**Phase Goal:** After a config is edited by hand, `pending` shows what the next session will change, and the next session makes those changes.
**Verified:** 2026-10-23T12:00:00Z
**Status:** passed
**Re-verification:** Yes. The earlier report was stale because later phases' merges changed covered files. Every truth was re-checked against the combined 15-phase tree.

Scope: the combined milestone tree at `7a9b6107` on `claude/plugin-lifecycle-coverage-b1d431`. Phase 11 landed through `98b68986`; later merges (notably Phase 13's import-row version work, `cf538409`, which moved the `docs/output-catalog.md` byte pin) touched covered files.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | After hand edits, `pending` lists every install, uninstall, enable, and disable they cause; when configs and records agree it reports the empty result (SC1, PND-01) | VERIFIED | `features/plugin/pending.feature:62-90`: one base-config edit over four plugins yields a `cascade` with tally `Reconcile pending`, success count 4, and the rows `will install` (alpha), `will uninstall` (demo), `will disable` (beta), `will enable` (gamma), each compared in full. `:56-60`: after `install`, `pending` gives `reconcile-pending-empty`. The two seeds (`:16-54`) cover a hand-declared marketplace plus plugin in the base and the local layer. All 6 pending scenarios pass in this run. |
| 2 | `pending --scope user` and `pending --scope project` keep only that scope's changes (SC2, PND-02) | VERIFIED | `pending.feature:92-134`: both scopes carry a hand-declared plugin (`demo` in project, `alpha` in user). `--scope user` lists only `alpha@fixtures` with scope `user`; `--scope project` lists only `demo@fixtures`. The row step compares every row, so a leaking filter fails. |
| 3 | A plugin added by hand is installed by the next session and its skills are offered; a hand removal is uninstalled; a hand enable or disable is applied (SC3, REC-01, REC-02, REC-03) | VERIFIED | `reconcile.feature:14-67` (REC-01: base-config seed with `/skill:demo-skill` offered, plus the hand-declared marketplace plus plugin seed); `:69-90` (REC-02: `demo` `uninstalled 1.0.0`, only `/skill:alpha-skill` offered); `:92-110` (REC-03 disable: `disabled 1.0.0`, "the session offers no skills"); `:112-133` (REC-03 enable: `installed 1.0.0`, skill offered). |
| 4 | When the reconcile cannot install one plugin, the report names it, and the other changes from the same edit are applied (SC4, REC-04) | VERIFIED | `reconcile.feature:135-153`: `ghost` (not in the catalog) is declared before `demo`. Two `reconcile-applied-cascade` results, severity `error`, `ghost` `failed {not in manifest}`, `demo` `installed 1.0.0`, and `/skill:demo-skill` offered. Code path: `applyPluginInstalls` turns a failed result into a failed outcome and continues; `applyPlan` (`apply.ts:1297-1309`) runs uninstalls, marketplace removes and adds, installs, dependency installs, and toggles in sequence with no early exit. |
| 5 | The reconcile `(installed)` row of a hand-declared plugin carries its version, as `install` does (D-07, plan must-have) | VERIFIED | `apply.ts:708` still has `...(result.version !== undefined && { version: result.version })` on the `plugin-installed` outcome; `notify.ts:598` `installedRowFromOutcome` copies `outcome.version` to the row. The REC-01 scenarios read `version 1.0.0` end to end through a real Pi session. Phase 13's import-side fix did not displace it. |
| 6 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green (SC5) | VERIFIED | The orchestrator ran `npm run check` on this exact tree: green (static checks, unpaired, integration, 702/702 scenarios, direct coverage). Not re-run here, per instruction. This verifier ran `npx cucumber-js --parallel 2 features/plugin/pending.feature features/plugin/reconcile.feature`: 13 scenarios (13 passed), 140 steps (140 passed), exit 0. `npm run check:features`: exit 0. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | D-10: `failed {unreadable}` reconcile row, without cause chain, for a plugin its catalog dropped or whose manifest is invalid | `.planning/BACKLOG.md` STALE-DECLARER-01 (line 3543). No ROADMAP carrier. | `reportUnreadableDeclarer` is still at `apply.ts:1333`; `features/marketplace/update.feature:819` still pins the rows. See "For the orchestrator". |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/pending.feature` | PND-01 and PND-02 scenarios (contains `will uninstall`) | VERIFIED | 6 scenarios, 134 lines; contains `will uninstall` (line 88). |
| `features/plugin/reconcile.feature` | REC-01..REC-04 scenarios (contains `not in manifest`) | VERIFIED | 7 scenarios, 171 lines, including the LOAD-01 handover scenario. Contains `not in manifest` (lines 151, 153). |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | D-07 version on the `plugin-installed` outcome | VERIFIED | Present at line 708. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `orchestrators/reconcile/apply.ts` | `orchestrators/reconcile/notify.ts` | `PluginInstalledOutcome.version` read by `installedRowFromOutcome` | WIRED | `apply.ts:708` writes `version: result.version`; `notify.ts:598` reads `outcome.version`. Observed end to end by REC-01. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| reconcile `(installed)` row | `version` | `result.version` from the real install ledger | Yes: the scenario reads `1.0.0` from the published fixture catalog | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios pass on the combined tree | `npx cucumber-js --parallel 2 features/plugin/pending.feature features/plugin/reconcile.feature` | 13 scenarios (13 passed), 140 steps (140 passed), exit 0 | PASS |
| Step usage gate | `npm run check:features` | exit 0 | PASS |
| Full gate | orchestrator ran `npm run check` on this tree (not re-run) | green, 702/702 scenarios | PASS |

### Probe Execution

Not applicable: the phase declares no probes and is not a tooling or migration phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PND-01 | 11-01 | `pending` lists the installs, uninstalls, enables, and disables a hand-edited config would cause, and is empty when config and records agree | SATISFIED | `pending.feature:16-90` (truth 1) |
| PND-02 | 11-01 | `pending --scope` keeps only that scope's changes | SATISFIED | `pending.feature:92-134` (truth 2) |
| REC-01 | 11-01 | A plugin added to a config by hand is installed by the next session, which offers its skills | SATISFIED | `reconcile.feature:14-67` |
| REC-02 | 11-01 | A plugin removed from a config by hand is uninstalled by the next session | SATISFIED | `reconcile.feature:69-90` |
| REC-03 | 11-01 | A plugin set to enabled or disabled in a config by hand is enabled or disabled by the next session | SATISFIED | `reconcile.feature:92-133` |
| REC-04 | 11-01 | A reconcile that cannot install a plugin reports it and leaves the other changes applied | SATISFIED | `reconcile.feature:135-153` (truth 4) |

No orphaned requirements: REQUIREMENTS.md maps exactly PND-01, PND-02, and REC-01..REC-04 to Phase 11, and the plan claims all six. The REQUIREMENTS.md checkboxes and traceability rows still read `Pending`, and the ROADMAP Phase 11 line is unchecked; updating them is the orchestrator's job at phase completion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | | No `TBD`/`FIXME`/`XXX` in `apply.ts` or the two feature files | | |
| `features/plugin/reconcile.feature` | 135-153 | REC-04 proves a later install still runs after a failed one. It does not combine the failed install with an uninstall or a toggle in the same edit. | Info | `applyPlan` has no early exit, so the behavior holds today. Optional strengthening, not a gap. |

### Human Verification Required

None. Every truth is exercised by a scenario that drives a real headless Pi session and compares the whole result.

### Gaps Summary

No gaps. The goal still holds on the combined tree. Hand edits to a scope's configs are reported by `pending` (all four transitions, the empty case, scope narrowing), and a new session applies them (install with skills offered, uninstall, disable, enable, and a partly failing install that still applies the rest). The D-07 version fix is intact and wired, and the orchestrator's green `npm run check` covers the final scenario set.

## For the orchestrator

Items carried from the previous report, updated against the combined tree.

1. **D-10 deferred (still open; a carrier now exists in BACKLOG).** Every new session prints `failed {unreadable}`, without a cause chain, for a plugin that stays installed after its catalog drops it or whose marketplace manifest is invalid. Source: `reportUnreadableDeclarer` in `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1333` (D-05-07 fail-closed dependency walk). `.planning/BACKLOG.md` STALE-DECLARER-01 (line 3543) describes the same abort-on-first-unreadable-declarer root cause and its trade-off, so the milestone audit can find it there; there is still no ROADMAP criterion. A fix changes the expected rows of `features/marketplace/update.feature:819`, `features/marketplace/remove.feature:588-603`, `features/plugin/uninstall.feature:230-242`, and `features/plugin/reinstall.feature:103,140`, which pin today's behavior. Consider adding a cross-reference from STALE-DECLARER-01 to the Phase 1 observation (`01-02-SUMMARY.md:180`) and this report.
2. **RESOLVED: catalog byte pin merge overlap.** The earlier note warned that another phase editing `docs/output-catalog.md` would conflict on `EXPECTED_UTF8_BYTES`. The merges are done; the constant is now 46 904 in `test/architecture/catalog-uat/catalog-contract.test.ts:22`, and the orchestrator's green `npm run check` includes that test.
3. **RESOLVED: version on reconcile install rows.** The merge hazard (other phases' tests expecting an unversioned reload-installed row) did not materialize: 702/702 scenarios and the unit and integration suites pass on the combined tree.
4. **RESOLVED: import rows carry no version.** The earlier Phase 13 candidate is done. `features/plugin/import.feature:36` now expects `version 1.0.0` on the `(installed)` import row, and `cf538409` updated the catalog and e2e text.
5. **RESOLVED: Phase 7 handover scenario.** The LOAD-01 scenario (`reconcile.feature:155-171`, an update that leaves `app` needing `lib@^2.0.0`) passes on the combined tree; Phase 7's records can cite it.
6. **Optional strengthening (unchanged).** The REC-04 scenario could also put an uninstall or a disable in the same edit as the failed install. Today's code applies them (no early exit in `applyPlan`), so this is not a gap.
7. **Bookkeeping.** `.planning/REQUIREMENTS.md` still shows PND-01, PND-02, REC-01..REC-04 as `Pending`, and `.planning/ROADMAP.md` line 125 leaves Phase 11 unchecked. Both should be updated at phase completion.

---

_Verified: 2026-10-23T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

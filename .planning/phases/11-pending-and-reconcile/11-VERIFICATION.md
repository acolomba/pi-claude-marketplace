---
phase: 11-pending-and-reconcile
verified: 2026-10-23T09:45:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/11-pending-and-reconcile/11-01-PLAN.md
  - .planning/phases/11-pending-and-reconcile/11-01-SUMMARY.md
  - CHANGELOG.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - features/plugin/pending.feature
  - features/plugin/reconcile.feature
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - test/integration/mcp-migration.test.ts
  - test/integration/plugin-layer-consistency.test.ts
  - test/integration/reserved-record-keys.test.ts
  - test/orchestrators/reconcile/apply.test.ts
covered_digest: "v3:sha256:719ccb73033a9c370c6e04747ff9009666aa20a6204ec377edd8cdf9aa1820d3"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "D-10: a plugin whose catalog dropped it, or whose marketplace manifest is invalid, is reported failed {unreadable} on every new session without a cause chain"
    addressed_in: "milestone audit (no ROADMAP carrier yet)"
    evidence: "11-CONTEXT.md D-10 and 11-01-SUMMARY.md 'For the orchestrator'. Not a Phase 11 success criterion; a fix changes expected rows in feature files this phase may not edit."
---

# Phase 11: Pending and Reconcile Verification Report

**Phase Goal:** After a config is edited by hand, `pending` shows what the next session will change, and the next session makes those changes.
**Verified:** 2026-10-23T09:45:00Z
**Status:** passed
**Re-verification:** No (initial verification)

Scope: commits `0fc0172c..a03cf793` (`bdc2919b`, `f203fc53`, `cb489a34`, `29c0422f`, `a03cf793`) on branch `claude/lc-p11-reconcile-575d30`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | After hand edits, `pending` lists every install, uninstall, enable, and disable they cause; when configs and records agree it reports the empty result (SC1, PND-01) | VERIFIED | `features/plugin/pending.feature:65-90`: one base-config edit over four plugins yields a `cascade` with tally `Reconcile pending`, success count 4, and the rows `will install` (alpha), `will uninstall` (demo), `will disable` (beta), `will enable` (gamma), each compared in full. `pending.feature:56-63`: after `install`, `pending` gives `reconcile-pending-empty`. The two Phase 1 seeds (`:16-54`) cover a hand-declared marketplace plus plugin in the base and the local layer. All pass (run below). |
| 2 | `pending --scope user` and `pending --scope project` keep only that scope's changes (SC2, PND-02) | VERIFIED | `pending.feature:92-134`: both scopes carry a hand-declared plugin (`demo` in project, `alpha` in user). `--scope user` lists only `alpha@fixtures` with scope `user`; `--scope project` lists only `demo@fixtures`. The row step compares every row, so a scope filter that leaks the other scope's row fails. |
| 3 | A plugin added by hand is installed by the next session and its skills are offered; a hand removal is uninstalled; a hand enable or disable is applied (SC3, REC-01, REC-02, REC-03) | VERIFIED | `reconcile.feature:148-190` (REC-01, two seeds now with `version 1.0.0`, `/skill:demo-skill` offered); `:192-213` (REC-02: `demo` `uninstalled 1.0.0`, only `/skill:alpha-skill` offered); `:215-233` (REC-03 disable: `disabled 1.0.0`, `the session offers no skills`); `:235-256` (REC-03 enable: `installed 1.0.0`, skill offered). |
| 4 | When the reconcile cannot install one plugin, the report names it and the other changes from the same edit are applied (SC4, REC-04) | VERIFIED | `reconcile.feature:258-276`: `ghost` (not in the catalog) is declared before `demo`, so the failure comes first. Two `reconcile-applied-cascade` results (one per RPC binding, D-06), severity `error`, `ghost` `failed {not in manifest}` in each, `demo` `installed 1.0.0`, and `/skill:demo-skill` offered. An install loop that stopped at its first failure would leave `demo` uninstalled and fail this scenario. Code path: `applyPluginInstalls` (`apply.ts:627`) turns a failed result into a `plugin-install-failed` outcome and continues; `applyPlan` (`apply.ts:1297-1309`) runs uninstalls, marketplace removes/adds, installs, dependency installs, and toggles in sequence with no early exit. |
| 5 | The reconcile `(installed)` row of a hand-declared plugin carries its version, as `install` does (D-07, plan must-have) | VERIFIED | `apply.ts:708` adds `...(result.version !== undefined && { version: result.version })` to the `plugin-installed` outcome, matching the `landedDisabled` arm at `:688`. `notify.ts:598` `installedRowFromOutcome` copies `outcome.version` onto the row. Pinned by `apply.test.ts` (18 expectation updates), three integration files, the catalog fixture, and the REC-01 scenarios' `version` column. |
| 6 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green (SC5) | VERIFIED | `/var/tmp/p11-check3.log` (finished 05:26:03; `a03cf793` committed at 05:26:27, content already on disk): every `check:static` member passed, including `fallow` and `check:features`; `test:cucumber` 471 scenarios / 4496 steps passed; `test:coverage:direct:all` merged `coverage/direct.lcov` (280 records). The chain uses `&&`, so reaching the last step means every earlier step exited 0. Confirmed on the committed tip by this verifier: the two phase features pass (13/13 scenarios, 140 steps, exit 0) and `npm run check:features` exits 0. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | D-10: `failed {unreadable}` reconcile row, without cause chain, for a plugin its catalog dropped or whose manifest is invalid | Milestone audit (no ROADMAP carrier) | 11-CONTEXT.md D-10. Not a Phase 11 criterion. See "For the orchestrator". |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/pending.feature` | PND-01 and PND-02 scenarios (contains `will uninstall`) | VERIFIED | 6 scenarios. Contains `will uninstall` (line 88). |
| `features/plugin/reconcile.feature` | REC-01..REC-04 scenarios (contains `not in manifest`) | VERIFIED | 7 scenarios, including the Phase 7 handover scenario (LOAD-01). Contains `not in manifest` (lines 271, 273). |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | D-07 version on the `plugin-installed` outcome | VERIFIED | One-line change at line 708. |

No step module was added (D-01). The phase touched only its own two feature files under `features/`. The production and test edits are allowed by the "Overlapping fixes" rule.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `orchestrators/reconcile/apply.ts` | `orchestrators/reconcile/notify.ts` | `PluginInstalledOutcome.version` read by `installedRowFromOutcome` | WIRED | `apply.ts:708` writes `version: result.version`; `notify.ts:598` reads `outcome.version`. The REC-01 scenarios observe `version 1.0.0` end to end through a real Pi session. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| reconcile `(installed)` row | `version` | `result.version` from the real install ledger (`InstallPluginOutcome`) | Yes: the scenario reads `1.0.0` from the published fixture catalog | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios pass on the committed tip | `npx cucumber-js features/plugin/pending.feature features/plugin/reconcile.feature` | 13 scenarios (13 passed), 140 steps (140 passed), exit 0 | PASS |
| Step usage gate | `npm run check:features` | exit 0 | PASS |
| Full gate | read `/var/tmp/p11-check3.log` (not re-run, per instruction) | all static checks passed; 471/471 scenarios; direct coverage merged | PASS |

### Probe Execution

Not applicable: the phase declares no probes and is not a tooling or migration phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PND-01 | 11-01 | `pending` lists the installs, uninstalls, enables, and disables a hand-edited config would cause, and is empty when config and records agree | SATISFIED | `pending.feature:16-90` (truth 1) |
| PND-02 | 11-01 | `pending --scope` keeps only that scope's changes | SATISFIED | `pending.feature:92-134` (truth 2) |
| REC-01 | 11-01 | A plugin added to a config by hand is installed by the next session, which offers its skills | SATISFIED | `reconcile.feature:148-190` |
| REC-02 | 11-01 | A plugin removed from a config by hand is uninstalled by the next session | SATISFIED | `reconcile.feature:192-213` |
| REC-03 | 11-01 | A plugin set to enabled or disabled in a config by hand is enabled or disabled by the next session | SATISFIED | `reconcile.feature:215-256` |
| REC-04 | 11-01 | A reconcile that cannot install a plugin reports it and leaves the other changes applied | SATISFIED | `reconcile.feature:258-276` (truth 4) |

No orphaned requirements: REQUIREMENTS.md maps exactly PND-01, PND-02, and REC-01..REC-04 to Phase 11, and the plan claims all six. The REQUIREMENTS.md checkboxes and traceability rows still read `Pending`; updating them is the orchestrator's job at phase completion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | | No `TBD`/`FIXME`/`XXX` in the phase's changed files | | |
| `features/plugin/reconcile.feature` | 258-276 | REC-04 proves that a later install still runs after a failed one. It does not combine the failed install with an uninstall or a toggle in the same edit. | Info | `applyPlan` has no early exit, so the behavior holds today. A regression that skipped toggles after a failed install would not be caught by this scenario. Optional strengthening, not a gap. |
| `11-01-SUMMARY.md` | Task 3, "For the orchestrator" | States 470 scenarios; the final tree has 471 (the Phase 7 handover scenario in `a03cf793` came later) | Info | Stale count only. |

### Human Verification Required

None. Every truth is exercised by a scenario that drives a real headless Pi session and compares the whole result.

### Gaps Summary

No gaps. The goal holds: hand edits to a scope's configs are reported by `pending` (all four transitions, the empty case, and scope narrowing), and a new session applies them (install with skills offered, uninstall, disable, enable, and a partly failing install that still applies the rest). The D-07 version fix is wired end to end, and the gate log shows `npm run check` green with the final scenario set.

## For the orchestrator

These items come from `11-01-SUMMARY.md` "For the orchestrator", checked against the tree, plus the verifier's own findings.

1. **D-10 deferred, no carrier yet.** Every new session prints `failed {unreadable}`, without a cause chain, for a plugin that stays installed after its catalog drops it or whose marketplace manifest is invalid. The reason is misleading. Source: `reportUnreadableDeclarer` in `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1333` (D-05-07 fail-closed dependency walk). A fix changes the expected rows of `features/marketplace/update.feature` (untouched after Phase 1), `features/marketplace/remove.feature` (Phase 15), `features/plugin/uninstall.feature` (Phase 6), and `features/plugin/update.feature` (Phase 7), which Phase 11 may not edit. The verifier found no carrier in ROADMAP.md, STATE.md, or a backlog file. Record it where the milestone audit will see it, for example in the audit's criteria or as a follow-up phase.
2. **Merge overlap: catalog byte pin.** `test/architecture/catalog-uat/catalog-contract.test.ts` `EXPECTED_UTF8_BYTES` moves from 46 623 to 46 637 (+14, the two `v1.0.0 ` insertions in `docs/output-catalog.md`). Another phase that edits `docs/output-catalog.md` will conflict on this constant. On merge, apply both deltas to the base value.
3. **Merge overlap: version on reconcile install rows.** Any other phase's scenario or test that expects a reload-installed `(installed)` row with no version now fails. Add `version 1.0.0` in feature tables or `v1.0.0` in rendered strings. On this branch the full suite passed (471 scenarios), so no Phase 1 or untouched file is affected. The rule applies to work on parallel phase branches when they merge.
4. **Phase 13 candidate (not touched).** `import` `(installed)` rows still carry no version. Evidence: `test/integration/reserved-record-keys.test.ts:323` (`● constructor (installed)` under `Import: 2 successes`) and `features/plugin/import.feature:36` (empty version cell). Import has its own install path, so the D-07 fix does not reach it. Phase 13 should decide whether to apply the same fix.
5. **Verifier note: Phase 7 handover scenario.** `a03cf793` adds a LOAD-01 scenario (`reconcile.feature:278-305`, an update that leaves `app` needing `lib@^2.0.0`) on behalf of Phase 7, which may not edit `reconcile.feature`. It passes. When Phase 7 records its coverage, it should cite this scenario rather than add a second one.
6. **Verifier note (optional strengthening).** The REC-04 scenario could also put an uninstall or a disable in the same edit as the failed install. That would make the "other changes are applied" wording hold for every transition kind, not only for a later install. Today's code applies them (no early exit in `applyPlan`), so this is not a gap.

---

_Verified: 2026-10-23T09:45:00Z_
_Verifier: Claude (gsd-verifier)_

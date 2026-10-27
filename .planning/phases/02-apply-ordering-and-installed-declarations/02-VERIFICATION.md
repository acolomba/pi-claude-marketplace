---
phase: 02-apply-ordering-and-installed-declarations
verified: 2026-10-27T10:30:00Z
status: passed
score: 13/13 must-haves verified (5 roadmap success criteria, 8 RCN requirements)
covered_files:
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-01-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-01-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-02-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-02-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-03-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-03-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-05-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-05-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-06-PLAN.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-06-SUMMARY.md
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - features/marketplace/add.feature
  - features/plugin/apply.feature
  - features/plugin/bootstrap.feature
  - features/plugin/enable.feature
  - features/plugin/update-dependencies.feature
  - test/architecture/soft-dep-marker-policy.test.ts
  - test/e2e/import-command.test.ts
  - test/edge/handlers/marketplace/add.test.ts
  - test/edge/handlers/marketplace/update.test.ts
  - test/edge/handlers/plugin/bootstrap.test.ts
  - test/edge/register.test.ts
  - test/edge/types.test.ts
  - test/integration/reserved-record-keys.test.ts
  - test/integration/standalone-prune.test.ts
  - test/orchestrators/marketplace/add.messaging.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/bootstrap.test.ts
  - test/orchestrators/plugin/dependency-declaration-read.test.ts
  - test/orchestrators/plugin/dependency-index.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/reconcile/dependency-verdict.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/orchestrators/reconcile/types.test.ts
  - test/orchestrators/types.test.ts
covered_digest: "v4:sha256:8d66ffc9912e51099a86edb3dd5fff7c330e790b82e7011ffa2bed6f5b88985a"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "RCN-04: the STALE-DECLARER-01 backlog entry is closed (and PENDMOVE-01, MISSORDER-01, RECON-REPLAN-01, ENDEPS-01, UPDDEP-01 b3, MISS-MPADD-01, PARITYGV-01 b4, LCORCH-01 b6 marked with their dispositions)"
    addressed_in: "Phase 11"
    evidence: "Phase 11 SC4: 'BACKLOG.md marks every entry this milestone settled closed with its disposition (CLN-04)'; Phase 11 Backlog line: 'all entries settled by Phases 1-9'. The dispositions are recorded in the 02-0x SUMMARY 'Backlog dispositions' sections; BACKLOG.md still shows the entries open."
  - truth: "RCN-07 / RCN-06: the D-PL2-11 refusal-report divergence and the D-PL2-15 NFR-5 amendment are carried into PROJECT.md / AGENTS.md"
    addressed_in: "Phase 11"
    evidence: "Phase 11 SC3: 'Docs, CHANGELOG, and PROJECT.md decision rows match the shipped behavior (CLN-03)'. The IDs are recorded in 02-CONTEXT.md and in code comments."
---

# Phase 2: Apply Ordering and Installed Declarations Verification Report

**Phase Goal:** `pending` previews exactly what `apply` does, one `apply` settles a missing dependency that needs a moved version, and dependency declarations of an installed plugin come from its installed copy.
**Verified:** 2026-10-27T10:30:00Z
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For PENDMOVE-01 and MISSORDER-01, `pending` lists the rows one `apply` makes, and a second `apply` reports nothing to change (RCN-01, RCN-02) | VERIFIED | `apply.feature:1216` (MISSORDER-01) and `:1270` (PENDMOVE-01) assert pending rows = apply rows in the same order, the record, and an empty second `pending`. They pass. The committed scenarios check a second `pending`, not a second `apply`, so I ran an uncommitted probe in the scratchpad. It copied both scenarios and the WR-06 shape (`:1323`) and added a second `apply` asserting `reconcile-pending-empty`: 3 scenarios, 58 steps passed. Code: `convergeScope` -> `runCascade` -> `installAfterMoves` (MISS-01 after the moves, with the bucket re-read from `readPlainPlanForScope` once a step ran) -> `runAfterInstallSteps` -> `judgeScopeAfterCascade` (`apply.ts:1201-1343`). `pending` uses the same `movesAfterInstalls`/`stepsAfterInstalls` (`pending.ts:464-478`) and the `scheduled` set (`dependency-verdict.ts:445-494`, `convergence.ts:1117-1125`). |
| 2 | A scenario edits the config to uninstall a dependency and shows its dependent disabled in the same `apply` (RCN-03) | VERIFIED | The retitled `apply.feature:786` "Apply disables a plugin whose dependency a config drops in the same run, as pending lists it" passes. The 02-03 mutation record shows it fails when both same-run disable paths are removed (mutation B), and that the final judgement alone disables `keeper` (mutation A). Accepted as the caller instructed. |
| 3 | STALE-DECLARER-01 has a recorded decision ID, and the code and tests match it (RCN-04) | VERIFIED | D-PL2-05 is recorded in 02-CONTEXT.md. Code comments sit at each walk's early return (`dependency-index.ts:452,483`, `dependency-verdict.ts:588`). One unit pin per walk (`dependency-index.test.ts:600,747,1300`; `dependency-verdict.test.ts:999`), and all pass. The BACKLOG.md closure is deferred to Phase 11 (see Deferred). |
| 4 | An enable after the marketplace changed a plugin's dependencies uses the installed copy's declarations, and the update preflight reads other plugins' ranges the same way (RCN-05) | VERIFIED | `enableCascadeLookup` calls `readInstalledRecordDeclarations` (`enable-disable.ts:646`). `REAL_UPDATE_CONSTRAINT_SEAM` binds `buildInstalledScopeDeclarationDetail` (`update-constraint-gate.ts:89`). Both scenarios pass: `enable.feature` "Enabling a git-source plugin enables the dependency its installed copy declares..." and `update-dependencies.feature` "Updating a dependency is held by the range a git-source plugin's installed copy declares". Path sources keep the catalog read under D-PL2-07, a recorded capability gap (no retained copy). |
| 5 | `marketplace add`, `bootstrap`, and autoupdate settle missing dependencies as Claude Code does; the MISS-01 refusal report and delisted-copy containment match RCN-07 and RCN-08 (RCN-06, RCN-07, RCN-08) | VERIFIED | The seam is composed once in `index.ts:97` (`createScopeDependencyInstall`). It is threaded through `EdgeDeps.installMissingDependencies` into the add handler, the bootstrap handler (`orchestrators/plugin/bootstrap.ts:130`) and the update handler (`register.ts:145`, `marketplace/update.ts:690-714`). These scenarios pass: add (installs, refuses as apply), bootstrap, autoupdate, bare-update once-per-dependency, and the partial-dependency regression. The refusal row is kept under D-PL2-11 (`apply.feature:1429` passes). Containment uses `installedCopyOwnerRoot` plus manifest-candidate `assertPathInside` (`dependency-declaration-read.ts:338-470`). Its 14 D-PL2-12/13 unit cases pass. |

**Score:** 5/5 success criteria, 8/8 requirements (0 present but behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | BACKLOG.md marks STALE-DECLARER-01 and the other eight phase-2 entries closed | Phase 11 | SC4 / CLN-04: "BACKLOG.md marks every entry this milestone settled closed with its disposition" |
| 2 | D-PL2-11 (refusal-row divergence) and D-PL2-15 (NFR-5 amendment) are recorded as PROJECT.md decision rows | Phase 11 | SC3 / CLN-03: "PROJECT.md decision rows match the shipped behavior" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `orchestrators/reconcile/apply.ts` | MISS-01 after the cascade, after-install steps, `createScopeDependencyInstall` | VERIFIED | Substantive and wired (index.ts, the `applyReconcile` path); exercised by the scenarios |
| `orchestrators/reconcile/{convergence,pending,read-pass,notify,dependency-verdict}.ts` | One shared planner with `scheduled`, `withPlannedInstallsLanded`, after-install steps | VERIFIED | Imported by both `pending.ts` and `apply.ts`/`read-pass.ts` |
| `orchestrators/plugin/dependency-index.ts` | `readInstalledRecordDeclarations`, `buildInstalledScopeDeclarationDetail` | VERIFIED | Used by enable-disable.ts and update-constraint-gate.ts |
| `orchestrators/plugin/dependency-declaration-read.ts` | `installedCopyOwnerRoot`, single `ownerRoot`, manifest containment | VERIFIED | Three callers pass the helper (dependency-index.ts x2, convergence.ts) |
| `orchestrators/marketplace/{add,update}.ts`, `orchestrators/plugin/bootstrap.ts` | Missing-dependency step after add, bootstrap, autoupdate | VERIFIED | Seam wired from index.ts through EdgeDeps to all three handlers |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `index.ts` | `createScopeDependencyInstall` | composition beside `createApplyReconcile`, passed to `registerClaudePluginCommand` | WIRED |
| edge add / bootstrap / update handlers | orchestrators | `deps.installMissingDependencies` forwarded | WIRED (exercised end to end by cucumber) |
| `pending.ts` | `convergence.ts` `movesAfterInstalls`/`stepsAfterInstalls` | the same deferral rule `apply.ts` imports | WIRED |
| `enable-disable.ts` / `update-constraint-gate.ts` | installed-copy reader | direct import / seam binding | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 15 phase scenarios (apply x7, enable, update held, add x2, bootstrap, autoupdate x3) | `HOME=<scratch> npx cucumber-js --name ... (15 names)` | 15 scenarios / 246 steps passed | PASS |
| Second `apply` is empty after MISSORDER-01, PENDMOVE-01, WR-06 shapes | uncommitted scratchpad probe feature | 3 scenarios / 58 steps passed | PASS |
| Phase owner unit suites (14 files: reconcile, dependency-index/read, enable-disable, update gate, marketplace add/update, bootstrap) | `HOME=<scratch> node --test ...` | 1106 tests, 0 failures, exit 0 | PASS |
| RCN-08 named cases | `node --test --test-name-pattern="D-PL2-1[23]"` | 14/14 pass | PASS |
| Full gate | `npm run check` on 6dc34113 (cited, not rerun; later commit ce116449 touches only REVIEW docs) | exit 0, 913 scenarios (02-REVIEW-FIX.md) | PASS (cited) |

### Probe Execution

Not applicable. The phase declares no `scripts/*/tests/probe-*.sh` probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| RCN-01 | 02-01, 02-03 | SATISFIED | PENDMOVE-01 scenario + probe; pending.test.ts D-PL2-02 cases |
| RCN-02 | 02-01, 02-03 | SATISFIED | MISSORDER-01 scenario + probe; apply.test.ts D-PL2-01 case |
| RCN-03 | 02-03 | SATISFIED | Retitled keeper/orphan scenario + mutation record |
| RCN-04 | 02-01, 02-02 | SATISFIED (backlog mark deferred to Phase 11) | D-PL2-05 recorded; per-walk unit pins |
| RCN-05 | 02-02 | SATISFIED | enable and update scenarios; reader swap at both callers |
| RCN-06 | 02-05, 02-06 | SATISFIED | add, bootstrap and autoupdate scenarios; seam wiring |
| RCN-07 | 02-03, 02-05, 02-06 | SATISFIED | D-PL2-11 recorded with ID; refusal rows at apply and add pass |
| RCN-08 | 02-04 | SATISFIED | Unit only (D-PL2-12/13); no cucumber stand-in can publish a cross-root or symlinked copy |

No orphaned requirements: REQUIREMENTS.md maps exactly RCN-01..RCN-08 to Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| phase diff (53 files) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| phase diff | - | GSD process refs (Phase N, Plan 0N, Pitfall N) in source/test | none found | - |
| `.planning/BACKLOG.md` | - | New candidates DECLREC-01 and GITROOTDEPS-01 exist only in phase artifacts (`deferred-items.md`, 02-02 SUMMARY, one STATE.md line) and have no BACKLOG.md entry | Warning | Phase 11 closes existing entries; nothing carries these two new ones forward |
| `02-REVIEW.md` | IN-01..IN-06 | Open Info findings (seam field name, comment width, autoupdate read cost and repeat `(updated)`, duplicate `state.json` row, rows lost after a step throw, early deferred enable on the failure path, overstated comment) | Info | None changes the final state; not carried in BACKLOG.md |

### Human Verification Required

None. Every behavior-dependent truth (the ordering and same-run disable or install invariants) has a passing cucumber scenario that I ran in this verification.

### Gaps Summary

No gaps block the phase goal. `pending` and `apply` share one planner and one deferral rule. One `apply` installs a dependency that needs a moved version, after the moves. A second `apply` is empty: the committed scenarios check a second `pending`, and the probe checked a second `apply`. Enable and the update preflight read git-source installed copies. Add, bootstrap and autoupdate run the shared missing-dependency step.

Open, non-blocking items:

- Two deferrals carried by Phase 11: closing the BACKLOG.md entries, and the PROJECT.md decision rows for D-PL2-11 and D-PL2-15.
- Two new backlog candidates with no carrier: DECLREC-01 and GITROOTDEPS-01. Add them to BACKLOG.md.
- The 02-REVIEW Info items IN-01..IN-06.
- The "Uncertain choices" listed in each SUMMARY, which are decisions for user review, not verification failures.

---

_Verified: 2026-10-27T10:30:00Z_
_Verifier: Claude (gsd-verifier)_

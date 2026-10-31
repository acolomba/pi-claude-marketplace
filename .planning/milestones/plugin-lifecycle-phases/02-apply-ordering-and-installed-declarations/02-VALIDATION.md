---
phase: "2"
slug: "apply-ordering-and-installed-declarations"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| **Config file** | `cucumber.json`; `package.json` scripts |
| **Quick run command** | `node --test <test-path>`; `npx cucumber-js --name '<scenario title>'`; `npm run test:coverage:direct -- <source-or-test-path>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (full), seconds per pair |

---

## Sampling Rate

- **After every task commit:** owner tests + `npm run test:coverage:direct -- <touched source>`; the hook runs `npm run check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green, plus `npm run check:features`
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled from the plans; requirement → check mapping (from RESEARCH.md `## Validation Architecture`):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| RCN-01 | PENDMOVE-01: pending rows = apply rows; second pending empty | cucumber | `npx cucumber-js --name 'Apply moves a plugin whose moved dependency needs a missing plugin, as pending lists it'` | ✅ `features/plugin/apply.feature` | ✅ green |
| RCN-01 | release loop counts scheduled installs | unit | `node --test test/orchestrators/reconcile/convergence.test.ts test/orchestrators/reconcile/dependency-verdict.test.ts` | ✅ | ✅ green |
| RCN-02 | MISSORDER-01: moves then MISS-01 in one apply; pending same order | cucumber | `npx cucumber-js --name 'Apply installs a missing dependency that needs the version the same apply moves to, as pending lists it'` | ✅ `features/plugin/apply.feature` | ✅ green |
| RCN-02 | MISS-01 after cascade, row order, post-install enables | unit | `node --test test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/pending.test.ts test/orchestrators/reconcile/notify.test.ts` | ✅ | ✅ green |
| RCN-03 | keeper disabled in same apply | cucumber | `npx cucumber-js --name 'Apply disables a plugin whose dependency a config drops in the same run, as pending lists it'` | ✅ `features/plugin/apply.feature` | ✅ green; see caveat below |
| RCN-04 | first unreadable record ends each walk (D-PL2-05) | unit | `node --test test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/reconcile/dependency-verdict.test.ts` | ✅ | ✅ green |
| RCN-05 | enable follows installed copy (git source) | cucumber | `npx cucumber-js --name 'Enabling a git-source plugin enables the dependency its installed copy declares, not the one its marketplace now lists'` | ✅ `features/plugin/enable.feature` | ✅ green |
| RCN-05 | update held by installed holder's range | cucumber | `npx cucumber-js --name "Updating a dependency is held by the range a git-source plugin's installed copy declares"` | ✅ `features/plugin/update-dependencies.feature` | ✅ green |
| RCN-05 | installed-first reader arms | unit | `node --test test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/update-constraint-gate.test.ts` | ✅ | ✅ green |
| RCN-06 | marketplace add, bootstrap, autoupdate install missing dependencies | cucumber | `npm run test:cucumber` | ✅ `features/marketplace/add.feature`, `features/plugin/bootstrap.feature`, `features/plugin/update-dependencies.feature` | ✅ green |
| RCN-06 | seam wiring | unit | `node --test test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/plugin/bootstrap.test.ts test/edge/register.test.ts test/index.test.ts` | ✅ | ✅ green |
| RCN-07 | refusal row kept (D-PL2-11) | cucumber | `npx cucumber-js --name "Apply refuses a missing anthropic-plugin-directory dependency whose listed copy falls outside a plugin's range, naming that plugin"` | ✅ `features/plugin/apply.feature` | ✅ green |
| RCN-08 | one owning root per record (D-PL2-12); contained manifest links followed and escaping links refused (D-PL2-17 supersedes D-PL2-13) | unit | `node --test test/orchestrators/plugin/dependency-declaration-read.test.ts test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/reconcile/convergence.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

RCN-03 caveat: the existing scenario fails if neither apply disable path runs. The Phase 02 summary records that removing only the final judgment disable leaves the scenario green because the earlier toggle step also disables the dependent. The requirement's observable same-run behavior is covered; the final judgment path is not isolated by this scenario.

## Verification Backstops

| Requirement | Backstop | Automated command | Status |
|-------------|----------|-------------------|--------|
| RCN-01 | A read fails after moves; retry preserves the committed move and installs the missing dependency | `node --test --test-name-pattern 'a read failure after moves leaves them committed' test/orchestrators/reconcile/apply.test.ts` | ✅ green |
| RCN-02 | Scope lock held at MISS-01; the install fails without changing state and succeeds after release | `node --test --test-name-pattern 'a missing-dependency install refused by a held scope lock succeeds after release' test/orchestrators/plugin/operations.test.ts`; apply's `installAfterMoves` calls `applyDependencyInstalls`, which creates this same operation | ✅ green, compositional |
| RCN-03 | Scope lock held at final judgment disable; retry disables dependent | `node --test --test-name-pattern 'a held project lock returns lock-held in orchestrated mode and succeeds after release' test/orchestrators/plugin/enable-disable.test.ts`; apply's final judgment calls `applyDependencyDisables`, which creates this same operation | ✅ green, compositional |
| RCN-05 | Installed-copy reads are locked against a same-scope uninstall when a distinct holder can exist | `node --test --test-name-pattern 'refuses a held scope lock, then retries using the installed copy' test/orchestrators/plugin/update-constraint-gate.test.ts`; `npm run check` covers the enable and update paths | ✅ green |
| RCN-07 | A later MISS-01 cascade member fails and the earlier member is rolled back | `node --test --test-name-pattern 'a refused missing dependency rolls back its earlier committed cascade member' test/orchestrators/reconcile/apply.test.ts` | ✅ green |

The PLAN prohibitions are resolved against their active contracts. APPLY1-D1 covers a successful final judgment; the explicit RCN-03 lock failure leaves a transient unsatisfied dependent for the next `apply`. The `apply.feature` keeper/orphan case and `apply.test.ts` LOAD-01 and post-cascade judgment cases assert successful disables. D-PL2-11 requires the failed dependency row and newly disabled dependent's remedy; `apply.feature` asserts that pair. D-09-14 permits no second disabled row once the dependent is already down; its `apply.test.ts` retry case asserts this. Scope isolation follows the literal call chain `request.scope` → `readPlainPlanForScope` → each install's `op.scope` → `locationsFor(scope, cwd)`; the add recorder asserts project scope, bootstrap asserts user scope, and the marketplace update cases exercise project and user scopes independently.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for focused task checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated. `npm run check` exited 0 on `67a589aa` with Node `v26.12.1` in this worktree: static checks passed, Cucumber passed 1,120 scenarios and 11,411 steps, and direct coverage merged 309 records. The RCN-03 focused scenario also passed 1 scenario and 15 steps. The full run needed loopback access because the default sandbox denied the Cucumber harness binding to `127.0.0.1`.

The later verification audit found additional PLAN backstops. Their focused checks and compositional call paths are recorded above. The combined tree at `9692623d`, including the dependency-operation lock test, passed `npm run check` with 1,122 Cucumber scenarios, 11,447 steps, and 309 direct coverage records.

## Final Merged-Tree Validation Audit 2026-10-28

| Metric | Count |
|---|---:|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Phase requirements green | 8/8 |

The final A+B+C tree preserves every Phase 2 behavioral proof. Ten focused
public scenarios passed with 159 steps and 16 hooks. They cover both
pending/apply order shapes, same-run dependent disablement, installed-copy
enable and update reads, marketplace-add/bootstrap/autoupdate missing-
dependency settlement, and the recorded MISS-01 refusal row.

The changed-owner selection passed across `edge/register`, marketplace add,
plugin operations and update constraint/preflight, and reconcile apply, load,
notify, pending, and read-pass. The marketplace-add owner required the same
loopback/process permissions as the repository harness and then passed all
198 cases; its initial restricted-sandbox process failure was environmental,
not an assertion failure. The declaration-reader, declaration-index,
convergence, and final-verdict owners also passed, preserving D-PL2-05's
fail-closed walks and D-PL2-12/D-PL2-17 containment.

The exact final merged `npm run check` at `059a1edd` remains reusable because
`git diff --stat 059a1edd..5ed6eb61 -- . ':(exclude,glob).planning/**/*.md'`
is empty. It passed all static checks, 1,142 Cucumber scenarios, 11,734 steps,
and 309 direct LCOV records. No production or test file changed during this
audit; Phase 2 remains Nyquist-compliant.

## Final Integrated Stale-Verification Audit 2026-10-29

| Metric                   | Count |
| ------------------------ | ----: |
| Gaps found               |     0 |
| Resolved                 |     0 |
| Escalated                |     0 |
| Phase requirements green |   8/8 |

The final integrated tree after the Phase 1 diagnostic fix preserves every
Phase 2 requirement and must-have. The ten public Phase 2 scenarios passed
with 159 steps and 2 hooks. They cover PENDMOVE-01 and MISSORDER-01 row parity
and convergence, same-run dependent disablement, installed-copy enable and
update reads, marketplace-add/bootstrap/autoupdate settlement, and the
D-PL2-11 refusal report.

The current owner selection passed 1,387 tests across 14 modules: command
registration, marketplace add, plugin operations and update preflight, the
installed-declaration reader and index, and reconcile apply, convergence,
verdict, load, notification, pending, and read-pass. This directly rechecks
D-PL2-05 fail-closed walks, D-PL2-12/D-PL2-17 containment, scheduled-install
release, post-move ordering, and scope-isolated dependency installation.

The exact integrated `npm run check` at executable head `be0de0c3` remains
reusable at `52bc5652`: the executable-input diff between those revisions is
empty. With Node `v26.12.1`, the gate passed all static checks, 1,145 Cucumber
scenarios, 11,777 steps, and 309 direct LCOV records. No source, test,
dependency, configuration, runtime, or tooling input changed after that gate.
This audit changed only this validation record and preserved the
orchestrator-owned `.planning/STATE.md` delta.

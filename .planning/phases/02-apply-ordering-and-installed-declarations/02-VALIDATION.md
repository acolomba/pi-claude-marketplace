---
phase: "2"
slug: "apply-ordering-and-installed-declarations"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
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
| RCN-02 | Scope lock held at MISS-01; only that install fails and retry succeeds | none: no deterministic public seam at the post-move/install boundary | ⬜ unverified |
| RCN-03 | Scope lock held at final judgment disable; retry disables dependent | none: no deterministic public seam at the judgment/disable boundary | ⬜ unverified |
| RCN-05 | Installed-copy reads overlap a same-scope uninstall | none: existing installed-copy cases do not coordinate the read with removal | ⬜ unverified |
| RCN-07 | A later MISS-01 cascade member fails and the earlier member is rolled back | `node --test --test-name-pattern 'a refused missing dependency rolls back its earlier committed cascade member' test/orchestrators/reconcile/apply.test.ts` | ✅ green |

The three PLAN prohibitions remain flagged. Existing same-run apply cases show dependents disabled when the disable succeeds, but a lock-held disable in RCN-03 can leave one enabled until retry, so the unconditional wording needs a decision. D-09-14 permits an already-disabled dependent's remedy row to be silent on retry. Add, bootstrap and autoupdate scope tests cover their named paths; they do not prove a universal absence of cross-scope installs.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for focused task checks
- [ ] `nyquist_compliant: true` set in frontmatter; three concurrency backstops and the PLAN prohibitions remain unverified

**Approval:** validated. `npm run check` exited 0 on `67a589aa` with Node `v26.12.1` in this worktree: static checks passed, Cucumber passed 1,120 scenarios and 11,411 steps, and direct coverage merged 309 records. The RCN-03 focused scenario also passed 1 scenario and 15 steps. The full run needed loopback access because the default sandbox denied the Cucumber harness binding to `127.0.0.1`.

The later verification audit found additional PLAN backstops. The prior full gate predates the new test assertions above; their focused verification is recorded in the backstop map. Nyquist compliance remains partial until the unverified backstops and flagged prohibitions are resolved.

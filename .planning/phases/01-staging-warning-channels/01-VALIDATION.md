---
phase: "1"
slug: "staging-warning-channels"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test <test-path>` and `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~120 seconds (full); ~5-20 seconds (one pair) |

---

## Sampling Rate

- **After every task commit:** owner tests of the touched pairs plus `npm run test:coverage:direct -- <each touched source>`; `npm run typecheck` when a shared type changes
- **After every plan wave:** `npm run check` on the merged tree
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Requirement Verification Map

| Requirement | Test Type | Automated Command | File Exists |
|-------------|-----------|-------------------|-------------|
| WRN-01 | unit + scenario | `node --test test/orchestrators/plugin/enable-disable.test.ts`; `npx cucumber-js features/plugin/staging-warnings.feature` | unit yes; scenario yes |
| WRN-02 | unit + scenario | `node --test test/orchestrators/marketplace/update.messaging.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/plugin/shared.test.ts`; `npx cucumber-js features/plugin/staging-warnings.feature` | unit yes; scenario yes |
| WRN-03 | unit + typecheck + scenario | `node --test test/shared/staging-warnings.test.ts test/bridges/*/stage.test.ts`; `npm run typecheck` | yes |
| WRN-04 | unit + scenario | `node --test test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | unit yes; scenario yes |
| WRN-05 | unit | `node --test --test-name-pattern 'force' test/bridges/agents/stage.test.ts` | yes |
| WRN-06 | unit + scenario | `node --test test/orchestrators/plugin/dependency-settle.test.ts test/orchestrators/plugin/materialize-latest.test.ts test/orchestrators/plugin/update-flow.test.ts` | unit yes; scenario yes |
| WRN-07 | unit | `node --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-record.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | yes |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `extensions/pi-claude-marketplace/shared/staging-warnings.ts` + `test/shared/staging-warnings.test.ts` (WRN-03)
- [x] `features/plugin/staging-warnings.feature` and new `Given` steps (colliding skill; duplicate agents)

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated on the integrated tree, 2026-10-28


## Nyquist Audit — 2026-10-28

All seven WRN requirements have discriminating automated evidence. The existing
16-scenario staging-warnings feature checks complete command results for enable,
install/update/reinstall failures, marketplace and apply cascades, and dependency
MCP notices. The paired unit cases check warning channel partitioning and the
type barrier, forced agents-index preservation, dependency notice propagation,
`resourcesChanged` in both directions, and a single reinstall cache drop.

| Scope | Command | Result |
|-------|---------|--------|
| User-visible WRN-01/02/03/04/06 | `npx cucumber-js features/plugin/staging-warnings.feature` | 16 scenarios, 191 steps passed |
| WRN-03 type barrier | `npm run typecheck` | passed |
| WRN-01/03/05/06/07 focused unit cases | `node --test --test-name-pattern 'D-PL1|WRN-0' test/shared/staging-warnings.test.ts test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-record.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/update-flow.test.ts` | 6 test modules passed |
| WRN-02/03/04/06 focused unit cases | `node --test --test-name-pattern 'D-PL1|WRN-0' test/orchestrators/marketplace/update.messaging.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/plugin/shared.test.ts test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/dependency-settle.test.ts test/orchestrators/plugin/materialize-latest.test.ts` | 9 test modules passed |

The first Cucumber attempt could not bind `127.0.0.1` in the restricted
sandbox (`listen EPERM`); no scenarios ran in that attempt. Re-running with
loopback permission passed. The phase gate (`npm run check`) is owned by the
execute-phase orchestrator and was not duplicated in this audit.

## Final Merged-Tree Nyquist Audit — 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Public scenarios | 20/20 |
| Public steps | 248/248 |

The final A+B+C tree keeps discriminating evidence for WRN-01 through WRN-07
across the post-split install flow. The current owners cover the install
cascade context and dependency ledger, install failure projection, update
swap, dependency settlement, apply outcome projection, reconcile
notifications, and forced agent staging. The focused owner command passed all
16 selected modules with the D-PL1, WRN, and carrier cases enabled.

`npx cucumber-js features/plugin/staging-warnings.feature` passed all 20
scenarios and 248 steps. It covers standalone install, update, reinstall and
enable diagnostics; failed install/update/reinstall diagnostics; marketplace
and apply cascades; dependency MCP notices on success and refusal; moved
dependency notices; final-config and later-move failures; package notes; and
row-order preservation across marketplaces.

Phase 10 decision D-PL10-13 formally supersedes Plan 01-03's older literal for
a staged generated name whose index row points at another file. The current
owner proves that force preserves that row and file and reports the hygiene
warning. D-PL1-15 still proves replacement of a staged row whose own file was
edited while preserving a hand-named row. The separate NFR-10 case proves
that force refuses an owned row outside the agents directory and removes
nothing. Restoring the older literal would contradict the final safety
decision and is not a validation gap.

The execute-phase orchestrator's exact merged-tree `npm run check` passed all
static checks, 1,142 scenarios, 11,734 steps, and 309 direct LCOV records at
merge `059a1edd`. No source or test file changed in this audit.

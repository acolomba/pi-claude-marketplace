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

## Final Integrated Stale-Verification Re-audit — 2026-10-29

**Verdict:** COMPLIANT. All seven Phase 1 requirements have discriminating
automated coverage on integrated HEAD `9eedb66b114ac07c44c59f86f39fdc66260edec4`.
No validation gap was found, and this audit changed no source, test, fixture,
configuration, or runtime input.

| Requirement | Final integrated evidence | Status |
|---|---|---|
| WRN-01 | The enable scenario checks the complete row and diagnostic. Eight `D-PL1-12` owner cases distinguish standalone, hygiene-only, failed, dependency-member, orchestrated, clean, disable, and save-failure outcomes. | FILLED |
| WRN-02 | Marketplace-update and apply scenarios check discovery-only and mixed discovery/hygiene diagnostics, failure headers, row order, and scope. The current `staging-diagnostics`, marketplace messaging, apply projection, notification, and apply owners passed. | FILLED |
| WRN-03 | Constructor, partition, producer-tag, and renderer owner cases passed. The integrated full gate's typecheck accepted both `@ts-expect-error` barriers, so a hygiene warning still cannot enter the discovery channel or discovery-only renderer. | FILLED |
| WRN-04 | The install, update, and reinstall failure scenarios check the failed row followed by the warning diagnostic. The current split install-flow ledger owner, install capture, candidate report, swap, update, materialize, and reinstall owners passed. | FILLED |
| WRN-05 | `D-PL1-15` proves that force replaces the staged row it owns and preserves a hand-named row and file. `D-PL10-13` proves the superseding rule: a staged-name row aimed at another file is preserved with that file. | FILLED |
| WRN-06 | Public scenarios cover installed dependency notices on success and refusal, moved-dependency notices, final-config failure, later-move failure, and row order. Dependency-settle, materialize-latest, install planning, and update owners passed. | FILLED |
| WRN-07 | Four update-swap cases cover all before/after inventory combinations, including hooks-only false. Two reinstall-record cases prove both boolean mappings, and reinstall-flow cases prove one cache drop and no cache-deferral note. | FILLED |

### Fresh commands

| Scope | Command | Result |
|---|---|---|
| Public behavior | `npx cucumber-js features/plugin/staging-warnings.feature` | exit 0; 20 scenarios, 248 steps passed |
| Focused owners | `node --test --test-name-pattern 'D-PL1|WRN-0'` over the 18 current Phase 1 owner modules | exit 0; 104 tests passed |
| Full integrated gate | `npm run check` | reused on unchanged executable inputs at the same HEAD: exit 0; 1,144 scenarios, 11,758 steps, 309 merged LCOV records |

The focused owner set includes the post-split install ledger and dependency
ledger, `staging-diagnostics.ts`, the moved marketplace messaging and
dependency-settlement owners, update swap/materialization/flow, reconcile
projection and notification, and the forced agents commit. Node was
`v26.12.1`. The only dirty file during the audit was the execute-phase
orchestrator's `.planning/STATE.md`; `git diff` reported no executable-input
change and no untracked file.

The final diagnostic scenarios intentionally expect fail-closed path output.
Ambiguous diagnostic suffixes now stop at `[redacted path]`; the 20-scenario
run proves those exact public bytes. Phase 10 decision D-PL10-13 supersedes
Plan 01-03's older staged-name-only literal. Reintroducing that literal would
delete a foreign file, so the current preservation behavior is the WRN-05
proof used here.

### Gap disposition

| Disposition | Count |
|---|---:|
| FILLED | 7 |
| ESCALATED | 0 |
| SKIP | 0 |

No new test was needed because every adversarial behavior remains exercised
by a test that can fail and did pass on the final integrated tree.

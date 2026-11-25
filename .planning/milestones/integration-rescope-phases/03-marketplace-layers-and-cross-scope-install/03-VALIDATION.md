---
phase: "3"
slug: "marketplace-layers-and-cross-scope-install"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-21"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration file |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 1 features/<function>/<file>.feature` (6-16 s per file), with the non-DAC environment of `03-CONTEXT.md` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds per focused run; the full check is far longer (2,400-second limit) |

---

## Sampling Rate

- **After every task commit:** the touched feature files under adapter, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled by the planner from `03-RESEARCH.md` "Phase Requirements → Test Map" and the four plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | ITMIG-05 | T-03-01, T-03-02 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/marketplace/autoupdate.feature` (`44 scenarios (44 passed)`); A1 fails the D-09 named-flip scenario; `check:static` | ✅ | ✅ green |
| 3-01-02 | 01 | 1 | ITMIG-05 | T-03-01, T-03-03 | a red run counts only on an assertion | behavioral | adapter `autoupdate.feature` (`46 scenarios (46 passed)`); A1, A2, A3 fail the D-09 named flip, the D-09 unnamed flip, and the CFG-03 flip; `check:static` | ✅ | ✅ green |
| 3-01-03 | 01 | 1 | ITMIG-05 | T-03-05 | the deletion follows every red proof | behavioral + static | A4 fails `autoupdate.feature:262` and `:279`, A5a `:241`, A5b `:574`; `check:static` and `fallow audit` (only `weakened-tests`) without `test/integration/marketplace-layer-autoupdate.test.ts`; builtin (`0 scenarios`) | ✅ | ✅ green |
| 3-02-01 | 02 | 1 | ITMIG-05 | T-03-06, T-03-07 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/marketplace/remove.feature` (`53 scenarios (53 passed)`); R1 fails the named remove of an undeclared url marketplace; `check:static` | ✅ | ✅ green |
| 3-02-02 | 02 | 1 | ITMIG-05 | T-03-06, T-03-08 | a red run counts only on an assertion | behavioral | adapter `remove.feature` (`60 scenarios (60 passed)`); R1, R10, R4, R9, R3, R2, R5 each fail their url remove scenarios; `check:static` | ✅ | ✅ green |
| 3-02-03 | 02 | 1 | ITMIG-05 | T-03-10 | the three EACCES fault-injection cases stay | behavioral + integration + static | R6 fails `remove.feature:514` and `:542`, R7 `:592`, R8 `state-lock.feature:7` and `:37`; `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=spec test/integration/marketplace-layer-remove.test.ts` (`tests 3`, `pass 3`); `check:static`; `fallow audit` (only `weakened-tests`); builtin (`0 scenarios`) | ✅ | ✅ green |
| 3-03-01 | 03 | 1 | ITMIG-05 | T-03-11, T-03-12 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/marketplace/url-source.feature` (`10 scenarios (10 passed)`); D2 fails the unpinned own-repository scenario; `check:static` | ✅ | ✅ green |
| 3-03-02 | 03 | 1 | ITMIG-05 | T-03-11, T-03-16 | the deletion follows D1 | behavioral + static | adapter `url-source.feature` (`13 scenarios (13 passed)`); D1 fails both re-declarations, D2 both own-repository scenarios; `check:static` before and after the deletion of `test/integration/marketplace-layer-redeclare.test.ts` | ✅ | ✅ green |
| 3-03-03 | 03 | 1 | ITMIG-05 | T-03-13, T-03-15 | the seed stays same-repository and is keyed by the plugin's own url (SEED-03, SEED-04 unchanged) | unit + behavioral + integration + static | before the fix: adapter `url-source.feature` (`15 scenarios (13 passed, 2 failed)`) and `--test-name-pattern 'D-SEED-01'` (`fail 2`); after it: the same pattern (`pass 2`), `env -i ... npm run test:coverage:direct --` for `orchestrators/plugin/clone-cache.ts` and `domain/clone-key.ts`, `test/integration/marketplace-add-seed-mirrors.test.ts` (`tests 6`, `pass 6`), adapter `url-source.feature` (`15 scenarios (15 passed)`), D2 fails all four own-repository scenarios, `check:static`, `fallow audit` (only `weakened-tests`), builtin (`0 scenarios`) | ✅ | ✅ green |
| 3-04-01 | 04 | 1 | ITMIG-06 | T-03-17, T-03-18 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/plugin/cross-scope-install.feature` (`6 scenarios (6 passed)`); C2 fails the MA-12 scenario; `check:static` | ✅ | ✅ green |
| 3-04-02 | 04 | 1 | ITMIG-06 | T-03-17, T-03-21 | the planted trees stay inside the scenario's own scope root | behavioral | adapter `cross-scope-install.feature` (`10 scenarios (10 passed)`); C1, C2, C3, C4, C6 fail the WR-07, MA-12, MA-13, D-MF-04, and dependency-marketplace scenarios; `check:static` | ✅ | ✅ green |
| 3-04-03 | 04 | 1 | ITMIG-06 | T-03-22 | the deletion follows every red proof | behavioral + static | C8 fails the D-MF-04 scenario and `remove.feature:724`, `:729`, `:764`, `:769`, `:796`, `:801`; `check:static` and `fallow audit` (only `weakened-tests`) without `test/integration/project-install-adds-user-marketplace.test.ts`; builtin (`0 scenarios`) | ✅ | ✅ green |

Every cucumber run passes `--profile <name> --parallel 1` with the non-DAC prefix of `03-CONTEXT.md`; every lint, static check, coverage run, audit, and commit runs under `flock -w 3600` on the shared lock `phase03-heavy.lock`, because the four plans of the one wave share a 4-CPU, 15 GB host. Direct coverage runs under `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp` as well (STATE.md).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Six new steps land in the plans that use them, each plan owning its shared module in the one wave: 03-02 adds two to `features/step_definitions/plugin/installation.steps.ts`, 03-03 one to `features/step_definitions/marketplace/publishing.steps.ts` (with its builder in `features/lib/git-plugin.ts`), and 03-04 three to `features/step_definitions/marketplace/checkout.steps.ts`. No separate wave.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-24 (Nyquist audit: re-ran adapter `autoupdate`, `remove`, `url-source`, `state-lock`, `cross-scope-install` features --parallel 2: `167 scenarios (167 passed)`; `marketplace-layer-remove.test.ts` + `marketplace-add-seed-mirrors.test.ts`: `pass 9`; `--test-name-pattern D-SEED-01` over `test/orchestrators/plugin/{clone-cache,install-flow-ledger}.test.ts`: `pass 6`; the three deleted integration files stay absent)

## Validation Audit 2026-11-24

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

---
phase: "2"
slug: "plugin-layers-names-and-list-fold"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration file |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/<file>.feature` (6-13 s per file), with the non-DAC environment of `02-CONTEXT.md` |
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

Filled by the planner from `02-RESEARCH.md` "Phase Requirements → Test Map".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | ITMIG-01 | T-02-01, T-02-02 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/plugin/install.feature` (`30 scenarios (30 passed)`); B1 with `--name 'LAYER-04, CFG-03'` fails both install scenarios; `check:static` | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | ITMIG-01 | T-02-01, T-02-03 | a red run counts only on an assertion | behavioral | adapter uninstall, enable, disable, update, reinstall (`103 scenarios (103 passed)`); B1 fails the 10 non-uninstall LAYER-04 scenarios; B2 fails the 2 of uninstall; `check:static` | ✅ | ⬜ pending |
| 2-01-03 | 01 | 1 | ITMIG-01 | T-02-05 | the LAYER-06 cases stay | integration + static | B12 fails both LAYER-08 scenarios; `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=spec test/integration/plugin-layer-verbs.test.ts` (`tests 2`, `pass 2`); `check:static`; `fallow audit` (only `weakened-tests`); builtin (`1 scenario (1 passed)`) | ✅ | ⬜ pending |
| 2-02-01 | 02 | 1 | ITMIG-02 | T-02-06, T-02-07 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/plugin/configuration.feature` (`7 scenarios (7 passed)`); B8 fails the local-gap apply scenario; `check:static` | ✅ | ⬜ pending |
| 2-02-02 | 02 | 1 | ITMIG-02 | T-02-06, T-02-08 | a red run counts only on an assertion | behavioral | adapter `configuration.feature` and `config-migration.feature` (`27 scenarios (27 passed)`); B8, B9, B14, B10, B11 each fail their scenarios; `check:static` | ✅ | ⬜ pending |
| 2-02-03 | 02 | 1 | ITMIG-02 | T-02-10 | the deletion follows every red proof | static | `check:static` and `fallow audit` (only `weakened-tests`) without `test/integration/plugin-layer-consistency.test.ts`; builtin (`0 scenarios`) | ✅ | ⬜ pending |
| 2-03-01 | 03 | 1 | ITMIG-03 | T-02-11, T-02-12 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/plugin/reserved-names.feature` (`1 scenario (1 passed)`); B3 fails the `constructor` install; `check:static` | ❌ new (Task 1 creates it) | ⬜ pending |
| 2-03-02 | 03 | 1 | ITMIG-03 | T-02-11, T-02-13 | own-key handling of `constructor` pinned (D-08-07) | behavioral | adapter `reserved-names.feature` (`13 scenarios (13 passed)`); B3 fails all 13; `check:static` | ✅ after 2-03-01 | ⬜ pending |
| 2-03-03 | 03 | 1 | ITMIG-03 | T-02-13, T-02-16 | `__proto__` refused and `hello@constructor` recorded nowhere (D-08-07, D-PL5-28) | behavioral + static | adapter `reserved-names.feature` (`24 scenarios (24 passed)`); B3, B4, B5, B13 each fail their scenarios; `check:static`; `fallow audit` (only `weakened-tests`); builtin (`0 scenarios`) | ✅ after 2-03-01 | ⬜ pending |
| 2-04-01 | 04 | 1 | ITMIG-04 | T-02-17, T-02-19 | breaks restored, never committed; helper runs in its own checkout | behavioral | adapter `features/plugin/list.feature` (`14 scenarios (14 passed)`); B6 fails the fold scenario; `check:static` | ✅ | ⬜ pending |
| 2-04-02 | 04 | 1 | ITMIG-04 | T-02-17, T-02-20 | a red run counts only on an assertion | behavioral | adapter `list.feature` (`15 scenarios (15 passed)`); B6b fails the same-name scenario; B7 and B6 fail the fold scenario; `check:static` | ✅ | ⬜ pending |
| 2-04-03 | 04 | 1 | ITMIG-04 | T-02-18, T-02-22 | the product change is JSDoc comment lines only | unit + static | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts`; `check:static`; `fallow audit` (only `weakened-tests`); builtin (`0 scenarios`); `git diff -U0` under `extensions/` holds only ` * ` lines | ✅ | ⬜ pending |

Every cucumber run passes `--profile <name> --parallel 1` with the non-DAC prefix of `02-CONTEXT.md`; every lint, static check, coverage run, audit, and commit runs under `flock -w 3600` on the shared lock `phase02-heavy.lock`, because the four plans of the one wave share a 4-CPU, 15 GB host.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (no new step, fixture, or support module; research).

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

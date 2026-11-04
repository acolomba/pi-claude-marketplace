---
phase: "5"
slug: "hook-tool-names"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-04"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The
> requirement-to-test map is in `05-RESEARCH.md` "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock`; cucumber-js profiles `adapter` and `builtin` |
| **Config file** | `package.json` scripts, `cucumber.json` (frozen) |
| **Quick run command** | `node --test test/bridges/hooks/dispatch.test.ts` (any touched pair) |
| **Full suite command** | `npm run check` plus both cucumber profiles; `npm run test:modules` at the phase gate |
| **Estimated runtime** | ~900 seconds (full); ~5 seconds (one pair) |

All npm scripts run with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (root container).

---

## Sampling Rate

- **After every task commit:** the touched pairs' tests plus `npm run check:static` (the commit hook runs `check:commit`)
- **After every plan wave:** `npm run check` on the combined tree plus both cucumber profiles
- **Before `/gsd-verify-work`:** full suite green, plus `npm run test:modules`
- **Max feedback latency:** 60 seconds for a pair

---

## Per-Task Verification Map

Filled by the planner per task (`<automated>` with `<fails_when>`). Requirement coverage:

| Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|------------------------|-----------|-------------------|-------------|--------|
| D-P5-02, D-P5-04 | unit | `node --test test/domain/components/hooks/builtin-mcp-tool-names.test.ts` | ❌ W0 | ⬜ pending |
| D-P5-01, D-P5-06, D-P5-07 | unit | `node --test test/bridges/hooks/mcp-tool-view.test.ts` | ❌ W0 | ⬜ pending |
| D-P5-03, MHK-02 | unit | `node --test test/bridges/hooks/dispatch.test.ts` | ✅ extend | ⬜ pending |
| D-P5-04 (`if`) | unit | `node --test test/bridges/hooks/if-field/index.test.ts` | ✅ extend | ⬜ pending |
| MHK-01 (D-P5-08, D-P5-09) | cucumber | `npx cucumber-js --profile builtin features/hook/mcp-tool-names.feature` (and `--profile adapter`) | ❌ W0 | ⬜ pending |
| MHK-02 (D-P5-10, D-P5-11) | cucumber | `npx cucumber-js --profile builtin features/hook/tool-use.feature` (and `--profile adapter`) | ✅ edit | ⬜ pending |
| tags | static | `npm run check:features` | ✅ | ⬜ pending |

Per task (each runnable command in the plan carries a `<fails_when>`; `npm` commands run with the nondac prefix):

| Task | Wave | Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|------|------|------------------------|-----------|-------------------|-------------|--------|
| 05-01 T1 | 1 | MHK-01; D-P5-01, -02, -03, -04, -05, -08, -13 | unit + cucumber | `node --test test/domain/components/hooks/builtin-mcp-tool-names.test.ts test/bridges/hooks/mcp-tool-view.test.ts test/bridges/hooks/dispatch.test.ts`; `npm run test:coverage:direct -- <the three sources>`; `npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature` (and `--profile adapter` with `features/hook/tool-use.feature`); `npm run check:static` | ❌ W0 (created by the task) | ⬜ pending |
| 05-01 T2 | 1 | MHK-01; D-P5-03, -04, -08 | unit + cucumber | `node --test test/bridges/hooks/if-field/index.test.ts test/bridges/hooks/dispatch.test.ts`; coverage of `if-field/index.ts` and `dispatch.ts`; both profiles on `features/hook/mcp-tool-names.feature`; `npm run check:static` | ✅ extend | ⬜ pending |
| 05-02 T1 | 2 | MHK-02; D-P5-06, -07, -10 | unit + cucumber | `node --test test/bridges/hooks/mcp-tool-view.test.ts test/bridges/hooks/dispatch.test.ts`; coverage; both profiles on `features/hook/tool-use.feature`; `npm run check:static` | ✅ extend | ⬜ pending |
| 05-02 T2 | 2 | MHK-02; D-P5-07, -11 | unit + cucumber | `node --test test/bridges/hooks/event-router.test.ts test/architecture/no-factory-time-probe.test.ts test/index.test.ts`; coverage; both profiles on `features/hook/tool-use.feature`; `npm run check:static` | ✅ extend | ⬜ pending |
| 05-03 T1 | 2 | MHK-01; D-P5-09 | cucumber | `npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature`; `npm run check:static` | ❌ W0 (stub created by the task) | ⬜ pending |
| 05-03 T2 | 2 | MHK-01, MHK-02; D-P5-03, -14 | cucumber + docs | both profiles on `features/hook/mcp-tool-names.feature`; `pre-commit run --files docs/hooks-compatibility.md ...`; `npm run check:features` | ✅ extend | ⬜ pending |
| 05-04 T1 | 3 | MHK-01, MHK-02; D-P5-12 | full gate + red sweep | the `npm run check` parts, `npm run test:modules`, the red sweep on the Phase 1 product code, the ownership check | ✅ | ⬜ pending |
| 05-04 T2 | 3 | D-P5-12, D-P5-14 | record | `grep -c '^## Parent lines'` and the other section checks on 05-04-SUMMARY.md | ❌ (created by the task) | ⬜ pending |

Red proofs (D-P5-12) run after each scenario task's commit against the Phase 1 product code (`git restore --source=640419724c48a60c7bb469acf0fde6f3a6ea7852 --worktree -- extensions/pi-claude-marketplace/bridges/hooks extensions/pi-claude-marketplace/domain/components/hooks`, then back to `HEAD`); 05-04 repeats the sweep on the final scenario texts.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/domain/components/hooks/builtin-mcp-tool-names.test.ts` — D-P5-02, D-P5-04
- [ ] `test/bridges/hooks/mcp-tool-view.test.ts` — D-P5-01, D-P5-06, D-P5-07
- [ ] `features/hook/mcp-tool-names.feature` with its `features/lib/hook-*.ts` helpers

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s per pair
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

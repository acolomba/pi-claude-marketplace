---
phase: 13
slug: conformance-refactor-es-5-supersession
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-23
audited: 2026-05-24
---

# Phase 13 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from RESEARCH.md §"Validation Architecture" (lines 978-1030).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in; bundled with Node ≥22) |
| **Config file** | `tsconfig.json` (native TS strip on Node 22.18+) + `package.json` `scripts.test` |
| **Quick run command** | `node --test "tests/architecture/**/*.test.ts" "tests/presentation/**/*.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + full test suite) |
| **Estimated runtime** | Quick ≤5s · full ≤60s (historical baseline) |

---

## Sampling Rate

- **After every task commit:** `node --test "tests/architecture/**/*.test.ts" "tests/presentation/**/*.test.ts"` (catches drift early; ≤5s)
- **After every plan wave:** `npm run check` (typecheck + ESLint + Prettier + ~1000 tests)
- **Before `/gsd:verify-work`:** `npm run check` green AND `node --test tests/architecture/catalog-uat.test.ts` green; this is the Wave 3 plan-#1 gate per D-13-04 -- if catalog UAT fails, the Wave 3 plan-#2 ES-5 atomic commit DOES NOT run.
- **Max feedback latency:** 5 seconds for per-task; 60 seconds for per-wave.

---

## Per-Task Verification Map

| Req ID | Behavior | Plan | Wave | Test Type | Automated Command | File Exists | Status |
|--------|----------|------|------|-----------|-------------------|-------------|--------|
| CMC-01 | Token order on every emission | Wave 1 + Wave 3 UAT | 1 / 3 | catalog UAT | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |
| CMC-02 | `@<mp>` carve-out on cascade rows | Wave 1 + sub-wave 2a | 1 / 2a | catalog UAT + structural typing | (same as CMC-01) | ✅ | ✅ green |
| CMC-03 | Per-scope rendering + sort tie-break | sub-wave 2c / 2d | 2c / 2d | catalog UAT (mp-list mixed-scopes) | (catalog UAT) | ✅ | ✅ green |
| CMC-04 | Reasons `{}` block formatting | Wave 1 | 1 | catalog UAT + grammar-frontmatter (existing) | (catalog UAT) | ✅ | ✅ green |
| CMC-05 | `<marker>` slot rendering | sub-wave 2c | 2c | catalog UAT (mp-add github / autoupdate enable) | (catalog UAT) | ✅ | ✅ green |
| CMC-06 | Plugin-row icons | Wave 1 + sub-wave 2d | 1 / 2d | catalog UAT (every plugin row) | (catalog UAT) | ✅ | ✅ green |
| CMC-07 | Marketplace icons | sub-wave 2c | 2c | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-09 | `(upgradable)` list-only | Wave 1 RowSpec | 1 | TS compile (structural: only `PluginListRow.status` includes `"upgradable"`) | `npm run typecheck` | ✅ | ✅ green |
| CMC-10 | Empty bare-token routing | sub-wave 2c / 2d | 2c / 2d | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-12 | Soft-dep reason wording | Wave 1 | 1 | grammar-frontmatter (existing) -- `requires pi-subagents` / `requires pi-mcp` in REASONS | `node --test tests/architecture/grammar-frontmatter.test.ts` | ✅ | ✅ green |
| CMC-13 | Per-row soft-dep emission | Wave 1 + sub-wave 2a / 2d | 1 / 2a / 2d | unit: `renderRow` emits when (declares ∧ unloaded), omits otherwise | `node --test tests/presentation/compact-line.test.ts` | ✅ | ✅ green |
| CMC-15 | Reload-hint + recovery anchor coexist | Wave 1 + sub-wave 2c | 1 / 2c | catalog UAT (mp-remove partial example, line 637-651) | (catalog UAT) | ✅ | ✅ green |
| CMC-16 | Manual recovery line shape | Wave 1 + sub-wave 2c | 1 / 2c | catalog UAT (manual-recovery example, line 722-736) + unit `renderManualRecovery` | `node --test tests/presentation/manual-recovery.test.ts` | ✅ | ✅ green |
| CMC-17 | Rollback-partial parent+children | Wave 1 + sub-wave 2b | 1 / 2b | catalog UAT (install rollback line 304-307; update rollback line 437-442) | (catalog UAT) + `node --test tests/presentation/rollback-partial.test.ts` | ✅ | ✅ green |
| CMC-18 | Cause-chain depth-5 + `(truncated)` | Wave 1 | 1 | unit: walk depth 0/1/3/5/6/cycle/non-Error | `node --test tests/presentation/cause-chain.test.ts` | ✅ | ✅ green |
| CMC-20 | Cascade severity routing (MSG-SR-4..6) | Wave 1 + sub-wave 2a | 1 / 2a | unit: every row class → expected severity | `node --test tests/presentation/cascade-summary.test.ts` | ✅ | ✅ green |
| CMC-21 | Per-scope fold + adoption round-trip | sub-wave 2d | 2d | integration: `marketplace add` → `list` → assert orphan fold; add project-scope mp → re-`list` → assert adoption | `node --test tests/integration/fold-adoption.test.ts` | ✅ | ✅ green |
| CMC-22 | `/claude:plugin list` UAT | sub-wave 2d | 2d | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-23 | `install` UAT | sub-wave 2b | 2b | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-24 | `uninstall` UAT | sub-wave 2b | 2b | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-25 | `reinstall` UAT | sub-wave 2a | 2a | catalog UAT (includes `(reinstalled)` token per D-13-20) | (catalog UAT) | ✅ | ✅ green |
| CMC-26 | `update` UAT | sub-wave 2a | 2a | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-27 | `import` UAT | sub-wave 2a | 2a | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-28 | `bootstrap` UAT | sub-wave 2b | 2b | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-29 | `marketplace list` UAT | sub-wave 2c | 2c | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-30 | `marketplace add` UAT | sub-wave 2c | 2c | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-31 | `marketplace remove` conditional UAT | sub-wave 2c | 2c | catalog UAT (bare-row vs header form) | (catalog UAT) | ✅ | ✅ green |
| CMC-32 | `marketplace update` UAT | sub-wave 2c | 2c | catalog UAT (autoupdate-on vs autoupdate-off) | (catalog UAT) | ✅ | ✅ green |
| CMC-33 | `marketplace autoupdate enable\|disable` UAT | sub-wave 2c | 2c | catalog UAT | (catalog UAT) | ✅ | ✅ green |
| CMC-34 | Entity-shape vs usage-error split | sub-wave 2c (edge) | 2c | catalog UAT + edge handler unit tests (some exist at `tests/edge/router.test.ts`) | (catalog UAT) + `node --test tests/edge/router.test.ts` | ✅ | ✅ green |
| CMC-35 | ES-5 marker absence | Wave 1 + Wave 3 plan #2 | 1 / 3 | static-audit (5 strings zero-match in non-test files outside `shared/markers.ts`) + ESLint `no-restricted-imports` failure on `npm run check` | `node --test tests/architecture/no-legacy-markers.test.ts` + `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 1 must land the following test files BEFORE any sub-wave 2 callsite migrates (each test starts green because no callsite has been migrated yet -- the cutover gate semantics):

- [x] `tests/architecture/no-legacy-markers.test.ts` -- covers CMC-35 (D-13-12); 5 legacy strings pinned literally; greps non-test files outside `shared/markers.ts`. Starts green; becomes the Wave 3 atomic-commit gate.
- [x] `tests/presentation/compact-line.test.ts` -- covers CMC-01 (token order), CMC-04 (reasons block), CMC-06 (plugin icons), CMC-13 (per-row soft-dep emission), MSG-IC-1..3.
- [x] `tests/presentation/cascade-summary.test.ts` -- covers CMC-20 / MSG-SR-4..6 (severity routing).
- [x] `tests/presentation/cause-chain.test.ts` -- covers CMC-18 / MSG-CC-1 (depth-5 walk + cycle detection + `(truncated)` suffix + non-`Error` causes).
- [x] `tests/presentation/manual-recovery.test.ts` -- covers CMC-16 / MSG-MR-1..2.
- [x] `tests/presentation/rollback-partial.test.ts` -- covers CMC-17 / MSG-RP-1.

Wave 2 sub-wave 2d must add:

- [x] `tests/integration/fold-adoption.test.ts` -- covers CMC-21 (orphan fold + adoption round-trip).

Wave 3 plan #1 must add:

- [x] `tests/architecture/catalog-uat.test.ts` -- extracts fenced rendered examples from `docs/output-catalog.md` per-command H2 sections; asserts byte-equal against renderer output; covers CMC-01..07, CMC-09, CMC-10, CMC-15..17, CMC-22..34.

Existing tests REWRITTEN during sub-waves:

- [x] `tests/presentation/plugin-list.test.ts` -- rewrite for new `RowSpec` contract (sub-wave 2d).
- [x] `tests/presentation/marketplace-list.test.ts` -- rewrite for new `RowSpec` contract (sub-wave 2c).
- [x] `tests/presentation/reload-hint.test.ts` -- minor update for blank-line MSG-RH-1 + recovery-anchor coexistence (Wave 1 + sub-wave 2c).

**Framework install:** NONE needed -- `node:test` is built-in to Node ≥22.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator perceives `(reinstalled)` as more informative than `(installed)` on reinstall cascade rows | D-13-20 reconciliation | Cognitive judgement; no programmatic test | Run `pi /claude:plugin reinstall @<mp>` against a small marketplace; confirm cascade rows show `(reinstalled)` and convey that the reinstall partition ran on each row. |

*All other phase behaviors have automated verification via catalog UAT, structural typing, ESLint, or unit/integration tests.*

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify command OR a Wave 0 (Wave 1) dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 (Wave 1) covers all MISSING references -- 6 new unit tests, 1 new architecture test
- [x] No watch-mode flags in any sampling command
- [x] Feedback latency < 5 seconds per task; < 60 seconds per wave
- [x] `nyquist_compliant: true` set in frontmatter once the planner confirms

**Approval:** validated 2026-05-24 (audit)

---

## Validation Audit 2026-05-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Audit method:** Cross-referenced VALIDATION.md against on-disk test files, ran every referenced test command, and reconciled against `13-VERIFICATION.md` (PASS, 5/5 success criteria, 31/31 CMC requirements satisfied, 1142/1142 tests green). Pre-execution draft statuses (`❌ W0` / `⬜ pending`) reflected the planner's then-pending state and never tracked post-execution reality -- this audit reconciles VALIDATION.md to the verified terminal state. No new test files generated; no implementation gaps to fill. Sole `Manual-Only` row (D-13-20 reinstall perceived informativeness) is a cognitive-judgement check by design and remains manual-only.

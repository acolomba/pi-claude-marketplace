---
phase: 20
slug: migration-wave-3-edge-handlers-usageerror
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
updated: 2026-05-27
---

# Phase 20 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `20-RESEARCH.md` §Validation Architecture; Per-Task Verification Map filled by `gsd-planner` after PLAN.md task IDs were assigned.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in; bundled with Node ≥22) |
| **Config file** | none (test scripts in `package.json::scripts.test`) |
| **Quick run command** | `node --test <touched test file>` (per-handler / per-orchestrator-test, sub-second per file) |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + full test suite) |
| **Estimated runtime** | full `npm run check` ≈ 30-60 seconds (catalog UAT + per-handler suites dominate) |

---

## Sampling Rate

- **After every task commit:** Run `node --test <touched test file>` for sub-second feedback.
- **After every plan wave merge:** Run `npm run check` -- Plans 20-01/02/03/04 each commit atomically and must be GREEN.
- **Before `/gsd-verify-work`:** Full suite must be GREEN, plus the four phase-gate grep checks:
  1. `npm run check` GREEN
  2. Catalog UAT (`tests/architecture/catalog-uat.test.ts`) GREEN for all 4 `/claude:plugin import` fixtures + the generic usage-error fixture
  3. `grep -rE "notify(Success|Warning|Error)\b" extensions/pi-claude-marketplace/edge/ extensions/pi-claude-marketplace/orchestrators/import/` returns ZERO
  4. `grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/` returns ZERO
- **Max feedback latency:** <60s for `npm run check`; <1s for per-file quick run.

---

## Per-Task Verification Map

> One row per task across Plans 20-01..20-04. Each task maps to a `<automated>` command runnable from the project root that produces a deterministic pass/fail signal in <60s.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-T1 | 20-01 | 1 | SNM-23 | T-20-01-01 | V1 ≡ V2 byte invariance for usage-error wire form across 16 router/marketplace/plugin-shared/plugin-list sites | unit / byte-equality | `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/add.test.ts tests/edge/handlers/marketplace/autoupdate.test.ts tests/edge/handlers/marketplace/list.test.ts tests/edge/handlers/marketplace/remove.test.ts tests/edge/handlers/marketplace/update.test.ts tests/edge/handlers/plugin/list.test.ts` | ✅ | ⬜ pending |
| 20-01-T2 | 20-01 | 1 | SNM-23 | T-20-01-01 | V1 ≡ V2 byte invariance for usage-error wire form across 14 plugin-handler sites (install/update/reinstall/import/bootstrap); mixed `notifyError, notifyUsageError` imports preserved unchanged for Plan 20-03 | unit / byte-equality / phase-wide grep gate | `node --test tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/reinstall.test.ts tests/edge/handlers/import.test.ts tests/edge/handlers/plugin/bootstrap.test.ts && npm run check` | ✅ | ⬜ pending |
| 20-02-T1 | 20-02 | 2 | SNM-23 | T-20-02-01, T-20-02-02, T-20-02-03, T-20-02-04 | Inline V2 cascade construction replacing composeImportSummary + formatClaudeImportSummary; outer try/catch removed; single notify() call; orphan diagnostics + source-mismatch cause-text + idempotent "up to date" DROPPED per locked A1-A3 mappings | typecheck + lint + grep gates | `npm run check` | ✅ | ⬜ pending |
| 20-02-T2 | 20-02 | 2 | SNM-23 | T-20-02-01, T-20-02-04 | Byte-exact V2 cascade assertions across 4 `/claude:plugin import` catalog states; ~5-8 V1-only tests deleted; ~7+ tests rewritten through makeCtx() + real notify() | unit / byte-equality / catalog UAT | `node --test tests/orchestrators/import/execute.test.ts && node --test tests/architecture/catalog-uat.test.ts && npm run check` | ✅ | ⬜ pending |
| 20-03-T1 | 20-03 | 2 | SNM-23 | T-20-03-01, T-20-03-02 | bootstrap.ts catch-all wrapper at lines 57-66 DROPPED; notifyError + errorMessage imports cleaned up; notifyUsageError import preserved for Plan-20-01-migrated sites | unit / lint / grep gates | `node --test tests/edge/handlers/plugin/bootstrap.test.ts` | ✅ | ⬜ pending |
| 20-03-T2 | 20-03 | 2 | SNM-23 | T-20-03-01, T-20-03-02, T-20-03-03 | import.ts catch-all wrapper at lines 40-50 DROPPED; imports cleaned up; `tests/edge/handlers/import.test.ts:111-123` catch-all test DELETED per D-19-01; phase-wide invariant `grep -rcE "notifyError\(" extensions/pi-claude-marketplace/edge/` returns 0 | unit / lint / phase-wide grep gate | `node --test tests/edge/handlers/import.test.ts && npm run check` | ✅ | ⬜ pending |
| 20-04-T1 | 20-04 | 3 | SNM-23 | T-20-04-01 | MSG-Block 1 `ignores: [...]` extended with `orchestrators/import/**` per D-20-07; Block 1b unchanged per IN-06; Block 2 + Blocks 3-6 unchanged | lint suite / grep gate | `npm run check` | ✅ | ⬜ pending |
| 20-04-T2 | 20-04 | 3 | SNM-23 (full closure of migration half) | T-20-04-01 | All 5 Phase 20 Success Criteria GREEN end-to-end | unit + catalog UAT + phase-wide grep gates + full suite | `npm run check && node --test tests/architecture/catalog-uat.test.ts && ( ! grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/edge/handlers/ ) && ( ! grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/import/ ) && ( ! grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/ )` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| SNM-23 (migration half) | V2 1-arg `notifyUsageError` byte-equal to V1 3-arg form across all 30 sites | unit (per-handler) | `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/*.test.ts tests/edge/handlers/import.test.ts` |
| SNM-23 (architecture gate) | Zero V1 3-arg `notifyUsageError(ctx, msg, usage)` callsites remain in `edge/**` | grep gate | `grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/ \| wc -l` returns `0` |
| Implicit (D-20-03) | `bootstrap.ts:65` + `import.ts:49` catch-all wrappers gone | grep gate | `grep -cE "notifyError\(" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns `0` for both |
| Implicit (D-20-02) | `composeImportSummary` + `formatClaudeImportSummary` retired | grep gate | `grep -cE "composeImportSummary\|formatClaudeImportSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns `0` |
| Implicit (D-20-02) | `presentation/cascade-summary` import dropped from `execute.ts` | grep gate | `grep -c "presentation/cascade-summary\|cascadeSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns `0` |
| Implicit (catalog UAT) | `/claude:plugin import` 4 catalog states byte-equal | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` |
| Implicit (catalog UAT) | Generic usage-error fixture byte-equal | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` |
| Implicit (D-20-07) | MSG-Block 1 ignores extended; lint plugin still wired but no-op on migrated surfaces | lint suite | `npm run check` |
| ROADMAP SC #5 | `npm run check` stays GREEN | full suite | `npm run check` |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* The 15 edge-handler test files + `tests/orchestrators/import/execute.test.ts` + `tests/architecture/catalog-uat.test.ts` all exist and exercise the migration surfaces. No new test files, fixtures, or framework changes are needed before Wave 1 begins. `wave_0_complete: true` is set in frontmatter.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The migration is structurally invariant (V1 ≡ V2 byte equivalence for usage errors) or gated by existing catalog UAT (cascade migration) -- no manual visual review is required.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (Per-Task Verification Map fully populated)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has an `<automated>` command)
- [x] Wave 0 covers all MISSING references (Wave 0 is empty -- none required)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (`npm run check`)
- [x] `nyquist_compliant: true` set in frontmatter (Per-Task Verification Map fully populated; plan-checker may validate coverage)

**Approval:** planner-approved 2026-05-27 (Per-Task Verification Map fully populated; awaiting plan-checker independent validation).

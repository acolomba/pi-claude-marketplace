---
phase: 20
slug: migration-wave-3-edge-handlers-usageerror
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-27
---

# Phase 20 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `20-RESEARCH.md` §Validation Architecture; Per-Task Verification Map is filled by `gsd-planner` once PLAN.md task IDs are assigned.

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

> Filled by `gsd-planner` once task IDs are assigned. Each task MUST map to an automated command from the table below (or to a Wave 0 stub if missing -- Wave 0 is empty for Phase 20).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {to be filled by planner} | 20-01..20-04 | 1..3 | SNM-23 | T-20-01 / T-20-02 / T-20-03 | V1 ≡ V2 byte invariance; no dropped severity routing | unit / byte-equality / lint | `node --test <file>` or `npm run check` or grep gate | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| SNM-23 (migration half) | V2 1-arg `notifyUsageError` byte-equal to V1 3-arg form across all 30 sites | unit (per-handler) | `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/*.test.ts` |
| SNM-23 (architecture gate) | Zero V1 3-arg `notifyUsageError(ctx, msg, usage)` callsites remain in `edge/**` | grep gate | `grep -rE "notifyUsageError\(ctx,\s*\"[^\"]*\",\s*[A-Z_]+\)" extensions/pi-claude-marketplace/edge/ \| wc -l` returns `0` |
| Implicit (D-20-03) | `bootstrap.ts:65` + `import.ts:49` catch-all wrappers gone | grep gate | `grep -cE "notifyError\(ctx" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns `0` for both |
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

- [ ] All tasks have `<automated>` verify (set when planner fills Per-Task Verification Map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Wave 0 is empty -- none required)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (`npm run check`)
- [ ] `nyquist_compliant: true` set in frontmatter (set after planner fills the Per-Task Verification Map and the plan-checker validates coverage)

**Approval:** pending (awaiting planner Per-Task Verification Map)

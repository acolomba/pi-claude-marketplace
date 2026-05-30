---
phase: 19
slug: migration-wave-2-plugin-orchestrator-family
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-27
---

# Phase 19 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) + tsx loader |
| **Config file** | `package.json` (`test` script) |
| **Quick run command** | `node --import tsx --test tests/orchestrators/plugin/<file>.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~30s per plugin test file; ~90s full `npm run check` (typecheck + ESLint + Prettier + tests) |

---

## Sampling Rate

- **After every task commit:** Run the per-file plugin test (`node --import tsx --test tests/orchestrators/plugin/<migrated-file>.test.ts`) AND the catalog UAT (`node --import tsx --test tests/architecture/catalog-uat.test.ts`).
- **After every plan wave:** Run `npm run check` to confirm full GREEN (typecheck + ESLint + Prettier + tests).
- **Before `/gsd-verify-work`:** `npm run check` must be GREEN end-to-end.
- **Max feedback latency:** ~30 seconds (per-file test); ~90 seconds (full check).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-* | 01 | 1 | SNM-22 (partial) | -- | V2 byte equality for uninstall.ts surfaces (single-shot success + cascade-failure cause-chain) | integration | `node --import tsx --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ | ⬜ pending |
| 19-01-* | 01 | 1 | SNM-22 (partial) | -- | Catalog UAT byte-equality stays GREEN for uninstall section | integration | `node --import tsx --test tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |
| 19-02-* | 02 | 2 | SNM-22 (partial) | -- | V2 byte equality for install.ts surfaces (standalone-mode success + rollback-partial failure + entity-shape errors); 5 post-success warnings DROPPED per D-19-01 | integration | `node --import tsx --test tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 19-02-* | 02 | 2 | SNM-22 (partial) | -- | `composeRollbackPartialBody` retired entirely (D-19-03); V2 renderer drives all rollback-partial output | source | `grep -c "composeRollbackPartialBody" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` returns `0` | ✅ | ⬜ pending |
| 19-03-* | 03 | 2 | SNM-22 (partial) | -- | V2 byte equality for list.ts surfaces (per-row available/unavailable/upgradable); PROBE_FAILURES summary DROPPED per D-19-01 | integration | `node --import tsx --test tests/orchestrators/plugin/list.test.ts` | ✅ | ⬜ pending |
| 19-04-* | 04 | 2 | SNM-22 (partial) | -- | V2 byte equality for reinstall.ts surfaces (cascade-summary + manual-recovery anchor + single-row cascade); 2 post-success warnings DROPPED per D-19-01; inline-cascade construction per D-19-02 | integration | `node --import tsx --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ⬜ pending |
| 19-05-* | 05 | 2 | SNM-22 (partial) | -- | V2 byte equality for update.ts surfaces (cascade-summary + version-arrow); 1 post-success warning DROPPED per D-19-01; inline-cascade construction per D-19-02 | integration | `node --import tsx --test tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 19-06-* | 06 | 3 | SNM-22 (partial) | -- | MSG-Block 1 + 1b `ignores: [...]` now contains `orchestrators/plugin/**` (additive); zero plugin-orchestrator MSG-* lint violations remain | source | `grep -A2 "msg-sr-1" eslint.config.js \| grep -c "orchestrators/plugin"` returns ≥1 | ✅ | ⬜ pending |
| 19-06-* | 06 | 3 | SNM-22 (partial) | -- | `npm run check` GREEN end-to-end (typecheck + ESLint + Prettier + tests); catalog UAT GREEN across all plugin sections | integration | `npm run check` exits 0 | ✅ | ⬜ pending |
| 19-06-* | 06 | 3 | SNM-22 (partial) | -- | Zero `notifySuccess` / `notifyWarning` / `notifyError` callers in `orchestrators/plugin/**/*.ts` | source | `grep -rEn "notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/ \| wc -l` returns `0` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* All 5 plugin orchestrator test files exist; `makeCtx()` mock-ctx pattern is in place per Phase 18 D-18-06 inheritance (verified by research). The catalog UAT runner (`tests/architecture/catalog-uat.test.ts`) already covers every plugin-family `(section, state)` fixture from Phase 17 + 17.1. No new framework, fixture, or scaffolding installation is required.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The phase exists entirely inside the migration boundary; every behavioral change is observable through (a) byte-exact assertions in `tests/orchestrators/plugin/*.test.ts`, (b) the catalog UAT byte-equality runner, and (c) `npm run check`'s ESLint + typecheck + Prettier gates. No human-eyeball verification step is needed; no out-of-band manual checks.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A -- none missing)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (per-file test) / < 90s (full check)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

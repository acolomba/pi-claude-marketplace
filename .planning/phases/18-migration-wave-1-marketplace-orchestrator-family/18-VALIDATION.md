---
phase: 18
slug: migration-wave-1-marketplace-orchestrator-family
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 18 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Phase 18 is a migration refactor across 7 plans / 4 waves
(Wave 0 = pi plumbing pre-cleanup; Wave 1 = add.ts V1→V2 pilot;
Wave 2 = autoupdate/list/remove/update V1→V2 in parallel;
Wave 3 = MSG-* lint narrowing + final UAT verification).
The existing test infrastructure covers every requirement -- no new
test framework or scaffolding is required. See 18-RESEARCH.md
§ "Validation Architecture" for the full pyramid.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in to Node ≥22; native TS strip on Node ≥22.18) |
| **Config file** | none -- `node --test` auto-discovers `tests/**/*.test.ts` |
| **Quick run command** | `node --test --import tsx tests/orchestrators/marketplace/<file>.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + node --test) |
| **Estimated runtime** | quick: ~1-2 s · full: ~30-60 s |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the file just modified.
- **After every plan wave:** Run `npm run check`.
- **Before `/gsd-verify-work`:** `npm run check` must be GREEN.
- **Max feedback latency:** ~60 s (full `npm run check`).

---

## Per-Task Verification Map

Phase 18 closes ZERO SNM-IDs directly; it contributes to SNM-22
closure in Phase 21. Verification is mapped to the 4 ROADMAP
Success Criteria (SC #1..#4) instead of REQ-IDs. Per-plan task
IDs will be filled in by the planner; the test infra below is
authoritative.

| Plan | Wave | Success Criterion | Test Type | Automated Command | File Exists |
|------|------|-------------------|-----------|-------------------|-------------|
| 18-00 | 0 | (precondition -- `pi` plumbed through all marketplace orchestrators + handlers + register.ts) | typecheck + suite | `npm run check` | ✅ |
| 18-01 | 1 | SC #1 partial (add.ts has zero V1 callers); SC #3 (catalog UAT GREEN for add) | unit + integration | `node --test --import tsx tests/orchestrators/marketplace/add.test.ts && node --test --import tsx tests/architecture/catalog-uat.test.ts` | ✅ |
| 18-02 | 2 | SC #1 partial (autoupdate.ts has zero V1 callers); SC #3 (catalog UAT GREEN for autoupdate) | unit + integration | `node --test --import tsx tests/orchestrators/marketplace/autoupdate.test.ts && node --test --import tsx tests/architecture/catalog-uat.test.ts` | ✅ |
| 18-03 | 2 | SC #1 partial (list.ts has zero V1 callers); SC #3 (catalog UAT GREEN for list) | unit + integration | `node --test --import tsx tests/orchestrators/marketplace/list.test.ts && node --test --import tsx tests/architecture/catalog-uat.test.ts` | ✅ |
| 18-04 | 2 | SC #1 partial (remove.ts has zero V1 callers); SC #3 (catalog UAT GREEN for remove) | unit + integration | `node --test --import tsx tests/orchestrators/marketplace/remove.test.ts && node --test --import tsx tests/architecture/catalog-uat.test.ts` | ✅ |
| 18-05 | 2 | SC #1 partial (update.ts has zero V1 callers -- all 6 callsites); SC #3 (catalog UAT GREEN for update) | unit + integration | `node --test --import tsx tests/orchestrators/marketplace/update.test.ts && node --test --import tsx tests/architecture/catalog-uat.test.ts` | ✅ |
| 18-06 | 3 | SC #1 final (`grep` returns zero); SC #2 (MSG-Block 1 + 1b ignores entry present); SC #3 (catalog UAT GREEN end-to-end); SC #4 (`npm run check` GREEN) | aggregate | `npm run check && grep -r "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/ \|\| echo OK` | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Validation Pyramid

1. **Unit (per-orchestrator):** 5 test files × byte-exact V2 assertions
   through real `notify()` via the existing `makeCtx()` mock -- catches
   construction bugs with a byte gate (per D-18-06).
2. **Integration (catalog UAT):** `tests/architecture/catalog-uat.test.ts`
   drives 30+ fixtures through `notify()` end-to-end -- catches renderer
   bugs and grammar drift. Marketplace family fixtures live at
   `catalog-uat.test.ts:1085-1292`.
3. **Static (lint + typecheck):** `npm run check` runs ESLint MSG-Block 1
   + 1b against non-migrated orchestrators (plugin/ + edge/handlers/
   only after Phase 18's ignores narrow); TypeScript `strictTypeChecked`
   catches type drift in payload construction.
4. **Phase gate:** `npm run check` GREEN at end of each wave; a final
   pass after Wave 3 confirms the lint narrowing is consistent with
   the migration.

---

## Wave 0 Requirements

- [x] All 5 orchestrator test files exist (add / autoupdate / list / remove / update).
- [x] `makeCtx()` test pattern with `pi: { getAllTools: () => [] }` already inlined
      in every test file (per D-18-06; no helper extraction).
- [x] `tests/architecture/catalog-uat.test.ts` already drives the marketplace
      family fixtures through real `notify()` (lines 1085-1292).
- [x] `node:test` runtime present (Node ≥22 native; tsx loader pinned).

*All Wave 0 infrastructure already exists. No new test files. No
framework install. Phase 18 is a pure refactor-with-test-flip phase.*

**Note:** Wave 0 in this VALIDATION.md refers to the **Nyquist test-
infrastructure prerequisite** (zero gaps -- see above). It is
**not** the same as Plan 18-00 / Wave 0 in the migration plan
structure (which threads `pi: ExtensionAPI` through orchestrators).
The two concepts share the "Wave 0" label coincidentally.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | -- | -- | -- |

*All phase behaviors have automated verification. The byte-equality
gate at the catalog UAT plus per-file byte assertions cover every
state-change notification produced by the 5 marketplace orchestrators.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies -- *to be confirmed by planner per-plan*
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify -- *to be confirmed by planner*
- [x] Wave 0 covers all MISSING references -- existing infrastructure has zero gaps
- [x] No watch-mode flags
- [x] Feedback latency < 60 s (full `npm run check`)
- [ ] `nyquist_compliant: true` set in frontmatter -- *flip to true after planner-side per-plan task mapping*

**Approval:** pending (draft -- planner to confirm per-plan task → command mapping in PLAN.md `<automated>` blocks)

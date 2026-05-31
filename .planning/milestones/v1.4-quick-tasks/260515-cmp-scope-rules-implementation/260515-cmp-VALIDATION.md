---
phase: 260515-cmp
slug: scope-rules-implementation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-15
---

# 260515-cmp -- Validation Strategy

> Nyquist validation for CMP-1..8 marketplace/plugin scope rules implementation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node ≥22) |
| **Config file** | `package.json` (`"test"` script) |
| **Quick run command** | `npm test -- --test-name-pattern "CMP-"` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~7 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~7 seconds

---

## Per-Task Verification Map

| Task | Requirement | Test Type | Test File | Test Name | Status |
|------|-------------|-----------|-----------|-----------|--------|
| Task 1 | CMP-1: same marketplace name allowed in both scopes | integration | `tests/orchestrators/marketplace/add.test.ts` | `CMP-1: same marketplace name in user scope and project scope are independent` | ✅ green |
| Task 1 | CMP-2: target scope distinct from source scope | integration | `tests/orchestrators/plugin/install.test.ts` | `CMP-3 / PI-16: project-target install falls back to user-scope marketplace source` (asserts install written to project, not user) | ✅ green |
| Task 1 | CMP-3: project-target falls back to user-scope marketplace | integration | `tests/orchestrators/plugin/install.test.ts` | `CMP-3 / PI-16: project-target install falls back to user-scope marketplace source` | ✅ green |
| Task 1 | CMP-4: user-target cannot source project-only marketplace | integration | `tests/orchestrators/plugin/install.test.ts` | `CMP-4 / PI-16: user-target install cannot source a project-only marketplace` | ✅ green |
| Task 1 | CMP-5: dual-scope installs; project precedence unqualified | integration | `tests/orchestrators/plugin/shared.test.ts` | `CMP-5 :: *` (8 sub-cases) | ✅ green |
| Task 1 | PI-17: same plugin installable in both scopes | integration | `tests/orchestrators/plugin/install.test.ts` | `PI-17: same plugin may be installed in both user and project target scopes` | ✅ green |
| Task 2 | CMP-6: completion applies same visibility rules as execution | integration | `tests/edge/completions/provider.test.ts` | `CMP-8 :: install --scope project completes from user marketplace fallback` | ✅ green |
| Task 2 | CMP-7: install completion available-only for target scope | integration | `tests/edge/completions/data.test.ts`, `tests/edge/completions/provider.test.ts` | `CMP-7 :: install completion excludes plugins already installed in the target scope`, `TC-6 / CMP-7 :: install <here> excludes unavailable plugins` | ✅ green |
| Task 2 | CMP-8: project completion uses project-mp; falls back to user | integration | `tests/edge/completions/data.test.ts`, `tests/edge/completions/provider.test.ts` | `CMP-8 :: *` (4 sub-cases across both files) | ✅ green |
| Task 3 | Regression: `npm run check` green | suite | all test files | full suite (863 tests) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files or framework installation required.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Audit 2026-05-15

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Gaps resolved:**
- CMP-1 (explicit cross-scope add test): added `CMP-1: same marketplace name in user scope and project scope are independent` to `tests/orchestrators/marketplace/add.test.ts`
- CMP-2 (explicit label): confirmed covered by existing `CMP-3 / PI-16` test assertions (lines 1090-1094 assert install written to project scope only, not user scope -- the exact CMP-2 contract)

---

## Validation Sign-Off

- [x] All tasks have automated verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 dependencies outstanding
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-15

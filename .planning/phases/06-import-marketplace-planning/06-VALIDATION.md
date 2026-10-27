---
phase: "06"
slug: "import-marketplace-planning"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
audited: "2026-10-27"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test <owner test path>` and `npx cucumber-js --name '<scenario title>'` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~90 seconds for `npm run check` |

## Sampling Rate

- **After every task commit:** the owner `node --test` file(s), `npm run test:coverage:direct -- <source>` for each touched pair, and `npx cucumber-js --name ...` for each added scenario.
- **After every plan wave:** `npm run check` on the combined tree.
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** 120 seconds.

## Per-Task Verification Map

The plans fill this map; the requirement-to-command mapping is in `06-RESEARCH.md` under `## Validation Architecture`.

| Requirement | Behavior | Test type | Automated command | Status |
|-------------|----------|-----------|------------------|--------|
| MIM-02 | An extra known marketplace no enabled plugin names is added and declared | cucumber + unit | `npx cucumber-js features/plugin/import.feature:630`; `node --test test/orchestrators/import/marketplaces.test.ts test/orchestrators/import/execute.test.ts` | green |
| MIM-01 | A settings marketplace whose source the scope records under another name reuses the record; config keeps its names; declared-name and two-claim conflicts | cucumber + unit | `npx cucumber-js features/plugin/import.feature:670 features/plugin/import.feature:713 features/plugin/import.feature:752 features/plugin/import.feature:781`; `node --test test/orchestrators/reconcile/plan.test.ts test/orchestrators/import/execute.test.ts` | green |
| MIM-03 (reference) | Install shows per-phase rollback detail | cucumber | `npx cucumber-js features/plugin/install-rollback.feature:60` | green |
| MIM-03 (import) | Import rollback partials for own install, enable, dependency, shared dependency | cucumber + unit | `npx cucumber-js features/plugin/import.feature:810 features/plugin/import.feature:846 features/plugin/import.feature:883 features/plugin/import.feature:918`; `node --test test/orchestrators/import/execute.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/enable-disable.test.ts` | green |
| MIM-03 (apply) | Apply rollback partials for own install, dependency, shared dependency | cucumber + unit | `npx cucumber-js features/plugin/apply.feature:167 features/plugin/apply.feature:187 features/plugin/apply.feature:213`; `node --test test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/notify.test.ts` | green |
| MIM-04 | Import enable outcome carries each companion fact once (not user-visible) | unit | `node --test test/orchestrators/import/execute.test.ts` (IMP-05, IMP-10 cases) | green |

## Wave 0 Requirements

- [x] `features/lib/published-marketplace.ts` and `features/step_definitions/plugin/publishing.steps.ts`: the read-only skill directory fixture and its release.
- [x] `features/lib/run-tokens.ts` and `features/lib/field-rows.ts`: path-free error tokens and token projection in JSON cells.

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-27 (Nyquist audit: 0 gaps; all 13 phase scenarios and the owner unit tests pass at HEAD)

## Validation Audit 2026-10-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

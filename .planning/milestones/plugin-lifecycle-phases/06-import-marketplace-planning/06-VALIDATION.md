---
phase: "06"
slug: "import-marketplace-planning"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
audited: "2026-10-29"
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
| MIM-02 | An extra known marketplace no enabled plugin names is added and declared | cucumber + unit | `npx cucumber-js --name 'Importing adds an extra known marketplace|Importing an extra known marketplace'`; `node --test test/orchestrators/import/marketplaces.test.ts test/orchestrators/import/execute.test.ts` | green |
| MIM-01 | A settings marketplace whose source the scope records under another name reuses the record; config keeps its names; declared-name and two-claim conflicts | cucumber + unit | `npx cucumber-js --name 'Importing settings that name a known marketplace|Importing two settings marketplaces'`; `node --test test/orchestrators/reconcile/plan.test.ts test/orchestrators/import/execute.test.ts` | green |
| MIM-03 (reference) | Install shows per-phase rollback detail | cucumber | `npx cucumber-js --name 'An install whose skills rollback cannot finish names the skills phase'` | green |
| MIM-03 (import) | Import rollback partials for own install, enable, dependency, shared dependency | cucumber + unit | `npx cucumber-js --name 'Importing a plugin whose install rollback|Importing a disabled plugin whose enable rollback|Importing a plugin whose dependency rollback|Importing two plugins whose shared dependency rollback'`; `node --test test/orchestrators/import/execute.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/enable-disable.test.ts` | green |
| MIM-03 (apply) | Apply rollback partials for own install, enable, dependency, shared dependency | cucumber + unit | `npx cucumber-js --name 'Apply reports the rollback phases|Apply that cannot finish the rollback|Apply shows the phase detail'`; `node --test test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/notify.test.ts` | green |
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

**Approval:** approved 2026-10-29 (final-head Nyquist audit: 0 gaps; 8 owner modules and 15 focused public scenarios pass at `1fe61aeb`)

## Final Merged-Tree Evidence

| Check | Result |
|-------|--------|
| Focused owner modules | `node --test test/orchestrators/import/marketplaces.test.ts test/orchestrators/import/execute.test.ts test/orchestrators/reconcile/plan.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/notify.test.ts test/orchestrators/plugin/enable-disable.test.ts test/shared/redact-absolute-paths.test.ts` — 8/8 modules passed |
| Focused public behavior | The combined title-filtered Cucumber command represented in the map above — 15/15 scenarios and 177/177 steps passed |
| Combined-tree gate | `npm run check` — 1,142/1,142 scenarios, 11,734/11,734 steps, and 309 merged direct-coverage records passed on the unchanged implementation/test tree |
| Runtime and tree | Node v26.12.1; source/test HEAD `21a40cdf`; only planning records changed after the combined-tree gate |

## Validation Audit 2026-10-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Validation Audit 2026-10-29

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Final-Head Evidence

| Check | Result |
|---|---|
| Focused owner modules | `node --test test/orchestrators/import/marketplaces.test.ts test/orchestrators/import/execute.test.ts test/orchestrators/reconcile/plan.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/notify.test.ts test/orchestrators/plugin/enable-disable.test.ts test/shared/redact-absolute-paths.test.ts` — 8/8 modules passed |
| Focused public behavior | The combined title filter in the verification map passed 15/15 scenarios, 177/177 steps, and 16/16 hooks. The first sandboxed attempt reached 0 scenarios because loopback binding returned `EPERM`; the permitted rerun used the same command and passed. |
| Combined-tree gate | Reused exact `npm run check` evidence at executable head `be0de0c3`: 1,145/1,145 scenarios, 11,777/11,777 steps, and 309 merged direct-coverage records passed. |
| Runtime and tree | Node v26.12.1; final-head audit at `1fe61aeb`; `git diff --quiet be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` exited 0 and no untracked executable input exists. |

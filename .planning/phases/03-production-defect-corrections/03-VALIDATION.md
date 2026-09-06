---
phase: "03"
slug: "production-defect-corrections"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-06"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| **Framework**          | Node built-in `node:test` with `node:assert/strict`                   |
| **Config file**        | none — repository scripts invoke `node --test` through `package.json` |
| **Quick run command**  | `node --test <owning-test-path>`                                      |
| **Direct coverage**    | `npm run test:coverage:direct -- <source-path>`                       |
| **Full suite command** | `npm run check`                                                       |
| **Measured baseline**  | 15 relevant owner suites passed on 2026-09-06                         |

Filesystem regressions use case-owned temporary roots. External-boundary
failures use injected collaborators. No Phase 3 validation reads or writes the
developer's real home or Pi directories, mutates process-global prototypes, or
uses network access.

---

## Sampling Rate

- **After every task commit:** Run each changed production file's owning test
  suite, then its direct-pair coverage command.
- **After every plan wave:** Run all owner suites changed in the wave, then
  `npm run check`.
- **Before `$gsd-verify-work`:** Run the full Phase 3 owner matrix, direct
  coverage for every changed production owner, and `npm run check`.
- **Max feedback latency:** 30 seconds for an individual focused owner suite.

---

## Per-Task Verification Map

The planner replaces the provisional plan/task columns with final identifiers
after it decomposes the eight correction clusters.

| Task ID | Plan | Wave | Requirement       | Threat Ref | Secure Behavior                                                                                                                                      | Test Type           | Automated Command                                                                                                                                                                                            | File Exists | Status     |
| ------- | ---- | ---- | ----------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 03-01-01 | 03-01 | 1 | PDEF-08 | T-03-01 | A distinct declared alias resolves one-to-one to the canonical manifest-derived marketplace name and converges on a second apply | unit + filesystem | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/integration/reconcile-plan-convergence.test.ts` | ✅ | ⬜ pending |
| 03-02-02 | 03-02 | 1 | PDEF-01 | T-03-05 | Install preview and live staging consume every resolved agent directory in order and preserve cross-directory first-wins warnings | unit + filesystem | `node --test tests/orchestrators/plugin/discover-names.test.ts tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 03-03-01 | 03-03 | 2 | PDEF-01 | T-03-09 | Update and reinstall consume the same ordered agent-directory list and the singular representation is removed | unit + filesystem | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/shared.test.ts` | ✅ | ⬜ pending |
| 03-04-01 | 03-04 | 1 | PDEF-06 | T-03-13 | `manual` maps to `manual`; threshold and overflow reasons map to `auto` in both payload owners | unit | `node --test tests/bridges/hooks/payloads/pre-tool-use.test.ts tests/bridges/hooks/payloads/post-tool-use.test.ts tests/domain/components/hook-events.test.ts` | ✅ | ⬜ pending |
| 03-05-01 | 03-05 | 2 | PDEF-07 | T-03-17 | Prototype keys are rejected and only trace-proven no-producer dispatch branches are removed while true guards remain | unit + structural | `node --test tests/domain/components/hook-tool-names.test.ts tests/domain/components/hooks/matcher.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | ✅ | ⬜ pending |
| 03-06-01 | 03-06 | 2 | PDEF-08 | T-03-21 | Install uses `formatRollbackError`, preserves containment/zero-partial originals, and wraps partials exactly once | unit + orchestrator | `node --test tests/transaction/rollback.test.ts tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 03-07-01 | 03-07 | 3 | PDEF-05 | T-03-25 | Lock, update, and sibling reasons remain stable when diagnostic messages change | unit | `node --test tests/shared/errors.test.ts tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/marketplace/shared.test.ts` | ✅ | ⬜ pending |
| 03-07-03 | 03-07 | 3 | PDEF-05 | T-03-26 | Update retains the primary error, appends exact cleanup context, and exposes the expected residual artifact | unit + filesystem | `node --test tests/shared/errors.test.ts tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 03-08-01 | 03-08 | 1 | PDEF-01 | T-03-30 | Named autoupdate is single while bare autoupdate and list are plural for zero, one, and many rows | unit + output | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts` | ✅ | ⬜ pending |
| 03-09-01 | 03-09 | 4 | PDEF-01 | Lifecycle producers declare target-derived cardinality on every outcome arm | unit | `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/uninstall.test.ts` | ✅ | ⬜ pending |
| 03-10-03 | 03-10 | 3 | PDEF-01 / PDEF-08 | T-03-36 | Remaining producers declare structural cardinality without mutating reconcile alias state | unit + integration | `node --test tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/pending.test.ts tests/integration/reconcile-plan-convergence.test.ts` | ✅ | ⬜ pending |
| 03-11-02 | 03-11 | 5 | PDEF-01 / PDEF-05 / PDEF-06 / PDEF-07 / PDEF-08 | T-03-38 | Cardinality is required, exact catalog output matches, and all Phase 3 owner regressions pass under the repository check | unit + catalog + gate | `npm run check` | ✅ | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing test infrastructure and all identified direct owner files already
exist. Planned tasks add missing regressions in place; no test framework,
configuration, fixture module, or stub is required before Wave 1.

---

## Manual-Only Verifications

All Phase 3 behaviors have an automated owner or architecture-test route. No
manual-only verification is required.

---

## Validation Sign-Off

- [ ] Final plan and task identifiers replace every provisional `TBD` row
- [ ] All tasks have `<automated>` verification or explicit Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification
- [x] Wave 0 has no missing framework, fixture, or owner-test dependency
- [x] No watch-mode flags
- [ ] Feedback latency remains below 30 seconds for focused checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution and final Phase 3 validation.

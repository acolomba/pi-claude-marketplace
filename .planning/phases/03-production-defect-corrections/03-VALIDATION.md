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
| pending | TBD  | TBD  | PDEF-01 / PDEF-08 | T-03-01    | A distinct declared alias resolves one-to-one to the canonical manifest-derived marketplace name and converges on a second apply                     | unit + filesystem   | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts`                                                                                                         | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-08           | —          | Every resolved agent directory is consumed in order and later duplicate generated names retain first-wins warning behavior                           | unit + filesystem   | `node --test tests/bridges/agents/discover.test.ts tests/bridges/agents/stage.test.ts tests/orchestrators/plugin/shared.test.ts`                                                                             | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-08           | —          | `manual` maps to `manual`; `threshold` and `overflow` map to `auto` in both compact translators and their closed matcher sets                        | unit + architecture | `node --test tests/bridges/hooks/payloads/pre-compact.test.ts tests/bridges/hooks/payloads/post-compact.test.ts tests/domain/components/hook-events.test.ts tests/architecture/hooks-supportability.test.ts` | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-08           | —          | Install uses one rollback-formatting rule, preserves containment errors, and retains the original error as `cause` when partial rollback occurs      | unit + orchestrator | `node --test tests/transaction/rollback.test.ts tests/orchestrators/plugin/install.test.ts`                                                                                                                  | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-05           | —          | Lock, sibling, and malformed-input classifications remain stable when diagnostic message text changes                                                | unit                | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/update.test.ts`                                                                                                         | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-06           | T-03-02    | Update failure retains primary error identity/cause, attaches exact cleanup context, and leaves no unexpected staging, backup, or temporary artifact | unit + filesystem   | `node --test tests/orchestrators/plugin/update.test.ts`                                                                                                                                                      | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-07           | T-03-03    | Prototype keys are rejected by open-string tables and removal of test-shaped branches preserves all real trust-boundary guards                       | unit + structural   | `node --test tests/domain/components/hook-tool-names.test.ts tests/domain/components/hooks/matcher.test.ts`                                                                                                  | ✅          | ⬜ pending |
| pending | TBD  | TBD  | PDEF-01           | —          | Structural cardinality produces the selected plural tallies and every corrected terminal defect has a direct discriminating owner regression         | unit + catalog      | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/architecture/catalog-uat.test.ts`                                                         | ✅          | ⬜ pending |

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

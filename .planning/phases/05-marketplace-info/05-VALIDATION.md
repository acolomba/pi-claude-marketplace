---
phase: "5"
slug: "marketplace-info"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-18"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Cucumber 13.3.0 and the Node test runner |
| **Config file** | `cucumber.json` |
| **Quick run command** | `npm run test:cucumber -- features/marketplace/info.feature` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Focused Cucumber: under 30 seconds; full gate: measure during execution |

---

## Sampling Rate

- **After every task commit:** Run the task's focused owner command; feature tasks also run `npm run check:features`.
- **After every plan wave:** Run `npm run check` on the combined tree.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds for focused behavioral feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | INFO-01–INFO-03, INFO-09 | T-05-01 | Source identity stays read-only and local rows disclose only the user-visible source path. | Cucumber + static | `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | INFO-04–INFO-06 | T-05-02 | Explicit scope never falls through; unscoped results preserve project-first scope identity. | Cucumber + static | `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | INFO-04, INFO-08 | T-05-03 | A corrupt scope neither suppresses nor reorders a healthy scope; both results retain their scope. | unit + Cucumber | `node --test tests/orchestrators/marketplace/info.test.ts`; `npm run test:cucumber -- features/marketplace/info.feature` | ✅ | ⬜ pending |
| 05-03-02 | 03 | 2 | INFO-04, INFO-08 | T-05-03 | The production ordering correction retains direct source/test coverage. | direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` | ✅ | ⬜ pending |
| wave-1-gate | 01, 02 | 1 | INFO-01–INFO-06, INFO-09 | T-05-01, T-05-02, T-05-SC | Combined source and scope coverage preserves the existing suite. | full gate | `npm run check` | ✅ | ⬜ pending |
| wave-2-and-phase-gate | 01–03 | 2 | INFO-01–INFO-06, INFO-08, INFO-09 | T-05-01–T-05-03, T-05-SC | Combined tree preserves complete info behavior and all inherited regressions. | full gate | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Every PLAN must put a `fails_when` clause immediately after each automated command. Non-zero exit fails every command; test commands also fail on zero tests or scenarios. Active Cucumber steps must not be pending, skipped, undefined, or ambiguous. Excluded URL/GitHub Examples remain subject to `npm run check:features`. A pre-scenario Pi exit is an environment failure and requires rerunning the same command in an authorized execution environment, not weakening assertions. Record counts, Node version, exit status, and tree identity. A full-gate result may be reused only when its build inputs are unchanged, as the local-verification skill defines.

---

## Wave 0 Requirements

Existing runner, driver, complete-result comparison, and source-kind publication infrastructure cover the phase. Execution must add only the used description setup, source-aware complete assertion, and independent same-name fixture setup; these are implementation tasks rather than framework bootstrap.

---

## Manual-Only Verifications

All phase behaviors have automated verification. URL and GitHub runtime rows remain deliberately excluded until Phases 9 and 10, but their bindings and layout are checked now by `npm run check:features`.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification.
- [ ] Wave 0 covers all MISSING references.
- [x] No watch-mode flags.
- [x] Focused feedback latency is under 30 seconds.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution and `$gsd-validate-phase 5`.

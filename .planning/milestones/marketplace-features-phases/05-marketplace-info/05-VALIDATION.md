---
phase: "5"
slug: "marketplace-info"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| **Estimated runtime** | Focused Cucumber: under 30 seconds; full gate: about 2 minutes |

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
| 05-01-01 | 01 | 1 | INFO-04, INFO-08 | T-05-01–T-05-04 | Invalid project precedes healthy user; exact invocation order and unchanged disk state are asserted. | unit + Cucumber + static | `node --test tests/orchestrators/marketplace/info.test.ts`; `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ✅ green |
| 05-01-02 | 01 | 1 | INFO-04, INFO-08 | T-05-01–T-05-04 | Opposite mixed case and all emission branches preserve independent scopes and failure shape. | direct coverage + Cucumber + static | `node --test tests/orchestrators/marketplace/info.test.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`; `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ✅ green |
| 05-02-01 | 02 | 2 | INFO-01–INFO-03 | T-05-07–T-05-09, T-05-12 | Full source identity is compared; fixtures remain contained and remote rows excluded. | Cucumber + static | `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ✅ green |
| 05-02-02 | 02 | 2 | INFO-09 | T-05-07 | Complete allowance projection preserves declaration order. | Cucumber + static | `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ✅ green |
| 05-03-01 | 03 | 3 | INFO-04, INFO-05 | T-05-13 | Distinct healthy scope settings retain project-first identity; an unscoped miss has no scope. | Cucumber + static | `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features` | ✅ | ✅ green |
| 05-03-02 | 03 | 3 | INFO-06 | T-05-14–T-05-16 | Explicit scope never falls back and keeps its qualified missing-scope reason. | Cucumber + static + unit | `npm run test:cucumber -- features/marketplace/info.feature`; `npm run check:features`; `node --test tests/orchestrators/marketplace/info.test.ts` | ✅ | ✅ green |
| wave-1-gate | 01 | 1 | INFO-04, INFO-08 | T-05-01–T-05-06, T-05-SC | Combined mixed-scope correction preserves the existing suite. | full gate | `npm run check` | ✅ | ✅ green |
| wave-2-gate | 01–02 | 2 | INFO-01–INFO-04, INFO-08, INFO-09 | T-05-01–T-05-12, T-05-SC | Combined source and failure coverage preserves all inherited regressions. | full gate | `npm run check` | ✅ | ✅ green |
| wave-3-and-phase-gate | 01–03 | 3 | INFO-01–INFO-06, INFO-08, INFO-09 | T-05-01–T-05-18, T-05-SC | Complete combined-tree info coverage retains scope isolation and inherited behavior. | full gate | `npm run check` | ✅ | ✅ green |

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

- [x] All tasks have `<automated>` verification or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all MISSING references.
- [x] No watch-mode flags.
- [x] Focused feedback latency is under 30 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-10-18 after the full gate passed at `8bc4503d` with 146 scenarios, 1,537 steps and 280 direct-coverage records.

## Validation Audit 2026-10-18

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

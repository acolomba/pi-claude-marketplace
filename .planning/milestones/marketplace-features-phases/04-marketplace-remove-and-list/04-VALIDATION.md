---
phase: "4"
slug: "marketplace-remove-and-list"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-18"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Cucumber 13.3.0 and the Node test runner |
| **Config file** | `cucumber.json` |
| **Quick run command** | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Focused Cucumber: under 30 seconds; full gate: measure during execution |

---

## Sampling Rate

- **After each task, before committing:** Run its exact automated command. Feature tasks run the focused Cucumber command and `npm run check:features`; integration tasks run the existing integration file; the decision-only task runs its row assertion.
- **After every plan wave:** Run `npm run check` on the combined tree.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds for focused behavioral feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | RM-08; D-01–D-03 | T-04-01 | D-MF-05 records the approved selected-scope boundary before pinning it. | document assertion | Exact `node --input-type=module -e` row assertion in 04-01 task 1 | ✅ | ✅ green |
| 04-01-02 | 01 | 1 | RM-01, RM-07 | T-04-01, T-04-02 | Empty removal preserves the unrelated declaration; remote Examples stay excluded. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-01-03 | 01 | 1 | RM-05–RM-08; D-01–D-03 | T-04-01 | Scope precedence and complete misses never alter the other scope. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-02-01 | 02 | 2 | RM-02, RM-07; D-08 | T-04-03 | Full cascade removes only its target plugins and preserves the control. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-02-02 | 02 | 2 | RM-03, RM-04; D-04 | T-04-05 | Clean removal survives a new session; partial failure is not claimed to do so. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-02-03 | 02 | 2 | RM-02; D-05, D-08 | T-04-04 | All preflight blockers are reported before any mutation or reload. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-03-01 | 03 | 1 | LS-01, LS-02; D-07 | T-04-06, T-04-07 | Complete read-only inventory keeps scope identities, insertion order, and effective details. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-03-02 | 03 | 1 | LS-03, LS-04; D-07 | T-04-06, T-04-07 | Scope filters and ls retain complete ordered rows without leaking the other scope. | Cucumber + static | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature`; `npm run check:features` | ✅ | ✅ green |
| 04-04-01 | 04 | 1 | RM-02; D-04, D-06, D-08 | T-04-08, T-04-09, T-04-10 | Mixed partial removal persists successes, retains failures and desired configs, and emits grouped schema-valid JSON. | integration | `node --test tests/integration/marketplace-layer-remove.test.ts` | ✅ | ✅ green |
| 04-04-02 | 04 | 1 | RM-02; D-04, D-06, D-08 | T-04-08, T-04-09, T-04-10 | Failure-only removal leaves the entire footprint unchanged and needs no reload. | integration | `node --test tests/integration/marketplace-layer-remove.test.ts` | ✅ | ✅ green |
| wave-1-gate | 01, 03, 04 | 1 | all wave-1 requirements | T-04-01, T-04-02, T-04-06–T-04-10, T-04-SC | Combined tree respects all wave-1 boundaries and existing regressions. | full gate | `npm run check` | ✅ | ✅ green |
| wave-2-and-phase-gate | 01–04 | 2 | RM-01–RM-08, LS-01–LS-04 | T-04-01–T-04-10, T-04-SC | Combined tree preserves the full removal/list contract and the inherited suite. | full gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Each PLAN places a fails_when clause immediately after every automated command. Non-zero exit fails every command; test commands also fail on a zero-test or zero-scenario summary. Cucumber active steps must not be pending, skipped, undefined, or ambiguous. Excluded URL/GitHub Examples remain subject to check:features. A pre-scenario Pi exit is an environment failure and requires the same command in an authorized execution environment, not weakened assertions. Record counts, Node version, exit status, and tree identity. The wave-2 result may also satisfy the phase gate only when its build inputs are unchanged, under the local-verification skill.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The framework, source-kind parameter, full-result projection, timestamp token, and session assertions already exist. Partial-result integration coverage uses createMachineNotificationBoundary from tests/edge/notification-boundary.ts and its existing schema-validating capture. No new capture helper, production failpoint, package, or Wave 0 scaffold is needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all MISSING references.
- [x] No watch-mode flags.
- [x] Focused feedback latency is under 30 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated on 2026-10-18; all automated checks are green.

## Validation Audit 2026-10-18

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

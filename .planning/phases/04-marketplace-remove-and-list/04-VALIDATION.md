---
phase: "4"
slug: "marketplace-remove-and-list"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
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

- **After every task commit:** Run the focused Cucumber command, `npm run check:features`, and any directly touched Node test.
- **After every plan wave:** Run `npm run check` on the combined tree.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds for focused behavioral feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RM-01–RM-08 | T-04-01 | Removal affects only the selected scope and layer; refusals do not mutate state. | Cucumber | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature` | ✅ | ⬜ pending |
| TBD | TBD | TBD | LS-01–LS-04 | Listing is complete, ordered, scoped, and read-only. | Cucumber | `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature` | ✅ | ⬜ pending |
| TBD | TBD | TBD | D-04–D-06, D-08 | Partial cascades retain failures, persist successes, preserve exact output ordering, and request reload only after mutation. | integration | `node --test tests/integration/marketplace-layer-remove.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | all | T-04-02 | Fixtures remain contained and remote source rows remain excluded until local stand-ins exist. | static + full | `npm run check:features && npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The planner replaces the `TBD` identifiers with final plan task IDs and the exact integration command if it creates a dedicated test file.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The framework, source-kind parameter, full-result projection, timestamp token, and session assertions already exist. If a dedicated integration test needs notification capture, keep that helper local to the test file and do not add a production failpoint.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all MISSING references.
- [x] No watch-mode flags.
- [x] Focused feedback latency is under 30 seconds.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending

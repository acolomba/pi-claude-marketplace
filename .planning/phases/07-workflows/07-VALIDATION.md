---
phase: "7"
slug: "workflows"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-01"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | @cucumber/cucumber (behavioral) + node:test (unit, integration) |
| **Config file** | cucumber.json (frozen) |
| **Quick run command** | `npx cucumber-js features/workflow/<file>.feature` |
| **Full suite command** | `npm run check` + `npm run test:modules` + `npm run test:cucumber` (nondac-sh wrapper) |
| **Estimated runtime** | ~7 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js features/workflow/<file>.feature` then `npm run check:features`
- **After every plan wave:** Run `npx cucumber-js features/workflow` (3 seeds), then `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 7 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1..T3 | 01 | 1 | WFL-01, WFL-05 (WLIF-06 seed) | T-07-01 | listing compared whole; stale command refused with the engine's notice | e2e | `npx cucumber-js features/workflow/listing.feature` (4) and `lifecycle.feature` | ✅ | ✅ green |
| 07-02-T1..T3 | 02 | 2 | WFL-03 | T-07-04..06 | refused, skipped, and noted scripts reported; engine refuses noted scripts at run | e2e | `npx cucumber-js features/workflow/refusals.feature` (8 runs) | ✅ | ✅ green |
| 07-03-T1..T2 | 03 | 2 | WFL-02 | T-07-07 | no approval dialog during a run (D-CF7-01, recorded gap) | e2e | `npx cucumber-js features/workflow/run.feature` (5 runs) | ✅ | ✅ green |
| 07-04-T1..T2 | 04 | 2 | WFL-04 | T-07-09 | settings edit restored at release; shared Pi never loads the engine | e2e | `npx cucumber-js features/workflow/companion-missing.feature` (4) | ✅ | ✅ green |
| 07-05-T1..T3 | 05 | 2 | WFL-05 | T-07-10..12 | uninstalled/disabled command refused until reload | e2e | `npx cucumber-js features/workflow/lifecycle.feature` (11) | ✅ | ✅ green |
| 07-06-T1..T3 | 06 | 3 | all (docs, gate) | — | N/A | gate | `npm run check`, `npm run test:modules`, `npm run test:cucumber`, `npx cucumber-js features/workflow` x3 | ✅ | ✅ green |

Post-merge (wave 2, merged tree): `npx cucumber-js features/workflow` 32/32 with seeds 872497, 535493, 154315; `npm run check` exit 0.
Phase gate (07-06): `npm run check` 0 (1250 scenarios, seed 486945), `npm run test:modules` 0, `npm run test:cucumber` 0 (seed 38213), workflow x3 seeds 245657, 674263, 117957.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|


All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 7s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-01 (autonomous run; no gaps found)

## Validation Audit 2026-11-01

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

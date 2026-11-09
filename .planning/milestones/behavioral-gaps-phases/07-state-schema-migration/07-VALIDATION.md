---
phase: "7"
slug: "state-schema-migration"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-08"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (adapter profile), plus the static gates of `npm run check:static` |
| **Config file** | `cucumber.json` (frozen) |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 2 features/plugin/state-migration.feature` |
| **Full suite command** | `npm run check`, run as its parts in the background (see 07-RESEARCH.md "Validation Architecture") |
| **Estimated runtime** | ~10 seconds (quick); ~8 minutes (full, under shared load) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command and `npm run check:features`
- **After every plan wave:** Run `npm run check` as its parts (`check:static`, `test:unpaired`, `test:integration`, both cucumber profiles, `test:coverage:direct:all`)
- **Before `/gsd-verify-work`:** Full suite must be green, plus `npm run test:modules` at the phase gate
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | STMIG-01 | — | N/A | behavioral | quick run command | ❌ W0 (step module new) | ✅ green |
| 7-01-02 | 01 | 1 | STMIG-01 | — | N/A | behavioral | quick run command | ✅ (after 7-01-01) | ✅ green |
| 7-01-03 | 01 | 1 | STMIG-02 | T-07-01 | a newer record is never rewritten | behavioral | quick run command | ✅ (seed) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The only new file is the verb step module `features/step_definitions/plugin/state-migration.steps.ts`, which needs no unit pair.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-08 (inline audit; every task had an automated verify and red proofs)

---
phase: "05"
slug: "postcompact-hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-08"
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 26) + `@cucumber/cucumber` 13.3.0 |
| **Config file** | `package.json` scripts; `cucumber.json` (frozen) |
| **Quick run command** | `node --import ./test/platform/isolated-pi-home.ts --test test/bridges/hooks/<file>.test.ts` and `npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature` |
| **Full suite command** | `npm run check` (run by the orchestrator in its parts; plus `npm run test:modules` at the phase gate) |
| **Estimated runtime** | ~60 s quick (feature file), ~15 min full under load |

---

## Sampling Rate

- **After every task commit:** the touched unit files, `npm run test:coverage:direct -- <touched source>`, and the feature file when a scenario changed; the commit hook runs `check:commit`.
- **After every plan wave:** `npm run check` in parts (orchestrator).
- **Before `/gsd-verify-work`:** full suite green under both cucumber profiles.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

Filled by the plans' `<verify>` blocks; see 05-RESEARCH.md "Validation Architecture" for the requirement-to-test map (PCOMP-01 criteria 1-3).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (no new step module, framework, or fixture).

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

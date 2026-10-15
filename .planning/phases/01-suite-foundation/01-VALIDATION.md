---
phase: "1"
slug: "suite-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-15"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js 13.3.0 (behavioral) + `scripts/check-features.mjs` gate + ESLint 10 |
| **Config file** | `cucumber.json` (default profile; gains `tags`) |
| **Quick run command** | `npm run check:features` (~1.3 s); `npx cucumber-js --name '<scenario title>'` |
| **Full suite command** | `npm run test:cucumber`; phase gate `npm run check` |
| **Estimated runtime** | ~6 s (cucumber), ~75 s (`npm run check`) |

---

## Sampling Rate

- **After every task commit:** the hook runs `check:commit` (includes `check:static` → `check:features`); also run `npm run test:cucumber` by hand for any `features/` change
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

Filled by the planner from PLAN.md `<verify>` blocks. Requirement → command map (from RESEARCH.md):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DRV-01 | every payload returned and schema-validated; kind and count asserted | behavioral | `npm run test:cucumber` | ❌ W0 | ⬜ pending |
| DRV-02 | `{home}` both directions; `{scenario time}` window | behavioral | `npm run test:cucumber` | ❌ W0 | ⬜ pending |
| DRV-04 | unused/undefined/ambiguous fails | static gate | `npm run check:features` | ❌ W0 | ⬜ pending |
| folded §2.3 | Gherkin/layout rules | static gate | `npm run check:features` | ❌ W0 | ⬜ pending |
| folded §2.1-2.2 | step modules export nothing / no regex; lib registers nothing | lint | `npm run lint` | ❌ W0 | ⬜ pending |
| SC4 | local rows run, `@url`/`@github` excluded | behavioral | `npm run test:cucumber` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-features.mjs` + `check:features` npm script + `check:static` entry
- [ ] `eslint.config.js` blocks for `features/step_definitions/**/*.steps.ts` and `features/lib/**/*.ts`
- [ ] `cucumber.json` `tags`
- [ ] Seed feature files under `features/marketplace/`
- [ ] Cucumber skill and local-verification skill updates

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each gate fails on a planted violation | DRV-01, DRV-02, DRV-04, folded gates | CONVENTIONS forbids committed negative controls | Plant once (wrong `kind` row, extra payload, stale timestamp, typo'd step, duplicate and orphan definitions, `And` step, regex pattern, export, `Given` import in lib), confirm the gate fails, revert, record in SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 75s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

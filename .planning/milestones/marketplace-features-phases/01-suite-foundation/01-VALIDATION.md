---
phase: "1"
slug: "suite-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-15"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js 13.3.0 (behavioral) + `scripts/check-features.mjs` gate + ESLint 10 |
| **Config file** | `cucumber.json` (default profile; `tags: "not @url and not @github"`) |
| **Quick run command** | `npm run check:features` (~1.3 s); `npx cucumber-js --name '<scenario title>'` |
| **Full suite command** | `npm run test:cucumber`; phase gate `npm run check` |
| **Estimated runtime** | ~6 s (cucumber), ~102 s (`npm run check`) |

---

## Sampling Rate

- **After every task commit:** the hook runs `check:commit` (includes `check:static` → `check:features`); `npm run test:cucumber` by hand for any `features/` change
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 102 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DRV-01, DRV-02 | — | payloads schema-validated before steps read them | behavioral | `npx cucumber-js --name 'Info on a directory marketplace shows its absolute path and autoupdate state'`; `npm run test:cucumber` | ✅ | ✅ green |
| 1-01-02 | 01 | 1 | DRV-01 | — | N/A | behavioral | `npm run test:cucumber` | ✅ | ✅ green |
| 1-01-03 | 01 | 1 | DRV-01 | — | N/A | behavioral | `npx cucumber-js --name 'Marketplace help'`; `npm run test:cucumber` | ✅ | ✅ green |
| 1-02-01 | 02 | 2 | DRV-04 | — | gate computes its own verdict | static gate | `npm run check:features`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-02-02 | 02 | 2 | DRV-04 (folded §2.3) | — | N/A | static gate | `npm run check:features` | ✅ | ✅ green |
| 1-02-03 | 02 | 2 | folded §2.1-2.2 | — | N/A | lint | `npm run lint` | ✅ | ✅ green |
| 1-03-01 | 03 | 3 | DRV-01, DRV-02 | — | N/A | behavioral | `npm run test:cucumber`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-03-02 | 03 | 3 | DRV-01, DRV-02 | — | url/github arms throw before any network access | behavioral | `npm run test:cucumber`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-03-03 | 03 | 3 | DRV-01 | — | N/A | behavioral | `npm run test:cucumber`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-04-01 | 04 | 4 | DRV-01, DRV-02 | — | N/A | behavioral | `npx cucumber-js --name 'A bare update refreshes every marketplace…'`; `npm run test:cucumber`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-04-02 | 04 | 4 | DRV-02 | — | reads only user-owned config files | behavioral | `npm run test:cucumber`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-04-03 | 04 | 4 | DRV-01 | — | N/A | behavioral | `npm run test:cucumber`; `CI=1 npm run check:features` | ✅ | ✅ green |
| 1-05-01 | 05 | 5 | DRV-04 (docs) | — | N/A | docs lint | `SKIP=npm-check pre-commit run --files .agents/skills/cucumber/…` | ✅ | ✅ green |
| 1-05-02 | 05 | 5 | DRV-01, DRV-02, DRV-04 | — | N/A | phase gate | `npm run check` (exit 0 at `64d6b78e`, Node v26.11.1) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/check-features.mjs` + `check:features` npm script + `check:static` entry
- [x] `eslint.config.js` blocks for `features/step_definitions/**/*.steps.ts` and `features/lib/**/*.ts`
- [x] `cucumber.json` `tags`
- [x] Seed feature files under `features/marketplace/`
- [x] Cucumber skill and local-verification skill updates

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each gate fails on a planted violation | DRV-01, DRV-02, DRV-04, folded gates | CONVENTIONS forbids committed negative controls | Done once per plan; each planted violation failed and was reverted, recorded in 01-01..01-04 SUMMARY.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 102s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-15

## Validation Audit 2026-10-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

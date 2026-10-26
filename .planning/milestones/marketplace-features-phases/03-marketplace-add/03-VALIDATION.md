---
phase: "3"
slug: "marketplace-add"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-16"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js 13.3.0, plus the `scripts/check-features.mjs` gate and the ESLint `features/` blocks |
| **Config file** | `cucumber.json` (default profile `tags: "not @url and not @github"`, `parallel: 8`, `order: random`) |
| **Quick run command** | `npx cucumber-js --parallel 1 --name '<scenario title>'` (~4.4 s); `npm run check:features` (~1.6 s) |
| **Full suite command** | `npm run test:cucumber` (~5-7 s); phase gate `npm run check` (~100+ s) |
| **Estimated runtime** | ~7 seconds for the suite, ~100+ seconds for the gate |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js --parallel 1 --name '<title>'` for each scenario the task adds, then `npm run test:cucumber`. The commit hook runs `check:features` but not cucumber.
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds (one scenario plus the feature gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ADD-07 | T-03-01..05 | Fixtures stay under the sandbox HOME | behavioral (Outline, 4 local + 2 `@url` rows) | `npx cucumber-js --parallel 1 --name 'Adding a marketplace with a malformed or schema-invalid manifest fails as invalid manifest'` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | ADD-06 | T-03-01..05 | Fixtures stay under the sandbox HOME | behavioral (Outline, 4 local rows) | `npx cucumber-js --parallel 1 --name 'Adding a path that holds no marketplace manifest fails as source missing, named as typed'` | ✅ | ✅ green |
| 03-02-01 | 02 | 2 | ADD-04 | T-03-06..09 | N/A | behavioral (Outline, 2 local + 2 `@url` rows) | `npx cucumber-js --parallel 1 --name 'Adding a marketplace whose name the scope already holds fails as a duplicate name'` | ✅ | ✅ green |
| 03-02-02 | 02 | 2 | ADD-05, ADD-02 | T-03-06..09 | N/A | behavioral (Outline over all kinds; one scenario) | `npx cucumber-js --parallel 1 --name 'Adding a marketplace the user scope holds to the project scope records it in both scopes'`; `npx cucumber-js --parallel 1 --name 'Adding a marketplace without a scope records it in the user scope'` | ✅ | ✅ green |
| 03-03-01 | 03 | 3 | ADD-13 | T-03-10..12 | Neither `--local` scenario reloads (D-08 stays out of scope) | behavioral (two scenarios) | `npx cucumber-js --parallel 1 --name 'Adding a marketplace with --local declares it only in the local configuration'`; `npx cucumber-js --parallel 1 --name 'Removing a marketplace with --local clears only its local declaration'` | ✅ | ✅ green |
| 03-03-02 | 03 | 3 | ADD-01, ADD-03, ADD-14 | T-03-10..12 | No change under `extensions/` | behavioral (seeds) + phase gate | `npm run test:cucumber` (41 scenarios); `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements: the runner, the driver, the run tokens, the config read step, and the feature gate all exist. The new files are the scenarios' own: `features/step_definitions/marketplace/add.steps.ts`, `features/marketplace/remove.feature`, and new fixture modes in `features/lib/path-marketplace.ts` and `features/lib/published-marketplace.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each new scenario fails under a plausible wrong expectation | ADD-02..ADD-07, ADD-13 | Negative controls are never committed (CONVENTIONS) | Change one expected cell once by hand (for example, the ADD-06 `~` row's name to `{home}/marketplaces/missing`), watch the scenario fail, then restore it |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-16

## Validation Audit 2026-10-16

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

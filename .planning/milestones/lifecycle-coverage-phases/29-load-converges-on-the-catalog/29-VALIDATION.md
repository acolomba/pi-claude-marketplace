---
phase: "29"
slug: "load-converges-on-the-catalog"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-24"
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (unit, integration); `@cucumber/cucumber` (behavioral) |
| **Config file** | `cucumber.json`; `package.json` scripts |
| **Quick run command** | `node --test <owner test>` plus `npm run test:coverage:direct -- <path>` for each touched pair |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds for `npm run check` (more with cucumber) |

---

## Sampling Rate

- **After every task commit:** the owner tests and direct coverage for each touched pair; the commit hook runs `npm run check:commit`.
- **After every plan wave:** `npm run check` (includes `test:cucumber`).
- **Before `/gsd-verify-work`:** `npm run check` green on the combined tree.
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled by the planner per task; the requirement-level map is:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| APL-01 | `apply` makes every pending change, then `pending` is empty; an empty `apply` reports so and writes nothing | cucumber + unit | `npx cucumber-js features/plugin/apply.feature`; `node --test test/orchestrators/reconcile/apply.test.ts` | ✅ | ✅ green |
| APL-01 | `apply` parses `--scope`, rejects positionals and unknown flags | unit | `node --test test/edge/handlers/plugin/apply.test.ts` | ✅ | ✅ green |
| APL-02 | catalog moves applied; range and consent blocks stay with warning rows and stay in `pending`; a partial record made whole | cucumber + unit | `npx cucumber-js features/plugin/apply.feature`; `node --test test/orchestrators/reconcile/convergence.test.ts` | ✅ | ✅ green |
| APL-02 | a cold git target is cloned by `apply` (request log) | cucumber | `npx cucumber-js features/plugin/git-source-update.feature` | ✅ | ✅ green |
| APL-03 | a hand-edited config plus a new session changes no state and prints the pending block with the `apply` trailer; a match prints nothing | cucumber + unit | `npx cucumber-js features/plugin/reconcile.feature`; `node --test test/index.test.ts` | ✅ | ✅ green |
| APL-04 | `pending` advises `apply`; help, completions, router and JSON name `apply` | cucumber + architecture | `npx cucumber-js features/plugin/pending.feature features/plugin/help.feature`; `npm run test:unpaired` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/edge/handlers/plugin/apply.test.ts` — APL-01 parsing
- [x] `test/orchestrators/reconcile/convergence.test.ts` — APL-02 planner (if a convergence module is added)
- [x] the read-only load owner test (module name per plan) — APL-03
- [x] `features/plugin/apply.feature` (15 scenarios)
- [x] catalog-uat fixture for the `apply` payloads and its registration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rows printed during `/reload` are visible in the TUI | APL-03 | UAT-02: Pi erases rows emitted during `/reload` (backlog, out of scope) | Run `/reload` in a live Pi with a pending change and observe the block |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-24 (npm run check exit 0 at b2c4502a, 790 scenarios)

## Validation Audit 2026-10-24

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

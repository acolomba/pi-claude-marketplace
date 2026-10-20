---
phase: "8"
slug: "marketplace-help-and-usage-errors"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-20"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (scenarios); `node:test` (unit, architecture) |
| **Config file** | `cucumber.json` (`tags: "not @url and not @github"`) |
| **Quick run command** | `npm run --silent test:cucumber -- features/marketplace/<file>.feature --parallel 1` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds per feature file; ~105 seconds for `npm run check` |

---

## Sampling Rate

- **After every task commit:** Run the touched feature file and the touched `node --test` files (the commit hook's `check:commit` does not run cucumber)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | USE-03, USE-04 | T-08-01, T-08-02 | Rejected at the edge in the harness sandbox; no config written | cucumber | `npm run test:cucumber -- features/marketplace/usage-errors.feature --parallel 1` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | USE-05, USE-06 | T-08-01, T-08-02 | Rejected at the edge in the harness sandbox; no config written | cucumber | `npm run test:cucumber -- features/marketplace/usage-errors.feature --parallel 1` | ✅ | ✅ green |
| 08-02-01 | 02 | 2 | USE-01, USE-02, USE-08 (D-01) | T-08-03, T-08-04 | One signature row builds the help line and the verb's usage line | cucumber + unit + architecture | `npm run test:cucumber -- features/marketplace/help.feature --parallel 1`; `node --test tests/edge/router.test.ts tests/architecture/flag-catalog-drift.test.ts` | ✅ | ✅ green |
| 08-02-02 | 02 | 2 | USE-01 (D-02) | T-08-03, T-08-04 | Handlers read `marketplaceUsage(verb)`; `router.ts` imports no handler | unit + architecture | `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/register.test.ts tests/edge/handlers/plugin/help.test.ts tests/architecture/flag-catalog-drift.test.ts` | ✅ | ✅ green |
| 08-02-03 | 02 | 2 | USE-01 (docs) | — | N/A | pre-commit | `SKIP=npm-check pre-commit run --files CHANGELOG.md docs/open-closed-proof.md` | ✅ | ✅ green |
| 08-03-01 | 03 | 3 | USE-07 (D-05) | T-08-05, T-08-06 | Empty or blank labelled positional rejected before any orchestrator runs; label is a fixed literal | cucumber + unit | `npm run test:cucumber -- features/marketplace/usage-errors.feature features/plugin/usage-errors.feature --parallel 1`; `node --test tests/edge/args-schema.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/shared.test.ts` | ✅ | ✅ green |
| 08-03-02 | 03 | 3 | USE-07 (docs) | — | N/A | pre-commit | `SKIP=npm-check pre-commit run --files CHANGELOG.md` | ✅ | ✅ green |
| 08-04-01 | 04 | 4 | USE-07 (D-06) | T-08-07, T-08-08 | `parsePluginRef` and the list handler reject before `install`/`info`/`listPlugins` run | cucumber + unit | `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1`; `node --test tests/edge/handlers/plugin/shared.test.ts tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/info.test.ts tests/edge/handlers/plugin/list.test.ts` | ✅ | ✅ green |
| 08-04-02 | 04 | 4 | USE-07 (D-06 boundary) | T-08-07 | Partly malformed refs keep the invalid-reference message | cucumber | `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1` | ✅ | ✅ green |
| 08-05-01 | 05 | 5 | USE-07 (D-06) | T-08-09 | `parsePluginTarget` rejects an empty target or blank `@` name before `updatePlugins`/`reinstallPlugins` | cucumber + unit | `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1`; `node --test tests/edge/handlers/plugin/shared.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/fetch.test.ts tests/edge/handlers/plugin/reinstall.test.ts` | ✅ | ✅ green |
| 08-05-02 | 05 | 5 | USE-07 (docs) | T-08-10 | N/A | pre-commit | `SKIP=npm-check pre-commit run --files CHANGELOG.md` | ✅ | ✅ green |
| 08-05-03 | 05 | 5 | USE-01..USE-08 (phase gate) | T-08-11 | Gate verdict read from the exit status, never piped output | cucumber + phase gate | `npm run test:cucumber -- features/marketplace/help.feature features/marketplace/usage-errors.feature features/plugin/usage-errors.feature --parallel 1`; `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements (08-RESEARCH.md "Validation Architecture"): the scenarios use the existing `the user runs` and `the result has these fields:` steps.*

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none: existing infrastructure covers every requirement)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-20. `npm run check` exited 0 at `1175e83d` (Node v26.11.1, combined tree of all five plans: 311 scenarios passed).

## Validation Audit 2026-10-20

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

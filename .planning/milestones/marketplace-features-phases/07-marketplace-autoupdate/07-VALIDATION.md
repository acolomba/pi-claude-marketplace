---
phase: "7"
slug: "marketplace-autoupdate"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-19"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (scenarios); `node:test` (unit, integration, architecture) |
| **Config file** | `cucumber.json` (`tags: "not @url and not @github"`) |
| **Quick run command** | `npx cucumber-js features/marketplace/autoupdate.feature` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds (quick); the autoupdate.ts paired direct coverage ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js features/marketplace/autoupdate.feature` (the commit hook's `check:commit` does not run cucumber)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | AU-08 (D-08) | — | N/A | cucumber + unit + architecture | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^A flip of a marketplace neither scope holds fails as not added without a scope$'`; `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/architecture/cross-op-convergence.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | AU-07, AU-08 (D-07) | — | N/A | cucumber + unit | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(A flip with a scope that does not hold the marketplace reports it not added to that scope|Enabling autoupdate for every marketplace with none added reports an empty result)$'`; `node --test tests/orchestrators/marketplace/autoupdate.test.ts` | ✅ | ✅ green |
| 07-02-01 | 02 | 2 | AU-02, AU-03, AU-06 (D-02..D-05) | — | N/A | cucumber + unit + integration + edge | `npx cucumber-js features/marketplace/autoupdate.feature`; `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/integration/marketplace-layer-autoupdate.test.ts tests/edge/handlers/marketplace/autoupdate.test.ts` | ✅ | ✅ green |
| 07-02-02 | 02 | 2 | AU-06 (D-03, D-04) | — | N/A | cucumber | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(Enabling autoupdate with --local writes a local entry that has it off while the base layer has it on|Enabling autoupdate for every marketplace writes a local entry that has it off)$'` | ✅ | ✅ green |
| 07-03-01 | 03 | 3 | AU-04, AU-06 (D-05, D-09) | — | N/A | cucumber | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^Disabling autoupdate with --local fails as invalid manifest when the base config cannot be read$'`; `npm run check:features` | ✅ | ✅ green |
| 07-03-02 | 03 | 3 | AU-08 (docs for D-02..D-05, D-08) | — | N/A | architecture + pre-commit | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts`; `SKIP=npm-check pre-commit run --files docs/output-catalog.md README.md README.es.md CHANGELOG.md` | ✅ | ✅ green |
| 07-04-01 | 04 | 4 | AU-01, AU-02, AU-04 | — | N/A | cucumber | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(Enabling autoupdate turns it on for a marketplace|Enabling autoupdate on a marketplace that has it on skips it as already autoupdate|Disabling autoupdate turns it off for a marketplace)$'` | ✅ | ✅ green |
| 07-04-02 | 04 | 4 | AU-03, AU-05 | — | N/A | cucumber (Outline: dir/file run; @url/@github rows bound) | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(A newly added marketplace has autoupdate off|An enabled autoupdate shows in the marketplace list of a new session|An enabled autoupdate shows in the marketplace info of a new session)$'`; `npm run check:features` | ✅ | ✅ green |
| 07-04-03 | 04 | 4 | AU-06, AU-09 (D-01) | — | N/A | cucumber + phase gate | `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(Enabling autoupdate for every marketplace lists the changed marketplaces of each scope before the ones already on|Enabling autoupdate without a scope judges each scope that holds the marketplace on its own)$'`; `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] The D-09 config-writing step (`features/step_definitions/config.steps.ts` with `features/lib/layer-config.ts`) and the steps.md rule amendment, before the D-05 scenario (landed with that scenario in one commit, `914d3c45`)

*Everything else uses existing infrastructure (07-RESEARCH.md "Validation Architecture").*

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

**Approval:** approved 2026-10-20 — `npm run check` exit 0 on `521bbde8` (Node v26.11.1, 231 scenarios passed); `npx cucumber-js features/marketplace/autoupdate.feature` 32 scenarios passed.

## Validation Audit 2026-10-20

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

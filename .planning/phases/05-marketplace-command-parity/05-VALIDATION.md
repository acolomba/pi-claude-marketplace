---
phase: "5"
slug: "marketplace-command-parity"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `05-RESEARCH.md` § Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration) + `@cucumber/cucumber` (behavior) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --test <owner test>`; `npm run test:coverage:direct -- <source path>`; `npx cucumber-js features/marketplace/<file>.feature` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (full); seconds per owner test |

## Sampling Rate

- **After every task commit:** owner tests + direct coverage of the changed pair (the hook runs `check:commit`)
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** `npm run check` green
- **Max feedback latency:** 120 seconds

## Per-Requirement Verification Map

| Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-------------------|-------------|--------|
| MKT-01 | unit | `node --test test/domain/name.test.ts test/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| MKT-01 | scenario | `npx cucumber-js features/marketplace/reserved-name.feature features/plugin/bootstrap.feature` | ❌ W0 | ⬜ pending |
| MKT-02 | unit | `node --test test/domain/source.test.ts test/persistence/state-io.test.ts test/platform/<hosted-module>.test.ts test/orchestrators/marketplace/{add,update,remove,info}.test.ts` | ❌ W0 (platform pair) | ⬜ pending |
| MKT-02 | scenario | `npx cucumber-js features/marketplace/hosted-source.feature` | ❌ W0 | ⬜ pending |
| MKT-03 | unit | `node --test test/edge/router.test.ts test/edge/completions/provider.test.ts test/architecture/flag-catalog-drift.test.ts` | ✅ | ⬜ pending |
| MKT-03 | scenario | `npx cucumber-js features/marketplace/market-alias.feature` | ❌ W0 | ⬜ pending |
| MKT-04 | unit + scenario | `node --test test/orchestrators/marketplace/shared.test.ts test/shared/notification-json.test.ts`; affected marketplace features | ✅ | ⬜ pending |
| MKT-05 | unit + scenario | `node --test test/domain/source.test.ts`; `npx cucumber-js features/marketplace/github-source.feature` | ✅ | ⬜ pending |
| MKT-06 | decision only | none (D-PL5-14) | — | ⬜ pending |
| MKT-07 | unit + scenario | `node --test test/orchestrators/marketplace/add.test.ts`; `npx cucumber-js features/marketplace/failed-add.feature` | ✅ | ⬜ pending |
| MKT-08 | unit | `node --test test/orchestrators/plugin/shared.test.ts test/orchestrators/marketplace/remove.test.ts` | ✅ | ⬜ pending |

## Wave 0 Requirements

- [ ] `test/platform/<hosted-module>.test.ts` — pair for the new fetch module
- [ ] `features/lib/https-git-host` static-catalog route + hosted / anthropics-owner publication steps
- [ ] `features/marketplace/{hosted-source,reserved-name,market-alias}.feature`
- [ ] Migrate the 8 `anthropic-plugin-directory` dir-source scenarios and `test/e2e/_helpers.ts`

## Manual-Only Verifications

All phase behaviors have automated verification. The e2e helper change is proven only by the CI e2e job.

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

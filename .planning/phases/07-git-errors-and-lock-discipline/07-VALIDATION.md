---
phase: "7"
slug: "git-errors-and-lock-discipline"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + @cucumber/cucumber |
| **Config file** | package.json scripts; cucumber.json |
| **Quick run command** | `node --test <owner test>` + `npx cucumber-js --name <scenario>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run owner tests + pre-commit check:commit
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 07-01 | 1 | GLK-01 | T-07-01, T-07-02 | frame only via redacted cause chain | unit + cucumber | `node --test test/shared/git-failure-classifiers.test.ts`; `npx cucumber-js features/plugin/git-source.feature features/marketplace/url-source.feature features/marketplace/failed-add.feature` | ✅ | ⬜ pending |
| 07-01-T2 | 07-01 | 1 | GLK-01 | T-07-01 | marketplace update bytes unchanged | unit + cucumber | `node --test test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/shared.test.ts`; `npx cucumber-js features/marketplace/url-source-update.feature` | ✅ | ⬜ pending |
| 07-02-T1 | 07-02 | 1 | GLK-03 | T-07-03 | GC refuses under a second holder | unit + cucumber | `node --test test/orchestrators/plugin/clone-gc.test.ts test/orchestrators/plugin/uninstall.test.ts` | ✅ | ⬜ pending |
| 07-02-T2 | 07-02 | 1 | GLK-03 | T-07-03, T-07-04 | remove, apply, sweep collect under the lock | unit + cucumber | `node --test test/orchestrators/marketplace/remove.test.ts test/orchestrators/plugin/dependency-bindings.test.ts` | ✅ | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | GLK-03 | T-07-03 | unlocked GC unreachable (typecheck) | static + unit | `npm run typecheck && node --test test/orchestrators/plugin/clone-gc.test.ts` | ✅ | ⬜ pending |
| 07-03-T1 | 07-03 | 1 | GLK-06 | T-07-06 | same-ms rival refused (ST-9) | unit | `node --test --test-name-pattern 'GLK-06' test/orchestrators/plugin/update-swap.test.ts` | ✅ | ⬜ pending |
| 07-03-T2 | 07-03 | 1 | GLK-06 | T-07-06 | finalize after mark; unparseable stamp | unit | `node --test test/orchestrators/plugin/update-swap.test.ts && npm run test:modules` | ✅ | ⬜ pending |
| 07-04-T1 | 07-04 | 1 | GLK-08 | T-07-08 | tag read offline, no request | unit + cucumber | `npx cucumber-js features/plugin/git-source-update.feature --name 'release tag reads the tag from the fetched copy'` | ✅ | ⬜ pending |
| 07-04-T2 | 07-04 | 1 | GLK-08 | T-07-09 | non-commit tag is a miss | unit | `node --test test/orchestrators/plugin/clone-cache.test.ts` | ✅ | ⬜ pending |
| 07-05-T1 | 07-05 | 1 | GLK-07 | T-07-10 | completion offline, list rule | unit | `node --test test/orchestrators/edge-deps.test.ts test/architecture/manifest-lookup-drift.test.ts` | ✅ | ⬜ pending |
| 07-05-T2 | 07-05 | 1 | GLK-07 | — | browse unchanged | unit | `node --test test/orchestrators/edge-deps.test.ts test/edge/handlers/plugin/browse.test.ts` | ✅ | ⬜ pending |
| 07-06-T1 | 07-06 | 2 | GLK-02 | T-07-11, T-07-12 | cascade cause redacted, reason truthful | unit + cucumber | `node --test test/orchestrators/plugin/update-flow.test.ts`; `npx cucumber-js features/plugin/update-rollback.feature` | ✅ | ⬜ pending |
| 07-06-T2 | 07-06 | 2 | GLK-01 | T-07-11 | refresh frame redacted | unit + cucumber | `npx cucumber-js features/plugin/url-marketplace-update.feature` | ❌ W0 (new file, created by the task) | ⬜ pending |
| 07-07-T1 | 07-07 | 2 | GLK-01 | T-07-14 | preflight frame redacted | unit + cucumber | `npx cucumber-js features/plugin/git-source-update.feature` | ✅ | ⬜ pending |
| 07-07-T2 | 07-07 | 2 | GLK-04 | T-07-13 | tag copy only under lock | unit | `node --test --test-name-pattern 'GLK-04' test/orchestrators/plugin/update-preflight.test.ts` | ✅ | ⬜ pending |
| 07-08-T1 | 07-08 | 2 | GLK-01 | T-07-16, T-07-17 | fetch frame redacted; no git import | unit + cucumber | `npx cucumber-js features/plugin/fetch.feature` | ✅ | ⬜ pending |
| 07-08-T2 | 07-08 | 2 | GLK-05, GLK-07 | T-07-15 | row read under lock | unit + cucumber | `node --test test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/operations.test.ts` | ✅ | ⬜ pending |
| 07-09-T1 | 07-09 | 2 | GLK-01 | T-07-19 | token only, no cause | unit + cucumber | `npx cucumber-js features/plugin/info.feature` | ✅ | ⬜ pending |
| 07-09-T2 | 07-09 | 2 | GLK-05 | T-07-18 | row read under lock | unit | `node --test --test-name-pattern 'GLK-05\|GIT-03' test/orchestrators/plugin/info.test.ts` | ✅ | ⬜ pending |
| 07-10-T1 | 07-10 | 3 | GLK-01 | T-07-20 | no URL or credential on the arm | unit + cucumber | `node --test test/orchestrators/plugin/dependency-tag-probe.test.ts`; `npx cucumber-js features/plugin/git-source.feature` | ✅ | ⬜ pending |
| 07-10-T2 | 07-10 | 3 | GLK-01 | T-07-21 | docs match behavior | architecture | `node --test test/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A two-process intent-mark race in one millisecond | GLK-06 | not deterministic across processes | covered by a unit test with mocked `Date` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 75s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

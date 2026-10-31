---
phase: "10"
slug: "github-source-kind-and-suite-close"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-21"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` 13.3.0 (behavioral); `node:test` (unit and architecture) |
| **Config file** | `cucumber.json` (`parallel: 8`, `order: random`; `tags` removed in the last plan) |
| **Quick run command** | `npm run test:cucumber -- <feature file> --parallel 1` (before the switch-on, a scratch `"tags": "@github"` config passed by a path relative to the cwd) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~20 seconds (cucumber, Node 24); ~75 seconds (`npm run check`) |

---

## Sampling Rate

- **After every task commit:** the hook's `check:commit`, plus the targeted cucumber file
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the recorded Node 24 and Node 26 whole-suite runs
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | SRC-02 | — | override reaches Pi only from the run (operator value never leaks) | cucumber + arch | `npm run test:cucumber -- features/marketplace/github-source.feature --parallel 1`; `node --test tests/architecture/hermetic-git-environment.test.ts` | ✅ | ✅ green |
| 10-01-02 | 01 | 1 | SRC-02 | — | N/A | cucumber | `npm run test:cucumber -- features/marketplace/github-source.feature features/marketplace/unsupported-source.feature --parallel 1` | ✅ | ✅ green |
| 10-02-01 | 02 | 2 | ADD-11, UPD-12 | — | host keeps serving when the backend skips the body (D-14) | arch | `node --test tests/architecture/https-git-host-server.test.ts tests/architecture/https-git-host-cgi.test.ts` | ✅ | ✅ green |
| 10-02-02 | 02 | 2 | ADD-11, UPD-12 | — | run frees host and root on partial failure | cucumber (Node 24 + 26) | `npm run test:cucumber` | ✅ | ✅ green |
| 10-03-01 | 03 | 3 | SRC-03 | — | N/A | cucumber | `npm run test:cucumber -- features/marketplace/info.feature features/marketplace/url-source.feature --parallel 1` | ✅ | ✅ green |
| 10-03-02 | 03 | 3 | SRC-03 | — | N/A | unit + cucumber (D-12) | `node --test tests/domain/source.test.ts`; `npm run test:cucumber -- features/marketplace/github-source.feature --parallel 1` | ✅ | ✅ green |
| 10-03-03 | 03 | 3 | SRC-03 | — | N/A | docs | `SKIP=npm-check pre-commit run --files CHANGELOG.md .planning/PROJECT.md` | ✅ | ✅ green |
| 10-04-01 | 04 | 4 | ADD-11 | — | 401 without a credential fails as `authentication required`; credential only in sandbox | cucumber | `npm run test:cucumber -- features/marketplace/git-source.feature --parallel 1` | ✅ | ✅ green |
| 10-04-02 | 04 | 4 | UPD-12 | — | update 401 names `git credential approve` for `{git host}`; no credential leak (D-10, D-13) | unit + cucumber | `node --test tests/orchestrators/marketplace/update.test.ts tests/architecture/no-credential-leak.test.ts` | ✅ | ✅ green |
| 10-05-01 | 05 | 5 | all four | — | N/A | cucumber | `npm run test:cucumber` (429/429, 46 `@github`) | ✅ | ✅ green |
| 10-05-02 | 05 | 5 | all four | — | N/A | cucumber red/green (SC5) | `npm run test:cucumber -- features/marketplace/remove.feature features/plugin/cross-scope-install.feature --parallel 1 --tags @github` | ✅ | ✅ green |
| 10-06-01 | 06 | 6 | all four | — | N/A | cucumber review | `npm run test:cucumber`; `npm run check:features` | ✅ | ✅ green |
| 10-06-02 | 06 | 6 | all four | — | N/A | cucumber review | `npx cucumber-js --dry-run --format usage` | ✅ | ✅ green |
| 10-07-01 | 07 | 7 | all four | — | credential isolation under hostile config (manual) | cucumber (Node 24 + 26) | `npm run test:cucumber` | ✅ | ✅ green |
| 10-07-02 | 07 | 7 | all four | — | N/A | phase gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `RpcGitEnvironment` override field and its architecture test
- [x] github fixture arms in `features/lib/published-marketplace.ts`, and the HOST-EPIPE fix (D-14), before any github scenario or Node 24 run
- [x] A branch-publishing fixture helper and its step (D-02, D-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hostile `~/.gitconfig` + planted system credential helper changes no result | SC4 | never committed (CONVENTIONS) | Run once by hand per RESEARCH "Suite-close mechanics"; record in SUMMARY |
| Whole suite on Node 24 and Node 26 | SC4 (D-06) | CI runs Node 24 only | `npx -p node@24` run plus the local Node 26 run; record versions and results |
| CI timing | SC4 (D-08) | nothing is pushed in this phase | Record local timing; read the PR job duration at milestone close |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-21

## Validation Audit 2026-10-21

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

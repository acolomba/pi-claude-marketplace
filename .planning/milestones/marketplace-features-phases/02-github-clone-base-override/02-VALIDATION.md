---
phase: "2"
slug: "github-clone-base-override"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-15"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (typescript-unit-tests skill) |
| **Config file** | none (npm scripts in `package.json`) |
| **Quick run command** | `node --test <owner test path>`; `npm run test:coverage:direct -- <source or test path>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | 0.5–10 s per owner test; ~100 s for `npm run check` |

---

## Sampling Rate

- **After every task commit:** owner test(s) touched + direct coverage for each changed source; the hook runs `npm run check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 100 seconds

---

## Per-Task Verification Map

Filled by the planner from PLAN.md `<verify>` blocks. Every command is repo-root-relative; each
direct-coverage run is `npm run test:coverage:direct -- <source>` for the task's changed sources.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | GHB-01, GHB-03, GHB-04 | T-02-01, T-02-02, T-02-03, T-02-04 | value never echoed; non-https refused before any network call; exact prefix only; canonical origin restored | unit (tracer) | `node --test tests/shared/github-base-url.test.ts tests/shared/errors.test.ts tests/platform/git.test.ts` + direct coverage (seam, errors, git) | ✅ | ✅ green |
| 2-01-02 | 01 | 1 | GHB-01, GHB-04 | T-02-04, T-02-05 | fetch passes the wire URL as an option and never writes config | unit | `node --test tests/platform/git.test.ts` + direct coverage (git) | ✅ | ✅ green |
| 2-02-01 | 02 | 2 | GHB-02, GHB-04 | T-02-06, T-02-07, T-02-08 | stored credential bound to the override host; no Device Flow under the override | unit | `node --test tests/shared/github-base-url.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/update-flow.test.ts` + direct coverage (auth-host, seam) | ✅ | ✅ green |
| 2-02-02 | 02 | 2 | GHB-02, GHB-04 | T-02-06, T-02-08 | path and url sources never read the variable | unit | `node --test tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/update-flow.test.ts` | ✅ | ✅ green |
| 2-03-01 | 03 | 3 | GHB-03 | T-02-09, T-02-11 | typed error rethrown, never a misleading row; json cause unredacted | unit | `node --test tests/shared/errors.test.ts tests/shared/notification-command-error.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts` + direct coverage (errors) | ✅ | ✅ green |
| 2-03-02 | 03 | 3 | GHB-03 | T-02-09 | install and import fail as a whole | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/import/execute.test.ts` + direct coverage (install-flow, execute) | ✅ | ✅ green |
| 2-03-03 | 03 | 3 | GHB-03 | T-02-09, T-02-10 | enable fails as a whole; reconcile still catches it (NFR-2) | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/edge/handlers/plugin/enable-disable.test.ts tests/index.test.ts tests/orchestrators/reconcile/apply.test.ts` + direct coverage (enable-disable, edge handler) | ✅ | ✅ green |
| 2-04-01 | 04 | 4 | GHB-03 | T-02-12, T-02-13 | reinstall and fetch fail as a whole | unit | `node --test tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/plugin/fetch.test.ts` + direct coverage (fetch, reinstall-flow) | ✅ | ✅ green |
| 2-04-02 | 04 | 4 | GHB-03, GHB-04 | T-02-12, T-02-14 | info --fetch fails as a whole; bare info never reads the variable | unit | `node --test tests/orchestrators/plugin/info.test.ts` + direct coverage (info) | ✅ | ✅ green |
| 2-04-03 | 04 | 4 | GHB-03 | T-02-12, T-02-13 | plugin update fails as a whole in sync, direct, and cascade paths | unit | `node --test tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/marketplace/update.test.ts` + direct coverage (update-flow, update-preflight) | ✅ | ✅ green |
| 2-05-01 | 05 | 5 | GHB-02, GHB-04 | T-02-15 | a new github.com literal outside the seam fails lint | lint + unit | `npm run lint` (empty cache); `node --test tests/domain/clone-key.test.ts tests/domain/source.test.ts tests/shared/github-base-url.test.ts` + direct coverage (clone-key) | ✅ | ✅ green |
| 2-05-02 | 05 | 5 | GHB-05 | T-02-16 | credential example uses placeholders only | docs lint | `SKIP=npm-check pre-commit run --files README.md README.es.md CHANGELOG.md` | ✅ | ✅ green |
| 2-05-03 | 05 | 5 | GHB-01..GHB-05 | — | N/A | phase gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/shared/github-base-url.test.ts` — paired test for the new seam (100% direct coverage); created by task 2-01-01 together with the seam, because the commit hook requires 100% direct coverage for every staged pair
- [x] `tests/shared/github-base-url-environment.ts` — `setGitHubBaseUrl(t, value)`, the one way every later case sets or clears the variable (task 2-01-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The literal gate fails a planted `github.com` literal | GHB-02 | CONVENTIONS forbids committed negative controls | Task 2-05-01 step 7: plant in a non-exempt file, plant a new line in `domain/source.ts`, and plant a comment; run `npx eslint <file>` each time; the first two must report `local/no-github-literal`, the comment must not; revert and record in 02-05-SUMMARY.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 100s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-16 (phase gate `npm run check` exit 0 at `3ff8a299`, Node v26.11.1)

## Validation Audit 2026-10-16

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

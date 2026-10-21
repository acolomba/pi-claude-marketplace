---
phase: "10"
slug: "github-source-kind-and-suite-close"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| ADD-11 (url) | TBD | TBD | ADD-11 | — | 401 without a credential fails as `authentication required` | cucumber | `npm run test:cucumber -- features/marketplace/git-source.feature` | ✅ (moves from url-source.feature) | ⬜ pending |
| ADD-11 (gh) | TBD | TBD | ADD-11 | — | same through the override (D-11 github Outline) | cucumber | same | ❌ W0 | ⬜ pending |
| UPD-12 | TBD | TBD | UPD-12 | — | update 401 names `git credential approve` for `{git host}` (D-10, D-13) | cucumber + unit | same; `node --test tests/orchestrators/marketplace/update.test.ts` | ❌ W0 | ⬜ pending |
| SRC-02 | TBD | TBD | SRC-02 | — | N/A | cucumber | `npm run test:cucumber -- features/marketplace/github-source.feature` | ❌ W0 | ⬜ pending |
| SRC-03 | TBD | TBD | SRC-03 | — | N/A | cucumber + unit (D-12) | same; `node --test tests/domain/source.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `RpcGitEnvironment` override field and its architecture test
- [ ] github fixture arms in `features/lib/published-marketplace.ts`, and the HOST-EPIPE fix (D-14), before any github scenario or Node 24 run
- [ ] A branch-publishing fixture helper and its step (D-02, D-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hostile `~/.gitconfig` + planted system credential helper changes no result | SC4 | never committed (CONVENTIONS) | Run once by hand per RESEARCH "Suite-close mechanics"; record in SUMMARY |
| Whole suite on Node 24 and Node 26 | SC4 (D-06) | CI runs Node 24 only | `npx -p node@24` run plus the local Node 26 run; record versions and results |
| CI timing | SC4 (D-08) | nothing is pushed in this phase | Record local timing; read the PR job duration at milestone close |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

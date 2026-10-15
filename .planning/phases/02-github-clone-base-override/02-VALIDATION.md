---
phase: "2"
slug: "github-clone-base-override"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Filled by the planner from PLAN.md `<verify>` blocks. Requirement → command map (from 02-RESEARCH.md):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| GHB-01 | prefix rewrite (base, path prefix, trailing slash); identity when unset or not a github URL | unit | `node --test tests/shared/github-base-url.test.ts` | ❌ W0 | ⬜ pending |
| GHB-01 / D-02 | clone/fetch/resolveRemoteRef/listRemoteTags send the wire URL; clone records the canonical origin; fetch leaves config unchanged | unit | `node --test tests/platform/git.test.ts` | ✅ | ⬜ pending |
| GHB-02 | auth host follows the override; stored-credential bundle (no Device Flow) under the override | unit | `node --test tests/orchestrators/auth-host.test.ts` | ✅ | ⬜ pending |
| GHB-02 | add / update / update-flow bind the override host; path-only runs never read the variable | unit | owner tests under `tests/orchestrators/` | ✅ | ⬜ pending |
| GHB-02 | new `github.com` literal fails lint | lint | `npm run lint` | config | ⬜ pending |
| GHB-03 | each refused form throws the typed error naming the variable, slash-free message | unit | `node --test tests/shared/github-base-url.test.ts` | ❌ W0 | ⬜ pending |
| GHB-04 | unset path byte-identical; existing suites unchanged | unit + full | `npm run check` | ✅ | ⬜ pending |
| GHB-05 | README (+ localized copies) and CHANGELOG document the divergence | docs | `pre-commit run --files README*.md CHANGELOG.md` | docs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shared/github-base-url.test.ts` — paired test for the new seam (100% direct coverage)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The literal gate fails a planted `github.com` literal | GHB-02 | CONVENTIONS forbids committed negative controls | Plant once, run `npm run lint`, confirm failure, revert, record in SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 100s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

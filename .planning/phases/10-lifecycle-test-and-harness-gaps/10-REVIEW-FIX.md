---
phase: 10-lifecycle-test-and-harness-gaps
fixed_at: 2026-10-28T22:43:54Z
review_path: .planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md
iteration: 4
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-28T22:43:54Z
**Source review:** `.planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md`
**Iteration:** 4

All three integrated findings are closed. The two shared PTY blockers were
fixed on the Phase 8 branch and consumed through the normal Session B merge.
The remaining Phase 10 checker warning was fixed on the integrated tree.

## Fixed Issues

### CR-01: The wait-cap scenario exercises the hosted-download timeout, not the background gate

**Status:** fixed by integrated Phase 8 convergence
**Commit:** `4412c2cb` — `fix: gate background dependency settlement and verify cancellation`
**Files modified:**

- `features/lib/https-git-host/server.ts`
- `features/marketplace/background-update.feature`
- `features/step_definitions/marketplace/background-update.steps.ts`
- `test/orchestrators/marketplace/background-pass.test.ts`

The scenario now holds a streaming git smart-HTTP transfer that does not end at
the hosted-manifest fetcher's independent timeout. It proves the foreground
gate aborts the transfer before dependency settlement, with bounded elapsed
time and explicit cancellation evidence.

### CR-02: Set-normalized terminal output hides duplicate background notices

**Status:** fixed by integrated Phase 8 convergence
**Commit:** `7a436b05` — `test: distinguish aggregate background update notices`
**Files modified:**

- `features/lib/pi-tui.ts`
- `features/marketplace/background-update.feature`
- `features/step_definitions/marketplace/background-update.steps.ts`
- `test/architecture/pi-tui-notices.test.ts`

The final-screen same-name case remains, while a distinct `alpha`/`beta`
scenario requires one combined notice. The direct oracle tests reject separate
notices for distinct plugins without claiming that identical terminal redraws
are independent emission events.

### WR-01: The coverage checker does not bind evidence paths and titles to their cited commit

**Status:** fixed
**Commit:** `d4c3220b` — `fix(coverage): bind evidence to commits`
**Files modified:**

- `scripts/check-phase10-coverage.mjs`
- `.planning/phases/10-lifecycle-test-and-harness-gaps/10-COVERAGE.md`

The checker now reads every evidence path from its row's exact commit with an
argument-array `git show` call and requires the title in that committed
content. It retains the current-checkout containment, existence, and title
checks. Five rows now cite the exact integrated evidence commits: the network
guard decision, the split install fixture and root-commit owners, the git
cancellation scenario, and the distinct aggregate-notice scenario.

## Verification

Checks ran in the existing isolated Session A worktree at
`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`
with Node `v26.12.1`.

| Check | Result |
| --- | --- |
| Integrated `npm run check` before the checker-only fix | Passed at `28915add`: 1,131 scenarios, 11,584 steps, 309 direct LCOV records |
| Wait-cap git cancellation scenario | Passed: 1 scenario, 19 steps |
| Aggregate-notice oracle owner tests | Passed: 4/4 |
| Distinct `alpha`/`beta` PTY scenario | Passed: 1 scenario, 19 steps |
| Phase 10 coverage ledger | Passed: 56/56 rows |
| Negative commit-binding mutation | Rejected the context path absent from commit `7e2a3ca7`; mutation restored exactly |
| `node --check` | Passed for `scripts/check-phase10-coverage.mjs` |
| Prettier and ESLint | Passed for the checker |
| Fallow guard and audit | Passed; no introduced findings |
| Required pre-commit fixers | Passed |
| Commit hook, including `npm run check:commit` | Passed |
| `git diff --check` | Passed |

The checker and ledger change does not alter production, unit-test, or
behavioral-test inputs. The orchestrator owns the final combined-tree gate and
clean re-review.

---

_Fixed: 2026-10-28T22:43:54Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 4_

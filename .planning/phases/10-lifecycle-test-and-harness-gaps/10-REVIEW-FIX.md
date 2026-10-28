---
phase: 10-lifecycle-test-and-harness-gaps
fixed_at: 2026-10-28T06:50:46Z
review_path: .planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-28T06:50:46Z
**Source review:** `.planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md`
**Iteration:** 2

All three warning findings were fixed. No findings were skipped.

## Fixed Issues

### WR-01: Behavioral owner tests bypass the public composition root

**Status:** fixed
**Commit:** `99af799b` — `fix(test): exercise public install composition`
**Files modified:**

- `test/orchestrators/plugin/install-flow-fixture.ts`
- `test/orchestrators/plugin/install-flow.test.ts`

The shared owner fixture now creates install operations through the public
`install-flow.ts` factories. It no longer rebuilds the production root from the
planning and ledger leaves.

The public-root pair now runs an explicit-environment dependency move through
planning and ledger persistence. It checks the complete installed outcome and
the recorded dependency version and commit. A wiring error in the root now
breaks a behavioral case instead of only a `typeof` assertion.

### WR-02: The planning leaf is coupled to 15 exported ledger internals

**Status:** fixed
**Commit:** `25725cfc` — `refactor(plugin): compose install planning ports`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`
- `test/orchestrators/plugin/install-flow-planning.test.ts`

The ledger now exports one `InstallPlanningLedgerPorts` contract and one factory
that binds it. The public root supplies that port to `createInstallPlanning`, so
the root owns the complete composition. Planning no longer imports 15 ledger
helpers or depends on their individual exports.

The update-dependency planning cases now enter through the public root. The
change keeps the graph acyclic and keeps leaf helpers private.

### WR-03: The exact-path large-file exception also matches path prefixes

**Status:** fixed
**Commit:** `d1228a7f` — `fix(config): end-anchor large file exceptions`
**File modified:** `.pre-commit-config.yaml`

The two extracted large TypeScript paths are now end-anchored alternatives.
Names with `.bak`, `.old`, or another suffix no longer match the exception.

## Additional Hook Fix

Commit `b273ed52` (`fix(plugin): remove redundant prune assertions`) removes two
unnecessary type assertions in `orchestrators/plugin/prune.ts`. Fresh no-cache
ESLint found them while the ordinary cached lint still passed. The change is
limited to those two assertions and the prune owner coverage remains green.

## Verification

All checks ran in the isolated review-fix worktree at
`/home/acolomba/pi-claude-marketplace/.claude/worktrees/rf-10-20261028-0600`,
on `gsd-reviewfix/10-20261028-0600`, with Node `v26.12.1`.

| Check | Result |
| --- | --- |
| Project typecheck | Passed |
| Three install-flow owner modules | Passed, 329 tests |
| Direct coverage for root, planning, and ledger pairs | Passed, 100% line, branch, and function coverage |
| Affected architecture inventories | Passed, 56 tests |
| Full-tree ESLint with `--no-cache` | Passed |
| `fallow guard` on the changed split files | Passed |
| `fallow dupes --fail-on-issues` | Passed, no clones |
| `fallow audit --base 76c1dd77` | Passed, no issues in 8 changed files |
| Required pre-commit fixers | Passed |
| Commit hooks for each fix | Passed |
| Full `npm run check` | Passed: 1,120 scenarios, 11,411 steps, 306 direct LCOV records |
| `git diff --check` | Passed |

---

_Fixer: gsd-code-fixer_
_Iteration: 2_

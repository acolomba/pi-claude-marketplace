---
phase: 11-cleanup-split-and-docs
fixed_at: 2026-10-28T09:38:07Z
review_path: .planning/phases/11-cleanup-split-and-docs/11-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-10-28T09:38:07Z
**Source review:** `.planning/phases/11-cleanup-split-and-docs/11-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Shared disabled-holder filtering no longer preserves declaration-index keys

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`, `test/orchestrators/plugin/dependency-index.test.ts`, `test/orchestrators/plugin/enable-disable.test.ts`, `test/orchestrators/marketplace/remove.test.ts`
**Commit:** `34b77e6f`
**Status:** fixed
**Applied fix:** `withoutDisabledHolders` now filters the exact indexed candidates by `candidate.key` and `candidate.record`. The callers keep the candidates from the same declaration-index walk. Two standalone-disable cases use an outer marketplace key that differs from `record.name`. A user-disabled holder does not block the disable, while a `dependencyDisabled` holder still blocks it under the indexed key.

### WR-02: Architecture documentation still describes the pre-split install flow

**Files modified:** `.planning/codebase/ARCHITECTURE.md`
**Commit:** `2f1cc6f8`
**Applied fix:** The install-flow characteristic, orchestrator inventory, and primary request path now describe `install-flow.ts` as the public `createInstallPlugin` composition root. They name `install-flow-planning.ts`, its private five-operation port, `install-flow-ledger.ts`, and the private `installPluginWithTransaction`. The child-process and hosted-manifest fetch chokepoint records remain unchanged.

### WR-03: The refreshed PRD publishes obsolete dependency and quality contracts

**Files modified:** `docs/prd/pi-claude-marketplace-prd.md`
**Commit:** `f880a4f3`
**Applied fix:** NFR-6 now lists the full `npm run check` quality bar, including Fallow, source/test pairing, and 100% direct coverage. NFR-11 and the glossary now name `@earendil-works/pi-coding-agent` with peer range `>=1.0.0` and development range `^1.0.0`. The obsolete version-pinning recommendation is removed.

## Verification

Verification ran in the isolated fixer worktree at `/home/acolomba/pi-claude-marketplace/.claude/worktrees/rf-11-2607` on commit `f880a4f3` with Node `26.12.1`.

- The two mismatched-key standalone-disable regressions passed.
- `test/orchestrators/plugin/dependency-index.test.ts` passed.
- The marketplace-remove and uninstall owner suites passed 196 of 196 tests.
- Direct coverage passed for `dependency-index.ts`, `enable-disable.ts`, `uninstall.ts`, and `marketplace/remove.ts`.
- `npm run test:architecture` passed 60 of 60 tests.
- `npm run check:static` passed type checking, ESLint, workflow checks, Fallow, Prettier, source/test pairing, and feature validation.
- Planning consistency returned `true`.
- `fallow guard` reported no boundary violation, and `fallow audit --base 4e6e7fc7` reported no issue in the nine changed files.
- `npm run check` passed with 1,120 Cucumber scenarios, 11,411 steps, and 306 direct-coverage records.
- All three commits passed the repository commit hooks. The WR-01 hook also passed `npm run check:commit`.

## Skipped Issues

None.

---

_Fixed: 2026-10-28T09:38:07Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_

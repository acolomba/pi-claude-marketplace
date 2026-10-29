---
phase: 11-cleanup-split-and-docs
fixed_at: 2026-10-28T12:07:43Z
audit_head: 849801c4
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 11: Security Fix Report

## Fixed Issues

### T-11-14: Extracted install owners acquired filesystem authority

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts`, and their three direct owner tests
**Commit:** `4cceceb2`
**Applied fix:** The public install composition root now constructs the removal port. It passes that port through private ledger and planning owners. The ledger binds data-directory creation to the current install's `pluginDataDir` and gives result projection a zero-argument callback. Cascade context and result projection no longer import `node:fs/promises` or construct removal operations.

### T-11-09: The closed backlog item cited the pre-gap split

**File modified:** `.planning/BACKLOG.md`
**Commit:** `91f46fe7`
**Applied fix:** The UPDDEP-01 closure now cites `11-13-SUMMARY.md` and all six current install-flow owner suites.

## Verification

Verification ran in the assigned Phase 11 worktree on commit `91f46fe7` with Node `26.12.1`.

- All six affected owner suites passed.
- Direct coverage passed at 100% for all six affected source pairs.
- The no-shell-out, no-credential-leak, hooks-lifecycle, and workflow-marker architecture tests passed.
- Every `install-flow*.ts` source remains below 1,959 lines and 64 KiB.
- Cascade context and result projection have no raw filesystem import or `createRemovalOps` call.
- Fallow guard, duplication, import-path, and changed-file audit gates passed. The normal new-only audit could not create its comparison worktree because the shared Git directory was read-only, so the audit ran with `--gate all` and found no issue.
- `npm run check` passed with 1,120 Cucumber scenarios, 11,411 steps, and 309 direct-coverage records.
- Both commits passed the repository hooks. The source commit passed `npm run check:commit`.

## Skipped Issues

None.

---

_Fixed: 2026-10-28T12:07:43Z_
_Fixer: the agent (gsd-code-fixer)_

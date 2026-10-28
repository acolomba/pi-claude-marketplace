---
phase: 04-dependency-resolver-residue
fixed_at: 2026-10-28T17:36:45Z
review_path: .planning/phases/04-dependency-resolver-residue/04-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 04: Code review fix report

**Fixed at:** 2026-10-28T17:36:45Z
**Source review:** .planning/phases/04-dependency-resolver-residue/04-REVIEW.md
**Iteration:** 1

## Summary

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed issues

### CR-01: Foreign agent-index ownership refuses after an earlier move commits

**Status:** fixed: requires human verification
**Commit:** `8f82527c`
**Files modified:**

- `extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts`
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts`
- `extensions/pi-claude-marketplace/bridges/agents/target-check.ts`
- `test/bridges/agents/index-mutation.test.ts`
- `test/bridges/agents/target-check.test.ts`
- `features/plugin/install-dependencies.feature`
- `features/plugin/update-dependencies.feature`
- `features/step_definitions/plugin/installation.steps.ts`

**Applied fix:** Preview retains the foreign partition of the agents index and runs the same ownership assertion as staging before reading target files. The assertion throws `AgentOwnershipConflictError` with every conflicting name and owner, in incoming-name order. Its public fields exclude index paths and metadata. The conflict collector is private because the shared assertion owns its callers.

The regression covers a foreign claim whose target is missing, compares preview and staging refusals, and proves that neither writes. An own-owner claim with a missing target still passes. Existing force, user-content preservation, and NFR-10 containment checks remain in the commit path.

The public install and update scenarios each require two dependency moves. A stale foreign claim blocks the second dependency. Both scenarios assert the complete refusal rows using generated names without absolute paths, unchanged config and installation-record bytes, both dependency versions at 1.0.0, the retained index row, no agent target files, and complete installed skill-file bytes.

The logic-change status retains the fixer workflow's human-review flag. Automated tests exercise the reported failure directly.

### WR-01: The rollback-partial contract says apply does not render it

**Status:** fixed
**Commit:** `c9dbf878`
**File modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts`

**Applied fix:** Removed the obsolete sentence that said apply did not render rollback partials. The comment still describes failed undo steps and omission when all undo steps finish. Traced the current `applyDependencyInstalls` failure path through `installFailedOutcomes` and read the existing rollback-rendering assertions. No test pins the removed sentence, so no test change was needed.

## Verification

All checks ran in the existing isolated owner worktree:

`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`

Branch: `agent-reverify-a`. Node: `v26.12.1`. The owner set `workflow.use_worktrees=false`; this fixer created no nested worktree and did not stage the configuration or STATE changes.

- Re-read every changed section and checked `git diff --check`.
- Before the source fix, the absent-target unit case failed with a missing expected rejection. The existing foreign-target case also failed its stronger typed-error assertion.
- `node --test test/bridges/agents/target-check.test.ts test/bridges/agents/index-mutation.test.ts test/bridges/agents/stage.test.ts` passed 48 cases before the extra own-owner/missing-target case. Later direct coverage and the commit hook exercised that added case.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/target-check.ts extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts extensions/pi-claude-marketplace/bridges/agents/stage.ts` exited 0. The target-check and index-mutation pairs were rerun after their subsequent test edits, also exit 0. All three pairs meet 100% direct coverage.
- With the preview assertion temporarily disabled, `npx cucumber-js --parallel 1 --name 'second dependency has a foreign agent claim with a missing file'` failed both scenarios because the operation required a reload after partial work. With the assertion restored, it exited 0: 2 scenarios, 41 steps passed. The local loopback servers required execution outside the sandbox.
- `fallow audit --base HEAD --gate all --format json --quiet` passed before each commit, with zero dead-code, complexity, and duplication findings. The first audit identified the collector export made unused by this fix; the final code makes it private and tests the public assertion.
- Required pre-commit fixers passed for both findings. The first CR-01 commit attempt stopped on six void-callback lint errors; those were fixed and the next attempt passed. No hook was bypassed.
- Both successful commits ran `npm run check:commit` through their hooks, exit 0: project-aware typecheck, lint, static checks, feature validation, unpaired unit tests, and direct coverage for the staged source-test pairs.
- The full combined-tree `npm run check` phase gate remains the owning workflow's next step. Focused results and commit hooks do not replace it.

No new source files were created. This report is intentionally uncommitted for the owning workflow.

---

_Fixer: gsd-code-fixer_
_Iteration: 1_

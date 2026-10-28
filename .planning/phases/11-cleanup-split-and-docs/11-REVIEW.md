---
phase: 11-cleanup-split-and-docs
reviewed: 2026-10-28T12:22:45Z
depth: deep
files_reviewed: 70
files_reviewed_list:
  - .pre-commit-config.yaml
  - CHANGELOG.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - features/plugin/autoapply.feature
  - features/plugin/cross-scope-install.feature
  - features/plugin/git-source-update.feature
  - features/plugin/reconcile.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update-rollback.feature
  - test/architecture/gate-targets.ts
  - test/architecture/hooks-lifecycle.test.ts
  - test/architecture/no-test-only-production-surface.test.ts
  - test/architecture/notify-stamp-coverage.test.ts
  - test/architecture/partial-vocabulary-guard.test.ts
  - test/architecture/workflows-marker-coverage.test.ts
  - test/edge/handlers/plugin/shared.test.ts
  - test/edge/handlers/shared.test.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/remove.test.ts
  - test/orchestrators/marketplace/shared.test.ts
  - test/orchestrators/plugin/clone-gc.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/fetch.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/types.test.ts
  - test/orchestrators/state-lock.ts
  - test/orchestrators/types.test.ts
  - test/platform/git.test.ts
  - test/platform/removal-ops-fake.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-28T12:22:45Z
**Depth:** deep
**Files Reviewed:** 70
**Status:** issues_found

## Summary

The review covered the exact union of Phase 11 implementation commits through `33799ae7`, including the six Plan 11-13 source/test owners added after the prior clean review. It re-reviewed the Plan 11-13 split and the filesystem-capability remediation at `4cceceb2`, with call-chain checks for public API stability, recursive install re-entry, transaction ordering, dependency moves, rollback and deferred-pin projection, package containment, and the new typed removal capability. The supplemental documentation-truth audit also covered all 13 plan/summary pairs, `11-SECURITY.md`, `11-SECURITY-FIX.md`, `11-VALIDATION.md`, `.planning/{PROJECT,BACKLOG,REQUIREMENTS}.md`, and `.planning/codebase/ARCHITECTURE.md`; planning artifacts are excluded from the formal source-file count above.

The public `install-flow.ts` root still exports the same three factories and four contract types and binds the same five-operation planning port. Recursive re-entry carries the same `InstallLedgerComposition`, and missing-dependency, preview, initial/materialized cascade, and update-settlement paths receive the root-owned removal capability. The remediation binds data-directory creation to the transaction's own `pluginDataDir`; cascade and result owners do not acquire raw filesystem removal authority. Dependency-ledger imports the main ledger in one direction only, so the split adds no runtime or type-only cycle. The architecture map retains the child-process, hosted-manifest fetch, and path-containment chokepoints.

Fallow's final review brief passed with no introduced dead-code, complexity, duplication, boundary, or cycle findings. Fallow architecture reported zero issues, guard showed the expected rule coverage, and explicit traces proved there is no reverse ledger-to-dependency-ledger edge. Its changed-scope security candidates are unchanged contained sinks that became reachable from the newly extracted module under Fallow's module-level taint heuristic; the source paths still enforce the existing containment checks. The exact build-input tree at `91f46fe7` passed the full `npm run check` gate with 1,120 Cucumber scenarios, 11,411 steps, and 309 direct-coverage records under Node `26.12.1`; every later commit through `33799ae7` changes planning/security/validation records only, so that evidence is reusable under the local-verification policy. All six install-flow pairs also passed 100% direct coverage in the refreshed validation. CodeGraph was attempted first but could not open its database.

The implementation behavior and security boundaries are sound, but the split left misleading pre-split comments in two owners. Those comments now name the wrong file or functions that no longer exist in that owner.

## Narrative Findings (AI reviewer)

### WR-01: Split owners retain misleading pre-split comments

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:1`

**Related locations:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:516-520`; `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts:240-248`

**Issue:** The ledger header still identifies the file as `install-flow.ts`. Its sequencing comment says helpers are "extracted above" and names `collectPostCommitWarnings`, `buildInstalledOutcome`, and `handleInstallThrow`; after Plan 11-13, those implementations live in the result sibling, two names no longer exist, and the ledger-facing wrapper is `collectInstallPostCommitWarnings`. The results sibling also has a detached WARN-01 JSDoc immediately before `failedRowOutcome`, although that prose describes malformed-component aggregation rather than the function that follows. These comments are now false navigation aids in transaction-sensitive code and conflict with the project's rule that comments describe the current code.

**Fix:** Rename the ledger header to `install-flow-ledger.ts`; rewrite the sequencing comment with the current sibling/function names (or remove the obsolete helper list); and either attach the WARN-01 prose to the malformed-reason helper it documents or delete the detached block.

---

_Reviewed: 2026-10-28T12:22:45Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

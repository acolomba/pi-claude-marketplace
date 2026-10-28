---
phase: 11-cleanup-split-and-docs
reviewed: 2026-10-28T09:07:43Z
depth: deep
files_reviewed: 64
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
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
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
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
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-28T09:07:43Z
**Depth:** deep
**Files Reviewed:** 64
**Status:** issues_found

## Summary

The review covered the exact union of Phase 11 implementation commits, including the install-flow split, its follow-up review fixes, owner tests, architecture tests, behavioral descriptions, build configuration, and user-facing docs. The supplemental documentation-truth audit also covered the Phase 11 planning records and `.planning/{PROJECT,BACKLOG,REQUIREMENTS}.md` plus `.planning/codebase/ARCHITECTURE.md`; planning artifacts are excluded from the formal source-file count above.

The install-flow root has the intended five-operation planning boundary, the ledger and planning modules have no runtime import cycle, `restoreDeferredPin` is a private composition collaborator rather than a request option, marketplace-add consumers handle `unchanged`, the lock/proxy helpers preserve their owner assertions, the large-file exception is exact, and the focused no-test-only-production-surface gate passes. Fallow review, guard, security, and symbol-impact checks found no structural violation. CodeGraph was attempted first but could not open its database.

Three issues remain: the consolidated disabled-holder filter changed which persisted-state key is authoritative, and two documents that Phase 11 claims match the shipped tree still describe obsolete contracts.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Shared disabled-holder filtering no longer preserves declaration-index keys

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:552-563`
**Related call site:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1615-1620`
**Issue:** `buildScopeDeclarationIndex` keys holders as `${plugin}@${record.name}` (lines 470-486), and the old standalone-disable filter used each returned candidate's exact `key`. The Phase 11 consolidation now passes that index through `withoutDisabledHolders`, which reconstructs disabled keys from the outer `state.marketplaces` entry name (lines 557-560). The persisted schema independently accepts any map key and a `MarketplaceRecord.name` string (`persistence/state-io.ts:284-320`); it does not enforce equality. For a schema-valid record stored under `alias` with `name: "tools"`, the index contains `formatter@tools`, while the disabled set contains `formatter@alias`. A user-disabled holder is therefore left in the index and a standalone disable can incorrectly fail with `{dependents remain}`. This also violates Plan 11-02's explicit requirement to preserve state-key lookup semantics at the persisted-state trust boundary.

**Fix:** Filter by the exact indexed candidates as before, or make the shared helper consume the indexed candidates/marketplace record names rather than reconstructing keys from the outer map. Add a regression whose outer marketplace key differs from `record.name` and assert that a user-disabled holder does not block the operation while a `dependencyDisabled` holder still does.

### WR-02: Architecture documentation still describes the pre-split install flow

**Classification:** WARNING
**File:** `.planning/codebase/ARCHITECTURE.md:83`
**Related lines:** `.planning/codebase/ARCHITECTURE.md:101,154-155`
**Issue:** Phase 11's CLN-03 closure says architecture documentation matches the shipped behavior, but the install-flow description still says `install-flow.ts` binds `REAL_INSTALL_TRANSACTION`, the request path still names `createNodeInstallPlugin`, and the module inventory omits `install-flow-planning.ts` and `install-flow-ledger.ts`. `REAL_INSTALL_TRANSACTION` now exists only in the test fixture; production exports `createInstallPlugin`, and the 82-line root binds five ledger operations into `createInstallPlanning`. The document therefore sends maintainers to nonexistent production symbols and conceals the new ownership boundary that this phase was specifically created to establish.

**Fix:** Rewrite the install-flow characteristic, orchestrator inventory, and primary request path around the current three-module structure: `install-flow.ts` as the public composition root, `install-flow-planning.ts` as the planning owner with its private five-operation port, and `install-flow-ledger.ts` as the transaction/ledger owner. Use the current `createInstallPlugin` and private `installPluginWithTransaction` names.

### WR-03: The refreshed PRD publishes obsolete dependency and quality contracts

**Classification:** WARNING
**File:** `docs/prd/pi-claude-marketplace-prd.md:1050-1055`
**Issue:** The Phase 11 documentation pass refreshed this NFR table, but NFR-6 still defines `npm run check` as only typecheck, ESLint, Prettier, and tests, omitting Fallow and the direct-coverage/pairing gates. NFR-11 still claims an unpinned `@mariozechner/pi-coding-agent` peer (`*`) and development dependency `^0.70.6`. The shipped package and current project contract use `@earendil-works/pi-coding-agent` with peer `>=1.0.0` and dev `^1.0.0`, and the quality bar includes Fallow, source/test pairing, and 100% direct coverage. These are normative NFR rows, so the stale text can produce incorrect compatibility and release decisions.

**Fix:** Align NFR-6 with the current `npm run check` contract and replace NFR-11 with the current package name and version floors. Remove the now-satisfied recommendation to add a minimum peer version.

---

_Reviewed: 2026-10-28T09:07:43Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

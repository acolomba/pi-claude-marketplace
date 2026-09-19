---
phase: 03-reachable-agent-collision-contract
reviewed: 2026-09-14T15:14:41Z
depth: standard
diff_base: 08fe8e65
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/discover.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - docs/prd/pi-claude-marketplace-prd.md
  - scripts/test-coverage-direct.pin.json
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/discover.test.ts
  - tests/bridges/agents/stage.test.ts
  - tests/domain/name.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
original_findings: {critical: 1, warning: 0, info: 0, total: 1}
status: clean
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-14T15:14:41Z
**Depth:** standard, including lifecycle and persistence call-chain checks
**Files Reviewed:** 16
**Status:** clean; original finding retained below with its resolved disposition

## Summary

Reviewed the scoped working-tree changes against 08fe8e65: exact source identities, discovery's duplicate winner and diagnostics, ownership checks, legacy update/reinstall migration, and corresponding test and contract changes. The new destination guard introduces a reproducible recovery failure after index persistence fails. No additional concrete security or test-reliability defect was established.

## Narrative Findings (AI reviewer)

### CR-01: BLOCKER — Failed index persistence makes migrated agent names unrecoverable

**File:** `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/bridges/agents/stage.ts:339-345`
**Related lines:** `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/bridges/agents/stage.ts:374-415`
**Classification:** BLOCKER
**Issue:** The new occupied-destination guard accepts only paths present in the previous safe index entries. Commit then deletes old targets, installs the new full-source targets, and saves the new index outside the completed-renames rollback block. If that final write fails, the old index remains but the old target is gone and the newly generated target remains unindexed. Both retry and forced reinstall reject that target as non-previous content. A transient disk/permission failure therefore requires manual file removal, violating the retry recovery contract.

**Reproduction:** A hermetic, unsandboxed public-API probe seeded source `acme-reviewer` with its legacy indexed name `pi-claude-marketplace-acme-reviewer`. After `prepareStagePluginAgents`, it temporarily made `locations.extensionRoot` mode 0500 while leaving the sibling agents directory writable. `commitPreparedAgents` failed with EACCES opening the temporary agents-index file. After restoring mode 0700:

- The agents directory contained only `pi-claude-marketplace-acme-acme-reviewer.md`.
- The index retained the complete original legacy bytes.
- A fresh prepare/commit failed with `Cannot replace agent target with non-previous content`.
- A fresh prepare/replace with `force: true` failed with the same diagnostic.

The probe restored permissions and removed its temporary tree. No repository source was changed.

**Fix:** Include `saveAgentsIndex` in the existing try/catch that tracks completed renames, so a save failure reverses every newly installed target and cleans staging. Keep the old index and the current commit-path contract that permits missing old files until retry; a full backup transaction is not necessary for this fix. Do not weaken rejection of genuinely unowned destinations. Add a public prepare/commit regression for index-write failure after migration, then successful retry and reinstall; include coexistence where a new source reuses the legacy name.

**Disposition:** Repaired and independently re-probed on 2026-09-14. The index save now runs inside the existing completed-renames rollback block. Repeating the real EACCES reproduction leaves no newly claimed targets and preserves the old index bytes. Both fresh prepare/commit and fresh prepare/replace now recover successfully. The added four direct tests cover migration/coexistence crossed with commit/replacement recovery and assert complete failure state, final bytes, and index records. The parent reports those four tests passing and direct stage coverage at 638/638 lines, 26/26 functions, and 113/113 branches. The original BLOCKER remains recorded for audit history; no unresolved narrative finding remains after this focused re-review. Full post-repair gates passed; see the final verification record below.

## Validation Evidence and Limits

Independent review used CodeGraph before source exploration and applied the TypeScript style and unit-testing review skills. Changed assertions were checked for weakened whole-value, byte, ownership, and side-effect claims. Removing the obsolete collision helper's direct tests follows removal of its unreachable production export; the reachable discovery cases exercise the replacement contract.

The parent reported the pre-repair integrated suite passing 6160/6160 tests with 227 production records at 63369/63369 lines, 1851/1851 functions, and 9144/9144 branches (`/tmp/test-backlog-phase34-unit-green.log`, `coverage/unit.lcov`). Typecheck passed (`/tmp/test-backlog-phase34-typecheck.log`). The full lint pass initially reported 16 auto-fixable style errors; the parent applied the targeted fixes successfully. These results predate review repairs and do not resolve CR-01. The full post-repair quality gate and phase verification remain pending.

The review excluded unrelated local settings, CONTRIBUTING.md, and root planning changes. No structural pre-pass or external-review evidence was supplied. No commits or source edits were made by this reviewer.

## Final verification

The original blocker was repaired and independently reproduced successfully. Current unresolved findings: zero. Commit `b663bc68`; goal verification 18/18.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.

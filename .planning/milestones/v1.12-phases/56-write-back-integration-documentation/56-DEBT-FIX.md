---
phase: 56-write-back-integration-documentation
fixed_at: 2026-06-11T12:10:00Z
review_path: .planning/v1.12-MILESTONE-AUDIT.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 56: Milestone Tech-Debt Fix Report

**Fixed at:** 2026-06-11T12:10:00Z
**Source review:** .planning/v1.12-MILESTONE-AUDIT.md (v1.12 milestone audit, `tech_debt` register)
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (explicit scope: the two named v1.12 tech-debt items)
- Fixed: 2
- Skipped: 0
- Incidental baseline repair: 1 (pre-existing lint error blocking the repo-wide
  `npm lint` pre-commit hook; see below)

`npm run check` is GREEN after all fixes: typecheck + ESLint + Prettier +
**1804 unit tests** (v1.12 baseline 1801 + 3 new regression tests) +
**10 integration tests**, exit code 0 verified directly (not through a pipe).
TruffleHog scanned the final history clean from the main repo
(`GIT_LFS_SKIP_SMUDGE=1` was required -- see Notes).

## Fixed Issues

### DEBT-01: Preview pre-migration window renders misleading mass-uninstall plan

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts`,
`tests/orchestrators/reconcile/preview.test.ts`
**Commit:** 721ca9d
**Applied fix:** `/claude:plugin preview` run when `claude-plugins.json` is
absent but `state.json` is populated planned against an absent-as-empty merged
view, rendering `(will uninstall)` / `(will remove)` rows for everything
recorded. The apply path migrates first inside its lock
(`apply.ts::readPassForScope` step 1), so the real next-load reconcile is a
no-op -- DIFF-01 requires preview to show exactly that. A new
`mergedViewForPlanning(outcome, state)` helper now plans against the PURE
`buildConfigFromState(state)` projection (from `persistence/migrate-config.ts`
-- no write, no migration side effect) merged with the local arm via
`mergeScopeConfigs` whenever the base config status is `absent`; otherwise the
loader's merged view is used unchanged.

Invariants preserved and verified:

- Pristine case unchanged: empty state projects an empty config, so the
  byte-locked empty advisory (`Preview: next reload will apply 0 actions.`)
  still fires; no catalog or catalog-uat fixture change needed (verified --
  the existing byte form is reused).
- CFG-03 arm unchanged: an `invalid` base/local still aborts with the
  `(failed) {invalid manifest}` row before the projection is reached.
- Purity gates GREEN: `no-orchestrator-network` FORBIDDEN_TARGETS grep-gate
  and the preview no-write tests pass (`buildConfigFromState` is pure; the
  projection performs no I/O).
- Convergence is the already-proven planner-level identity
  (`tests/orchestrators/reconcile/plan-convergence.test.ts`):
  `planReconcile(merge(buildConfigFromState(state), local), state, scope)` is
  the post-migration merged view byte-for-byte.

Regression tests added (3):

1. Absent config + populated state -> EMPTY advisory (info severity), not a
   mass-uninstall plan.
2. Run twice -> byte-identical notify args, NO `claude-plugins.json` created,
   `state.json` bytes + mtime untouched (read-only proof). The state fixture
   is fully modern so `loadState` fires no background legacy-migration persist
   that could race the mtime assertions.
3. Absent base + populated state + local-only marketplace entry -> `(will
   add)` row for the local entry, still no uninstall rows (the local arm
   merges over the projection exactly as it merges over the migrated file).

Note: the first cut used an inline nested ternary; ESLint
(`sonarjs/cognitive-complexity` 17 > 15 and `sonarjs/no-nested-conditional`)
forced the extraction into the named helper before commit -- the committed
form never had the violations.

### DEBT-02: docs/messaging-style-guide.md stale closed-set counts

**Files modified:** `docs/messaging-style-guide.md`
**Commit:** 0b68bee
**Applied fix:** Corrected every stale count/list against the current tuples
in `extensions/pi-claude-marketplace/shared/notify.ts` (the
`tests/architecture/notify-types.test.ts` length-locks are the authoritative
ground truth: `PLUGIN_STATUSES` locked at 16, `MARKETPLACE_STATUSES` at 9,
`STATUS_TOKENS` at 22, `DEPENDENCIES` at 2):

- `PluginNotificationMessage`: 11 -> 16 variants; the union listing in the
  guide now enumerates all 16 (adds the 4 DIFF-02 `will *` preview variants
  and the ENBL-04 `disabled` inventory variant) in source order.
- `PluginStatus`: 11 -> 16 literal strings; `MarketplaceStatus`: 7 -> 9
  (noting `will add` / `will remove` as the DIFF-02 preview tokens).
- `reasons` carve-out: "the other 5 variants omit" -> "the other 11".
- `dependencies` carve-out: REQUIRED set corrected to
  `installed | updated | reinstalled | present` (the guide's own union
  listing already showed `present` carrying required dependencies -- the
  prose contradicted it); "other 7" -> "other 12"; "those 3 switch arms" ->
  "those 4".
- `version?` discipline: now also names the 4 `will *` variants as
  version-less (pre-transition rows carry no recorded version).
- Benign skip closed set (severity ladder arm 3): 4 -> 6 members, adding
  `already enabled` / `already disabled` (matches `BENIGN_REASONS` in
  notify.ts).
- Reload-hint trigger: the guide's claim that marketplace statuses
  `{added, removed, updated}` trigger the trailer was factually wrong against
  the current renderer (`shouldEmitReloadHint`, SNM-33: plugin-row-driven
  ONLY). Corrected to the SNM-33 rule, including the clean-`marketplace
  remove` explanation (trailer arrives via per-unstaged-plugin `uninstalled`
  rows).

No byte-locked example output changed; `docs/output-catalog.md` and the
catalog-uat fixtures are untouched (verified: REASONS membership and all
rendered examples in the guide remain accurate against the renderer).

## Incidental Baseline Repair

### Pre-existing lint error blocking all commits

**Files modified:** `tests/orchestrators/import/execute.test.ts`
**Commit:** ca7a261
**Reason:** The branch tip (ca46084) carried a pre-existing `import-x/order`
error (`node:fs` must sort before `node:fs/promises`), reproducible in the
main repo before any of this session's changes. Because the repo's `npm lint`
pre-commit hook runs `eslint .` repo-wide, NO commit could land until it was
fixed, and `npm run check` was red at baseline (contradicting the audit's
recorded GREEN -- the error likely landed after the audit's check run).
Two-line import swap; no behavior change; committed first so the two in-scope
fixes could each pass hooks cleanly.

## Skipped Issues

None.

## Notes

- All work was done in an isolated worktree
  (`.worktrees/sv-56-reviewfix-7NyNAw`, temp branch `gsd-reviewfix/56-465819`)
  with the documented `SKIP=trufflehog` worktree commit policy;
  `features/v1.12-config-files` was fast-forwarded `ca46084 -> 0b68bee`, the
  worktree and temp branch were removed, and the recovery sentinel was
  dropped only after worktree removal succeeded.
- TruffleHog's standalone scan from the main repo initially failed with a
  git-lfs smudge error (`demos/bootstrap.gif` LFS object
  `21a5ff78...` missing from local LFS storage -- the working-tree file is a
  132-byte pointer). This is a pre-existing local-environment issue unrelated
  to these commits (none touch LFS files). `GIT_LFS_SKIP_SMUDGE=1 pre-commit
  run trufflehog --all-files` scans the same git history and passed clean on
  the final tip.

---

_Fixed: 2026-06-11T12:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

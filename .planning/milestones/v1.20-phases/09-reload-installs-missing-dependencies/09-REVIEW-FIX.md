---
phase: 09-reload-installs-missing-dependencies
fixed_at: 2026-09-22T10:40:00Z
review_path: .planning/phases/09-reload-installs-missing-dependencies/09-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-09-22T10:40:00Z
**Source review:** .planning/phases/09-reload-installs-missing-dependencies/09-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 2 (WR-01, WR-02 -- Critical + Warning per fix_scope; the 9 Info findings stay recorded and out of scope, except the IN-09 doc/JSDoc sentences folded into WR-01's commit)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: The degradation-signal derivation is now duplicated across two ledger-root projections (structural)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/shared/notify-reasons.ts`, `docs/output-catalog.md`, `scripts/check-unused-type-members.contracts.json`, `tests/orchestrators/plugin/install-outcome.test.ts`
**Commit:** f9172700
**Applied fix:** This is the one restructure pass on the seam. `install-outcome.ts` gains one exported `ledgerDegradationSignals(summary): Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds">` that owns the `Set`-of-`frontmatterDegradations[].kind` plus `resolved.orphanRewake === true` derivation; `installedPluginOutcome` spreads it in place of its two inline spreads, and `installMissingDependencyWithTransaction` (`install-flow.ts`) spreads `ledgerDegradationSignals(outcome.root)` in place of its hand-copied fold. `InstallMissingDependencyOutcome`'s `installed` arm is now `{ status; members; postCommitWarnings? } & Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds">` -- the same picked pair `PluginInstalledOutcome` carries -- rather than re-declared optional fields (the orphaned `DegradeKind` import was removed). In `apply.ts`, a module-local `installedRowDegradation(result)` (placed beside `degradationFromEnable`) now feeds both the config-driven `applyPluginInstalls` arm and the reload arm's root-member row (`...(member.key === rootKey && installedRowDegradation(result))`), replacing the two hand-copied spread lists. Deviation from the review's sketch: the reviewer proposed `Pick<EnableDegradationSignals, ...>` in `install-outcome.ts`; the plugin-side owner of the shape is `LedgerDegradationSignals` in `plugin/shared.ts` (of which `EnableDegradationSignals` is an alias), and `install-outcome.ts` cannot import from `enable-disable.ts` without closing the IN-07 / D-98-01 module cycle, so the plugin-side name is used there and in `install-flow.ts`; `apply.ts` keeps the reconcile-side alias its file already imports. Row bytes are unchanged: the iteration-1 apply cases (`{dependency installed, orphan rewake}` at `info`, `{dependency installed, dependency current copy}`, `{dependency installed, malformed skill}` at `warning`) pass without edits. The paired `install-outcome.test.ts` pins the new export directly (`{}` for a clean summary; `{ degradedKinds: ["skill", "command"], orphanRewake: true }` for the rich one) inside the existing projection case. Ten `contracts.json` pins were remapped for pure line shifts (`install-outcome.ts` +1, `apply.ts` -14, `install-flow.ts` +4 / +2), columns kept. IN-09 fold (one sentence each): the catalog paragraph names the tokens the root member's row and a current-copy member's row can carry; the `applyDependencyInstalls` JSDoc says the root ledger run's signals ride the root member and `dependencyCurrentCopy` rides any member; the `REASONS` enrollment note reads "rides only an `installed` row". The catalog byte pin is over fenced outputs only, so it did not move.

### WR-02: `WR-01` / `WR-02` comment and test-title anchors collide with pre-existing findings of the same ID in the same files

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `tests/orchestrators/reconcile/notify.test.ts`
**Commit:** 3a2b8f5f (the `install-flow.ts:2007, 2194` and `apply.ts:741` anchors the finding also lists were rewritten as part of WR-01's restructure in f9172700 and carry `SURF-05 / WARN-01` there)
**Applied fix:** Dropped the `WR-01:` / `WR-02:` prefixes and kept the durable IDs already on the same lines: `apply.ts` current-copy spread -> `TAGS-02:`; `apply-outcomes.ts` `dependencyCurrentCopy` JSDoc -> `TAGS-02:`; `notify.ts` ordering note -> `TAGS-02:`; `apply.test.ts` malformed-skill assert comment -> `WARN-01:` and the two case titles -> `SURF-05:` (orphan rewake) / `TAGS-02:` (current copy); `install-flow.test.ts` orphan-rewake case -> `SURF-05:`; `notify.test.ts` current-copy case -> `TAGS-02:`. Text-only, no line counts moved, so no `contracts.json` pins changed. The pre-existing `WR-01` (per-scope isolation) and `WR-02` (non-fatal post-save mutations, removed-marketplace exclusion) anchors are untouched.

## Skipped Issues

None -- both in-scope findings were fixed.

## Verification

All gates ran in the main checkout at `/home/acolomba/src/pi-claude-marketplace-manifest` on `features/manifest` (sequential mode, no worktree, per the orchestrator's working_rules), before each commit:

- `npm run typecheck` -- clean (exit 0)
- `npx eslint <changed files> --max-warnings=0` -- clean; `npx prettier --check` on the same files -- clean
- `npx fallow health --fail-on-issues` -- exit 0 (0 above threshold, maintainability 91.7)
- `npm run lint:type-members` -- passed with the 5 pre-existing recorded exceptions (10 pins remapped in WR-01 for line shifts; none in WR-02)
- `node --test` on every paired test file touched (`install-outcome.test.ts`, `install-flow.test.ts`, `apply.test.ts`, `apply-outcomes.test.ts`, `notify.test.ts`) plus `notify-closed-set-locks`, `notify-stamp-coverage`, `catalog-contract`, `catalog-parser`, `partial-vocabulary-guard`, and `tests/shared/notify-reasons.test.ts` -- WR-01 run 378/378, WR-02 run 508/508, 0 failures
- `npm run test:coverage:direct:commit` -- 100% direct branch/line/function coverage on every changed production module (`install-outcome.ts` 121/121 branches, `install-flow.ts` 182/182, `apply.ts` 180/180, `apply-outcomes.ts` 40/40, `notify.ts` 142/142); zero pins added
- `SKIP=trufflehog pre-commit run --files <changed files>` in the foreground before each commit -- every hook relevant to the changed files passed; the one `Failed` hook (`npm-format-check`) is solely the pre-existing, unrelated `.planning/config.json` modification that was on the working tree before this fixer started and was never staged or touched (same as iteration 1)

Nothing was staged beyond the explicit paths in each commit; the pre-existing unrelated modifications (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`, untracked `.mcp.json`, `.planning/milestone.lock`, and the `09-REVIEW*.iter2.md` files) remain untouched on the working tree.

## Prior iteration (iteration 1, fixed 2026-09-22T09:37:23Z)

Source review: `09-REVIEW.iter2.md` (the iteration-1 report). Findings in scope: 3; fixed: 3; skipped: 0.

### WR-01 (iteration 1): The reload install row silently drops the root's WARN-01 degradation signals

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** d2ad4161 (combined with iteration-1 WR-02)
**Applied fix:** `InstallMissingDependencyOutcome`'s `installed` arm gained optional `orphanRewake?: true` and `degradedKinds?: readonly DegradeKind[]`, populated at the return site in `installMissingDependencyWithTransaction` using the same derivation `installedPluginOutcome` runs for a config-driven install's root ledger summary. `apply.ts`'s `applyDependencyInstalls` loop spread both signals onto the root member's row, gated on `member.key === rootKey` exactly as the existing `postCommitWarnings` spread is. The malformed-skill reload test was updated to assert `secrets-vault v1.0.0 (installed) {dependency installed, malformed skill}` at `warning`, and two orphan-rewake cases were added (`install-flow.test.ts` unit-level; `apply.test.ts` reconcile-level, full rendered row at `info`). Iteration 2's WR-01 replaced this duplicated derivation with the shared helper.

### WR-02 (iteration 1): `fellBackToCurrentCopy` is a REQUIRED member fact the reload row never reports

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/orchestrators/reconcile/notify.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** d2ad4161 (combined with iteration-1 WR-01)
**Applied fix:** Added optional `dependencyCurrentCopy?: true` to `PluginInstalledOutcome` (omitted when false, NREG-01), set from `member.fellBackToCurrentCopy` for every member in `apply.ts`'s member loop, and pushed `"dependency current copy"` right after `"dependency installed"` in `notify.ts`'s `installedRowFromOutcome`. No `REASONS` closed-set amendment was needed. Added a `notify.test.ts` ordering case and an `apply.test.ts` reload-level case built on the real, uninjected TAGS-02 fallback (a same-marketplace dependency with a genuine `^1.0.0` range whose marketplace root carries no `.git`), since `ApplyReconcileOptions` exposes no `marketplaceTagProbe` seam.

### WR-03 (iteration 1): `buildInstallLedgerOptions` lost its JSDoc to the inserted type alias

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:252-293`
**Commit:** 9ad0d9a3
**Applied fix:** Moved the `InstallLedgerCallerOptions` type alias and its own short JSDoc above `buildInstallLedgerOptions`'s 30-line contract JSDoc -- a pure reorder (net zero line-count change).

**Iteration-1 commit grouping note:** WR-01 and WR-02 landed in one combined commit (`d2ad4161`) because both modify the same `applyDependencyInstalls` member-push loop and the same reload fixtures, and a git-hunk-level split was blocked by the sandbox's classifier on `git checkout HEAD -- <files>`. WR-03 was isolated into its own commit (`9ad0d9a3`).

**Iteration-1 verification:** run in the main checkout (sequential mode, no worktree): `npx tsc --noEmit` clean; `npx eslint <changed files> --max-warnings=0` clean; `npx fallow health --fail-on-issues` exit 0; `npm run lint:type-members` passed (6 pins remapped); `node --test` on the paired and architecture tests 453/453; `npm run test:coverage:direct:commit` 100% on every changed production module with zero pins; `SKIP=trufflehog pre-commit run --files <changed files>` passed except the pre-existing `.planning/config.json` format drift.

---

_Fixed: 2026-09-22T10:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

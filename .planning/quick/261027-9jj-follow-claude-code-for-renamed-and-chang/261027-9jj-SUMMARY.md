---
phase: quick-261027-9jj
plan: 01
quick_id: 261027-9jj
status: complete
subsystem: import
tags: [import, marketplace, upstream-parity, D-PL6-17, D-PL6-18, D-PL6-19]
requirements: [MIM-01, MIM-02]
dependency_graph:
  requires: []
  provides:
    - "import reuses a settings marketplace whose source the scope holds under another name (D-PL6-17, D-PL6-18)"
    - "addMarketplace replaceRecorded: in-place replace of a recorded marketplace inside the add's one state lock"
    - "import re-adds an extraKnownMarketplaces entry from its new source, or keeps the record (D-PL6-19)"
    - "PlannedMarketplaceSource.sourceIsFallback for the official marketplace"
  affects:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
tech-stack:
  added: []
  patterns:
    - "set-aside-and-restore of a replaced clone inside one state transaction"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
    - extensions/pi-claude-marketplace/orchestrators/import/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - test/orchestrators/import/execute.test.ts
    - test/orchestrators/import/marketplaces.test.ts
    - test/orchestrators/import/types.test.ts
    - test/orchestrators/reconcile/plan.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - features/plugin/import.feature
key-decisions:
  - "D-PL6-17: a settings marketplace whose source the scope records under another name is reused silently (no add, no clone, no row of its own); each p@<settings name> fails with install's marketplace-absent cause and nothing is installed or declared for it."
  - "D-PL6-18: the reuse holds even when the settings also declare the recorded name."
  - "D-PL6-19: an extraKnownMarketplaces entry whose name the scope records with a different source is added again in place from the new source; record and clone are replaced, installed plugins kept, a non-path old clone removed; a declared path that does not exist keeps the entry; forceRemoveDeletedPlugins is not ported."
metrics:
  duration: "about 45 minutes"
  completed: 2026-10-27
actuals:
  tokens: 34954
  tasks: 3
  commits: 3
plan_head_before: 7240921ace06fbb16adc71df84d2414410d0906d
plan_head_after: 29d31b2b37f7bdb2b131f703bc948ee7f68b088b
---

# Quick 261027-9jj: Follow Claude Code for a renamed or re-sourced settings marketplace in import

Import now treats a Claude settings marketplace like Claude Code 2.1.310 does. If the scope already holds the same source under another name, import reuses it silently, and each enabled plugin fails as not added. If the scope holds the same name with a different source, import adds the marketplace again in place from the new source and keeps its installed plugins. Import keeps the record when the new directory is missing or another record already holds the new source.

## Commits

| Task | Commit | Message | Hook (`npm run check:commit`) |
|------|--------|---------|-------------------------------|
| 1 | 3954e584 | fix(import): reuse a marketplace the scope holds under another name | Passed (first attempt failed: one stale `@ts-expect-error` in types.test.ts, and `buildImportNotificationMarketplaces` cognitive 17; both fixed, then Passed) |
| 2 | 217ea670 | feat(marketplace): let an add replace a recorded marketplace in place | Passed (first attempt failed: fallow private-type-leak on `addMarketplaceToState`'s signature; fixed by inlining the types, then Passed) |
| 3 | 29d31b2b | feat(import): add a settings marketplace again from its new source | Passed |

Base commit: 7240921a.

## Decision rows

Rows for the Key Decisions table of `.planning/PROJECT.md` (`| Decision | Rationale | Outcome |`):

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| D-PL6-17: A settings marketplace whose source the scope records under another name is reused silently: no add, no clone, no row of its own. Each `p@<settings name>` fails with install's marketplace-absent cause `Marketplace "<name>" is not added in the <scope> scope.`, and nothing is installed or declared for it. A conflicted claim reads the same way. **Reverses D-PL6-02 and D-PL6-10's alias rewrite.** | Upstream `Lle`: "Source already materialized as '<name>', skipping clone"; an enabled plugin of the unrecorded name then gets the E2 plugin `marketplace-not-found` error. | ✓ Good |
| D-PL6-18: The D-PL6-17 reuse holds even when the settings also declare the recorded name (in `extraKnownMarketplaces` or through an enabled plugin). **Reverses the WR-01 review fix.** | `Lle` checks the source against every known marketplace before it reads any name. | ✓ Good |
| D-PL6-19: An `extraKnownMarketplaces` entry, referenced or not, whose name the scope records with a different source is added again in place from the new source. The record and clone are replaced, installed plugins are kept for the next `pending`/`apply` to converge, and the old clone is removed unless the old source was a path. A declared path that does not exist keeps the entry. `forceRemoveDeletedPlugins` is not ported. **Reverses D-PL6-09.** | Upstream E3: `W7r` sorts the name into `sourceChanged`; `CRn` maps it to an update and skips a declared path that does not exist ("keeping materialized entry"); `Lle` overwrites the entry ("exists with different source — overwriting") and deletes the old clone unless the old source is a path. | ✓ Good |

All three Outcomes are `✓ Good`: every changed or new scenario passed, `npm run check` exited 0, and the full cucumber suite passed (917/917).

## RED evidence

**Task 1** (unchanged source at 7240921a, scenarios run with `npx cucumber-js features/plugin/import.feature --name '<title>'`):

- (a) "…name a known marketplace under another name fails its plugin as not added": exit 1, 1 failed (AssertionError on the fields table).
- (b) "…by its recorded name keeps the name the config uses for it": exit 0, 1 passed. It is a guard for the CR-01 naming that this task keeps.
- (c) "…also declare the recorded name … fails the other name's plugin as not added": exit 1, 1 failed.
- (d) "…two settings marketplaces … reuses it with no row": exit 1, 1 failed.
- Units (4 suites against the unchanged source): 19 failed of 176. These were the 7 new D-PL6-17/D-PL6-18 cases and the 12 marketplaces.test.ts expectations that no longer list `settingsMarketplaces`. The CR-01 cases passed, as guards.

**Task 2** (Task 1 tree): 6 of the 7 first `D-PL6-19` add.test.ts cases failed. The "record gone, plain add" case passes at runtime, because an unknown option is ignored, but it fails typecheck on the unknown `replaceRecorded` option. Two more cases came after GREEN to close direct coverage: a path-source manifest that names another marketplace, and a post-save set-aside cleanup leak. Both depend on `replaceRecorded`.

**Task 3** (Task 2 tree):

- Scenarios (a) re-add from `fixtures-copy`, (b) missing `fixtures-moved`, and (c) source held by `tools` each exited 1 (1 failed). (a) failed on severity `error` against `info` and 2 failures. (b) and (c) failed on a `(failed) {source mismatch}` row against `(skipped) {already added}`.
- Units: 11 failed of 118. These were the 7 new D-PL6-19 execute cases and the 4 official-marketplace expectations in marketplaces.test.ts that now carry `sourceIsFallback: true`. The two IMP-05 official-marketplace cases passed, as guards.

## Verification gate

- Command: `{ npm run check > "$LOG" 2>&1; echo "CHECK_EXIT=$?" >> "$LOG"; }`, not piped.
- `CHECK_EXIT=0`. typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features, test:unpaired, test:integration, and test:coverage:direct:all all passed.
- Commit: 29d31b2b37f7bdb2b131f703bc948ee7f68b088b. `node --version`: v26.12.1. Scope: whole tree.
- Extra check: `npx cucumber-js` (whole suite) gave 917 scenarios passed and 9173 steps passed.
- Quick task 261027-9e2 had no uncommitted edits in the worktree during the gate. Only the untracked `.planning/quick/261027-9jj-*` and `.planning/quick/261027-ac6-*` directories were present.
- Scope fence: `git diff --name-only 7240921a..HEAD` lists exactly the eleven `files_modified` paths. `reconcile/apply.ts`, `reconcile/notify.ts`, `features/plugin/apply.feature`, and `features/lib/run-tokens.ts` are untouched.
- Done-gate greps:
  - `aliasedScopePlan|settingsMarketplaces|marketplaceClaimConflicts|MarketplaceClaimConflict` in extensions and test: 0.
  - `is not added in the` in execute.ts: 1.
  - In import.feature: `already exists in user scope` 0, `claimed by more than one` 0, `fixtures-copy` 3.
  - `D-PL6-02` in execute.ts, plan.ts, and types.ts: 0 each.
  - `D-PL6-09` in execute.ts: 0.
  - `replaceRecorded`: add.ts 3, execute.ts 3.
  - `sourceIsFallback` in extensions: 5.

## Deviations from Plan

1. **[Rule 3 - Blocking] The private claim-conflict interface in plan.ts is now named `DeclaredClaimConflict`.** The plan asked for two things that conflict. One was to restore the module-private conflict interface "to its shape before c93b005b", whose name then was `MarketplaceClaimConflict`. The other was the done gate requiring 0 hits for `MarketplaceClaimConflict`. I kept the pre-c93b005b shape and used the private name c93b005b had already introduced, `DeclaredClaimConflict`. Nothing exports it.
2. **[Rule 1 - Bug] The add's save-failure unwind also runs when only a replaced clone was set aside.** This happens when the new source is a path and the replaced one was github or url. Without it, a failed save would have left the old clone in `sources-staging/`. In that case `unwindUnsavedAdd` restores the clone even though there is no new clone to remove. For a plain path add, the error normalization stays as it was.
3. **Extra extractions to satisfy both complexity gates:** `marketplaceBlocks` (execute.ts; `buildImportNotificationMarketplaces` hit cognitive 17), and in add.ts `unwindUnsavedAdd`, `removeSetAsideClone`, `discardNewClone`, `setAsideReplacedClone`, and `restoreReplacedClone`.
4. **Two add.test.ts cases written after GREEN** for direct coverage (see Task 2 RED evidence).

## Divergences from reconcile

`pending`, `apply`, and the load still report a declared source change as `(failed) {source mismatch}` (`plan.ts::diffMarketplaces`, then `reconcile/notify.ts::applySourceMismatch`), and they never re-add. Reconcile still aliases a config name to a recorded marketplace through a one-to-one source claim. For settings, import now does neither: it re-adds a source change in place (D-PL6-19), and it never aliases a settings name to a record that holds its source (D-PL6-17). The only cross-name lookup import keeps is CR-01's post-pass naming, which keeps the config's own alias.

## Cross-phase items

The parent carries three items into Phase 10, because each one needs `reconcile/apply.ts` and `reconcile/notify.ts`:

- The official marketplace's `{source mismatch}` rows. Upstream treats the official marketplace planned for an enabled plugin as up to date (`W7r`: `sourceIsFallback`). Import now marks it with `sourceIsFallback` but still reports the mismatch.
- The post-pass that writes only the base layer. A local-layer declaration of the old source still wins the merged view, so the next load reports `{source mismatch}`.
- `apply` and the load re-adding a marketplace in place on a declared source change, as import now does under D-PL6-19.

## Backlog dispositions

- forceRemoveDeletedPlugins delisting enforcement: not honored anywhere; new backlog candidate.
- Follow-up candidate: `apply` could re-add a `sourceChanged` config marketplace as `CRn` does. Today it reports `{source mismatch}`.
- Follow-up candidate: the official marketplace could follow `sourceIsFallback` as up to date.

## Uncertain choices (for user review)

The parent session accepted planner choices 1-10 as planned.

1. **D-PL6-17 row.** The reused marketplace gets no row of its own. When the settings enable plugins from it, their failed rows sit under a `(failed)` block for the settings name, because a cascade row needs a block. The alternative was a `(skipped)` block, which would claim that the settings name is added.
2. **D-PL6-17 cause.** Each plugin row carries install's cause `Marketplace "<name>" is not added in the <scope> scope.` and no brace, because `ContentReason` excludes `{marketplace not added}`. The alternative was to also name the record that holds the source.
3. **D-PL6-17 skips the install call.** Import records the failure itself. So install's cross-scope fallback (D-MF-04) cannot install `p@<settings name>` from the other scope's marketplace of that name. Claude Code's marketplaces are unscoped, so there a marketplace of that name would answer.
4. **D-PL6-19 row.** The re-added marketplace reads `(added)`. The alternative was `(updated)`: upstream's reconciler counts it as updated, but `ImportBlockStatus` has no `updated`.
5. **D-PL6-19 when the new manifest names another marketplace.** The re-add fails closed as `invalid manifest` and restores the record and clone. Upstream would write the manifest's name beside the old entry.
6. **D-PL6-19 when the re-add fails.** Its plugins are blocked for this run, as after any failed add. Upstream's plugins would still resolve against the kept entry.
7. **D-PL6-19 keeps the record when the new source is recorded under another name**, because `Lle` checks the source before the name. This is planner-inferred parity: the user named only the missing-path case.
8. **Kept records and the repair.** A kept record reads `(skipped) {already added}`. When the config lacks the name, the existing repair declares the settings source, and the next `pending` shows `{source mismatch}`. Nothing is torn down. Two unit cases pin this: the missing directory and the source held under another name, each with no config file.
9. **The official marketplace keeps `{source mismatch}`.** It is unchanged, because the user's decisions cover `extraKnownMarketplaces` entries only. Upstream treats it as up to date (`W7r`: `sourceIsFallback`). This is a follow-up candidate, now in Cross-phase items.
10. **The post-pass writes only the base layer.** A local-layer declaration of the old source still wins the merged view, so the next load reports `{source mismatch}`. This is now in Cross-phase items.
11. **(Executor) The replace sets aside an old clone only when the replaced record's source is github or url and `sources/<name>/` exists.** A recorded github or url source with no clone on disk is replaced with nothing set aside.
12. **(Executor) A post-save failure to remove the set-aside clone is only `hookDebugLog`ged** (D-18-01 style), and the leftover stays under `sources-staging/`. Nothing sweeps `sources-staging/` later.
13. **(Executor) A double fault on the replace path is classified as `unparseable`.** This is a failed add plus a failed restore rename. It can wrap the error twice, and `unwrapAddError` unwraps only one level. The cause text still carries both leaks. A single fault classifies as usual.
14. **(Executor) `D-PL6-08` is cited for the now-unconditional plugin loop in `recordPlannedMismatch`'s `source-mismatch` arm.** Only the official marketplace reaches that arm, and D-PL6-08 plans the official marketplace only for an enabled plugin.

## Proposed CHANGELOG sub-bullet (for `06-06-SUMMARY.md`; not applied)

> - `/claude:plugin import` follows Claude Code for settings marketplaces the scope already knows. A marketplace whose source the scope already has under another name is reused: import adds nothing, and each plugin the settings enable from it fails as not added. A marketplace the scope has under the same name with a new source is added again from that source, and its installed plugins are kept. A new directory that does not exist, or a source another added marketplace already has, keeps the marketplace as it is.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Notes for the orchestrator

- `06-CONTEXT.md` does not list D-PL6-17, D-PL6-18, or D-PL6-19 yet.
- `06-VERIFICATION.md`'s `covered_digest` is stale.
- MIM-01 and MIM-02 still read true as written.
- This SUMMARY, STATE.md, and the PLAN.md are not committed. ROADMAP.md was not touched.

## Self-Check: PASSED

- All eleven modified files exist on disk.
- Commits 3954e584, 217ea670, and 29d31b2b are ancestors of HEAD.
- `git rev-list --count 7240921a..HEAD` = 3.

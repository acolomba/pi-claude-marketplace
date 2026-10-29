---
phase: 05-marketplace-command-parity
plan: 04
subsystem: marketplace
tags: [marketplace-add, reserved-names, cucumber, e2e]
status: complete

requires: []
provides:
  - "reservedMarketplaceNameRefusal(name, source) in domain/name.ts (19-name reserved set, anthropics github exemption)"
  - "OFFICIAL_MARKETPLACE_NAMES exported from domain/name.ts (moved from unsupported-components.ts)"
  - "ReservedMarketplaceNameError (module-local, extends InvalidMarketplaceManifestError) thrown from newMarketplaceName"
  - "features/marketplace/reserved-name.feature"
  - "publishAnthropicsMarketplace + step `the marketplace {string} is published by the anthropics organization`"
affects: [marketplace add, bootstrap, apply, import, install-time marketplace add, e2e]

actuals:
  tokens: 10100
  tasks: 2
  commits: 2
plan_head_before: 2f51d2a9796bee7ce028deb12aef666698982ff8
plan_head_after: b1be6bb8

tech-stack:
  added: []
  patterns:
    - "A refusal that needs Claude Code's sentence as its cause line takes failedAddRow's one-child row"

key-files:
  created:
    - features/marketplace/reserved-name.feature
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/domain/unsupported-components.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - test/domain/name.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/plugin/git-source.feature
    - features/plugin/install-dependencies.feature
    - features/plugin/update-dependencies.feature
    - features/plugin/apply.feature

key-decisions:
  - "MKT-01: the reserved-name check runs in newMarketplaceName after the __proto__ check and before MA-8, so every add caller refuses before any write"
  - "A hosted source gets the organization sentence by falling through the non-exhaustive kind check (github and url get the github.com sentence)"

requirements-completed: [MKT-01]

duration: ~75min
completed: 2026-10-27
---

# Phase 5 Plan 04: Reserved marketplace names Summary

`marketplace add` now refuses a manifest that declares one of Claude Code's 19 reserved marketplace names (compared lowercased) unless the source is a github repository of the `anthropics` owner. The failed row carries Claude Code's sentence for the source kind as its cause and the reason `invalid manifest`. The check runs before any state, config, or `sources/` write, and every add caller goes through it.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | 45f854a8 | feat(marketplace): refuse reserved official marketplace names |
| 2a | b1be6bb8 | test(plugin): publish the plugin directory under the anthropics owner |
| 2b | not committed (blocked, see below) | test(e2e): add the upstream checkout under a non-reserved name |

`git rev-list --count plan_head_before..HEAD` reports 6, because sibling plans 05-01..05-03 committed on the same branch in the same tree during this plan. This plan made 2 of them.

## Verification

- `node --test test/domain/name.test.ts test/domain/unsupported-components.test.ts test/orchestrators/marketplace/add.test.ts`: pass (312/312 at 45f854a8; name + add 287/287 again at b1be6bb8).
- Direct coverage (`scripts/test-coverage-direct.mjs`) for domain/name.ts, domain/unsupported-components.ts, and orchestrators/marketplace/add.ts: exit 0 (100%).
- `npm test`: 13206/13207 at 45f854a8. The one failure was `test/edge/completions/provider.test.ts`, which 05-01 was still updating at that point.
- Whole cucumber suite (`npm run test:cucumber`) with Task 2 applied: 912/912 scenarios pass, including reserved-name.feature, bootstrap.feature, and all eight migrated plugin-directory scenarios with their original Then tables.
- `npm run check:features`, `tsc --noEmit`, ESLint on every touched file, `fallow dupes`, and both `fallow dead-code` runs: clean.
- `npm run test:e2e` ran locally (github.com reachable). The upstream-checkout tests pass 14/14 with the rename (install-soft-deps, resources-discover, import-command, _targets). Four `peer floor` tests fail because `test/e2e/pi-peer-floor` has no installed dependencies in any checkout here ("run npm --prefix test/e2e/pi-peer-floor ci"). That is an environment gap unrelated to this plan.

## Blocked: the e2e rename commit

The e2e rename (test/e2e/_helpers.ts, _targets.ts, install-soft-deps.test.ts) is written and verified, but it is not committed. It is in the shared working tree as unstaged edits, with a backup in the scratchpad `05-04-bak/e2e/`. `_helpers.ts` counts as shared test support, so its commit hook runs every source-test pair. One pair fails at HEAD without this change:

- `test/orchestrators/marketplace/remove.test.ts` "retains the source clone when a forward-compatible recorded kind is unavailable" (05-02, 12e472fe) fails with `malformed source object`. The case's `Object.prototype.kind` getter answers `"unknown"` for the first 8 reads only. 05-03's 41a2747f added a `hosted` branch to `normalizeStoredSource` in persistence/state-io.ts, which reads `obj.kind` once more, so the 9th read answers `"future"` and the record is refused. The fix is in 05-02's test (raise the read budget from 8 to 9, or stop counting reads). Neither file belongs to this plan, so it is left for the orchestrator. After that fix, run: `git commit -F <msg> -- test/e2e/_helpers.ts test/e2e/_targets.ts test/e2e/install-soft-deps.test.ts`. The message is in the scratchpad as `msg-05-04-t2b.txt`.

Until that commit lands, the e2e suite path-adds an upstream checkout that declares `claude-plugins-official` and is refused (CI e2e job).

## Deviations from Plan

1. **[Rule 3] Feature title.** `npm run check:features` requires the title to match the file name. The plan's `Feature: Marketplace reserved names` in `reserved-name.feature` fails that check, so the title is `Feature: Marketplace reserved name` and the plan's file path is kept.
2. **[Rule 3] `newMarketplaceName`'s `source` parameter is `ParsedSource`.** Sonar's `use-type-alias` rejects a third copy of `GitHubSource | UrlSource | PathSource`. `ParsedSource` is the type the predicate takes.
3. **[Rule 3] github.com literal.** `local/no-github-literal` flags the Claude Code refusal sentence. It carries an `eslint-disable-next-line` with a GHB-02 reason ("user-facing reason text" is an allowed exception).
4. **[Rule 3] Shared step body.** The new step and the official-marketplace step formed a fallow clone group. Both now call one local `publishAnthropicsRepository(world, name, publish)`. `publishOfficialMarketplace` delegates to `publishAnthropicsMarketplace`, as the plan asked.
5. **[Rule 3] Where `E2E_MARKETPLACE_NAME` lives.** It is exported from `test/e2e/_targets.ts`, not `_helpers.ts`. `_helpers.ts` already imports `_targets.ts`, so an export from `_helpers.ts` that `_targets.ts` imports would form an import cycle (fallow's cycle gate). `_helpers.ts` imports and uses it (3 occurrences; acceptance asks for at least 2).
6. **`test/e2e/_targets.test.ts` unchanged.** It has no assertion on the marketplace name.
7. **Extra add.test.ts assertion.** The github refusal case asserts the scope tree is exactly `pi-claude-marketplace` plus an empty `sources-staging`: no `sources/` entry and no staged clone left.
8. **Process.** Sibling pre-commit hooks in the shared tree stashed and restored every unstaged edit, which twice reverted this plan's in-flight files and once rolled back a test file entirely. Edits and test runs therefore happened in a private detached worktree under the scratchpad, `wt-05-04` (node_modules symlinked). Files were copied into the shared tree only to commit, with pathspec commits after waiting for no other commit to be running. The private worktree is still registered; remove it with `git worktree remove --force <scratchpad>/wt-05-04`.

## Backlog

- MKTNAME-01 (D-PL5-03, T-05-06): look-alike/impersonation names, other spellings, `npm`/`pip`/`uv`/`cargo`/`github`/`gh`, the `claudeai-` prefix, the `<owner>-<repo>` folder rule, a refresh that renames a marketplace to a reserved name, and the load-time refusal of an already-registered reserved name are not implemented.

## Files outside the ROADMAP Files line

- `extensions/pi-claude-marketplace/domain/unsupported-components.ts`: imports the moved `OFFICIAL_MARKETPLACE_NAMES`, so one list serves both checks.
- `features/plugin/git-source.feature`, `install-dependencies.feature`, `update-dependencies.feature`, `apply.feature` (owned by Phases 2-4): one Given line per scenario (8 total), plus one `marketplace update` Given in the apply scenario at apply.feature ~1179, because `apply` plans offline from the stored catalog.
- `features/lib/published-marketplace.ts`, `features/step_definitions/marketplace/publishing.steps.ts`: fixture and step for the anthropics-owned publication.
- `test/e2e/_helpers.ts`, `test/e2e/_targets.ts`, `test/e2e/install-soft-deps.test.ts` (D-PL5-23, not yet committed, see above). `test/e2e/_targets.test.ts` needed no change.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-05 is mitigated as planned (reserved-name.feature, name.test.ts, add.test.ts); T-05-06 is deferred to MKTNAME-01.

## Self-Check: PASSED

- 45f854a8 and b1be6bb8 are ancestors of HEAD; features/marketplace/reserved-name.feature exists; `grep -c 'export function reservedMarketplaceNameRefusal' domain/name.ts` = 1; `class ReservedMarketplaceNameError extends InvalidMarketplaceManifestError` = 1; `"claude-tag-plugins"` is in name.ts only; 8 scenarios use `published by the anthropics organization` and 0 use the old dir-source line.
- Task 2's e2e half is not committed (blocked, see above).

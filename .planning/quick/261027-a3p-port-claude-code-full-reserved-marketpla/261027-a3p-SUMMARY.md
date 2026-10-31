---
phase: quick-261027-a3p
plan: 01
status: complete
subsystem: marketplace
tags: [marketplace, add, update, reconcile, reserved-name, parity, MKT-01, MKTNAME-01]
requires: [D-PL5-01, D-PL5-02, D-PL5-17, D-PL5-27, DLS-01, D-05-07, APL-D1]
provides:
  - "marketplace add refuses every reserved-name rule of Claude Code 2.1.310"
  - "marketplace update checks the record's own name before any request and the refreshed name against the look-alike and own-name rules"
  - "a recorded refused marketplace is reported on session start, plugin list, marketplace info, plugin info, and install; remove still works"
affects:
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
tech-stack:
  added: []
  patterns:
    - "one assert call right after each recorded-catalog read; the refusal stays out of the manifest reader and the D-05-07 walk"
    - "refused-marketplace session row reuses the DLS-01 plugin-declarer-unreadable shape"
key-files:
  created:
    - features/marketplace/refused-name.feature
    - features/lib/earlier-version-state.ts
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - features/marketplace/reserved-name.feature
    - features/marketplace/hosted-source-update.feature
    - features/step_definitions/marketplace/publishing.steps.ts
    - test/domain/name.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/marketplace/hosted-catalog.test.ts
    - test/orchestrators/marketplace/info.test.ts
    - test/orchestrators/plugin/list-flow.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/reconcile/delisted-plugins.test.ts
    - test/orchestrators/reconcile/read-pass.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/integration/reserved-record-keys.test.ts
    - .planning/phases/05-marketplace-command-parity/05-CONTEXT.md
decisions:
  - "D-PL5-28: full reserved-name parity with Claude Code 2.1.310 on add, update, and the load surfaces; reverses D-PL5-03; nine divergences recorded for user review"
metrics:
  completed: 2026-10-27
actuals:
  tokens: 43000
  tasks: 3
  commits: 4
plan_head_before: 903d1d86af64754400b5abead491e7086d8f4eb0
plan_head_after: 02839041a86f6c4b75f8d3f61e01228ca4cb1a4a
---

# Quick 261027-a3p: Claude Code's full reserved marketplace name rules Summary

`marketplace add` now refuses every marketplace name Claude Code 2.1.310 refuses. `marketplace update` checks the record's own name before it makes any request. A marketplace an earlier version recorded under a refused name is reported on every load until the user removes it. Recorded as D-PL5-28, which reverses D-PL5-03.

## What changed

### By rule (`domain/name.ts`)

| Rule | Upstream version | Add | Update | Load surfaces |
| --- | --- | --- | --- | --- |
| Exact reserved set (D-PL5-01) | 2.1.291 | unchanged | unchanged on the refreshed name (D-PL5-27); **new:** the record's own name before any fetch | **new:** the untrusted-source sentence |
| Look-alike (full `f4e`, strong `Ge`) | 2.1.282 | refused, no anthropics exemption; a D-PL5-17 repair is grandfathered | refused, grandfathered against the record name | refused, grandfathered; plugin-list wording |
| Claude Code's own names (`inline` ... `gh`) | 2.1.275 | refused in any case | refused | refused |
| `claudeai-` prefix | add only | refused, without the `--claudeai` remedy | -- | -- |
| Another spelling | 2.1.280 | refused | the record's own name, before any fetch | the record's own name |
| `Object.prototype` member | 2.1.296 | refused unless the scope already records the name | -- | -- |
| `<owner>-<repo>` folder | 2.1.290 | not ported (divergence b) | -- | -- |

Exports, each with a production caller in the commit that adds it: `addedMarketplaceNameRefusal` (add.ts), `catalogMarketplaceNameRefusal` (update.ts, hosted-catalog.ts), `assertRecordedMarketplaceName` (update.ts, then list-flow, both info modules, install-outcome), and `recordedMarketplaceNameRefusal` (delisted-plugins.ts). `reservedMarketplaceNameRefusal` is byte-for-byte unchanged. Every helper is module-private, so both complexity gates pass.

### By surface

- **`marketplace add`** (`newMarketplaceName`, so every add caller): one call after the `__proto__` check. Rows follow D-PL5-02: the failed add block, one child with `{invalid manifest}`, and Claude Code's sentence as the cause.
- **`marketplace update`** (`refreshRecord`): `assertRecordedMarketplaceName(name, source)` is the first statement inside the try. A refused record makes no git, url, or hosted request. The refreshed name goes through `catalogMarketplaceNameRefusal(declared, recordName) ?? reservedMarketplaceNameRefusal(declared, source)`. `refreshHostedCatalog` takes the record `name` and refuses before the rename, so a refused hosted catalog stays byte-identical. Rows follow D-PL5-27.
- **Session start**: `reportRefusedMarketplaces` runs in `closeScopePass` after `reportUnreadableDeclarer` and before `reportDelistedPlugins`. It reports one `(failed) {invalid manifest}` warning row per enabled plugin, with the sentence as the cause, and the plugin keeps working. `loadedMarketplaces` is shared with the delisted check, so the two do not duplicate code.
- **`plugin list`**: the bare `(failed)` marketplace header (BOUND-01).
- **`marketplace info` / `plugin info`**: `(failed) {invalid manifest}`.
- **`plugin install`**: fails with the sentence as its cause. Enable re-materializes through the same ledger, so it fails the same way (see Deviations).
- **`marketplace remove` / `uninstall`**: untouched. The guard scenario proves that remove still removes a refused record.

## Commits

| Hash | Title |
| --- | --- |
| bc8a536d | feat(marketplace): refuse every name Claude Code reserves on add |
| de90dc7a | feat(marketplace): recheck reserved names when a marketplace updates |
| 07cf9dfb | feat(marketplace): refuse a recorded reserved marketplace name on load |
| 02839041 | docs: record the full reserved-name parity decision |

Each commit staged its files by explicit pathspec and passed the hooks, including `npm run check:commit`.

## RED evidence (captured with the source change reverted, tests in place)

- **Task 1:**
  - `npx cucumber-js features/marketplace/reserved-name.feature`: 19 scenarios, 10 failed. The 9 new Outline rows (`claude-plugins-v2`, `claude-directory`, `npm`, `GitHub`, `skills-dir`, `claudeai-tools`, `claude.code.plugins`, `claude.plugin.directory`, `constructor`) and the anthropics look-alike scenario each failed at `the result has these fields:` with `severity info`, expected `error`, because the add reported `(added)`.
  - `test/domain/name.test.ts` failed to load: `does not provide an export named 'addedMarketplaceNameRefusal'`.
  - `add.test.ts`: the 5 `D-PL5-28: refuses a path marketplace whose manifest declares ...` cases failed.
  - `reserved-record-keys.test.ts`: `D-PL5-28: a reload whose config declares hello@constructor ...` failed.
- **Task 2:**
  - cucumber over `reserved-name`, `hosted-source-update`, and `refused-name`: 29 scenarios, 6 failed. They were the 4 update Outline rows (dir, file, url, and github each reported `updated`), the hosted look-alike scenario, and the legacy `claude-plugins-official` update scenario (the bare D-PL5-27 sentence, not the untrusted-source one).
  - `update.test.ts` `D-PL5-28`: 7 of 8 failed. The 4 pre-fetch kinds, the path look-alike, the github `uv` rename, and the soft-look-alike rename all failed. The grandfathered `claude-directory` that keeps its name passed before and after, as intended.
  - `hosted-catalog.test.ts`: the new look-alike case failed.
  - `name.test.ts`: `does not provide an export named 'assertRecordedMarketplaceName'`.
- **Task 3:**
  - `refused-name.feature`: 6 scenarios, 4 failed: session start, plugin list, marketplace info, and install. The remove guard passed before the change, by design. The Task 2 update scenario was already green.
  - Unit tests: 7 failures. Those were the list-flow, marketplace info, plugin info, install-outcome, and `closeScopePass` cases. `name.test.ts` and `delisted-plugins.test.ts` failed to import `recordedMarketplaceNameRefusal` / `reportRefusedMarketplaces`.

## Verification

- Owner tests: `name`, `add`, `update`, `hosted-catalog`, `list-flow`, marketplace `info`, plugin `info`, `install-outcome`, `delisted-plugins`, and `read-pass` all pass.
- Direct coverage, `npm run test:coverage:direct -- <sources>`: exit 0 for all 10 touched sources (100% each).
- Integration: `npm run test:integration` exit 0, including `reserved-record-keys.test.ts`.
- Cucumber:
  - `features/marketplace` plus `bootstrap`, `update-dependencies`, `install-dependencies`, `git-source`, and `apply`: 555/555 after Task 1.
  - The full suite `npx cucumber-js`: 961/961 after Task 3.
  - `npm run check:features`: exit 0.
- Whole unit suite: `npm test` exit 0 after the fixture fixes.
- **Full gate:** `npm run check` was run unpiped, with its output sent to a scratch log, and its status read with `status=$?`.
  - Exit status: **0**.
  - HEAD: `02839041a86f6c4b75f8d3f61e01228ca4cb1a4a`. Node: `v26.12.1`.
  - Scope: `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), `test:unpaired`, `test:integration`, `test:cucumber` (961 scenarios, 9487 steps), and `test:coverage:direct:all` (293 merged records).

## D-PL5-28 as committed (05-CONTEXT.md, Post-phase amendments)

The full text is in `.planning/phases/05-marketplace-command-parity/05-CONTEXT.md`, commit 02839041. Its sub-bullets are:

- rules and sentences;
- add, update, and recorded-marketplace surfaces;
- why remove and uninstall stay open;
- divergences (a) to (i) with their licenses;
- D-08-07 narrowed;
- the D-PL5-27 evidence note;
- evidence (RESEARCH, binary 2.1.310, docs, 2026-10-27).

Also appended:

- ` Reversed by D-PL5-28.` to D-PL5-03;
- ` Done by D-PL5-28, except what it lists as not ported.` to the deferred `MKTNAME-01` item;
- ` Reversed by D-PL5-28 (user decision 5.2).` to "Uncertain choices" item 2.

## Choices for user review

1. **(a)** The exact `anthropic-plugin-directory` from the anthropics organization stays addable and loadable. Upstream refuses it, because its built-in Anthropic Directory owns the name. The name's other spellings are refused.
2. **(b)** The `<owner>-<repo>` folder rule is not ported. It is not needed, because every checkout is `sources/<name>/`.
3. **(c)** The `claudeai-` sentence drops `(claude plugin marketplace add --claudeai <name>)`.
4. **(d)** Load surfaces use the add-time spelling sentence, not upstream's `known_marketplaces.json` sentence.
5. **(e)** One sentence per rule on every load surface. This is unlicensed for the exact-name case: upstream's plugin-list error reads `Marketplace <name> failed to load: <sentence>`, and Pi uses the getter's `registered from an untrusted source` sentence everywhere.
6. **(f)** Plugins of a refused marketplace keep working. Pi warns at every load instead of unloading them.
7. **(g)** Not gated: `pending`, `apply` planning, `plugin update` (including the PUP-2 sync, Phase 7), `reinstall`, `fetch`, and completions. `enable` is gated after all, see Deviations.
8. **(h)** `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, and `__lookupSetter__` get the object-member sentence. Upstream gives them its plugin-id (`K$`) sentence.
9. **(i)** Out of scope: `K$`, the spaces, control-character, and path-separator schema messages, `marketplace list` quoting, and plugin-name reservations.
10. **D-PL5-27 evidence note (RESEARCH R-10):** upstream's single-name `marketplace update` does not run the exact-set check on the refreshed name; only its bulk refresh does. D-PL5-27 stays stricter. Should it narrow to the bulk path?
11. **D-08-07 narrowed:** a marketplace named `constructor`, or any other `Object.prototype` member name, is now refused on add. Plugin names keep D-08-07. A marketplace already recorded under such a name keeps working.
12. **Install row has no reason token:** a refused install shows `(failed)` with the sentence as its cause, but no `{invalid manifest}` brace. The install's error classifier does not map `InvalidMarketplaceManifestError` to a reason. Changing that classifier would touch every invalid-manifest install, so it was left as is. Decide whether it should read `{invalid manifest}`.
13. **Unprintable names in the directory-spelling sentence:** on a load surface, the spelling rule runs on the record's name first. A record whose name spells a directory name after invisible characters are removed (such as `claude-plugin-directory` followed by U+200C) gets `"<name>" is a reserved marketplace name.`, and that sentence echoes the name with the invisible character. This is the same as upstream's `Lbe`. At add time the look-alike rule refuses such a name first, so only a record an earlier version wrote can reach this sentence.

## Proposed backlog entries (for the parent)

- **Plugin-id rule `K$` and the remaining schema rules:** the `Claude Code cannot install plugins from a marketplace with this name` sentence (2.1.295+), the no-spaces message, the separate control and bidirectional-character message, and the path-separator and `..` rules.
- **`marketplace list` quoting** of look-alike and non-ASCII names (`Shown in quotes: the name looks like one of Anthropic's own, and is not.`).
- **Ungated commands (divergence g):** `pending`, `apply` planning, `plugin update` including the PUP-2 marketplace sync (Phase 7's `update-flow.ts`), `reinstall`, `fetch`, and completions.
- Close **MKTNAME-01** except the items above.

## Proposed CHANGELOG sub-bullet (under the marketplace-parity entry)

- `marketplace add` and `update` refuse every name Claude Code reserves for itself or its official marketplaces, and a marketplace recorded under such a name is reported on every load until it is removed.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 3 - Blocking] The edit tool turned `\u` escapes into literal characters.**
   - Found during: Task 1 pre-commit (`forbid-bidi-controls` failed on name.ts).
   - Fix: rewrote the two regex classes with `\u` escape sequences through a script.
   - Commit: bc8a536d.
2. **[Rule 1 - Lint] Lint findings in the first Task 1 commit attempt.**
   - The hook flagged `no-use-before-define` (`IMPERSONATION_REFUSAL`) and `prefer-optional-chain` in name.ts. Typecheck flagged that a `constructor:` object key loses literal typing in add.test.ts, fixed with `scope: "project" as const`.
   - Fixed and committed without `--amend`; the failed hook made no commit.
3. **[Fixture, D-PL5-23 precedent] Test fixtures that recorded reserved names from local paths now trip the load surfaces.** All fixes are test-side, and no rule was weakened:
   - `test/orchestrators/plugin/enable-disable.test.ts`: renamed the fixture marketplace `claude-plugins-official` to `acme-plugins`. The name had no role in the 22 enable, disable, and workflow cases it broke.
   - `test/orchestrators/plugin/install-flow.test.ts` (3 GV-01 cases) and `test/orchestrators/reconcile/apply.test.ts` (1 GV-01 case): the `anthropic-plugin-directory` record now comes from the anthropics github source, because the GV-01 directory behavior keys on the name. The apply case also declares that source in its config.
   - `test/orchestrators/plugin/info.test.ts` (4 official-binaries cases), `list-flow.test.ts` (1), and `install-outcome.test.ts` (1): the `claude-plugins-official` record now comes from `anthropics/claude-plugins-official`, through a new optional seed `source`.
   - These 3 extra test files went into the Task 3 commit beside the 16 planned files.
4. **[Plan text] The integration reload case asserts the GREEN notification.** The plan expected "the refused add with the object-member sentence". The apply cascade does not render causes, so the test pins what it prints: `⊘ constructor [project] (failed) {invalid manifest}` with `⊘ hello (failed) {unreadable}`, and an empty state.
5. **[Plan text] The install scenario's reasons cell is empty**, not `invalid manifest`; see choice 12. The cause ends with the untrusted-source sentence, as the plan requires.
6. **[Scope note] `enable` is gated.** The plan placed the assert after `loadCachedMarketplaceManifest` in `install-outcome.ts`. That function is also the enable path's re-materialization (`allowExistingRecord`), so enabling a plugin of a refused marketplace fails. Upstream cannot enable from a catalog it refuses to load either. D-PL5-28 drops `enable` from the not-gated list (g) and says so.
7. **[Test design] Seed and case refactors that avoid fallow clone groups:**
   - The marketplace-info invalid-manifest case became a two-row table that also covers the refused record.
   - `read-pass.test.ts` gained `withEnabledPlugin`, which the existing `closeScopePass` case now shares.
   - `delisted-plugins.ts` shares `loadedMarketplaces` between its two reporters.
8. **[Feature step] The new Given asserts the record it wrote** (`deepStrictEqual` against the state record), not a name lookup. Its library writes the base config with that marketplace as the only declaration.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- Files: `features/marketplace/refused-name.feature` and `features/lib/earlier-version-state.ts` exist.
- Commits bc8a536d, de90dc7a, 07cf9dfb, and 02839041 are ancestors of HEAD.

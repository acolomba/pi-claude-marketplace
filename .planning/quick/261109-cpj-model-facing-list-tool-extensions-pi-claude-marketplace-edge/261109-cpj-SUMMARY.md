---
quick_id: 261109-cpj
phase: quick-261109-cpj
plan: 01
subsystem: edge/handlers/tools (model-facing list tools), edge/browser (browse picker)
tags: [tools, browse, D-BG-1011, D-BG-1012, cucumber]
status: complete
requires: ["261109-cpm"]
provides:
  - edge/marketplace-counts.ts (offeredPluginCount, marketplaceDescription), shared by the picker and the list tool
  - "[disabled]" tag and the `disabled` filter of pi_claude_marketplace_plugin_list
affects:
  - pi_claude_marketplace_list line shape
  - pi_claude_marketplace_plugin_list tags and filters
tech-stack:
  added: []
  patterns: [one shared edge module for a fact two surfaces word]
key-files:
  created:
    - extensions/pi-claude-marketplace/edge/marketplace-counts.ts
    - test/edge/marketplace-counts.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
    - test/edge/handlers/tools.test.ts
    - features/plugin/model-tools.feature
    - docs/competitive-analysis/pi-plugins.md
decisions: [D-BG-1011, D-BG-1012]
base: b88d9910
plan_head_before: b88d99109d49b33d32f06ba22c341200e41d886b
plan_head_after: bcd68aa6fff629b14f68cc188164ee0ce0d4fc39
commits: 3
actuals:
  tasks: 3
  commits: 3
completed: 2026-11-09
---

# Quick 261109-cpj: the model-facing list tools count like the picker and tag disabled plugins

`pi_claude_marketplace_list` now words each marketplace with the browse picker's counts through a shared `edge/marketplace-counts.ts`. `pi_claude_marketplace_plugin_list` tags a disabled plugin `[disabled]` and takes a `disabled` filter. `installed` now means enabled only, and `unavailable` means only the plugins that cannot be installed on this system.

- Worktree: `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-aa506f67ee8614637`
- Branch: `worktree-agent-aa506f67ee8614637`
- BASE: `b88d9910` (confirmed with `git log -1` before any edit)
- Node: v26.13.0

## Commits

| # | Commit | Message | Hook |
| --- | --- | --- | --- |
| 1 | `bdc777e2` | feat(tools): count marketplace plugins as the browse picker does | passed; `npm run check:commit` Passed |
| 2 | `4012ae01` | feat(tools): tag disabled plugins and give them their own filter | passed; `npm run check:commit` Passed (prettier rewrapped one test line in the pre-commit dry run, restaged before commit) |
| 3 | `bcd68aa6` | docs(tools): describe the disabled tag and the marketplace counts | passed (docs only, `npm-check` skipped by its `files:` pattern) |

Per the coordinator amendments, commit 3 holds only `docs/competitive-analysis/pi-plugins.md`. The PROJECT.md and CHANGELOG.md text is under `## Parent lines`.

## Red proofs

### Red proof A (Task 1, list-tool counts)

- Command: `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature`, with only the feature file edited, against the product at `b88d9910`.
- Exit status: 1. `11 scenarios (8 passed, 3 failed)`.
- Failing scenarios (each fails on a `pi_claude_marketplace_list returned:` row, the product printing `-- 3 plugin(s) --` / `-- 1 plugin(s) --`):
  1. The model reads the marketplaces the list tool returns
  2. A list call with a scope returns only the marketplaces of that scope
  3. No call to either tool changes the config, the installation record, or what is installed
- Derived numbers: `tools` catalog declares 7 entries (6 in the published manifest plus `ghp` from the git-repositories step), its project record holds 3 (`alpha`, `delta`, disabled `eps`); `extras` declares 2, its user record holds 1 (`kilo`).
- Green: `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature features/plugin/browse.feature` exit 0, `21 scenarios (21 passed)` (11 model-tools + 10 browse; browse.feature and the picker unit tests are unedited).

### Red proof B (Task 2, disabled tag and filter)

- Command: `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature`, with only the feature file edited, against the product at `bdc777e2`.
- Exit status: 1. `12 scenarios (7 passed, 5 failed)`.
- Failing scenarios:
  1. The plugin list tool returns the install status and compatibility of every plugin
  2. The unavailable filter returns only the plugins this system cannot install
  3. The disabled filter returns only the installed plugins that are disabled
  4. Two filters together return the plugins of either filter
  5. No call to either tool changes the config, the installation record, or what is installed
- Pi accepted and ignored the unknown `disabled` argument: the new disabled-filter scenario received the full passive listing.
- Unit red: `npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts` exit 1 before the implementation, 8 cases failing (registration, disabled version case, every-bucket, unavailable-only, disabled-only, available+unavailable union, unavailable+disabled union, disabled manifest-absence).
- Green: the same cucumber command exit 0, `12 scenarios (12 passed)`; direct coverage of tools.ts exit 0.

## Verification

- Task 1 verify command: cucumber (model-tools + browse) exit 0; `test:coverage:direct` of marketplace-counts.ts, tools.ts, browse.ts, plugin-browser.ts exit 0 (100% direct coverage gate); all grep gates pass.
- Task 2 verify command: cucumber exit 0; `test:coverage:direct` of tools.ts exit 0; all grep gates pass.
- Task 3 doc gates (no `plugin(s)`, no `details.plugins`, `available • ` present) pass. The PROJECT.md and CHANGELOG.md gates belong to the coordinator once it pastes the parent lines.
- `git diff --stat b88d9910 HEAD -- extensions/pi-claude-marketplace/orchestrators test/edge/browser test/edge/handlers/plugin features/plugin/browse.feature .agents/skills/cucumber/rules/layout.md .planning/DUBIOUS-CHOICES.md` prints nothing.
- The owner test of tools.ts: 46 cases before, 49 after (one list-tool case, two filter cases).

## Full gate

- Command: `npm run check`, unpiped (output redirected to a log file), run once after the last commit.
- Exit status: 0.
- Commit: `bcd68aa6fff629b14f68cc188164ee0ce0d4fc39`.
- Node: v26.13.0.
- Scope: this item's worktree tree (`/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-aa506f67ee8614637`). It does not include the other batch items. The coordinator runs the post-merge gate on the combined tree.
- Cucumber: adapter profile `1785 scenarios (1785 passed)`, builtin profile `153 scenarios (153 passed)`; direct coverage merged `coverage/direct.lcov` (353 records).
- Owner tests: `test/edge/handlers/tools.test.ts` + `test/edge/marketplace-counts.test.ts` run 57 cases (49 + 8), all passing.

## Decisions

- **D-BG-1011**: a disabled plugin reads `[disabled]` in `pi_claude_marketplace_plugin_list` and has its own `disabled` filter; `installed` = enabled installed plugins; `unavailable` = only plugins this system cannot install.
- **D-BG-1012**: `pi_claude_marketplace_list` lines read `[<scope>] <name> -- <offered> available • <installed> installed -- <source>`, worded through `edge/marketplace-counts.ts`, the module the picker uses.

## Choices made without the user

- The `{installed}` count counts every recorded plugin, disabled ones included, as the picker and Claude Code do, so the `tools` fixture reads `3 installed` while the `installed` filter returns 2 of them. The user confirmed this on 2026-11-09 (coordinator amendment).
- The two D-BG-1201 helpers moved (not copied) to `edge/marketplace-counts.ts`; `marketplaceDescription` takes an inline readonly object type instead of `MarketplaceEntry`.
- The moved debug line is neutral: `marketplace counts: manifest load failed for <path>: <error>` under the tag `marketplace` (was `browse: ...` under `browser`).
- The seed title "The model reads the marketplaces the list tool returns" is kept, because `.agents/skills/cucumber/rules/layout.md` names it.
- `disabled` is the last property of the plugin list tool's schema.
- The plugin-browser.ts BLOCK C header now says "No direct orchestrators/ or domain/ import", because `marketplace-counts.ts` imports domain/ on its behalf.

## Deviations from Plan

- Task 3 steps 1 and 2 (PROJECT.md, CHANGELOG.md) were not applied, per the binding coordinator amendment; their text is under `## Parent lines`. Task 3 committed only the doc paragraph.
- No other deviation.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Parent lines

### .planning/PROJECT.md

Insert these two rows right after the `D-BG-1007` row of the Key Decisions table:

```markdown
| **D-BG-1011 (behavioral-gaps, quick 261109-cpj, the user's review decision on 2026-11-09, P10-DC-02): a disabled plugin reads `[disabled]` in `pi_claude_marketplace_plugin_list` and has its own `disabled` filter**: The tool has four tags. `[installed]` covers installed, upgradable, partially-installed, and partially-upgradable plugins; `[disabled]` covers installed plugins that are disabled; `[available]` covers available and remote plugins; and `[unavailable]` covers unavailable and partially-available plugins, the ones this system cannot install. `installed` returns enabled plugins, `disabled` returns disabled ones, and `unavailable` no longer returns disabled plugins. Both installed-inventory filters ask the payload loader for installed rows, and the tool's bucket filter keeps the tags that the call asked for. The slash command's `--installed` still includes disabled plugins. It supersedes D-BG-1004 and the tool projection of D-54-01. | The picker already tags a disabled plugin `[disabled]`, one tag per filter returns exactly the plugins that the tag names, and the unavailable tag claimed that an installed plugin could not be installed here. | ✓ Good |
| **D-BG-1012 (behavioral-gaps, quick 261109-cpj, the user's review decision on 2026-11-09, P10-DC-03, P10-DC-22): `pi_claude_marketplace_list` counts a marketplace's plugins as the browse picker does**: The line is `[<scope>] <name> -- <offered> available • <installed> installed -- <source.logical>`. The `available` part is left out when the catalog cannot be read or declares a name Claude Code refuses (D-PL5-28), and the installed part appears only when the scope record holds a plugin of the marketplace. That part counts every recorded plugin, disabled ones included, as the picker and Claude Code count them, so it can be higher than what the `installed` filter returns. With neither part, the line is `[<scope>] <name> -- <source.logical>`. The picker and the tool share `edge/marketplace-counts.ts`, the tool now reads each catalog read-only and offline (NFR-5), and the slash command `marketplace list` still reads none (ML-3). It supersedes D-BG-1005, D-BG-1010, and the line shape that D-BG-1002 kept. | One wording for one fact on two surfaces, and the old count read like the size of the catalog. | ✓ Good |
```

Mark three rows superseded (leave every other row, D-BG-1002 and D-BG-1008 included, as recorded):

- D-BG-1004 row: in its opening parenthetical, replace `the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md` with `superseded on 2026-11-09 by D-BG-1011`. Replace its outcome: the tail ``installed plugins that are disabled. | See `phases/10-model-facing-tools/10-CONTEXT.md`. | -- Revisit |`` becomes ``installed plugins that are disabled. | See `phases/10-model-facing-tools/10-CONTEXT.md`. | Superseded 2026-11-09 by D-BG-1011 |``.
- D-BG-1005 row: in its opening parenthetical, replace `the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md` with `superseded on 2026-11-09 by D-BG-1012`. The tail ``left to the user (P10-DC-03). | See `phases/10-model-facing-tools/10-CONTEXT.md`. | -- Revisit |`` becomes ``left to the user (P10-DC-03). | See `phases/10-model-facing-tools/10-CONTEXT.md`. | Superseded 2026-11-09 by D-BG-1012 |``.
- D-BG-1010 row: in its opening parenthetical, replace `the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md` with `superseded on 2026-11-09 by D-BG-1012`. The tail ``left to the user (P10-DC-22). | See `phases/10-model-facing-tools/10-CONTEXT.md`. | -- Revisit |`` becomes ``left to the user (P10-DC-22). | See `phases/10-model-facing-tools/10-CONTEXT.md`. | Superseded 2026-11-09 by D-BG-1012 |``.

### CHANGELOG.md

In the `[Unreleased]` entry, edit only these sub-bullets (leave the top line and the browse picker bullet as they are):

- Replace `` - `pi_claude_marketplace_list` now takes an optional `scope`. `` with:

  ```markdown
    - `pi_claude_marketplace_list` now takes an optional `scope`, and its lines count the available and the installed plugins as the browse picker does.
  ```

- Replace `` - `pi_claude_marketplace_plugin_list` now reports an unknown marketplace as a failed tool result, and its `unavailable` filter also returns disabled plugins. `` with these two sub-bullets:

  ```markdown
    - `pi_claude_marketplace_plugin_list` now reports an unknown marketplace as a failed tool result.
    - `pi_claude_marketplace_plugin_list` now tags a disabled plugin `[disabled]`, and a new `disabled` filter returns it.
  ```

Compared with 0.23.0, `installed` and `unavailable` return the same plugins as before (the dropped `unavailable` clause never shipped), so the CHANGELOG names only the tag, the filter, and the counts.

### .planning/DUBIOUS-CHOICES.md

- P10-DC-02: status becomes `fixed by quick 261109-cpj (D-BG-1011)`.
- P10-DC-03: status becomes `fixed by quick 261109-cpj (D-BG-1012)`.
- P10-DC-22: status becomes `fixed by quick 261109-cpj (D-BG-1012)`.
- "Decisions waiting on you", first bullet: mark it fixed by quick 261109-cpj (D-BG-1011, D-BG-1012).

## Self-Check

PASSED. `extensions/pi-claude-marketplace/edge/marketplace-counts.ts` and `test/edge/marketplace-counts.test.ts` exist. Commits `bdc777e2`, `4012ae01`, and `bcd68aa6` are ancestors of HEAD, and `git rev-list --count b88d9910..HEAD` is 3. `git status --short` is clean.

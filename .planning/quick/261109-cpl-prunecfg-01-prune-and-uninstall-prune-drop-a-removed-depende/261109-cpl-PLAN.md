---
quick_id: 261109-cpl
description: prune and uninstall --prune drop a removed dependency's disabled declaration from the scope's config files (PRUNECFG-01, reverses D-BG-1309)
date: 2026-11-09
mode: quick-batch
phase: quick-261109-cpl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - features/plugin/prune.feature
  - features/plugin/uninstall.feature
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - test/persistence/config-io.test.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - test/persistence/config-write-back.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - test/orchestrators/plugin/prune.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - test/orchestrators/plugin/prune-rollback.test.ts
  - docs/dependency-resolution.md
autonomous: true
requirements: [PRUNECFG-01, NFR-3, NFR-10]

must_haves:
  truths:
    - "After `/claude:plugin prune --scope project` uninstalls `mid@tools`, a dependency the user disabled, and `lib@tools`, the project scope's `claude-plugins.json` declares no plugins; at BASE it still declares `mid@tools` with `enabled` false (D-BG-1310)"
    - "A dependency the user disabled with `--local` and that `prune` then uninstalls no longer has a declaration in the project scope's `claude-plugins.local.json`"
    - "`/claude:plugin uninstall app@tools --scope project --prune`, with `app` and its dependency `lib` both disabled, uninstalls both and leaves `claude-plugins.json` declaring no plugins"
    - "The sweep deletes only the `enabled: false` entries of the dependencies it removed: an enabled entry of a removed dependency, the entry of a dependency that failed to unstage, and every unrelated entry stay; a layer with nothing to delete is not rewritten, and an absent layer is not created (WR-02)"
    - "An invalid layer and a layer write that fails are debug-logged, and the command still commits; a symlinked layer refuses the write and fails the command unsaved (NFR-10)"
    - "When a prune's state save fails after the sweep deleted declarations, both config files hold their original bytes again; a file that another writer changed after the sweep's write keeps that change, the `{rollback partial}` row names it, and its original stays in the recovery backup (NFR-3)"
    - "When the state save of `uninstall --prune` fails, the deleted declarations stay deleted, as the named plugin's own deleted declaration does, and the same command run again converges"
    - "PROJECT.md holds D-BG-1310 on the line after D-BG-1309, whose outcome reads `Reversed 2026-11-09 by D-BG-1310`; BACKLOG.md shows PRUNECFG-01 closed and the new PRUNECFG-02; the CHANGELOG `[Unreleased]` entry and `docs/dependency-resolution.md` describe the deletion"
  artifacts:
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
      provides: "dropPrunedDisabledDeclarations, which sweepOrphans runs once after its member loop, and the ConfigLayerWrite record it reports"
      contains: "PRUNECFG-01"
    - path: extensions/pi-claude-marketplace/persistence/config-write-back.ts
      provides: "the batched plugin-key delete that returns the bytes it wrote"
      contains: "export async function deletePluginConfigEntries"
    - path: extensions/pi-claude-marketplace/persistence/config-io.ts
      provides: "saveConfig returning the bytes atomicWriteJson wrote"
      contains: "return atomicWriteJson("
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
      provides: "the config and local config snapshots and recordConfigWrites"
      contains: "\"local config\""
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
      provides: "the sweep's config writes handed to the rollback before it runs"
      contains: "recordConfigWrites"
    - path: features/plugin/prune.feature
      provides: "the config Then of the disabled-dependency scenario and the local-config scenario"
      contains: "Then the \"claude-plugins.local.json\" file of the project scope declares no plugins"
    - path: features/plugin/uninstall.feature
      provides: "the uninstall --prune scenario with a disabled dependency"
      contains: "drops the disabled declaration of the dependency it uninstalls"
    - path: .planning/PROJECT.md
      provides: "the D-BG-1310 decision row"
      contains: "**D-BG-1310 ("
    - path: .planning/BACKLOG.md
      provides: "PRUNECFG-01 in the closed form and the new PRUNECFG-02"
      contains: "## ~~PRUNECFG-01:"
  key_links:
    - from: "sweepOrphans (orchestrators/plugin/uninstall.ts)"
      to: "dropPrunedDisabledDeclarations"
      via: "one awaited call after the removeDependencyMember loop, over the members whose removed is true"
      pattern: "await dropPrunedDisabledDeclarations\\("
    - from: "dropPrunedDisabledDeclarations"
      to: "deletePluginConfigEntries -> saveConfig (persistence)"
      via: "one write per layer that holds an enabled false entry of a removed member; the returned bytes go to recordConfigWrite"
      pattern: "deletePluginConfigEntries\\("
    - from: "the prune catch arm (orchestrators/plugin/prune.ts)"
      to: "PruneRollback.recordConfigWrites, then PruneRollback.rollback"
      via: "the sweep's recorded config writes become the rollback's own-write bytes"
      pattern: "backup\\.recordConfigWrites\\(configWrites\\)"
    - from: "preparePruneRollback (orchestrators/plugin/prune-rollback.ts)"
      to: "snapshotPath of baseConfigJsonPath and localConfigJsonPath"
      via: "phases config and local config under the scope root, after the state snapshot, restored by restoreMetadata"
      pattern: "locations\\.localConfigJsonPath"
---

<objective>
PRUNECFG-01: when `prune` or `uninstall --prune` removes a dependency that the user disabled, the scope's config keeps that dependency's `enabled: false` declaration. The user asked for a fix on 2026-11-09, in the review of the behavioral-gaps dubious choices (P13-DC-04, "fix before the PR"). The new decision D-BG-1310 reverses D-BG-1309, which left the entry in place.

After this plan, the sweep that both commands share (`sweepOrphans` in `orchestrators/plugin/uninstall.ts`, the loop over `removeDependencyMember`) deletes the `enabled: false` entry of each dependency it removed, from both config files of the scope, before the state save. When a prune's state save fails, the prune rollback restores both files (NFR-3). The disabled-dependency scenario of `features/plugin/prune.feature` gets its config `Then`, and two new scenarios cover the local config and `uninstall --prune`.

Purpose: Claude Code 2.1.319 deletes a pruned plugin's `enabledPlugins` entry, so the product leaves a declaration that upstream does not.

Output: Task 1 (tracer) adds the deletion end to end, with three scenarios proved red first. Task 2 makes a failed prune save restore the config files and pins the retry model of `uninstall --prune`. Task 3 records D-BG-1310, closes PRUNECFG-01, notes PRUNECFG-02, and updates the CHANGELOG and `docs/dependency-resolution.md`.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
Rules: AGENTS.md (Git, GSD records, Build verification, Behavioral tests, the Upstream parity, File operations, Recovery model, and Containment constraints); `.agents/skills/cucumber/SKILL.md` and `rules/features.md`; `.agents/skills/typescript-unit-tests/SKILL.md`, `rules/cases.md`, and `rules/boundaries.md`; `.agents/skills/typescript-style/rules/comments.md`; `.agents/skills/local-verification/SKILL.md`, `rules/commands.md`, and `rules/gates.md`; `.agents/skills/committing/SKILL.md`; `.agents/skills/changelog/SKILL.md` and its rules.

Sources: the BACKLOG entry `## PRUNECFG-01`; the PROJECT.md rows D-BG-1309 and D-04-02 / D-04-04 (the config names only plugins the user asked for); `.planning/DUBIOUS-CHOICES.md` (P13-DC-04, "fix before the PR"); `.planning/milestones/behavioral-gaps-phases/13-prune/` (13-CONTEXT.md D-BG-1303 and D-BG-1309, DUBIOUS-CHOICES.md P13-DC-04 and P13-DC-11).

Planner measurements at BASE `9a398226` (the batch base), 2026-11-09:

- `orchestrators/plugin/uninstall.ts`: the header's `--prune` lines are 23-29. `PrunedMember` is at lines 849-858. The doc comment of `removeDependencyMember` (lines 879-894) ends by saying that the body never touches the config layers, because a dependency record is declared in neither file (D-04-02) and a hand-written declaration is the user's desired state. The body is at lines 895-936. `sweepOrphans` (lines 938-986) has two callers: the named uninstall's closure (lines 1554-1567, after `deleteTargetDeclaration` at line 1546 and before the one `tx.save()` at line 1574) and `prune.ts` line 305. No other file and no test calls it.
- The named uninstall reads both layers for CFG-03 at the start of its closure (`readUninstallLayers`, line 1458), so an invalid layer refuses a standalone `uninstall --prune` before anything changes. `prune` reads no config file today.
- The uninstall path has no rollback. Its NFR-3 model is retry convergence: `test/orchestrators/plugin/uninstall.test.ts` line 4999, `retry proof: uninstall: a refused state save leaves the swept config diverged and the retry converges it`, pins that a refused state save leaves the named plugin's declaration deleted.
- `orchestrators/plugin/prune.ts` lines 283-338: the locked closure builds the index, prepares the backup only when candidates exist (lines 299-302), and runs `sweepOrphans` and `tx.save()` inside a try whose catch runs `backup.rollback()` (lines 320-329).
- `orchestrators/plugin/prune-rollback.ts`: `PruneRollback` (lines 63-73) has `recordMcpWrites`. `preparePruneRollback` (lines 359-479) snapshots the artifact targets, then the agents index (`targets.length`), `mcp.json` (+1), `mcp-adapter.json` (+2), and `state.json` (+3). It writes them to the recovery manifest in that order and restores the three metadata files with `restoreMetadata`, which writes the original back only while the live file still holds the recorded own write (`ownMcpWrites`). Then it restores state.
- `persistence/config-io.ts::saveConfig` (lines 185-199) returns nothing. It awaits `atomicWriteJson`, which already returns the exact bytes it wrote "so a caller can later tell its own write from a later edit (NFR-3)". `persistence/config-write-back.ts::deletePluginConfigEntry` is at lines 150-171.
- Precedent for cascade members: `orchestrators/plugin/shared.ts::overwriteDisabledMemberEntries` (lines 1040-1086). Members are not named by the user, so no layer rule applies: each layer of the scope that holds `enabled: false` for a member is rewritten, and an absent, invalid, or silent layer is left alone (WR-02).
- `orchestrators/reconcile/plan.ts::classifyDeclaredPlugin` (lines 456-560): a declared key with `enabled: false` and no record plans nothing. A declared enabled key with no record plans an install.
- `enable` writes `{ "enabled": true }` for the plugin it enables (`writeEnabledFlagBack` in `enable-disable.ts`), so `disable` and then `enable` of a dependency leaves an enabled entry. That case, and a hand-written `{}`, stay out of scope (PRUNECFG-02).
- `assertPathInside` (`shared/path-containment.ts`, used by `saveConfig`) refuses every symlink segment, the leaf included, with `SymlinkRefusedError`, a `PathContainmentError`.
- Scenario E of `features/plugin/prune.feature` (lines 217-237, `Pruning removes a disabled dependency that nothing needs and what only it needs`) states no config outcome (D-BG-1309). Per BACKLOG PRUNECFG-01, after its prune `claude-plugins.json` still declares `mid@tools` with `enabled: false`.
- `orchestrators/plugin/shared.ts::pluginLayerVerdict` (lines 807-836) returns `neither` for a plugin that no layer declares, so `disable lib@tools --scope project --local` on the orphaned dependency of S2 is not refused, and it writes the local layer, declaring the marketplace there too (LAYER-06).
- Steps: `the {string} file of the {word} scope declares no plugins` (`features/step_definitions/config.steps.ts` line 283) passes on an empty or absent `plugins` map and fails on a missing file. `the user has run {string}` requires every result to be `info` (`command.steps.ts` lines 91-93). Every step that S1-S3 below use exists.
- No existing unit test or integration test seeds an `enabled: false` layer entry for a dependency that an `uninstall --prune` or a prune removes. Searched: `test/orchestrators/plugin/uninstall.test.ts`, `prune.test.ts`, and `test/integration/standalone-prune.test.ts`. So the existing byte-stability assertions keep holding.
- `test/orchestrators/plugin/prune-rollback.test.ts`'s `seed()` yields four artifact targets (skill, command, hooks, agent). So state is backup `7`, and the new config snapshots are `8` and `9`. The existing cases that name `5` and `6` keep their indices.
- Test helpers: in `uninstall.test.ts`, `uninstallWithFreshOwner` and `makeCtx` (lines 160-200), `withHermeticHome` (237), `writeLayerConfigs` (2789), `seedDeclaringScope` (5929), `EMPTY_LAYER` and `LAYER_DECLARING_APP` (6323-6324), `PRUNE_SCOPE` and `recordedInventory` (6640-6665), the D-05-01 success report (6713-6770), `cascadeFailingFor` and `prunePartialFailureNotification` (7341-7385), and the D-05-13 AG-5 case (7386); `captureDebugLog` (`test/platform/debug-log-capture.ts`); `chmodDeniesThisProcess` and `CHMOD_DENIAL_HINT` (`test/chmod-denial.ts`, used by `test/orchestrators/plugin/dependency-declaration-read.test.ts` line 1332). In `prune.test.ts`: `restoreOps` with the fixed `prune-backup-ABC123`, `prune(transaction)`, `seedScope`, `seedRecord`, and the failed-save cases at lines 680-760 and 975-1040. In `prune-rollback.test.ts`: `seed`, `member`, `restoreOps`, and the own-write cases at lines 1150-1290.
- Gate baselines at BASE (each Task's `<done>` repeats its own): the scenario E config `Then` 0, the local-config `Then` 0, the new uninstall scenario title 0, `PRUNECFG-01` in uninstall.ts 0, `export async function deletePluginConfigEntries` 0, `"local config"` in prune-rollback.ts 0, `recordConfigWrites` in prune.ts 0, `**D-BG-1310 (` 0, a D-BG-1309 row ending `Reversed 2026-11-09 by D-BG-1310` 0 (it ends `-- Revisit`), PRUNECFG-01 headings 1 with the closed form 0, `## PRUNECFG-02:` 0, `[Unreleased]` sub-bullets naming `uninstall --prune` 0, and `D-BG-1310` in `docs/dependency-resolution.md` 0.
- The other batch items share no source or test file with this plan. They share `.planning/PROJECT.md`, `.planning/BACKLOG.md`, and `CHANGELOG.md`, which the batch's file-overlap partition orders. So `depends_on` is empty.

Upstream evidence record (`.agents/skills/claude-code-compat-research`). Source: `strings`/`grep -oa` over the Claude Code 2.1.319 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`, the only installed version, `claude --version` 2.1.319), read 2026-11-09:

- Question: which settings does a prune's removal change, and which entries? Answer: `pruneOrphanedAutoDeps` (function `bEi`, called by the prune command's handler) maps the prune scope through `$I(n)`, which returns `qf[n]`, with `qf={user:"userSettings",project:"projectSettings",local:"localSettings"}`. It writes that one settings source with `enabledPlugins[id]=void 0` for each removed id, and for each alias key of that plugin that no other install shares (`VMe`). It ignores the entry's value. Confidence: high, read from the function body.
- Question: what does a failed settings write do? Answer: `if(ke)t(\`pruneOrphanedAutoDeps: settings write failed at ${n}: ${ke.message}\`)`. It logs, then goes on to delete the plugin files. The install records are removed in the loop before the write. Confidence: high.
- Unresolved: whether `claude plugin uninstall --prune` reaches `bEi`. The binary has the option, but the function's only call site is the prune flow. Not traced. This project shares one sweep between the two commands either way.
- Constraints: SC-1 (exactly two scopes; `claude-plugins.local.json` is a layer of the same scope, not a scope); D-04-02 (the config names only plugins the user asked for); NFR-1, NFR-3, NFR-10; WR-02; the retry-proof model of the uninstall path.
- Mapping and divergences: (a) Upstream's prune scope owns one settings file. Here a scope keeps its declarations in two layer files, so the sweep reads both. This is a mapping under SC-1, not a divergence, and `overwriteDisabledMemberEntries` treats cascade members the same way. (b) Only `enabled: false` entries go, as the item asks. An enabled entry stays under D-04-02, the license, and PRUNECFG-02 asks the user whether to follow Claude Code there too. (c) The write lands before the state save, the house order for config write-back, and prune's rollback restores it. Upstream writes after the records. A user sees the same result.

One code task: Task 1 changes `uninstall.ts` and the two persistence modules. The commit hook needs 100% direct coverage of every staged source-test pair, and fallow fails on an export that nothing imports. So a task cannot split a production change from its tests or from its first consumer. That is why Task 1 holds eight files.
</context>

## Scenario texts

Task 1 writes these. Indent and align them like their neighbors.

S1, in `features/plugin/prune.feature`, scenario `Pruning removes a disabled dependency that nothing needs and what only it needs`: add one line after its last line, `Then the project scope has no installed plugins`. The title and every other line stay byte for byte:

```gherkin
    Then the "claude-plugins.json" file of the project scope declares no plugins
```

S2, a new scenario at the end of `features/plugin/prune.feature`, after scenario E and one blank line:

```gherkin
  Scenario: Pruning a dependency the user disabled in the local config drops its local declaration
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project --local"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins
    Then the "claude-plugins.local.json" file of the project scope declares no plugins
```

S3, a new scenario in `features/plugin/uninstall.feature`, after the scenario `Uninstalling with --prune keeps the dependency that another installed plugin still needs` and before `Uninstalling a dependency that a plugin its marketplace no longer lists needs fails as dependents remain`:

```gherkin
  Scenario: Uninstalling with --prune drops the disabled declaration of the dependency it uninstalls
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin disable app@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project"
    When the user runs "/claude:plugin uninstall app@tools --scope project --prune"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | app@tools | app  | uninstalled |                   | project | 1.0.0   |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.0.0   |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins
```

`app` is disabled first, because `disable` refuses a dependency that an enabled plugin still declares (EDEP-02).

## Record texts

Task 3 writes these. They sit outside the task actions on purpose.

R1, the new PROJECT.md row, one line, inserted right after the D-BG-1309 row:

```text
| **D-BG-1310 (behavioral-gaps, quick 261109-cpl, decided by the user on 2026-11-09, see DUBIOUS-CHOICES.md P13-DC-04): `prune` and `uninstall --prune` delete a removed dependency's `enabled: false` declaration**: The sweep that both commands share (`sweepOrphans` in `orchestrators/plugin/uninstall.ts`) runs this step after its member loop and before the state save. It deletes the key of each dependency it removed from each config file of the scope, `claude-plugins.json` and `claude-plugins.local.json`, whose entry reads `enabled: false`, with one write per file. An enabled entry stays (D-04-02, BACKLOG PRUNECFG-02), and so does the entry of a dependency that failed to unstage. An absent or invalid file is not rewritten (WR-02). A failed write is debug-logged and fails nothing, and a containment refusal fails the command (NFR-10). When a prune's state save fails, the prune rollback restores both files: it snapshots them and writes an original back only while the file holds the sweep's own write (NFR-3). When the state save of `uninstall --prune` fails, the deletions stay, as the named plugin's deleted declaration does, and the same command run again converges. This reverses D-BG-1309. | Claude Code 2.1.319's `pruneOrphanedAutoDeps` (function `bEi` in the binary) deletes `enabledPlugins[id]` of each removed plugin, whatever its value, from the one settings file of the prune scope (user, project, or local settings). It only logs a failed write and goes on. Under SC-1 a scope keeps its declarations in two layer files, so the sweep reads both, as `overwriteDisabledMemberEntries` does for cascade members. | ✓ Good |
```

R2, the D-BG-1309 row: its last cell `-- Revisit` becomes `Reversed 2026-11-09 by D-BG-1310`. The decision and rationale cells stay byte for byte.

R3, the PRUNECFG-01 entry in `.planning/BACKLOG.md`. The heading becomes the first line below. The paragraph after it goes between the heading and the existing `Noted 2026-11-08 ...` paragraph, which stays unchanged:

```text
## ~~PRUNECFG-01: a pruned disabled dependency keeps its `enabled: false` declaration~~ -- CLOSED

**CLOSED 2026-11-09** by quick task 261109-cpl (fixed, D-BG-1310). The sweep that `prune` and `uninstall --prune` share now deletes the `enabled: false` declaration of each dependency it removes, from both config files of the scope. When a prune's state save fails, the prune rollback restores both files. The disabled-dependency scenario of `features/plugin/prune.feature` checks the config, and two new scenarios cover the local config and `uninstall --prune`. An enabled declaration of a pruned dependency still stays, and PRUNECFG-02 holds that question.
```

R4, a new BACKLOG entry right after the PRUNECFG-01 entry, before `## PLUGALIAS-01`:

```text
## PRUNECFG-02: a pruned dependency's enabled declaration stays, so the next load plans its install

Noted 2026-11-09 (quick 261109-cpl, D-BG-1310). The sweep of `prune` and `uninstall --prune` deletes only a removed dependency's `enabled: false` declaration. An enabled declaration stays: a `{}` entry written by hand, or the `enabled: true` that `enable <dependency>` writes over the entry of an earlier `disable`. With no record left, `pending` lists the plugin's install, and `apply` installs it again. Claude Code 2.1.319's `pruneOrphanedAutoDeps` deletes the `enabledPlugins` entry of each removed plugin, whatever its value. Candidate direction: decide whether an enabled declaration of a dependency is the user's request to install it (keep it, D-04-02) or a leftover (delete it, as Claude Code does).
```

R5, the CHANGELOG sub-bullet (18 words), indented two spaces under the `## [Unreleased]` entry:

```text
  - `prune` and `uninstall --prune` now also delete a removed dependency's `enabled: false` entry from the scope's config files.
```

R6, a new paragraph in `docs/dependency-resolution.md`, section `## Pruning dependencies nothing needs`, right after the paragraph that starts `Each removed dependency shows its own`:

```text
When the sweep removes a dependency that you disabled, it also deletes that dependency's `enabled: false` entry from each config file of the scope that has one, `claude-plugins.json` and `claude-plugins.local.json` (D-BG-1310). Claude Code deletes a pruned plugin's `enabledPlugins` entry whatever its value. Here an entry that turns the dependency on stays, so `pending` then lists the dependency's install, and `apply` installs it again. An invalid config file keeps its entries. If a config file cannot be written, it keeps its entries too, and the command still succeeds.
```

R7, a new paragraph in the same file, section `## Pruning without uninstalling a named plugin`, right after the paragraph that starts `Only records installed as dependencies qualify.`:

```text
Like `uninstall --prune`, `prune` deletes the `enabled: false` entry of each dependency that it removes from the config files of the scope. If its state save then fails, `prune` puts both config files back. A file that another program changed in the meantime keeps that change, the failure row names it, and the recovery backup keeps the original.
```

## Out of scope

- Deleting an enabled declaration of a pruned dependency (`{}` or `enabled: true`): PRUNECFG-02, for the user to decide (D-04-02 today).
- Upstream's alias keys (`VMe`) and keys under a renamed marketplace: the sweep deletes the record key `plugin@marketplace`, as `overwriteDisabledMemberEntries` does.
- `prune --dry-run`: upstream's preview lists plugins only, and so does this one.
- A config restore for `uninstall --prune`: its NFR-3 model is retry convergence (D-BG-1310, the retry proof).
- The named plugin's own declaration handling, and `marketplace remove`.
- `.planning/DUBIOUS-CHOICES.md` (marking P13-DC-04 fixed is a parent line, because six batch items would change adjacent lines of its list), `.planning/STATE.md`, `.planning/ROADMAP.md` (the quick-batch workflow records the task), `README.md`, `README.es.md`, and `docs/output-catalog.md` (a build input with byte counters; no catalog state changes).
- The archived Phase 13 files under `.planning/milestones/`: history, unchanged.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: A removed dependency's `enabled: false` declaration leaves both config files of the scope, through `prune` and `uninstall --prune`, end to end (D-BG-1310)</name>
  <reversibility rating="reversible">Removing the new sweep step restores the old behavior. The entries a run deleted were inert leftovers that a new `disable` writes again.</reversibility>
  <precondition>The executor's checkout has `node_modules/.init-done`; if it does not, run `bash scripts/init.sh` there before the first check.</precondition>
  <files>features/plugin/prune.feature, features/plugin/uninstall.feature, extensions/pi-claude-marketplace/persistence/config-io.ts, test/persistence/config-io.test.ts, extensions/pi-claude-marketplace/persistence/config-write-back.ts, test/persistence/config-write-back.test.ts, extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts, test/orchestrators/plugin/uninstall.test.ts</files>
  <read_first>
- .planning/BACKLOG.md, the `## PRUNECFG-01` entry (`grep -n '^## PRUNECFG-01' .planning/BACKLOG.md`).
- extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts lines 1-140 (header and imports), 840-1010 (`PrunedMember`, `buildMemberFailedRow`, `removeDependencyMember`, `sweepOrphans`, `survivingDependents`), and 1448-1576 (the closure: CFG-03 read, `deleteTargetDeclaration`, the sweep call, the save). Use Grep for anything else; the file has 1,755 lines.
- extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts lines 1040-1086 (`overwriteDisabledMemberEntries`, the precedent to mirror).
- extensions/pi-claude-marketplace/persistence/config-io.ts lines 85-95 (`isDeclaredEnabled`) and 170-199 (`saveConfig`); extensions/pi-claude-marketplace/persistence/config-write-back.ts lines 1-40 and 150-171; extensions/pi-claude-marketplace/shared/atomic-json.ts.
- extensions/pi-claude-marketplace/shared/path-safety.ts (re-exports `PathContainmentError`) and shared/path-containment.ts lines 16-60.
- test/orchestrators/plugin/uninstall.test.ts: the helper lines that the plan's measurements list, and the cases at 6713-6770, 7386-7430, and 7652-7700 (the WLIF-01 read-only parent and `captureDebugLog` pattern). Do not read the whole file (8,242 lines).
- test/chmod-denial.ts; test/platform/debug-log-capture.ts; test/persistence/config-io.test.ts lines 1-30 and 344-384; test/persistence/config-write-back.test.ts lines 1-27 and 417-457.
- features/plugin/prune.feature (whole); features/plugin/uninstall.feature lines 1-13 and 293-372; features/step_definitions/config.steps.ts lines 250-290; features/step_definitions/command.steps.ts lines 91-121.
- .agents/skills/cucumber/rules/features.md, .agents/skills/typescript-unit-tests/rules/cases.md and rules/boundaries.md, .agents/skills/typescript-style/rules/comments.md, .agents/skills/local-verification/rules/commands.md, and .agents/skills/committing/SKILL.md.
  </read_first>
  <behavior>
- S1, S2, and S3 fail at BASE at their last step, because the config still declares `mid@tools`, `lib@tools`, and `lib@tools` with `enabled: false`. They pass with the change.
- `saveConfig` resolves to the exact bytes it wrote. `deletePluginConfigEntries` deletes exactly the listed flat keys in one write, keeps every other entry and every unknown forward-compatible field, and resolves to the bytes it wrote.
- U1 `PRUNECFG-01: uninstall --prune deletes each removed dependency's enabled: false entry from both layers and keeps every other entry`. Seed `PRUNE_SCOPE`. Base layer `{"schemaVersion":1,"plugins":{"x@mp":{},"d1@mp":{"enabled":false},"o@mp2":{}}}` plus a newline. Local layer `{"schemaVersion":1,"plugins":{"d2@mp2":{"enabled":false},"keep@mp":{"enabled":false}}}` plus a newline. Uninstall `x` with `prune: true`. The notification is the D-05-01 case's success report. The base file is the two-space JSON of `schemaVersion` 1 with only `o@mp2: {}` (an enabled entry of a removed dependency stays, D-04-02). The local file is the two-space JSON with only `keep@mp: { enabled: false }` (not a member). No record is left.
- U2 `PRUNECFG-01: a dependency that fails to unstage keeps its enabled: false entry`. Seed `PRUNE_SCOPE`. Base `{"schemaVersion":1,"plugins":{"x@mp":{}}}`. Local `{"schemaVersion":1,"plugins":{"d2@mp2":{"enabled":false}}}`. Pass the D-05-13 AG-5 cascade double `cascadeFailingFor("d2", ...)`. The notification is `prunePartialFailureNotification("source mismatch")`. The local file keeps the exact text written. The base file is the two-space JSON with an empty `plugins` map.
- U3 `PRUNECFG-01: a sweep with no disabled entry to delete rewrites no layer and creates none`. Seed `PRUNE_SCOPE` with no base file, so `x` is undeclared and LAYER-08 finds no needer. Local `{"schemaVersion":1,"plugins":{"o@mp2":{}}}`. The notification is the success report. The base file still does not exist. The local file keeps its bytes and its mtime.
- U4 `PRUNECFG-01: a layer that turns invalid before the sweep deletes keeps its text, and the sweep debug-logs it`. Base `{"schemaVersion":1,"plugins":{"x@mp":{},"d1@mp":{"enabled":false}}}`. Local `{"schemaVersion":1,"plugins":{"d2@mp2":{"enabled":false}}}`. The cascade double writes the text `{ not json` to the local file when it unstages `o`, then runs the real `cascadeUnstagePlugin`. Use `captureDebugLog(t)`. The notification is the success report, and the local file holds `{ not json`. The base file is the two-space JSON with an empty `plugins` map. The logged lines are exactly `[hooks] prune sweep: claude-plugins.local.json is invalid, so its disabled declarations of removed plugins stay`.
- U5 `PRUNECFG-01: a layer write that fails is debug-logged, the entry stays, and the uninstall still commits`. Guard with `chmodDeniesThisProcess()`, throwing an Error that names `CHMOD_DENIAL_HINT`. Base `{"schemaVersion":1,"plugins":{"d1@mp":{"enabled":false}}}`, so `x` is undeclared and the named plugin writes no declaration. No local file. Use `captureDebugLog(t)`. Make the scope root `0o555` for the act only, and put it back to `0o755` in a `finally`. The notification is the success report. The base file keeps its bytes, and no record is left. Exactly one logged line starts with `[hooks] prune sweep: could not delete the disabled declarations from claude-plugins.json: EACCES`. Match only that stable part, because write-file-atomic names a temporary file with a random suffix.
- U6 `PRUNECFG-01 / NFR-10: a symlinked layer refuses the delete, and the uninstall fails unsaved`. The base path is a symlink to a file in the hermetic cwd that holds `{"schemaVersion":1,"plugins":{"d1@mp":{"enabled":false}}}`. No local file, and `x` is undeclared. There is one `error` notification, whose row is `x` `(failed)`. Pin the exact text the run shows, the SymlinkRefusedError message as the row renders it. The `state.json` bytes equal those before the act. The symlink target's bytes are unchanged, and the base path is still a symlink.
  </behavior>
  <action>
Per D-BG-1310, which reverses D-BG-1309. Write the scenarios first and prove them red. Then change the source.

(1) Scenarios: apply S1 to `features/plugin/prune.feature`, append S2 at the end of that file, and insert S3 into `features/plugin/uninstall.feature` where the "Scenario texts" section places it. Keep both feature descriptions and every other scenario byte for byte. Align every table column. Add no step definition: every step of S1-S3 already exists, and `npm run check:features` fails on an undefined one.

(2) RED, on the unchanged source. Run `npm run test:cucumber:profile -- --profile adapter --name 'Pruning removes a disabled dependency that nothing needs' --name 'drops its local declaration' --name 'drops the disabled declaration of the dependency it uninstalls'`. It must exit non-zero with all three scenarios failed at their last step, the config `Then`. The step reports the declaration that is still there: `mid@tools` in S1, `lib@tools` in S2 and in S3. If an earlier step fails, the scenario text is wrong, not the product. For example, a setup command might not report `info`, or a result literal might differ. Then change that literal to what the run shows. Use the `, which warned` form of the setup step only if that command really warns. Rerun until the config `Then` is the failing step, and report each change as a deviation. A failure on Pi's ready timeout is not the red proof: rerun that scenario alone. Record the command, its exit status, and the failing step of each scenario for the SUMMARY.

(3) Persistence (NFR-1: every write still goes through `saveConfig` and `atomicWriteJson`):
- config-io.ts: `saveConfig` returns the bytes that `atomicWriteJson` wrote. Its declared return type becomes a promise of `Buffer`, and its body returns the `atomicWriteJson` call. Add one doc sentence: it returns the exact bytes, so a caller can tell its own write from a later edit (NFR-3). Every existing caller keeps awaiting it unchanged.
- config-write-back.ts: add the exported `deletePluginConfigEntries(current, targetConfigPath, scopeRoot, keys)`, where `keys` is a readonly list of flat `plugin@marketplace` keys. It makes one shallow copy of `current.plugins`, deletes each listed key from it, keeps every other member of `current`, pins `schemaVersion: 1`, makes one `saveConfig` call, and returns its bytes. Give it a doc comment in the module's style. `deletePluginConfigEntry` keeps its signature and its behavior and delegates to the new function with its one key, so that `fallow dupes` finds no clone.
- Tests: in test/persistence/config-io.test.ts, add the case `saveConfig returns the exact bytes it wrote`. The resolved buffer equals the file's bytes and the expected two-space text. In test/persistence/config-write-back.test.ts, add a `describe("deletePluginConfigEntries")` block with one case. It deletes two of four plugin keys. One kept entry has an unknown forward-compatible field, and the config has an unknown top-level member. The case asserts the file's exact text and that the resolved bytes equal it. The existing `deletePluginConfigEntry` case stays unchanged and passes.

(4) The shared sweep in extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:
- Add the module-private async `dropPrunedDisabledDeclarations(args)`, where `args` holds `locations` (ScopedLocations) and `members` (readonly `PrunedMember[]`), and a module-private per-layer helper. `sweepOrphans` awaits `dropPrunedDisabledDeclarations` once, after its member loop, with `locations` and the members it visited, and then returns those members unchanged.
- Behavior: the keys are `plugin@marketplace` of each member whose `removed` is true. With no key, return before any read. Otherwise take `locations.baseConfigJsonPath`, then `locations.localConfigJsonPath`. Read each layer fresh with `loadConfig`. On `absent`, go to the next layer. On `invalid`, call `hookDebugLog` with exactly `prune sweep: <basename> is invalid, so its disabled declarations of removed plugins stay` (default tag; `<basename>` is `path.basename` of the layer path) and go to the next layer. On `valid`, select the keys whose own entry in `config.plugins` (`ownValue`) exists and is not `isDeclaredEnabled`, that is, `enabled` is `false`. With none selected, go to the next layer and write nothing (WR-02: never rewrite a file for a no-op, never create one). Otherwise delete exactly those keys with ONE `deletePluginConfigEntries` call.
- A write that throws: rethrow it when it is a `PathContainmentError` (import it from `../../shared/path-safety.ts`). That is NFR-10: a containment refusal is never swallowed, just as `runPostUninstallCleanup` keeps its `pluginDataDir` assertion outside its try. Any other error: call `hookDebugLog` with exactly `prune sweep: could not delete the disabled declarations from <basename>: <errorMessage(err)>`, and go on with the next layer. The leftover entry stays, and the command commits. So the members' total contract (D-05-13) still holds. Claude Code 2.1.319's `pruneOrphanedAutoDeps` also only logs a failed settings write.
- The layer loop needs the house form `// eslint-disable-next-line no-await-in-loop -- <reason>` (one read-modify-write per layer). Import `isDeclaredEnabled` from config-io.ts and `deletePluginConfigEntries` from config-write-back.ts.
- Comments, per `.agents/skills/typescript-style/rules/comments.md`: a doc comment on `dropPrunedDisabledDeclarations` that cites PRUNECFG-01 / D-BG-1310, D-04-02 (an enabled declaration stays as the user's request to install), WR-02, NFR-10, D-05-13, and the per-scope settings deletion of Claude Code 2.1.319. In the doc comment of `removeDependencyMember`, replace its closing sentence, the one about the config layers and its D-04-02 reasoning, with one that says the member body still writes no config, and that `sweepOrphans` then deletes each removed member's `enabled: false` declaration from both layers. Add one clause to the `sweepOrphans` doc comment and to the `--prune` lines of the file header. No phase, plan, or quick-task reference goes into a comment.

(5) Unit cases U1-U6 in test/orchestrators/plugin/uninstall.test.ts. Put them in the `--prune` block, after the D-05-13 cases. Run each through `uninstallWithFreshOwner` with `scope: "project"`, `marketplace: "mp"`, `plugin: "x"`, and `prune: true`, inside `withHermeticHome` and a `mkdtemp` cwd that a `finally` removes. Seed each with `seedDeclaringScope(locations, PRUNE_SCOPE, cwd)`. Write the layer files as the exact one-line strings of `<behavior>`, through `writeLayerConfigs` or `writeFile`. Follow the arrange, act, and assert comments of the neighboring cases. Assert whole values, as the neighbors do. If `fallow dupes` reports a clone group among the new cases, extract an arrange helper in the test file. Never add a `fallow-ignore` marker for it.

(6) GREEN: run this task's `<verify>` command. If the session's command guard refuses the compound line, or a part needs more than one foreground call, run the parts one at a time, in order. A long part can run in the background, and you then wait for its completion notification. Every part must exit 0.

(7) Commit. Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files features/plugin/prune.feature features/plugin/uninstall.feature extensions/pi-claude-marketplace/persistence/config-io.ts test/persistence/config-io.test.ts extensions/pi-claude-marketplace/persistence/config-write-back.ts test/persistence/config-write-back.test.ts extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts test/orchestrators/plugin/uninstall.test.ts`, and restage until it is clean. Stage those eight paths by name, never with `git add -A`. This shell does not split a variable into several paths, so list them. Commit in the foreground, with the longest tool timeout, under the title `fix(prune): drop a removed dependency's disabled declaration`. Give it a short body that names D-BG-1310 and PRUNECFG-01 and no GSD artifact. Never use `--no-verify`. The staged files are build inputs, so the hook runs `npm run check:commit`. If the hook fails, fix, restage, and commit again without `--amend`. Do not pipe `git commit` into `tail`, which shows only the commit-msg pass. After the commit, check `git status` for files that a hook rewrote. Do not push, and do not rebase.
  </action>
  <verify>
    <automated>node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/config-io.test.ts test/persistence/config-write-back.test.ts test/orchestrators/plugin/uninstall.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/config-io.ts extensions/pi-claude-marketplace/persistence/config-write-back.ts extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts && npm run test:cucumber:profile -- --profile adapter features/plugin/prune.feature features/plugin/uninstall.feature && npm run check:features && test "$(awk '/Scenario: Pruning removes a disabled dependency that nothing needs/{f=1;next} /Scenario:/{f=0} f' features/plugin/prune.feature | grep -cF 'Then the "claude-plugins.json" file of the project scope declares no plugins')" -eq 1 && test "$(grep -cF 'Then the "claude-plugins.local.json" file of the project scope declares no plugins' features/plugin/prune.feature)" -eq 1 && test "$(grep -cF 'Scenario: Uninstalling with --prune drops the disabled declaration of the dependency it uninstalls' features/plugin/uninstall.feature)" -eq 1 && test "$(grep -c 'export async function deletePluginConfigEntries' extensions/pi-claude-marketplace/persistence/config-write-back.ts)" -eq 1 && test "$(grep -c 'await dropPrunedDisabledDeclarations(' extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts)" -eq 1 && test "$(grep -c 'PRUNECFG-01' extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts)" -ge 1</automated>
  </verify>
  <done>`prune` and `uninstall --prune` delete the `enabled: false` entry of each dependency they remove from both config files of the scope, and nothing else. S1, S2, and S3 failed at BASE at their config `Then`, as step (2) names, and now pass. All of `prune.feature` and `uninstall.feature` pass under the adapter profile. U1-U6 and the two persistence cases pass, and the config-io, config-write-back, and uninstall pairs keep 100% direct coverage. `check:features` passes. One `fix(prune): ...` commit holds the eight files, and its hook passed. The SUMMARY records the red run and the green runs. Gate baselines measured at BASE: the scenario E config `Then` 0, the local-config `Then` 0, the S3 title 0, the batched delete export 0, the `dropPrunedDisabledDeclarations` call 0, and `PRUNECFG-01` in uninstall.ts 0. The target is 1, 1, 1, 1, 1, and at least 1.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: A failed prune save puts both config files back, and a refused `uninstall --prune` save converges on the next run (NFR-3, D-BG-1310)</name>
  <reversibility rating="reversible">A rollback snapshot of two more files and a recorder parameter. Removing them restores Task 1's behavior.</reversibility>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts, test/orchestrators/plugin/uninstall.test.ts, extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts, test/orchestrators/plugin/prune.test.ts, extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts, test/orchestrators/plugin/prune-rollback.test.ts</files>
  <read_first>
- extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts lines 205-338.
- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts lines 38-73, 212-298 (`metadataVerdict`, `holdsBytes`, `restoreMetadata`), and 359-479.
- extensions/pi-claude-marketplace/shared/errors-bridges.ts lines 160-170 (`McpWrittenFile`, the model for the new record type).
- extensions/pi-claude-marketplace/transaction/with-state-guard.ts lines 40-110 (the `saveState` dependency that the tests fault).
- Task 1's `dropPrunedDisabledDeclarations` and `sweepOrphans` in uninstall.ts, and the named uninstall's sweep call (about line 1554).
- test/orchestrators/plugin/prune.test.ts lines 1-195, 680-760, and 975-1040; test/orchestrators/plugin/prune-rollback.test.ts lines 1-110 and 1150-1290; test/orchestrators/plugin/uninstall.test.ts lines 4999-5160 (the retry proof, the model that U7 pins) and lines 160-200.
  </read_first>
  <behavior>
- R1 `PRUNECFG-01 / NFR-3: a rollback restores each config layer that still holds the sweep's own write` (prune-rollback.test.ts). Run `seed(locations)` and write both config files with distinct original texts. Prepare the rollback. Write other bytes to both files and pass them to `recordConfigWrites`. `rollback()` returns no failure. Both files hold their original bytes, and no `prune-backup-` directory is left.
- R2 `PRUNECFG-01 / NFR-3: a config layer that another writer changed after the sweep keeps the change, and its original stays in the backup`. Seed a base config with an original text. Prepare, write and record the sweep's bytes, then write independent bytes. `rollback()` returns exactly one failure, phase `config`, with the message `Prune rollback found an occupied metadata path at <base config path>.` The base file holds the independent bytes, and backup `8` holds the original.
- R3 `PRUNECFG-01: the recovery manifest lists both config layers after the state entry, and an absent layer stays absent`. Seed a base config only. The manifest's last three entries are the `state` entry, then `{ phase: "config", root: ".", target: "claude-plugins.json", backup: "8" }`, then `{ phase: "local config", root: ".", target: "claude-plugins.local.json", backup: null }`. After `rollback()` there is no failure, and the local file still does not exist.
- P1 `PRUNECFG-01: prune deletes the removed dependency's enabled: false entry from both layers` (prune.test.ts). Use `seedRecord` with the one-orphan manifest of the existing no-directory case. Base `{"schemaVersion":1,"plugins":{"orphan@mp":{"enabled":false},"other@mp":{}}}`. Local `{"schemaVersion":1,"plugins":{"orphan@mp":{"enabled":false}}}`. After `prune()` with `scope: "project"`, the notification is the one-orphan `(uninstalled) {dependency pruned}` report; pin it from the run. The base file is the two-space JSON with only `other@mp: {}`, and the local file is the two-space JSON with an empty `plugins` map. No `prune-backup-` directory is left.
- P2 `PRUNECFG-01 / NFR-3: a failed save restores both config layers byte for byte`. Use the same seed with both layers declaring `orphan@mp` disabled, and a `saveState` that rejects with `state save failed`, as the existing no-directory case does. Both layer files hold exactly the bytes written in the arrange step. `state.json` equals its bytes before the act, and no `prune-backup-` directory is left. The notification is the same `{unreadable}` failure with cause `state save failed` that the existing no-directory case shows.
- P3 `PRUNECFG-01 / NFR-3: a config edit after the sweep's write survives a failed save, with its original in the recovery backup`. Use the same seed with the base layer declaring `orphan@mp` disabled, and a `saveState` that first writes an independent text to the base file and then rejects. The base file holds the independent text. The manifest's `config` entry names a backup that holds the original text. The notification is the `{rollback partial}` failure, whose rollback details include `[config] (rollback failed)` with the occupied-metadata cause for `claude-plugins.json`; pin the exact text from the run.
- U7 `PRUNECFG-01 / NFR-3: a refused save of uninstall --prune leaves the deleted entries deleted, and the same command run again converges` (uninstall.test.ts). Seed `PRUNE_SCOPE` with base `{"schemaVersion":1,"plugins":{"x@mp":{},"d1@mp":{"enabled":false}}}` and local `EMPTY_LAYER`. The first run uses `createUninstallPlugin` with `{ ...REAL_UNINSTALL_TRANSACTION }` whose `withLockedStateTransaction` passes `{ saveState: () => Promise.reject(new Error("state save failed")) }` to the real `withLockedStateTransaction`, plus the hooks routing and completion cache that `createUninstallOwner` builds. After it, there is one `error` notification whose row is `x` `(failed)`; pin it from the run. `state.json` equals its bytes before, and the base file is the two-space JSON with an empty `plugins` map. The second run is `uninstallWithFreshOwner` with the same options. After it, the notification is the success report that lists `x` and the three pruned members as `(uninstalled)`; pin it from the run. No record is left, and the base file is unchanged since the first run.
  </behavior>
  <action>
Per D-BG-1310 and NFR-3.

(1) RED: write R1 and P2 first, and run their files on Task 1's tree. R1 fails because the rollback has no `recordConfigWrites`. P2 fails because a failed save leaves both config files without the orphan's entry. Record both failures for the SUMMARY.

(2) uninstall.ts:
- Export `interface ConfigLayerWrite` with readonly `path` (string) and `bytes` (Buffer), beside `PrunedMember`. Give it a doc comment modeled on `McpWrittenFile`: one config layer that the `--prune` sweep rewrote, and the exact bytes it wrote there; a prune rollback restores the layer only while the layer still holds these bytes (NFR-3).
- `sweepOrphans` takes the required argument `recordConfigWrite`, a function of one `ConfigLayerWrite` that returns nothing. Destructure it out of the arguments, so it does not reach `removeDependencyMember`, and pass it on to `dropPrunedDisabledDeclarations`.
- The drop calls `recordConfigWrite({ path, bytes })` the moment each layer write lands, with the bytes that `deletePluginConfigEntries` returned, and before it moves to the next layer. So a pass that a containment refusal stops partway still reports its earlier write.
- The named uninstall passes the module function `discardConfigWrite`, which keeps nothing. Its comment says why: a refused save of `uninstall --prune` leaves the deleted declarations, as it leaves the named plugin's own deleted declaration (the retry proof pins that). Running the command again converges (NFR-3), and only `prune` has a rollback. Give it a body that `@typescript-eslint/no-empty-function` accepts.

(3) prune-rollback.ts:
- Add `recordConfigWrites(writes)` to `PruneRollback`, typed with `ConfigLayerWrite` through a type-only import from `./uninstall.ts`, with a doc line like `recordMcpWrites`. It records `bytes` by `path` into the same own-write map that the MCP writes use. Rename that map to a name that covers both, and give both record members one shared body, so that `fallow dupes` finds no clone. If a boundary or cycle gate refuses the import, move `ConfigLayerWrite` to prune-rollback.ts and import it type-only into uninstall.ts and prune.ts. Report that in the SUMMARY.
- `preparePruneRollback` snapshots `locations.baseConfigJsonPath` as phase `config` and `locations.localConfigJsonPath` as phase `local config`, both under root `locations.scopeRoot`. It takes them AFTER the state snapshot, at indices `targets.length + 4` and `targets.length + 5`, so every existing backup index stays as it is. The recovery manifest lists them after the state entry.
- `rollback()` restores both through the existing `restoreMetadata` with their own-write bytes. They go in the metadata loop after `mcp adapter`, before the state restore. A layer that still holds the sweep's write gets its original back. A layer that was absent and still is stays untouched. Any other content gets the existing occupied refusal, and its original stays in the backup.

(4) prune.ts: in the locked closure, keep a list `configWrites` of `ConfigLayerWrite`, and pass `sweepOrphans` a recorder that appends to it. In the catch, inside the existing `if (backup !== undefined)` arm, call `backup.recordConfigWrites(configWrites)` right before `backup.rollback()`. Change nothing else in prune.ts.

(5) Write the remaining cases of `<behavior>`: R2 and R3 in prune-rollback.test.ts, P1 and P3 in prune.test.ts, and U7 in uninstall.test.ts. U7 imports `REAL_UNINSTALL_TRANSACTION` from uninstall.ts and `withLockedStateTransaction` from `transaction/with-state-guard.ts`. Follow the neighboring cases' fixtures, fault hooks, hermetic environment, and arrange, act, and assert layout. Assert whole values. Do not add a `fallow-ignore` marker; extract a helper if `fallow dupes` reports a clone group.

(6) GREEN: run this task's `<verify>` command, in parts if needed, as Task 1 step (6) says.

(7) Commit. Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts test/orchestrators/plugin/uninstall.test.ts extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts test/orchestrators/plugin/prune.test.ts extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts test/orchestrators/plugin/prune-rollback.test.ts`, and restage until it is clean. Stage those six paths by name, and commit in the foreground under the title `fix(prune): restore the config files when a prune rolls back`. Give it a short body that names D-BG-1310 and NFR-3. Follow the same hook, `--no-verify`, `--amend`, `tail`, push, and rebase rules as Task 1 step (7).
  </action>
  <verify>
    <automated>node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/uninstall.test.ts test/orchestrators/plugin/prune.test.ts test/orchestrators/plugin/prune-rollback.test.ts test/integration/standalone-prune.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts && npm run test:cucumber:profile -- --profile adapter features/plugin/prune.feature && test "$(grep -c '"local config"' extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts)" -ge 1 && test "$(grep -c 'locations.localConfigJsonPath' extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts)" -ge 1 && test "$(grep -c 'backup.recordConfigWrites(configWrites)' extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts)" -eq 1 && test "$(grep -c 'recordConfigWrite: discardConfigWrite' extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts)" -eq 1</automated>
  </verify>
  <done>A prune whose state save fails puts both config files back, byte for byte, while they still hold the sweep's own write. A file that another writer changed keeps that change, and its original stays in `prune-backup-*/`, named by a `{rollback partial}` row. A refused `uninstall --prune` save leaves the deletions, and the next run converges. R1-R3, P1-P3, and U7 pass. R1 and P2 failed first on Task 1's tree, and the SUMMARY records both failures. The uninstall, prune, and prune-rollback pairs keep 100% direct coverage. The standalone-prune integration file and `prune.feature` pass. One `fix(prune): ...` commit holds the six files, and its hook passed. Gate baselines measured at BASE: `"local config"` 0, `locations.localConfigJsonPath` in prune-rollback.ts 0, the record call in prune.ts 0, and the discarding recorder in uninstall.ts 0. The target is at least 1, at least 1, 1, and 1.</done>
</task>

<task type="auto">
  <name>Task 3: Record D-BG-1310, close PRUNECFG-01, note PRUNECFG-02, and describe the deletion in the CHANGELOG and the dependency guide</name>
  <reversibility rating="reversible">Planning, changelog, and documentation text only.</reversibility>
  <files>.planning/PROJECT.md, .planning/BACKLOG.md, CHANGELOG.md, docs/dependency-resolution.md</files>
  <read_first>
- .planning/PROJECT.md: the D-BG-1309 row (`grep -n 'D-BG-1309 (' .planning/PROJECT.md`) and the D-BG-1308 row before it, rows of the same three-column form: decision, rationale, outcome. Each row is one long line. Find the row by grep, because another batch item may have shifted the lines.
- .planning/BACKLOG.md: the entries from `## PRUNECFG-01` to `## PRUNEISLAND-01` (`grep -n '^## PRUNECFG-01\|^## PLUGALIAS-01' .planning/BACKLOG.md`), and the closed `## ~~NOTINSTALLMSG-01:` entry, whose `**CLOSED <date>** by quick task <id> (fixed).` paragraph is the form to copy.
- CHANGELOG.md lines 1-22: the `## [Unreleased]` entry, its sub-bullet that starts `A config that a load writes from the installation records`, and the `pi_claude_marketplace_list` sub-bullet after it.
- docs/dependency-resolution.md lines 226-260: the sections `## Pruning dependencies nothing needs` and `## Pruning without uninstalling a named plugin`.
- .agents/skills/changelog/SKILL.md, rules/entries.md, and rules/examples.md; the `simple-english` skill (Plain mode) and the `humanizer` skill.
  </read_first>
  <action>
Per D-BG-1310 and P13-DC-04. Write the texts R1 to R7 from the plan's "Record texts" section. Reword a text only to pass a self-check of the changelog, simple-english, or humanizer rules, and only if every backticked token and every decision or requirement ID stays.

(1) .planning/PROJECT.md: insert R1 as a new line right after the D-BG-1309 row, then apply R2 to the D-BG-1309 row. Change no other row.

(2) .planning/BACKLOG.md: apply R3 to the PRUNECFG-01 entry. Its heading takes the struck-through form with ` -- CLOSED`, and the `**CLOSED 2026-11-09**` paragraph goes between the heading and the existing `Noted 2026-11-08 ...` paragraph, which stays byte for byte. Then insert R4 as a new entry right after it, before the PLUGALIAS-01 heading, with one blank line around each heading.

(3) CHANGELOG.md: insert R5 as a sub-bullet of the `## [Unreleased]` entry, right after the sub-bullet that starts `A config that a load writes from the installation records`. Indent it two spaces like its siblings, with no PR number. Check it against the changelog skill: one sentence of 25 words or fewer, no `-ing` clause after a comma, no should, would, could, or may, no semicolon, and no dash between two statements.

(4) docs/dependency-resolution.md: insert R6 and R7 where the "Record texts" section places them, each as its own paragraph with a blank line before and after it. Apply the simple-english (Plain) and humanizer checks to both.

(5) Do not edit `.planning/DUBIOUS-CHOICES.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `README.md`, `README.es.md`, or `docs/output-catalog.md`. The SUMMARY lists the P13-DC-04 status line for the parent.

(6) Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .planning/PROJECT.md .planning/BACKLOG.md CHANGELOG.md docs/dependency-resolution.md`, and restage until it is clean. Stage the four paths by name and commit in the foreground under the title `docs(prune): record the dropped disabled declaration`. These files are not build inputs, so the hook skips the npm checks. Never use `--no-verify` or `git add -A`. Do not push, and do not rebase.
  </action>
  <verify>
    <automated>test "$(grep -cF '**D-BG-1310 (' .planning/PROJECT.md)" -eq 1 && test "$(grep -F '**D-BG-1309 (' .planning/PROJECT.md | grep -cF '| Reversed 2026-11-09 by D-BG-1310 |')" -eq 1 && test "$(grep -A1 -F '**D-BG-1309 (' .planning/PROJECT.md | tail -n 1 | grep -cF '**D-BG-1310 (')" -eq 1 && test "$(grep -c '^## .*PRUNECFG-01:' .planning/BACKLOG.md)" -eq 1 && test "$(grep -c '^## ~~PRUNECFG-01:' .planning/BACKLOG.md)" -eq 1 && test "$(grep -c '^## PRUNECFG-02:' .planning/BACKLOG.md)" -eq 1 && test "$(awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | grep -F 'uninstall --prune' | grep -c '^  - ')" -eq 1 && test "$(grep -c 'D-BG-1310' docs/dependency-resolution.md)" -ge 1 && SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .planning/PROJECT.md .planning/BACKLOG.md CHANGELOG.md docs/dependency-resolution.md</automated>
  </verify>
  <done>PROJECT.md holds R1 on the line after the D-BG-1309 row, and that row ends with `| Reversed 2026-11-09 by D-BG-1310 |`, its other cells unchanged. PRUNECFG-01 is closed in the R3 form with its `Noted` paragraph kept, and PRUNECFG-02 follows it. The `[Unreleased]` entry has the R5 sub-bullet after the config sub-bullet, and it passes the changelog, simple-english, and humanizer checks. `docs/dependency-resolution.md` has R6 and R7 in their sections. Pre-commit passes on the four files, and one `docs(prune): ...` commit holds them. Gate baselines measured at BASE: the D-BG-1310 row 0, the reversed D-BG-1309 outcome 0, D-BG-1310 on the line after D-BG-1309 0, the closed PRUNECFG-01 heading 0, the PRUNECFG-02 heading 0, `[Unreleased]` sub-bullets that name `uninstall --prune` 0, and `D-BG-1310` in the guide 0. The target is 1 each, at least 1 for the guide. The PRUNECFG-01 heading count is 1 and stays 1.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user-owned config files -> the `--prune` sweep | `claude-plugins.json` and `claude-plugins.local.json` are hand-editable at any time, outside the state lock, and the path can be a symlink. The sweep reads and rewrites them under the scope's state lock. |
| prune rollback -> live files | On a failed save, the rollback writes saved bytes back over files that another program may have changed since the sweep's write. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cpl-01 | Tampering | `dropPrunedDisabledDeclarations` (`orchestrators/plugin/uninstall.ts`) deleting a declaration that the user still wants | medium | mitigate | The sweep deletes only an entry whose value is `enabled: false`, and only for a member it actually removed (`removed: true`). An enabled entry, a failed member's entry, and every unrelated key stay, and a layer with nothing to delete is not rewritten (WR-02). U1, U2, U3, P1, and S1-S3 pin it. |
| T-cpl-02 | Elevation of privilege / Tampering | the layer write through `saveConfig` (`persistence/config-io.ts`) | medium | mitigate | `saveConfig` keeps its `assertPathInside(scopeRoot, ...)` check, which refuses every symlink segment. The sweep rethrows `PathContainmentError` and never logs it away (NFR-10), so the uninstall fails unsaved and a prune rolls back. U6 pins that nothing was written through the link. |
| T-cpl-03 | Tampering | `rollback()` in `orchestrators/plugin/prune-rollback.ts` overwriting another writer's edit to a config file | medium | mitigate | The config files go through the existing `restoreMetadata`. It writes the original only while the live bytes equal the sweep's recorded write, it never moves or deletes the live file, and it keeps the original in `prune-backup-*/` with a `{rollback partial}` row otherwise. R2 and P3 pin it. |
| T-cpl-04 | Denial of service | a config write failure stopping a prune whose rollback cannot restore skill directories | low | mitigate | A failed write other than a containment refusal is debug-logged, and the command commits with the leftover entry, as Claude Code logs a failed settings write. U5 pins it. |
| T-cpl-05 | Information disclosure | the new debug lines | low | accept | They name only the config file's basename and the error message, and they print only when `PI_CLAUDE_MARKETPLACE_DEBUG=1` is set (OBS-01). |
| T-cpl-06 | Repudiation | a refused `uninstall --prune` save that leaves config deletions with records still present | low | accept | This is the uninstall path's existing NFR-3 model, the same as for the named plugin's declaration: the deleted entries were inert, and the same command run again converges. U7 pins it, and D-BG-1310 records it. |
| T-cpl-SC | Tampering | npm/pip/cargo installs | low | accept | The plan installs no package and changes no dependency file. |
</threat_model>

<verification>
- Each task's `<verify>` passes, and each commit's hook passes. The SUMMARY records Task 1's red scenario run (command, exit status, and failing step of each scenario), Task 2's red unit runs, and the green runs.
- AGENTS.md "Build verification": Tasks 1 and 2 commit build inputs, so `npm run check` must pass on the merged tree in the main checkout before the batch finishes. It also runs the cucumber suite under the builtin profile and every integration test. An executor in an isolated worktree states in the SUMMARY that the batch coordinator runs it after the merge. An executor that committed in the main checkout runs it in the foreground with the longest timeout, or in the background and waits for completion, and records the command, exit status, commit, and Node version.
- Hermetic home: every test command in this plan isolates the Pi home, through the `--import` of `test/platform/isolated-pi-home.ts` or the cucumber support module `features/support/isolated-pi-home.ts`. Never run `node --test` without that `--import`.
- `git status` is clean after Task 3, apart from the SUMMARY the executor writes.
</verification>

<success_criteria>
- `prune` and `uninstall --prune` delete the `enabled: false` entry of each dependency they remove, from both config files of the scope, and leave every other entry. An absent or invalid file is not rewritten, and a failed write never fails the command. A symlinked file fails it, as NFR-10 demands.
- A failed prune save restores both config files under the own-write rule. A refused `uninstall --prune` save converges on the next run.
- S1, S2, and S3 fail without the change and pass with it. Every scenario of `prune.feature` and `uninstall.feature` passes under the adapter profile.
- The config-io, config-write-back, uninstall, prune, and prune-rollback pairs keep 100% direct coverage, and `npm run check` passes on the merged tree at the batch gate.
- PROJECT.md holds D-BG-1310 after D-BG-1309, which reads reversed. PRUNECFG-01 is closed, PRUNECFG-02 is noted, and the CHANGELOG `[Unreleased]` entry and the dependency guide describe the change.
</success_criteria>

<output>
Create `.planning/quick/261109-cpl-prunecfg-01-prune-and-uninstall-prune-drop-a-removed-depende/261109-cpl-SUMMARY.md` with `status: complete` in its frontmatter. Include:
- BASE, the three commits, every red and green run (command, exit status, and the failing step or assertion of each red run), any scenario literal changed after the prototype run in Task 1 step (2), and the `npm run check` result, or the statement that the batch coordinator runs it after the merge.
- `## Questionable choices`, each with the choice, the alternative, why the alternative was not taken, and a severity. At least these, plus any you made:
  - (1) Both layer files are swept, where upstream's prune edits one settings file per scope and the item names `claude-plugins.json`. Under SC-1 the local file is a layer of the same scope, and `overwriteDisabledMemberEntries` sets the precedent. Medium.
  - (2) Only `enabled: false` entries go. Claude Code deletes the entry whatever its value. D-04-02 keeps an enabled entry as the user's request to install, and PRUNECFG-02 asks the user. High.
  - (3) A failed layer write is debug-logged and fails nothing. The alternative is to fail the command, as the enable cascade's config phase does. Not taken, because Claude Code logs the failure and goes on, and a failed prune can leave skill directories for manual recovery. Medium.
  - (4) An invalid layer is skipped with a debug line, where the house preference is to fail closed on corrupt data. `prune` never read the config before, the sweep decides nothing from it, a standalone `uninstall --prune` already refuses an invalid layer (CFG-03), and WR-02 helpers skip invalid layers. Medium.
  - (5) `uninstall --prune` restores no config file on a refused save. The BACKLOG's candidate direction asked for one. Not taken, because its NFR-3 model is retry convergence: the retry proof pins that the named plugin's declaration stays deleted, and restoring only the members' entries would split one transaction's rule. Medium.
  - (6) The deletion runs once per sweep in `sweepOrphans`, after the `removeDependencyMember` loop, not inside the member body, so each file gets one write and the member body stays total. Low.
  - (7) `sweepOrphans` takes a recorder that the named uninstall discards, instead of returning the writes, so a pass stopped partway by a containment refusal still reports its earlier write to prune's rollback. Low.
  - (8) A symlinked config file now fails a prune that has a disabled entry to delete in it (NFR-10), where a prune never read the config before. Low.
  - (9) A new decision ID, D-BG-1310, instead of rewriting D-BG-1309 in place. Low.
  - (10) Scenario E keeps its title and gains a `Then`, and the local-config and `uninstall --prune` cases are new scenarios. Low.
  - (11) `.planning/DUBIOUS-CHOICES.md` is not edited: six batch items would change adjacent lines of its list. Low.
- `## Threat Flags` (AGENTS.md), even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
- `## Parent lines`: in `.planning/DUBIOUS-CHOICES.md`, mark P13-DC-04 fixed by quick 261109-cpl (D-BG-1310), both in "Decisions waiting on you" and in the Phase 13 list. No STATE.md or ROADMAP.md lines; the quick-batch workflow records the task.
</output>

## Coordinator amendments (2026-11-09, binding; they override the tasks above)

**Shared records are written by the coordinator, not by this executor.** Do NOT
edit `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, or
`.planning/DUBIOUS-CHOICES.md`. Every task step that writes one of them is
replaced by this: put the exact text you would have written (new decision
rows, superseded/reversed markers, BACKLOG closures or new entries, the
CHANGELOG sub-bullet) in the SUMMARY under a `## Parent lines` heading, one
sub-heading per file, ready to paste. The six batch items would otherwise all
queue on the same three files. The rest of each task (code, tests, scenarios,
other docs) runs as planned.

**User answers (2026-11-09):**
- Delete only `enabled: false` entries (D-04-02 stands; PRUNECFG-02 opens).
- FAIL CLOSED: when a layer config file is invalid or its write fails, the
  command refuses with `{unreadable}` (or the existing failure row for a
  write error) and `prune` rolls back state and both config files; do not
  debug-log and succeed. A symlinked file still fails as planned (NFR-10).
  Adjust unit cases U4/U5 and add a scenario for the invalid-file refusal if
  the harness can drive it cheaply.
- `uninstall --prune` keeps the retry-converges model (no config restore).

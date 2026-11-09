---
quick_id: 261109-cpj
description: the model-facing list tools tag a disabled plugin `[disabled]` with its own `disabled` filter, and count each marketplace's plugins as the browse picker does (D-BG-1011, D-BG-1012)
date: 2026-11-09
mode: quick-batch
phase: quick-261109-cpj
plan: 01
type: execute
wave: 2
depends_on: ["261109-cpm"]
files_modified:
  - features/plugin/model-tools.feature
  - extensions/pi-claude-marketplace/edge/marketplace-counts.ts
  - test/edge/marketplace-counts.test.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - test/edge/handlers/tools.test.ts
  - docs/competitive-analysis/pi-plugins.md
autonomous: true

must_haves:
  truths:
    - 'D-BG-1012: each `pi_claude_marketplace_list` line reads `[<scope>] <name> -- <offered> available • <installed> installed -- <source>`. `<offered>` is the number of entries in the marketplace catalog, and the `available` part is left out when the catalog cannot be read or declares a name Claude Code refuses (D-PL5-28). The ` • <installed> installed` part appears only when the scope record holds at least one plugin of the marketplace, and it counts every recorded plugin, disabled ones included, as the picker counts them (D-BG-1201). With neither part, the line is `[<scope>] <name> -- <source>`.'
    - 'D-BG-1012: the browse picker and the list tool word the counts through one module, `edge/marketplace-counts.ts`. The first screen of the picker is unchanged: `features/plugin/browse.feature`, `test/edge/handlers/plugin/browse.test.ts`, and `test/edge/browser/plugin-browser.test.ts` pass with no edit.'
    - 'D-BG-1011: `pi_claude_marketplace_plugin_list` shows an installed plugin that is disabled as `[disabled] <name>  <version>`, with its reasons if it has any. It shows the row with no filter and with `{"disabled":true}`. No other filter returns it.'
    - 'D-BG-1011: `installed` returns the installed plugins that are enabled (installed, upgradable, partially installed, partially upgradable). `unavailable` returns only the plugins this system cannot install (structurally unavailable and partially available). `available` is unchanged. Two or more filters return the union of their tags (PL-1), and no filter returns every plugin.'
    - 'D-BG-1011: the parameter descriptions are: installed `Include installed plugins that are enabled.`, unavailable `Include manifest-declared plugins that are not installable on this system.`, and the new disabled `Include installed plugins that are disabled.`'
    - 'TOOL-03 / D-BG-1006: after the calls that use every parameter of both tools, `disabled` included, the config and installation record bytes of both scopes are unchanged, and both scopes stage the same skills. In the unit cases, neither tool opens a network connection.'
    - 'Every changed or added scenario fails on the product before its change and passes after it. The SUMMARY records both red runs.'
    - 'PROJECT.md records D-BG-1011 and D-BG-1012. It marks D-BG-1004 superseded by D-BG-1011, and D-BG-1005 and D-BG-1010 superseded by D-BG-1012. CHANGELOG.md and docs/competitive-analysis/pi-plugins.md describe the new output, and `npm run check` passes.'
  artifacts:
    - path: extensions/pi-claude-marketplace/edge/marketplace-counts.ts
      provides: 'offeredPluginCount and marketplaceDescription, shared by the browse picker and the list tool (D-BG-1201, D-BG-1012)'
      contains: 'export async function offeredPluginCount'
    - path: test/edge/marketplace-counts.test.ts
      provides: 'the pair test of the shared counts module'
      contains: 'describe("marketplaceDescription"'
    - path: extensions/pi-claude-marketplace/edge/handlers/tools.ts
      provides: 'the counted marketplace line, the `[disabled]` tag, and the `disabled` filter'
      contains: '"[disabled]"'
    - path: features/plugin/model-tools.feature
      provides: 'the scenarios for the counts, the disabled tag, and each filter'
      contains: 'The disabled filter returns only the installed plugins that are disabled'
  key_links:
    - from: extensions/pi-claude-marketplace/edge/handlers/tools.ts
      to: extensions/pi-claude-marketplace/edge/marketplace-counts.ts
      via: 'buildMarketplaceListResult counts and words each entry through the shared module'
      pattern: 'marketplaceDescription\('
    - from: extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
      to: extensions/pi-claude-marketplace/edge/marketplace-counts.ts
      via: 'the first-screen row description of the picker'
      pattern: 'marketplaceDescription\('
    - from: extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
      to: extensions/pi-claude-marketplace/edge/marketplace-counts.ts
      via: 'loadMarketplaceEntries counts each catalog'
      pattern: 'offeredPluginCount\('
    - from: features/plugin/model-tools.feature
      to: extensions/pi-claude-marketplace/edge/handlers/tools.ts
      via: 'the scripted model calls both tools, and the call table reads the result text that the next model call carries'
      pattern: '\[disabled\] eps  1\.0\.0'
---

<objective>
The user reviewed the behavioral-gaps dubious choices on 2026-11-09 and asked for this fix before the PR (`.planning/DUBIOUS-CHOICES.md`, "Decisions waiting on you", first bullet; P10-DC-02, P10-DC-03, P10-DC-22). The two model-facing tools in `extensions/pi-claude-marketplace/edge/handlers/tools.ts` change in two ways:

- **D-BG-1012 (new): `pi_claude_marketplace_list` counts a marketplace's plugins as the browse picker does.** The line now uses the D-BG-1201 wording of the picker after `[<scope>] <name> -- `: `{offered} available`, then ` • {installed} installed` when the scope records any plugin of the marketplace, then ` -- {source}`. The old count counted installed plugins only, and the model could read it as the size of the catalog. The tool and the picker share one module for the counts and their wording, so the two surfaces cannot drift. This supersedes D-BG-1005 and D-BG-1010, and the line shape that D-BG-1002 kept.
- **D-BG-1011 (new): an installed plugin that is disabled reads `[disabled]` in `pi_claude_marketplace_plugin_list`, and it has its own `disabled` filter.** `installed` means installed and enabled. `unavailable` means only the plugins that cannot be installed on this system. The picker already tags a disabled plugin `[disabled]`. This supersedes D-BG-1004 and the tool projection of D-54-01, which put a disabled plugin under `[unavailable]`. The slash command's `--installed` keeps including disabled plugins, and `orchestrators/plugin/list-flow.ts` does not change.

Purpose: a model reads the same fact in the same words as a user of the picker, and each filter returns exactly the plugins its tag names.
Output: one shared module and its pair test, the two picker consumers that switch to it, the tool and its unit tests, the scenarios with two recorded red proofs, the decision records, CHANGELOG.md, and the doc paragraph. There are three commits, and `npm run check` passes on the item's tree.

Choice made without the user, which the SUMMARY records: the `{installed}` count is the count of the picker and of Claude Code. It counts every plugin that the scope records for the marketplace, disabled ones included, so the `tools` fixture reads `3 installed`, while the `installed` filter returns 2 of those 3 plugins. The user's decision names the wording of the picker. Reusing the picker's own function is the literal reading, and changing the count would be a different decision.

Coverage of the item (quick-batch has no ROADMAP goal, REQ, or RESEARCH; the archived TOOL-01..03 requirements stay satisfied):

| Source | Item | Task | Status |
| --- | --- | --- | --- |
| GOAL | the marketplace line takes the picker's `{offered} available` and ` • {installed} installed` wording | 1 | COVERED |
| GOAL | a new `[disabled]` tag with its own `disabled` boolean filter | 2 | COVERED |
| GOAL | `installed` = installed and enabled; `unavailable` = cannot install on this system only | 2 | COVERED |
| GOAL | the parameter descriptions are updated | 2 | COVERED |
| GOAL | the scenarios are updated, and each fails without its change | 1, 2 | COVERED |
| GOAL | the docs describe the new output (only `docs/competitive-analysis/pi-plugins.md` describes it; neither README does) | 3 | COVERED |
| CONTEXT | D-BG-1004, D-BG-1005, D-BG-1010 superseded; the D-54-01 tool projection superseded | 3 (records), 1 and 2 (code comments) | COVERED |
| CONTEXT | CHANGELOG sub-bullet under the Unreleased behavioral-gaps entry | 3 | COVERED |
| CONTEXT | `## Threat Flags` in the SUMMARY | output | COVERED |
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/milestones/behavioral-gaps-phases/10-model-facing-tools/10-CONTEXT.md
@.agents/skills/cucumber/SKILL.md
@.agents/skills/cucumber/rules/features.md
@.agents/skills/local-verification/SKILL.md
@.agents/skills/local-verification/rules/commands.md
@.agents/skills/local-verification/rules/gates.md
@.agents/skills/committing/SKILL.md
@.agents/skills/typescript-unit-tests/SKILL.md
@.agents/skills/typescript-unit-tests/rules/cases.md
@.agents/skills/typescript-unit-tests/rules/pairing-and-design.md
@.agents/skills/typescript-style/rules/comments.md
@.agents/skills/changelog/SKILL.md
@.agents/skills/changelog/rules/entries.md

Interfaces the tasks use (read from the tree on 2026-11-09):

- `edge/handlers/plugin/browse.ts` lines 65-87: private `offeredPluginCount(name: string, source: ParsedSource, manifestPath: string): Promise<number | undefined>`. It calls `loadMarketplaceManifest(manifestPath)` (`domain/manifest.ts`) and then `assertRecordedMarketplaceName(name, source, manifest.name)` (`domain/name.ts`), and it returns `manifest.plugins.length`. On any failure it returns undefined and writes a `hookDebugLog` line. Its caller, `loadMarketplaceEntries`, is at lines 95-109.
- `edge/browser/plugin-browser.ts` lines 115-132: private `marketplaceDescription(m: MarketplaceEntry): string`. It builds `{pluginCount} available` when the count is defined, and `{installedCount} installed` when installedCount > 0. It joins the parts with ` • ` and adds ` -- {source}`, or returns the source alone when there is no part. Its call site is at line 320. `MarketplaceEntry` (lines 54-64) declares `pluginCount: number | undefined`, `installedCount: number`, and `source: string`.
- `orchestrators/marketplace/shared.ts` line 1033: `recordedManifestPath(record): string`. `loadVisibleMarketplaces` is at line 815.
- `orchestrators/marketplace/list.ts`: `loadMarketplaceListEntries({ cwd, scope? })` returns `{ scope, record, block }` entries and reads state and config only (ML-3). Leave this file unchanged, so the `marketplace list` slash command keeps reading no catalog.
- `orchestrators/plugin/list-flow.ts::shouldShow`: the loader's `installed` admits installed, upgradable, disabled, partially-installed, and partially-upgradable rows. Its `unavailable` admits the structural unavailable bucket only, `partial` admits the not-installed partially available rows, and `remote` admits the cold git rows. Leave this file unchanged.
- `domain/source.ts`: the path variant of `ParsedSource` is `{ kind: "path", raw, logical }`.
- `shared/debug-log.ts`: `hookDebugLog(detail: string, tag = "hooks")`.
- `test/edge/handlers/tools.test.ts` helpers: `createHermeticScope`, `seedScope`, `seedUrlSourceMarketplace`, `registerToolUnderTest`, `marketplaceRootIn`, `manifestPathIn`, `versionCases`, `mixedMarketplace`, `filterCases`. `seedScope` writes a `marketplace.json` that declares every seeded plugin whose `inManifest` is not false.
- `test/platform/hermetic-environment.ts`: `createHermeticEnvironment(t, prefix)` returns a case-owned `{ cwd, home, agentDir, root }` and registers its removal.

Run tests only through the npm scripts below, or with `--import` of `test/platform/isolated-pi-home.ts` at the root of your own worktree. Never run them with plain `node --test`, which reads the real `~/.pi`. The cucumber sandbox is hermetic.

Baselines measured at the branch head 9a398226 (unchanged by the files of 261109-cpm): `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature` passes 11 scenarios in about 26 s. The same command on `features/plugin/browse.feature` passes 10 scenarios. `npm run --silent test:coverage:direct -- <tools.ts> <browse.ts> <plugin-browser.ts>` exits 0. The owner test of tools.ts runs 46 cases.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: The list tool counts each marketplace's plugins as the browse picker does, through one shared module (D-BG-1012)</name>
  <files>features/plugin/model-tools.feature, extensions/pi-claude-marketplace/edge/marketplace-counts.ts, test/edge/marketplace-counts.test.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts, extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts, extensions/pi-claude-marketplace/edge/handlers/tools.ts, test/edge/handlers/tools.test.ts</files>
  <precondition>`node_modules/.bin/cucumber-js` and `node_modules/.bin/fallow` exist in this worktree. If they do not, halt and report it. Do not symlink `node_modules` into the worktree: the link shows as an untracked file and blocks the worktree cleanup.</precondition>
  <read_first>
    - features/plugin/model-tools.feature (the whole file, 235 lines)
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts (lines 1-215: the header and tool 1)
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts (lines 1-110)
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts (lines 1-135 and 310-325)
    - test/edge/handlers/tools.test.ts (lines 1-418 for the helpers, and lines 419-720 for the list-tool cases)
    - test/edge/handlers/plugin/browse.test.ts (lines 320-390: the three D-BG-1201 cases, which keep passing unchanged)
    - test/platform/hermetic-environment.ts
  </read_first>
  <action>
This task is one vertical slice. The scripted model calls `pi_claude_marketplace_list`, the tool counts each catalog through the shared module, and the model reads the counted line. Seven files change. Two of them are new, and two get the code that is moved out of them. The scenarios and the picker stay green at the task's one commit.

1. Red first (behavioral). In `features/plugin/model-tools.feature`, change only the result text of the `pi_claude_marketplace_list` calls to the D-BG-1012 form. Re-align each edited table.
   - "The model reads the marketplaces the list tool returns": keep the title, because `.agents/skills/cucumber/rules/layout.md` names it as the Phase 10 seed. Its tool result row becomes `pi_claude_marketplace_list returned: [project] tools -- 7 available • 3 installed -- {home}/marketplaces/tools\n[user] extras -- 2 available • 1 installed -- {home}/marketplaces/extras`.
   - "A list call with a scope returns only the marketplaces of that scope": both user results read `pi_claude_marketplace_list returned: [user] extras -- 2 available • 1 installed -- {home}/marketplaces/extras`, and the project result reads `pi_claude_marketplace_list returned: [project] tools -- 7 available • 3 installed -- {home}/marketplaces/tools`.
   - "No call to either tool changes the config, the installation record, or what is installed": its three list results read the same user line.
   Derive the numbers instead of copying what a run prints. The catalog of `tools` declares 7 entries: the six of the published manifest in the Background, plus `ghp`, which the git-repositories step appends (`features/lib/git-plugin.ts::offerGitPlugins`). Its project record holds 3 plugins: `alpha`, `delta`, and the disabled `eps`. `extras` declares 2 entries, and its user record holds 1, `kilo`. Then run `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature` against the unchanged product. Confirm that exactly these three scenarios fail, and that each fails on a list-tool result row. Record red proof A in the SUMMARY: the command, the three failing titles, and the exit status.

2. Create `extensions/pi-claude-marketplace/edge/marketplace-counts.ts` by moving two helpers. Do not copy them: fallow dupes fails the commit on a clone.
   - Move the `offeredPluginCount` helper of `edge/handlers/plugin/browse.ts` and export it with the same signature and the same body (loader, then the name check, then the entry count, undefined on any failure). It now serves two surfaces, so its debug line becomes neutral: the message `marketplace counts: manifest load failed for <manifestPath>: <errorMessage(err)>` under the tag `marketplace`. No test reads this line.
   - Move the `marketplaceDescription` helper of `edge/browser/plugin-browser.ts` and export it with the same body. Its parameter changes from `MarketplaceEntry` to an inline readonly object type with `pluginCount: number | undefined`, `installedCount: number`, and `source: string`. A named exported interface that no module imports fails fallow's unused-type check, an unexported one fails its private-type-leak check, and importing `MarketplaceEntry` from plugin-browser.ts would close an import cycle.
   - The module imports only from domain/ (`manifest.ts`, `name.ts`, and the `ParsedSource` type from `source.ts`) and shared/ (`debug-log.ts`, `errors.ts`). It has no orchestrators/ import, so the pure-UI picker can import it.
   - Keep the moved JSDoc and cite D-BG-1201 and D-BG-1012. The module header says that the module gives the counts and their wording to the picker's marketplace rows and to the `pi_claude_marketplace_list` lines, and that it is read-only and offline (NFR-5, NFR-8).

3. Point the picker at the module.
   - browse.ts imports `offeredPluginCount` from `../../marketplace-counts.ts`. It deletes its own copy and the imports that only the copy used: `loadMarketplaceManifest`, `assertRecordedMarketplaceName`, `hookDebugLog`, and `errorMessage`. It keeps `ParsedSource` and `sourceLogical`. Its header and the `loadMarketplaceEntries` JSDoc now say that each catalog is counted through the shared module.
   - plugin-browser.ts imports `marketplaceDescription` from `../marketplace-counts.ts` and deletes its own copy. It keeps `hookDebugLog` and `errorMessage`, which its plugin loader still uses. Its BLOCK C header names the new import as the D-BG-1201 wording that it shares with the list tool.
   - The call sites keep their arguments, so the picker renders the same rows.

4. Create `test/edge/marketplace-counts.test.ts`, the new pair. Follow the `typescript-unit-tests` rules: one top-level `describe()` per export, `// arrange`, `// act`, and `// assert` phases, and whole-value assertions.
   - `describe("offeredPluginCount")` has three cases. Each case writes a catalog under its own `createHermeticEnvironment(t, ...)` directory and uses the path source `{ kind: "path", raw, logical: raw }`:
     - A catalog with 3 entries, whose name equals the record name, returns 3.
     - A catalog whose text is not valid JSON returns undefined.
     - A catalog name that Claude Code refuses for the record returns undefined (D-PL5-28). Use the record `official` with the catalog `claude-plugins-v2`, the pair that `test/edge/handlers/plugin/browse.test.ts` already proves refused.
   - `describe("marketplaceDescription")` has one sibling `test()` per typed row: both counts; available only (installed 0); an empty catalog, which reads `0 available`; installed only (no catalog count); and neither, which returns the source alone. Use numbers and a source literal of their own, not the rows of plugin-browser.test.ts, so that fallow dupes finds no clone group.

5. Switch tool 1 in `edge/handlers/tools.ts` (`buildMarketplaceListResult`).
   - Build each line as `[<scope>] <record.name> -- <description>`. The description is `marketplaceDescription` of three values:
     - `pluginCount` = `offeredPluginCount(record.name, source, recordedManifestPath(record))`. Import `recordedManifestPath` beside `loadVisibleMarketplaces`.
     - `installedCount` = `Object.keys(record.plugins).length`, which is the count of the picker: every recorded plugin, disabled ones included.
     - `source` = `sourceLogical(source)`.
   - Map the entries through `Promise.all`. It keeps the project-first order and needs no awaited loop (`no-await-in-loop` is an error here).
   - Keep the `No marketplaces configured.` text, the details, and the `textContent` redaction (PMOD-04).
   - Rewrite the text that states the line shape or its count: tool 1 in the file header, the D-09 "Status semantics" sentence about the per-marketplace count, and the inline line-shape comment. State the new form as a present-tense fact and cite D-BG-1012 and D-BG-1201. Remove the citation of D-BG-1005, which is superseded, and do not narrate the old form (comments.md).

6. Update the list-tool cases in `test/edge/handlers/tools.test.ts`. The probe and `ctx.cwd` read counts stay 1 and 1.
   - "renders one line per marketplace and details of the list command's blocks": `[project] proj-mp -- 1 available • 1 installed -- <projectRoot>` and `[user] user-mp -- 0 available -- <userRoot>`.
   - Both scope-narrowing cases: `-- 2 available • 1 installed --`.
   - "carries a recorded last-update time in the block details": `[user] dated-mp -- 0 available -- <datedRoot>`.
   - "redacts the credential of a url source on its marketplace line": no catalog is on disk, so the line is `[project] url-mp -- https://***@git.example.com/o/r`.
   - Add one case, for example "leaves the available count out of the line of a marketplace whose catalog cannot be read". It seeds one marketplace whose record holds one installed plugin, then overwrites its `manifestPathIn(...)` file with text that is not JSON. The expected line is `[project] <name> -- 1 installed -- <root>`, with the usual details block.

7. Green, then commit. Run the verify command below. Then run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <the seven files>`, and restage the fixes until the run is clean. Stage the seven paths by name (never `git add -A`). Commit in the foreground with the longest timeout available, with a message like `feat(tools): count marketplace plugins as the browse picker does`. The body names the shared module and D-BG-1012, and its lines have at most 80 characters. Record the hook result. If the hook fails, fix the cause and commit again, without `--amend` or `--no-verify`.
  </action>
  <verify>
    <automated>npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature features/plugin/browse.feature && npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/edge/marketplace-counts.ts extensions/pi-claude-marketplace/edge/handlers/tools.ts extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts && grep -q 'available • ' features/plugin/model-tools.feature && test "$(grep -vE '^[[:space:]]*#' features/plugin/model-tools.feature | grep -c 'plugin(s)')" = 0 && test "$(cat extensions/pi-claude-marketplace/edge/handlers/tools.ts test/edge/handlers/tools.test.ts | grep -vE '^[[:space:]]*(//|\*|/\*)' | grep -c 'plugin(s)')" = 0 && ! grep -qE 'function (offeredPluginCount|marketplaceDescription)\b' extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts && grep -q 'export async function offeredPluginCount' extensions/pi-claude-marketplace/edge/marketplace-counts.ts && grep -q 'export function marketplaceDescription' extensions/pi-claude-marketplace/edge/marketplace-counts.ts && ! grep -qE 'D-BG-10(05|10)' extensions/pi-claude-marketplace/edge/handlers/tools.ts test/edge/handlers/tools.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Baselines at HEAD 9a398226, all measured: `available • ` is absent from the feature file. The installed-only count wording is present on non-comment lines of the feature file, tools.ts, and tools.test.ts. Both helper definitions exist in browse.ts and plugin-browser.ts. marketplace-counts.ts does not exist. tools.ts cites D-BG-1005. So every gate of the verify command fails at HEAD, and each must pass after the task. The cucumber run is the real proof, and the greps only check that no old wording remains.
    - Red proof A in the SUMMARY names exactly the three list-tool scenarios as failing on the unchanged product. After the change, all 11 scenarios of model-tools.feature and every scenario of browse.feature pass. The 261109-cpm item, which this item follows, may have edited browse.feature.
    - Direct coverage is 100% for marketplace-counts.ts, tools.ts, browse.ts, and plugin-browser.ts. The unit tests of browse and plugin-browser are not edited.
    - The commit hook (`npm run check:commit`) passes.
  </acceptance_criteria>
  <done>A model that calls `pi_claude_marketplace_list` reads each marketplace's catalog count and installed count in the picker's wording. The picker and the tool share one module for the counts, and the picker's rows are unchanged. The work is in one commit, and the hook passed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: A disabled plugin reads `[disabled]` and has its own `disabled` filter, and `unavailable` means only plugins this system cannot install (D-BG-1011)</name>
  <files>features/plugin/model-tools.feature, extensions/pi-claude-marketplace/edge/handlers/tools.ts, test/edge/handlers/tools.test.ts</files>
  <precondition>Task 1 is committed. `node_modules/.bin/cucumber-js` exists in this worktree.</precondition>
  <read_first>
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts (lines 1-120 and 215-583: the header, the parameter schemas, and tool 2)
    - test/edge/handlers/tools.test.ts (lines 722-1210 for the version cases, the mixed fixture, the filter cases, and the registration case; lines 1320-1378 and 1493-1540 for the disabled manifest-absence case and the no-plugins case)
    - orchestrators/plugin/list-flow.ts lines 155-260 (`PluginListPayloadOptions`, `filtersPassive`, `shouldShow`), read only
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts lines 136-160 (the picker's `STATUS_TAG`, where `disabled` is already `[disabled]`), read only
  </read_first>
  <behavior>
    - With no filter, the mixed unit marketplace lists `  [disabled] foxtrot  6.0.0` on its disabled record, and the details row keeps the status `disabled`.
    - `{ disabled: true }` lists only the disabled record. The payload loader is asked for installed rows, and the tool drops the enabled `alpha`.
    - `{ installed: true }` lists only `alpha`, `{ unavailable: true }` lists only the structural unavailable and the partially available rows, and `{ available: true }` is unchanged.
    - `{ available: true, unavailable: true }` lists the available, cold git, unavailable, and partially available rows, without the disabled record. `{ unavailable: true, disabled: true }` lists the unavailable, partially available, and disabled rows, in payload order.
    - A disabled record that the manifest omits reads `[disabled] alpha  1.0.0  (not in manifest)`.
    - The registered schema has the new optional boolean `disabled` last, and the descriptions given in step 3.
  </behavior>
  <action>
1. Red first (behavioral). In `features/plugin/model-tools.feature`, make these edits and re-align each table.
   - "The plugin list tool returns the install status and compatibility of every plugin": the `eps` row becomes `[disabled] eps  1.0.0`.
   - Retitle "The unavailable filter returns the plugins this system cannot install and the disabled ones" to "The unavailable filter returns only the plugins this system cannot install". Its result becomes `pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\n  (no plugins)\nMarketplace tools (project)\n  [unavailable] gamma  1.0.0  (unsupported component)\n  [unavailable] npmp  1.0.0  (unsupported source)`, and its reply becomes `Two plugins cannot be installed.`.
   - Add a scenario right after it: "The disabled filter returns only the installed plugins that are disabled". The scripted model calls `pi_claude_marketplace_plugin_list` with `{"disabled":true}` and then replies `One plugin is disabled.`. The user prompts `Which plugins are disabled?`. The calls table has the same four rows as its siblings, and its tool result is `pi_claude_marketplace_plugin_list returned: Marketplace extras (user)\n  (no plugins)\nMarketplace tools (project)\n  [disabled] eps  1.0.0`. It uses only existing steps and carries no implementation tag (D-BG-1007).
   - "Two filters together return the plugins of either filter": remove the `eps` row from the result, so the result is kilo, alpha, delta, gamma, and npmp.
   - "No call to either tool changes the config, the installation record, or what is installed": append `"disabled":true` to the plugin list call's arguments, in the steps table and in both of its `tool call` rows, so the three calls still use every parameter together (D-BG-1009). Both of its result rows list all seven `tools` plugins, with `[disabled] eps  1.0.0` between the delta row and the gamma row.
   Run `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature` against the product as Task 1 left it. Confirm that exactly these five scenarios fail: the every-plugin scenario, the unavailable filter, the new disabled filter, the two filters, and the no-change scenario. Record red proof B in the SUMMARY: the command, the five titles, and the exit status. Before this change, Pi either accepts and ignores the unknown `disabled` argument or refuses it, and both outcomes fail the scenario.

2. Unit expectations next (they turn red). In `test/edge/handlers/tools.test.ts`:
   - The registration case adds the property `disabled: { type: "boolean", description: "Include installed plugins that are disabled." }` after `unavailable`, and the description of `unavailable` becomes `Include manifest-declared plugins that are not installable on this system.`.
   - The `disabled-mp` version case has the line `  [disabled] alpha  1.0.0`. `DISABLED_LINE` becomes `  [disabled] foxtrot  6.0.0`. The JSDoc of `mixedMarketplace` says that the tool lists the disabled record under `disabled` (D-BG-1011).
   - `FilterCase.params` gains `readonly disabled?: boolean`.
   - The unavailable-only case keeps only `UNAVAILABLE_LINE` and `PARTIALLY_AVAILABLE_LINE` with their rows. Its comment says that the partially available row rides `unavailable` and that a disabled record has its own bucket.
   - Add "narrows to the disabled bucket when only disabled is set", which expects `[DISABLED_LINE]` and `[disabledRow]`.
   - The available-and-unavailable union drops the disabled line and row.
   - Add "unions the unavailable and disabled buckets when both are set", which expects `[UNAVAILABLE_LINE, PARTIALLY_AVAILABLE_LINE, DISABLED_LINE]` with their rows.
   - The case "forwards the absence reason of a disabled record the manifest omits" expects `[disabled]`.
   - The comment of "renders the no-plugins body for a marketplace whose rows the filter empties" says that the tool files the record under the `disabled` bucket. Its expectation is unchanged.
   - Replace the two comment citations of D-BG-1004 with D-BG-1011.
   Run `npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts` and see it fail.

3. Implement D-BG-1011 in `extensions/pi-claude-marketplace/edge/handlers/tools.ts`.
   - `ToolPluginStatus` gains `"disabled"`. `projectRowStatus` maps `disabled` to `"disabled"`, with a comment that cites D-BG-1011 and ENBL-04: the plugin is installed but not loaded, it reads `[disabled]` as in the picker, and only the `disabled` filter selects it. The partially-available arm's comment drops its parenthetical about the disabled fold.
   - `statusLabel` returns `[disabled]`, and `statusKey` returns `"d"`.
   - `ToolFilterBuckets` and `applyFilter` gain `d` from `params.disabled === true`. The call is passive only when none of the four filters is true.
   - The bucket parameter of `renderPluginPayload` gains `d`.
   - `loadToolPluginPayload` forwards `installed: true` when `buckets.i || buckets.d`, and for `buckets.u` it forwards only `unavailable` and `partial`. Rewrite its comment: disabled rows come with the installed inventory of the payload loader, so the `installed` and `disabled` buckets both ask for installed rows, and `renderPluginPayload` keeps only the tags that the call asked for.
   - In `LIST_PLUGINS_PARAMS`, `installed` keeps `Include installed plugins that are enabled.`. `unavailable` becomes `Include manifest-declared plugins that are not installable on this system.`. Add `disabled: Type.Optional(Type.Boolean({ description: "Include installed plugins that are disabled." }))` after `unavailable`.
   - Header comments: tool 2's parameter list adds `disabled`. The projection paragraph and the JSDoc of `ToolPluginStatus`/`projectRowStatus` name four tags: `[installed]`, `[disabled]`, `[available]`, and `[unavailable]`. Cite D-BG-1011 in place of the superseded D-BG-1004 and of the D-54-01 projection. Do not narrate the earlier fold (comments.md).

4. Green, then commit. Run the verify command. Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <the three files>`, stage the three paths by name, and commit in the foreground with a message like `feat(tools): tag disabled plugins and give them their own filter`, whose body cites D-BG-1011. Record the hook result.
  </action>
  <verify>
    <automated>npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature && npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts && grep -q '"\[disabled\]"' extensions/pi-claude-marketplace/edge/handlers/tools.ts && grep -q '\[disabled\] eps  1.0.0' features/plugin/model-tools.feature && grep -q 'Scenario: The disabled filter returns only the installed plugins that are disabled' features/plugin/model-tools.feature && test "$(grep -vE '^[[:space:]]*#' features/plugin/model-tools.feature | grep -c '\[unavailable\] eps')" = 0 && ! grep -qE 'D-BG-10(04|05|10)' extensions/pi-claude-marketplace/edge/handlers/tools.ts test/edge/handlers/tools.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Baselines at HEAD 9a398226, all measured: tools.ts has no quoted `[disabled]` label. The feature file has no `[disabled] eps  1.0.0` row and no disabled-filter scenario, and `eps` reads with the unavailable tag on several of its lines. tools.ts and tools.test.ts cite D-BG-1004 and D-BG-1005 in comments. So every gate fails at HEAD, and each must pass after the task.
    - Red proof B in the SUMMARY names exactly the five scenarios. After the change, every scenario of model-tools.feature passes, the new one included.
    - Direct coverage of tools.ts stays 100%. The owner test has the two new filter cases.
    - The commit hook passes.
  </acceptance_criteria>
  <done>A model sees a disabled plugin as `[disabled]`, can ask for disabled plugins alone, and gets only enabled plugins from `installed` and only plugins that cannot be installed from `unavailable`. The work is in one commit, and the hook passed.</done>
</task>

<task type="auto">
  <name>Task 3: Record D-BG-1011 and D-BG-1012, update the CHANGELOG and the doc paragraph, then pass the full gate</name>
  <files>.planning/PROJECT.md, CHANGELOG.md, docs/competitive-analysis/pi-plugins.md</files>
  <precondition>Tasks 1 and 2 are committed.</precondition>
  <read_first>
    - .planning/PROJECT.md lines 2232-2242 (the Phase 10 rows of the Key Decisions table; the D-BG-1007 row is line 2241, and the D-BG-1201 row at line 2215 shows the row form)
    - CHANGELOG.md lines 1-22 (the Unreleased behavioral-gaps entry)
    - docs/competitive-analysis/pi-plugins.md lines 430-436 (the "Read-only LLM-facing tools" section)
    - .agents/skills/changelog/rules/entries.md
  </read_first>
  <action>
1. In `.planning/PROJECT.md`, edit the Key Decisions table. Use the Edit tool with anchors that are unique. The ending ` | -- Revisit |` alone matches 8 rows.
   - Insert two rows right after the D-BG-1007 row, in the same three-column form (decision | rationale | outcome):
     - **D-BG-1011** (behavioral-gaps, quick 261109-cpj, the user's review decision on 2026-11-09, P10-DC-02): a disabled plugin reads `[disabled]` in `pi_claude_marketplace_plugin_list` and has its own `disabled` filter. The decision text names the four tags and their folds: `[installed]` covers installed, upgradable, partially-installed, and partially-upgradable plugins; `[disabled]` covers installed plugins that are disabled; `[available]` covers available and remote plugins; and `[unavailable]` covers unavailable and partially-available plugins, the ones this system cannot install. It says that `installed` returns enabled plugins, `disabled` returns disabled ones, and `unavailable` no longer returns disabled plugins. Both installed-inventory filters ask the payload loader for installed rows, and the tool's bucket filter keeps the tags that the call asked for. The slash command's `--installed` still includes disabled plugins. It supersedes D-BG-1004 and the tool projection of D-54-01. Rationale: the picker already tags a disabled plugin `[disabled]`, one tag per filter returns exactly the plugins that the tag names, and the unavailable tag claimed that an installed plugin could not be installed here. Outcome: `✓ Good`.
     - **D-BG-1012** (behavioral-gaps, quick 261109-cpj, the user's review decision on 2026-11-09, P10-DC-03, P10-DC-22): `pi_claude_marketplace_list` counts a marketplace's plugins as the browse picker does. The decision text gives the line `[<scope>] <name> -- <offered> available • <installed> installed -- <source.logical>`. It says that the `available` part is left out when the catalog cannot be read or declares a name Claude Code refuses (D-PL5-28), and that the installed part appears only when the scope record holds a plugin of the marketplace. That part counts every recorded plugin, disabled ones included, as the picker and Claude Code count them, so it can be higher than what the `installed` filter returns. With neither part, the line is `[<scope>] <name> -- <source.logical>`. The picker and the tool share `edge/marketplace-counts.ts`, the tool now reads each catalog read-only and offline (NFR-5), and the slash command `marketplace list` still reads none (ML-3). It supersedes D-BG-1005, D-BG-1010, and the line shape that D-BG-1002 kept. Rationale: one wording for one fact on two surfaces, and the old count read like the size of the catalog. Outcome: `✓ Good`.
   - Mark three rows superseded. In each row's opening parenthetical, replace `the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md` with `superseded on 2026-11-09 by D-BG-1011` (for D-BG-1004) or `superseded on 2026-11-09 by D-BG-1012` (for D-BG-1005 and D-BG-1010). Replace each row's outcome `-- Revisit` with `Superseded 2026-11-09 by D-BG-1011` (D-BG-1004) or `Superseded 2026-11-09 by D-BG-1012` (D-BG-1005, D-BG-1010). These unique tails anchor the outcome edits: D-BG-1004 ends with ``installed plugins that are disabled. | See `phases/10-model-facing-tools/10-CONTEXT.md`. | -- Revisit |``, D-BG-1005 ends with ``left to the user (P10-DC-03). | See `phases/10-model-facing-tools/10-CONTEXT.md`. | -- Revisit |``, and D-BG-1010 ends with ``left to the user (P10-DC-22). | See `phases/10-model-facing-tools/10-CONTEXT.md`. | -- Revisit |``. Leave every other row, D-BG-1002 and D-BG-1008 included, as recorded.

2. In `CHANGELOG.md`, edit only the sub-bullets of the existing `[Unreleased]` entry (changelog skill: load `simple-english` in Plain mode and `humanizer`, and run their self-checks). Leave the top line and the browse picker bullet as they are, because sibling items edit nearby lines.
   - The `pi_claude_marketplace_list` scope bullet becomes: `` `pi_claude_marketplace_list` now takes an optional `scope`, and its lines count the available and the installed plugins as the browse picker does. ``
   - The `pi_claude_marketplace_plugin_list` bullet drops its clause about the `unavailable` filter and becomes: `` `pi_claude_marketplace_plugin_list` now reports an unknown marketplace as a failed tool result. ``
   - Add this sub-bullet right after it: `` `pi_claude_marketplace_plugin_list` now tags a disabled plugin `[disabled]`, and a new `disabled` filter returns it. ``
   Compared with 0.23.0, `installed` and `unavailable` return the same plugins as before, because the clause dropped above never shipped. So the CHANGELOG names only the tag, the filter, and the counts.

3. In `docs/competitive-analysis/pi-plugins.md`, rewrite the paragraph under "### Read-only LLM-facing tools" so that it describes the tools as they now are, in the file's existing style:
   - `pi_claude_marketplace_list` takes an optional `scope` (`user` or `project`). It returns one line per marketplace in the form `[<scope>] <name> -- <offered> available • <installed> installed -- <source.logical>`, with the counts of the browse picker, plus a structured `details.marketplaces` field. The installed part appears only when the scope has installed a plugin of the marketplace, and the available part only when the catalog can be read.
   - `pi_claude_marketplace_plugin_list` takes optional `marketplace`, `scope`, `installed`, `available`, `unavailable`, and `disabled` parameters. It returns rendered lines plus a structured `details.marketplaces` field (fix the field name that the paragraph gets wrong).
   - It flattens the rich status set into four tags: `upgradable`, `partially-installed`, and `partially-upgradable` become `installed`; `remote` becomes `available`; `partially-available` becomes `unavailable`; and a disabled plugin keeps `disabled`.
   - Keep the two closing sentences, "Tools never call ..." and "Whether they expose ...", unchanged.

4. Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files CHANGELOG.md docs/competitive-analysis/pi-plugins.md .planning/PROJECT.md` (mdformat and markdownlint skip `.planning/`), and restage the fixes until the run is clean. Stage the three paths by name. Commit with a message like `docs(tools): record the disabled tag and the marketplace counts`.

5. Full gate. Run `npm run check` once, unpiped, after the last commit. It can take tens of minutes (the limit is 2,400 s), so run it in the background and wait for the completion notice. Do not poll. Record the command, the exit status, the commit SHA, the Node version, and the scope (this item's worktree tree) in the SUMMARY (gates.md). The batch coordinator runs the post-merge gate on the combined tree. If a scenario outside this item's files fails, rerun that scenario alone to classify it, and then rerun `npm run check`. Never record a failed or timed-out run as a pass.
  </action>
  <verify>
    <automated>SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files CHANGELOG.md docs/competitive-analysis/pi-plugins.md && grep -q '^| \*\*D-BG-1011 (' .planning/PROJECT.md && grep -q '^| \*\*D-BG-1012 (' .planning/PROJECT.md && grep -q 'Superseded 2026-11-09 by D-BG-1011' .planning/PROJECT.md && grep -q 'Superseded 2026-11-09 by D-BG-1012' .planning/PROJECT.md && test "$(grep -e '^| \*\*D-BG-1004 (' -e '^| \*\*D-BG-1005 (' -e '^| \*\*D-BG-1010 (' .planning/PROJECT.md | grep -c -- '-- Revisit |$')" = 0 && ! grep -q 'filter also returns disabled plugins' CHANGELOG.md && grep -q '\[disabled\]' CHANGELOG.md && test "$(grep -v '^<!--' docs/competitive-analysis/pi-plugins.md | grep -c 'plugin(s)')" = 0 && ! grep -q 'details.plugins' docs/competitive-analysis/pi-plugins.md && grep -q 'available • ' docs/competitive-analysis/pi-plugins.md && npm run check</automated>
  </verify>
  <acceptance_criteria>
    - Baselines at HEAD 9a398226, all measured: PROJECT.md has no D-BG-1011 or D-BG-1012 row and no `Superseded 2026-11-09 by D-BG-1011` or `by D-BG-1012` outcome, and the D-BG-1004, D-BG-1005, and D-BG-1010 rows all end with the `-- Revisit` outcome. The CHANGELOG holds the stale `unavailable` clause and no `[disabled]`. The doc paragraph holds the installed-only count wording and the wrong details field, and no `available • `. So every gate fails at HEAD, and each must pass after the task. The patterns name this item's IDs only, so the D-BG-1203 row of 261109-cpm does not affect them.
    - `npm run check` exits 0 on the item's final commit, and the SUMMARY records it.
  </acceptance_criteria>
  <done>The decision records, the CHANGELOG, and the doc paragraph describe what the tools now return, and `npm run check` passed on the item's tree.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| model → tool parameters | The model chooses the arguments. Pi validates them against the TypeBox schema before `execute` runs, and the new `disabled` argument is an optional boolean. |
| catalog on disk → list tool | `marketplace.json` of a marketplace that the user added is third-party content. The list tool now reads its entry count, as the picker already does. |
| tool result → model | The tool returns text that the model reads, with no presentation layer in between. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261109-cpj-01 | Information disclosure | `pi_claude_marketplace_list` line | low | mitigate | The line adds only two numbers. No catalog string reaches it. `sourceLogical(source)` still passes through `textContent` and `redactCredentials` (PMOD-04), and the url-credential unit case keeps its redacted expectation in Task 1. |
| T-261109-cpj-02 | Tampering | both tools (read-only contract, D-02) | low | mitigate | The tools read state, config, and catalogs, and they write nothing. The no-change scenario (D-BG-1006) checks that the config and record bytes of both scopes and the staged skills are unchanged after calls that use every parameter, `disabled` included (Task 2). |
| T-261109-cpj-03 | Denial of service | catalog read in the list tool | low | accept | The read uses the existing cached and validated `loadMarketplaceManifest`, as the picker and `list` do. A broken catalog only leaves the count out (the helper catches every failure). The file is local, so the read uses no network (NFR-5), and the network counter of the unit cases stays 0. |
| T-261109-cpj-04 | Spoofing | a catalog that declares a look-alike reserved name | low | mitigate | `assertRecordedMarketplaceName` leaves the count out for a name that Claude Code refuses (D-PL5-28), as the picker does. The pair test of the shared module covers this in Task 1. |
| T-261109-cpj-05 | Elevation of privilege | the new `disabled` parameter | low | mitigate | Pi validates the boolean. It only selects rows of an existing read, and it adds no write, command, or network path. The registration case pins the schema in Task 2. |
| T-261109-cpj-SC | Tampering | npm/pip/cargo installs | low | accept | The item adds and changes no dependency and has no install task. `scripts/install-test-peers.mjs` installs only the optional peers that are already declared, through the existing npm scripts. |
</threat_model>

<verification>
- Before Task 1, record the worktree's starting commit (`git rev-parse HEAD`) as BASE in the SUMMARY.
- Task 1 and Task 2 verify commands pass. Red proofs A and B are in the SUMMARY.
- `npm run --silent test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature features/plugin/browse.feature` passes all 12 scenarios of model-tools.feature and every scenario of browse.feature.
- `npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/edge/marketplace-counts.ts extensions/pi-claude-marketplace/edge/handlers/tools.ts extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts` exits 0.
- `npm run check` exits 0 on the item's final commit (Task 3).
- `git diff --stat BASE HEAD -- extensions/pi-claude-marketplace/orchestrators test/edge/browser test/edge/handlers/plugin features/plugin/browse.feature .agents/skills/cucumber/rules/layout.md .planning/DUBIOUS-CHOICES.md` prints nothing. The item's commits leave the orchestrators, the picker tests, the picker scenarios, the cucumber layout rule, and the root dubious-choices log as they were.
</verification>

<success_criteria>
- `pi_claude_marketplace_list` lines read `[<scope>] <name> -- <offered> available • <installed> installed -- <source>`, with the picker's rules for left-out parts (D-BG-1012, D-BG-1201).
- `pi_claude_marketplace_plugin_list` tags a disabled plugin `[disabled]`. Its `installed`, `available`, `unavailable`, and new `disabled` filters each return exactly the plugins of their tag, and two or more filters return the union of their tags (D-BG-1011, PL-1).
- The picker's first screen is unchanged, and the picker and the tool share `edge/marketplace-counts.ts`.
- Neither tool writes or reaches the network.
- PROJECT.md, CHANGELOG.md, and docs/competitive-analysis/pi-plugins.md are updated, and three commits pass their hooks.
- `npm run check` exits 0.
</success_criteria>

<output>
Create `.planning/quick/261109-cpj-model-facing-list-tool-extensions-pi-claude-marketplace-edge/261109-cpj-SUMMARY.md` when done. Besides the template sections, it holds:

- **Red proofs.** Red proof A (Task 1: three list-tool scenarios) and red proof B (Task 2: five scenarios). For each, give the command, the failing titles, and the exit status, and then the green run.
- **Commits.** The three commits, with the hook result of each.
- **Full gate.** The `npm run check` record: command, exit status, commit, Node version, and scope.
- **Decisions.** D-BG-1011 and D-BG-1012.
- **Choices made without the user.**
  - The `{installed}` count counts disabled plugins, as the picker and Claude Code do, while the `installed` filter now means enabled only.
  - The two D-BG-1201 helpers moved to `edge/marketplace-counts.ts`.
  - The neutral debug line and its tag.
  - The seed title "The model reads the marketplaces the list tool returns" is kept, because `.agents/skills/cucumber/rules/layout.md` names it.
  - `disabled` is the last property of the schema.
- **Parent lines** for the batch coordinator, which no item edits itself: in `.planning/DUBIOUS-CHOICES.md`, the status of P10-DC-02 becomes `fixed by quick 261109-cpj (D-BG-1011)`, the status of P10-DC-03 and P10-DC-22 becomes `fixed by quick 261109-cpj (D-BG-1012)`, and the first bullet of "Decisions waiting on you" is marked fixed.
- **Threat Flags.**

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```
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

**User answers (2026-11-09):** keep the picker's count (disabled plugins count
as installed on the marketplace line, D-BG-1201); the plan stands as written.

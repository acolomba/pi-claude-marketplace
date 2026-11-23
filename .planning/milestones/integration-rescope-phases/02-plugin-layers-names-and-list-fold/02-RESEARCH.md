# Phase 2: Plugin Layers, Names, and List Fold - Research

**Researched:** 2026-11-21
**Domain:** Moving integration cases to cucumber scenarios (test-only; no product change expected)
**Confidence:** HIGH. Every scenario shape below ran green in a scratch feature file against the real extension, and every break named below was applied, run, and reverted in this session.

## Summary

All four integration files can move to cucumber with the steps that exist now. No new step, support module, or `features/lib/**` file is needed. I wrote each replacement scenario as a scratch `.feature` file outside the repo, ran it under the `adapter` profile, and it passed. Then I applied a deliberate break for each behavior and saw the matching scratch scenarios fail. Every break was reverted with `git checkout`, and `git status --porcelain` stayed clean. The drafts and break logs are in `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-02/` (`probe/*.feature`, `break-*.log`). Planners can copy rows from them.

The audit's "cheapest moves" claim holds, with four corrections:

1. `the config and installation record bytes of the {word} scope are remembered/unchanged` covers only `claude-plugins.json` and `state.json`. It does not cover the local config.
2. `a config in scope … with this text:` writes text with no token expansion, and `the {string} file … holds this text:` compares raw bytes with no token projection. So a config that holds a `{home}` source cannot be checked byte for byte. Check it with `declares these plugins:` and `declares these marketplaces:` instead.
3. No step states that a scope stages no skills. A table with only a header row passes, but it breaks a `features.md` rule.
4. The integration "reload" is `createApplyReconcile`. In cucumber that is `/claude:plugin apply --scope <scope>`, with tally label `Reconcile`. It is not a new session.

Two items need a decision before planning:

- **The Outline layout of LAYER-04.** CONTEXT locks a two-row Outline per verb. `features.md` asks for three or more variants per Outline. The suite already has eight two-row Outlines, so there is precedent, but a review flags it as a WARNING. The Background of `update.feature` and `reinstall.feature` also blocks a uniform Outline (see Pitfall 1).
- **The independent-marketplace scenario of the list fold.** The integration case uses two different marketplace names. A same-name, different-source scenario (F03) is the real D-13-17 exception, and it is the only scenario that catches a fold that ignores the source.

**Primary recommendation:** Use four plans in one wave, one per requirement, with disjoint files. No plan touches a shared step module or `features/lib/**`. Each plan records its red proofs with the break sites listed under "Deliberate breaks" below, all of them verified.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [LAYER-04 shape] Q: "How are the 12 LAYER-04 cases written?" → Selected: "Each verb's refusal lands in that verb's own feature file (install, uninstall, enable, disable, update, reinstall), as a Scenario Outline whose two Examples rows are the two directions (target in the base layer with the local config unreadable; target in the local layer with the base config unreadable). Each scenario checks the exact failure row the command prints (the CFG-03 row: `⊘ <plugin> (failed) {invalid manifest}` with the `Config file ... failed schema validation` cause), that the config files, the installation record, and the plugin's staged artifacts are unchanged" — scenario layout is cheap to change; one Outline per verb keeps each verb's file the owner of its behavior.
- [LAYER-04 harness] Q: "Which steps do the refusals use?" → Selected: "Existing steps first: `a config in scope {word} and layer {word}, with this text:` writes the unreadable config; `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged` check bytes. If no step checks that staged artifacts are unchanged, add one to the shared topic module that owns scope state (named in the plan), not to a verb module" — reuses the audit's cheapest moves.
- [ITMIG-02 cases] Q: "Which plugin-layer-consistency cases become scenarios?" → Selected: "All seven listed in ITMIG-02 and the audit: the user-scope local gap, the base-layer gap that stops the reload and changes no file, a legacy local layer from an earlier `--local` install kept byte for byte with its plugin still recorded, `pending` before the first-run migration reporting the layer error, the malformed key `demo@` reported as a source mismatch with no layer error, and the dangling reference row beside a declared plugin that still installs. Each lands in `plugin/configuration.feature`, `plugin/config-migration.feature`, or `plugin/pending.feature`, by the verb it exercises" — placement is reversible.
- [Reserved names file] Q: "Where do the constructor and __proto__ scenarios go?" → Selected: "One new feature file `features/plugin/reserved-names.feature` (`Feature: Plugin reserved names`), the counterpart of `marketplace/reserved-name.feature`. It covers the whole ITMIG-03 list: `constructor` installs, lists, shows in `info`, disables, enables, updates, uninstalls, imports (and its config entry is written back on disable and uninstall), goes when its marketplace is removed, and a reload that declares `constructor@mp` installs it as an own record; a marketplace that declares `__proto__` lists it as unavailable and refuses its install with no file change; a reload that declares `hello@constructor` records nothing (D-PL5-28); and each named verb on an uninstalled `constructor` prints what it prints for an absent name. Scenarios cite D-08-07 and D-PL5-28" — a new file is easy to split later.
- [Reserved names steps] Q: "Where do any new steps for this file go?" → Selected: "In existing shared or verb modules whose text already fits; a step that fits none goes in a new verb-free topic module under `features/step_definitions/plugin/` named for what it is about, per the layout rules (no catch-all names)" — module placement is reversible.
- [List fold] Q: "How is the unfiltered list fold shown?" → Selected: "Two scenarios in `plugin/list.feature`: a project install from a marketplace that only the user scope records lists as a `[project]` row under that user marketplace's header (CMC-21, D-13-17); and after an independently added project marketplace with a different source, `list` shows both headers, each with its own row and no duplicate. Each checks the complete list output, not a sample of rows" — scenario wording is cheap to change.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phase 1: one deliberate break per behavior, reverted in an EXIT trap and never committed; the plan's SUMMARY.md records the break, the command, and the failing scenario. This includes the two already-covered LAYER-08 cases. A break that fails no scenario means the scenario is missing or too weak, and the plan fixes the scenario before deleting the case" — test approach only.
- [Deletion] Q: "Which files go?" → Selected: "`fold-adoption` and `reserved-record-keys` are deleted when their cases are covered; `plugin-layer-consistency` goes if all seven cases move; `plugin-layer-verbs` keeps only its two LAYER-06 cases (Phase 8 owns them); any helper no remaining test imports goes with its last user. Each deleted file is listed in `files_deleted`" — deletion is backed by git history.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it in the phase when small (with a unit test beside its source pair); otherwise add a BACKLOG.md entry and keep the integration case that guards it, its header naming the BACKLOG ID" — follows the milestone rule.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership so plans in a wave touch disjoint files; a shared step module or `features/lib/**` file changes in only one plan per wave" — wave layout is local to the plan.

### Claude's Discretion
- Scenario titles, step wording, and table columns, within the cucumber skill's rules.
- The exact code edit of each deliberate break.
- Plan count and wave split.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITMIG-01 | Scenarios cover the 12 LAYER-04 cases: install, uninstall, enable, disable, update, and reinstall each refuse, in both layer directions, when the other layer's config cannot be read, and change nothing. | "ITMIG-01" under Architecture Patterns: the exact result rows (verified), the steps, and two verified break sites (B1 for five verbs, B2 for uninstall). The LAYER-08 deletion uses break B12. |
| ITMIG-02 | Scenarios cover the plugin-layer consistency cases (user-scope local gap, legacy local layer byte for byte, `pending` before the first-run migration, malformed `demo@` as source mismatch, base-layer gap stopping the reload with no file change, dangling reference beside a declared plugin that still installs). | "ITMIG-02": seven verified scenario drafts (C02 to C08) with exact rows. Breaks B8, B9, B10, and B11 each fail the intended scenarios only. |
| ITMIG-03 | Scenarios cover `constructor` (install, list, info, disable, enable, update, uninstall, import, marketplace removal), `__proto__` unavailable, and `hello@constructor` recording nothing. | "ITMIG-03": verified outputs for every verb, including the eight absent-name commands. Breaks B3, B4, B5, and B13. |
| ITMIG-04 | Scenarios cover the unfiltered `list` fold and an independently added project marketplace with no duplicate row. | "ITMIG-04": verified F01, F02, and F03. Breaks B6, B6b, and B7. F03 is the only scenario that catches B6b. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before you edit it. Never commit to `main`. Merge, never rebase. Commit messages follow `.agents/skills/committing/SKILL.md`, and `--no-verify` is never used.
- Every plan `SUMMARY.md` has a `## Threat Flags` section, even when it is "None".
- GSD gates run `npm run check` on the combined tree. A passing commit hook is not a full verdict. Inside `.claude/worktrees/...` the hook may check nothing, so run `npm run check:static` and the touched scenarios by hand before you commit (CONTEXT environment facts).
- A visible change to `/claude:plugin` ships with a cucumber scenario. This phase adds scenarios only; it changes no behavior.
- **Upstream parity:** a scenario expects Claude Code's behavior or names the decision ID that licenses a divergence. The IDs this phase pins are LAYER-04, CFG-03, LAYER-06, D-MF-03, MIG-01, LAYER-08, D-08-07, D-PL5-28, CMC-21, and D-13-17 `[VERIFIED: grep of .planning/PROJECT.md and extensions/; each ID occurs]`. Name them in the scenario title in parentheses (precedent: `install.feature` "An install records the options a plugin declares (D-PG10-23)") or in the feature description.
- **Parent lines:** no phase edits `CHANGELOG.md`, `.planning/BACKLOG.md`, or the Key Decisions table of `PROJECT.md`. Each phase lists those lines under "Parent lines" in the SUMMARY of its last plan.
- **fallow audit:** each deleted integration file, and probably each trimmed file `[ASSUMED]`, gives one `weakened-tests` warn. The user decided to record it and move on: no change to `.fallowrc.json` or CI (STATE.md Blockers).
- Environment: prefix every npm command with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Pass `--parallel 2`, or `--parallel 1` when more than two executors share the 4 CPUs. Direct coverage runs under `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp ...`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LAYER-04 / CFG-03 refusal on an unreadable other layer | Orchestrators (`orchestrators/plugin/shared.ts::loadTargetLayers`; `uninstall.ts::readUninstallLayers`) | Shared (`shared/errors.ts::LayerConfigUnreadableError`) | Each named verb reads both layers inside its lock and stops before any change. |
| LAYER-06 layer-gap stop on apply and load | Orchestrators (`reconcile/read-pass.ts`) | Persistence (`config-merge.ts::findLayerMarketplaceGaps`) | The read pass stops the scope and repairs no file. |
| Pending before the first-run migration (MIG-01 / DIFF-01) | Orchestrators (`reconcile/pending.ts::layerMarketplaceGapBlocks`) | Persistence (`migrate-config.ts::buildConfigFromState`) | Pending projects, read-only, the base config the migration would write. |
| Malformed key and dangling reference rows | Orchestrators (`reconcile/plan.ts::classifyDeclaredPlugin`) | — | The planner turns them into diagnostics, not actions. |
| `Object.prototype` member names (D-08-07) | Shared (`shared/own-key.ts`) | Domain (`domain/name.ts`, `domain/plugin-resolver.ts`, `domain/dependencies.ts`) | Reads and writes use own keys only; `__proto__` is unavailable; a `constructor` marketplace is refused (D-PL5-28). |
| Unfiltered list fold (CMC-21 / D-13-17) | Orchestrators (`plugin/list-orphan-fold.ts`, `plugin/list-flow.ts`) | — | Folding is done while the payload is built; the renderer only prints it. |
| Behavioral proof | `features/plugin/*.feature` | existing step modules | Test tier only; no product edit planned. |

## Standard Stack

No packages are installed. The phase uses the harness that is already in the repo.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` (via `npx cucumber-js`, `scripts/cucumber.mjs`) | repo-pinned | Runs the scenarios; `cucumber.json` profiles `adapter` and `builtin` `[VERIFIED: cucumber.json]` |
| Node | v24.22.3 | Runtime `[VERIFIED: node --version]` |
| Existing step modules | — | `command.steps.ts`, `config.steps.ts`, `plugin/installation.steps.ts`, `marketplace/publishing.steps.ts`, `marketplace/checkout.steps.ts`, `claude-code-settings.steps.ts` |

## Package Legitimacy Audit

None. The phase installs no external package.

## Architecture Patterns

### How a scenario reaches the behavior

```
feature file (Given setup commands / config writes)
   └─► headless Pi (rpc), real extension ──► /claude:plugin <verb> ... (When)
          └─► JSON result payload ──► `the result has these fields:` (envelope)
                                   └► `the result lists these plugins:` (every row, or the After hook fails the scenario)
   └─► disk checks: config/record bytes, config declarations, staged skills, marketplace record
```

### Steps to use, all of which exist (file:line)

| Step | Module | Use |
|------|--------|-----|
| `the marketplace {string} is published as a {source kind} source` | `marketplace/publishing.steps.ts:63` | Every setup |
| `the marketplace {string} offers these plugins:` | `marketplace/publishing.steps.ts:138` | Republishes, so it can add a plugin or bump a version in a scenario |
| `the marketplace {string} publishes this manifest:` | `marketplace/publishing.steps.ts:182` | F03: a second marketplace whose manifest name is `official` |
| `the marketplace {string} is added to the {word} scope` | `marketplace/publishing.steps.ts:207` | Adds and declares it in the base layer |
| `the user has run {string}` / `the user runs {string}` | `command.steps.ts:91` / `:123` | Setup and action. A trailing space in the command is fine (verified: `install demo@mp --scope project ` succeeds) |
| `the result has these fields:` / `the result lists these plugins:` / `the command reports these results:` | `command.steps.ts:158` / `:166` / `:198` | Result checks |
| `a config in scope {word} and layer {word}, with this text:` / `with these plugins:` / `with these marketplaces:` | `config.steps.ts:195` / `:157` / `:178` | Unreadable layer (`{ not json`), hand edits. An empty `marketplace` cell writes the key `demo@` (`layer-config.ts`: key = `${plugin}@${marketplace}`) |
| `the config and installation record bytes of the {word} scope are remembered` / `are unchanged` | `config.steps.ts:171` / `:241` | **Base config and `state.json` only** (`scopeBytes`, `config.steps.ts:55-61`) |
| `the user has deleted the config files of the {word} scope` | `config.steps.ts:206` | Sets up "before the first-run migration" |
| `the {string} file of the {word} scope holds this text:` / `declares these plugins:` / `declares these marketplaces:` / `declares no plugins` / `does not exist` | `config.steps.ts:257` / `:250` / `:228` / `:283` / `:266` | The local layer, and config write-back |
| `the {word} scope stages these skills and prompts:` | `plugin/installation.steps.ts:451` | The staged-artifact check (names) |
| `the installation record of the {word} scope holds these plugins:` / `holds no plugins` | `plugin/installation.steps.ts:464` / `:523` | Records |
| `the {word} scope holds no marketplace record` / `holds no marketplace checkout` | `marketplace/checkout.steps.ts:59` / `:45` | "records nothing" (D-PL5-28) |
| `the claude code settings file of the {word} scope holds this text:` | `claude-code-settings.steps.ts:34` | Import of `constructor@mp` (expands `{home}`) |

**Missing steps: none required.** The one optional addition is `Then the {word} scope stages no skills or prompts` in `plugin/installation.steps.ts`, for the enable refusal, where the disabled plugin stages nothing. Avoid it by installing a second, enabled plugin in that scenario, so the staged table has a row. If a plan adds the step, the module is a shared topic module: name it in that plan, and let only one plan in the wave touch it.

### ITMIG-01: LAYER-04, the 12 refusals (verified)

Setup per direction (integration `installedScope` + `DIRECTIONS`, `plugin-layer-verbs.test.ts:142-207`):
- **Target base:** install `<p>` with no flag. Then `a config in scope project and layer local, with this text:` `{ not json`. Run the verb with no flag.
- **Target local:** install `<p>` with `--local`, which declares the plugin and its marketplace in the local layer (LAYER-06). Then the base config gets `{ not json`. Run the verb with `--local`.
- Enable needs `disable … <flag>` first. Update should offer a newer version first, so that a missing refusal would change the record (verified with demo 1.1.0).

Every verb prints the same envelope and one row. This was verified for install, uninstall, enable, disable, update, and reinstall, in both directions. The message comes from `shared/errors.ts:779-785`: ``super(`Config file "${basename}" failed schema validation.`)`` `[VERIFIED: shared/errors.ts:779-785]`.

```gherkin
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | invalid manifest | project | Config file "claude-plugins.local.json" failed schema validation. | false           |       |                  |
```
(The `cause chain` names the **unreadable** file: `claude-plugins.local.json` when the target is base, `claude-plugins.json` when the target is local. There are no tally fields.)

"Changes nothing" checks, all verified green:
- `Then the config and installation record bytes of the project scope are unchanged` (base and state).
- Target base: `Then the "claude-plugins.local.json" file of the project scope holds this text:` `{ not json`.
- Target local: `Then the "claude-plugins.local.json" file of the project scope declares these plugins:` (and optionally `declares these marketplaces:` with `{home}/marketplaces/fixtures`), because `holds this text` cannot hold `{home}`.
- `Then the project scope stages these skills and prompts:` `| skill | demo-skill |`.

Drafts: `probe/layers.feature`, `probe/outline.feature` (the two-row Outline form, green), and `probe/update-shape.feature` (update, reinstall, and disable under the `update.feature`/`reinstall.feature` Background, green).

**LAYER-08 (the two cases already covered):** `reinstall.feature:105` "Reinstalling a dependency declares nothing in either layer" and `update.feature:306` "Updating every plugin updates the plugins of both layers and declares none of their dependencies". Both fail under break B12 (verified). Note: the integration backfill case runs `createReinstallOperation`, and the scenario runs the named `reinstall`. Both reach `update-swap.ts::finalizeUpdateRecord`, which is where B12 lands.

**Trimming `test/integration/plugin-layer-verbs.test.ts`:** keep the two LAYER-06 tests (`:414`, `:446`) and their helpers (`publish`, `installedScope`, `request`, `readIfPresent`, `layerConfigs`, `scopeFiles`, `declarations`, `forgetRecordedSource`). Remove `DIRECTIONS`, `NAMED_VERBS`, `NamedVerb`, `invalidLayerRow`, `baseDeclaresApp`, and the `extra` parameter of `installedScope` (it is typed `NamedVerb["extra"]`). Shrink `operations()` to `install`. Drop the imports that become unused (`createEnableOperation`, `createReinstallOperation`, `createUninstallOperation`, `createNodeReinstallPlugins`, `createReinstallPlugin`, `createPluginUpdateOperations`, `loadState`). `tsconfig` sets `noUnusedLocals` and ESLint sets `no-unused-vars` as an error. Rewrite the header (`:1-11`) so it describes only LAYER-06. `PLUGINS` can shrink to `alpha`.

### ITMIG-02: Plugin-layer consistency (verified)

The integration "reload" is `createApplyReconcile` (`plugin-layer-consistency.test.ts:88-102`), so use `When the user runs "/claude:plugin apply --scope <scope>"`. Rows below are verified. Full tables are in `probe/consistency.feature`.

| # | Integration case (line) | Scenario setup | Result | Lands in |
|---|---|---|---|---|
| C08 | local gap, apply + pending (`:146`) | add mp to project; install other; local declares demo@mp | `reconcile-applied-cascade`, error, `A plugin operation has failed.`, tally `Reconcile` 1 failure; one row `claude-plugins.local.json [project] … invalid manifest` with the LOCAL_GAP cause (`--local --scope project`); bytes unchanged | `configuration.feature`. The pending half is already covered by `configuration.feature:61` |
| C03 | base gap (`:184`) | `marketplace add {home}/marketplaces/fixtures --scope project --local`; `install other … --local`; base declares demo | same envelope; row `claude-plugins.json [project]` with the BASE_GAP cause (`marketplace add <source> --scope project`); bytes unchanged; record holds other only | `configuration.feature` |
| C02 | user-scope local gap (`:209`) | add mp to the **user** scope; install other `--scope user`; user local declares demo; `apply --scope user` | row `claude-plugins.local.json [user]`, cause ends `--local --scope user …`; user bytes unchanged | `configuration.feature`. Installing `other` first makes `state.json` exist, so the remembered-bytes step works. The integration case had no record |
| C04 | legacy local layer (`:228`) | add mp; `install demo … --local`; local rewritten `{"schemaVersion":1,"plugins":{"demo@mp":{}}}` | the LOCAL_GAP row; local `holds this text` (exact legacy bytes); bytes unchanged; record holds demo | `configuration.feature` |
| C05 | pending before migration (`:260`) | add mp; install demo; `the user has deleted the config files of the project scope`; local declares demo | `kind cascade`, error, tally `Reconcile pending` 1 failure; the LOCAL_GAP row; `the "claude-plugins.json" file … does not exist` (pending writes nothing) | `config-migration.feature` |
| C06 | malformed `demo@` (`:330`) | add mp; base declares other; local plugins row with an empty marketplace cell | `reconcile-applied-cascade`, needs reload true, `A marketplace operation has failed.`, 1 failure, success count 1; rows: `demo@ [project] failed {source mismatch}` (marketplace row, no plugin), and `mp … other@mp installed 1.0.0` | `configuration.feature` |
| C07 | dangling reference beside a declared plugin (`:297`) | add mp; base declares other; local declares ghost@nowhere | `Some operations have failed.`, 2 failures, success count 1; rows `other@mp installed` and `nowhere [project] failed {dangling reference}` / `ghost failed {dangling reference}` (include `leaks` and `rollback partial` columns); record holds other | `configuration.feature` |

`configuration.feature`'s Background offers only `demo`, so each new scenario offers `demo` and `other` again. `config-migration.feature`'s Background only publishes `fixtures`. With the Background marketplace, the rows read `fixtures` where the drafts say `mp`. `pending.feature` needs no change.

### ITMIG-03: reserved names, new file `features/plugin/reserved-names.feature` (verified)

The name rule `kebabCase(feature.name) === <dir>-<file>` gives `Feature: Plugin reserved names` → `plugin/reserved-names.feature` `[VERIFIED: scripts/check-features.mjs:369-372]`. Verified outputs (`probe/names.feature`, `probe/absent.feature`, `probe/proto.feature`):

| Scenario | When | Verified result |
|---|---|---|
| install | `install constructor@mp --scope project` | cascade/info/needs reload true; row `constructor@mp installed project 1.0.0`; record `constructor@mp 1.0.0 true` |
| list | `list --scope project` | `Plugin list` success 2; `constructor installed project 1.0.0`, `hello available 1.0.0` |
| info | `info constructor@mp` | `kind plugin-info`, `plugin status installed`, `plugin components skills constructor-skill`, `marketplace details autoupdate false` (fields only) |
| disable / enable / uninstall | the verb on `constructor@mp --scope project` | rows `disabled` / `installed` / `uninstalled`; info, needs reload true |
| update | after the catalog offers 1.1.0 | row `updated`, `from 1.0.0`, `to 1.1.0` |
| marketplace remove | `marketplace remove mp --scope project` | row `marketplace status removed`, `constructor@mp uninstalled`; then `the project scope holds no marketplace record` |
| import | settings `enabledPlugins {"constructor@mp": true}` and a `directory` source `{home}/marketplaces/mp` | row `marketplace status added`, `constructor installed`; base `declares these plugins` `constructor@mp` |
| import, then disable / uninstall | Given import; When disable / uninstall | base config `constructor@mp enabled false` / `declares no plugins` (integration `:330-391`) |
| apply declares `constructor@mp` | base marketplaces + plugins via config steps | row `added`, `constructor installed 1.0.0` |
| apply declares `hello@constructor` (D-PL5-28) | as above with marketplace `constructor` | `reconcile-applied-cascade`, error, `Some operations have failed.`, 2 failures; row `constructor [project] failed {invalid manifest}` / `hello@constructor failed {unreadable}`; `the project scope holds no marketplace record` and `holds no marketplace checkout` |
| `__proto__` lists unavailable | marketplace `hostile` offers `__proto__` and `hello` | `__proto__@hostile unavailable {unsupported source} 1.0.0`, `hello available` |
| `__proto__` install refused, no change | Given hello installed; remember bytes | row `__proto__@hostile failed {invalid manifest}`, cause `Plugin "__proto__@hostile" cannot be installed, because its id is invalid: … Here the plugin's name does not; the marketplace's maintainer can rename it.`; bytes unchanged; stages `hello-skill` |
| absent names, marketplace level (Outline, 4 rows) | `info x@constructor`, `reinstall x@constructor`, `marketplace update constructor`, `marketplace remove constructor` | each `kind marketplace-not-added`, `name constructor`, `reasons marketplace not added`, error, `A marketplace operation has failed.` |
| absent names, plugin level (Outline, 4 rows) | `uninstall`/`reinstall`/`update constructor@mp --scope project` → `failed {not installed}`; `enable` → `skipped {not installed}` (integration `:466-476`) | cascade/error/`A plugin operation has failed.`; add remembered bytes unchanged |

Background: only `mp` (constructor, hello) is common to most scenarios. The `hello@constructor` and `__proto__` scenarios do not need `mp`, and "a Background holds only steps every scenario needs" (`features.md`). So either use no Background, or keep those scenarios valid with it. See Pitfall 6.

### ITMIG-04: unfiltered list fold, `plugin/list.feature` (verified, `probe/fold.feature`)

- **F01 fold (CMC-21, D-13-17):** `official` (alpha, beta) added to the **user** scope; `install alpha@official --scope project`; `When … list`. Rows: `official [user] alpha@official installed scope project 1.0.0` and `official [user] beta@official available`. Tally success count 2. This is the full output, with no `official [project]` block.
- **F03 independent, same name, different source (D-13-17 exception):** publish `team`, offer alpha 0.9.0, `publishes this manifest:` with `"name":"official"`; add `official` to user; `marketplace add {home}/marketplaces/team --scope project`; `install alpha@official --scope project`. Rows: `official [project] alpha installed project 0.9.0` and `official [user] alpha available 1.0.0`.
- **F02 (the integration's literal case, different names):** `official-project [project] alpha available 0.9.0` and `official-user [user] alpha installed project 1.0.0`. It catches nothing that F01 does not (B6 and B7 fail both).

Recommend F01 + F03. F02 is optional. Also update the stale comments that name the deleted file: `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:546` and `test/orchestrators/plugin/list-flow.test.ts:15` and `:2187`. They are the only references outside `.planning` `[VERIFIED: grep]`. Editing `list-flow.ts` makes the commit hook run that pair's direct coverage.

### Deliberate breaks (each applied, run, and reverted in this session)

All are one-line replacements. Line numbers were read this session.

| ID | Site | Edit used | Failed (scratch) | Passed |
|---|---|---|---|---|
| B1 | `orchestrators/plugin/shared.ts:707` `if (otherCfg.status === "invalid") {` (in `loadTargetLayers`) | add `&& process.env.NEVER_SET === "x"` | install ×2, enable, disable, update ×2, reinstall | uninstall (own site) |
| B2 | `orchestrators/plugin/uninstall.ts:398` `if (other.status === "invalid") {` | same guard | uninstall | — |
| B12 | `orchestrators/plugin/update-swap.ts:1100`, after `const allSucceeded = …`: dynamic `import("../../persistence/config-io.ts")`, then `saveConfig(locations.baseConfigJsonPath, {...cfg, plugins:{...cfg.plugins, [`${plugin}@${marketplace}`]: {}}}, locations.scopeRoot)` | additive write | `reinstall.feature:105`, `update.feature:306` | — |
| B8 | `orchestrators/reconcile/read-pass.ts:357` `invalidOutcomes.push(...layerMarketplaceGapOutcomes(outcome, loc, scope));` | `.slice(1)` on the gap list | C02, C03, C04, C08 | C05, C06, C07 |
| B9 | `orchestrators/reconcile/pending.ts:231` `… : buildConfigFromState(state, local);` | `: {}` | C05 | the rest |
| B10 | `orchestrators/reconcile/plan.ts:471` (`cause: "malformed-plugin-key"` push) | `acc.dangling.pop()` after the push | C06 | the rest |
| B11 | `orchestrators/reconcile/plan.ts:487` (`cause: "dangling-reference"` push) | `acc.dangling.pop()` after the push | C07 | the rest |
| B3 | `shared/own-key.ts:13` `return map !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;` | `key in map` | install, list, disable, absent info, absent uninstall, hello@constructor | `__proto__` list |
| B4 | `domain/name.ts:360` `return !recorded && Object.hasOwn(Object.prototype, name)` | add `&& name === "never-a-name"` | hello@constructor | rest |
| B5 | `domain/plugin-resolver.ts:620` `if (isReservedRecordKey(entry.name)) {` | same guard | `__proto__` list | rest |
| B13 | `domain/dependencies.ts:47` `const TOKEN_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/;` | allow a leading `_` | `__proto__` install (row becomes `unavailable {unsupported source}`) | — |
| B6 | `orchestrators/plugin/list-orphan-fold.ts:26` `return projectMarketplace.marketplaceRoot === userMarketplace.marketplaceRoot;` | compare with `"never-a-root"` (no fold) | F01, F02 | F03 |
| B6b | same line | `return true;` (fold ignores the source) | F03 | F01, F02 |
| B7 | `orchestrators/plugin/list-flow.ts:756` `excludeFromAvailable: foldedNames,` | `new Set<string>()` | F01, F02 (duplicate available row) | F03 |

Breaks of the existing pending scenarios that also cover half of integration case `:146` (the local gap under pending): break `pending.ts::layerMarketplaceGapBlocks` (`:229-238`, `findLayerMarketplaceGaps(base, local)` → `[]`). `configuration.feature:61`, `:99`, and C05 should fail `[ASSUMED: not run]`.

Per-verb alternatives to B1, if a plan wants one break per verb: `install-flow-ledger.ts:718`, `enable-disable.ts:2492`, and `shared.ts:858` (update and reinstall through `namedPluginLayerRefusal`). Skipping those `if`s makes the code read fields of the `unreadable` arm, which do not exist, so the run crashes instead of acting on a layer that declares nothing. B1 is the more faithful break.

### Anti-patterns to avoid

- **A Then that checks part of a result.** Every `When` with rows needs `the result lists these plugins:` with the whole row set. Otherwise the world's After hook fails with "no step compared these rows of the last results" (seen in a probe, `features/support/world.ts:1294`).
- **Asserting `holds this text` on a config that holds a sandbox path.** It compares raw bytes, and the absolute path is different on every run.
- **Placeholders in an Outline title that may be empty** (`<flag>`): the title gets a trailing space. Use `<target layer>` in titles.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| "No file changed" | a new whole-tree snapshot step | remembered/unchanged bytes + `holds this text` / `declares …` + `stages these skills and prompts:` | A user-scope tree snapshot would include Pi's own session files, which change on every command. The existing steps already cover what the extension owns. |
| Making a config unreadable | a new fault-injection step | `a config in scope … with this text:` `{ not json` | It is the same CFG-03 arm (`loadConfig` → `invalid`) that the integration used |
| Pre-migration state | `earlier-version-state.ts` / release 0.4.3 rewrite | `the user has deleted the config files of the project scope` | It gives today's record schema with no base config, which is the integration's `rm(baseConfigJsonPath)` |
| Seeing actual result rows while drafting | `console.log` in steps | Write a Then with a wrong value. `recordTable` prints every column and row in the assertion diff | Verified technique |

## Common Pitfalls

### Pitfall 1: The two-row Outline and the Backgrounds of update/reinstall
**What goes wrong:** CONTEXT asks for one two-row Outline per verb. `features.md` asks for three or more variants per Outline. Separately, the Background of `update.feature` and `reinstall.feature` already installs `demo` into the base layer. A uniform `Given … install demo@fixtures --scope project <flag>` then fails in the base row ("already installed" is an error, so the `Given the user has run` step fails).
**How to avoid:** Use two plain scenarios per verb (12 scenarios). They follow the rule, and each direction gets its own setup. If the user keeps the Outline: install, uninstall, enable, and disable work as Outlines (verified in `probe/outline.feature`); update and reinstall need either a setup that differs by row or plain scenarios.
**Warning signs:** a `Given the user has run` failure in only one Examples row.

### Pitfall 2: The remembered bytes do not include the local config
**What goes wrong:** `scopeBytes` (`config.steps.ts:55-61`) reads only `claude-plugins.json` and `pi-claude-marketplace/state.json`. A local-layer write would pass "unchanged".
**How to avoid:** Always add a local-layer check: `holds this text` when it holds no path, otherwise `declares these plugins:` / `declares these marketplaces:`. Do not change the shared step: it has more than 20 users. It also needs `state.json` and the base config to exist; a missing one throws ENOENT.

### Pitfall 3: Break-detection verify commands
**What goes wrong:** Cucumber prints a failed scenario as `  N) <title> # <file>:<line>`, with no `Scenario:` prefix. The count line is singular for one scenario (`1 scenario (1 passed)`). A `file:line` filter must point at the line of the `Scenario:` keyword, or cucumber runs `0 scenarios` with exit 0 (I hit this in a probe).
**How to avoid:** Match `^  [0-9]+\) <title> # features/plugin/<file>.feature:<line>$` and `scenarios? \(`. Assert the count is not `0 scenarios`, or that a named scenario appears in the failure list.

### Pitfall 4: Running the builtin profile on these files selects nothing
**What goes wrong:** No scenario here has an MCP surface (no `mcp` word, no `mcpServers` or `.mcp.json` cell). So `--profile builtin <file>` prints `0 scenarios`, exit 0 (verified). That passes, but it proves nothing.
**How to avoid:** Run the red proofs under `adapter` only. Record the builtin run as "0 selected (DUAL-02)". Put no implementation tag on these scenarios: `check:features` fails on an unneeded tag.

### Pitfall 5: Token handling in config text
`a config … with this text:` does not expand `{home}` (`layer-config.ts:163-166` writes the text as it is). Write a source with `with these marketplaces:` (which expands it) or with the `marketplace add` command.

### Pitfall 6: Background scope in `reserved-names.feature`
The `hello@constructor` and `__proto__` scenarios do not use `mp`. A Background that publishes `mp` would hold a step that not every scenario needs. Either use no Background, or publish `mp` in each scenario. This is a review WARNING; `check:features` does not check it.

### Pitfall 7: Stale references after deletion
`list-flow.ts:546` and `list-flow.test.ts:15` and `:2187` cite `test/integration/fold-adoption.test.ts`. Point them at the new `features/plugin/list.feature` scenarios. Comments cite spec IDs, not process artifacts (`CONVENTIONS.md`).

### Pitfall 8: Parallel executors on 4 CPUs
Four plans in one wave means four cucumber runners. Use `--parallel 1` per executor when more than two run at once, or schedule two at a time (CONTEXT environment facts).

## Code Examples

The `__proto__` install refusal, verified green (`probe/proto.feature`):

```gherkin
  Scenario: Installing a plugin named __proto__ fails as an invalid plugin id and changes nothing (D-08-07)
    Given the marketplace "hostile" is published as a dir source
    Given the marketplace "hostile" offers these plugins:
      | name      | version |
      | __proto__ | 1.0.0   |
      | hello     | 1.0.0   |
    Given the marketplace "hostile" is added to the project scope
    Given the user has run "/claude:plugin install hello@hostile --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin install __proto__@hostile --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id                | name      | status | reasons          | scope   | cause chain | cause truncated | leaks | rollback partial |
      | hostile          | project           | __proto__@hostile | __proto__ | failed | invalid manifest | project | Plugin "__proto__@hostile" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it. | false | | |
    Then the config and installation record bytes of the project scope are unchanged
    Then the project scope stages these skills and prompts:
      | kind  | name        |
      | skill | hello-skill |
```

Break helper, the Phase 1 pattern, as used here:

```bash
F=extensions/pi-claude-marketplace/shared/own-key.ts; trap "git checkout -- $F" EXIT
python3 -c 'import sys;p,o,n=sys.argv[1:4];s=open(p).read();assert s.count(o)==1;open(p,"w").write(s.replace(o,n))' \
  "$F" 'Object.hasOwn(map, key) ? map[key]' 'key in map ? map[key]'
npm_config_script_shell=… NODE_OPTIONS=--max-old-space-size=6144 \
  npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/reserved-names.feature > "$D/B3.log" 2>&1
git checkout -- "$F"; trap - EXIT; git status --porcelain -- extensions/   # must print nothing
grep -E '^  [0-9]+\) .* # features/plugin/reserved-names\.feature:[0-9]+$' "$D/B3.log"
```

## Runtime State Inventory

This is not a rename or migration phase, so the section does not apply. The phase deletes test files only and touches no runtime state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.3 | — |
| non-DAC shell wrapper | npm scripts (permission behavior) | ✓ | `/tmp/claude-0/…/36571f01-…/scratchpad/nondac-sh` | — |
| Optional peers (pi-subagents, pi-mcp-adapter, workflows) | cucumber harness | ✓ (installed by `scripts/install-test-peers.mjs` in `test:cucumber:profile`) | per `optional-peer-suite-versions.json` | — |
| `fd` / `fdfind` | only `hook/tool-use.feature` (not this phase) | ✓ `fdfind` | — | — |

Measured adapter timings (`--parallel 2`, wall clock including peer install): `plugin/list` 6 s (13 scenarios), `configuration` 6 s, `pending` 6 s, `config-migration` 13 s, `install` 7 s (28), `uninstall` 7 s (19), `enable` 8 s (14), `disable` 7 s (9), `update` 9 s (26), `reinstall` 8 s (25), `info` 7 s (15), `import` 8 s (33), `marketplace/reserved-name` 7 s (23). A scratch file of 7 scenarios runs in about 3.5 s.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js (behavioral) and node:test (integration trims) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`) |
| Quick run command | `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/<file>.feature` (6 to 13 s) |
| Feature gate | `npm run check:features` (inside `check:static`): layout, title-to-file name, lower-case steps, Given order, tags, unused or ambiguous steps |
| Full suite command | `npm run check` (phase gate; 2,400 s limit) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITMIG-01 | 12 refusals change nothing | behavioral | `… --profile adapter --parallel 2 features/plugin/{install,uninstall,enable,disable,update,reinstall}.feature` | ✅ files exist; scenarios are new |
| ITMIG-01 | LAYER-06 cases kept | integration | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/plugin-layer-verbs.test.ts` | ✅ (trimmed) |
| ITMIG-02 | layer gaps, legacy layer, pending pre-migration, malformed key, dangling ref | behavioral | `… features/plugin/configuration.feature features/plugin/config-migration.feature` | ✅ |
| ITMIG-03 | constructor / `__proto__` / `hello@constructor` | behavioral | `… features/plugin/reserved-names.feature` | ❌ new file |
| ITMIG-04 | unfiltered fold | behavioral | `… features/plugin/list.feature` | ✅ |
| all | red proofs | break + adapter run | break helper above; failure lines match `^  N\) <title> # <file>:<line>` | evidence in SUMMARY |

### Sampling Rate
- **Per task commit:** the touched feature files under adapter, plus `npm run check:static` (the hook may not run in a worktree).
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green (adapter and builtin), then `/gsd-verify-work`.

### Wave 0 Gaps
None. The existing test infrastructure covers every phase requirement. No step, fixture, or support module is needed.

## Security Domain

`security_enforcement` is absent, so it is enabled. This phase changes tests only. It adds no input path, credential, network call, or file write in product code.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4 | no | — |
| V5 Input Validation | indirectly (scenarios pin the existing D-08-07 own-key handling and the CFG-03 refusal) | `shared/own-key.ts`, `loadConfig` invalid arm |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Prototype pollution through `__proto__` / `constructor` keys | Tampering | own-key reads and writes (`own-key.ts:9-19`); now pinned by scenarios |
| A break left in the tree | Tampering (test integrity) | EXIT-trap `git checkout`, `git status --porcelain -- extensions/` empty, never committed |

## Plan Split (suggested)

One wave, four plans, disjoint files, no shared step module:

| Plan | Req | Files changed | Files deleted / trimmed | Breaks |
|---|---|---|---|---|
| 02-01 | ITMIG-01 | `features/plugin/{install,uninstall,enable,disable,update,reinstall}.feature` | trim `test/integration/plugin-layer-verbs.test.ts` (keep 2 LAYER-06) | B1, B2, B12 |
| 02-02 | ITMIG-02 | `features/plugin/configuration.feature`, `features/plugin/config-migration.feature` | delete `test/integration/plugin-layer-consistency.test.ts` | B8, B9, B10, B11 (+ the pending gap break for `configuration.feature:61`/`:99`) |
| 02-03 | ITMIG-03 | NEW `features/plugin/reserved-names.feature` | delete `test/integration/reserved-record-keys.test.ts` | B3, B4, B5, B13 |
| 02-04 | ITMIG-04 | `features/plugin/list.feature`, comments in `orchestrators/plugin/list-flow.ts:546`, `test/orchestrators/plugin/list-flow.test.ts:15,2187` | delete `test/integration/fold-adoption.test.ts` | B6, B6b, B7 |

Shared files: none. If 02-01 adds the optional "stages no skills or prompts" step, `plugin/installation.steps.ts` becomes the one shared file, and only 02-01 may touch it. No test helper is left without a user: `createHermeticEnvironment`, `withHermeticEnvironment`, `enterHermeticEnvironment`, `runWithNothingLoaded`, `noStatusReaders`, `createGitOpsFake`, `makeMockPi`, `makeCtx`, and `createNotificationBoundary` each still have other importers `[VERIFIED: grep of test/]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fallow audit` also gives `weakened-tests` for a trimmed (not deleted) integration file | Constraints | One more warn to record in the SUMMARY; no gate change |
| A2 | The pending gap break (`pending.ts:229-238` → `[]`) fails `configuration.feature:61`, `:99`, and C05 | Deliberate breaks | Not run. If it fails nothing, half of case `:146` needs another proof |
| A3 | The user accepts two plain scenarios per verb instead of the locked two-row Outline (or keeps the Outline despite the `features.md` WARNING) | Pitfall 1 | Review churn only |

## Open Questions

1. **The Outline layout for LAYER-04.** Known: a two-row Outline breaks the `features.md` "three or more variants" rule; eight two-row Outlines already exist; update and reinstall cannot share one setup step across the rows. Recommendation: two plain scenarios per verb, which CONTEXT itself calls "cheap to change". Confirm with the user, or record the choice in the plan.
2. **F02 vs F03 for the independent marketplace.** Recommendation: F03 (the real same-name exception). Add F02 only if the plan wants a literal mirror of the integration case.

## Sources

### Primary (HIGH confidence)
- Repo source read this session: `orchestrators/plugin/shared.ts:660-930`, `uninstall.ts:370-470`, `install-flow-ledger.ts:695-735`, `enable-disable.ts:2475-2510`, `update-flow.ts:1485-1525`, `reinstall-flow.ts:740-775`, `update-swap.ts:1080-1110`, `shared/errors.ts:760-800`, `shared/own-key.ts`, `domain/name.ts:60-100, 340-410`, `domain/plugin-resolver.ts:610-640`, `domain/dependencies.ts:47-52`, `orchestrators/plugin/list-orphan-fold.ts`, `list-flow.ts:540-760`, `orchestrators/reconcile/read-pass.ts:130-380`, `pending.ts:205-300`, `plan.ts:75-100, 455-520`, `persistence/config-merge.ts:125-200`.
- Step modules: `command.steps.ts`, `config.steps.ts`, `plugin/installation.steps.ts`, `marketplace/publishing.steps.ts`, `marketplace/checkout.steps.ts`, `claude-code-settings.steps.ts`, `features/lib/layer-config.ts`, `features/lib/field-rows.ts`, `scripts/check-features.mjs`.
- Skill rules: `.agents/skills/cucumber/{SKILL.md,rules/layout.md,rules/features.md}`, `.agents/skills/local-verification/**`.
- Scratch runs: 9 probe runs and 15 break runs, logs in the scratch folder named above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Existing harness only.
- Architecture and scenario shapes: HIGH. Every draft passed under adapter.
- Breaks: HIGH. 15 breaks applied and reverted; one (A2) not run.
- Pitfalls: HIGH. Each one was hit or measured.

**Research date:** 2026-11-21
**Valid until:** 2026-12-21, or until a shared step module or a break-site file changes.

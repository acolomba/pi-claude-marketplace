---
quick_id: 261109-cpo
description: A load that refuses a newer state.json stops offering the scope's skills and prompts (P7-DC-04, amends D-BG-703 and the STMIG-02 load scenario)
date: 2026-11-09
mode: quick-batch
phase: quick-261109-cpo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - test/persistence/state-io.test.ts
  - test/orchestrators/discover.test.ts
  - test/index.test.ts
  - features/plugin/state-migration.feature
autonomous: true
requirements: [STMIG-02, APL-D1, NFR-2]

must_haves:
  truths:
    - "A new session whose user-scope state.json carries a schemaVersion this release does not read offers none of that scope's skills. The load still reports the refusal exactly as D-BG-703 measured it (two `reconcile-applied-cascade` errors with the `state.json failed {unreadable}` row, two `plugin-path-skipped` warnings), the config and record bytes stay unchanged, and the user scope still stages `demo-skill` on disk (STMIG-02 load scenario, amended)"
    - "When only the user scope's record is refused, the same new session still offers the project scope's plugin skill `/skill:helper-skill` and nothing of the user scope (new per-scope scenario)"
    - "aggregateDiscoveredResources leaves out both the skill directories and the prompt files of a scope whose loadState rejects with UnsupportedStateSchemaError, for the user scope and for the project scope, and keeps the other scope's paths in today's order"
    - "A scope whose state.json does not parse as JSON still contributes its skills and prompts: only the newer-schema refusal withdraws them (the item's scope; widening is an open question for the user)"
    - "loadState rejects an unsupported schemaVersion with UnsupportedStateSchemaError, whose message stays `state.json at <path> has an unsupported schema version`, and leaves the stored bytes as they were"
    - "Discovery writes nothing: it reads each record with persistMigration false, and a refused scope's staged files stay on disk"
    - "PROJECT.md holds a D-BG-705 row that records the per-kind decision, the Claude Code 2.1.319 evidence, the kinds this release cannot withdraw without a write and their license, and amends D-BG-703; the CHANGELOG Unreleased entry gains one sub-bullet"
  artifacts:
    - path: extensions/pi-claude-marketplace/persistence/state-io.ts
      provides: "the typed refusal that loadState throws for a schemaVersion other than 1, 2, or 3"
      contains: "class UnsupportedStateSchemaError"
    - path: extensions/pi-claude-marketplace/orchestrators/discover.ts
      provides: "the per-scope withdrawal of a refused scope's skills and prompts"
      contains: "UnsupportedStateSchemaError"
    - path: features/plugin/state-migration.feature
      provides: "the amended STMIG-02 load scenario and the per-scope scenario"
      contains: "still offers the project scope's skills"
    - path: .planning/PROJECT.md
      provides: "the D-BG-705 decision row and the amendment note on D-BG-703"
      contains: "D-BG-705"
    - path: CHANGELOG.md
      provides: "the Unreleased sub-bullet"
      contains: "newer release"
  key_links:
    - from: "the resources_discover handler in extensions/pi-claude-marketplace/index.ts"
      to: "aggregateDiscoveredResources (orchestrators/discover.ts)"
      via: "the user locations and, for a trusted project, the project locations; index.ts does not change"
      pattern: "aggregateDiscoveredResources\\("
    - from: "aggregateDiscoveredResources"
      to: "loadState (persistence/state-io.ts)"
      via: "one read-only load per scope"
      pattern: "persistMigration: false"
    - from: "the unsupported-version branch of loadState"
      to: "UnsupportedStateSchemaError"
      via: "throw before any migration"
      pattern: "new UnsupportedStateSchemaError\\("
---

<objective>
P7-DC-04, decided by the user in the 2026-11-09 dubious-choices review ("fix before the PR"): when a load refuses a scope's `state.json` because its `schemaVersion` is newer than this release reads, Pi stops offering that scope's installed components instead of serving the staged files. Today the load reports the refusal (D-BG-703) but `orchestrators/discover.ts` still hands Pi the scope's staged skill directories and prompt files, because discovery reads no record. After this plan, discovery leaves a refused scope out, so Pi offers none of its skills and none of its bridged commands (prompt templates). The refusal report, the config, the record, and the staged files stay as they are.

Purpose: a release that cannot read a scope's installation record cannot tell which staged artifacts belong to a recorded, enabled install, so it fails closed, as Claude Code does when it cannot read its registries (Upstream evidence below). The other kinds are decided in the Per-kind decision table below.

Output: Task 1 (tracer) ships the typed refusal, the per-scope withdrawal, their unit proofs, and the amended and new STMIG-02 scenarios in one green commit. Task 2 records D-BG-705 (amending D-BG-703) and the CHANGELOG sub-bullet.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@extensions/pi-claude-marketplace/orchestrators/discover.ts
@extensions/pi-claude-marketplace/persistence/state-io.ts
@features/plugin/state-migration.feature
@test/orchestrators/discover.test.ts

Records (read, do not edit): `.planning/milestones/behavioral-gaps-phases/07-state-schema-migration/07-CONTEXT.md` (D-BG-703, D-BG-704) and `DUBIOUS-CHOICES.md` in the same folder (P7-DC-03, P7-DC-04); the root `.planning/DUBIOUS-CHOICES.md` lines 46-47 and 115 (the user's decision). The PROJECT.md decision table holds D-BG-703 at line 2206 and D-BG-704 at line 2207.

Project skills that bind this plan: `.agents/skills/committing/SKILL.md`; `.agents/skills/local-verification/SKILL.md` with `rules/commands.md` and `rules/gates.md`; `.agents/skills/typescript-unit-tests/SKILL.md` with `rules/pairing-and-design.md`, `rules/cases.md`, and `rules/boundaries.md`; `.agents/skills/typescript-style/SKILL.md` with `rules/comments.md` (comments and test titles cite D-BG-705, D-BG-703, STMIG-02, APL-D1, NFR-2, T-02-17; never a quick id, phase, or plan; no narration of removed behavior); `.agents/skills/cucumber/SKILL.md` with `rules/features.md` and `rules/steps.md`; `.agents/skills/changelog/SKILL.md` (load the `simple-english` Plain and `humanizer` skills for every comment, test title, scenario title, decision text, and CHANGELOG line).

Cross-item note: this item needs no sibling first and no sibling needs it, so `depends_on` is empty. Sibling items of this batch also add CHANGELOG sub-bullets and PROJECT.md decision rows; the batch's wave computation separates the shared files.

Executor rules for this run:
- Read each file before editing it. `aggregateDiscoveredResources` has exactly one production caller (`index.ts` line 237), and `loadState`'s unsupported-version branch is read by the callers listed in the interfaces block; confirm with `npx --no codegraph explore "aggregateDiscoveredResources loadState"` or grep.
- Every unit case is hermetic: `createHermeticEnvironment` (discover), the existing temp extension roots (state-io), `createHermeticScope` (index). Never touch the real `~/.pi`.
- A red run is observed locally, recorded in the SUMMARY (the failing step or assertion and the actual value), and never committed.
- One commit per task. Before each commit run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <changed files>`, restage the fixer edits, then `git commit` in the foreground with the longest tool timeout. The hook runs `npm run check:commit`. Never `--no-verify`, never `--amend`, never `git add -A` (stage the named files only), never push, never rebase, never a bare `git stash`. Titles follow Conventional Commits, 5 to 72 characters, and name no quick id, phase, or plan.
- In a fresh worktree without `node_modules`, run `npm ci --ignore-scripts --no-audit --no-fund` first; `npm run test:cucumber:profile` runs `scripts/install-test-peers.mjs` itself.
- Write temporary files and logs under the executor session's scratchpad directory, never in the repository.
- Do not edit `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/BACKLOG.md`, either DUBIOUS-CHOICES.md, or any archived milestone file. The batch coordinator owns those records.

Sizing note: Task 1 touches six files because the typed refusal, its one consumer, and the three test files and the feature file that pin the change must land in one green commit. Splitting it leaves a red unit test or a red scenario between commits: `test/index.test.ts` expects the refused project scope's prompt today, and the STMIG-02 load scenario expects the refused scope's skill. Two of the six change only an expectation (`test/persistence/state-io.test.ts`, `test/index.test.ts`).

<interfaces>
Current code at 9a398226 (read the files for the bodies):

`orchestrators/discover.ts`: `aggregateDiscoveredResources(userLocations: ScopedLocations, projectLocations: ScopedLocations | undefined): Promise<DiscoveredResources>` (lines 17-61). It builds `scopes` (user, then project; T-02-17 passes `undefined` for an untrusted project), runs two `collectForKind` calls per scope (each behind `// eslint-disable-next-line no-await-in-loop -- <reason>`), throws `AggregateResourcesDiscoverError` after the loop when a hard read failed, and returns frozen arrays. It imports nothing from `persistence/` today. Its one production caller is the `resources_discover` handler in `index.ts` (line 237), inside a try whose catch returns empty paths (NFR-2).

`persistence/state-io.ts`: `loadState(extensionRoot, options: { readonly persistMigration?: boolean } = {}): Promise<ExtensionState>` (lines 500-606). Its refusals: a read error other than ENOENT (`Failed to read <path>: ...`), invalid JSON (`state.json at <path> is not valid JSON: ...`, cause a SyntaxError), an own `schemaVersion` other than 1, 2, or 3 (lines 531-539, a plain `Error` with `state.json at ${stateJsonPath} has an unsupported schema version`, thrown before any migration), and failed validation (`state.json at <path> failed schema validation: ...`). `persistMigration: false` suppresses the fire-and-forget migration save (line 601). ENOENT returns the default state.

Readers of the refusal that must keep working unchanged: `classifyReadPassThrow` (`orchestrators/reconcile/apply-outcomes.ts` line 869) falls through to `narrowProbeError` (`shared/probe-classifiers.ts` line 37), which returns `unreadable` for an Error that is not a SyntaxError, an InvalidMarketplaceManifestError, or an errno error, so a subclass keeps the `{unreadable}` reason; `shared/redact-absolute-paths.ts` line 39 keys its path cut on the message text, which does not change. Several tests compare the message text only (`test/orchestrators/plugin-path.test.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`, `test/index.test.ts`, and others); they stay as they are.

Tests: `test/persistence/state-io.test.ts` lines 397-422 (`rejects an unsupported stored schema version without replacing future bytes`) asserts `name: "Error"`. `test/orchestrators/discover.test.ts` helpers `makeTestLocations`, `stageSkill`, `stagePrompt` (lines 20-49); `locationsFor("user", root)` resolves through the hermetic agent dir, so write the user record at `user.stateJsonPath`. `test/index.test.ts`: `EMPTY_DISCOVERY` (line 166), `seedPrompt` (890), `seedUnreadableState` and `seedUnreadableStateAt` (1041-1052, schemaVersion 99), and the loop `load warnings share one ${mode} run and continue after append refusal ${refusesAppend}` (1123-1212), whose assertion at line 1167 expects the refused project scope's prompt `kept.md`.

`features/plugin/state-migration.feature`: description lines 3-5; Background lines 7-13 (dir marketplace `fixtures`, `demo` 1.0.0 installed into the user scope; `demo` ships `/skill:demo-skill`, `A skill of demo 1.0.0.`); the load scenario `A load refuses a newer installation record and leaves it as it was` (lines 116-133) ends with the `/skill:demo-skill` table at lines 130-132. Steps this plan uses all exist: `the marketplace {string} is published as a dir source`, `the marketplace {string} offers these plugins:`, `the marketplace {string} is added to the project scope`, `the user has run {string}`, `the installation record of the {word} scope is rewritten with a schema version this release does not read`, `the user starts a new pi session`, `the session reports these results:`, `the results list these marketplaces and plugins:`, `the session offers these skills:`, `the session offers no skills`, and `the {word} scope stages these skills and prompts:`. A fixture plugin `<name>` ships `/skill:<name>-skill` described as `A skill of <name> <version>.` (`features/lib/path-marketplace.ts` line 108).
</interfaces>

## Upstream evidence (claude-code-compat-research)

Question: what Claude Code does when `installed_plugins.json` (or `known_marketplaces.json`) carries a version newer than it understands: does it load none of the plugins, some, or refuse?

Evidence: the installed binary, Claude Code 2.1.319 (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`), read with `grep -boa` and `dd` on 2026-11-09. No sandboxed probe was run.

1. Read (high confidence). The registry loader takes the version 2 path for `version === 2` and parses anything else with the version 1 schema, whose `version` is `z.literal(1)` (offset 282509955). A newer file fails that parse, and the load logs `Failed to load installed_plugins.json: ... Starting with empty state.` and uses an empty list that it marks unreadable (offset region 296533392 to 296546991).
2. Write (high confidence). Every write is refused while the file holds a version above 2 (`if (r.version > 2) return { refusal: ... }`), with: `installed_plugins.json was not changed: installed_plugins.json is in a format (version N) that this version of Claude Code does not know, so plugins cannot be changed from this version, and some may not load. Update Claude Code on this machine (claude update), or change plugins with the version of Claude Code that wrote <path>.`
3. Load (high confidence for the error text, medium for the exception). Each enabled plugin whose load needs its install record is not loaded, with `Plugin "<id>" is not loaded: installed_plugins.json could not be read, so its install could not be checked — fix or restore installed_plugins.json in the plugins directory, then run /reload-plugins`, followed by the note from point 2. A relative-path plugin of a marketplace added from a local directory or file is read in place (`I3e`, with `Zh(e)` true for `source === "file"` or `"directory"`, offsets 292751667 and 282500377) and still loads: the "some may not load" of the note.
4. `known_marketplaces.json` (medium confidence). It has no version field. A file that fails its schema loads as an empty registry marked unreadable (`Nc` and `Z8n`, offset 296451868), the settings-declared marketplaces are not added either, and no plugin of a non-official marketplace loads: `plugin <id> not loaded (hooks module, commands, skills, servers: none of it): its marketplace <m> is unknown because known_marketplaces.json could not be read this load`.

Mapping and conclusion: this extension's `state.json` holds both registries, the marketplace records that `known_marketplaces.json` holds and the plugin records that `installed_plugins.json` holds. A refused `state.json` is therefore the case where both registries are unreadable, and there Claude Code loads none of a plugin's components (point 4). The in-place exception of point 3 needs a readable marketplace registry and a load-time read of the plugin's source, and this extension never serves a component from its source at load (APL-D1: components are staged by install and apply only). The user's direction matches Claude Code, so no checkpoint is needed.

Remaining differences, recorded in D-BG-705 and not changed here: Claude Code names each plugin it does not load and tells the user to update; this extension keeps D-BG-703's report (the `state.json failed {unreadable}` reconcile row and the `plugin-path-skipped` warning). The kinds in the last three rows below stay served.

## Per-kind decision

| Kind | How Pi gets it | With a refused state.json today | This plan |
| --- | --- | --- | --- |
| Skills | `resources_discover` `skillPaths` from `<extensionRoot>/resources/skills/` (`orchestrators/discover.ts`, which reads no record) | offered | withdrawn: discovery leaves the scope out (Task 1) |
| Prompts (bridged commands) | `resources_discover` `promptPaths` from `<extensionRoot>/resources/prompts/` | offered | withdrawn by the same change (Task 1) |
| Skill and command aliases, the command tool, the SKILL.md read fill | `orchestrators/skill-alias-state.ts` reads the record and skips a scope it cannot read; the rest read Pi's command list (`pi.getCommands()`) | aliases already skipped; the rest follow Pi's list | withdrawn with the skills and prompts, no change |
| Hooks | routing hydrated from the record (`bridges/hooks/event-router.ts`: `hydrateCacheFromDisk` uses an empty state, and `hydrateProjectScopeForCwdWith` clears the project entries and returns) | not routed | no change |
| Plugin `bin/` on PATH | `orchestrators/plugin-path.ts` reads the record | dropped, reported as `plugin-path-skipped` | no change |
| Built-in MCP registrations | `orchestrators/mcp/builtin-registration-step.ts` reads the record at `session_start` and after the load | a fresh load registers none of the scope's servers, and registrations die with Pi's runtime (`bridges/mcp/builtin-registration.ts`), so nothing carries over between loads; within one runtime, a server registered before the record became unreadable keeps its registration until the next load (NFR-2 retention) | no change |
| pi-mcp-adapter servers | `<scopeRoot>/mcp-adapter.json` (legacy `mcp.json`), read by pi-mcp-adapter itself | served | not withdrawn: it needs a write to a file the newer release also manages |
| Agents | `<scopeRoot>/agents/*.md`, read by pi-subagents itself | served | not withdrawn: it needs moving or deleting files |
| Workflows | saved scripts in the engine's saved-workflow directory, read by the workflow engine | served | not withdrawn: it needs a write |

The last three rows are a licensed divergence (Pi capability gap): those companions read their own files and Pi gives this extension no load-time way to hide them, a load changes no installation state (APL-D1), and an older release must not rewrite what a newer one wrote (D-BG-703's fail-closed rule). Task 2 records this in D-BG-705.

## Source audit

| Source | Item | Covered by | Status |
| --- | --- | --- | --- |
| GOAL | A load that refuses a newer state.json stops offering that scope's installed components | Task 1 | COVERED |
| CONTEXT | Research Claude Code's newer-registry behavior first, record the finding and evidence | Upstream evidence | COVERED |
| CONTEXT | Decide per kind, name the kinds that need a write, and say how they are handled | Per-kind decision; Task 2 (D-BG-705) | COVERED |
| CONTEXT | Amend D-BG-703 | Task 2 | COVERED |
| CONTEXT | The STMIG-02 scenarios change and fail without the change | Task 1 | COVERED |
| CONTEXT | Fail closed, `{unreadable}`; the load changes no installation state (APL-D1); no throw escapes the Pi events (NFR-2) | Task 1 | COVERED |
| CONTEXT | Hermetic tests; commit rules; CHANGELOG sub-bullet; `## Threat Flags` in the SUMMARY | Tasks 1 and 2; output | COVERED |
| RESEARCH | Claude Code still loads a local-marketplace path plugin when only `installed_plugins.json` is unreadable | no Pi analog (state.json holds both registries) | documented in D-BG-705 |

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: A load withholds the skills and prompts of a scope whose installation record is newer</name>
  <files>extensions/pi-claude-marketplace/persistence/state-io.ts, extensions/pi-claude-marketplace/orchestrators/discover.ts, test/persistence/state-io.test.ts, test/orchestrators/discover.test.ts, test/index.test.ts, features/plugin/state-migration.feature</files>
  <read_first>extensions/pi-claude-marketplace/orchestrators/discover.ts, extensions/pi-claude-marketplace/persistence/state-io.ts (lines 488-606), test/orchestrators/discover.test.ts, test/persistence/state-io.test.ts (lines 397-422), test/index.test.ts (lines 160-170, 885-900, 1035-1212), features/plugin/state-migration.feature, .agents/skills/cucumber/rules/features.md</read_first>
  <precondition>`node_modules/` resolves in the executor checkout, so the owner tests and the cucumber run can start.</precondition>
  <behavior>
    - test/persistence/state-io.test.ts, the existing case at lines 397-422: the rejection is an UnsupportedStateSchemaError and an Error, its name is `UnsupportedStateSchemaError`, its message is still `state.json at <path> has an unsupported schema version`, it has no cause, and the stored bytes are unchanged.
    - test/orchestrators/discover.test.ts, new case (D-BG-705): with a user record of `{"schemaVersion":4,"marketplaces":{}}`, a staged skill and prompt in each scope, and no project record, discovery returns only the project scope's skill and prompt; the user record keeps its bytes and the user's staged skill and prompt are still on disk.
    - discover.test.ts, new case (D-BG-705): with a project record of schemaVersion 4 and no user record, discovery returns only the user scope's skill and prompt.
    - discover.test.ts, new case (D-BG-705 scope): a user record that is not valid JSON still yields the user scope's skill and prompt, because only the newer-schema refusal withdraws a scope.
    - The existing discover.test.ts cases pass unchanged (order, T-02-17 untrusted project, filters, missing directories, the four hard read failures).
    - test/index.test.ts, the loop at lines 1123-1212 (both scopes refused, the project prompt seeded): the discovery answer is `EMPTY_DISCOVERY` in all four variants, and the payload assertions stay as they are.
    - features/plugin/state-migration.feature, the amended load scenario: the session offers no skills, and the user scope still stages `demo-skill`; the results tables and the remembered-bytes step stay as they are.
    - state-migration.feature, the new scenario: with the user record refused and `helper@tools` installed into the project scope, the session offers exactly `/skill:helper-skill`.
  </behavior>
  <action>
RED first, per the TDD rule (D-BG-705). Write the test and scenario changes below, run them, and record each failure in the SUMMARY: the amended load scenario fails because Pi still offers `/skill:demo-skill`, the new scenario fails because Pi offers both `/skill:demo-skill` and `/skill:helper-skill`, the new discover cases fail because the refused scope's paths come back, the index loop fails on the kept prompt, and the state-io case fails on the name `Error`.

Tests. In `test/persistence/state-io.test.ts`, change only the assertions of the case at lines 397-422: import UnsupportedStateSchemaError from the state-io module, assert `instanceof` it, and expect the name `UnsupportedStateSchemaError` with the same message, no cause, and the same retained bytes. In `test/orchestrators/discover.test.ts`, add the three cases of the behavior block with the file's existing helpers (`makeTestLocations`, `stageSkill`, `stagePrompt`), writing each record with `writeFile` at `<locations>.stateJsonPath` after a recursive `mkdir` of its `extensionRoot`. Assert the whole discovery answer with `deepEqual` as the existing cases do. In the refused-user case, also compare the record bytes after discovery and check that the user's staged skill directory and prompt file still exist. Titles name the behavior and cite D-BG-705, with no quick id or phase. In `test/index.test.ts`, inside the loop at lines 1123-1212, keep seeding the project prompt (rename the file to `withheld.md` and drop the now unused `promptPath` binding, since `noUnusedLocals` rejects it) and expect `EMPTY_DISCOVERY`. Change nothing else in that file: no read, probe, mode, or trust count moves, because discovery reads the record through `locations.extensionRoot` and never through the event or the context.

Feature (STMIG-02, amended by D-BG-705). In `features/plugin/state-migration.feature`: (a) Rewrite the description, keeping it to three lines, so that a record a newer release wrote is refused, left as it was, and its scope offers no skill until a release that reads it runs. Keep the sentence about the rewritten records and the local marketplace. (b) Retitle the load scenario `A load refuses a newer installation record, leaves it as it was, and offers none of its plugins' skills`. Replace its `Then the session offers these skills:` table with `Then the session offers no skills`, then add `Then the user scope stages these skills and prompts:` with the same `kind` / `name` table that the disabling scenario ends with (one row: `skill`, `demo-skill`). That row catches a load that unstages files, which would break APL-D1. Keep its results tables and its bytes steps exactly as they are. (c) Add, right after it, the scenario `A load that refuses the user scope's newer installation record still offers the project scope's skills`. Its Givens publish the marketplace `tools` as a dir source offering `helper` 1.0.0, add `tools` to the project scope, run `/claude:plugin install helper@tools --scope project`, and rewrite the user scope's record with a schema version this release does not read. Then `When the user starts a new pi session`, the full `Then the session reports these results:` and `Then the results list these marketplaces and plugins:` tables (measure them: they are expected to equal the load scenario's tables, and the world fails a scenario whose results go uncompared), and `Then the session offers these skills:` with the one row `/skill:helper-skill`, `A skill of helper 1.0.0.`. Every step already exists. The file stays untagged, because no step names MCP.

GREEN. In `persistence/state-io.ts`, add the exported class UnsupportedStateSchemaError beside `loadState`, as other modules keep the error they alone throw (for example `MigrateConfigSaveError` in `orchestrators/reconcile/apply-outcomes.ts`). It extends Error, takes the state.json path, builds the unchanged message `state.json at <path> has an unsupported schema version`, and sets `this.name` to its class name. Give it a doc comment that cites ST-1, D-BG-703, and D-BG-705, and add no fields that no caller reads. Throw it from the unsupported-version branch (lines 531-539) in place of the plain Error, and leave the other refusals and the rest of `loadState` as they are. In `orchestrators/discover.ts`, import `loadState` and UnsupportedStateSchemaError from `../persistence/state-io.ts` (the orchestrators zone may import persistence, as `plugin-path.ts` does). Add a private helper that awaits `loadState(locations.extensionRoot, { persistMigration: false })`, a read-only snapshot like the one `builtin-registration-step.ts` takes. The helper answers whether the scope is offered: false only when the load rejects with UnsupportedStateSchemaError, narrowed with `instanceof` and never on the message, and true for a resolved load or any other rejection. A record that cannot be read or parsed keeps today's behavior; that choice is the item's scope, and the SUMMARY raises it as a question. The helper swallows the rejection it decides on, so nothing new can escape `resources_discover` (NFR-2). In `aggregateDiscoveredResources`, skip a scope that is not offered before its two `collectForKind` calls. Either check both scopes up front with `Promise.all`, or add the check in the loop behind the same `no-await-in-loop` disable comment with a reason. Keep the function under both cognitive-complexity ceilings (ESLint sonarjs 15 and fallow 15). Extend its doc comment with one D-BG-705 sentence: a scope whose record has a newer schema contributes nothing, and its staged files stay on disk. Discovery writes nothing. `index.ts` does not change.

Run the owner tests, both pairs' direct coverage, and the feature file until green. Then commit the six files, for example `fix(load): withhold a newer record's skills and prompts`.
  </action>
  <verify>
    <automated>node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/state-io.test.ts test/orchestrators/discover.test.ts test/index.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/discover.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/state-io.ts && npm run check:features && npm run test:cucumber:profile -- --profile adapter features/plugin/state-migration.feature</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'class UnsupportedStateSchemaError' extensions/pi-claude-marketplace/persistence/state-io.ts` prints 1 (baseline at HEAD: 0).
    - `grep -c 'UnsupportedStateSchemaError' extensions/pi-claude-marketplace/orchestrators/discover.ts` prints at least 2 (baseline at HEAD: 0).
    - `grep -c 'persistMigration: false' extensions/pi-claude-marketplace/orchestrators/discover.ts` prints at least 1 (baseline at HEAD: 0).
    - `grep -c "Scenario: A load that refuses the user scope's newer installation record still offers the project scope's skills" features/plugin/state-migration.feature` prints 1 (baseline at HEAD: 0).
    - `grep -c 'Then the session offers no skills' features/plugin/state-migration.feature` prints 2 (baseline at HEAD: 1, the disabled-plugin scenario).
    - All twelve scenarios of `features/plugin/state-migration.feature` pass under the adapter profile. Both pairs report 100% line, function, and branch direct coverage.
    - The SUMMARY records the RED run of each changed test and scenario, with the failing step or assertion and the actual value.
  </acceptance_criteria>
  <done>A new session whose user record is newer than this release reads offers none of that scope's skills or prompts, still reports the refusal as before, and changes no file. A readable project scope keeps its skills. A record that does not parse keeps today's behavior. loadState throws the typed refusal with the unchanged message. One commit holds the six files, and the commit hook passed.</done>
</task>

<task type="auto">
  <name>Task 2: Record D-BG-705, amend D-BG-703, and add the CHANGELOG sub-bullet</name>
  <files>.planning/PROJECT.md, CHANGELOG.md</files>
  <read_first>.planning/PROJECT.md (lines 2200-2210), CHANGELOG.md (lines 1-22), .agents/skills/changelog/SKILL.md, .agents/skills/changelog/rules/entries.md</read_first>
  <action>
PROJECT.md (D-BG-705). Insert a new decision row right after the D-BG-704 row (line 2207), in the same three-column form as its neighbours. Heading: `D-BG-705 (behavioral-gaps, the user's decision of 2026-11-09 on P7-DC-04, amends D-BG-703 and the STMIG-02 load scenario): a load that refuses a newer state.json stops offering the scope's skills and prompts`. Body, in the neighbours' bullet style and plain English, in this order:

(1) A load (a start, `/reload`, or a new session) whose `loadState` refuses a scope's `state.json` with UnsupportedStateSchemaError leaves that scope out of Pi's resource discovery. Pi offers none of its staged skills or bridged commands, and the aliases, the command tool, and the SKILL.md read fill follow Pi's command list. The staged files stay, nothing is written, and the report is D-BG-703's.

(2) Hooks, the plugin `bin/` PATH entries, and the built-in MCP registrations of such a scope were already not offered, because each reads the record at every load. A built-in MCP server registered earlier in the same runtime keeps its registration until the next load (NFR-2).

(3) The scope's pi-mcp-adapter servers, agents, and saved workflows stay served. Their companions read their own files and Pi gives no load-time way to hide them, a load changes no installation state (APL-D1), and an older release does not rewrite what a newer one wrote. This is a divergence from Claude Code, licensed by a Pi capability gap.

(4) The Claude Code 2.1.319 evidence, condensed from this plan's Upstream evidence section: a newer `installed_plugins.json` reads as an empty, unreadable list, and every plugin change is refused. A plugin whose install cannot be checked is not loaded, and a local-marketplace path plugin still loads in place. An unreadable `known_marketplaces.json` loads none of a plugin's components. This extension's `state.json` holds both registries, so it follows the second case.

(5) Scope: only the newer-schema refusal withdraws. A record that cannot be read, parsed, or validated keeps today's behavior. Upstream treats every unreadable registry the same way, so whether to widen this is an open question for the user.

Rationale cell: the user asked for it in the P7-DC-04 review, and a release that cannot read a scope's record fails closed. Point to `.planning/quick/261109-cpo-p7-dc-04-when-a-load-refuses-a-newer-state-json-schema-versi/261109-cpo-PLAN.md` for the evidence. Status cell: `✓ User decided`.

D-BG-703 row (line 2206). Append `; amended by D-BG-705, which stops offering the scope's skills and prompts` to the parenthetical of its bold heading, right after `see DUBIOUS-CHOICES.md`, and change its status cell from `-- Revisit` to `✓ Good`. Leave its measured body as the historical record.

CHANGELOG.md. Add one sub-bullet under the existing `## [Unreleased]` top bullet, among the other load and migration sub-bullets (for example after the config sub-bullet that mentions installation records), and follow the changelog skill: 40 words or fewer, plain English, no semicolon, no dash between statements, and what changed, not how. It must contain the words `newer release`. Draft: "A start or `/reload` that finds a scope's installation record written by a newer release no longer offers that scope's plugin skills and commands." Do not add a new top-level bullet or a version heading.

Run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .planning/PROJECT.md CHANGELOG.md`, restage the fixes, and commit the two files, for example `docs: record the newer-record decision and its changelog line`.
  </action>
  <verify>
    <automated>test "$(grep -c '^| \*\*D-BG-705 ' .planning/PROJECT.md)" = 1 && test "$(grep -c 'amended by D-BG-705' .planning/PROJECT.md)" -ge 1 && test "$(sed -n '/^## \[Unreleased\]/,/^## \[0\.23\.0\]/p' CHANGELOG.md | grep -c 'newer release')" = 1 && SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .planning/PROJECT.md CHANGELOG.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '^| \*\*D-BG-705 ' .planning/PROJECT.md` prints 1 (baseline at HEAD: 0).
    - `grep -c 'amended by D-BG-705' .planning/PROJECT.md` prints at least 1 (baseline at HEAD: 0).
    - The Unreleased section of CHANGELOG.md holds exactly one line with `newer release` (baseline at HEAD: 0), and it is a sub-bullet of the existing top bullet.
    - The D-BG-705 row names the three not-withdrawn kinds and their license, the 2.1.319 evidence, and the open widening question.
  </acceptance_criteria>
  <done>PROJECT.md records D-BG-705 and marks D-BG-703 amended, CHANGELOG.md has the sub-bullet, the pre-commit fixers are clean, and one commit holds the two files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| a newer release's state.json read by this release | the record holds data this release cannot validate; the load reads it read-only and refuses it |
| staged skill and prompt files handed to Pi | Pi runs the instructions it is offered; this release must not offer artifacts it cannot attribute to a recorded, enabled install |
| companion-owned files (mcp-adapter.json, agents, saved workflows) | read by pi-mcp-adapter, pi-subagents, and the workflow engine directly, outside this extension's load |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261109-cpo-01 | Elevation of privilege | `orchestrators/discover.ts` resource discovery | medium | mitigate | A scope whose record has a newer schema contributes no skill or prompt path, so Pi does not offer staged instructions this release cannot attribute to an install; pinned by the D-BG-705 cases of `test/orchestrators/discover.test.ts` and both STMIG-02 load scenarios |
| T-261109-cpo-02 | Tampering | the load path against files a newer release wrote | medium | mitigate | Discovery reads with `persistMigration: false` and writes nothing; `loadState` still throws before any migration; the amended scenario asserts the config and record bytes and the staged skill unchanged |
| T-261109-cpo-03 | Denial of service | the withdrawal predicate | low | accept | Only the typed newer-schema refusal withdraws a scope; a read or parse failure keeps today's behavior, so this adds no new way to hide a scope's skills, and the predicate's catch keeps every rejection inside discovery (NFR-2) |
| T-261109-cpo-04 | Information disclosure | the refusal message | low | accept | The message text does not change, so `shared/redact-absolute-paths.ts` keeps cutting its path in reconcile rows |
| T-261109-cpo-05 | Tampering | the refused scope's pi-mcp-adapter servers, agents, and workflows | medium | accept | They stay served because withdrawing them needs a write to files the newer release may own (APL-D1, fail closed); recorded as a licensed divergence in D-BG-705 |
| T-261109-cpo-SC | Tampering | npm installs | low | accept | The plan adds, removes, or upgrades no package |
</threat_model>

<verification>
- After Task 2, run `npm run check` once in the executor checkout on the final tree (it includes `check:static` with fallow, the unpaired and integration tests, both cucumber profiles, and direct coverage for all pairs). Record the command, exit status, commit, and Node version in the SUMMARY. The batch coordinator's post-merge gate reruns it on the combined tree.
- `git log --stat -2` shows exactly the six Task 1 files in the first commit and the two Task 2 files in the second.
</verification>

<success_criteria>
- With a newer user record, a new session offers none of the user scope's skills or prompts, reports the refusal exactly as before, and changes no file. A trusted project scope with a readable record keeps offering its skills.
- loadState's newer-schema refusal is the typed UnsupportedStateSchemaError with the unchanged message, and every reader of it behaves as before.
- D-BG-705 records the decision, the per-kind table, the evidence, and the license, and D-BG-703 is marked amended. The CHANGELOG has the sub-bullet.
- `npm run check` passes on the final tree.
</success_criteria>

<output>
Create `.planning/quick/261109-cpo-p7-dc-04-when-a-load-refuses-a-newer-state-json-schema-versi/261109-cpo-SUMMARY.md` when done. Include:
- the RED and GREEN record of Task 1 (each failing step or assertion with its actual value, then the passing runs);
- the measured results tables of the new scenario;
- the final `npm run check` record;
- `## Dubious Choices`, for the coordinator to carry to the user: (1) the withdrawal covers only the newer-schema refusal; a `state.json` that cannot be read, parsed, or validated still serves the scope's skills and prompts, while its hooks, PATH, and built-in MCP servers already stop, and Claude Code treats every unreadable registry the same way, so widening it means changing the helper's predicate to any rejection; (2) the load's report stays D-BG-703's, while Claude Code names each plugin it does not load and says to update; (3) the scope's pi-mcp-adapter servers, agents, and workflows stay served (Pi capability gap, D-BG-705); (4) observed, not changed: the agent grants step (`orchestrators/mcp/agent-grants-step.ts`) never reads `state.json`, so at `session_start` it can still rewrite the generated agent files of a scope whose record a newer release wrote; (5) no prompt-template scenario was added, because the slash-command listing step needs a profile Pi that the feature's Background does not start, so the unit cases prove the prompt half; (6) the typed error lives in `persistence/state-io.ts` beside its one thrower, not in `shared/errors.ts`;
- `## Threat Flags`, even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
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
- Widen the withdrawal: a scope whose `state.json` this release cannot read
  for ANY reason (newer schema, corrupt, unparseable, schema-invalid) stops
  offering its skills and prompts, as Claude Code does for an unreadable
  registry and per the fail-closed rule. Add a unit case and, if cheap, a
  scenario for the corrupt-file case; keep the newer-schema scenarios.
- Adapter MCP servers, agents, and saved workflows stay served (record
  D-BG-705 as a Pi-capability-gap divergence), AND add a new BACKLOG entry
  (in `## Parent lines`) for a follow-up that looks at withdrawing them.

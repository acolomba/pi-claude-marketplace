# Phase 7: State Schema Migration - Research

**Researched:** 2026-11-08
**Domain:** cucumber behavioral coverage of the project's own `state.json` migration (`persistence/migrate.ts`, `persistence/state-io.ts`)
**Confidence:** HIGH (every product and harness fact below was read this session; the newer-schema load and `disable` reports were re-measured by a scratch probe outside `features/`)

## Summary

The product already does what STMIG-01 and STMIG-02 require. `loadState` refuses any `schemaVersion` other than 1, 2, or 3 before it migrates anything. `migrateLegacyMarketplaceRecords` fills only absent fields, so it adds `resources.workflows`, `enabled: true` (0.6.0 only), and `provenance: "explicit"`. When it fills a field, `loadState` writes the record back as schema version 3, but it does not await that write. A record that already has every field causes no write, so a second load cannot change a byte. Phase 7 therefore adds scenarios only. It adds seven scenarios to `features/plugin/state-migration.feature` and one `Then` step in a new verb module, `features/step_definitions/plugin/state-migration.steps.ts`. No product change is expected. The red proofs come from temporary sabotage in the two owned product files, which is reverted before any commit.

A scratch probe re-measured the reports the new STMIG-02 scenarios must state. It ran under the adapter profile from a feature file in the session scratchpad. The literal tables are in "Code Examples". The probe confirmed CONTEXT D-BG-703 and gave the exact column sets, including two columns CONTEXT does not name: the load's `state.json` rows also carry `marketplace status` `failed` and `marketplace reasons` `unreadable`, and a `plugin-path-skipped` payload carries a `scope` column (`user`). The `disable` cascade has no tally fields. The probe also confirmed that a plugin disabled before a 0.19.2 rewrite stays disabled through the first load: the session reports no results and offers no skills.

The only timing risk is the fire-and-forget `persistMigratedState`. A scenario reads `state.json` after at least two more RPC round trips plus the rest of the `resources_discover` handler, so a late write is very unlikely, and if one happens the scenario fails red, never green. No product change is planned for it (D-BG-704).

**Primary recommendation:** Write one plan. It adds the new verb module, with one record-reading `Then`, and seven new scenarios beside the three seeds. Prove each scenario red with the named sabotage in `migrate.ts` or `state-io.ts`, revert it, and gate with `npm run check` run as its parts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Which older schemas (D-BG-701)

- **D-BG-701 — one earlier release per schema version.** Schema version 1 is proven by the record that release 0.6.0 wrote, and schema version 2 by the record that release 0.19.2 wrote: the two releases that `features/lib/earlier-version-state.ts` already reproduces for this phase (D-BG-13), each the last release of its schema version. Release 0.4.3 also wrote schema version 1, but it wrote no config files, so its first load is the MIG-01 config migration's, and Phase 8 owns it (CFGMIG-01, its seed "The first load after an upgrade from release 0.4.3 writes the config from the records"). Phase 7 adds no 0.4.3 scenario.
- Each release gets the same three behaviors, as separate scenarios, because a second load is a second `When`:
  1. The Phase 1 seed: after the rewrite, `/claude:plugin list --scope user` lists the plugin as installed (the command's own load reads the old record).
  2. The first load (`When the user starts a new pi session`): the session reports no results, Pi offers the plugin's skill (`/skill:demo-skill`), and the record on disk is the current schema: schema version 3, with every plugin's `enabled` and `provenance` (`true` and `explicit` for a 0.6.0 record).
  3. A second load: with the config and record bytes remembered after the first load, a new session reports no results and changes no byte.
- **A disabled plugin stays disabled.** One more 0.19.2 scenario: a plugin the user disabled before the rewrite keeps `enabled: false` through the first load; the session reports no results, Pi offers no skill of it, and the migrated record holds it with `enabled` `false` and `provenance` `explicit`. Schema version 2 is the first that records `enabled`, so this is the only release that can carry a disabled plugin (P1-DC-04/P1-DC-35 explain why 0.4.3 and 0.6.0 cannot).

#### What the user sees during a migration (D-BG-702)

- **D-BG-702 — nothing.** The migration is silent. Measured: a new session after a 0.6.0 or a 0.19.2 rewrite reports no results (RECON-05: a load whose config and record agree prints nothing), and Pi offers the plugin's skill as before. The migration rewrites only the extension's own `state.json`; no user-owned file changes, so no notice is due. The one migration notice the load has, AMIG-03, belongs to the legacy `mcp.json` move (Phase 9), which changes a file the user owns.

#### The newer-schema refusal (D-BG-703)

- **D-BG-703 — fail closed, per scope, as `unreadable`; installed components keep working.** Measured on a record whose `schemaVersion` is 4:
  - The load reports, once per binding (Pi's RPC `new_session` binds the extension twice, so the session holds both passes): a `reconcile-applied-cascade` with severity `error`, summary `Some operations have failed.`, tally label `Reconcile`, 2 failures and 0 warnings, whose row is the `state.json` subject `failed {unreadable}` in the user scope with the cause `state.json at state.json has an unsupported schema version`; then a `plugin-path-skipped` warning whose reason is `state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version`. Pi still offers `/skill:demo-skill`, and the config and record bytes are unchanged.
  - A command reports it: the Phase 1 seed pins `list` (the `(list)` row `failed {unreadable}`). Phase 7 adds one command that writes: `/claude:plugin disable demo@fixtures --scope user` reports a `cascade` with severity `error`, summary `A plugin operation has failed.`, and the row `demo@fixtures failed {unreadable}` with the same cause, and it changes no byte of the config or the record and unstages nothing.
  - A newer record is never migrated, rewritten, or coerced: this is the project's "fail closed on corrupt data" rule applied to data the release cannot read.
- **The other commands' reports are out of Phase 7's files.** Measured on the same record: `install` reports the plugin row `failed` with no reason, `update` reports `failed {unreadable manifest}`, and `uninstall` and `info` report an `internal-error` (`Command failed unexpectedly.`, cause `state.json at [path]`). Each refuses and changes nothing, but the reasons are not the `{unreadable}` that `list`, `disable`, `pending`, `apply`, and the load give. The fixes live in the orchestrators of those verbs, which no stream owns, so Phase 7 pins none of them and proposes a BACKLOG entry as a parent line (a dubious choice).

#### How the scenarios observe the record (D-BG-704)

- **D-BG-704 — one new read step in the verb module.** The existing `the installation record of the {word} scope holds these plugins:` reads `id`, `version`, and `enabled`, but not the schema version or `provenance`, which are what "rewritten in the current schema" means (schema version 3 is the D-04-03 shape, `provenance` required). Phase 7 adds one `Then` step to `plugin/state-migration.steps.ts` whose text names the migration, such as `the migrated installation record of the {word} scope has schema version {int} and these plugins:` with the columns `id`, `enabled`, and `provenance`. It reads the scope's `state.json`, the file the extension owns and the user can read, never a generated artifact as proof that a component works; the component proof is the skill Pi offers. The ROADMAP rule says the installation record is observed "through its existing steps", so the new step is a dubious choice.
- **The load's migration write is fire-and-forget (ST-4).** `loadState` starts `persistMigratedState` without awaiting it. The scenarios read the file after the session started, two RPC round trips later, and the exploratory runs saw the write landed every time. No product change is planned for it. If a gate run shows the record step reading the old file, the fix is a bug fix in the owned `loadState`: await the persist before the load returns, so the migration write lands inside the state lock.

### Claude's Discretion

- Step wording, scenario titles, and the order of scenarios in the feature file, within `.agents/skills/cucumber/rules/features.md` and `steps.md`.
- How the plans split across waves. The work is one feature file and one verb module, so one plan is the expected shape.
- Red proofs: each scenario must fail without the behavior it names. Because the product already behaves, the red proof is a temporary product sabotage (for example, skipping the migration persist, refusing schema version 2, or filling `enabled` over a present value), run once, recorded in the SUMMARY, and reverted before the commit.

### Deferred Ideas (OUT OF SCOPE)

- **Unreadable reasons differ across commands** (D-BG-703): `install` (no reason), `update` (`unreadable manifest`), and `uninstall` and `info` (`internal-error`, with a cause cut to `state.json at [path]`) report a newer `state.json` differently from `list`, `disable`, `pending`, `apply`, and the load. Proposed as a BACKLOG entry (parent line).
- **A schema version 1 or 2 record with no plugin records keeps its old version on disk.** `loadState` persists only when a field was filled, and a marketplace record with no plugins needs no fill, so the file keeps `schemaVersion` 1 or 2 until the next save. No user-visible effect today; it would matter only if a later release stopped reading versions 1 and 2. Proposed as a BACKLOG entry (parent line), with no scenario.
- **A plugin disabled on a pre-ENBL-02 build** loads as enabled (the documented ENBL-02 over-fill in `migrate.ts`) and self-heals through `apply`. The earlier-release writer has no such shape, so no scenario.
- **Project scope.** Both scopes go through the same `loadState`; the scenarios use the user scope, as the seeds do.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STMIG-01 | After an upgrade from an older `state.json` schema, the first load lists every recorded plugin as installed, its components work, and the state file is rewritten in the current schema. | Seeds (list after rewrite, 0.6.0 and 0.19.2). New first-load scenarios: no results, `/skill:demo-skill` offered, and the new record step reads schema 3 with `enabled` and `provenance`. New second-load scenarios: bytes unchanged. A disabled 0.19.2 plugin stays disabled. Fill and persist facts: `migrate.ts:176-215`, `state-io.ts:598-603`. |
| STMIG-02 | A `state.json` from a newer, unsupported schema is refused as unreadable, and nothing is changed. | Seed (list refuses). New load scenario: 4 payloads, 2 `state.json` rows, skill still offered, bytes unchanged. New `disable` scenario: `{unreadable}`, bytes unchanged, skill still staged. Refusal fact: `state-io.ts:531-539`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md and the brief)

- Work only in `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps-phase-7` on `features/behavioral-gaps-phase-7`. Never commit to `main`, the milestone branch, or a sibling branch. Never rebase, amend, force-push, or use `--no-verify`.
- Commit titles follow Conventional Commits (5 to 72 characters), with no phase, plan, wave, or milestone identifier. Before each commit, run `SKIP=npm-check pre-commit run --files <changed files>`, restage, and commit normally so the hook runs. Do not use `git add -A`.
- Frozen (never edit): `features/support/**`, `features/lib/**` (including `earlier-version-state.ts` and `field-rows.ts`), every existing step module (`command`, `config`, `session`, `plugin/installation`, ...), `cucumber.json`, `eslint.config.js`, `.fallowrc.json`, `scripts/check-features.mjs`, `package.json`, and `.agents/skills/cucumber/**`. A stream adds no file under `features/lib/` or `features/support/`. A small helper used by only one step module stays inside that module.
- Phase 7 owns `features/plugin/state-migration.feature` and the new `features/step_definitions/plugin/state-migration.steps.ts`. It may fix only `persistence/migrate.ts` and the load and schema-version functions of `persistence/state-io.ts`, with their unit pairs `test/persistence/{migrate,state-io}.test.ts`. The load path is shared with Phases 8, 9, and 16: change only Phase 7's own function and never reshape a shared one.
- Every seed step must stay in use, because `npm run check:features` fails on an unused step.
- Every scenario fails without the behavior it names, and the plan SUMMARY records the red proof (the failing step and the actual value).
- A scenario with no MCP surface carries no implementation tag and runs only under the adapter profile.
- Hermetic home: never write to the real `~/.pi`. The cucumber world and the npm test scripts already give each run a temporary Pi home.
- Each plan SUMMARY has `## Threat Flags`. Dubious choices are numbered `P7-DC-NN` in the phase log. Parent lines (BACKLOG and the like) go under "Parent lines" in the last SUMMARY.
- Comments and test titles cite durable IDs (STMIG-01, D-BG-704, ST-4), never phase or plan numbers. Do not comment trivial code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Refuse a newer schema | Persistence (`state-io.ts` `loadState`) | Orchestrators (read pass, `disable`) map the throw to `{unreadable}` | The version gate runs before any migration, so nothing can coerce a newer record |
| Fill the absent fields of an older record | Persistence (`migrate.ts`, pure) | — | Pure function; the caller decides whether to persist |
| Persist the migrated record | Persistence (`loadState` -> `persistMigratedState`) | Transaction (`withLockedStateTransaction` passes `persistMigration`) | Fire-and-forget, best-effort (ST-4) |
| Prove the behavior | Harness: new verb step module + feature file | Frozen shared steps (session, config, command, installation) | Observes what the user sees: results, offered skills, and the record and config bytes |

## Standard Stack

No package is installed. The phase uses only the existing harness.

| Piece | Where | Use |
|-------|-------|-----|
| `@cucumber/cucumber` (`Then`, `DataTable`) | already a dev dependency | Register the one new step |
| `node:assert/strict` | Node | Whole-value `deepStrictEqual` against `table.raw()` |
| `isPlainObject` | `features/lib/field-rows.ts:25` (frozen, read-only use) | Narrow parsed JSON |
| `ScenarioWorld.scopeRoot(scope)` | `features/support/world.ts:323` | The scope root (`sandbox.agentDir` for `user`) |

[VERIFIED: features/lib/field-rows.ts:24-27] Quoted verbatim:
```ts
/** Whether `value` is an object that is neither `null` nor an array. */
export function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```
[VERIFIED: features/support/world.ts:323-328] `scopeRoot(scope: string): string { ... case "user": return sandbox.agentDir; case "project": return path.join(sandbox.cwd, ".pi");`

## Package Legitimacy Audit

Not applicable: this phase installs no external package.

## Verified Product Facts (owned files, read-only this phase)

1. **Schema-version refusal, before migration.** [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:531-539]
   ```ts
   if (
     parsedRecord !== undefined &&
     Object.hasOwn(parsedRecord, "schemaVersion") &&
     parsedRecord.schemaVersion !== 1 &&
     parsedRecord.schemaVersion !== 2 &&
     parsedRecord.schemaVersion !== 3
   ) {
     throw new Error(`state.json at ${stateJsonPath} has an unsupported schema version`);
   }
   ```
   A record with no `schemaVersion` member is not refused here. It is normalized to 3, then validated.
2. **Accepted versions and the written version.** [VERIFIED: state-io.ts:377] `schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),`. The normalized object is always `{ schemaVersion: 3, ... }` (state-io.ts:580-587). `provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")]),` [VERIFIED: state-io.ts:196]. `installedAt: Type.String(), updatedAt: Type.String(),` [VERIFIED: state-io.ts:197-198].
3. **Fills only absent fields.** [VERIFIED: migrate.ts:176-188] `ensurePluginEnabled`: `if (pl.enabled !== undefined) { return false; } pl.enabled = true; return true;`. [VERIFIED: migrate.ts:203-215] `ensurePluginProvenance`: `if (pl.provenance !== undefined) { return false; } pl.provenance = "explicit"; return true;`. [VERIFIED: migrate.ts:154-159] the resources fill loops over `["agents", "mcpServers", "hooks", "workflows"] as const`.
4. **The fire-and-forget persist.** [VERIFIED: state-io.ts:598-603]
   ```ts
   // ST-4 best-effort async save -- fire-and-forget; the IL-3 sanctioned warn
   // in persistMigratedState handles failure. Preview explicitly suppresses it.
   if (mutated && options.persistMigration !== false) {
     void persistMigratedState(stateJsonPath, state);
   }
   ```
   `persistMigratedState` (migrate.ts:307-319) calls `atomicWriteJson`. That function writes `JSON.stringify(value, null, 2) + "\n"` [VERIFIED: shared/atomic-json.ts:29], so the write is deterministic and repeating it yields the same bytes.
5. **What each release's record lacks** (frozen writer, [VERIFIED: features/lib/earlier-version-state.ts:162-224]). In 0.6.0, the plugin's required members are `"version", "resolvedSource", "compatibility", "resources", "installedAt", "updatedAt"`, with no `enabled` or `provenance`, and its resources are `"skills", "prompts", "agents", "mcpServers"` plus `"hooks"`, with no `workflows`. In 0.19.2, the plugin also has `"enabled"`, with no `provenance`, and the same resources. So both first loads fill a field and persist. The second load fills nothing, which gives `mutated === false` and no write.
6. **Who loads with persistence on.** The load's read pass uses `withLockedStateTransaction` with `persistMigration: deps?.persistMigration ?? true` (transaction/with-state-guard.ts:97). Unlocked readers on the load path also persist (for example `orchestrators/plugin-path.ts:102`, `loadState(extensionRoot)`). Several migrations of the same old file may therefore run in parallel. They write identical bytes, so this is harmless here.

## Verified Harness Facts (frozen, use only)

- Rewrite Givens [VERIFIED: features/step_definitions/plugin/installation.steps.ts:351-384]: `the installation record of the {word} scope is rewritten as release {string} wrote it` (accepts only `"0.6.0"` -> 1 and `"0.19.2"` -> 2, from the private map at :128-131) and `the installation record of the {word} scope is rewritten with a schema version this release does not read` (writes `STATE_SCHEMA_VERSION + 1` = 4, earlier-version-state.ts:26 and :377-382).
- `the {word} scope stages these skills and prompts:` (installation.steps.ts:403-414) has the header `| kind | name |`.
- Session steps [VERIFIED: features/step_definitions/session.steps.ts:73-83, 174-212]: `Given the user has started a new pi session` (asserts every payload is info), `When the user starts a new pi session`, `Then the session reports no results`, `Then the session offers these skills:` (`| command | description |`), `Then the session offers no skills`, and `Then the session reports these results:`. The last one calls `markNoticesCompared()` and `markResultsCompared()`.
- Bytes steps [VERIFIED: features/step_definitions/config.steps.ts:55-61, 171-174, 241-246]: they remember and compare the bytes of `<scopeRoot>/claude-plugins.json` and `<scopeRoot>/pi-claude-marketplace/state.json`.
- Row and field steps (command.steps.ts): `the result has these fields:` (:158), `the result lists these plugins:` (:166), and `the results list these marketplaces and plugins:` (:238), which reads every result of the last `When`, session results included.
- Compared markers [VERIFIED: features/support/world.ts:384-412]: the next `recordResults` asserts that `uncomparedRows`, `uncomparedNotices`, and `uncomparedSessionResults` are empty. A session that emits payloads therefore needs `the session reports these results:`, and payloads that carry `marketplaces` rows also need a row step. The new record step reads only a file, so it calls no marker.
- `features/lib/result-rows.ts:158-181`: a `plugin-path-skipped` payload has no row array, so the row step skips it. `recordTable` (field-rows.ts:93-99) orders the columns as the table states them and leaves a cell empty where a record lacks that field.

## Architecture Patterns

### Data flow under test

```
Given rewrite (old/newer state.json) ──> When new_session (RPC) ──> resources_discover x2 bindings
     │                                         │
     │                       read pass: withLockedStateTransaction -> loadState
     │                         ├─ schemaVersion ∉ {1,2,3} -> throw -> {unreadable} rows + plugin-path-skipped
     │                         └─ migrate (fill absent) -> mutated? -> void persistMigratedState (schema 3)
     │                                         │
     └──> Then: session results (payloads) · offered skills (get_commands) · state.json / config bytes
```

### Step module shape (new file `features/step_definitions/plugin/state-migration.steps.ts`)

- It starts with `@fileoverview`, exports nothing (lint rejects any export in a step module, eslint.config.js:426-430), and registers `Given`, then `When`, then `Then`. Only a `Then` is needed.
- The step reads `this.scopeRoot(...)`, so it is an anonymous `function (this: ScenarioWorld, ...)`. A step that does not use `this` must be an arrow (`prefer-arrow-callback`).
- The step text is a string-literal Cucumber expression (`{word}`, `{int}`). Never use a regular expression or a variable.
- Import order (`import-x/order`, alphabetized, a blank line between groups): `node:assert/strict`, `node:fs/promises`, `node:path`, then `@cucumber/cucumber`, then `../../lib/field-rows.ts`, then `import type { ScenarioWorld } from "../../support/world.ts";` last.
- The step text names its verb, the migration (layout.md D-08), so no other verb module can collide with it.
- It compares whole values with `deepStrictEqual`, the projected rows with the header against `table.raw()`. The schema version goes inside the same compared object.
- No test pair is needed. `scripts/check-corresponding-tests.mjs` pairs only `extensions/pi-claude-marketplace/**` with `test/**` (lines 7-36), so `features/**` is outside the pairing rule. [VERIFIED: scripts/check-corresponding-tests.mjs:7-10, 29-36]
- The tool scope covers `features/**/*.ts`: tsconfig `include` lists `"features/**/*.ts"` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). ESLint runs on `features`, and so does Prettier (`format:check` globs `{extensions,features,rule-packs,test}/**/*.{js,json,ts}`). Fallow `boundaries` allow `features/**` unmatched, production dead-code ignores it, and the cycle and dupes runs see it.

### Recommended scenario set (the planner names titles; wording is discretionary)

| # | Scenario (behavior) | Steps after Background |
|---|---------------------|------------------------|
| S1 | Seed: list after 0.6.0 rewrite (keep as is) | — |
| S2 | Seed: list after 0.19.2 rewrite (keep as is) | — |
| S3 | First load after 0.6.0 rewrites the record in the current schema | Given rewrite "0.6.0"; When the user starts a new pi session; Then the session reports no results; Then the session offers these skills: `/skill:demo-skill` / `A skill of demo 1.0.0.`; Then (new) schema version 3 and `demo@fixtures | true | explicit` |
| S4 | Same for 0.19.2 | as S3 with "0.19.2" |
| S5 | Second load after 0.6.0 changes nothing | Given rewrite "0.6.0"; Given the user has started a new pi session; Given the config and installation record bytes of the user scope are remembered; When the user starts a new pi session; Then the session reports no results; Then the session offers these skills: (demo-skill); Then the config and installation record bytes of the user scope are unchanged |
| S6 | Same for 0.19.2 | as S5 with "0.19.2" |
| S7 | A plugin disabled before an upgrade from 0.19.2 stays disabled | Given the user has run "/claude:plugin disable demo@fixtures --scope user"; Given rewrite "0.19.2"; When new session; Then the session reports no results; Then the session offers no skills; Then (new) schema version 3 and `demo@fixtures | false | explicit` |
| S8 | Seed: newer record refused by list (keep as is) | — |
| S9 | The load refuses a newer record and leaves it as it was | Given newer rewrite; Given bytes remembered; When new session; Then the session reports these results: (4 rows); Then the results list these marketplaces and plugins: (2 rows); Then the session offers these skills: (demo-skill); Then bytes unchanged |
| S10 | Disabling a plugin refuses a newer record and changes nothing | Given newer rewrite; Given bytes remembered; When the user runs "/claude:plugin disable demo@fixtures --scope user"; Then the result has these fields:; Then the result lists these plugins:; Then bytes unchanged; Then the user scope stages these skills and prompts: `skill | demo-skill` |

Two releases are only two variants, so S3/S4 and S5/S6 stay separate scenarios: an Outline needs three or more (features.md). Every `Given` comes before the first `When`, which `check:features` enforces (`stepOrderFindings`). That is why S5 and S6 run the first load as `Given the user has started a new pi session`. Every step is lower case outside quotes and none says "should". No step names `mcp`, so no scenario carries an implementation tag.

### Anti-Patterns to Avoid

- **Retrying or polling inside the record step to wait out the persist.** It would hide the ST-4 race that D-BG-704 says to fix in `loadState`. Read once.
- **A sample table.** State all four session payloads and both `state.json` rows. A missing row leaves rows uncompared, and the world fails the scenario at teardown or at the next `recordResults`.
- **An `?? ""` default on table cells or record values.** Fail with `assert.fail(... content)` on a missing or mistyped member, as `installation.steps.ts:80-90` does.
- **Rendering `enabled` through `String(unknown)`.** That can hide a string `"true"`. Narrow with `typeof record.enabled === "boolean"` and `typeof record.provenance === "string"` first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Old-release record shapes | a new fixture writer | `rewriteStateAsRelease` through the frozen Given | Derived from each release's schema at its tag (D-BG-13) |
| Newer record | editing JSON in the step | the frozen "schema version this release does not read" Given | One source for version 4 |
| Byte stability | hashing in the new module | the frozen config bytes steps | Already cover the config and `state.json` |
| Component works | reading staged files | `the session offers these skills:` | The user-visible proof (D-BG-704) |

## Common Pitfalls

### Pitfall 1: fallow dupes on the new JSON walk
**What goes wrong:** `npm run fallow` fails because the new module copies the `marketplaces` and `plugins` walk of `installation.steps.ts:106-125` (the `isPlainObject`/`assert.fail` ladder).
**How to avoid:** Keep the walk short and shaped differently, for example a flat `flatMap` with one helper per plugin record. Run `npx fallow dupes --fail-on-issues --format human` after writing the module, and check `$?` (a red glyph can appear on a passing run).
**Warning signs:** A clone group that names `features/step_definitions/plugin/installation.steps.ts`.

### Pitfall 2: The fire-and-forget persist races a read
**What goes wrong:** S3, S4, or S7 reads `schemaVersion` 1 or 2, or S5 or S6 remembers the pre-migration bytes. In S5/S6 the write then lands after the remember step, so the unchanged check fails.
**Why it happens:** `void persistMigratedState(...)` (state-io.ts:602). Between the start of the write and the read come the rest of both `resources_discover` handlers, the `new_session` response, `get_commands`, and the session-entries read (pi-commands.ts:164-193).
**Risk:** low. The write is one small `write-file-atomic` with fsync, and CONTEXT's exploratory runs never saw it late. A late write makes a scenario fail (a flaky red), never pass wrongly.
**If a gate shows it:** apply the D-BG-704 fix inside the owned `loadState`: await the persist before returning (it never throws, migrate.ts:311-318). Update `test/persistence/state-io.test.ts` so `state-io.ts` keeps 100% direct coverage, and log a P7-DC entry.
**Related latent risk (out of scope, note only):** a command's locked transaction loads an old record and starts the persist, then mutates and calls `saveState`. If the persist landed after the save, the mutation would be lost. The same await fix closes this. No Phase 7 scenario runs a command on a record that has not been migrated yet.

### Pitfall 3: The seeds' steps must stay in use
Keep S1, S2, and S8 (or rewrite them while still using both rewrite Givens). `check:features` fails on an unused step, and the steps live in a frozen module.

### Pitfall 4: Sabotage left in the tree
Run every red proof on an uncommitted edit of `migrate.ts` or `state-io.ts`, then `git checkout -- <file>` and confirm with `git diff --quiet -- extensions`. Never stage a sabotaged file, because the pre-commit hook would run its pair.

### Pitfall 5: The summary format hides the assertion diff
The cucumber `summary` format prints little. For a failure, rerun with `--format progress` (or `--name '<title>'`) to see the assertion diff. Rerun a failing scenario once before calling it red, and record both runs.

## Code Examples

### The new record step (sketch; the executor validates with typecheck, lint, and prettier)

```ts
/**
 * @fileoverview Steps about the state migration: the installation record that
 * the first load after an upgrade rewrites in the current schema (STMIG-01).
 *
 * The step reads the scope's `state.json` once and states its schema version
 * and, for each plugin, the enabled state and provenance the migration keeps
 * or fills. A missing file or member fails the step.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";

import type { ScenarioWorld } from "../../support/world.ts";

type MigratedRow = readonly [id: string, enabled: string, provenance: string];

// The row of the plugin record `record` of `id`; `content` is the file's text.
function migratedRow(id: string, record: unknown, content: string): MigratedRow {
  if (
    !isPlainObject(record) ||
    !("enabled" in record) ||
    typeof record.enabled !== "boolean" ||
    !("provenance" in record) ||
    typeof record.provenance !== "string"
  ) {
    assert.fail(`the plugin ${id} has no boolean enabled and string provenance: ${content}`);
  }

  return [id, String(record.enabled), record.provenance];
}

Then(
  "the migrated installation record of the {word} scope has schema version {int} and these plugins:",
  async function (this: ScenarioWorld, scope: string, schemaVersion: number, table: DataTable) {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    const content = await readFile(file, "utf8");
    const state: unknown = JSON.parse(content);
    if (!isPlainObject(state) || !("marketplaces" in state) || !isPlainObject(state.marketplaces)) {
      assert.fail(`${file} has no marketplaces object: ${content}`);
    }

    const rows = Object.entries(state.marketplaces)
      .flatMap(([marketplace, entry]) => {
        const plugins = isPlainObject(entry) && "plugins" in entry ? entry.plugins : undefined;
        if (!isPlainObject(plugins)) {
          assert.fail(`the marketplace ${marketplace} has no plugins object: ${content}`);
        }

        return Object.entries(plugins).map(([plugin, record]) =>
          migratedRow(`${plugin}@${marketplace}`, record, content),
        );
      })
      .sort((left, right) => left[0].localeCompare(right[0]));
    assert.deepStrictEqual(
      {
        schemaVersion: Reflect.get(state, "schemaVersion"),
        plugins: [["id", "enabled", "provenance"], ...rows.map((row) => [...row])],
      },
      { schemaVersion, plugins: table.raw() },
    );
  },
);
```
`isPlainObject`, `scopeRoot`, and the `pi-claude-marketplace/state.json` path come from the verified quotes above (world.ts:323-328, field-rows.ts:25, earlier-version-state.ts:29-31). The exact step text, the tuple type, and the error messages are [ASSUMED] and left to the executor.

### Measured literal tables for the new STMIG-02 scenarios (scratch probe, adapter profile, this session)

Load of a version 4 record (`the session reports these results:`), in session order:
```gherkin
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                      | tally label | tally failures | tally warnings | scope | reason                                                                                      |
      | reconcile-applied-cascade | error    | false        | Some operations have failed. | Reconcile   | 2              | 0              |       |                                                                                             |
      | plugin-path-skipped       | warning  | false        |                              |             |                |                | user  | state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version |
      | reconcile-applied-cascade | error    | false        | Some operations have failed. | Reconcile   | 2              | 0              |       |                                                                                             |
      | plugin-path-skipped       | warning  | false        |                              |             |                |                | user  | state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id                    | name       | status | reasons    | scope | cause chain                                                 | cause truncated | leaks | rollback partial |
      | state.json       | user              | failed             | unreadable          | state.json@state.json | state.json | failed | unreadable | user  | state.json at state.json has an unsupported schema version | false           |       |                  |
      | state.json       | user              | failed             | unreadable          | state.json@state.json | state.json | failed | unreadable | user  | state.json at state.json has an unsupported schema version | false           |       |                  |
```
`disable` on a version 4 record:
```gherkin
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope | cause chain                                                 | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | unreadable | user  | state.json at state.json has an unsupported schema version | false           |       |                  |
```
The probe printed the actual values, which the tables above reproduce, so they are [VERIFIED: scratch probe run]. The column order is a free choice, because `recordTable` follows the stated order. Pad and align the cells (features.md). The disable cascade has no tally fields. The probe also measured the disabled 0.19.2 first load: `the session reports no results` passed, and the session offered no skills.

## Red Proofs (temporary sabotage in owned files; revert after each)

Line numbers are those at head `7e961d04`. The step that fails first is what the planner should expect. The executor records the actual failing step and value.

| Scenario | Sabotage | Expected first failing step |
|----------|----------|-----------------------------|
| S1 seed 0.6.0 list | state-io.ts:534 drop `parsedRecord.schemaVersion !== 1 &&` (refuse v1) | `the result has these fields:` (severity `error`, not `info`) |
| S2 seed 0.19.2 list | state-io.ts:535 drop `parsedRecord.schemaVersion !== 2 &&` (refuse v2) | same |
| S3 first load 0.6.0 | (a) state-io.ts:601-603 remove `void persistMigratedState(stateJsonPath, state);` | new record step: actual `schemaVersion` 1 |
| | (b) migrate.ts:212 fill `"dependency"` instead of `"explicit"` | new record step `provenance` column, or an earlier `Then` if the load reports something for a dependency record; record which |
| | (c) refuse v1 (as S1) | `the session reports no results` |
| S4 first load 0.19.2 | (a) as S3a | new record step: actual `schemaVersion` 2 |
| | (c) refuse v2 (as S2) | `the session reports no results` |
| S5/S6 second load | migrate.ts, inside `ensurePluginEnabled`'s fill callback: stamp `pl.updatedAt = new Date().toISOString();` and `return true;` on every record (a non-idempotent migration that touches records on each load) | `the config and installation record bytes of the user scope are unchanged` |
| S7 disabled stays disabled | migrate.ts:181-183 remove the `if (pl.enabled !== undefined) { return false; }` guard (fill `enabled: true` over a present `false`) | the first `Then` that sees it: likely `the session reports no results` (the config still says disabled, so the load reports a pending disable), otherwise the record step `enabled` column; record which |
| S8 seed newer list | state-io.ts:531-539 also accept `4` (add `&& parsedRecord.schemaVersion !== 4`) | `the result has these fields:` |
| S9 load refuses newer | (a) accept v4 (as S8) | `the session reports these results:` (actual: none) |
| | (b) in the refusal branch, `await persistMigratedState(stateJsonPath, { ...parsedRecord, schemaVersion: 3 });` before the `throw` | `the config and installation record bytes of the user scope are unchanged` |
| S10 disable refuses newer | (a) accept v4 | `the result has these fields:` (severity `info`) |
| | (b) as S9b | bytes unchanged step |

Notes: S3a does not make S5 or S6 fail, because a load that never migrates also changes no bytes. S3 and S4 carry the proof of the rewrite, and S5 and S6 carry only "a second load changes nothing". If S9 and S10 each get the (b) proof, the "nothing is changed" half of STMIG-02 is proven on its own, apart from the report.

## Runtime State Inventory

Not a rename or refactor phase. Omitted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v26.13.0 (CI runs 24) | — |
| `node_modules` with init done | cucumber, lint | yes (`node_modules/.init-done`) | — | — |
| Optional peer cache | cucumber Pi | yes (`node_modules/.cache/optional-peers`) | — | `node scripts/install-test-peers.mjs` |
| Pi | cucumber | yes | 1.5.0 (brief) | — |

The scratch probe ran 5 scenarios in about 7.7 s with `--parallel 2`. The real `~/.pi` did not change during the run: checked with `find ~/.pi -newer <marker>`, which printed nothing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (profiles in `cucumber.json`), plus the static gates |
| Config file | `cucumber.json` (frozen); the adapter profile tag expression is `not @builtin-only` |
| Quick run command | `npx cucumber-js --profile adapter --parallel 2 features/plugin/state-migration.feature` |
| One scenario | `npx cucumber-js --profile adapter --name '<scenario title>'` |
| Equivalent with the peer install | `npm run test:cucumber:profile -- --profile adapter features/plugin/state-migration.feature` |
| Full suite command | `npm run check` (run as its parts, below) |

These scenarios carry no tag, so they run under adapter only. Under builtin, `npx cucumber-js --profile builtin --dry-run features/plugin/state-migration.feature` should select 0 scenarios.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STMIG-01 | list after rewrite (0.6.0, 0.19.2) | behavioral | quick run command | yes (seeds) |
| STMIG-01 | first load: silent, skill offered, record v3 with enabled/provenance | behavioral | quick run command | no: add S3, S4 and the new step |
| STMIG-01 | second load changes no byte | behavioral | quick run command | no: add S5, S6 |
| STMIG-01 | a disabled plugin stays disabled | behavioral | quick run command | no: add S7 |
| STMIG-02 | list refuses `{unreadable}`, bytes unchanged | behavioral | quick run command | yes (seed) |
| STMIG-02 | load refuses: full report, skill offered, bytes unchanged | behavioral | quick run command | no: add S9 |
| STMIG-02 | disable refuses `{unreadable}`, changes nothing, unstages nothing | behavioral | quick run command | no: add S10 |

### Focused checks while editing
- `npm run check:features`: unused, undefined, and ambiguous steps, plus the wording, order, and tag rules
- `npm run typecheck`
- `npx eslint features/step_definitions/plugin/state-migration.steps.ts --max-warnings 0`
- `npx prettier --check features/step_definitions/plugin/state-migration.steps.ts`
- `npx fallow dupes --fail-on-issues --format human` and then `npm run fallow`, checking the exit status
- `npm run check:static` covers all of the above in parallel

### Sampling Rate
- **Per task commit:** the quick run command, `npm run check:features`, and the commit hook (`check:commit` runs `check:static`, `test:unpaired`, and the staged pairs). A passing hook is not a gate.
- **Per wave merge and the phase gate:** `npm run check` on the combined tree. Run each part in the background with its exit status written to a file, and never pipe a part into `tail`, `head`, or `grep`. Run them in this order: `npm run check:static`, `npm run test:unpaired`, `npm run test:integration`, then the three CI behavioral legs, then `npm run test:coverage:direct:all`. The legs are `npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin`, then `... --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`, then `... --profile builtin features`. Example: `npm run check:static > /var/tmp/p7-static.log 2>&1; echo $? > /var/tmp/p7-static.exit`.
- **Phase gate only:** also `npm run test:modules`.
- Rerun a failing cucumber or integration case once before calling a gate red, and record both runs.

### Wave 0 Gaps
- None. The harness covers everything. The only new file is the verb step module, which needs no unit pair.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes, product (unchanged) | `loadState` refuses unknown schema versions and validates with TypeBox `STATE_VALIDATOR` (fail closed) |
| V2/V3/V4/V6 | no | — |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| A newer or foreign record is coerced into the current schema and overwrites the user's data | Tampering | Refusal before migration (state-io.ts:531-539), proven by S9b and S10b |
| A test writes to the real `~/.pi` | Tampering | World sandbox `agentDir`; check with `find ~/.pi -newer <marker>` |

Threat Flags for the SUMMARY: None. The phase adds test code only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact step text, tuple type, and messages of the sketch pass lint and typecheck as written | Code Examples | Low: the executor adjusts the form |
| A2 | Sabotage S3b ("dependency") and S7 (over-fill) fail at the step named | Red Proofs | Low: the scenario still goes red at some step; record the actual one |
| A3 | Sabotage S5/S6 (a timestamp on every load) leaves the first-load `Given` passing | Red Proofs | Low: if the first load reports a payload, the Given fails instead; pick another non-idempotent fill |
| A4 | A Pi that refuses the record still offers `/skill:demo-skill` (S9) | Scenario set | Low: measured by CONTEXT, not re-probed here |

## Open Questions

1. Should S5 and S6 also state the migrated record (schema 3)? Recommendation: no. One behavior per scenario, and S3 and S4 already prove the rewrite. The planner may add it if a reviewer wants S5 and S6 to prove "the second load keeps the migrated record".

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/persistence/{state-io,migrate}.ts`, `shared/atomic-json.ts`, `transaction/with-state-guard.ts` (read this session)
- `features/lib/{earlier-version-state,field-rows,result-rows,installation-record}.ts`, `features/step_definitions/{session,config,command}.steps.ts`, `features/step_definitions/plugin/installation.steps.ts`, `features/support/world.ts`, and `features/lib/pi-commands.ts` (read this session)
- `scripts/check-corresponding-tests.mjs`, `scripts/check-features.mjs`, `eslint.config.js` (features blocks), `.fallowrc.json`, `tsconfig.json`, `package.json`, and `cucumber.json`
- `.agents/skills/cucumber/{SKILL.md,rules/steps.md,rules/features.md,rules/layout.md}` and `.agents/skills/local-verification/**`
- A scratch probe: 5 deliberately failing scenarios under the adapter profile, from a feature file in the session scratchpad (not in the repo)

## Metadata

**Confidence breakdown:**
- Product facts: HIGH. Read verbatim this session.
- Report tables: HIGH. Measured this session.
- Step sketch and red-proof first-failing steps: MEDIUM. Not executed; the executor confirms them.

**Research date:** 2026-11-08
**Valid until:** the next merge that touches `persistence/state-io.ts`, `migrate.ts`, or the frozen harness (otherwise 30 days)

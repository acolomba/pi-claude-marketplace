# Phase 7: State Schema Migration - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session (`gsd-autonomous --only 7`). The user's standing instruction is the recommended answer on every question, so each decision below is the recommendation, auto-accepted. Each decision cites what was measured: before writing it, the session ran exploratory scenarios against the Phase 1 head (`7e961d04`) in a scratch feature file outside `features/`, and the observed outputs are quoted below.

<domain>
## Phase Boundary

Phase 7 adds the cucumber coverage of STMIG-01 and STMIG-02 to `features/plugin/state-migration.feature`, which Phase 1 seeded, with its own verb step module `features/step_definitions/plugin/state-migration.steps.ts`. It proves that a user who upgrades keeps every installed plugin: the first load reads a `state.json` that an earlier release wrote, rewrites it in the current schema (version 3), and the plugin keeps working, while a second load changes nothing. It also proves that a `state.json` from a newer release is refused as unreadable by the load and by a command, and that the file, the config, and the installed components stay as they were.

The product it may fix is `persistence/migrate.ts` and the load and schema-version functions of `persistence/state-io.ts`. The exploratory runs found no bug in those files, so the phase is expected to add coverage only. A product change is made only when a scenario exposes a bug in those files.

</domain>

<decisions>
## Implementation Decisions

### Which older schemas (D-BG-701)

- **D-BG-701 — one earlier release per schema version.** Schema version 1 is proven by the record that release 0.6.0 wrote, and schema version 2 by the record that release 0.19.2 wrote: the two releases that `features/lib/earlier-version-state.ts` already reproduces for this phase (D-BG-13), each the last release of its schema version. Release 0.4.3 also wrote schema version 1, but it wrote no config files, so its first load is the MIG-01 config migration's, and Phase 8 owns it (CFGMIG-01, its seed "The first load after an upgrade from release 0.4.3 writes the config from the records"). Phase 7 adds no 0.4.3 scenario.
- Each release gets the same three behaviors, as separate scenarios, because a second load is a second `When`:
  1. The Phase 1 seed: after the rewrite, `/claude:plugin list --scope user` lists the plugin as installed (the command's own load reads the old record).
  2. The first load (`When the user starts a new pi session`): the session reports no results, Pi offers the plugin's skill (`/skill:demo-skill`), and the record on disk is the current schema: schema version 3, with every plugin's `enabled` and `provenance` (`true` and `explicit` for a 0.6.0 record).
  3. A second load: with the config and record bytes remembered after the first load, a new session reports no results and changes no byte.
- **A disabled plugin stays disabled.** One more 0.19.2 scenario: a plugin the user disabled before the rewrite keeps `enabled: false` through the first load; the session reports no results, Pi offers no skill of it, and the migrated record holds it with `enabled` `false` and `provenance` `explicit`. Schema version 2 is the first that records `enabled`, so this is the only release that can carry a disabled plugin (P1-DC-04/P1-DC-35 explain why 0.4.3 and 0.6.0 cannot).

### What the user sees during a migration (D-BG-702)

- **D-BG-702 — nothing.** The migration is silent. Measured: a new session after a 0.6.0 or a 0.19.2 rewrite reports no results (RECON-05: a load whose config and record agree prints nothing), and Pi offers the plugin's skill as before. The migration rewrites only the extension's own `state.json`; no user-owned file changes, so no notice is due. The one migration notice the load has, AMIG-03, belongs to the legacy `mcp.json` move (Phase 9), which changes a file the user owns.

### The newer-schema refusal (D-BG-703)

- **D-BG-703 — fail closed, per scope, as `unreadable`; installed components keep working.** Measured on a record whose `schemaVersion` is 4:
  - The load reports, once per binding (Pi's RPC `new_session` binds the extension twice, so the session holds both passes): a `reconcile-applied-cascade` with severity `error`, summary `Some operations have failed.`, tally label `Reconcile`, 2 failures and 0 warnings, whose row is the `state.json` subject `failed {unreadable}` in the user scope with the cause `state.json at state.json has an unsupported schema version`; then a `plugin-path-skipped` warning whose reason is `state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version`. Pi still offers `/skill:demo-skill`, and the config and record bytes are unchanged.
  - A command reports it: the Phase 1 seed pins `list` (the `(list)` row `failed {unreadable}`). Phase 7 adds one command that writes: `/claude:plugin disable demo@fixtures --scope user` reports a `cascade` with severity `error`, summary `A plugin operation has failed.`, and the row `demo@fixtures failed {unreadable}` with the same cause, and it changes no byte of the config or the record and unstages nothing.
  - A newer record is never migrated, rewritten, or coerced: this is the project's "fail closed on corrupt data" rule applied to data the release cannot read.
- **The other commands' reports are out of Phase 7's files.** Measured on the same record: `install` reports the plugin row `failed` with no reason, `update` reports `failed {unreadable manifest}`, and `uninstall` and `info` report an `internal-error` (`Command failed unexpectedly.`, cause `state.json at [path]`). Each refuses and changes nothing, but the reasons are not the `{unreadable}` that `list`, `disable`, `pending`, `apply`, and the load give. The fixes live in the orchestrators of those verbs, which no stream owns, so Phase 7 pins none of them and proposes a BACKLOG entry as a parent line (a dubious choice).

### How the scenarios observe the record (D-BG-704)

- **D-BG-704 — one new read step in the verb module.** The existing `the installation record of the {word} scope holds these plugins:` reads `id`, `version`, and `enabled`, but not the schema version or `provenance`, which are what "rewritten in the current schema" means (schema version 3 is the D-04-03 shape, `provenance` required). Phase 7 adds one `Then` step to `plugin/state-migration.steps.ts` whose text names the migration, such as `the migrated installation record of the {word} scope has schema version {int} and these plugins:` with the columns `id`, `enabled`, and `provenance`. It reads the scope's `state.json`, the file the extension owns and the user can read, never a generated artifact as proof that a component works; the component proof is the skill Pi offers. The ROADMAP rule says the installation record is observed "through its existing steps", so the new step is a dubious choice.
- **The load's migration write is fire-and-forget (ST-4).** `loadState` starts `persistMigratedState` without awaiting it. The scenarios read the file after the session started, two RPC round trips later, and the exploratory runs saw the write landed every time. No product change is planned for it. If a gate run shows the record step reading the old file, the fix is a bug fix in the owned `loadState`: await the persist before the load returns, so the migration write lands inside the state lock.

### Claude's Discretion

- Step wording, scenario titles, and the order of scenarios in the feature file, within `.agents/skills/cucumber/rules/features.md` and `steps.md`.
- How the plans split across waves. The work is one feature file and one verb module, so one plan is the expected shape.
- Red proofs: each scenario must fail without the behavior it names. Because the product already behaves, the red proof is a temporary product sabotage (for example, skipping the migration persist, refusing schema version 2, or filling `enabled` over a present value), run once, recorded in the SUMMARY, and reverted before the commit.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/lib/earlier-version-state.ts` (frozen): `rewriteStateAsRelease()` for releases 0.4.3, 0.6.0, and 0.19.2, and `rewriteStateWithNewerSchema()`, which writes schema version 4. Its constant `STATE_SCHEMA_VERSION = 3` matches the product's current version.
- `features/step_definitions/plugin/installation.steps.ts` (frozen): the rewrite Givens (`the installation record of the {word} scope is rewritten as release {string} wrote it`, `... rewritten with a schema version this release does not read`), `the installation record of the {word} scope holds these plugins:`, and `the {word} scope stages these skills and prompts:`. Its private `RELEASE_SCHEMA_VERSIONS` map knows 0.6.0 and 0.19.2 only.
- `features/step_definitions/session.steps.ts` (frozen): `the user starts a new pi session` (a load: `new_session` runs `resources_discover`), `the user has started a new pi session` (requires info payloads only), `the session reports no results`, `the session reports these results:`, `the session offers these skills:`, `the session offers no skills`.
- `features/step_definitions/config.steps.ts` (frozen): `the config and installation record bytes of the {word} scope are remembered` and `... are unchanged`.
- `features/step_definitions/command.steps.ts` (frozen): `the user runs {string}`, `the result has these fields:`, `the result lists these plugins:`, `the results list these marketplaces and plugins:`.
- `features/lib/field-rows.ts` (frozen): `isPlainObject` for reading JSON in a step.

### Established Patterns

- `loadState` (`persistence/state-io.ts`) refuses any `schemaVersion` other than 1, 2, or 3 with `state.json at <path> has an unsupported schema version`, before any migration. `migrateLegacyMarketplaceRecords` (`persistence/migrate.ts`) fills only absent fields (`manifestPath`, `marketplaceRoot`, `resources.*`, `enabled: true`, `provenance: "explicit"`), and `loadState` persists the normalized state with `schemaVersion: 3` when a fill happened.
- The load's read pass (`orchestrators/reconcile/read-pass.ts`) loads state inside `withLockedStateTransaction` with the default `persistMigration: true`, so the first load writes the migrated record; the read pass itself never saves (WR-05).
- A scenario states every payload and row it receives; the world fails a scenario whose results go uncompared.
- Red proofs in Phase 1 SUMMARYs name the step that failed and the actual value.

### Integration Points

- New file: `features/step_definitions/plugin/state-migration.steps.ts` (reserved for Phase 7).
- Changed file: `features/plugin/state-migration.feature` (owned by Phase 7 since the Phase 1 merge). The seed steps stay in use.
- Product files Phase 7 may fix: `extensions/pi-claude-marketplace/persistence/migrate.ts` and the load and schema-version functions of `persistence/state-io.ts`, with their unit pairs `test/persistence/migrate.test.ts` and `test/persistence/state-io.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- The Background of the feature stays as Phase 1 wrote it: the dir marketplace `fixtures` offering `demo` 1.0.0, added to the user scope, and `demo@fixtures` installed into the user scope. `demo` ships the skill `/skill:demo-skill` with the description `A skill of demo 1.0.0.`.
- Expected values are whole literals, as measured above. The load's newer-schema report is stated in full: both payloads of both bindings, and both `state.json` rows.

</specifics>

<deferred>
## Deferred Ideas

- **Unreadable reasons differ across commands** (D-BG-703): `install` (no reason), `update` (`unreadable manifest`), and `uninstall` and `info` (`internal-error`, with a cause cut to `state.json at [path]`) report a newer `state.json` differently from `list`, `disable`, `pending`, `apply`, and the load. Proposed as a BACKLOG entry (parent line).
- **A schema version 1 or 2 record with no plugin records keeps its old version on disk.** `loadState` persists only when a field was filled, and a marketplace record with no plugins needs no fill, so the file keeps `schemaVersion` 1 or 2 until the next save. No user-visible effect today; it would matter only if a later release stopped reading versions 1 and 2. Proposed as a BACKLOG entry (parent line), with no scenario.
- **A plugin disabled on a pre-ENBL-02 build** loads as enabled (the documented ENBL-02 over-fill in `migrate.ts`) and self-heals through `apply`. The earlier-release writer has no such shape, so no scenario.
- **Project scope.** Both scopes go through the same `loadState`; the scenarios use the user scope, as the seeds do.

</deferred>

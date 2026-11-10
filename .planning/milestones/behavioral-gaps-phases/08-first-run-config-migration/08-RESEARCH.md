# Phase 8: First-Run Config Migration - Research

**Researched:** 2026-11-08
**Domain:** MIG-01 first-run config migration (`persistence/migrate-config.ts`), its load-path caller, and cucumber coverage of CFGMIG-01/02
**Confidence:** HIGH (every planned scenario and the product fix were run in a throwaway copy of the tree; see "How this was measured")

## Summary

The fix for CFGMIG-01 is small and local to `buildConfigFromState` in `persistence/migrate-config.ts`: the per-plugin projection reads the record instead of only its key. A record the user disabled (`isRecordedButDisabled(record)` and no `dependencyDisabled: true`) is written `{ "enabled": false }`; a record the dependency check holds down is written `{}`; a `provenance: "dependency"` record is left out unless the user disabled it. With that fix applied in a scratch copy, the whole unit suite (`test/{architecture,...}`, 17241 tests), the whole integration suite (327 tests), and both cucumber profiles (adapter 1648 scenarios, builtin 148) all pass with no other test change. Only the Phase 1 seed in `features/plugin/config-migration.feature` pins today's `{}` output and must be rewritten. One new unit case (or four split ones) restores 100% direct coverage of the pair.

Every planned scenario runs with steps that already exist, so the phase needs **no new step and no verb module**. The terminal `/reload` scenario of D-BG-806 is feasible with `pi runs with the scripted model`, `the scripted model plays these steps:`, `the user reloads pi in the terminal and then prompts {string}`, and `the model receives these calls:`; it passed in the scratch run and fails red when the `existing-valid` guard is removed. Pi 1.5.0's `reload()` emits `session_start` with reason `reload` and then `resources_discover`, so the reload runs the same MIG-01 load as a session start.

Three findings bend the CONTEXT plan. (1) The user's-own-text edit scenario cannot use `a config ... with this text:` in the user scope, because that step writes its doc string raw (no run-token expansion) and the config must name the marketplace by its absolute sandbox path; use `a config in scope user and layer base, with these plugins:` plus the remembered/unchanged byte steps instead. (2) A multi-segment schema error cause is mangled by `redactAbsolutePaths` (`/plugins/demo@fixtures/enabled` reaches the user as `demo@fixtures/enabled`), so pin either the empty-file JSON error or a single-segment schema error such as `{ "plugins": [] }` (`schema validation failed: /plugins: must be object`). (3) `marketplace noautoupdate` on a project marketplace that already has `autoupdate` on writes `false`, so the project 0.4.3 upgrade can pin `false` as well as `true`.

**Primary recommendation:** Two plans. Plan 1 (product + unit): fix `basePluginEntries` as in Code Examples, add the projection unit cases, update the README reader list. Plan 2 (behavior): rewrite the deleted-config seed and add the ten new scenarios of "Scenario plan" (S-U3 to S-U8, S-P1 to S-P4; S-U5 optional), all with existing steps, each with its measured red proof. Plan 2 depends on Plan 1 (the rewritten seed is red until the fix lands), so they are two waves, or one plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
| --- | --- | --- | --- |
| Projection of records to declarations (CFGMIG-01) | Persistence (`persistence/migrate-config.ts::buildConfigFromState`) | Orchestrators (`reconcile/pending.ts` reads the same projection when the base config is absent) | Pure function, no I/O; both the load and `pending` must plan the same view (DIFF-01) |
| Once-only write, never over an existing file (CFGMIG-02) | Persistence (`migrateFirstRunConfig` `loadConfig` trichotomy) | Orchestrators (`reconcile/read-pass.ts` step (1), inside the scope lock) | The ENOENT gate lives next to the write; the caller only wraps the save error |
| Invalid-config report | Orchestrators (`read-pass.ts` step (3) `invalid-block` rows) | Persistence (`config-io.ts::loadConfig` error text) | The report is a load-path concern; `config-io.ts` only produces the cause text |
| Disabled-state rule | Persistence (`state-io.ts::isRecordedButDisabled`, ENBL-05) | -- | The single predicate; `migrate-config.ts` imports it |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Work only through GSD; commit only to `features/behavioral-gaps-phase-8`; never commit to `main`; never rebase, amend, or `--no-verify`. Commit titles follow `.agents/skills/committing/SKILL.md` and carry no milestone, phase, plan, wave, or task identifier.
- A `/claude:plugin` behavior change a user can see ships with a cucumber scenario that fails without it (AGENTS.md "Behavioral tests"); the plan SUMMARY records each red proof (Milestone rules).
- `npm run check` is the only gate verdict (typecheck, ESLint `--max-warnings 0`, fallow dead-code/health/dupes, Prettier, pairing, `check:features`, unpaired tests, integration, both cucumber profiles, 100% direct coverage per pair). A passing commit hook is not a gate.
- Two independent cognitive-complexity ceilings (ESLint `sonarjs/cognitive-complexity: 15`, fallow `maxCognitive: 15`, `maxCyclomatic: 20`). Keep the new helpers flat.
- Comments cite durable IDs (D-BG-801, ENBL-05, D-04-02, LOAD-02), never phases or plans; no comment on trivial code.
- Exported functions declare return types; `curly: all`; blank line after block statements; import order groups (`import-x/order`; measured: a separate `./state-io.ts` value import after a blank line fails "There should be no empty line within import group").
- Disk writes stay atomic and contained (NFR-1/NFR-10) -- inherited from `saveConfig`; no new writer.
- A load changes no installation state (APL-D1); MIG-01 is the sanctioned config write of the load.
- Subagent and test runs use a hermetic HOME (`test/platform/isolated-pi-home.ts`, `features/support/isolated-pi-home.ts`).
- Frozen files (never edit): `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`, `scripts/install-test-peers.mjs`, `.fallowrc.json`, `rule-packs/architecture.json`, `eslint.config.js`, `test/e2e/_rpc.ts`, `features/support/**`, `features/lib/**`, Phase 1 harness tests under `test/architecture/`, every existing step module, `.agents/skills/cucumber/**`, `platform/pi-api.ts`.
- Owned: `features/plugin/config-migration.feature`, `features/step_definitions/plugin/config-migration.steps.ts` (create only if needed -- it is not needed), `persistence/migrate-config.ts`, the invalid-config handling in `persistence/config-io.ts`, the MIG-01 step in `orchestrators/reconcile/read-pass.ts`, and their unit pairs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### What the rebuild declares (CFGMIG-01; D-BG-801 to D-BG-804)

- **D-BG-801 — the rebuild writes the config the user's own commands wrote for these records.** `install` writes `{}`, `disable` writes `{ "enabled": false }`, and `enable` writes `{ "enabled": true }` (`orchestrators/plugin/enable-disable.ts::writeEnabledFlagBack`); D-04 reads an absent `enabled` as enabled. So `buildConfigFromState` writes `{ "enabled": false }` for a record the user disabled and `{}` for every other projected plugin. "The user disabled it" is `isRecordedButDisabled(record)` (the single ENBL-05 predicate from `persistence/state-io.ts`; `test/architecture/disabled-state-classification.test.ts` rejects any local re-derivation such as `!record.enabled` or `.enabled === false`) and no `dependencyDisabled: true` marker. This fixes the Phase 1 gap (P1-DC-34): the deleted-config seed is rewritten to state `enabled` false, the load then reports no results, and `pending` shows nothing to apply. Alternative rejected: write `enabled: true|false` on every entry (it differs from what `install` writes, so a rebuilt config would not match the one the user had).
- **D-BG-802 — a cascade-installed dependency stays out of the rebuilt config unless the user disabled it.** D-04-02 (v1.20) rules that the desired-state config names only the plugins the user asked for; a `provenance: "dependency"` record keeps itself through its record. Today the rebuild declares every record, so a deleted config comes back naming dependencies the user never named, and a later uninstall of the dependent leaves a declaration that plans a reinstall. The rebuild leaves out a `provenance: "dependency"` record, except one the user disabled by name (EDEP-02 makes the user disable the dependent first, then the dependency, and `disable` writes `{ "enabled": false }` for it), which keeps its `{ "enabled": false }` entry. CFGMIG-01's "every recorded plugin" is read as every plugin the user's commands declared; a release before the config files (0.4.3) has no dependency records (its records migrate to `provenance: "explicit"`), so the upgrade path still declares every record. Logged as P8-DC-01.
- **D-BG-803 — a record the dependency check holds down is written `{}`.** A record with the `dependencyDisabled` marker (LOAD-01 / D-06-02) was disabled by the check, not by the user, so the config the user had declared it enabled. Writing `{ "enabled": false }` would make the hold permanent, because neither lift (`classifyDeclaredPlugin`, `buildDependencyDisabledLift`) overturns a config-declared `enabled: false`. The marker is read in `migrate-config.ts` itself through a small local predicate (persistence cannot import `orchestrators/reconcile/plan.ts::isAlreadyDependencyDisabled`), and the `orchestrators/reconcile/README.md` line "Exactly three readers decide anything on it" gains this fourth reader.
- **D-BG-804 — the legacy `autoupdate` field keeps today's projection.** Only an exact `true` or `false` on a release-0.4.3 marketplace record reaches the config (D-13, SPLIT-01); an absent field writes no `autoupdate`. A current-schema record carries no `autoupdate` (it lives in the config since D-13), so a config the user deletes under a current release comes back without it. That is a limit of what `state.json` records, not a gap this phase can fix; logged as P8-DC-03.
- **Every recorded marketplace is declared** in both scopes, as today: an install that adds a marketplace to the scope (D-MF-04) also declares it (`writeAdoptingConfigEntries`), so the records and the declarations agree. A soft-degraded record (`compatibility.installable === false`) is declared like any other, as today.
- **`--local` declarations (FIX-02) keep today's rule.** A marketplace or plugin key that `claude-plugins.local.json` declares stays out of the base config; a scope whose records the local config declares in full gets no base config at all (the `empty-state` arm); and an unreadable local config makes the migration write nothing (`local-invalid`). Scenarios pin all three in the project scope, where `--local` is used.

#### Once only, and the user's edits survive (CFGMIG-02; D-BG-805, D-BG-806)

- **D-BG-805 — "first run" stays "the base config is absent".** The guard is the existing `loadConfig` trichotomy in `migrateFirstRunConfig`: a valid or an invalid `claude-plugins.json` stops the migration before any write; only an absent one triggers it. No marker file or state field is added. So a config the user deletes later is rebuilt on the next load (the Phase 1 seed pins this), and a config the user edits is never rewritten.
- **The edit scenario writes the user's own text** with `a config in scope <scope> and layer base, with this text:` after the first load wrote the config, using formatting the extension would not produce (the user's own indentation and a hand edit, such as `"enabled": false` for an installed plugin). A later load reports the pending change the edit asks for and changes nothing, and `the "claude-plugins.json" file of the <scope> scope holds this text:` proves the bytes survive. Red proof: remove the `existing-valid` short-circuit and the step fails.
- **D-BG-806 — `/reload`.** A new session stands in for a later load, as the suite already does ("a new session as Pi's /reload gives it", `features/agent/lifecycle.feature`), because Pi runs the same `resources_discover` load on a session start and on `/reload`. The planner adds one scenario that reloads Pi in the terminal with the existing step `the user reloads pi in the terminal and then prompts {string}` (with `pi runs with the scripted model`), if those existing steps support it without a frozen-file change; otherwise the new session stands in for `/reload` too, and the choice is logged (P8-DC-02 records the decision either way).
- **Research item for the planner:** check whether a load with `autoapply` on (AAP-01) writes `claude-plugins.json` after it exists, for example through an install's config write-back during the apply. If it does, that rewrite is a CFGMIG-02 gap in files this phase does not own (the add and install paths), so it becomes a parent line and a dubious choice, not a direct edit.

#### An invalid existing config (CFGMIG-02; D-BG-807)

- **D-BG-807 — what the user sees is today's report.** The load reports the existing `invalid manifest` row for the file (subject `claude-plugins.json` or `claude-plugins.local.json`, scope, severity error, the loader's cause such as `JSON parse failed: ...` or `schema validation failed: ...`), and `pending` reports the same block. No new reason is added (Milestone rules, append-only closed sets: prefer an existing reason). The load changes nothing: the config and `state.json` bytes stay as they were (`the config and installation record bytes of the <scope> scope are remembered` / `are unchanged`, or `holds this text:`), and the installed plugins keep loading from their records (the session still offers their skills).
- **The pinned cause text is identical on every supported Node major.** CI runs Node 24 and this machine runs Node 26. A JSON syntax error's message comes from V8; the planner pins one only after checking that Node 22, 24, and 26 word it the same (for example an empty file's `Unexpected end of JSON input`), and otherwise uses a schema error, whose text comes from typebox (`schema validation failed: /plugins/demo@fixtures/enabled: must be boolean`).
- **Coverage:** an invalid base config at the first load in the user scope (a `state.json` and a broken `claude-plugins.json`: reported, bytes kept, nothing written), and an unreadable local config with no base config in the project scope (FIX-02 `local-invalid`: reported, the local config kept byte for byte, and no `claude-plugins.json` created).

#### Scenarios, steps, and tests (D-BG-808)

- **D-BG-808 — scenario plan.** All scenarios live in `features/plugin/config-migration.feature`, carry no implementation tag (no MCP surface; they run once, under `adapter`, D-BG-04), and use existing steps wherever one exists. Planned coverage:
  - user scope: the 0.4.3 upgrade seed (kept); the deleted-config seed, rewritten to the fixed output (`enabled` false, the load reports no results); a deleted config with a cascade-installed dependency (D-BG-802: only the plugin the user named is declared); the user's edit surviving a later load (and `/reload` per D-BG-806); an invalid base config reported and kept.
  - project scope: the 0.4.3 upgrade (`Given the project scope holds what release 0.4.3 left: ...`), with the `autoupdate` the user set, so the project scope's MIG-01 output is pinned; the `--local`-only scope that gets no base config; and the unreadable local config.
  - `pending` after the migrating load shows nothing to apply in each scope: the load printing no results is the observable (the load prints the same block `pending` prints, RECON-05), and at least one scenario per scope runs `/claude:plugin pending` after `the user has started a new pi session` to show `reconcile-pending-empty` literally.
- **Every scenario fails without the behavior it names**, and each plan SUMMARY records the red proof (Milestone rules). Where a scenario covers behavior that already works (FIX-02, the invalid arm, the once-only guard), the red proof breaks that behavior in the product temporarily and restores it.
- **Seeds keep their shared steps in use**: `the {word} scope holds what release 0.4.3 left: its installation record and no config` (`plugin/installation.steps.ts`) and `the user has deleted the config files of the {word} scope` (`config.steps.ts`).
- **The verb module `plugin/config-migration.steps.ts`** is created only for a step no module has, such as deleting only one layer's config; a helper stays private to it. No file under `features/support/` or `features/lib/` changes (frozen).
- **Unit tests:** `test/persistence/migrate-config.test.ts` gains the projection cases of D-BG-801 to D-BG-803 (user-disabled explicit, dependency-check hold, enabled dependency left out, user-disabled dependency kept), and every touched source file keeps 100% direct coverage.

### Claude's Discretion

- The split into plans and waves, the exact scenario titles and tables, and which existing steps each scenario uses.
- Whether the `/reload` scenario of D-BG-806 is feasible with the existing steps.
- The form of the local predicate that reads the `dependencyDisabled` marker in `migrate-config.ts`.

### Deferred Ideas (OUT OF SCOPE)

- Recovering a marketplace's `autoupdate` after a current-release user deletes the config: `state.json` no longer records it (D-13). Out of scope (P8-DC-03).
- A load with `autoapply` on that rewrites the config, if research finds one: a parent line for the owning phase or the parent (D-BG-806 research item).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| CFGMIG-01 | The first load with a `state.json` and no `claude-plugins.json` writes a config declaring every recorded marketplace and plugin, carrying the enabled state and the legacy `autoupdate` field. | Fix in "Code Examples"; scenarios S-U1, S-U2, S-U3, S-U4, S-U5, S-P1, S-P2, S-P3 with measured outputs; unit cases for D-BG-801..803 |
| CFGMIG-02 | Later loads never rewrite the config, so the user's edits survive, and an invalid existing config is never overwritten. | Scenarios S-U6 (new session), S-U7 (terminal `/reload`), S-U8 (invalid base), S-P4 (unreadable local); measured red proofs; autoapply audit (Q5) |
</phase_requirements>

## How this was measured

- Worktree: `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps-phase-8` at `5486dfb1`. The current seeds pass there: `npx cucumber-js features/plugin/config-migration.feature` -> `2 scenarios (2 passed)` (after `node scripts/install-test-peers.mjs`, which the worktree lacked).
- A throwaway copy of the tree (no `.git`, `.planning`, `.claude`; `node_modules` symlinked to the worktree's) under the session scratchpad held the candidate fix and a throwaway feature file. Every scenario output quoted below comes from `npx cucumber-js features/plugin/config-migration.feature` in that copy under the default (adapter) profile. The copy is deleted before this research returns. No tracked file of the worktree was changed.
- With the fix in the copy: `tsc --noEmit` exit 0; ESLint on `migrate-config.ts` exit 0 (after merging the `./state-io.ts` import into the sibling group); unit + architecture suites `tests 17241 / pass 17241 / fail 0`; integration suite `tests 327 / pass 327 / fail 0`; direct coverage of the pair exit 0 with one added case (exit 1, `branches 30/34, functions 5/6, lines 268/273`, without it).

## Answers to the planner's questions

### Q1. The fix in `migrate-config.ts` (D-BG-801/802/803)

**Record fields** [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:142,192,196] -- verbatim:

```ts
  dependencyDisabled: Type.Optional(Type.Boolean()),   // line 142
  enabled: Type.Boolean(),                              // line 192
  provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")]),  // line 196
```

**The single predicate** [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:275-277]:

```ts
export function isRecordedButDisabled(record: { readonly enabled: boolean }): boolean {
  return !record.enabled;
}
```

**The ENBL-05 gate** [VERIFIED: test/architecture/disabled-state-classification.test.ts:41-53, 170-190]. It walks every `.ts` under the extension root and, for every file except `state-io.ts`, rejects these patterns on comment-stripped source:

```ts
const INLINE_REDERIVATIONS: readonly RegExp[] = [
  /!\s*[\w.]+\.enabled\b/,
  /\.enabled\s*===\s*false/,
  /\.enabled\s*!==\s*true/,
  DESTRUCTURED_ENABLED_BINDING,   // /\{[^{}]*\benabled\b[^{}]*\}\s*=(?![=>])/
  BRACKET_ENABLED_ACCESS,         // /\[\s*["']enabled["']\s*\]/
  BOOLEAN_ENABLED_COERCION,       // /Boolean\s*\([^)]*\.enabled\b[^)]*\)/
];
```

- Reading `record.dependencyDisabled === true` and `record.provenance === "dependency"` matches none of these (`.dependencyDisabled` does not contain `.enabled`). The object literal `{ enabled: false }` is not followed by `=`, so `DESTRUCTURED_ENABLED_BINDING` does not match. Measured: the architecture suite passed with the fix.
- No rule requires registering a new consumer. `DISABLED_STATE_TARGETS` [VERIFIED: test/architecture/gate-targets.ts:115-124] lists the definition site and five consumers whose import the gate checks; the list is pinned by basename order (`DECLARED_MODULE_ORDER` in the test). Adding `migrate-config.ts` is optional, is in a file this phase does not own, and would also need the test's `DECLARED_MODULE_ORDER` changed. Recommendation: do not add it (logged as a dubious choice).
- `compat-01-no-expansion.test.ts:664-678` pins the record's key set; the fix adds no key.

**Recommended shape** (measured in the copy; see Code Examples): `basePluginEntries` takes the plugin map instead of `Object.keys(mp.plugins)`, and a `declaredEntry(record)` helper returns `{ enabled: false }`, `{}`, or `undefined`. The local predicate is `isHeldByDependencyCheck(record)` -> `record.dependencyDisabled === true` (Claude's discretion; it mirrors the first half of `plan.ts::isAlreadyDependencyDisabled`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:667-669`).

**Unit tests** (`test/persistence/migrate-config.test.ts`). The existing fixtures `recordedPlugin()` (enabled, explicit) and `stateRecording()` already exist [VERIFIED: test/persistence/migrate-config.test.ts:65-96]. No existing case changes: all fixtures are enabled explicit records. Needed new cases, all through `buildConfigFromState(state, {})`:
1. user-disabled explicit record -> `{ "enabled": false }`
2. explicit record with `enabled: false` and `dependencyDisabled: true` -> `{}`
3. enabled `provenance: "dependency"` record -> left out
4. `provenance: "dependency"` record with `enabled: false` (no marker) -> `{ "enabled": false }`
Optional: a dependency record held by the check -> left out; a `migrateFirstRunConfig` bytes case for a disabled record. One combined case covering 1-4 brought direct coverage to 100% (measured, `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/persistence/migrate-config.ts` exit 0); the unit-test rules favor one behavior per case, so split them.

`npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/migrate-config.ts` is the per-task check.

**Planner behavior of the D-BG-803 output** (measured with a scratch script over the fixed projection): an explicit record with `enabled: false, dependencyDisabled: true` projects to `{}`; with the dependency still missing, `planReconcile` plans no enable and no disable for it (only the existing `pluginsToDependencyInstall` entry); with the dependency satisfied, it plans `pluginsToEnable: [{ scope: "user", plugin: "app", marketplace: "mp" }]`. So `{}` keeps the hold liftable, as D-BG-803 requires.

### Q2. Callers and the tests that pin today's output

`buildConfigFromState` / `migrateFirstRunConfig` callers [VERIFIED: grep over extensions, test, features, scripts, docs, .agents]:

| File | Line | Use | Effect of the fix |
| --- | --- | --- | --- |
| `orchestrators/reconcile/read-pass.ts` | 313 | MIG-01 step (1), inside the scope lock | the written config carries the disabled state and leaves out dependencies |
| `orchestrators/reconcile/autoapply-setting.ts` | 201 | `/claude:plugin autoapply on|off` (base target) migrates first | same projection; no feature pins it with a disabled or dependency record (full adapter run green) |
| `orchestrators/reconcile/pending.ts` | 231, 280 | `pending`/load planning view when the base config is absent (DIFF-01, LAYER-06) | `pending` before the first load now plans the same view the load writes |
| `orchestrators/reconcile/types.ts` | 49 | comment only | none |
| `test/integration/reconcile-plan-convergence.test.ts` | 13, 124, 145, 154, 178, 327, 372, 389, 478 | fixed-point checks | unchanged: the D-09-16 satisfied arm records `vault` as `provenance: "dependency"`; with the fix it is no longer declared and the plan is still `emptyReconcilePlan("project")` (measured: 327/327 pass) |
| `test/persistence/migrate-config.test.ts` | 9-12 and cases | owner pair | no existing case changes; new cases above |
| `test/orchestrators/reconcile/read-pass.test.ts`, `apply-outcomes.test.ts` | -- | `MigrateConfigSaveError` only | none |

Tests and features that pin `{}` for every plugin: **only** the Phase 1 seed "The first load after the user deleted the config writes it without a disabled plugin's enabled state" (`features/plugin/config-migration.feature:27-42`). Measured with the fix: unit + architecture 17241/17241, integration 327/327, cucumber adapter 1648/1648 and builtin 148/148. No unowned feature file changes.

### Q3. Measured cucumber outputs (adapter profile, scratch copy with the fix)

(a) **Rewritten deleted-config seed.** After `install`, `disable`, `the user has deleted the config files of the user scope`, `When the user starts a new pi session`: `Then the session reports no results` passes, and the config is

```json
{
  "schemaVersion": 1,
  "marketplaces": {
    "fixtures": {
      "source": "<sandbox>/home/marketplaces/fixtures"
    }
  },
  "plugins": {
    "demo@fixtures": {
      "enabled": false
    }
  }
}
```

so `declares these marketplaces:` `| fixtures | {home}/marketplaces/fixtures |` and `declares these plugins:` `| id | enabled |` / `| demo@fixtures | false |` pass. Without the fix it fails at `the session reports no results` (two `will enable` cascade payloads).

(b) **Invalid base config with a `state.json`.** After `install demo@fixtures --scope user`, `a config in scope user and layer base, with this text:` with an empty doc string, the bytes remembered, `When the user starts a new pi session`:

```gherkin
    Then the session reports these results:
      | kind    | severity | needs reload | summary                      | tally label       | tally failures | tally warnings |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name    | marketplace scope | marketplace status | marketplace reasons | id                                      | name                | status | reasons          | scope | cause chain                                     | cause truncated | leaks | rollback partial |
      | claude-plugins.json | user              | failed             | invalid manifest    | claude-plugins.json@claude-plugins.json | claude-plugins.json | failed | invalid manifest | user  | JSON parse failed: Unexpected end of JSON input | false           |       |                  |
      | claude-plugins.json | user              | failed             | invalid manifest    | claude-plugins.json@claude-plugins.json | claude-plugins.json | failed | invalid manifest | user  | JSON parse failed: Unexpected end of JSON input | false           |       |                  |
    Then the config and installation record bytes of the user scope are unchanged
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
```

All passed. The rows are doubled (one per payload, as every load scenario shows). `tally failures` is `2` for one failed row (the marketplace block and its plugin row), matching `features/plugin/autoapply.feature:269-277`. The installed plugin's skill is still offered.

(c) **`pending` after a migrating load.** Both `When the user runs "/claude:plugin pending --scope user"` (after install, disable, delete, `Given the user has started a new pi session`) and the project-scope 0.4.3 variant gave `| kind | reconcile-pending-empty |`, `| severity | info |`, `| needs reload | false |` (passed). Without the fix the user-scope variant shows `will enable`.

(d) **Project-scope 0.4.3 upgrade.** `marketplace add {home}/marketplaces/fixtures --scope project`, `marketplace autoupdate fixtures --scope project`, `install demo@fixtures --scope project`, `the project scope holds what release 0.4.3 left: ...`, new session: no results; `declares these marketplaces:` `| fixtures | {home}/marketplaces/fixtures | true |`; `declares these plugins:` `| demo@fixtures |`. With `marketplace noautoupdate fixtures --scope project` after `autoupdate`, the column reads `false` (passed). With `noautoupdate` alone (never turned on), the base config held no `autoupdate`, so the rebuilt config had none: do not use bare `noautoupdate` to pin `false`.
`features/lib/earlier-version-state.ts` (0.4.3) [VERIFIED: features/lib/earlier-version-state.ts:178-188, 267-277, 296-305, 333-366]: it keeps only the 0.4.3 members of each record (no `enabled`, no `provenance`, no `resources.hooks`), sets `schemaVersion` 1, copies onto each marketplace record the `autoupdate` the scope's base config declares when it is a boolean (`typeof pair[1] === "boolean"`), and then deletes `claude-plugins.json` and `claude-plugins.local.json`. It reads the base config with `readObject`, so the scope must have a base config before the rewrite (a `--local`-only scope does not fit this step).

(e) **`--local`-only project scope.** `marketplace add {home}/marketplaces/fixtures --scope project --local`, `install demo@fixtures --scope project --local`, new session: `the session reports no results`, `the "claude-plugins.json" file of the project scope does not exist`, `the "claude-plugins.local.json" file of the project scope declares these plugins:` `| demo@fixtures |` (passed). The two `--local` commands write no base config, so the load's MIG-01 meets an absent base config with a `state.json` and takes the `empty-state` arm.

(f) **Unreadable local config, no base config (project).** Same two `--local` commands, then `a config in scope project and layer local, with this text:` `{ "plugins": [] }`, new session:

```gherkin
    Then the session reports these results:
      | kind    | severity | needs reload | summary                      | tally label       | tally failures | tally warnings |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name          | marketplace scope | marketplace status | marketplace reasons | id                                                  | name                      | status | reasons          | scope   | cause chain                                         | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /plugins: must be object | false           |       |                  |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /plugins: must be object | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
```

All passed. To also prove the local config bytes survive, add `Then the "claude-plugins.local.json" file of the project scope holds this text:` with the same doc string (raw comparison; the text holds no run token). `the config and installation record bytes ... are remembered` cannot be used here, because it reads `claude-plugins.json`, which is absent [VERIFIED: features/step_definitions/config.steps.ts:55-61].
A truncated local config `{ "schemaVersion": 1,` gave the cause `JSON parse failed: Expected double-quoted property name in JSON at position 21 (line 1 column 22)` (a V8 message; see Q6).

(g) **Deleted config with a cascade-installed dependency.** `the marketplace "fixtures" offers these plugins with dependencies:` `| app | 1.0.0 | demo |` / `| demo | 1.0.0 | |`, `install app@fixtures --scope user`, delete the configs, new session.
- Today (original `migrate-config.ts`): no results; `declares these plugins:` lists `demo@fixtures` then `app@fixtures`.
- With the fix: no results; `declares these plugins:` `| app@fixtures |` only; `the session offers these skills:` `| /skill:app-skill | A skill of app 1.0.0. |`, `| /skill:demo-skill | A skill of demo 1.0.0. |`.
- User-disabled dependency (EDEP-02 order: `disable app@fixtures`, then `disable demo@fixtures`), delete, new session, with the fix: no results; `declares these plugins:` `| id | enabled |` / `| demo@fixtures | false |` / `| app@fixtures | false |` (state order: the cascade records `demo` first). Today the same scenario reports two `will enable` rows.

**Full-suite check:** with the fix and the throwaway scenarios in the copy, `npx cucumber-js --profile adapter features` -> `1648 scenarios (1648 passed)` in 5 min 06 s, and `npx cucumber-js --profile builtin features` -> `148 scenarios (148 passed)`. No unowned feature file changes.

### Q4. D-BG-806: `/reload` in the terminal with existing steps -- feasible

Measured scenario (passed with the fix, failed red with the `existing-valid` guard removed):

```gherkin
  Scenario: <title>
    Given pi runs with the scripted model
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    Given the user has started a new pi session
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | false   |
    Given the config and installation record bytes of the user scope are remembered
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user reloads pi in the terminal and then prompts "hello"
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the config and installation record bytes of the user scope are unchanged
```

- Needs: `pi runs with the scripted model` first (the reload step calls `this.profileHarness()` and fails without a profile Pi [VERIFIED: features/step_definitions/session.steps.ts:135-153]); a script with at least one reply; and a `Then` that compares the turn (`the model receives these calls:`), because the world fails a scenario whose turn goes uncompared (`recordTurn` asserts the previous turn was compared, `features/support/world.ts:797-815`). The step's own timeout is 120 s (`TERMINAL_RELOAD_STEP_TIMEOUT_MS`).
- The `/claude:plugin install` and `the user has started a new pi session` steps go to the profile Pi, so they work after `pi runs with the scripted model`.
- Pi runs the same load on `/reload` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:3016-3049]: `reload()` emits `session_shutdown` (reason `reload`), rebuilds the runtime, then `await this._extensionRunner.emit({ type: "session_start", reason: "reload" })` and `await this.extendResourcesFromExtensions("reload")`, which emits `resources_discover`; the extension's `resources_discover` handler runs `prepareResources` (the load) with no reason gate (`extensions/pi-claude-marketplace/index.ts:218-249`).
- Limit: the step first starts a terminal Pi, whose startup also runs the load, then reloads it. A red proof therefore shows that a terminal start plus `/reload` rewrote the config; it cannot attribute the rewrite to `/reload` alone. The scenario still proves CFGMIG-02's "survives `/reload`" as observed by the user. No frozen file changes.

### Q5. D-BG-805 research item: does any load path write `claude-plugins.json` once it exists?

- **Without autoapply:** no. The load's only config write is MIG-01, gated on the base config being absent (`migrate-config.ts:221-233`). Measured: with that guard removed, the 0.4.3 seeds lose `autoupdate` and the edit scenarios fail, because every session start runs the load twice (the doubled payloads) and the second run would re-migrate with the D-13 scrub applied.
- **With autoapply on (AAP-01):** `apply` runs its steps in orchestrated mode, and every orchestrated step skips its config write-back:
  - install: `install-flow-ledger.ts:994-1027` calls `writeAdoptingConfigEntries` only when `opts.notifications?.mode !== "orchestrated"`; otherwise `writeOrchestratedDeclarations` (`install-flow-results.ts:124-140`), which writes only when `landedDisabled`;
  - marketplace add: `declare: action?.declare ?? opts.notifications?.mode !== "orchestrated"` (`marketplace/add.ts:1101`), and the orchestrated record-reuse path passes `declareMissing: false` (`add.ts:603-608`);
  - enable/disable: `resolveIdempotentOutcome` returns before writing when `write.orchestrated` (`enable-disable.ts:2090`), and the fresh path writes only `if (!orchestrated)` (`enable-disable.ts:2605-2616`);
  - marketplace remove: "SKIPPED in orchestrated mode" (`marketplace/remove.ts:516-520`);
  - the background autoupdate pass runs `marketplace update`'s code, which has no config writer (`marketplace/update.ts` is not in the list of files that call `saveConfig`, `writeBatchedConfigEntries`, `writeMarketplaceConfigEntry`, `writePluginConfigEntry`, or `writeAdoptingConfigEntries`).
- **The one load-time write that remains:** with autoapply on, an apply install of a declared plugin whose entry has no `enabled` key and whose marketplace entry sets `defaultEnabled: false` lands disabled (`landedDisabled = opts.applyDefaultEnabled === true && declaredEnabled === undefined && !installed.root.resolved.defaultEnabled`, `install-flow-ledger.ts:911-914`) and stamps `{ "enabled": false }` into the config through `writePluginConfigEntry` (D-102-02 / DFEN-04). It adds a key the user did not write and re-serializes the file (formatting is lost). It is a recorded decision, it never overwrites a value the user wrote (D-102-04), and it is in the install path (Phases 11/12/14 own it). Recommendation: no change in this phase; record it as a dubious choice and a parent note, not a fix. `writeBatchedConfigEntries` (`persistence/config-write-back.ts:195-224`) always saves even for a no-op patch, but no orchestrated load path reaches it.

### Q6. D-BG-807: `JSON.parse` text on Node 22, 24, 26

Installed: `/usr/bin/node` v22.22.2 and `/home/linuxbrew/.linuxbrew/bin/node` v26.13.0 (the default). No Node 24 is installed; fetching one through `npm exec node@24` was refused by the session's permission classifier. Measured on 22 and 26, byte-identical:

| Input | Node 22.22.2 and Node 26.13.0 |
| --- | --- |
| empty file / `"\n"` | `Unexpected end of JSON input` |
| `{"schemaVersion":1,}` | `Expected double-quoted property name in JSON at position 19 (line 1 column 20)` |
| `{"schemaVersion": 1,\n` (truncated) | `Expected double-quoted property name in JSON at position 21 (line 2 column 1)` |
| `{ not json` | `Expected property name or '}' in JSON at position 2 (line 1 column 3)` |
| `oops\n` | `Unexpected token 'o', "oops\n" is not valid JSON` |

Node 24 ships a V8 between those two, and both ends agree, so Node 24 almost certainly matches [ASSUMED -- not observed; CI runs Node 24]. `test/persistence/config-io.test.ts:216` already pins `JSON parse failed: Unexpected end of JSON input` and passes in CI on Node 24 [VERIFIED: test/persistence/config-io.test.ts:216 reads the string; CI runs that suite on Node 24 per STACK.md], which is direct evidence for the empty-file message on Node 24.

**Recommendation:** pin `JSON parse failed: Unexpected end of JSON input` (empty file) for the user-scope invalid base config -- the one V8 message already proven on CI's Node 24 by an existing unit test. For a second invalid config use a typebox schema error with a **single-segment** pointer, `{ "plugins": [] }` -> `schema validation failed: /plugins: must be object` (measured in a session row). Do **not** pin a multi-segment schema error: `{ "plugins": { "demo@fixtures": { "enabled": "no" } } }` reaches the user as `schema validation failed: demo@fixtures/enabled: must be boolean`, because `redactAbsolutePaths`'s absolute-path pattern (`shared/redact-absolute-paths.ts:71-73`) reads `/plugins/demo` as a path and cuts it to its basename. Typebox itself reports `/plugins/demo@fixtures/enabled` (measured with `Compile(...).Errors`). That mangling is in `shared/redact-absolute-paths.ts` and in read-pass step (3), which this phase does not own: a parent note and a dubious choice, not a fix here.

### Q7. New steps

None needed. Every scenario in the plan below ran with existing steps, and `node scripts/check-features.mjs` passed (exit 0) over the throwaway feature file in the copy. Do not create `plugin/config-migration.steps.ts`. Keep the seed steps in use: `the {word} scope holds what release 0.4.3 left: its installation record and no config` (S-U1 and S-P1) and `the user has deleted the config files of the {word} scope` (S-U2..S-U7).

### Q8. Red proofs (measured)

Each break was applied to the fixed `migrate-config.ts` in the copy, the whole feature file was run, and the file was restored (diff-checked).

| Break (temporary) | Scenarios that failed (step) |
| --- | --- |
| Original `migrate-config.ts` (no fix) | rewritten deleted-config seed (`the session reports no results`: two `will enable`), dependency (`declares these plugins:` lists `demo@fixtures`), user-disabled dependency (`the session reports no results`) |
| Remove the `existing-valid` short-circuit (`migrate-config.ts:222-224`) | edit + new session (`the session reports these results:`), edit + `/reload` (`the config and installation record bytes ... are unchanged`), both project 0.4.3 scenarios (`declares these marketplaces:`: `autoupdate` lost) |
| Make the `existing-invalid` arm fall through (`:226`) | invalid base config (`the session reports these results:`) |
| Pass `{}` instead of `local` to `buildConfigFromState` (`:241`) | `--local`-only scope and unreadable local (`claude-plugins.json ... does not exist`) |
| Make the `local-invalid` arm fall through (`:236`) | unreadable local (`claude-plugins.json ... does not exist`) |
| Drop the `legacyAutoupdate === true` capture (`:169`) | project 0.4.3 with `autoupdate` on (`declares these marketplaces:`) |

For the `pending` scenarios, the red proof is the original `migrate-config.ts` (user scope: `will enable`). For a project-scope `pending` scenario, prefer the deleted-config + disabled variant (red = the original file) over the 0.4.3 variant, whose only red is breaking the projection itself, because `pending` plans the same projection when the base config is absent.

### Q9. Upstream (Claude Code 2.1.319)

Claude Code refuses to write a settings file whose JSON does not parse [VERIFIED: grep of `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`]: `updateSettingsForSource` returns `{error:Error(\`Invalid JSON syntax in settings file at ${r}\`)}` after logging `updateSettingsForSource: invalid JSON in settings file at ${r}`, and for a file that parses but fails validation it continues from the raw settings "so entries this build does not recognize survive the write". This matches CFGMIG-02 (never overwrite an invalid file). The project's report text (D-BG-807) is the project's own contract (MIG-01, CFG-03).

## Scenario plan (recommended titles are the planner's; tables measured)

All in `features/plugin/config-migration.feature`, no tags, existing Background kept (`fixtures` published as dir, offers `demo 1.0.0`, added to the user scope).

| ID | Behavior | Key steps | Red proof |
| --- | --- | --- | --- |
| S-U1 | (seed, kept) 0.4.3 upgrade writes the config, `autoupdate` true | unchanged | Phase 1: Given's absence checks; product: `saveConfig` off |
| S-U2 | (seed, rewritten) deleted config is rebuilt with the disabled plugin's `enabled` false; load reports no results | Q3(a) tables | original file |
| S-U3 | `pending` after the migrating load in the user scope is empty | `Given the user has started a new pi session`, `When the user runs "/claude:plugin pending --scope user"`, `reconcile-pending-empty` | original file |
| S-U4 | deleted config with a cascade dependency declares only the named plugin | Q3(g) | original file |
| S-U5 (optional) | a dependency the user disabled keeps its `enabled` false | Q3(g) last bullet | original file |
| S-U6 | a user's edit survives a later load (new session) | plugins step `enabled false`, bytes remembered; `When the user starts a new pi session`; two `will disable` rows; bytes unchanged | remove `existing-valid` |
| S-U7 | a user's edit survives a terminal `/reload` | Q4 | remove `existing-valid` |
| S-U8 | an invalid base config is reported, kept byte for byte, and the plugin still loads | Q3(b) | `existing-invalid` falls through |
| S-P1 | project 0.4.3 upgrade, `autoupdate` true (or false via `autoupdate` then `noautoupdate`) | Q3(d) | drop the `=== true` capture (or the `=== false` one) |
| S-P2 | `pending` after the project's migrating load is empty | deleted-config + disabled in the project scope | original file |
| S-P3 | a `--local`-only project scope gets no base config | Q3(e) | pass `{}` for `local` |
| S-P4 | an unreadable local config with no base config is reported and no base config is written | Q3(f) | `local-invalid` falls through |

S-U6's tables (measured):

```gherkin
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope |
      | fixtures         | user              | demo@fixtures | demo | will disable |         | user  |
      | fixtures         | user              | demo@fixtures | demo | will disable |         | user  |
    Then the config and installation record bytes of the user scope are unchanged
```

S-P2 (measured): `marketplace add {home}/marketplaces/fixtures --scope project`, `install demo@fixtures --scope project`, `disable demo@fixtures --scope project`, `the user has deleted the config files of the project scope`, `Given the user has started a new pi session`, `When the user runs "/claude:plugin pending --scope project"` -> `reconcile-pending-empty` / `info` / `false`, and `declares these plugins:` `| demo@fixtures | false |`. Passed with the fix; with the original file it failed at `Then the result has these fields:` (kind was not `reconcile-pending-empty`).

## Architecture Patterns

### Data flow (load)

```
Pi session_start / /reload
  -> resources_discover handler (index.ts) -> prepareResources -> loadReconcile (reconcile/load.ts)
     per scope, project first:
       readScopeLocked (read-pass.ts), inside withLockedStateTransaction:
         (1) migrateFirstRunConfig(loc, state)            <- MIG-01 (owned step)
               loadConfig(base): valid -> stop | invalid -> stop | absent ->
               loadConfig(local): invalid -> stop (local-invalid) | valid/absent ->
               buildConfigFromState(state, local) -> empty? stop (empty-state) : saveConfig (atomic)
         (2) loadMergedScopeConfig
         (3) invalid base/local -> invalid-block rows ("invalid manifest", redacted cause) -> no plan
         (4) dependency verdict -> (5) planReconcile
     -> pending block printed on mismatch, nothing on match (RECON-05)
```

### Anti-patterns to avoid

- Re-deriving "disabled" with `!record.enabled` or `.enabled === false` in `migrate-config.ts` (fails the ENBL-05 gate).
- Writing `enabled: true` on every entry (D-BG-801 rejected alternative).
- Writing `{ "enabled": false }` for a `dependencyDisabled` record (makes the hold permanent; D-BG-803).
- Adding a marker file or state field for "first run" (D-BG-805).
- Touching read-pass steps other than (1), reordering the load, or adding a reason to a closed set.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
| --- | --- | --- | --- |
| "Is this record disabled" | a local `!record.enabled` | `isRecordedButDisabled` (`state-io.ts:275`) | ENBL-05 gate; one definition |
| Config write | a new writer | `saveConfig` (`config-io.ts:185-199`) | schema check, containment, atomic write |
| A step to read or write the config | a new step | `config.steps.ts` steps | frozen modules already cover every scenario |
| Whole-text user config with a local marketplace | `a config ... with this text:` | the plugins step + byte steps | the text step writes raw (no `{home}` expansion) |

## Common Pitfalls

### Pitfall 1: The edit scenario's whole-text config cannot name the local marketplace
**What goes wrong:** `a config in scope user and layer base, with this text:` writes its doc string raw [VERIFIED: features/step_definitions/config.steps.ts:194-201; features/lib/layer-config.ts:163-166], and `holds this text:` compares raw text [VERIFIED: config.steps.ts:256-263]. The base config of the user scope must declare `fixtures` with `{home}/marketplaces/fixtures`, which only exists as an absolute sandbox path. Measured: the migrated config's text holds `"/tmp/pi-cm-features-<id>/home/marketplaces/fixtures"`.
**How to avoid:** Use `a config in scope user and layer base, with these plugins:` (which keeps the other members and writes two-space JSON, `layer-config.ts:117-125`) for the hand edit, then `the config and installation record bytes of the user scope are remembered` / `are unchanged`. The red proof still bites: a re-migration rewrites `demo@fixtures` as `{}`. This departs from the CONTEXT wording; log it.

### Pitfall 2: A session start runs the load twice
Every session reports its payloads twice, and a broken once-only guard shows on the second run. Results tables state both rows.

### Pitfall 3: `the user has started a new pi session` requires info-only payloads
Fine after a migrating load (it reports nothing), but do not use it as the setup step before an invalid config is in place.

### Pitfall 4: Multi-segment schema causes are redacted
See Q6. Pin the empty-file JSON error or `{ "plugins": [] }`.

### Pitfall 5: Bare `noautoupdate` pins nothing
See Q3(d). Turn autoupdate on first, or write the marketplace with `a config in scope project and layer base, with these marketplaces:` and an `autoupdate` `false` cell before the 0.4.3 rewrite.

### Pitfall 6: The worktree had no optional peer cache
`npx cucumber-js` failed in `BeforeAll` ("the peer cache holds no pi-mcp-adapter") until `node scripts/install-test-peers.mjs` ran. `npm run test:cucumber*` runs it first.

## Code Examples

### The projection fix (measured: tsc, ESLint, Prettier, unit, integration, cucumber green)

```ts
// persistence/migrate-config.ts -- imports
import {
  loadConfig,
  saveConfig,
  type MarketplaceConfigEntry,
  type PluginConfigEntry,
  type ScopeConfig,
} from "./config-io.ts";
import { isRecordedButDisabled } from "./state-io.ts";

import type { ScopedLocations } from "./locations.ts";
import type { ExtensionState, PluginInstallRecord } from "./state-io.ts";
import type { ParsedSource } from "../domain/source.ts";

// in buildConfigFromState's loop
    pluginEntries.push(...basePluginEntries(mpName, mp.plugins, local));

function basePluginEntries(
  mpName: string,
  plugins: Readonly<Record<string, PluginInstallRecord>>,
  local: ScopeConfig,
): Array<[string, PluginConfigEntry]> {
  return Object.entries(plugins).flatMap(
    ([pluginName, record]): Array<[string, PluginConfigEntry]> => {
      const key = `${pluginName}@${mpName}`;
      if (ownValue(local.plugins, key) !== undefined) {
        return [];
      }

      const entry = declaredEntry(record);
      return entry === undefined ? [] : [[key, entry]];
    },
  );
}

function isHeldByDependencyCheck(record: PluginInstallRecord): boolean {
  return record.dependencyDisabled === true;
}

function declaredEntry(record: PluginInstallRecord): PluginConfigEntry | undefined {
  if (isRecordedButDisabled(record) && !isHeldByDependencyCheck(record)) {
    return { enabled: false };
  }

  return record.provenance === "dependency" ? undefined : {};
}
```

The comments to add cite D-BG-801 / ENBL-05, D-BG-802 / D-04-02, D-BG-803 / LOAD-02; the `buildConfigFromState` doc comment's "Each plugin entry body is `{}` per D-04" sentence and the `basePluginEntries` comment must be updated to the new rule. The README line in `orchestrators/reconcile/README.md:63` ("Exactly three readers decide anything on it") gains `migrate-config.ts::isHeldByDependencyCheck` as a fourth reader (D-BG-803). `fallow health` and `fallow dupes` were not run on the copy; run `npm run fallow` in the task.

## State of the Art

| Old | Current (after this phase) | Impact |
| --- | --- | --- |
| Rebuild writes `{}` for every recorded plugin | `{ "enabled": false }` for a user-disabled record, `{}` for a held or enabled explicit record, nothing for an enabled dependency | a deleted config comes back as the user's commands wrote it; `pending` before the first load agrees |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
| --- | --- | --- | --- |
| A1 | Node 24 words `JSON.parse("")` as `Unexpected end of JSON input` (not observed locally) | Q6 | low: an existing unit test already pins it and CI runs Node 24; and the recommendation keeps one V8 message only |
| A2 | `fallow health` / `fallow dupes` accept the new helpers | Code Examples | low: three small flat functions; run `npm run fallow` |

## Open Questions

1. **Should the whole-text edit (CONTEXT) be kept by moving the edit scenario to the project scope with a github-source marketplace?** The source would then be a literal (`acme/<name>`), but the scenario would need the git host and a second marketplace. Recommendation: no; use the plugins step plus byte steps (Pitfall 1) and log it.
2. **Should the redaction of multi-segment schema pointers be fixed?** It is in `shared/redact-absolute-paths.ts` and read-pass step (3), not owned. Recommendation: parent note only.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node | everything | yes | 26.13.0 (default), 22.22.2 (`/usr/bin/node`) | Node 24 absent; CI runs 24 |
| Pi | cucumber | yes | 1.5.0 | -- |
| optional peer cache | cucumber `BeforeAll` | yes after `node scripts/install-test-peers.mjs` | pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, pi-dynamic-workflows 3.15.0 | -- |
| Claude Code binary | upstream check | yes | 2.1.319 | -- |

## Validation Architecture

### Test framework

| Property | Value |
| --- | --- |
| Framework | `node:test` (unit, integration), `@cucumber/cucumber` (behavior) |
| Config | `package.json` scripts, `cucumber.json` (frozen) |
| Quick run (unit pair) | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/migrate-config.test.ts` and `npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/migrate-config.ts` |
| Quick run (behavior) | `npx cucumber-js features/plugin/config-migration.feature` (adapter, default profile) |
| Full suite | `npm run check` (includes both cucumber profiles); phase gate also `npm run test:modules` |

### Requirement -> test map

| Req | Behavior | Type | Command | Exists? |
| --- | --- | --- | --- | --- |
| CFGMIG-01 | projection: user-disabled, held, dependency, user-disabled dependency | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/migrate-config.test.ts` | file yes, cases no (Wave 0 of Plan 1) |
| CFGMIG-01 | user 0.4.3 upgrade (S-U1), deleted config + disabled (S-U2), pending empty (S-U3), dependency (S-U4/S-U5) | cucumber | `npx cucumber-js features/plugin/config-migration.feature` | S-U1 yes; S-U2 to rewrite; others no |
| CFGMIG-01 | project 0.4.3 (S-P1), project pending (S-P2), `--local`-only (S-P3) | cucumber | same | no |
| CFGMIG-02 | edit survives a new session (S-U6) and `/reload` (S-U7) | cucumber | same | no |
| CFGMIG-02 | invalid base kept (S-U8), unreadable local kept and no base written (S-P4) | cucumber | same | no |
| CFGMIG-02 | never overwrite valid/invalid base (unit) | unit | owner test (existing cases "preserves an existing valid/invalid config ...") | yes |
| both | the fixed-point integration still converges | integration | `npm run test:integration` | yes (unchanged) |

### Sampling rate

- **Per task commit:** the owner unit test + direct coverage of the pair; `npx cucumber-js features/plugin/config-migration.feature`; `npm run check:features` when the feature file changes (the hook runs `check:commit`).
- **Per wave merge:** `npm run check` on the combined tree (both cucumber profiles), as a background call writing its exit code to a file.
- **Phase gate:** `npm run check` plus `npm run test:modules`, green, before verification.

### Wave 0 gaps

- [ ] New projection cases in `test/persistence/migrate-config.test.ts` (D-BG-801..803).
- None for framework or fixtures: no new step, no new support or lib file.

## Security Domain

| ASVS Category | Applies | Control |
| --- | --- | --- |
| V2/V3/V4 | no | -- |
| V5 Input validation | yes | `loadConfig` schema validation (typebox `CONFIG_VALIDATOR`), `saveConfig` re-validation before write |
| V6 Cryptography | no | -- |
| V12 Files | yes | `saveConfig` -> `assertPathInside(scopeRoot, ...)` (NFR-10) and `atomicWriteJson` (NFR-1); no new writer |

| Threat | STRIDE | Mitigation |
| --- | --- | --- |
| A load overwrites a user's config (data loss) | Tampering | ENOENT-only gate (`loadConfig` trichotomy), scenario red proofs |
| An invalid config coerced to "declares nothing" (mass uninstall) | Tampering | CFG-03 abort in read-pass step (3); unchanged |
| Absolute paths in the invalid-config cause | Information disclosure | `redactAbsolutePaths` in read-pass step (3); unchanged (it over-redacts JSON pointers, Q6) |

## Sources

### Primary (HIGH)
- Worktree source read this session: `persistence/migrate-config.ts`, `persistence/state-io.ts:75-277`, `persistence/config-io.ts:100-199`, `orchestrators/reconcile/read-pass.ts:255-460`, `orchestrators/reconcile/pending.ts:200-300`, `orchestrators/reconcile/autoapply-setting.ts:170-230`, `orchestrators/reconcile/plan.ts:420-520,660-775`, `orchestrators/plugin/{shared.ts:960-1060,install-flow-ledger.ts:900-1040,install-flow-results.ts:110-175,enable-disable.ts:2030-2100,2600-2620}`, `orchestrators/marketplace/{add.ts:600-660,1095-1160,remove.ts:500-530}`, `shared/redact-absolute-paths.ts`, `index.ts:212-250`, `test/architecture/{disabled-state-classification.test.ts,gate-targets.ts,compat-01-no-expansion.test.ts:655-680}`, `test/persistence/migrate-config.test.ts`, `test/integration/reconcile-plan-convergence.test.ts`, `features/step_definitions/{config,session,model}.steps.ts`, `features/step_definitions/plugin/installation.steps.ts:340-400`, `features/lib/{earlier-version-state,layer-config}.ts`, `features/support/world.ts` (profile Pi, TUI, turn markers).
- Pi 1.5.0 `dist/core/agent-session.js:2690-2712, 3016-3049`.
- Scratch-copy runs listed in "How this was measured".
- Claude Code 2.1.319 binary grep (`updateSettingsForSource`).

## Metadata

**Confidence breakdown:** fix and test impact HIGH (all suites run with it); scenario outputs HIGH (each run); Node 24 message MEDIUM-HIGH (inferred plus an existing CI-green unit test).
**Research date:** 2026-11-08
**Valid until:** the next merge that touches `persistence/migrate-config.ts`, `reconcile/read-pass.ts`, `shared/redact-absolute-paths.ts`, or the config steps.

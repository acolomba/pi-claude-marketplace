# Phase 8: First-Run Config Migration - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 4 (3 modified, 1 doc line; no new file, no new step module per RESEARCH Q7)
**Analogs found:** 4 / 4

All analog paths below are git-tracked (verified with `git ls-files`). Paths are relative to the worktree `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps-phase-8`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
| --- | --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/persistence/migrate-config.ts` (modify `basePluginEntries`, imports, doc comments) | persistence utility (pure projection + ENOENT-gated writer) | transform + file-I/O | itself (lines 129-196); predicate from `persistence/state-io.ts:275-277` | exact (self) |
| `test/persistence/migrate-config.test.ts` (add 4 projection cases) | test | transform | itself (fixtures lines 65-96, case shape lines 98-112) | exact (self) |
| `features/plugin/config-migration.feature` (rewrite seed 2, add S-U3..S-U8, S-P1..S-P4) | behavior test (cucumber) | event-driven (session load) | itself + `features/plugin/autoapply.feature:262-280`, `features/marketplace/background-update.feature:216-240`, `features/mcp-server/builtin-reload.feature`, `features/plugin/state-migration.feature:44-60`, `features/marketplace/hosted-relative-entry.feature:122-126`, `features/plugin/install-dependencies.feature:9-14`, `features/plugin/disable.feature:36-37` | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md` (line 63 reader list) | doc | -- | itself, line 63 | exact |

## Pattern Assignments

### `extensions/pi-claude-marketplace/persistence/migrate-config.ts`

**Current imports** (lines 23-35):
```ts
import { ownValue } from "../shared/own-key.ts";

import {
  loadConfig,
  saveConfig,
  type MarketplaceConfigEntry,
  type PluginConfigEntry,
  type ScopeConfig,
} from "./config-io.ts";

import type { ScopedLocations } from "./locations.ts";
import type { ExtensionState } from "./state-io.ts";
import type { ParsedSource } from "../domain/source.ts";
```
Add `import { isRecordedButDisabled } from "./state-io.ts";` directly under the `./config-io.ts` import with NO blank line (RESEARCH measured: a blank line between sibling value imports fails `import-x/order`). Add `PluginInstallRecord` to the `import type ... from "./state-io.ts"` line.

**Code to replace** (call site line 176 and helper lines 184-196):
```ts
    pluginEntries.push(...basePluginEntries(mpName, Object.keys(mp.plugins), local));
...
// The base config's plugin entries for one marketplace. Soft-degraded entries
// (compatibility.installable === false) appear too; only a plugin key the
// local config declares is left out (FIX-02).
function basePluginEntries(
  mpName: string,
  pluginNames: readonly string[],
  local: ScopeConfig,
): Array<[string, PluginConfigEntry]> {
  return pluginNames
    .map((pluginName) => `${pluginName}@${mpName}`)
    .filter((key) => ownValue(local.plugins, key) === undefined)
    .map((key) => [key, {}]);
}
```
Replace with the measured shape in `08-RESEARCH.md` "Code Examples" (`basePluginEntries(mpName, mp.plugins, local)` + `isHeldByDependencyCheck(record)` -> `record.dependencyDisabled === true` + `declaredEntry(record)` returning `{ enabled: false }` / `{}` / `undefined`). Keep each helper flat (two complexity gates at 15).

**Predicate to call, never re-derive** (`persistence/state-io.ts:275-277`):
```ts
export function isRecordedButDisabled(record: { readonly enabled: boolean }): boolean {
  return !record.enabled;
}
```
`test/architecture/disabled-state-classification.test.ts:41-53` rejects `!x.enabled`, `.enabled === false`, `.enabled !== true`, destructured `enabled`, `["enabled"]`, and `Boolean(...enabled)` outside `state-io.ts`. `record.dependencyDisabled === true` and `record.provenance === "dependency"` are safe.

**Doc comment to update** (lines 110-112): "Each plugin entry body is `{}` per D-04 (defaults applied at consume time)." becomes the D-BG-801/802/803 rule; also the helper comment at 184-186. Cite IDs only (D-BG-801, ENBL-05, D-BG-802, D-04-02, D-BG-803, LOAD-01), no phase refs.

**Unchanged (do not touch):** `migrateFirstRunConfig` lines 217-253 (the `existing-valid` / `existing-invalid` / `local-invalid` / `empty-state` arms are the red-proof targets of the scenarios, broken only temporarily).

---

### `test/persistence/migrate-config.test.ts`

**Imports** (lines 1-19) already include `buildConfigFromState`, `ExtensionState`, `PluginInstallRecord`; no new import.

**Fixtures to reuse** (lines 65-96):
```ts
function recordedPlugin(): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/recorded",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
  };
}

function stateRecording(pluginsByMarketplace: Readonly<Record<string, readonly string[]>>) { ... }
```
For the new cases, spread `{ ...recordedPlugin(), enabled: false }`, `{ ...recordedPlugin(), enabled: false, dependencyDisabled: true }`, `{ ...recordedPlugin(), provenance: "dependency" }`, `{ ...recordedPlugin(), provenance: "dependency", enabled: false }` into a state like `populatedState()` (lines 48-63) under `marketplaces.catalog.plugins`.

**Case shape (arrange/act/assert comments, one behavior per case)** (lines 98-112):
```ts
test("projects an empty state as a complete version-one config", () => {
  // arrange
  const state = { schemaVersion: 2, marketplaces: {} } satisfies ExtensionState;
  const expectedConfig = {
    schemaVersion: 1,
    marketplaces: {},
    plugins: {},
  } satisfies CompleteProjection;

  // act
  const config = buildConfigFromState(state, {});

  // assert
  assert.deepStrictEqual(config, expectedConfig);
});
```
Four cases: user-disabled explicit -> `{ enabled: false }`; held by dependency check -> `{}`; enabled dependency -> absent; user-disabled dependency -> `{ enabled: false }`. Check: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/migrate-config.ts`.

---

### `features/plugin/config-migration.feature`

**Background + seed 1 (keep verbatim)** (lines 7-25):
```gherkin
  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope

  Scenario: The first load after an upgrade from release 0.4.3 writes the config from the records
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user scope holds what release 0.4.3 left: its installation record and no config
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures | true       |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
```
S-P1 copies this with `--scope project`, `marketplace add {home}/marketplaces/fixtures --scope project` first, and `the project scope holds what release 0.4.3 left: ...`. For `false`, run `autoupdate` then `noautoupdate` (bare `noautoupdate` pins nothing, RESEARCH Pitfall 5).

**Seed 2 to rewrite** (lines 27-42): title -> "... writes it with a disabled plugin's enabled state"; replace the results tables with `Then the session reports no results`; plugin table becomes:
```gherkin
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
```
Its existing `will enable` result tables (lines 32-39) are the exact template for S-U6's `will disable` tables (RESEARCH "S-U6's tables").

**`pending` -> `reconcile-pending-empty`** (analog `features/marketplace/hosted-relative-entry.feature:122-126`):
```gherkin
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
```
Precede with `Given the user has started a new pi session` (S-U3, S-P2).

**Dependency publishing** (analog `features/plugin/install-dependencies.feature:9-14`):
```gherkin
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.2.0   |              |
```
S-U4/S-U5 use `the marketplace "fixtures" offers these plugins with dependencies:` with `| app | 1.0.0 | demo |` / `| demo | 1.0.0 | |` (RESEARCH Q3(g)); the Background's `offers these plugins:` is overridden by this step in-scenario.

**Invalid config report** (analog `features/plugin/autoapply.feature:269-277`):
```gherkin
    Then the session reports these results:
      | kind    | severity | needs reload | summary                      | tally label       | tally failures | tally warnings |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name          | marketplace scope | marketplace status | marketplace reasons | id                                                  | name                      | status | reasons          | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /autoapply: must be boolean | false           |       |                  |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /autoapply: must be boolean | false           |       |                  |
```
S-U8 (user base, empty doc string -> `JSON parse failed: Unexpected end of JSON input`) and S-P4 (project local, `{ "plugins": [] }` -> `schema validation failed: /plugins: must be object`) use the measured tables in RESEARCH Q3(b)/(f). Never a multi-segment pointer (redaction, Pitfall 4).

**Writing a layer's raw text + byte check** (analog `features/marketplace/background-update.feature:225-240`):
```gherkin
    Given a config in scope project and layer local, with this text:
      """
      { "schemaVersion": 1,
      """
    ...
    Then the "claude-plugins.local.json" file of the project scope holds this text:
      """
      { "schemaVersion": 1,
      """
```
Raw text only works where no `{home}` path is needed (local layer in S-P4, empty base in S-U8). For the user edit (S-U6/S-U7) use `a config in scope user and layer base, with these plugins:` (analog `features/plugin/autoapply.feature:262-264`):
```gherkin
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
```

**Byte snapshot steps** (analog `features/plugin/state-migration.feature:46-60`):
```gherkin
    Given the config and installation record bytes of the user scope are remembered
    ...
    Then the config and installation record bytes of the user scope are unchanged
```
Not usable when `claude-plugins.json` is absent (S-P4); use `holds this text:` on the local file plus `the "claude-plugins.json" file of the project scope does not exist`.

**`--local` project install** (analogs `features/marketplace/autoupdate.feature:245`, `features/plugin/disable.feature:36`):
```gherkin
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
```
S-P3/S-P4 use `{home}/marketplaces/fixtures`, then assert `the "claude-plugins.json" file of the project scope does not exist` and `the "claude-plugins.local.json" file of the project scope declares these plugins:` (`| id |` / `| demo@fixtures |`).

**Terminal reload** (analog `features/mcp-server/builtin-reload.feature:15-23`):
```gherkin
    Given pi runs with the scripted model and the mcp implementation
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      ...
    When the user reloads pi in the terminal and then prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
```
S-U7 uses the plain variants (`pi runs with the scripted model`, a one-row `| reply |` / `| Done. |` script, `Then the model receives these calls:` with `| 1 | user | hello |`); full measured scenario in RESEARCH Q4. The analog is `@builtin-only`; S-U7 must carry no tag (D-BG-808). A turn must be compared or the world fails the scenario.

**Skill still offered** (analog `features/plugin/disable.feature:30-32`):
```gherkin
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
```

---

### `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`

Line 63 (the `dependencyDisabled` bullet) reads "Exactly three readers decide anything on it: `plan.ts::isAlreadyDependencyDisabled`, ...; `dependency-verdict.ts::isDisabledIndependently`, ...; and `plan.ts::buildDependencyDisabledLift` (D-09-08), ...". Change "three" to "four" and add `persistence/migrate-config.ts::isHeldByDependencyCheck`, which writes a held record `{}` so the rebuilt config keeps the hold liftable (D-BG-803). Keep the sentence's existing `--`/semicolon style. Markdown is formatted by mdformat, not Prettier.

## Shared Patterns

### Disabled-state predicate (ENBL-05)
**Source:** `extensions/pi-claude-marketplace/persistence/state-io.ts:275-277`
**Apply to:** `migrate-config.ts` only. Do not add `migrate-config.ts` to `test/architecture/gate-targets.ts` `DISABLED_STATE_TARGETS` (unowned, optional).

### Doubled load payloads
**Source:** `features/plugin/config-migration.feature:33-39`, `features/plugin/autoapply.feature:269-277`
**Apply to:** every `the session reports these results:` / `the results list these marketplaces and plugins:` table: each row appears twice.

### Steps
**Source:** `features/step_definitions/config.steps.ts` (frozen), `plugin/installation.steps.ts`, `session.steps.ts`
**Apply to:** all scenarios. No new step module (RESEARCH Q7).

## No Analog Found

None.

## Metadata

**Analog search scope:** `features/**/*.feature`, `extensions/pi-claude-marketplace/persistence/`, `test/persistence/`, `orchestrators/reconcile/README.md`
**Files scanned:** ~15
**Pattern extraction date:** 2026-11-08

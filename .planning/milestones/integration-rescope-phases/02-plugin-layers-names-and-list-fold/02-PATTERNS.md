# Phase 2: Plugin Layers, Names, and List Fold - Pattern Map

**Mapped:** 2026-11-21
**Files analyzed:** 17 (11 modified feature/test/source files, 1 new feature, 3 deleted integration files, 1 trimmed integration file, 1 SUMMARY convention)
**Analogs found:** 17 / 17

All analogs below are git-tracked source. No step module, `features/lib/**`, or support file changes (RESEARCH: "Missing steps: none required").

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/plugin/install.feature` (+2 LAYER-04 scenarios) | test (behavioral) | request-response | `features/plugin/reinstall.feature:15-33` (layer refusal row shape) | exact |
| `features/plugin/uninstall.feature` (+2) | test | request-response | `features/plugin/uninstall.feature:58` (`--local` layer refusal) | exact |
| `features/plugin/enable.feature` (+2) | test | request-response | `features/plugin/enable.feature:14` | exact |
| `features/plugin/disable.feature` (+2) | test | request-response | `features/plugin/disable.feature:14` | exact |
| `features/plugin/update.feature` (+2) | test | request-response | `features/plugin/update.feature:158` | exact |
| `features/plugin/reinstall.feature` (+2) | test | request-response | `features/plugin/reinstall.feature:15` | exact |
| `features/plugin/configuration.feature` (+C02,C03,C04,C06,C07,C08) | test | request-response (apply) | `features/plugin/configuration.feature:61` / `:99` | exact |
| `features/plugin/config-migration.feature` (+C05) | test | request-response (pending) | `features/plugin/configuration.feature:61` (pending envelope) + `config-migration.feature:163` | exact |
| `features/plugin/reserved-names.feature` (NEW) | test | request-response | `features/marketplace/reserved-name.feature` | exact (counterpart) |
| `features/plugin/list.feature` (+F01, F03) | test | request-response | `features/plugin/list.feature:157` | exact |
| `test/integration/plugin-layer-verbs.test.ts` (trim to 2 LAYER-06) | test (integration) | file-I/O | itself, lines 406-480 (the kept cases) | self |
| `test/integration/plugin-layer-consistency.test.ts` | — | — | DELETE | n/a |
| `test/integration/reserved-record-keys.test.ts` | — | — | DELETE | n/a |
| `test/integration/fold-adoption.test.ts` | — | — | DELETE | n/a |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:546` (comment) | service comment | — | surrounding JSDoc `:543-548` | self |
| `test/orchestrators/plugin/list-flow.test.ts:15`, `:2187` (comments) | test comment | — | surrounding header `:13-17`, `:2185-2189` | self |
| `02-0N-SUMMARY.md` (each plan) | doc | — | `.planning/phases/01-duplicate-integration-files/01-01-SUMMARY.md` (frontmatter `key-files.deleted`, `## Red proofs` at `:103`) | exact |

## Pattern Assignments

### LAYER-04 refusals in the six verb files (ITMIG-01)

**Analog:** `features/plugin/reinstall.feature` (Background `:7-13`, scenario `:15-33`). The same envelope and 11-column row table is used for every verb's refusal.

Background already used by update/reinstall (installs `demo` in the base layer, so these files need plain scenarios per direction, not a two-row Outline — RESEARCH Pitfall 1):
```gherkin
  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
```

Refusal row shape to copy (`reinstall.feature:16-24`), substituting the CFG-03 reason and cause:
```gherkin
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | cause chain | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | ...     | project | ...         | false           |       |                  |
```
CFG-03 values (RESEARCH, verified): `reasons` = `invalid manifest`; `cause chain` = `Config file "claude-plugins.local.json" failed schema validation.` (target base) or `Config file "claude-plugins.json" failed schema validation.` (target local).

Setup / "changes nothing" steps (all exist; `config.steps.ts:195,171,241,257,250`, `plugin/installation.steps.ts:451`):
```gherkin
    Given a config in scope project and layer local, with this text:
      """
      { not json
      """
    Given the config and installation record bytes of the project scope are remembered
    ...
    Then the config and installation record bytes of the project scope are unchanged
    Then the "claude-plugins.local.json" file of the project scope holds this text:      # target base only
    Then the "claude-plugins.local.json" file of the project scope declares these plugins: # target local ({home} path, never holds-this-text)
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |
```
- Remembered bytes cover only base config + `state.json` (Pitfall 2): always add a local-layer check.
- Enable: `disable … <flag>` first; Update: republish with `offers these plugins:` at 1.1.0 first.
- Enable scenario stages nothing for the disabled plugin: install a second enabled plugin so the staged table has a row (avoids a new step).
- Titles: verb-first, decision ID in parentheses, e.g. `Installing a plugin fails as an invalid manifest and changes nothing when the local config cannot be read (LAYER-04, CFG-03)`. Keep each new scenario next to the file's existing `--local` layer refusals (`uninstall.feature:58`, `enable.feature:14`, `disable.feature:14`, `update.feature:158`, `reinstall.feature:15`; install has none — place after `install.feature:141`).

---

### `features/plugin/configuration.feature` (C02, C03, C04, C06, C07, C08)

**Analog:** `features/plugin/configuration.feature:61-78` (local-gap invalid config under `pending`).

Background (`:7-11`) offers only `demo`; each new scenario republishes `demo` + `other` with `the marketplace "fixtures" offers these plugins:`. Rows read `fixtures` where RESEARCH drafts say `mp`.

Envelope + gap row to copy, switching the When to `/claude:plugin apply --scope project` and the kind/tally to the apply forms (`reconcile-applied-cascade`, tally label `Reconcile`):
```gherkin
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile pending              |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name          | marketplace scope | id                                                  | name                      | status | reasons          | scope   | cause chain | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | The local config (claude-plugins.local.json) declares demo@fixtures, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config. | false | | |
```
Config writes: `a config in scope project and layer local, with these plugins:` (`| marketplace | plugin | enabled |`; empty marketplace cell gives key `demo@` for C06). C04 legacy bytes: `with this text:` `{"schemaVersion":1,"plugins":{"demo@fixtures":{}}}` then `holds this text:`. C02 uses `--scope user` and installs `other` first so `state.json` exists. Per-case rows/envelopes: RESEARCH ITMIG-02 table and `probe/consistency.feature`.

---

### `features/plugin/config-migration.feature` (C05)

**Analog:** `config-migration.feature:163` ("A load reports an unreadable local config and writes no project config") for placement; envelope from `configuration.feature:66-77` above (tally `Reconcile pending`). Setup step `the user has deleted the config files of the project scope` (`config.steps.ts:206`); assert `Then the "claude-plugins.json" file of the project scope does not exist`. Background publishes only `fixtures`; the scenario offers and adds itself.

---

### `features/plugin/reserved-names.feature` (NEW, ITMIG-03)

**Analog:** `features/marketplace/reserved-name.feature` (lines 1-40).

Feature header pattern (title must kebab to `plugin-reserved-names`, `scripts/check-features.mjs:369-372`):
```gherkin
Feature: Marketplace reserved name

  Claude Code reserves the names of its official marketplaces ...
  ... Object.prototype member names. Local
  marketplaces and the loopback https git host stand in for the sources a user
  can add.

  Scenario Outline: Adding a marketplace whose manifest declares a reserved name fails with Claude Code's refusal
    Given the marketplace "claude-plugins-official" is published as a <source kind> source
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      ...
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist
```
- Description paragraph cites D-08-07 and D-PL5-28.
- No Background (Pitfall 6: `hello@constructor` and `__proto__` scenarios do not use `mp`); each scenario publishes what it needs.
- Verified `__proto__` install-refusal scenario to copy verbatim: RESEARCH "Code Examples" (lines 285-308).
- Absent-name cases: two Scenario Outlines with 4 rows each (meets the 3+ variant rule), shapes in RESEARCH ITMIG-03 table.
- "records nothing": `the project scope holds no marketplace record` / `holds no marketplace checkout` (`marketplace/checkout.steps.ts:59,45`).
- Import: `the claude code settings file of the project scope holds this text:` (`claude-code-settings.steps.ts:34`, expands `{home}`).
- No implementation tag (no MCP surface; builtin selects 0, DUAL-02).

---

### `features/plugin/list.feature` (F01, F03, ITMIG-04)

**Analog:** `features/plugin/list.feature:157-181`:
```gherkin
  Scenario: The project scope filter lists a user marketplace from the project scope when a project installation added it
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | kilo | 1.0.0   |
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install kilo@extras --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 3           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status    | reasons | scope   | version |
      | extras           | project           | kilo@extras | kilo | installed |         | project | 1.0.0   |
```
F01/F03 run unfiltered `/claude:plugin list` and list every row (complete output). F03 uses `the marketplace "team" publishes this manifest:` (`marketplace/publishing.steps.ts:182`) with `"name": "official"`, then `marketplace add {home}/marketplaces/team --scope project`. Titles cite `(CMC-21, D-13-17)`. Place after `:182` (the other cross-scope scenarios).

---

### `test/integration/plugin-layer-verbs.test.ts` (trim, keep LAYER-06 `:414`, `:446`)

**Analog:** itself. Kept cases use `installedScope`, `request`, `operations().install`, `forgetRecordedSource` (`:406-412`), `declarations` (`:309-312`), `scopeFiles`, `layerConfigs`, `readIfPresent`, `pathExists`, `createNotificationBoundary`, `createHermeticEnvironment`, `addMarketplace`, `locationsFor`, `createCompletionCache`, `createHooksRouting/createHooksRuntime/readHooksJson`, `runWithNothingLoaded`.

Remove: both LAYER-08 tests (`:322`, `:359`), `DIRECTIONS` (`:194`), `NAMED_VERBS`/`NamedVerb` (`:222`), the LAYER-04 loop (ends `:306`), `invalidLayerRow` (`:273`), `baseDeclaresApp` (`:315`), the `extra` param of `installedScope` (`:142-167`; boundary count becomes fixed `2`), `Operations` type if unused, and `operations()` members other than `install` (`:92-112`). Drop imports `createEnableOperation`, `createReinstallOperation`, `createUninstallOperation`, `createNodeReinstallPlugins`, `createReinstallPlugin`, `createPluginUpdateOperations`, `loadState`, and `mkdir` if `publish` no longer needs it (check). `PLUGINS` (`:52-57`) can shrink to `alpha`. Rewrite header `:1-11` to describe only LAYER-06 (keep the `// test/integration/<file>` first-line form). `noUnusedLocals` + ESLint `no-unused-vars` will flag leftovers.

---

### Stale `fold-adoption` comments

- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:546` — inside JSDoc `Regressions:\n * test/integration/fold-adoption.test.ts and the "CR-01 / G-21-01 fold-carryover" case ...`. Replace the path with `features/plugin/list.feature` (cite CMC-21 / D-13-17, no phase refs). Editing this file triggers its direct-coverage pair in the hook.
- `test/orchestrators/plugin/list-flow.test.ts:15` — `(rendered cross-scope, but the adoption round-trip lives in \`test/integration/fold-adoption.test.ts\`)`.
- `test/orchestrators/plugin/list-flow.test.ts:2187` — `// test/integration/fold-adoption.test.ts step 2 (CMC-21 step 2).`

---

### Plan SUMMARY convention

**Analog:** `.planning/phases/01-duplicate-integration-files/01-01-SUMMARY.md`
- Frontmatter `key-files: { created: [], modified: [], deleted: [test/integration/...] }` (`:25-29`); `tech-stack.patterns` names the deliberate-break helper (`:23`); `key-decisions` records the fallow `weakened-tests` warn left to the milestone (`:33`).
- `## Red proofs` (`:103-120`): scratch folder `$D`, worktree root (each log's first line `root=`), detector set, baseline adapter run count, builtin "0 selected (DUAL-02)", then one bullet per break: edit, command, failing `  N) <title> # <file>:<line>` lines.
- Required `## Threat Flags` section (AGENTS.md). Last plan lists "Parent lines".

## Shared Patterns

### Result checks (every When with rows)
**Source:** `features/step_definitions/command.steps.ts:158,166`. Every When needs `the result has these fields:` and the full `the result lists these plugins:` table, or the World After hook fails (`features/support/world.ts:1294`).

### Deliberate break helper
**Source:** RESEARCH "Code Examples" (lines 312-320) and 01-01-SUMMARY pattern: one exact `python3` replacement, `trap "git checkout -- $F" EXIT`, run adapter profile with `--parallel 2` (or 1), `git status --porcelain -- extensions/` empty, grep `^  [0-9]+\) .* # features/plugin/<file>\.feature:[0-9]+$`. Break sites B1-B13, B6b: RESEARCH table lines 214-229.

### Tags
No implementation tag on any new scenario; `check:features` fails on unneeded tags.

## No Analog Found

None.

## Metadata

**Analog search scope:** `features/plugin/`, `features/marketplace/`, `features/step_definitions/plugin/`, `test/integration/`, `test/orchestrators/plugin/`, `orchestrators/plugin/list-flow.ts`, `.planning/phases/01-*`
**Files scanned:** 16
**Pattern extraction date:** 2026-11-21

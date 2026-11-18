---
phase: 10-plugin-options-variables-and-trust
plan: "07"
subsystem: persistence
status: complete
tags: [user-config, options, install-record, restage]
requires: ["10-05"]
provides:
  - "the optional install record field userConfig, the declared schema only, with no schemaVersion bump"
  - "userConfigFieldsOf, the one producer of the field (deep copy, no field when undeclared)"
  - "replaceUserConfig, the set-or-remove write of the producer's fields"
  - "the field at the install state phase, the update and reinstall write, the disabled refresh, and the load-time MCP move"
  - "the step: the installation record of the {word} scope holds these options of {string}:"
affects: [10-08, 10-10, 10-14, 10-20]
tech-stack:
  added: []
  patterns: ["optional additive record field after mcpServerConfigs", "one producer plus a replacer that takes its fields"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - features/step_definitions/plugin/installation.steps.ts
    - features/plugin/install.feature
    - features/plugin/reinstall.feature
    - test/persistence/state-io.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/architecture/compat-01-no-expansion.test.ts
decisions:
  - "The stored userConfig is Type.Unknown() on the record schema, so a hand-edited value never fails the whole state load; plan 10-08's reader validates it again."
  - "apply.ts needed no change: PIN_FIELDS derives from DISABLED_PIN_FIELDS, so the restore follows the new field."
metrics:
  duration: "~20 min"
  completed: 2026-11-15
actuals:
  tokens: 10800
  tasks: 2
  commits: 2
plan_head_before: 993d94bd491bf71bae47dcd35f9e0c7636df2cdb
plan_head_after: d30b4037df58d4b0d04335d57c3d8de0bae173cc
---

# Phase 10 Plan 07: Record a plugin's declared options Summary

Each install record now holds the plugin's declared `userConfig` schema in an optional `userConfig` field, with no `schemaVersion` bump. The field is present only when the plugin declares options. One producer, `userConfigFieldsOf`, writes it at every site that writes `mcpServerConfigs`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Record a plugin's declared options at install | 224ee95d | state-io.ts, install-outcome.ts, installation.steps.ts, install.feature, three tests |
| 2 | Keep the recorded options current at each restage | d30b4037 | update-swap.ts, update-preflight.ts, mcp-migration.ts, state-io.ts, reinstall.feature, five tests |

## Red then green

- Task 1, scenario red: "An install records the options a plugin declares (D-PG10-23)" failed at `Then the installation record of the project scope holds these options of "demo@fixtures":`. The record had no options, so the table had only its header row. 1 scenario (1 failed), 10 steps (9 passed, 1 failed). After that I added the `Then the result lists these plugins:` step, because the world's After hook fails a scenario that leaves result rows unchecked.
- Task 1, owner red: `test/persistence/state-io.test.ts` failed to load (`does not provide an export named 'userConfigFieldsOf'`). In install-outcome.test, two D-PG10-23 cases failed (copy, empty object). 106 tests, 3 failed.
- Task 1, green: the scenario gave 1 scenario (1 passed), 11 steps (11 passed). state-io, install-outcome, install-flow-ledger, and compat-01 tests gave 508 pass. Direct coverage of state-io.ts and install-outcome.ts, `typecheck`, `fallow`, and `check:features` exited 0. The hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario red: "A reinstall records the options the plugin declares now (D-PG10-15)" failed at the options `Then`, with the actual value `fast` where `slow` was expected. 1 scenario (1 failed), 15 steps (14 passed, 1 failed).
- Task 2, owner red (`--test-name-pattern=D-PG10`, 9 cases): 4 failed. These were the swap that records the new options, the swap that removes them, the disabled refresh of an options-only change, and the move that records options beside servers. Five cases passed at HEAD because nothing wrote the field yet: the failed swap, the disabled refresh that removes, the move past the record's version, and the two `apply` restore cases.
- Task 2, restore guard: in the working tree only, I removed `userConfig` from `PIN_FIELDS` in `reconcile/apply.ts`. Both D-PG10 `apply` cases then failed (2 tests, 2 failed). `git checkout` restored the file, and `git diff --quiet` confirmed the restore.
- Task 2, green: the scenario gave 1 scenario (1 passed), 15 steps (15 passed). The seven owner and caller tests (update-swap, update-preflight, mcp-migration, apply, update-flow, reinstall-flow, state-io) gave 1237 pass. enable-disable, materialize-latest, and convergence gave 326 pass. Direct coverage of the five sources exited 0. `test:cucumber:profile -- --profile adapter` on install, reinstall, and legacy-move gave 58 scenarios (58 passed). `check:features`, `typecheck`, `fallow`, and ESLint on the changed files exited 0. The hook passed `check:commit`.

## Lines for later plans

- Record field: `userConfig?: unknown` on `PluginInstallRecord` (`Type.Optional(Type.Unknown())`). It is present only when the plugin declares `userConfig`, and `userConfig: {}` is stored as `{}`. It holds the declared schema and never a value a user typed.
- Producer: `userConfigFieldsOf(declared: UserConfigSchema | undefined): Pick<PluginInstallRecord, "userConfig">` in `persistence/state-io.ts`. It returns `{}` when the plugin declares nothing. Otherwise it returns `{ userConfig }` as a deep copy, and a `__proto__` key stays an own key.
- Replacer: `replaceUserConfig(record, fields)` deletes the field and assigns the producer's fields.
- The commands that refresh the recorded schema: `install`, `update` to a new version and `reinstall` (`update-swap.ts::applyAllSuccessRecordFields`), the refresh of a disabled plugin (`update-preflight.ts::refreshDisabledRecord`, which an `update` of a disabled plugin and `apply`'s deferred enable reach), and the load-time AMIG-01 MCP move (`mcp-migration.ts::applyNeutralVerdict`, for a legacy record whose recorded servers can be read). A disable then enable restages through the install ledger. `apply` restores the field when a deferred enable fails.
- New step: `the installation record of the {word} scope holds these options of {string}:`. Its first column is `option`, and each other header names an option field. A cell is the field's string, or its JSON when the field is not a string, and empty when the option lacks it. The step fails on an option field that the header does not name, and on a missing plugin.

## Parent-owned lines requested

- PG-CORE-03: the record half of the option schema is done. Plans 10-08 to 10-19 deliver it to readers, so do not mark the requirement complete yet.
- STATE.md decision: "The install record holds the declared userConfig schema in an optional field with no schemaVersion bump, written through userConfigFieldsOf at install and at each restage (D-PG10-23)."

## Deviations from Plan

1. **[Rule 3 - Blocking] `test/architecture/compat-01-no-expansion.test.ts` is outside the plan's file list.** It pins the exact key set of `PluginInstallRecord`, so `typecheck` failed until I added `"userConfig"` and one comment line. This happened in the Task 1 commit.
2. **A second export, `replaceUserConfig`.** Three writers set or remove the field on an existing record: the swap, the refresh, and the move. Each one passes it the producer's fields, so every value still comes from `userConfigFieldsOf`.
3. **The reinstall scenario uses a second plugin, `opt`.** The feature's Background installs `demo` with no options. A separate plugin lets the scenario install it with `fast` first.
4. **`reconcile/apply.ts` is not changed.** Its restore follows `DISABLED_PIN_FIELDS`. The working-tree guard above shows that the two new `apply` cases catch a restore that leaves the field out.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-19: `userConfig` is in `DISABLED_PIN_FIELDS` and in its projection. Owner cases cover an options-only change, its removal, the `apply` restore, and the move. T-10-43: every write goes through `userConfigFieldsOf`, which copies from the parsed `declaredUserConfig`. Owner cases change the resolution after the write and store `__proto__` as an own key. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/persistence/state-io.ts, features/plugin/install.feature, features/plugin/reinstall.feature
- FOUND: 224ee95d, d30b4037 (ancestors of HEAD)

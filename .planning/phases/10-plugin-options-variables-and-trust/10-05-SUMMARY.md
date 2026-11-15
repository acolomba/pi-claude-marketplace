---
phase: 10-plugin-options-variables-and-trust
plan: "05"
subsystem: domain
status: complete
tags: [user-config, options, resolver, completion-cache, reasons]
requires: ["10-02"]
provides:
  - "resolveStrict parses userConfig: all defaults installable, required with no default partially-available, malformed unavailable"
  - "declaredUserConfig on the materializable arms"
  - "USER_CONFIG_MALFORMED_NOTE and USER_CONFIG_UNSET_NOTE with prefix arms in both reason classifiers"
  - "plugin index schemaVersion 8"
affects: [10-06, 10-07, 10-08, 10-16, 10-19, 10-20]
tech-stack:
  added: []
  patterns: ["entry-or-manifest rule of mcp-resolution reused for options", "Type.TUnsafe<T> for a type-only field whose schema is private to its module"]
key-files:
  created:
    - features/plugin/options.feature
  modified:
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/domain/unsupported-components.ts
    - extensions/pi-claude-marketplace/domain/components/plugin.ts
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - test/domain/plugin-resolver.test.ts
    - test/domain/resolver-types.test.ts
    - test/domain/unsupported-components.test.ts
    - test/shared/completion-cache.test.ts
    - test/shared/probe-classifiers.test.ts
    - test/orchestrators/plugin/install.messaging.test.ts
    - test/architecture/cross-surface-reason-parity.test.ts
decisions:
  - "A malformed userConfig is structural: resolveUserConfig returns a flag that resolveStrict ORs into the structural flag, so decideResolution gives unavailable."
  - "The malformed note keeps the parser's full detail; no truncation."
metrics:
  duration: "~70 min"
  completed: 2026-11-15
actuals:
  tokens: 11800
  tasks: 2
  commits: 3
plan_head_before: 8a4149650cf7c79f754ac355f80c60267fabc916
plan_head_after: 6b90aa5c
---

# Phase 10 Plan 05: Resolver arms and completion cache Summary

`resolveStrict` now parses `userConfig` instead of counting it as an unsupported kind. A plugin whose options all have a default installs without `--partial`. A required option with no default keeps the plugin partially available. A malformed `userConfig` makes the plugin unavailable with `invalid manifest`, also with `--partial`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Install a plugin whose options all have a default without --partial | 5403fb88 | plugin.ts, unsupported-components.ts, plugin-resolver.ts, resolver-types.ts, completion-cache.ts, probe-classifiers.ts, four tests, options.feature |
| 2 | Make a malformed userConfig unavailable and classify both option notes by prefix | 6b90aa5c | plugin-resolver.ts, probe-classifiers.ts, install.messaging.ts, four tests, options.feature |

## Red then green

- Task 1, scenario red: "A plugin whose options all have a default installs without --partial (PG-CORE-03)" failed at `Then the result has these fields:`. Actual was `severity error`, `needs reload false`, `summary A plugin operation has failed.`. The plugin was refused as partially available. 1 scenario (1 failed), 11 steps (8 passed, 2 skipped, 1 failed).
- Task 1, owner red: 294 tests, 30 failed. These were the seven `resolveStrict userConfig` cases, the two D-PG10-04 unsupported-kinds cases, and every cache case that pins version 8. `npm run typecheck` exited 2: `declaredUserConfig` does not exist on the resolution type.
- Task 1, green: the scenario gave 1 scenario (1 passed). The six owner tests gave 390 pass, 0 fail. Direct coverage of the six sources exited 0. `typecheck`, `check:features`, ESLint on the changed files, and fallow dead-code, health, and dupes all exited 0. The commit hook passed `check:commit`. The tracer gate is green.
- Task 2, scenario red: "A plugin whose option has no title is unavailable (PG-CORE-03, D-PG10-20)" failed at `Then the result lists these plugins:`. Actual was `partially-available`, `unsupported component`, `partial-install`. "Installing a plugin with a malformed option with --partial is refused too (D-PG10-05)" failed at `Then the result has these fields:`. Actual was `severity info` and `needs reload true`: it installed. 3 scenarios (1 passed, 2 failed).
- Task 2, owner red: 383 tests, 18 failed. These were the resolver malformed cases, the classifier cases on both surfaces, and five parity rows.
- Task 2, green: `test:cucumber:profile -- --profile adapter` on options.feature and partial-install.feature gave 7 scenarios (7 passed). The five owner tests, info.test included, gave 674 pass. The caller tests (list-flow, list-candidate-row, fetch, update-preflight, mcp-migration) and `test/architecture/**` gave 1219 pass. Direct coverage of the three sources exited 0. `typecheck`, `check:features`, ESLint, and fallow exited 0. The hook passed `check:commit`.

## Lines for later plans

- Resolution member: `declaredUserConfig?: UserConfigSchema` on both materializable arms. It is present only when the plugin declares `userConfig`, by the entry-or-manifest rule. `userConfig: {}` gives `{}`. The unavailable arm never has it.
- Malformed note: `USER_CONFIG_MALFORMED_NOTE = "malformed userConfig"`, written as `malformed userConfig: <parser detail>`. Example: `malformed userConfig: userConfig option "mode": field "title" is missing, field "description" is missing`.
- Unset note: `USER_CONFIG_UNSET_NOTE = "required userConfig options have no default"`, written as `required userConfig options have no default: token, region`. The keys are in declaration order.
- Kind: `userConfig` is pushed once to `unsupported` by the unset arm. Today `narrowUnsupportedKinds(["userConfig"])` gives `unsupported component`. Plan 10-06 owns its own `kindToReason` arm and token. On the structural arm, the unset note classifies `unsupported source`. With `partialable`, it classifies as `narrowUnsupportedKinds(["userConfig"])`.
- `ResolverNoteReason` now includes `invalid manifest`.
- The stage is `resolveUserConfig(entry, manifest, partial): boolean` in `domain/plugin-resolver.ts`. `resolveStrict` calls it after `runStructuralStages`.
- Plugin index cache: `schemaVersion` 8. The adjacent-version case (D-PG10-24) proves that a version 7 file and a version 9 file are each dropped and rebuilt.

## Parent-owned lines requested

- `.agents/skills/claude-code-compat-research/SKILL.md` line 43 lists `userConfig` among the kinds this project does not bridge. Remove `` `userConfig`, `` from that list. After the change, the line starts: "Kinds this project deliberately does not bridge -- `lspServers`, `monitors`, `themes`, `outputStyles`, `channels`, `settings`, `syntaxHighlighting`, `mod` (...)". The rest of the line does not change.
- PG-CORE-03: the install half of success criterion 1 is done. The hook half is plans 10-08 and 10-16, so do not mark the requirement complete yet.
- STATE.md decision: "A malformed userConfig is structural: the plugin is unavailable with invalid manifest, and --partial does not admit it (D-PG10-05)."

## Deviations from Plan

1. **[Rule 3 - Blocking] `USER_CONFIG_MALFORMED_NOTE` landed in Task 2, not Task 1.** In Task 1 the constant had no consumer, so fallow dead-code would have failed the commit hook. Task 2 added it together with its consumers.
2. **[Rule 2 - Correctness] The Task 1 commit kept today's refusal of a malformed `userConfig`.** The interim stage pushed `contains userConfig` and the kind, so no install that is refused today was admitted between the two commits. An interim owner case, "a malformed userConfig never resolves installable", covered that branch. Task 2 replaced it.
3. **`classifyResolverReason` got a helper, `userConfigNoteReasons`.** With both arms inline, fallow health measured cognitive complexity 16, above 15. The helper keeps the arms in the same position.
4. **The Task 2 scenarios have no `hint` column.** `recordTable` adds every field that a row has. A row with no hint has no `hint` column, so a missing column asserts that there is no `--partial` hint. In the red run, the same table without the column would have shown `partial-install`.
5. **`domain/components/plugin.ts` uses a separate `USER_CONFIG_FIELD` bag.** Both schemas spread it. `test/domain/components/plugin.test.ts` needed no change, because `deepStrictEqual` ignores key order.
6. **The audit note in `unsupported-components.ts` has no date.** It says that the last audit read the Claude Code 2.1.323 binary. I did not read the binary myself, so I did not state a date.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-12: the malformed arm feeds the structural flag. The resolver owner case proves that `requirePartialInstallable` throws, and the `--partial` scenario proves the refusal on install. T-10-13: the stage reads the entry's `userConfig` only when there is no `plugin.json`. Owner cases cover both sides, including a malformed entry value that is ignored when a `plugin.json` exists. T-10-14: both classifiers match the two exported prefixes with `startsWith` before their substring arms. Owner cases use the keys `lspServers` and `source`, and the parity test compares the surfaces. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: features/plugin/options.feature
- FOUND: 5403fb88, 6b90aa5c (ancestors of HEAD)

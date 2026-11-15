---
phase: 10-plugin-options-variables-and-trust
plan: "06"
subsystem: notifications
status: complete
tags: [user-config, options, reasons, info, catalog]
requires: ["10-05"]
provides:
  - "the closed reason `options not set`, at the tail of every vocabulary home"
  - "kindToReason maps the kind `userConfig` to `options not set` on install, list, and info"
  - "the info advisory line that names the unset required option keys"
affects: [10-07, 10-20]
tech-stack:
  added: []
  patterns: ["a reason token rides the row and the keys ride one info note, as a dropped MCP server's feature rides the info breakdown"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - schema/claude-plugin.schema.json
    - docs/output-catalog.md
    - docs/json-output.md
    - features/plugin/options.feature
    - test/shared/probe-classifiers.test.ts
    - test/shared/notify-reasons.test.ts
    - test/shared/notification-wire.test.ts
    - test/shared/notification-types.test.ts
    - test/orchestrators/plugin/install.messaging.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/architecture/notify-closed-set-locks.test.ts
    - test/architecture/compat-01-no-expansion.test.ts
    - test/architecture/cross-surface-reason-parity.test.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-install.ts
    - test/architecture/catalog-uat/fixtures/plugin-list.ts
    - test/architecture/catalog-uat/fixtures/plugin-info.ts
decisions:
  - "The reason token is `options not set`; it appends after `requires builtin mcp`, so Reason holds 81 members."
  - "The info line has a singular and a plural form, quotes each key, and comes after every other note."
metrics:
  duration: "~45 min"
  completed: 2026-11-15
actuals:
  tokens: 14500
  tasks: 2
  commits: 2
plan_head_before: 8c993ecde09d5cd779d674df28b92a136877f9a4
plan_head_after: 00a9f9c8
---

# Phase 10 Plan 06: The options not set reason and the info line Summary

A plugin with a required option that has no default now reads `{options not set}` on install, `list`, and `info`, not `{unsupported component}`. Without `--partial` the install refuses it with the `--partial` hint. With `--partial` it installs as `partially-installed`. `info` adds one note that names each unset option key, in declaration order.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Refuse a plugin with an unset required option under the reason options not set | 1618576f | 4 shared sources, wire schema, 2 docs, options.feature, 14 tests and fixtures |
| 2 | Install such a plugin with --partial and list its unset options in info | 00a9f9c8 | info.ts, info.test.ts, options.feature, plugin-info fixture, catalog-contract counter, output-catalog.md |

## Red then green

- Task 1, scenario red: "A plugin with a required option that has no default is refused without --partial (PG-CORE-03)" failed at `Then the result lists these plugins:`. The `reasons` cell read `unsupported component`, not `options not set`. 1 scenario (1 failed), 11 steps (9 passed, 1 skipped, 1 failed).
- Task 1, owner red (product sources at HEAD, tests changed): `npm run typecheck` exited 2 with 8 errors: `"options not set"` is not a `ContentReason` (the three fixtures), not a key of `Record<Reason, true>` (locks), not an `UnsupportedReason`, and the two `IsExact` order proofs failed. The six owner test files gave 309 tests, 6 failed: the parity row for `userConfig`, the two install.messaging cases, the wire case, and the two probe-classifier cases.
- Task 1, green: the scenario gave 1 scenario (1 passed), 11 steps (11 passed). The five owner files gave 279 pass, 0 fail. `npm run test:architecture` exited 0. Direct coverage of the four shared sources exited 0. `npm run typecheck` exited 0, and the Markdown hooks passed after one mdformat rewrite. The caller tests (list-flow, list-candidate-row, list-installed-row, info, fetch, update-preflight, update-row, enable-disable.messaging, reinstall.messaging, list.messaging, install-cascade.messaging, notification-resolve, soft-dep, reconcile notify) gave 1177 pass, 0 fail. The hook passed `check:commit`. The tracer gate is green.
- Task 2, info scenario red: "Info names the required options of a plugin that are not set (D-PG10-06)" failed at `Then the result has these fields:`. The row had no `plugin notes` field. The `--partial` scenario passed. 2 scenarios (1 passed, 1 failed), 20 steps (19 passed, 1 failed).
- Task 2, `--partial` guard: with `partial.unsupported.push("userConfig")` removed from `domain/plugin-resolver.ts` in the working tree, "A plugin with an unset required option installs with --partial as partially installed (D-PG10-06)" failed at `Then the result lists these plugins:`. It read `installed` with no reason. 1 scenario (1 failed). `git checkout` restored the file, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace/domain` exited 0.
- Task 2, owner red: the five D-PG10-06 info cases gave 3 pass, 2 fail. The two that name keys lacked the `note:` line.
- Task 2, green: `test:cucumber:profile -- --profile adapter` on options.feature, info.feature, and partial-install.feature gave 25 scenarios (25 passed), 258 steps (258 passed). options.feature has 6 scenarios. `test/orchestrators/plugin/info.test.ts` and `test/edge/handlers/plugin/info.test.ts` gave 326 pass. Direct coverage of info.ts, `test:architecture`, and `check:features` exited 0. The hook passed `check:commit`.

## Lines for later plans

- Token: `options not set`, the last member of `Reason` (81 members). The kind `userConfig` maps to it in `kindToReason` (`shared/probe-classifiers.ts`).
- Info line, one key: `required option "token" has no default, so it is not set`
- Info line, several keys: `required options "token", "region" have no default, so they are not set`
- The line renders as `    note: <line>` after every other note. `unsetOptionNotes` in `orchestrators/plugin/info.ts` builds it from `resolveOptions(declaredUserConfig).unsetRequired`.
- Catalog states: `failure-options-not-set` (install), `partially-installed-inventory-options` (list), and `partially-available-with-unset-options` (info, with the note). The counters are 327 states, 55,092 bytes, 340 presented wire payloads.

## Parent-owned lines requested

- PG-CORE-03: the refusal half of success criterion 1 is done. Plans 10-08 and 10-16 still own the hook half. Do not mark the requirement complete yet.
- STATE.md decision: "A required option with no default gives the reason `options not set` on install, list, and info; info names the unset keys in one note (D-PG10-06)."

## Deviations from Plan

1. **[Rule 3 - Blocking] Four files outside the plan's list.** The new member broke these gates, so I updated them in the Task 1 commit: `test/shared/notification-types.test.ts` (its `EXPECTED_REASONS` order proof), `test/architecture/catalog-uat/catalog-parser.test.ts` (324 to 327 tuples), `test/architecture/catalog-uat/catalog-wire.test.ts` (337 to 340 presented payloads, 324 to 327 tuples), and `schema/claude-plugin.schema.json`, which `npm run schema:generate` regenerated. The plan's `<verify>` list already named the notification-types test.
2. **The red runs of Task 1 were taken after the product edit.** I wrote the four source edits first by mistake. I saved them to the scratch directory, restored the files with `git checkout`, changed the tests, ran the red runs on the HEAD sources, then copied the edits back. The red output above is from the HEAD sources.
3. **Task 2 changed the Task 1 info catalog state instead of adding a new one.** After Task 2, an info row for such a plugin always has the note, so a state without it would show a row the product no longer prints. The state `partially-available-with-unset-options` now has the note, and the byte counter moved to 55,092.
4. **options.feature does not run under the `builtin` profile.** The profile selects 0 of its scenarios, as for the other plugin features.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-15: the token is in every home in one commit (1618576f). The three lock tests, the parity test, the catalog contract, and the wire schema drift test ran in the hook and passed. T-10-16: the line holds quoted option keys only. A key passed the identifier pattern at resolution. The owner cases assert the whole row, and a case with `sensitive: true` shows only the key. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: features/plugin/options.feature, extensions/pi-claude-marketplace/orchestrators/plugin/info.ts, docs/output-catalog.md
- FOUND: 1618576f, 00a9f9c8 (ancestors of HEAD)

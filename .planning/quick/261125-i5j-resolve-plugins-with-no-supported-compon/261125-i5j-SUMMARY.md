---
quick_id: 261125-i5j
phase: quick-261125-i5j
plan: 01
subsystem: domain/resolver, shared/probe-classifiers, docs
tags: [resolver, partial-install, unavailable, D-NSC-01]
status: complete
requires: []
provides:
  - "decideResolution returns the unavailable arm for a plugin with an unsupported kind and nothing Pi can install (D-NSC-01)"
  - "narrowKindNotes: an unavailable row shows each unsupported kind's own reason token (D-90-05)"
affects:
  - install, install --partial, list, info, pending, apply, update, reinstall, enable
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - features/plugin/partial-install.feature
    - features/plugin/list.feature
    - test/domain/plugin-resolver.test.ts
    - test/shared/probe-classifiers.test.ts
    - test/orchestrators/plugin/install.messaging.test.ts
    - test/architecture/cross-surface-reason-parity.test.ts
    - .planning/PROJECT.md
    - docs/prd/pi-claude-marketplace-prd.md
    - docs/output-catalog.md
    - README.md
    - README.es.md
    - CHANGELOG.md
decisions:
  - "D-NSC-01: a plugin with at least one unsupported component and no supported component (and no declared MCP server some implementation runs) resolves unavailable, so --partial cannot install it"
metrics:
  completed: 2026-11-25
actuals:
  tasks: 5
  commits: 6
plan_head_before: 52e0ab7
plan_head_after: e1dbee9
---

# Quick Task 261125-i5j: Resolve plugins with no supported component as unavailable Summary

A plugin whose components are all unsupported (an LSP-only, themes-only, or hooks-module-only plugin) now resolves `unavailable`, so `install --partial` refuses it instead of writing an empty install record. Its row shows each unsupported kind's own reason (`lsp`, `unsupported hooks`, `unsupported mcp`, `options not set`, `unsupported component`) on `list`, `info`, and the install row. The rule is recorded as `D-NSC-01`, and every current spec, doc, comment, README, and the CHANGELOG state it.

## Commits (run order 1, 2, 3, 5, 4)

| Task | Commit | Title | Files |
| ---- | ------ | ----- | ----- |
| 1 (tracer) | `d993f3c` | fix(resolver): treat a plugin with nothing to install as unavailable | 4 |
| 2 | `ff4eefe` | fix(messaging): show a kind's own reason on an unavailable row | 7 |
| 3 | `ebaedce` | test: keep partially available fixtures partially available | 12 |
| 5 | `67579b0` | docs: state that a plugin with no supported component is unavailable | 27 |
| 4 | `e1dbee9` | docs: say that a plugin with no supported component is unavailable | 3 |

Each task was merged into the run's branch by the orchestrator (merge commits `e2fd161`, `6b691a6`, `4d60e39`, `2f198b1`). `b46e826` is the orchestrator's plan update that added Task 5. Measured: `git rev-list --count 52e0ab7..HEAD` is 10 (6 non-merge commits, the five task commits plus `b46e826`, and 4 merges).

Under `extensions/`, Tasks 1 and 2 change code in three modules only: `domain/plugin-resolver.ts` (Task 1), `shared/probe-classifiers.ts` and `orchestrators/plugin/install.messaging.ts` (Task 2). Task 5 changes comment lines in 14 modules.

## Task 1: resolver change (tracer, `d993f3c`)

Files: `extensions/pi-claude-marketplace/domain/plugin-resolver.ts`, `test/domain/plugin-resolver.test.ts`, `features/plugin/partial-install.feature`, `features/plugin/list.feature`.

`decideResolution` returns the existing `unavailable` helper's arm when a plugin has an unsupported kind, no supported kind, and no declared MCP server that at least one MCP implementation runs (the neutral verdict, `declaredMcpServers` minus `droppedMcpServers`). The notes name every unsupported kind, with a `contains hooks` and `contains mcpServers` note added because those kinds have no note of their own.

RED and GREEN record. The detailed RED lines were reported by the Task 1 executor to the orchestrator and are not repeated here verbatim; the plan pins the expected RED values, and the commit records the change:

- Scenarios, adapter profile, before the resolver change: the install scenario `Installing a plugin whose only component is an LSP server fails as unavailable, even with --partial` failed at the fields step (severity `info`, needs reload `true`, no summary row: the install succeeded and installed nothing). The list scenario `The list names a plugin whose only component is an LSP server unavailable as lsp` failed at the rows step (status `partially-available`).
- Unit cases, before the resolver change: 15 cases failed with the answer `partially-available` (the 13 flipped cases, the case of a server no implementation runs, and the case of required options with nothing else). Three new cases passed at HEAD and pin what the change must keep: `.lsp.json` beside one MCP server, `.lsp.json` beside a server only Pi's built-in MCP runs (D-P3-01), and the structural defect beside an unsupported kind (RSTATE-02).
- GREEN: the owner test and both feature files pass after the change; the final gate below re-ran both on the combined tree.

20 cases at 15 sites gained a `skills` folder so they keep proving the partial arm with their titles and claims unchanged.

## Task 2: kind reasons on an unavailable row (`ff4eefe`)

Files: `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`, `test/shared/probe-classifiers.test.ts`, `test/orchestrators/plugin/install.messaging.test.ts`, `test/architecture/cross-surface-reason-parity.test.ts`, `features/plugin/partial-install.feature`, `features/plugin/list.feature`.

New export `narrowKindNotes` answers only when every note names a kind; `narrowResolverNotes` and the install row's narrowing use it. A kind note beside a structural note still reads `unsupported source` (SURF-01 rider of D-90-05).

RED and GREEN record (expected values from the plan; the executor's verbatim lines went to the orchestrator):

- Scenarios, adapter profile, before the classifier change: `Installing a plugin whose only component is a theme fails as unavailable for an unsupported component` and `The list names a plugin whose only component is a hooks module unavailable as an unsupported component` failed at the rows step with reasons `unsupported source` where the table says `unsupported component`.
- Unit cases: the new `narrowKindNotes` cases failed (export missing), and the changed `narrowResolverNotes`, install-row, and parity rows failed with `unsupported source` where they expect the kind token.
- GREEN: all pass after the change; `features/plugin/partial-install.feature` and `features/plugin/list.feature` pass under the adapter profile (6 and 15 scenarios per the plan's verification), and the final gate re-ran them.

## Task 3: fixtures that stay partially available (`ebaedce`)

12 test modules, no file under `extensions/`. Each failing fixture gained an empty `skills` folder (a supported kind that stages nothing). Cases hardened per module (the failing-case counts the plan measured, which the commit fixes):

| Module | Cases |
| ------ | ----- |
| `test/edge/handlers/tools.test.ts` | 6 (one edit in `layoutMarketplace`) |
| `test/orchestrators/edge-deps.test.ts` | 5 (one edit in `layoutMarketplace`) |
| `test/orchestrators/import/execute.test.ts` | 1 |
| `test/orchestrators/plugin/git-source-probe.test.ts` | 3 |
| `test/orchestrators/plugin/info.test.ts` | 15 |
| `test/orchestrators/plugin/install-outcome.test.ts` | 4 |
| `test/orchestrators/plugin/list-candidate-row.test.ts` | 4 |
| `test/orchestrators/plugin/list-flow.test.ts` | 11 |
| `test/orchestrators/plugin/list-installed-row.test.ts` | 2 |
| `test/orchestrators/reconcile/convergence.test.ts` | 4 |
| `test/orchestrators/reconcile/notify.test.ts` | 2 |
| `test/orchestrators/reconcile/pending.test.ts` | 2 |

Expected values that gained the supported component: two install records in `test/orchestrators/reconcile/convergence.test.ts` now list `skills` as supported, to match the plugin they were installed from, so the moves still read as revision moves (from the commit body). No title, status, reason, or row was changed to make a case pass.

## Task 5: the rule in every current spec, doc, and comment (`67579b0`)

Files changed (27): `.planning/PROJECT.md` (the `D-NSC-01` row, back-references on D-90-05, D-CF5-20, D-PG10-06, a last-updated line), `.planning/BACKLOG.md` (MCPB-01, see Dubious Choices), `docs/prd/pi-claude-marketplace-prd.md` (PR-2, PR-3, PR-9, FORCE-05, SEV-02a, ES-6, two glossary entries), `docs/output-catalog.md`, `docs/messaging-style-guide.md`, `docs/hooks-compatibility.md`, `docs/mcp-compatibility.md`, `docs/env-vars.md`, `README.md` and `README.es.md` (the introduction sentence only), comment lines in 14 modules under `extensions/pi-claude-marketplace/` (`domain/plugin-resolver.ts`, `edge/handlers/tools.ts`, `orchestrators/edge-deps.ts`, `orchestrators/plugin/{fetch,info,install.messaging,list-flow,list.messaging,plugin-state-classifier,update-flow}.ts`, `orchestrators/types.ts`, `shared/{errors,notification-grammar,probe-classifiers}.ts`), the ID in nine unit titles of `test/domain/plugin-resolver.test.ts`, and four scenario titles in `features/plugin/{list,partial-install}.feature`.

Checked and left as they are (per the plan's list): the help text in `extensions/pi-claude-marketplace/edge/flag-catalog.ts` and its pinned tests; `.planning/codebase/`; `docs/skills-commands-compatibility.md`, `docs/plugin-enablement.md`, `docs/workflows-compatibility.md`, `docs/dependency-resolution.md`, `docs/json-output.md`; the READMEs' `Partially available plugins` section (Task 4); the dated records (`docs/prd/parity-gaps-prd.md`, `docs/competitive-analysis/`, the milestone sections and Validated list of `.planning/PROJECT.md`, and the historical folders USER-5 names).

## Task 4: README, CHANGELOG, full gate (`e1dbee9`)

Files: `README.md`, `README.es.md`, `CHANGELOG.md`.

- `README.md`, section `Partially available plugins`, after the first paragraph: "A plugin with no supported component is unavailable. The `--partial` option cannot install it."
- `README.es.md`, section `Complementos parcialmente disponibles`, same place: "Un complemento sin ningún componente compatible no está disponible. La opción `--partial` no puede instalarlo."
- `CHANGELOG.md`, first bullet under `## [Unreleased]`, above the #324 entry (21 words, one sentence): "A plugin with no component that Pi supports, such as an LSP-only plugin, is now `unavailable`, and `--partial` cannot install it." It carries no pull request number (USER-4): no pull request exists for this branch yet, and the number is added when one opens. The changelog skill keeps decision IDs out of entries (rationale goes to the commit body), so `D-NSC-01` is cited in the commit body only.
- `SKIP=npm-check,trufflehog pre-commit run --files README.md README.es.md CHANGELOG.md` passed with no change (mdformat, markdownlint-cli2 and the text fixers). The commit hook passed (gitlint included; `npm run check:commit` skipped because no build input is staged).
- Acceptance greps: `no supported component` in the README section, `ningún componente compatible` in the Spanish section, and `unavailable` in the Unreleased section each count 1 or more.

### Full gate

- Command: `npm run check` under `env -u <name> ...` for the 59 harness names that start with `CLAUDE_CODE_`, `BUN_`, or `ANGLE_`, plus `JAVA_TOOL_OPTIONS`, `_JAVA_OPTIONS`, and `GLOBAL_AGENT_NO_PROXY` (62 names). The proxy and certificate variables were kept. A scratch directory holding a `fd` symlink to `/usr/bin/fdfind` came first on `PATH`. Before the gate: `npm ci` and `node scripts/install-test-peers.mjs` (pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, @quintinshaw/pi-dynamic-workflows 3.15.0).
- Commit: `e1dbee923ef0dbe45348a4554dfb092adc8a957e` (the final tree, all five tasks).
- Node: v24.22.3.
- Exit status: **0**, on the first run. Wall time 1,027 s (about 17 minutes). No rerun was needed: the `subagent-hook-ownership` ESRCH flake did not occur, and the size-sensitive `dispatch-exec` hook case passed.
- Stages: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed. test:unpaired and test:integration passed. Cucumber adapter profile: 2104 scenarios (2104 passed), 26028 steps. Builtin profile: 204 scenarios (204 passed), 2762 steps. Direct coverage for all pairs passed and merged `coverage/direct.lcov` (376 records).
- The log has three `Legacy marketplace migration could not be persisted` lines. They are the sanctioned IL-3 `console.warn`, which unit tests trigger on purpose, and not failures.

## Deviations from Plan

1. **Task 5 changed 27 files, not 26.** It also edited the MCPB-01 entry of `.planning/BACKLOG.md`, which the plan listed under "checked and left as they are". The orchestrator added that entry to Task 5's scope when it dispatched the task, after the user asked that every current doc be made consistent: MCPB-01 describes an open item, so it is not a dated record. The edit says a bundle plugin is partially available when it has another supported component and `(unavailable) {unsupported mcp}` when it has none (D-NSC-01); the rest of the entry is unchanged.
2. **SUMMARY created by Task 4.** The plan had Task 1 create the SUMMARY and each task add its record. No SUMMARY existed when Task 4 started, so this file was written in one pass from the plan, the five commits, and the gate run. The verbatim RED lines that the Task 1 and Task 2 executors reported went to the orchestrator; this file gives the plan's expected RED values and does not claim to reproduce those lines. The orchestrator holds the executors' reports.

## Dubious Choices

1. The closed `Reason` set has no token `mod` or `themes`. A hooks-module-only or themes-only plugin reads `(unavailable) {unsupported component}`, the token those kinds have on a partial row today (D-90-05). One token for each kind needs new members in the closed set, which this plan does not add.
2. A row shows the kind tokens only when every note of the plugin names a kind. A `contains <kind>` note beside a structural note still reads `unsupported source` (the SURF-01 rider of D-90-05).
3. On the new arm the resolver adds `contains mcpServers` and `contains hooks`, because those kinds have no note and an unavailable resolution carries only notes. The note `no supported components` is not written. The notes of the partially-available arm do not change.
4. The unset-options note alone now reads `options not set` on an unavailable row, where it read `unsupported source`. So a plugin with only required options that have no default reads `(unavailable) {options not set}`.
5. Task 5 records the rule as the decision `D-NSC-01` (USER-5). No milestone is active, so the ID follows the rows outside a milestone's numbering (`D-LOC-01`, `D-UXG-01`, `D-CACHE-01`) and not the `D-PG` prefix of the closed milestone. The row amends PR-3, D-CF5-20, D-PG10-06, and the SURF-01 rider of D-90-05, and those three decision rows get a back-reference.
6. A record installed earlier with `--partial` for such a plugin. Measured with the change applied: `list` reads the record and shows `(partially-installed)`, and `info` reads the live resolution and shows `(installed)` with the reason. Read from the code, not run: `update` to a newer version skips it as `no longer installable`, and `enable` and `reinstall` refuse it through the same gates. Each path is the typed one an unavailable plugin already takes, and there is no migration.
7. A declared plugin of this kind shows `(will install)` in `pending` (measured). `apply` installs without `--partial`, so it refuses the plugin as unavailable (read from the code), as for every unavailable plugin.
8. An unavailable row shows the marketplace entry's version, not the version in `plugin.json`, and `info` no longer lists the plugin's blocked MCP servers.
9. Task 5 leaves these as they are. `docs/prd/parity-gaps-prd.md` and `docs/competitive-analysis/` are dated records, so their sentences on partially available plugins stay. The output catalog gets no new state for the new row: the prose under the structural failure state names it. The help text in `extensions/pi-claude-marketplace/edge/flag-catalog.ts` and the files of `.planning/codebase/` hold under the rule and do not change. The plan also said the dated entries of `.planning/BACKLOG.md` stay, with MCPB-01 still saying that a bundle plugin is partially available; the orchestrator added MCPB-01 to Task 5 (Deviation 1), so it now names both outcomes.
10. Task 5 puts the ID in nine unit titles. The unit test rules allow an ID in a title and do not require one. The four scenario titles get the ID because the cucumber rules ask a scenario that pins a divergence from Claude Code to name its decision or gap.
11. The sentence on `{no longer installable}` in `docs/output-catalog.md` gets a fourth cause, an entry with no supported component. This is read from the code (the reinstall gate refuses every `unavailable` resolution) and was not run.
12. The CHANGELOG bullet has no pull request number (USER-4). The number is added when the pull request opens.
13. The gate ran without the harness variables, and `fd` came from the package `fd-find` (a `fd` symlink to `/usr/bin/fdfind` in a scratch directory put first on `PATH` for the gate run only). The size-sensitive hook case and the `ESRCH` flake are defects of the test suite that this plan does not fix.

## Self-Check: PASSED

- The commits `d993f3c`, `ff4eefe`, `ebaedce`, `67579b0`, and `e1dbee9` are all ancestors of HEAD.
- The working tree is clean apart from this uncommitted SUMMARY, which the orchestrator commits.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

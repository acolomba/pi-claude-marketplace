---
phase: 08-clear-milestone-debt
plan: 19
subsystem: end-to-end reserved-name proof (integration tests)
tags: [d-08-07, ownkey-01, debt-04, prototype-keys, integration]

requires:
  - "08-09: `shared/own-key.ts`, `isReservedRecordKey`, the resolver `__proto__` rule"
  - "08-15 to 08-18: the own-key read and write sweep"
provides:
  - "tests/integration/reserved-record-keys.test.ts: 14 end-to-end cases that run the `/claude:plugin` command handler and the real `applyReconcile` in a hermetic home with reserved names"
  - "Whole-tree gate: no name-indexed bracket read or `in` test on a `marketplaces` or `plugins` map remains under extensions/pi-claude-marketplace (gate clean, no fix)"
affects: [08-21 (DEBT-04 ledger), 08-20]

actuals:
  tokens: 3300
  tasks: 2
  commits: 2
plan_head_before: 7c8f7c162f2c256dd7be979c6d5f5ad903ddebc3
plan_head_after: dfe0ae9d76caf2aea87dfc01f0144585d2d3f6de

tech-stack:
  added: []
  patterns:
    - "End-to-end reserved-name proof: register `/claude:plugin` on a mock Pi, run real commands in `withHermeticEnvironment`, and compare a reserved name's notifications with an absent name's, both as independent literals"

key-files:
  created:
    - tests/integration/reserved-record-keys.test.ts
  modified: []

key-decisions:
  - "The cases run the registered `/claude:plugin` handler instead of calling the operations directly. The handler reaches `createInstallOperation`, `createEnableOperation`, `createUninstallOperation`, `getPluginInfo` and `listPlugins` through the edge handlers, so the edge scope resolution that 08-15 converted is in the path too. `beginPluginUpdateRun` and `updatePlugins` are the production pair from `createPluginUpdateOperations`, as index.ts binds them. The only stand-ins are the mock Pi, the notify collector, the MCP status snapshot and a memory git fake that a path source never calls."
  - "`install __proto__@hostile` is pinned as observed: `(failed) {invalid manifest}`, refused by the dependency-closure root-key token rule before the resolver runs. The resolver's `(unavailable) {unsupported source}` verdict is asserted through `list`, which is where it surfaces. See Deviations."
  - "Added cases beyond the plan's list (update, marketplace update and remove, import with config write-back, a reload of `hello@constructor`, and four more absent-name rows), because the plan's own cases passed on the trees before 08-17 and 08-18. The added cases fail there."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "a plugin named constructor installs, lists, shows, disables, enables and uninstalls, and state.json holds it as an own key after each save"
    requirement: "DEBT-04"
    verification:
      - kind: integration
        ref: "tests/integration/reserved-record-keys.test.ts#D-08-07: a plugin named constructor installs, lists, shows, disables, enables and uninstalls as an own record"
        status: pass
    human_judgment: false
  - id: D2
    description: "a reload whose config declares constructor@mp, or hello@constructor, installs it through the real reconcile"
    requirement: "DEBT-04"
    verification:
      - kind: integration
        ref: "tests/integration/reserved-record-keys.test.ts#D-08-07: a reload whose config declares constructor@mp installs it as an own record; ...declares hello@constructor..."
        status: pass
    human_judgment: false
  - id: D3
    description: "a marketplace declaring __proto__ and hello installs hello, lists __proto__ unavailable {unsupported source}, refuses install __proto__ and changes no file"
    requirement: "DEBT-04"
    verification:
      - kind: integration
        ref: "tests/integration/reserved-record-keys.test.ts#D-08-07: a marketplace that declares __proto__ installs hello, lists __proto__ as unavailable and refuses its install without a file change"
        status: pass
    human_judgment: false
  - id: D4
    description: "info, reinstall, update, uninstall, enable, marketplace update and marketplace remove on an absent constructor name print what an absent name prints and change no file"
    requirement: "DEBT-04"
    verification:
      - kind: integration
        ref: "tests/integration/reserved-record-keys.test.ts (eight absent-name rows)"
        status: pass
    human_judgment: false
  - id: D5
    description: "no non-comment line under extensions/pi-claude-marketplace indexes a marketplaces or plugins map by name with brackets or tests membership with in; delete statements stay"
    requirement: "DEBT-04"
    verification:
      - kind: other
        ref: "Task 2 whole-tree grep (tmp/p8-19-sites.txt empty)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 19: End-to-end reserved-name proof Summary

**A new integration file runs real `/claude:plugin` commands and a real `/reload` in a hermetic home with reserved names. A plugin named `constructor` installs, lists, shows, disables, enables, updates, imports and uninstalls, and it is uninstalled when its marketplace is removed. state.json holds it as an own key after every save. A reload installs `constructor@mp` and `hello@constructor`. A marketplace that declares `__proto__` lists that entry as `(unavailable) {unsupported source}`, refuses its install, and keeps every other record and file. Eight commands on a `constructor` name that does not exist print what an absent name prints. All 14 cases fail on the tree before the own-key sweep. The whole-tree grep finds no unconverted site.**

## Performance

- **Duration:** about 15 min (2026-10-10T06:44Z to 06:59Z)
- **Tasks:** 2/2 (Task 2: gate clean, no fix, no commit)
- **Files:** 1 created (test only)

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| OWNKEY-01 (D-08-07, DEBT-04) | proved end to end. Reserved names work through install, list, info, disable, enable, update, reinstall, uninstall, import, reload and marketplace remove. `__proto__` is refused and never drops a record. The whole-tree gate is empty | 2ac3d844, dfe0ae9d |

## Task Commits

1. **Task 1 (tracer): a plugin named constructor lives a full lifecycle, and a `__proto__` entry never drops a record.** Commit `2ac3d844` (`test(integration): prove reserved plugin names end to end`), 8 cases: the lifecycle, the `constructor@mp` reload, the `__proto__` marketplace, and three absent-name rows (`info x@constructor`, `uninstall constructor@mp`, `enable constructor@mp`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed. Tracer gate: the verify block is automated only and `human_verify_mode` is `end-of-phase`. I re-ran the verify after the commit and it passed.
   Follow-up commit `dfe0ae9d` (`test(integration): cover reserved names in update, import and reload`) adds 6 cases: update with marketplace update and remove, import with the config write-back on disable and uninstall, the `hello@constructor` reload, and the `reinstall x@`, `reinstall <name>@mp`, `update <name>@mp`, `marketplace update` and `marketplace remove` absent-name rows. Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed.
2. **Task 2: whole-tree gate.** Gate clean, no fix, no commit. The raw grep lists 20 lines: 12 are comments and 8 are `delete` statements (marketplace/remove.ts 396 and 481, install-cascade.ts 1016, uninstall.ts 784, config-write-back.ts 151, and comment-quoted deletes). After the filters, `tmp/p8-19-sites.txt` is empty.

### Test titles

1. D-08-07: a plugin named constructor installs, lists, shows, disables, enables and uninstalls as an own record
2. D-08-07: a reload whose config declares constructor@mp installs it as an own record
3. D-08-07: a reload whose config declares hello@constructor installs it as an own record
4. D-08-07: a plugin named constructor updates, and removing its marketplace uninstalls it
5. D-08-07: an import of constructor@mp installs it, and disable and uninstall write its config entry back
6. D-08-07: a marketplace that declares __proto__ installs hello, lists __proto__ as unavailable and refuses its install without a file change
7. D-08-07: info x@constructor prints what info x@absent prints and changes no file
8. D-08-07: reinstall x@constructor prints what reinstall x@absent prints and changes no file
9. D-08-07: marketplace update constructor prints what marketplace update absent prints and changes no file
10. D-08-07: marketplace remove constructor prints what marketplace remove absent prints and changes no file
11. D-08-07: uninstall constructor@mp prints what uninstall absent@mp prints and changes no file
12. D-08-07: enable constructor@mp prints what enable absent@mp prints and changes no file
13. D-08-07: reinstall constructor@mp prints what reinstall absent@mp prints and changes no file
14. D-08-07: update constructor@mp prints what update absent@mp prints and changes no file

### RED evidence (the final file run against older trees with `git archive`)

- Before the sweep (`ece01002`, before the own-key helper): 14 of 14 fail. For example, `install constructor@mp` gives `{already installed}`, `info x@constructor` throws `Cannot read properties of undefined (reading 'autoupdate')`, `uninstall constructor@mp` gives `{unreadable}`, and the list shows `__proto__` as `(available)`.
- Before the update, list and reinstall conversions (`be289c1b`): 4 fail (`reinstall x@constructor` gives `{unreadable}`, `reinstall constructor@mp` gives `{already disabled}`, `update constructor@mp` gives a `(skipped)` warning, and the `hello@constructor` reload).
- Before the reconcile, import and marketplace conversions (`480a4b56`): 1 fails (the `hello@constructor` reload gives `{source mismatch}`).
- HEAD: 14 of 14 pass.

## Verify results (final lines)

- Task 1: `node --test --test-reporter=tap tests/integration/reserved-record-keys.test.ts` gives `# tests 14`, `# pass 14`, `# fail 0`, `# skipped 0`, `TEST_EXIT=0`. The verify chain exited 0.
- Task 2: the whole-tree grep exited 0, and `tmp/p8-19-sites.txt` is empty (0 lines).
- `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json`: `verdict pass`, `duplication_introduced 0`, `duplication_inherited 8`, `complexity_introduced 0`, `dead_code_introduced 0`.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 1 - Plan expectation] `install __proto__@<mp>` reads `(failed) {invalid manifest}`, not `(unavailable) {unsupported source}`**
- **Found during:** Task 1
- **Issue:** The install command checks the root reference against the dependency token rule (`domain/dependency-closure.ts` `splitKey`, `TOKEN_PATTERN` in `domain/dependencies.ts`, which needs a leading letter or digit) before the resolver runs. So the install is refused with `(failed) {invalid manifest}` and the cause `Plugin "__proto__@hostile" declares an unusable dependency (root: expected <plugin>@<marketplace>).` The resolver's `(unavailable) {unsupported source}` verdict does surface, through `list` and `info`.
- **Disposition:** The case pins the observed install notification, asserts the `list` row, and checks that no file under the hermetic root changes. The safety property holds: `__proto__` is refused and no record is dropped. I changed no source. Reordering the install checks is outside this plan. The cause text is misleading, since the plugin declares no dependency, and every root name outside the token alphabet (for example `_x@mp`) gets it too, so it is not specific to D-08-07. I recorded it in the broken-windows ledger as a `deviation` entry for triage.

**2. [Rule 2 - Coverage] Extra end-to-end cases**
- The plan's 6 behavior cases fail on the tree before the sweep, but they pass on the trees before 08-17 and 08-18. Those plans asked this plan for the end-to-end proof of their sites. The follow-up commit `dfe0ae9d` adds update, marketplace update and remove, import with config write-back, a `hello@constructor` reload, and four more absent-name rows. Each later conversion has at least one case that fails without it.

**3. Two commits for Task 1**
- The follow-up coverage was committed separately from the tracer commit (`2ac3d844`, then `dfe0ae9d`). Both touch only the new test file.

**Total deviations:** 3. **Impact:** test-only. No source changed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigation applied:
- T-08-37: the end-to-end file runs the production command handler and reconcile with reserved names, and the whole-tree grep is empty. A missed site cannot hide behind per-module tests.

## Notes for later plans

- 08-21: OWNKEY-01 is proven end to end. A `deviation` entry in the broken-windows ledger, for `domain/dependency-closure.ts`, records the `__proto__` install row and the misleading `declares an unusable dependency (root: ...)` cause. Waive it or route it to a carrier.
- A broader informational grep beyond the plan's gate found bracket reads only on MCP server maps, frontmatter and env maps (for example `bridges/mcp/adapter-entry.ts:299` `input.previous[name]`). These are not `marketplaces` or `plugins` maps. There, `carriedFields` drops the inherited `constructor` function as a non-object, and it copies only own carried fields, which `Object.prototype` does not hold, so an inherited read carries nothing. No change was made.

## Self-Check: PASSED

- `tests/integration/reserved-record-keys.test.ts` exists.
- Commits 2ac3d844 and dfe0ae9d are ancestors of HEAD.

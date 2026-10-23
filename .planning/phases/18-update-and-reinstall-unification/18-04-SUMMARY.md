---
phase: 18-update-and-reinstall-unification
plan: 04
subsystem: orchestrators/plugin (reinstall), bridges (skills, commands, agents, mcp), shared/fs-utils
tags: [reinstall, deletion, bridges, rule-pack, docs]
requires:
  - phase: 18-update-and-reinstall-unification
    provides: "reinstall on the shared runner (18-02), so nothing calls reinstall's own replacement machinery"
provides:
  - "One materialization path in the tree: reinstall-replace.ts and the bridge replace/rollback/finalize code only it reached are gone (D-18-02, UPR-01)"
  - "reinstall-flow.ts owns runPostSuccessMaintenance, defaultRemoveDataDir, and the exported RemoveDataDirFn (D-18-05)"
  - "createReinstallPlugin(hooksRouting, completionCache, env?) with no transaction parameter"
  - "write-file-atomic-chokepoint no longer exempts bridges/agents/stage.ts"
affects: [18-05..18-07 test re-adds and the phase-wide D-68-02 sweep]
actuals:
  tokens: 76000
  tasks: 2
  commits: 2
plan_head_before: 59edbe3d6e46b54cfbc573d09b7085e0548ef17c
plan_head_after: self # the task 2 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/shared/fs-utils.ts
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - rule-packs/architecture.json
    - docs/prd/pi-claude-marketplace-prd.md
    - docs/mcp-compatibility.md
  deleted:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - test/orchestrators/plugin/reinstall-replace.test.ts
key-decisions:
  - "The agents commit keeps its options?.force gate; it is now the only carrier of reinstall's RINST-01 overwrite (D-18-15)"
  - "All five remaining fallow code-duplication markers in the agents, commands, and skills stage.ts still hide live clone groups, so none was removed"
requirements-completed: [UPR-01]
duration: 75min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 04: Delete reinstall's replacement machinery Summary

**Reinstall's own prepare/replace/rollback/finalize schedule, its
reinstalled-record writer, and the bridge code only it reached are deleted
(D-18-02, UPR-01). Reinstall keeps its post-success maintenance as its own
step in `reinstall-flow.ts` (D-18-05). The tree is 5,852 lines smaller with
the same behavior, and `npm run check` is green.**

## What changed

- **Task 1 (`8ba408a4`).**
  - `reinstall-replace.ts` and its test are deleted.
  - `RemoveDataDirFn`, `defaultRemoveDataDir`, and `runPostSuccessMaintenance`
    now live in `reinstall-flow.ts`. Only the type is exported. The
    maintenance step reads `scope`, `marketplace`, `plugin`, and
    `removeDataDir` from the reinstall options, and its two deferral warnings
    keep their exact text. `maintenanceInput` is gone.
  - `createReinstallPlugin` takes `(hooksRouting, completionCache, env?)`. The
    module-private `createNodeReinstallPlugin` is gone, so
    `createNodeReinstallPlugins` and `operations.ts::createReinstallOperation`
    both call the same two-argument factory. The `operations.ts` header and
    JSDoc now say so, and they replace the old "reinstall reads the cached
    manifest only" claim with the shared runner's NFR-5 network use (D-03-03,
    D-18-04, D-18-07).
  - `reinstall-record.ts` no longer has `RecordReinstalledOutcomeInput`, its
    overload and switch arm, `recordReinstalledOutcome`, or
    `resourcesFromHandles`.
  - The skills, commands, and agents bridges lose `replacePrepared*`,
    `rollback*Replacement`, `finalize*Replacement`, their internals, WeakMaps,
    and helpers. They also lose the `*Replacement*` types,
    `ReplacePreparedAgentsOptions`, and the barrel re-exports. The agents
    bridge loses `restoreAgentsIndex`, `readOptionalText`, and its
    `write-file-atomic`, `readFile`, `assertSafeName`, and
    `ManualRecoveryError` imports.
  - The mcp bridge loses `finalizeMcpReplacement` only. `fs-utils.ts` loses
    `removeOrphanIfPresent`, `rollbackReplacementCommon`, and their types.
  - Tests: the nine reinstalled-writer cases in `reinstall-record.test.ts` are
    deleted. In the bridge stage tests, the `describe` blocks of the deleted
    functions are deleted, and so are the eight commands cases. The commands
    no-op case stays, without its replacement lines. In the barrel and types
    tests, the deleted names, `Same<>` pins, and `@ts-expect-error` cases are
    removed. The `removeOrphanIfPresent` and `rollbackReplacementCommon`
    suites in `fs-utils.test.ts` are deleted.
  - New case: "rejects a replacement handle this module did not make" in
    `describe("rollbackMcpReplacement")`. It also asserts that the refusal
    leaves `mcp-adapter.json` unchanged.
  - In `reinstall-flow.test.ts`, every `createReinstallPlugin` call loses its
    transaction argument. The LAYER-04 refusal cases drop
    `refusingReinstallTransaction` and keep their file-snapshot assertions.
  - The D-75-01 guard comment now names the agents commit's `force` option.
    The no-test-only-production-surface message now names
    `InstallLedgerTransaction.runPhases`, which `install-outcome.ts` declares
    and `install-cascade.ts` binds.
- **Task 2 (the commit that adds this file).**
  - `rule-packs/architecture.json`: `bridges/agents/stage.ts` is no longer in
    the `write-file-atomic-chokepoint` exemptions (T-18-10).
  - `enable-disable.ts`: the backfill stance now cites BFILL-01 / D-18-06.
  - `operations.test.ts`: the PRL-02 banner and the record comment now say
    the operation runs the shared runner. The version is the 0.0.1 the
    marketplace still offers (D-18-08), and `installedAt` and `provenance`
    carry forward (D-18-09).
  - PRD AG section: reinstall keeps its overwrite permission (D-18-15). A
    commit that fails partway is reported as `rollback partial`, and running
    `reinstall` again repairs it (D-18-10).
  - `docs/mcp-compatibility.md`: the git-source remedy now says a reinstall
    clones on a cache miss and then installs the revision its mirror holds
    (D-18-04).
  - `git-source-probe.ts`, `plugin-resolver.ts`, and `install-outcome.ts`
    needed no edit, because Plan 02 had already rewritten their comments.

## Verification

- Task 1:
  - `npx tsc --noEmit`, `npm run lint`, and `npm run fallow` passed.
  - Direct coverage is 100% for all 16 listed pairs, including
    `bridges/workflows/stage.ts`.
  - `npm run test:unpaired` passed, including the D-75-01 guard.
  - `reinstall.feature` and `state-lock.feature`: 32/32 scenarios passed.
  - The commit deletes files, so `npm run check` was run before it: exit 0 on
    Node v26.12.1 (718/718 scenarios, 279 direct-coverage records). The
    commit hook passed.
- Task 2: `npm run check` exit 0 on the final tree, with exactly the files the
  commit stages (718/718 scenarios, 279 records).
- Acceptance greps:
  - `reinstall-replace.ts` is gone.
  - The deleted-symbol grep over `extensions test` prints nothing.
  - `function runPostSuccessMaintenance` appears once in `reinstall-flow.ts`.
  - `options?.force` appears once in `bridges/agents/stage.ts` (the D-18-15
    gate), and `write-file-atomic` appears 0 times there.
  - `ReinstallTransaction.replaceOperations` appears 0 times.
  - The Task 2 sweep over `extensions docs rule-packs` prints nothing.
  - `bridges/agents/stage.ts` appears 0 times in the rule pack.
- Fallow markers: I removed each of the five remaining markers alone, then
  each commands/skills pair together, and ran `npx fallow dupes --quiet
  --fail-on-issues`. Removing a single commands or skills marker passes,
  because the other marker of its pair still hides the group. Removing either
  pair, all four, or the agents marker fails. So all five stay.

## Deviations from Plan

1. **[Rule 1 - stale comments naming deleted symbols] More comment rewrites
   than the plan listed.** These comments named deleted code, and they would
   have failed the Task 1 negative grep:
   - the file headers of `bridges/{skills,commands,agents,mcp}/stage.ts`,
     which listed the replacement exports;
   - the agents commit's TR-07 comment ("not the replacePreparedAgents backup
     path") and its TR-01 comment, which cited
     `rollbackReplacementCommon (shared/fs-utils.ts:270-312)`;
   - the `fs-utils.ts` header and the `RemovalOps` docs, including the D-08-A08
     paragraph about `removeOrphanIfPresent`;
   - the builtin-patching banners of `skills/stage.test.ts` and
     `fs-utils.test.ts`. The skills banner now counts four unported faults,
     because the replace-only orphan-clearing `rename` fault went with its
     block. The fs-utils banner now counts three, because the
     `removeOrphanIfPresent` `fs.stat` fault went.

   All are in the Task 1 commit.
2. **The workflows commit comment is not worded as the plan suggested.** The
   plan said to reword it so that the sibling bridges' commits "move previous
   content aside for the same reason". That is false now. The skills,
   commands, and agents commits unlink their previous targets, and only the
   deleted replace path backed them up. The comment now says that, and adds
   that a failure after those removals is `rollback partial` and that a rerun
   repairs it (D-18-10). The CR-01 paragraph's last sentence also claimed that
   the commands bridge declares `backups` in a caller-owned position. Only
   `replacePreparedCommands` did, so the sentence is deleted.
3. **The `createNodeReinstallPlugin` type pin in `reinstall-flow.test.ts` is
   deleted.** It was an `@ts-expect-error` pin and the comment that explained
   it. With the function gone, the pin guarded nothing. The `ReinstallFlow`
   namespace type import went with it.
4. **The agents types test comment was reworded.** "staged preparations do not
   expose a replacement handle" now reads "do not nest another preparation".
   The assertion is unchanged.
5. **The AGENT-01 parametrized commit case** in `agents/stage.test.ts` lost
   its two `recovery: "replace"` rows and the `else` arm that called the
   deleted functions. The two `commit` rows and their assertions are
   unchanged.

## Needs the user's attention

- **`RemovalOps.rename` has no production caller now.** Only
  `rollbackReplacementCommon` routed a rename through the port. Fallow does
  not report unused interface members, and removing the member would change
  the removal-ops contract, the fake, and their tests. That is outside this
  plan. A later cleanup can narrow the port to `rm`.
- **`.planning/codebase/` is stale.** ARCHITECTURE, CONVENTIONS, and STACK
  still describe the deleted rollback path. They list
  `bridges/agents/stage.ts` among the three `write-file-atomic` rollback
  files, and they give `fallow-ignore` marker counts (46, with markers in
  `reinstall-replace.ts`, the TR-06 agents marker, and others) that are now
  lower. Refresh them at the next codebase-map run. This plan does not edit
  them.
- Test titles and comments in `reinstall-flow.test.ts` and
  `enable-disable.test.ts` still cite D-68-02. Plans 05 and 07 own that sweep,
  and this plan's sweep covers only `extensions docs rule-packs`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- MISSING (deleted as planned): extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts (contains `function runPostSuccessMaintenance`)
- FOUND: 8ba408a4 (task 1); task 2 is the commit that adds this file

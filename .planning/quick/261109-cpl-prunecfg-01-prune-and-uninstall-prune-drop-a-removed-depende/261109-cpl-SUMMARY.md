---
quick_id: 261109-cpl
phase: quick-261109-cpl
plan: 01
subsystem: orchestrators/plugin (prune sweep), persistence (config write-back)
tags: [prune, uninstall, config, rollback, PRUNECFG-01, D-BG-1310]
status: complete
requires: []
provides:
  - "sweepOrphans deletes each removed dependency's enabled: false declaration from both config files of the scope"
  - "an invalid config file refuses the sweep before any member leaves disk; a failed write fails the command"
  - "prune rollback snapshots and restores claude-plugins.json and claude-plugins.local.json under the own-write rule"
affects: [prune, uninstall --prune]
tech-stack:
  added: []
  patterns: ["own-write byte check for rollback restores (NFR-3)", "batched plugin-key delete returning written bytes"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - extensions/pi-claude-marketplace/persistence/config-io.ts
    - extensions/pi-claude-marketplace/persistence/config-write-back.ts
    - test/orchestrators/plugin/uninstall.test.ts
    - test/orchestrators/plugin/prune.test.ts
    - test/orchestrators/plugin/prune-rollback.test.ts
    - test/persistence/config-io.test.ts
    - test/persistence/config-write-back.test.ts
    - features/plugin/prune.feature
    - features/plugin/uninstall.feature
    - docs/dependency-resolution.md
decisions:
  - "D-BG-1310 (user, 2026-11-09): prune and uninstall --prune delete a removed dependency's enabled: false declaration from both layers; reverses D-BG-1309"
  - "Fail closed (user answer): an invalid layer refuses with {unreadable}, checked before the member loop so no member leaves disk; a failed write fails the command"
  - "uninstall --prune keeps the retry-converges model; only prune restores config files"
metrics:
  started: 2026-11-09T15:43:00Z
  completed: 2026-11-09T16:40:00Z
  duration: ~57 min
  tasks: 3
  files: 13
actuals:
  tokens: 66000
  tasks: 3
  commits: 3
plan_head_before: 9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c
plan_head_after: 6583392632998bf1baa7c1526503a7e00c16f28f
---

# Quick 261109-cpl: PRUNECFG-01 Summary

`prune` and `uninstall --prune` now delete the `enabled: false` declaration of each dependency they remove, from both `claude-plugins.json` and `claude-plugins.local.json` of the scope. They fail closed on a config file they cannot read or write. A failed prune save puts both files back under the own-write rule.

## Execution context

- Worktree: `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-aa0ae2e5a2cfe439f`, branch `worktree-agent-aa0ae2e5a2cfe439f`.
- BASE: `9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c`.
- Node: v26.13.0.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `d84d15f1` | fix(prune): drop a removed dependency's disabled declaration |
| 2 | `cc3e063b` | fix(prune): restore the config files when a prune rolls back |
| 3 | `65833926` | docs(prune): record the dropped disabled declaration |

Every commit went through the hooks. `npm run check:commit` passed for commits 1 and 2. Commit 3 stages no build input, so the hook skipped the npm checks.

## What changed

- `persistence/config-io.ts`: `saveConfig` returns the bytes `atomicWriteJson` wrote.
- `persistence/config-write-back.ts`: new `deletePluginConfigEntries(current, path, scopeRoot, keys)` deletes several plugin keys in one write and returns the bytes. `deletePluginConfigEntry` delegates to it.
- `orchestrators/plugin/uninstall.ts`:
  - `sweepOrphans` reads both layers once before the member loop (`readPruneLayers`). An invalid layer throws `LayerConfigUnreadableError`, so the command refuses with `{unreadable}` before any member leaves disk.
  - After the loop, `dropPrunedDisabledDeclarations` reads both layers again. For each valid layer, it deletes the `enabled: false` entries of the members whose `removed` is true, with one write per layer. It skips an absent layer and a layer with nothing to delete. An invalid layer (a change during the sweep), a failed write, and a containment refusal all throw.
  - `ConfigLayerWrite` and the required `recordConfigWrite` argument of `sweepOrphans`. The named uninstall passes `discardConfigWrite`.
- `orchestrators/plugin/prune-rollback.ts`: snapshots `config` (`targets.length + 4`) and `local config` (`targets.length + 5`) after the state snapshot. `recordConfigWrites` shares one body and one own-write map with `recordMcpWrites`. The rollback restores both files through `restoreMetadata` after `mcp adapter`.
- `orchestrators/plugin/prune.ts`: collects the sweep's config writes and hands them to `backup.recordConfigWrites` before `backup.rollback()`.
- Scenarios: S1 (scenario E gets its config `Then`), S2 (local config), S3 (`uninstall --prune` with disabled `app` and `lib`), and S4 (new, for the fail-closed answer): `Pruning refuses and keeps the dependency while a config file of the scope is invalid`.
- `docs/dependency-resolution.md`: R6 and R7, reworded for fail-closed (see Deviations).

## Red proof

**Task 1, scenarios, on the unchanged BASE source** (the four scenarios written first):

```text
npm run test:cucumber:profile -- --profile adapter --name 'Pruning removes a disabled dependency that nothing needs' --name 'drops its local declaration' --name 'drops the disabled declaration of the dependency it uninstalls' --name 'Pruning refuses and keeps the dependency'
exit 1 -- 4 scenarios (4 failed), 59 steps (52 passed, 3 skipped, 4 failed)
```

- S1 `Pruning removes a disabled dependency that nothing needs and what only it needs` (prune.feature:217) failed at its last step, `Then the "claude-plugins.json" file of the project scope declares no plugins`. The file still declared `"mid@tools": { "enabled": false }`.
- S2 `Pruning a dependency the user disabled in the local config drops its local declaration` (prune.feature:240) failed at its last step, `Then the "claude-plugins.local.json" file of the project scope declares no plugins`. The file still declared `"lib@tools": { "enabled": false }`.
- S3 `Uninstalling with --prune drops the disabled declaration of the dependency it uninstalls` (uninstall.feature:349) failed at its last step, `Then the "claude-plugins.json" file of the project scope declares no plugins`. The file still declared `"lib@tools": { "enabled": false }`.
- S4 `Pruning refuses and keeps the dependency while a config file of the scope is invalid` (prune.feature:261) failed at `Then the result has these fields:`. At BASE the prune succeeded (`severity info`, `needs reload true`) and ignored the invalid local config.

No setup step failed, so no scenario literal changed after the prototype run. S4's `summary` field and its `(prune)` failure row were added after the first green run, from what the run showed.

**Task 2, unit cases, on Task 1's tree** (R1 and P2 written first):

```text
node --import "$PWD/test/platform/isolated-pi-home.ts" --test --test-name-pattern 'PRUNECFG-01' test/orchestrators/plugin/prune.test.ts test/orchestrators/plugin/prune-rollback.test.ts
exit 1 -- pass 0, fail 2
```

- R1 `PRUNECFG-01 / NFR-3: a rollback restores each config layer that still holds the sweep's own write`: `TypeError: rollback.recordConfigWrites is not a function`.
- P2 `PRUNECFG-01 / NFR-3: a failed save restores both config layers byte for byte`: `AssertionError`. The base and local files held the sweep's writes (`{"schemaVersion": 1, "plugins": {}}`), not the original one-line texts.

## Green runs

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/persistence/config-io.test.ts test/persistence/config-write-back.test.ts`: exit 0, 39 pass.
- `node --import ... --test test/orchestrators/plugin/uninstall.test.ts`: exit 0, 146 pass (Task 1).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/persistence/config-io.ts extensions/pi-claude-marketplace/persistence/config-write-back.ts extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/plugin/prune.feature features/plugin/uninstall.feature`: exit 0, 31 scenarios passed (after Task 1 and again after Task 2).
- `npm run check:features`: exit 0.
- `node --import ... --test test/orchestrators/plugin/uninstall.test.ts test/orchestrators/plugin/prune.test.ts test/orchestrators/plugin/prune-rollback.test.ts test/integration/standalone-prune.test.ts`: exit 0, 262 pass (Task 2).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`: exit 0.
- `npx tsc --noEmit`, ESLint on the changed files, and `npm run fallow`: exit 0 after each task.
- Gate greps: S1 config `Then` 1, local-config `Then` 1, S3 title 1, `export async function deletePluginConfigEntries` 1, `await dropPrunedDisabledDeclarations(` 1, `PRUNECFG-01` in uninstall.ts at least 1, `"local config"` 1, `locations.localConfigJsonPath` in prune-rollback.ts 1, `backup.recordConfigWrites(configWrites)` 1, `recordConfigWrite: discardConfigWrite` 1. `D-BG-1310` in `docs/dependency-resolution.md` 1.

## npm run check

`npm run check` ran once in the worktree at HEAD `65833926` (Node v26.13.0, `node_modules` linked to the primary checkout's). Exit status: **0**.

- `check:static`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed.
- `test:unpaired` and `test:integration` passed. The pi-subagents integration tests passed as well, against the 0.84.0 peer in `node_modules/.cache/optional-peers`.
- `test:cucumber`: adapter profile 1782 scenarios passed (21534 steps), builtin profile 153 scenarios passed (2071 steps).
- `test:coverage:direct:all`: passed, `Merged LCOV: coverage/direct.lcov (352 records)`.

AGENTS.md "Build verification" still applies after the merge: the batch coordinator runs `npm run check` on the merged tree in the main checkout.

## Deviations from Plan

### Coordinator amendments (binding)

**1. Shared records not edited.** `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, and `.planning/DUBIOUS-CHOICES.md` are unchanged. Their texts are under `## Parent lines`, adjusted for fail-closed. Task 3 committed only `docs/dependency-resolution.md`, so its `<verify>` greps for those three files do not apply here.

**2. Fail closed instead of debug-log and succeed.** An invalid layer and a failed write now fail the command. The plan's `hookDebugLog` lines do not exist.

- U4 became `a layer that turns invalid during the sweep fails the uninstall unsaved and keeps its text`. It expects one error row `x (failed) {unreadable}` with the cause `Config file "claude-plugins.local.json" failed schema validation.`, unchanged `state.json`, and the local file still holding `{ not json`.
- U5 became `a layer write that fails fails the uninstall unsaved and keeps the entry`. It expects `x (failed) {permission denied}` with the EACCES cause. The assertion replaces write-file-atomic's random temporary-file suffix with a placeholder before it compares the whole message.

**3. [Rule 2] Readability check before the member loop.** The first fail-closed version checked the layers only after the loop. On S4 it produced `{rollback partial}` with `[skills] Prune rollback requires manual directory restore at lib-skill.`, because a prune rollback cannot put skill directories back. So `sweepOrphans` now also reads both layers before any member is unstaged. An invalid file then refuses with nothing removed, and the rollback has nothing to restore. The read after the loop stays, for a file that changes during the sweep. New cases cover the check: U4b (`a layer that turns invalid before the member loop refuses before any member leaves disk`), P4 (`an invalid config file refuses the prune before the orphan leaves disk`), and S4.

**4. Guide texts R6 and R7.** R6's last two sentences, which described the debug-log behavior, were replaced: "If a config file of the scope is invalid, the command refuses with `{unreadable}` before it removes a dependency. If a config file cannot be written, the command fails. Fix the file and run the command again." R7 is as planned.

### Other

**5. Worktree setup.** The worktree already held a copied `node_modules` directory with no `.init-done` and no `optional-peers` cache. So `ln -s` first created `node_modules/node_modules`. I removed that link, moved the copied directory to the session scratchpad, and linked the primary checkout's `node_modules`. Before returning, I removed the link and moved the copied directory back. No tracked file was affected.

**6. Test helpers.** `uninstall.test.ts` gained `PRUNE_SCOPE_REPORT`, `configText`, `seedPruneLayers`, `uninstallXWithPrune`, and `corruptingLocalOn`, so that `fallow dupes` finds no clone. `prune.test.ts` gained `ORPHAN_DISABLED_LAYER`, `seedOrphanLayers`, and `failingSave`. No `fallow-ignore` marker was added.

**7. No move of `ConfigLayerWrite`.** The type-only import from `uninstall.ts` into `prune-rollback.ts` passed the fallow boundary and cycle gates, so the type stays in `uninstall.ts`.

## Questionable choices

1. **Both layer files are swept.** Upstream's prune edits one settings file per scope, and the item names only `claude-plugins.json`. Under SC-1 the local file is a layer of the same scope, and `overwriteDisabledMemberEntries` sets the precedent. Severity: Medium.
2. **Only `enabled: false` entries go.** Claude Code deletes the entry whatever its value. D-04-02 keeps an enabled entry as the user's request to install, and the user confirmed this on 2026-11-09. PRUNECFG-02 holds the rest. Severity: High (decided by the user).
3. **A failed layer write fails the command** (user answer). Claude Code logs the failure and goes on, so this diverges, licensed by D-BG-1310. The cost: the write runs after the members left disk. A prune then rolls back to `{rollback partial}` with a manual skill-directory restore. `uninstall --prune` leaves the artifacts gone and the records saved as before, until a retry converges. Severity: Medium.
4. **An invalid layer refuses the command, checked before the member loop.** This follows the house rule to fail closed on corrupt data. `prune` never read the config before, so it now refuses while either layer of the scope is invalid, even when the file would hold nothing to delete. The check reads only when the sweep has members. Severity: Medium.
5. **`uninstall --prune` restores no config file on a refused save.** Its NFR-3 model is retry convergence, and the user confirmed it. The retry proof pins that the named plugin's own declaration stays deleted. U7 pins the same for the members. Severity: Medium.
6. **The deletion runs once per sweep, after the member loop**, not inside the member body. So each file gets one write, and the member body stays total. Severity: Low.
7. **`sweepOrphans` takes a recorder** that the named uninstall discards, instead of returning the writes. A pass that a later layer's failure stops still reports its earlier write to prune's rollback. Severity: Low.
8. **A symlinked config file now fails a prune** that has a disabled entry to delete in it (NFR-10). A prune never wrote the config before. Severity: Low.
9. **A new decision ID, D-BG-1310**, instead of rewriting D-BG-1309 in place. Severity: Low.
10. **Scenario E keeps its title and gains a `Then`.** The local-config case, the `uninstall --prune` case, and the invalid-file refusal (S4) are new scenarios. Severity: Low.
11. **`.planning/DUBIOUS-CHOICES.md` is not edited.** Six batch items would change adjacent lines of its list. Severity: Low.
12. **The readability check sits inside `sweepOrphans`**, after `prune.ts` made its backup, not before `preparePruneRollback`. A refusal therefore creates a backup and rolls back nothing. S4 and P4 show that this leaves no backup directory and no `{rollback partial}`. The check stays in one place for both commands. Severity: Low.
13. **The failure rows reuse the existing reasons.** `uninstall --prune` narrows the errors as it narrows a cascade failure: `{unreadable}` for an invalid file and for a symlink refusal, `{permission denied}` for EACCES. `prune` shows its usual `(prune) {unreadable}` row. No new reason member was added. Severity: Low.
14. **`uninstall --prune` reads the layers again** in the sweep, though its CFG-03 read at the start of the closure already refused an invalid layer. The check costs two reads and covers a change made during the command. Severity: Low.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-cpl-04 changed with the user's fail-closed answer: a failed config write now fails the command, so a prune rolls back, instead of committing with a debug line. T-cpl-05 no longer applies, because the sweep logs nothing.

## Known Stubs

None.

## Parent lines

### .planning/PROJECT.md

Insert this row on the line right after the D-BG-1309 row:

```text
| **D-BG-1310 (behavioral-gaps, quick 261109-cpl, decided by the user on 2026-11-09, see DUBIOUS-CHOICES.md P13-DC-04): `prune` and `uninstall --prune` delete a removed dependency's `enabled: false` declaration**: The sweep that both commands share (`sweepOrphans` in `orchestrators/plugin/uninstall.ts`) runs this step after its member loop and before the state save. It deletes the key of each dependency it removed from each config file of the scope, `claude-plugins.json` and `claude-plugins.local.json`, whose entry reads `enabled: false`, with one write per file. An enabled entry stays (D-04-02, BACKLOG PRUNECFG-02), and so does the entry of a dependency that failed to unstage. An absent file is not created, and a file with nothing to delete is not rewritten (WR-02). The sweep fails closed: it reads both files before any member leaves disk and again before it writes, and an invalid file refuses the command with `{unreadable}`. A failed write and a containment refusal (NFR-10) fail the command. When a prune's state save fails, the prune rollback restores both files: it snapshots them and writes an original back only while the file holds the sweep's own write (NFR-3). When the state save of `uninstall --prune` fails, the deletions stay, as the named plugin's deleted declaration does, and the same command run again converges. This reverses D-BG-1309. | Claude Code 2.1.319's `pruneOrphanedAutoDeps` (function `bEi` in the binary) deletes `enabledPlugins[id]` of each removed plugin, whatever its value, from the one settings file of the prune scope (user, project, or local settings). Under SC-1 a scope keeps its declarations in two layer files, so the sweep reads both, as `overwriteDisabledMemberEntries` does for cascade members. Claude Code only logs a failed settings write and goes on; the user chose to fail closed instead (2026-11-09), as the project does for corrupt data. | ✓ Good |
```

In the D-BG-1309 row, change the last cell from `-- Revisit` to `Reversed 2026-11-09 by D-BG-1310`. The decision and rationale cells stay byte for byte.

### .planning/BACKLOG.md

Replace the PRUNECFG-01 heading with the first line below. Put the paragraph after it between the heading and the existing `Noted 2026-11-08 ...` paragraph, which stays unchanged:

```text
## ~~PRUNECFG-01: a pruned disabled dependency keeps its `enabled: false` declaration~~ -- CLOSED

**CLOSED 2026-11-09** by quick task 261109-cpl (fixed, D-BG-1310). The sweep that `prune` and `uninstall --prune` share now deletes the `enabled: false` declaration of each dependency it removes, from both config files of the scope. An invalid config file refuses the command before any dependency is removed, and a failed write fails it. When a prune's state save fails, the prune rollback restores both files. The disabled-dependency scenario of `features/plugin/prune.feature` checks the config, and new scenarios cover the local config, `uninstall --prune`, and the invalid-file refusal. An enabled declaration of a pruned dependency still stays, and PRUNECFG-02 holds that question.
```

Insert this new entry right after the PRUNECFG-01 entry, before `## PLUGALIAS-01`:

```text
## PRUNECFG-02: a pruned dependency's enabled declaration stays, so the next load plans its install

Noted 2026-11-09 (quick 261109-cpl, D-BG-1310). The sweep of `prune` and `uninstall --prune` deletes only a removed dependency's `enabled: false` declaration. An enabled declaration stays: a `{}` entry written by hand, or the `enabled: true` that `enable <dependency>` writes over the entry of an earlier `disable`. With no record left, `pending` lists the plugin's install, and `apply` installs it again. Claude Code 2.1.319's `pruneOrphanedAutoDeps` deletes the `enabledPlugins` entry of each removed plugin, whatever its value. Candidate direction: decide whether an enabled declaration of a dependency is the user's request to install it (keep it, D-04-02) or a leftover (delete it, as Claude Code does).
```

### CHANGELOG.md

Insert this sub-bullet in the `## [Unreleased]` entry, right after the sub-bullet that starts `A config that a load writes from the installation records`, indented two spaces like its siblings (23 words):

```text
  - `prune` and `uninstall --prune` now also delete a removed dependency's `enabled: false` entry from the scope's config files, and refuse while one is invalid.
```

### .planning/DUBIOUS-CHOICES.md

Mark P13-DC-04 fixed by quick 261109-cpl (D-BG-1310), both in "Decisions waiting on you" and in the Phase 13 list. Suggested status text: `Fixed 2026-11-09 by quick 261109-cpl (D-BG-1310): the sweep deletes a removed dependency's enabled: false declaration from both config files, and fails closed on an invalid or unwritable file.`

No STATE.md or ROADMAP.md lines; the quick-batch workflow records the task.

## Self-Check: PASSED

- The 13 modified files exist in the worktree, and `git diff --stat 9a398226..HEAD` lists them.
- `d84d15f1`, `cc3e063b`, and `65833926` are ancestors of HEAD.
- `git rev-list --count 9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c..HEAD` is 3.

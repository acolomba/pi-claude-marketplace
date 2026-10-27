---
quick_id: 261027-b8d
phase: quick-261027-b8d
plan: 01
status: complete
subsystem: plugin package dependencies
tags: [package-install, uninstall, autoupdate, byte-order-mark]
requires: [D-PL9-06, D-PL9-08, D-PL9-14, FMBOM-01]
provides: [D-PL9-20, D-PL9-21, D-PL9-22, PKGDEP-05 closed, uncertain choice 46 resolved]
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/domain/package-lockfile.ts
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - test/orchestrators/marketplace/update.test.ts
    - features/plugin/package-dependencies.feature
    - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
    - test/orchestrators/plugin/package-install.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - test/orchestrators/plugin/uninstall.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - extensions/pi-claude-marketplace/domain/package-lockfile.ts
    - test/domain/package-lockfile.test.ts
    - .planning/phases/09-plugin-package-dependencies/09-CONTEXT.md
    - .planning/phases/09-plugin-package-dependencies/09-05-SUMMARY.md
    - .planning/phases/09-plugin-package-dependencies/09-REVIEW-DISPOSITION.md
decisions:
  - "D-PL9-20: a failed, timed-out, or refused package install stays an install-time warning (uncertain choice 2 kept)"
  - "D-PL9-21: marketplace update with autoupdate on shows an updated plugin's package note as a warning diagnostic after the cascade rows"
  - "D-PL9-22: uninstall removes the node_modules the package step marked, inside the extension root, unless another record runs from the folder"
metrics:
  completed: 2026-10-27
actuals:
  tasks: 3
  commits: 3
plan_head_before: 070457ea
plan_head_after: 62d64d34
---

# Quick task 261027-b8d: autoupdate package note, uninstall node_modules, byte-order mark

An autoupdate cascade now shows an updated plugin's package note. Uninstall removes the node_modules that the package step marked, so a later install runs the current lockfile again. Package files lose one leading byte-order mark before parsing, as Claude Code 2.1.310 does.

## Commits

| Task | Commit | Title | Hook (`npm run check:commit`) |
| --- | --- | --- | --- |
| 1 | `93e5cd3c` | fix(marketplace): show the package note of an autoupdated plugin | Passed |
| 2 | `b3320aa2` | fix(plugin): remove a plugin's installed packages on uninstall | Passed |
| 3 | `62d64d34` | fix(plugin): strip a byte-order mark before parsing package files | Passed |

All three ran through the hooks, with no `--no-verify` and no `--amend`. The titles name no phase, plan, quick task, or wave.

## RED evidence

Scratchpad: `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-pl-p9-pkgdeps-daec0a/301d64c5-00dc-4469-9c71-a274fd95f316/scratchpad/`

- `quick-b8d-red-autoupdate-note.log`: the scenario "A marketplace update with autoupdate on that moves a plugin whose package install fails reports the warning" failed at `the command reports these results:`. Only the cascade arrived, and the diagnostic row was missing. `RED_EXIT=1`.
- `quick-b8d-red-uninstall-packages.log`: the scenario "Installing a plugin again after uninstalling it installs the packages its current lockfile lists" failed at `the npm registry receives these requests:`. No request arrived, because the old node_modules survived the uninstall and the install skipped the step. `RED_EXIT=1`.
- `quick-b8d-red-bom.log`: the three "reads <lockfile> text that starts with one byte-order mark" cases (package-lock.json, npm-shrinkwrap.json, bun.lock) and the package step's one-mark case failed (4 failures: a marked file was "not valid JSON"). The two-mark cases passed both before and after the change, as they should. `RED_EXIT=1`. The tests were renamed after this run for grammar only.

Unit cases were also checked for RED by disabling the change for one run: the D-PL9-21 update.test.ts case failed without the `surfaceCascadePackageNotes` call. Five package-install.test.ts cases failed without the marker write. Three uninstall.test.ts cases (standalone, orchestrated, `--prune`) failed without the `removeUnusedPackages` call.

## Gate

- `quick-b8d-check.log` in the scratchpad above: `npm run check` ran unpiped on HEAD `62d64d34` and ended with `CHECK_EXIT=0` (915 scenarios passed, `coverage/direct.lcov` merged with 294 records).
- Node v26.12.1, npm 11.20.0.
- `npx fallow health` and `npx fallow dupes` exited 0 after task 2. No suppression marker was added, and no threshold changed.
- `git status --porcelain -- extensions test features rule-packs eslint.config.js` printed nothing after the gate.
- `git diff 070457ea --stat` over CHANGELOG.md, .planning/PROJECT.md, .planning/BACKLOG.md, shared/notify-reasons.ts, shared/notification-types.ts, and orchestrators/marketplace/update.messaging.ts printed nothing.

## Uncertain choices

Items 57-65 are also in `09-05-SUMMARY.md` under "Quick task 261027-b8d (57-65; total 65)".

57. **How uninstall knows that the step wrote node_modules (D-PL9-22).** The step writes `node_modules/.pi-claude-marketplace` into the work dir's tree before the rename, so the marker moves in with the tree. A rule that the rename is the only writer is false for a git clone that tracks a vendored node_modules. A state-record field needs a schema change.
58. **A marker write that fails is ignored.** That tree moves in unmarked, and uninstall keeps it (WR-03's old behavior for that one plugin). A work dir with no node_modules fails the write in the same way, and the "nothing to move" arm then runs.
59. **A shared folder stays.** Another installed record of the scope with the same `resolvedSource` keeps node_modules. The check reads the saved state outside the lock, as the clone GC does (Phase 7 owns lock discipline for cleanups).
60. **The removal moves node_modules into `sources-staging` and deletes it there.** A failed delete leaves the copy there. A failed move is only debug-logged. The removal takes `Pick<PackageInstallOps, "newWorkDirName">`, so it cannot start a package manager (NFR-5).
61. **A node_modules written before this change has no marker,** so uninstall keeps it. Only this unreleased branch made such installs.
62. **The autoupdate cascade shows only the package note.** It does not show the outcome's other `notes`. WRN-02 owns cascade warnings.
63. **The note is sent from `orchestrators/marketplace/update.ts`** (`refreshOneMarketplace`), after the cascade rows and before the MCP config notices. `update.messaging.ts` is unchanged. `update.ts` now imports `surfaceDiscoveryWarnings` from `orchestrators/plugin/shared.ts`.
64. **Byte-order mark: one mark only.** `shared/bom.ts` `stripBom` (Claude Code's `No`) is reused. Two marks are still refused.
65. **(new) The in-use check compares `resolvedSource` strings exactly.** Two records that reach one folder through different spellings of its path count as two folders. The writers store the resolved plugin root, so the spellings agree in practice. The clone GC also reads `resolvedSource` as stored.

## Overlap with Phase 1 (WRN-02)

`update.messaging.ts` is untouched. The `surfaceCascadePackageNotes(ctx, run, outcomes)` call in `refreshOneMarketplace` must give way to WRN-02's shared cascade-warning placement when that branch merges. If both stay, the package note shows twice.

## Doc residue

- `09-REVIEW-DISPOSITION.md` was updated in the task-3 commit, at the parent's request. WR-03 is now "Fixed" with `b3320aa2`, and the autoupdate residue reads "fixed in `93e5cd3c`". Its process-group residue clause was left as written, although D-PL9-19 (`f4161a34`) fixed it.
- `.planning/codebase/ARCHITECTURE.md`'s list of the plugin modules that marketplace code reaches is now incomplete. It is not edited here, and 09-05-SUMMARY "Deferred follow-ups" names it.
- `docs/output-catalog.md` has no entry for the new diagnostic on the autoupdate surface. It is not edited here, and 09-05-SUMMARY "Deferred follow-ups" names it.

## Files touched

Task 1: `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `test/orchestrators/marketplace/update.test.ts`, `features/plugin/package-dependencies.feature`.
Task 2: `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts`, `test/orchestrators/plugin/package-install.test.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `test/orchestrators/plugin/uninstall.test.ts`, `test/orchestrators/plugin/install-outcome.test.ts`, `features/plugin/package-dependencies.feature`.
Task 3: `extensions/pi-claude-marketplace/domain/package-lockfile.ts`, `test/domain/package-lockfile.test.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts`, `test/orchestrators/plugin/package-install.test.ts`, `.planning/phases/09-plugin-package-dependencies/09-CONTEXT.md`, `.planning/phases/09-plugin-package-dependencies/09-05-SUMMARY.md`, `.planning/phases/09-plugin-package-dependencies/09-REVIEW-DISPOSITION.md`.

## Deviations from Plan

1. **[Parent instruction] 09-REVIEW-DISPOSITION.md edited in the task-3 commit.** The plan said not to edit it. The parent's constraints asked for the WR-03 row and the autoupdate residue line to be marked fixed. The task-3 commit also adds the extra files to the 09-05-SUMMARY "Further files outside the Files line" table, and the ARCHITECTURE.md and output-catalog.md follow-ups to "Deferred follow-ups".
2. **[Order] Some unit cases were written after their code, not before.** The scenarios' RED runs came before any production change, as the plan asks, and so did the byte-order-mark RED log. In tasks 1 and 2, the update.ts call and the package-install and uninstall code were written before their unit cases. For each of those, RED was shown by disabling the change for one run (see RED evidence), and the change was then restored byte for byte.
3. **[Rule 2 - extra coverage] Uninstall success case run in both modes.** The plan asked for a standalone case. The case runs as a data row in standalone and orchestrated mode, so `apply`'s uninstall path (orchestrated) is proven too.
4. **[Rule 1 - tooling] An invisible byte-order mark literal was replaced.** One heredoc write put a literal U+FEFF into `test/domain/package-lockfile.test.ts`. It was rewritten as the `"\uFEFF"` escape before the RED run, so no source file holds an invisible literal.
5. **One extra uncertain choice (65)** was recorded, as `<doc_texts>` allows. The counts became "57-65" and "total 65", and the D-PL9-22 decision row cites choices "57-61, 65".

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

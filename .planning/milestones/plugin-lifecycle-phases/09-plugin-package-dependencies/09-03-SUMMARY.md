---
phase: 09-plugin-package-dependencies
plan: "03"
subsystem: plugin-install
tags: [npm, bun, update, reinstall, node_modules, containment]

requires:
  - "09-01: createPackagesPhase, DEFAULT_PACKAGE_INSTALL_OPS, the lockfile table and the containment check"
  - "09-02: the package scenarios (url-source marketplace, contained roots)"
provides:
  - "D-PL9-03 note for a plugin root outside the extension root (no spawn, no write)"
  - "force rule (D-PL9-06), park and restore of a replaced node_modules (D-PL9-04)"
  - "installUpdatedPackages and UpdatedPackagesTarget, wired around both swap returns of materializeLatestVersion (D-PL9-07)"
affects: [09-04, 09-05, update, reinstall, apply, update-cascade]

actuals:
  tokens: 8200
  tasks: 2
  commits: 2
plan_head_before: 00fc0681ddd0b434d3625111aa35953a63099656
plan_head_after: 8a7b23484e8df54ecba20b72939371c1ed5ef64b

tech-stack:
  added: []
  patterns:
    - "A post-swap hook that passes non-`updated` outcomes through by identity and only spreads a new `notes` array when the step returned a note"
    - "A replaced directory is parked inside the work dir, so the work dir's removal deletes it after a success"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
    - test/orchestrators/plugin/package-install.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/update-flow.test.ts

key-decisions:
  - "Whether a node_modules is replaced comes from the detection's directory listing (replacesNodeModules), not from an ENOENT on the park rename"
  - "In the package-manager-wrote-none case the restore is not best effort: if it throws, the step reports the RUNERR note"
  - "A shared ignoreFailure function serves both the work-dir removal and the best-effort restore"

patterns-established:
  - "installUpdatedPackages(DEFAULT_PACKAGE_INSTALL_OPS, await swap(...), { locations, pluginRoot: preflight.installable.pluginRoot, policy })"

requirements-completed: [PKD-01, PKD-02]

duration: 31min
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 03: Local-folder Note and Updated-plugin Packages Summary

**A plugin that runs from the user's own folder now gets a note naming the exact `npm ci ...` or `bun install ...` command to run there, and the folder is never written. Every verb that lands an `updated` outcome through `materializeLatestVersion` now installs the new version's packages. A revision move replaces and, on failure, restores an existing node_modules. A same-revision reinstall keeps node_modules and stays offline. A failure adds a note and never fails the update.**

## Performance

- **Duration:** about 31 min (2026-10-27T04:13:46Z to 04:44Z)
- **Tasks:** 2 of 2
- **Files:** 0 created, 6 modified

## Accomplishments

- `package-install.ts`, D-PL9-03: when a root fails `assertPathInside` (it is outside the extension root, or a segment is a symlink), it now gets `Skipped installing this plugin's dependencies: its folder <root> is outside the folders this extension manages, so it was not changed. To install them, run "<command> <args>" in that folder.` A folder that already has node_modules gets no note.
- `package-install.ts`, D-PL9-06/04: the module-private step takes `force`. The skip now applies when node_modules is present and `force` is false. After the package manager succeeds, an existing node_modules moves to `<workDir>/previous-node_modules`. It moves back when the move in fails (best effort) or when the package manager wrote no node_modules. After a success, it is deleted with the work dir. `createdNodeModules` is true only when nothing was replaced. The ledger phase passes `force: false`.
- `installUpdatedPackages` returns any non-`updated` outcome as the same object. For an `updated` outcome, it runs the step with `force: policy.skipSameRevision` and appends the note to `notes` when there is one.
- `materialize-latest.ts`: one import and the two wrapped swap returns, each under a one-line D-PL9-07 comment. Nothing else changed.

## Task Commits

1. **Task 1: note the package install a local plugin folder needs (D-PL9-03).** `ac0c892d` feat(plugin): note the package install a local plugin folder needs
2. **Task 2: install an updated plugin's packages through the shared runner (D-PL9-07, D-PL9-06).** `8a7b2348` feat(plugin): install the packages of an updated plugin

Both commits passed the pre-commit hook (`npm run check:commit`: Passed).

## RED observations

- Task 1: with the HEAD `package-install.ts` swapped back in on a scratch copy, the two test files gave pass 105 and fail 4: both D-PL9-03 note rows, the symlink case, and the install-outcome case.
- Task 2: with the HEAD `materialize-latest.ts` swapped back in, the materialize-latest file gave pass 13 and fail 2 (both D-PL9-07 cases). The `installUpdatedPackages` cases import an export that did not exist before, so they failed on import.

## Restore-case errno text

The "restores the replaced node_modules when the move into the plugin root fails" case reads the expected text back before the act. It makes the same rename of an empty 0o555 `<extensionRoot>/sources-staging/work-1/node_modules` to `<pluginRoot>/node_modules` while the plugin root has no node_modules. On this host (Linux, Node v26.12.1, uid 1000) the text has this shape:

```text
EACCES: permission denied, rename '<extensionRoot>/sources-staging/work-1/node_modules' -> '<pluginRoot>/node_modules'
```

The expected note is `Plugin dependency install failed (npm): ` followed by that text. The test reads the real value back from the runtime and does not hard-code it, so the path and the wording can change between Node versions without breaking it.

## Verification

| Check | Exit |
| --- | --- |
| T1 verify 1: `node --test` package-install + install-outcome (109 pass, 0 fail) | 0 |
| T1 verify 2: direct coverage of package-install.ts, then install-outcome.ts | 0, 0 |
| T1 verify 3: note text present (`{"noteText":true}`) | 0 |
| T1 verify 4: HEAD subject and exactly the three files | 0 |
| T2 precondition: `id -u` = 1000 (not root) | met |
| T2 verify 1: `node --test` package-install + materialize-latest (72 pass, 0 fail) | 0 |
| T2 verify 2: direct coverage of package-install.ts, then materialize-latest.ts | 0, 0 |
| T2 verify 3: `{"hookUses":3,"force":true}` | 0 |
| T2 verify 4: ESLint over the four files (plus update-flow.test.ts), then `npm run fallow` | 0, 0 |
| T2 verify 5: HEAD subject and exactly the four files | 1 (expected: the commit holds five files, see Deviations) |

Extra run: `node --test 'test/orchestrators/**/*.test.ts' 'test/edge/**/*.test.ts' test/index.test.ts` gave 6320 pass, 0 fail (exit 0). `tsc --noEmit` exited 0. I did not run the full `npm run check`, because plan 09-05 owns the phase gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] update-flow.test.ts pinned one notification for an update whose clone dir it makes unreadable**
- **Found during:** Task 2, the broader orchestrator run
- **Issue:** `a post-commit clone cleanup failure preserves the successful update` sets `plugin-clones/` to mode 0o000 right after the swap's state write, then asserts `notifications.length === 1`. The new hook then cannot list the new plugin root under that directory. So, as plan 09-01 decided, it reports a skip note: `Skipped installing this plugin's dependencies: EACCES: permission denied, scandir '…'`. That note arrives as a second, warning-severity notification. This is the intended behavior, and the old count was a coincidence.
- **Fix:** the assertion now expects two notifications and a `warning` severity on the second. A comment cites D-PL9-07. No other line changed.
- **Files modified:** test/orchestrators/plugin/update-flow.test.ts (outside files_modified)
- **Commit:** 8a7b2348. It has to land with the hook: on its own commit, the test fails against the code before or after the hook.

**2. [Plan wording] the outside-root npm and bun cases are one data-driven loop**
- The behavior block lists the updated 09-01 npm case and a separate bun case. I wrote them as two rows of one `for` loop: `D-PL9-03: names the {npm|bun} command for a {lockfile} plugin outside the extension root and writes nothing`. Each row is its own `test()`, so the cases stay the same.

### Uncertain choices (for review)

1. **Replace detection from the listing instead of from ENOENT.** The plan says to rename an existing node_modules aside, with ENOENT meaning nothing to park. I instead carry `replacesNodeModules` from the directory listing that the detection already made, and I park only when that flag is true. Any park error, including ENOENT from a race, becomes the RUNERR note, and node_modules stays in place. The result is the same, with one fewer catch branch to cover. To match the plan's wording instead, put a try/catch on the park rename and add a case for a park that fails.
2. **Restore in the package-manager-wrote-none case is not best effort.** If moving the parked directory back throws there, the error becomes the RUNERR note. Only the failed-move restore ignores its own failure, as the plan specifies.
3. **The symlink case is titled `T-09-15: ...`** (the threat ID it pins). The plan's wording is otherwise kept.
4. **A non-`updated` outcome is returned as the same object, and so is an `updated` outcome with no note**, so the "outcome deep-equals the input" cases pass by identity.

## Files outside files_modified

- `test/orchestrators/plugin/update-flow.test.ts`: one assertion, the notification count, now 2 with a warning second (Deviation 1).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-09-15 is pinned by the symlink case: a root under `<extensionRoot>/plugin-clones/link/` whose `link` points outside gets the note, and neither the link target nor the plugin folder gains an entry. T-09-16 is pinned by the two restore cases. T-09-17 holds because the park path is `<workDir>/previous-node_modules`.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
- FOUND: commit ac0c892d (ancestor of HEAD)
- FOUND: commit 8a7b2348 (ancestor of HEAD)

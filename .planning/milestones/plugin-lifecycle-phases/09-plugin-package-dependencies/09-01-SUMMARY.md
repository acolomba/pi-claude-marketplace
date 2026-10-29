---
phase: 09-plugin-package-dependencies
plan: "01"
subsystem: plugin-install
tags: [npm, bun, child_process, install-ledger, rule-pack, eslint]

requires: []
provides:
  - "platform/package-manager.ts: createPackageManagerRunner and NODE_PACKAGE_MANAGER_SPAWN (no shell, SIGTERM then SIGKILL, 64 KiB capture per stream, never rejects)"
  - "orchestrators/plugin/package-install.ts: createPackagesPhase, DEFAULT_PACKAGE_INSTALL_OPS, PackageInstallOps, PackagesPhaseContext"
  - "install ledger phase order skills, commands, agents, hooks, mcp, workflows, packages, state"
  - "child-process-chokepoint rule-pack rule, fourth SHELL_OUT_EXEMPT_TARGETS entry, BLOCK C zone PACKAGE_INSTALL_SEAM"
affects: [09-02, 09-03, 09-04, 09-05, install, install-cascade, enable, import, apply]

actuals:
  tokens: 18760
  tasks: 2
  commits: 2
plan_head_before: 0ca3ee8ea8eec09e7ba400936f1b4b5c5e88ed0f
plan_head_after: 7e44cb667d15bdc499a1f511e80da966244a07a0

tech-stack:
  added: []
  patterns:
    - "Phase factory typed on a narrow context slice, state kept in the factory closure (Phase<PackagesPhaseContext> in the Phase<InstallLedgerContext>[] array)"
    - "Detection as a small result union (skip | note | run) built from Checked<T> = { value } | { refusal } helpers"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/package-manager.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
    - test/platform/package-manager.test.ts
    - test/orchestrators/plugin/package-install.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/architecture/no-shell-out.test.ts
    - test/architecture/gate-targets.ts
    - rule-packs/architecture.json
    - eslint.config.js

key-decisions:
  - "The packages phase reads only locations, resolved.pluginRoot and discoveryWarnings; InstallLedgerContext is unchanged"
  - "A plugin root that does not exist is a quiet skip; a root that cannot be listed is a skip note"
  - "A failed work-dir removal is ignored; the failure or success note stands"

patterns-established:
  - "Package-manager notes travel in discoveryWarnings only (D-PL9-14), never bridgeWarnings"

requirements-completed: [PKD-01, PKD-02, PKD-03]

duration: 39min
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 01: Plugin Package Install Summary

**A contained plugin with package.json and a bun.lock, npm-shrinkwrap.json, or package-lock.json now gets Claude Code's frozen, script-free `npm ci` / `bun install` in a sources-staging work dir, as an eighth install-ledger phase between workflows and state. Failures and Claude Code's refusals become discoveryWarnings notes and never block the plugin.**

## Performance

- **Duration:** about 39 min (2026-10-27T03:04:41Z to 03:43Z)
- **Tasks:** 2 of 2
- **Files:** 4 created, 7 modified

## Accomplishments

- `platform/package-manager.ts`: one runner factory over an injected launcher. It passes the argv verbatim with `shell: false`, adds `npm_config_update_notifier=false`, SIGTERMs at the timeout, SIGKILLs after the grace, keeps 65,536 characters per stream, settles once, and never rejects (D-PL9-12, D-PL9-15).
- `orchestrators/plugin/package-install.ts`: the closed lockfile table (bun.lock, npm-shrinkwrap.json, package-lock.json, then the refused bun.lockb), the listing-field trigger, the D-PL9-06 node_modules skip, the containment check against `extensionRoot`, a work dir that holds only package.json and the lockfile, the rename of node_modules into the plugin root, the FAILED / RUNERR / SKIPPED notes cut to 500 characters, and an undo that removes only the node_modules its do created.
- Task 2 refusals, with Claude Code's texts: bun.lockb, yarn.lock or pnpm-lock.yaml with no table lockfile, a package.json that is not valid JSON or not an object, and a package.json or lockfile that is not a regular file (symlinks included) or is larger than 32 MB (`MAX_INPUT_FILE_BYTES = 33_554_432`).
- `install-outcome.ts`: one import, the `packagesPhase` constant, the array entry, and the four phase-count comments (now 8).
- Gates: `child-process-chokepoint` in `rule-packs/architecture.json` with the four sanctioned files, `platform/package-manager.ts` added to `SHELL_OUT_EXEMPT_TARGETS` and to the "exactly four files" whitelist case, and the `PACKAGE_INSTALL_SEAM` zone at the end of BLOCK C.

## Task Commits

1. **Task 1 (tracer): install a contained plugin's packages through the ledger, with the spawn gates.** `f5ddedc8` feat(plugin): install a plugin's own npm or bun packages
2. **Task 2: skip, with Claude Code's notes, the installs Claude Code refuses.** `7e44cb66` feat(plugin): skip package installs that Claude Code refuses

Both commits passed the pre-commit hook (`npm run check:commit`). The first attempt at the Task 1 commit failed the hook (see Deviations); no commit was made by that attempt.

## RED observations

- Platform and orchestrator modules: the test modules were written against modules that did not exist yet, so they failed on import before the code was written. I wrote each test file right after its module rather than strictly before, so this RED was not run separately for those two files.
- Phase-order case: with `packagesPhase` removed from the array on a scratch copy, `D-PL9-05: runs the packages phase after the workflows phase and before the state phase` failed (pass 0, fail 1). After the copy was restored, it passed.
- Task 2: with the Task 1 `package-install.ts` restored over the Task 2 version, the Task 2 test file reported pass 35, fail 10. The 10 failures were every refusal case. The two "runs X beside a bun.lockb" cases and the "npm beside a yarn.lock" case already passed, as the table order predicts.

## Verification

| Check | Exit |
| --- | --- |
| T1 verify 1: TAP name-pattern run of the two tracer cases (`# pass 2`, `# fail 0`) | 0 |
| T1 verify 2: `node --test` over package-manager, package-install, install-outcome, no-shell-out tests (104 pass) | 0 |
| T1 verify 3: direct coverage of package-manager.ts, package-install.ts, install-outcome.ts | 0, 0, 0 (100% each) |
| T1 verify 4: order / staleCounts / rule / zone (`{"order":true,"staleCounts":0,"rule":true,"zone":true}`) | 0 |
| T1 verify 5: ESLint over the ten files, then `npm run fallow` | 0 |
| T1 verify 6: HEAD holds exactly the ten files | 1 (expected: the commit holds 11 files, see Deviations) |
| T2 verify 1: `node --test test/orchestrators/plugin/package-install.test.ts` (45 pass) | 0 |
| T2 verify 2: direct coverage of package-install.ts | 0 (100%) |
| T2 verify 3: the six refusal texts and constants present (`{"missing":[]}`) | 0 |
| T2 verify 4: HEAD subject and the two files | 0 |

Measured direct coverage after Task 2: package-install.ts 100% lines, branches, and functions. `npm run test:modules` passed after the install-flow fix (exit 0). The full `npm run check` was not run: plan 09-05 owns the phase gate.

I checked the BLOCK C zone with a temporary untracked file (`orchestrators/plugin/zz-planted-probe.ts`) that imported `platform/package-manager.ts`. ESLint reported `import-x/no-restricted-paths` with the D-PL9-10 message. I deleted the file before any commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] install-flow.test.ts staging census pinned the seven-phase order**
- **Found during:** Task 1 commit (hook failure)
- **Issue:** `install cleans up each bridge staging root inside its own phase and a repeat install changes nothing` in `test/orchestrators/plugin/install-flow.test.ts` deep-equals the full phase census. The hook ran every pair because `test/architecture/gate-targets.ts` was staged, and the census now shows `before:packages`.
- **Fix:** added the `"before:packages skills=empty commands=empty agents=empty"` row between workflows and state. No other line changed.
- **Files modified:** test/orchestrators/plugin/install-flow.test.ts (outside files_modified)
- **Commit:** f5ddedc8

**2. [Rule 2 - Coverage] two cases beyond the behavior block**
- **Found during:** Task 1 direct coverage (package-install.ts was at 65/66 branches and 20/21 functions)
- **Fix:** added `reports a plugin root it cannot list as a skip note and runs nothing` (root mode 0o000, readdir EACCES, which reaches the rethrow in the entry listing) and `keeps the failure note when the work dir cannot be removed` (a 0o555 directory in the work dir, which reaches the ignored `rm` rejection). I also added `skips a plugin root that does not exist and runs nothing` for the plan's "a missing root is a skip".
- **Commit:** f5ddedc8

**3. Detection-error case restores the mode in `finally`, not `t.after`**
- **Issue:** `t.after` hooks run in registration order, so the hermetic root was removed before the chmod restore ran, and the restore failed with ENOENT.
- **Fix:** the chmod restore runs in a `try`/`finally` around the act step, the form `install-outcome.test.ts` already uses.

**4. Small comment edits beyond the count change**
- `install-outcome.ts` line 1065: "a 7-element" became "an 8-element" (the article changes with the number).
- `eslint.config.js` BLOCK C header: "The last four keep the ledger modules apart" became "The next four", and one sentence names the final PACKAGE_INSTALL_SEAM zone. Without this edit the header would be wrong.

## Files outside files_modified

- `test/orchestrators/plugin/install-flow.test.ts`: the one census row above. The phase order change requires it, and the commit hook fails without it.

## Uncertain choices

- `PACKAGE_INSTALL_SEAM` is a string constant, not an array. The zone's `target` extglob names the basename directly, as the plan specifies.
- `newWorkDirName: randomUUID` passes `randomUUID` directly instead of wrapping it in an arrow. A wrapper would be a function no test calls, and it would cost a direct-coverage point. The signature is stable and the call passes no arguments.
- Task 1 alone treats a package.json that does not parse as a detection throw, so it gets a skip note with the parser message. Task 2 replaces that with "its package.json is not valid JSON".
- `requirements-completed` lists PKD-01..03 because this plan addresses them. I did not tick them in REQUIREMENTS.md: PKD-01's update half is plan 09-03's update hook, and PKD-03's NFR-5 governance text goes to the parent through the phase SUMMARY (09-05).
- Windows: `npm` is `npm.cmd` there, and with `shell: false` the spawn fails. PKD-02 turns that failure into a note. This is a known limit, recorded in RESEARCH section 6.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Plan 09-03 can import `createPackagesPhase`'s module for the update hook and add the D-PL9-03 note for a root outside the extension root. Until then such a root is skipped silently.
- Plans 09-02 and 09-04 can drive the behavior through the real ledger. Every existing fixture plugin ships no package.json, so the new phase does nothing in them.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/platform/package-manager.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
- FOUND: test/platform/package-manager.test.ts
- FOUND: test/orchestrators/plugin/package-install.test.ts
- FOUND: f5ddedc8 (ancestor of HEAD)
- FOUND: 7e44cb66 (ancestor of HEAD)

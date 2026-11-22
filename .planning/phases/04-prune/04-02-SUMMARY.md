---
phase: 04-prune
plan: "02"
subsystem: orchestrators/plugin (prune rollback)
status: complete
tags: [prune, nfr-3, backup-leak, cucumber, unit-tests]
requires: ["04-01"]
provides:
  - backup-root removal that grants owner permission first and treats an absent root as removed
  - scenario F03 and the no-backup Then step
  - four unit cases in the prune-rollback pair
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
tech-stack:
  added: []
  patterns:
    - lstat-based permission walk through Promise.all (no await in a loop)
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - test/orchestrators/plugin/prune-rollback.test.ts
    - features/step_definitions/plugin/prune.steps.ts
    - features/plugin/prune.feature
decisions:
  - "The prune backup root is removed through one private helper at all three removal points; the helper grants owner rwx on every directory (lstat, no symlink follow) and skips the walk for an absent root (NFR-3)."
metrics:
  duration: "about 12 minutes (01:51:42Z to 02:03Z)"
  completed: 2026-11-22
actuals:
  tokens: 32776
  tasks: 2
  commits: 1
plan_head_before: a7bdce10a04146e0e986f571871ae455f9f5dcfa
plan_head_after: d24f9374ca99346fcdb0a2534d5183bc53a29541
---

# Phase 04 Plan 02: Prune backup leak fix Summary

A prune whose member fails on a plugin's read-only skill directory no longer leaves its `prune-backup-XXXXXX/` directory behind: `prune-rollback.ts` now removes the backup root through `removeBackupRoot`, which gives the owner read, write, and search permission on every backup directory (without following a symlink) before the forced removal, and skips that walk when the root is absent.

`plan_head_after` above is the fix commit `d24f937`; the SUMMARY commit follows it.

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase04-plan02/`
- Checkout root (B1's `root=` line): `/home/user/pi-claude-marketplace/.claude/worktrees/agent-a2c3694f6a7d97d5a`
- Plan base (`plan-base`): `a7bdce10a04146e0e986f571871ae455f9f5dcfa`
- Fix commit: `d24f937`, commit time 1795312857 (2026-11-22T02:00:57Z).

**Natural red of F03** (`fix-red-adapter.log`, mtime 1795312396 = 01:53:16Z, before the fix commit; `extensions/` clean): `41 scenarios (40 passed, 1 failed)`, `exit=1`, no step timeout. Failure list: `1) Pruning leaves no backup in the scope when it could not remove a member (NFR-3) # features/plugin/prune.feature:642`, failing step `Then the prune has left no backup in the project scope # features/step_definitions/plugin/prune.steps.ts:71`, `AssertionError`: actual `[ 'prune-backup-v4vWqE' ]`, expected `[]`.

**Unit red** (`unit-red.log`, mtime 1795312513 = 01:55:13Z, before the fix; run through `$S/nondac-sh`, no chmod-guard hint in the log): ` tests 3`, ` pass 0`, ` fail 3`, `exit=1`.

- `NFR-3: discard removes a backup that holds a read-only directory`: `deepStrictEqual` actual `[ 'prune-backup-ABC123' ]`, expected `[]`.
- `NFR-3: a rollback that restores everything removes a backup that holds a read-only directory`: actual `{ phases: [ 'backup cleanup' ], backups: [ 'prune-backup-ABC123' ] }`, expected `{ phases: [], backups: [] }`.
- `NFR-3: a refused snapshot removes a backup that already holds a read-only directory and rethrows the refusal`: `assert.ok(error instanceof PathContainmentError)` evaluated to false inside the `assert.rejects` validator, because the catch path's removal threw EACCES on the copied read-only directory and that error replaced the refusal.

**Absent-root case before the fix** (`absent-pre.log`, mtime 1795312514): ` tests 1`, ` pass 1`, `exit=0` (a forced `rm` ignores the absent root).

**Absent-root case against the unguarded helper** (`guard-red.log`, mtime 1795312537 = 01:55:37Z, before the fix commit; stage A of the fix, helpers present without the `pathExists` guard): ` tests 1`, ` pass 0`, ` fail 1`, `exit=1`. The validator's `assert.ok(error instanceof PathContainmentError)` failed: `grantBackupWrites` ran `lstat` on the absent root, which threw ENOENT, and that error hid the snapshot's `PathContainmentError`.

All three red logs predate the fix commit (verify script `verify-t1-7.sh`: `verify-mtimes=0`).

**Break B1** (`B1-adapter.log`, run on the committed tree `d24f937` by `bash $D/break.sh B1 adapter $D/brk/B1.json features/plugin/prune.feature`; `break.sh` copied unchanged from plan 04-01, `bash -n` clean):

- File and line: `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:533`, in `discard`.
- Exact change (from the log's diff):

  ```diff
  -        await removeBackupRoot(ops, backupRoot);
  +        await ops.removeBackup(backupRoot, { recursive: true, force: true });
  ```

- Count line: `41 scenarios (40 passed, 1 failed)`, `exit=1`, no step timeout.
- Failed: `1) Pruning leaves no backup in the scope when it could not remove a member (NFR-3) # features/plugin/prune.feature:642` at `Then the prune has left no backup in the project scope`, leaked `prune-backup-ahLIWH`.
- Passed: the other 40 scenarios of the file, F01 ("Pruning keeps a dependency whose dependent it could not remove (D-05-13)") and F02 ("Pruning again after the user repairs what a prune could not remove ...") among them.
- `restored=clean`; `git status --porcelain -- extensions/` printed nothing afterwards.

## Product fix

- **Defect.** `snapshotPath` copies each target with `cp`, which keeps a directory's mode, and the restore needs that because `sameEntry` compares modes. A member whose skill ships a `0o555` directory therefore gets a backup that holds a `0o555` directory, and a forced recursive `rm` cannot empty it (EACCES). The three backup-root removals all were that plain call, so `discard` only debug-logged the failure and the backup stayed in `<scope>/pi-claude-marketplace/` after every such prune, retry included.
- **Two module-private helpers** (between `artifactTargets` and `preparePruneRollback`, not exported; `grep -c '^export '` still 4):
  - `grantBackupWrites(root)`: `lstat`; returns unless it is a directory, so a symlink is never followed; `chmod(root, (stat.mode & 0o7777) | 0o700)`; `readdir`, then recurses into each entry through `Promise.all` (no `await` in a loop).
  - `removeBackupRoot(ops, backupRoot)`: runs the walk only when `pathExists(backupRoot)`, then calls the module's one remaining `ops.removeBackup(backupRoot, { recursive: true, force: true })`.
- **Three call sites** now `await removeBackupRoot(ops, backupRoot);`: the snapshot failure path (`catch`, then rethrow), the final cleanup of a rollback with no failures (its `backup cleanup` catch unchanged), and `discard` (its debug-log catch unchanged).
- **Order that avoids the recursion.** The three calls were replaced first (one `replace_all` edit, confirmed at lines 440, 489, 499), and only then were the helpers inserted, so the helper's own `ops.removeBackup` call was never rewritten into a self-call. No run hung.
- **Guard.** An absent root counts as removed, as a forced `rm` treats it, so the snapshot failure path rethrows its own error (proved by `guard-red.log` failing and the green run passing).
- **Why the walk never touches a kept backup or follows a symlink.** Only `removeBackupRoot` runs the walk, right before the root is removed. A rollback with failures skips the removal and keeps its backup for manual recovery, so the walk never runs on it. The walk uses `lstat` and recurses only into directories; it starts at the root `createBackupRoot` (`mkdtemp` under the extension root) returned. The existing symlink cases of the pair still pass.
- **Unit cases** (`test/orchestrators/plugin/prune-rollback.test.ts`, three module-local helpers after `seed`: `saveOutsideAgentIndex`, `addReadOnlySkillDirectory` with the `chmodDeniesThisProcess()` guard ending in `CHMOD_DENIAL_HINT`, and `restoreReadOnlyWrites`, called in a `finally` in each read-only case). The existing "snapshot preparation refuses an agent path outside the scope" case now calls `saveOutsideAgentIndex`, its assertions unchanged. The four new cases are the table of the plan; titles: three contain "read-only directory", one "absent backup root".
- **Coverage.** `env -i ... CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`: `Direct coverage passed: ... (branches 135/135, functions 24/24, lines 540/540)`, 100% line, branch, and function.
- **Green runs.** `unit-green.log`: ` tests 54`, ` pass 54`, ` fail 0`, `exit=0`. `green-prune.log`: `41 scenarios (41 passed)`, `exit=0`.

## Checks

`node --version`: `v24.22.3`. All runs used the `$S/nondac-sh` wrapper (and `NODE_OPTIONS=--max-old-space-size=6144` for npm scripts); each cucumber run used `--parallel 2`.

| Verify command | Script / log | Tree | Exit |
| --- | --- | --- | --- |
| F03 natural red | `verify-t1-1.sh` / `fix-red-adapter.log` | a7bdce1 + F03 + step, `extensions/` clean | verify 0 (cucumber exit=1, as required) |
| Unit red | `verify-t1-2.sh` / `unit-red.log` | a7bdce1 + tests, no fix | verify 0 (node exit=1, as required) |
| Absent root before fix | `verify-t1-3.sh` / `absent-pre.log` | same | verify 0 (node exit=0) |
| Guard red | inline command of step 5 / `guard-red.log` | stage A (unguarded helper) | node exit=1, as required |
| Unit green | `verify-t1-5.sh` + `verify-t1-5b.sh` / `unit-green.log` | final fix (= d24f937) | node exit=0; plan's `tests 48` grep failed, see Deviations; corrected 54 check 0 |
| Direct coverage | `verify-t1-5.sh` / `coverage-prune-rollback.log`, `coverage-prune-rollback-ci.log` | final fix | 0 |
| Feature green (adapter) | `verify-t1-5.sh` / `green-prune.log` | final fix | 0 |
| ESLint warm-up + `check:static` | `verify-t1-6.sh` / `lint-warm.log`, `check-static.log` | final fix | 0, 0 |
| Red logs predate fix; four files changed | `verify-t1-7.sh` | d24f937 | 0, 0 |
| B1 | `verify-t2.sh` / `B1-adapter.log` | d24f937 + B1, restored | 0 |
| Builtin profile | `verify-t2.sh` / `builtin.log` (`0 scenarios`) | d24f937 | 0 |
| `fallow audit --base a7bdce1` | `verify-t2.sh` / `audit.json` | d24f937 | 0 |
| Final files and clean tree | `verify-t2.sh` | d24f937 | 0 |

The commit hook (`git commit -F msg-1.txt` under the wrapper, `commit-1.log`) passed; inside this worktree it reported every hook as "(no files to check)", as the plan anticipated, so `check:static` and the pair's direct coverage above are the by-hand evidence. The wave's post-merge `npm run check` is the full verdict.

## Issues for the milestone

- `fallow audit --base a7bdce10a04146e0e986f571871ae455f9f5dcfa`: `verdict=pass`, `{"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}`, no diff-risk finding.
- Backups that an earlier release leaked stay on disk: the fix does not sweep existing `prune-backup-*` directories (RESEARCH Open Question 3, out of scope). The user may mention it at the PR or not.

## Deviations from Plan

1. **[Rule 1 - plan expectation] Unit-green count is 54, not 48.** The plan's unit-green verify greps ` tests 48` / ` pass 48`, counting top-level `test(` calls (44 before, 48 after, both confirmed). The file also has a data-driven loop (`rollback preserves replacement when ...`) that adds 6 runtime cases, so `node --test` reports 50 before this plan and 54 after it. The run passed all 54 (`fail 0`, `exit=0`). The corrected check is in `verify-t1-5b.sh`. The acceptance grep `grep -c '^test('` prints 48 as planned.
2. **The manual `SKIP=npm-check pre-commit run --files ...` step was not run.** The auto-mode classifier refused the command, and the orchestrator's rules forbid setting `SKIP=`. The commit went through the normal hook instead, which in this worktree checked no file. Prettier and the rest of the static checks ran through `check:static` (exit 0). CI's Lint workflow and the post-merge `npm run check` cover the pre-commit linters.
3. **`timeout` added** before each cucumber and unit command, as the orchestrator's rules ask. The plan's commands are otherwise unchanged.
4. **No commit ledger file under `.git`.** The worktree shell guard refused writing `gsd-plan-head-before-04-02` under the git dir. `$D/plan-base` holds the same base, and `commits: 1` is measured from it (`a7bdce1..d24f937`, the fix commit only, before this SUMMARY's commit).

## Parent lines

- **CHANGELOG.md** (no PR number; the parent adds it at the merge):
  `- A prune that cannot remove a plugin's read-only directory no longer leaves its \`prune-backup-\` folder behind in the scope's \`pi-claude-marketplace\` folder.`
  An optional second sentence, if the user wants to mention the old leaks: "Remove any such folder an earlier release left by hand."
- **.planning/BACKLOG.md:** None.
- **Key Decisions table:** None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts, test/orchestrators/plugin/prune-rollback.test.ts, features/step_definitions/plugin/prune.steps.ts, features/plugin/prune.feature
- FOUND: commit d24f937 on HEAD
- FOUND: fix-red-adapter.log, unit-red.log, absent-pre.log, guard-red.log, B1-adapter.log, builtin.log, audit.json in the scratch folder

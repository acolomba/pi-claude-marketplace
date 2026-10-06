---
phase: 261005-rk5
plan: 01
subsystem: tooling
tags: [codex, hooks, worktree, codegraph, npm]
status: complete
requires: []
provides:
  - host-agnostic linked-worktree setup script for Claude Code SubagentStart and Codex SessionStart
  - Codex SessionStart hook registration in the tracked .codex/config.toml
affects:
  - Codex sessions (GSD executors) started in linked worktrees of this repository
tech-stack:
  added: []
  patterns:
    - linked-worktree detection by git dir versus git common dir
    - same-repository guard derived from the script's own location (BASH_SOURCE)
key-files:
  created: []
  modified:
    - scripts/init-worktree.sh
    - .codex/config.toml
decisions:
  - The init script detects a linked worktree by comparing --git-dir with --git-common-dir and no longer depends on CLAUDE_PROJECT_DIR
  - The CodeGraph daemon starts only under Claude Code, which alone has the SubagentStop hook that stops it
  - The script still skips a Claude Code session's own checkout, a guard the brief did not name
  - The Codex hook command stays `bash scripts/init-worktree.sh` (the worktree's own copy), as the operator settled
metrics:
  duration: 9m
  completed: 2026-10-05
actuals:
  tokens: 1100
  tasks: 2
  commits: 1
plan_head_before: 6464aa0212df6abf99c49016b0be0dfbbbb05942
plan_head_after: cf3ae96c9dc7ea2d5b8aaf7f6ee3e115ec27d57e
---

# Quick Task 261005-rk5: Register the worktree init hook for Codex Summary

`scripts/init-worktree.sh` now finds a linked worktree of its own repository
without CLAUDE_PROJECT_DIR, and `.codex/config.toml` runs it as a Codex
SessionStart hook. A Codex session in a linked worktree gets its npm
dependencies and its own CodeGraph index before its first turn. Claude Code
behaves as before.

## Commits

| Task | Commit   | Message                                       | Files                                          |
| ---- | -------- | --------------------------------------------- | ---------------------------------------------- |
| 1    | cf3ae96c | chore(init): set up Codex worktree sessions   | scripts/init-worktree.sh, .codex/config.toml   |
| 2    | none     | verification only, no fix needed              | none                                           |

`tmp/rk5/show-1.txt`:

```text
 .codex/config.toml       |  7 +++++++
 scripts/init-worktree.sh | 18 +++++++++++-------
 2 files changed, 18 insertions(+), 7 deletions(-)
```

Committed blobs match the rehearsed pins: `scripts/init-worktree.sh`
3bedf65263f3fa3b092a2387036bc3098d90ba3d (mode 100755, 11 added, 7 removed),
`.codex/config.toml` 9543b551072b7c656f9328d0c2426ed8133e1a6c (7 added, 0
removed).

## Verification

Both task verify blocks printed `VERIFY_1_OK` and `VERIFY_2_OK` under zsh.

No `npm run check` ran: no commit in this plan stages a build input, and the
commit hook skipped `npm run check:commit`. The proof is the scratch Codex
session (R3), the 10-case contract (R2), the run against this repository (R5),
and the pre-commit hooks.

Last line of each log:

```text
tmp/rk5/commit-1.log: COMMIT_EXIT=0
tmp/rk5/contract-cleanup.log: CLEANUP_EXIT=0
tmp/rk5/contract.log: CONTRACT_EXIT=0
tmp/rk5/contract-verify-cleanup.log: SCRATCH_REMOVED=yes
tmp/rk5/contract-verify.log: CONTRACT_OK
tmp/rk5/hermetic-cleanup.log: CLEANUP_EXIT=0
tmp/rk5/hermetic.log: HERMETIC_EXIT=0
tmp/rk5/hermetic-verify-cleanup.log: SCRATCH_REMOVED=yes
tmp/rk5/hermetic-verify.log: HERMETIC_DONE
tmp/rk5/precommit-1.log: PRECOMMIT_EXIT=0
tmp/rk5/real-cleanup.log: CLEANUP_EXIT=0
tmp/rk5/real.log: REAL_EXIT=0
```

Each cleanup log also shows `LEFTOVER_PROCS=0`. The commit log shows
`npm run check:commit.................................(no files to check)Skipped`.

`tmp/rk5/static.log`: `SHELLCHECK=not-installed`. `bash -n` passed.

`tmp/rk5/versions.txt`:

```text
codex-cli 0.160.0
1.6.0
v26.10.0
git version 2.55.0
```

Fallow audit (main checkout's fallow, `--gate-marker agent`): verdict `pass`.

### Scratch Codex session (`tmp/rk5/hermetic-verify.log`)

```text
SESSION untrusted hooks_completed=0 hooks_failed=0
SESSION trusted hooks_completed=1 hooks_failed=0
WORKTREE untrusted marker=no index=no status=
WORKTREE trusted marker=yes index=yes status=
MAIN marker=no index=no
PROCS_NAMING_BASE=0
HERMETIC_DONE
```

### Guard contract (`tmp/rk5/contract-verify.log`, PASS lines)

```text
PASS codex-main
PASS codex-foreign
PASS codex-nongit
PASS codex-worktree
PASS codex-worktree-rerun
PASS stdin-empty
PASS stdin-not-json
PASS claude-main
PASS claude-own-checkout
PASS claude-worktree
```

### This repository (`tmp/rk5/real.log`)

```text
MAIN codex exit=0 out=0 err=0
MAIN claude exit=0 out=0 err=0
REAL_CODEX=deferred exit=0 elapsed=29s stdout=0
WORKTREE marker=yes index=yes status=
DAEMON_FOR_WT=0
RERUN exit=0 out=0 err=0
REAL_DONE
REAL_EXIT=0
```

Live check against this repository deferred: Codex reads project hooks from
the main checkout, whose working tree does not hold this commit yet. After the
merge, write R4 and R5 from the plan to `tmp/rk5/` in the main checkout and
run Task 2 steps 2 and 3 there; expect `REAL_CODEX=ran`.

## Deviations from Plan

None in substance. The sandbox refused inline commands that compute git
values, so the plan's commands ran unchanged from files under `tmp/rk5/`, as
the execution rules allow.

The commit trailer uses `Co-Authored-By: Claude Opus 5.5`, from the session's
attribution instruction, rather than the `Claude Fable 5.1` line the
orchestrator note gave.

## Flags for the operator

1. Trust the hook once. After the main checkout's working tree holds this
   commit, start Codex in the main checkout, open `/hooks`, and trust the
   SessionStart hook `bash scripts/init-worktree.sh`. Until then `codex exec`,
   which GSD uses for executors, skips it without a message. Codex reads
   project hooks from the main checkout, so this one review covers every
   linked worktree, as long as the main checkout's working tree keeps the
   hook.
2. The five workspaces under `~/src/` are on branches without
   `scripts/init-worktree.sh`. Once the hook is trusted, a Codex session
   there, or in an executor worktree branched from one, logs
   `hook: SessionStart Failed` and gets no setup until its branch merges this
   change. A session started in a subdirectory fails the same way. The command
   `bash "$(git rev-parse --path-format=absolute --git-common-dir)/../scripts/init-worktree.sh"`
   would avoid both, and would run the operator's own copy instead of the copy
   on a worktree's branch. The operator kept the relative command; a changed
   command needs a new trust review.
3. This task proves that the hook builds the worktree's own index before the
   first turn. It does not prove which index Codex's `codegraph serve --mcp`
   server uses in that session: the server may resolve its project before the
   index exists, and a CodeGraph launcher with no local index uses the
   enclosing checkout's index.
4. The script still skips a Claude Code session's own checkout, a guard the
   brief did not name.
5. CHANGELOG.md is unchanged: the #236 sub-bullet names only Claude Code
   subagents. Record the Codex hook at PR time.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/init-worktree.sh (blob 3bedf652, mode 100755)
- FOUND: .codex/config.toml (blob 9543b551)
- FOUND: cf3ae96c is an ancestor of HEAD

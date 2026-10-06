---
phase: 261005-sx5
plan: 01
subsystem: release-hygiene
tags: [changelog, docs, pre-commit, engines]
status: complete
requires: []
provides:
  - engines.node set to the write-file-atomic 8 range
  - TruffleHog limited to the pre-commit stage
affects: [CHANGELOG.md, package.json, package-lock.json, .pre-commit-config.yaml]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - CHANGELOG.md
    - package.json
    - package-lock.json
    - AGENTS.md
    - .planning/PROJECT.md
    - .planning/codebase/STACK.md
    - .planning/codebase/ARCHITECTURE.md
    - docs/prd/pi-claude-marketplace-prd.md
    - .pre-commit-config.yaml
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  deleted:
    - extensions/pi-claude-marketplace/bridges/README.md
    - extensions/pi-claude-marketplace/domain/README.md
    - extensions/pi-claude-marketplace/edge/README.md
    - extensions/pi-claude-marketplace/orchestrators/README.md
    - extensions/pi-claude-marketplace/persistence/README.md
    - extensions/pi-claude-marketplace/platform/README.md
    - extensions/pi-claude-marketplace/shared/README.md
    - extensions/pi-claude-marketplace/transaction/README.md
decisions:
  - engines.node mirrors the write-file-atomic 8 range (^22.22.2 || ^24.15.0 || >=26.0.0), the intersection with Pi's own requirement
  - TruffleHog runs only at the pre-commit stage via a per-hook stages key; no top-level default_stages
  - .planning/PROJECT.md tooling and runtime lines carry the same range, because AGENTS.md is generated from PROJECT.md
metrics:
  duration: ~12 min
  completed: 2026-10-05
actuals:
  tokens: 6700
  tasks: 2
  commits: 1
plan_head_before: 4e59e5f2bfe6590fa15bcdeff60d90c204686e36
plan_head_after: cba45a325cc5fde00b1506ca158dc2b686142638
---

# Quick 261005-sx5: Close the five pre-PR review findings Summary

One commit closes all five findings for PR #236. It folds the #234 changelog entry into #236 and deletes the eight stale per-layer READMEs. It lists all seven install ledger phases, stops TruffleHog at the commit-msg stage, and sets `engines.node` to `^22.22.2 || ^24.15.0 || >=26.0.0`. `npm run check` passes on the result.

## Commit

- `cba45a325cc5fde00b1506ca158dc2b686142638` `chore: close the pre-PR review findings`. It holds exactly 18 paths: 10 modified and 8 deleted, with 16 insertions and 153 deletions.
- Commit hook: `COMMIT_EXIT=0`, with a wall time of 255 s for `git commit`, hooks included. At the pre-commit stage, `npm run check:commit` reported **Passed**. It ran for real and did not report "(no files to check)". At the commit-msg stage, `npm run check:commit` was correctly skipped as "(no files to check)", and TruffleHog was not listed.
- Before the commit, `SKIP=npm-check pre-commit run --files <10 modified paths>` ended with `PRECOMMIT_EXIT=0`, and no fixer rewrote a file. Gitlint passed on the message beforehand.

## Lockfile route

The npm route was used. `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` returned `NPM_EXIT=0` and changed exactly one line: `package-lock.json:38`, the root `packages[""].engines.node`. Nothing was discarded, and no hand edit was needed.

## Hook-stage probe (S2)

- With the start config, the commit-msg stage lists 27 hooks, and 12 of them run on the message.
- With the new config, it lists 26 hooks, and 11 of them run. The list matches the start list with TruffleHog removed, line for line (`probe-hooks.diff` is empty).
- `gitlint` passed at commit-msg, and that stage exited 0.
- `pre-commit run trufflehog --files .pre-commit-config.yaml` printed `TruffleHog....Passed` with `EXIT=0`.
- `probe ok`. It printed again inside `verify-1.sh`, after the commit.

## Verification

- `bash tmp/sx5/verify-1.sh` printed `task 1 ok`.
- `bash tmp/sx5/verify-2.sh` printed `task 2 ok`.
- Final full gate: `npm run check`, run once in the executor worktree with output redirected to a log (not piped). Exit status `0`. Commit `cba45a325cc5fde00b1506ca158dc2b686142638`. Node `v26.10.0`. Duration 73 s. It covered typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration, and test:coverage:direct:all (merged `coverage/direct.lcov`, 258 records).
- A merge does not run the hook. After the worktree merges, the orchestrator runs `npm run check` in the main checkout, or reuses this result under the local-verification rule.

## Deviations from Plan

None. The plan ran exactly as written. Every script was saved verbatim and run as given. The only addition: the multi-command steps (precondition, lockfile, staging, commit, check) were wrapped in small `tmp/sx5/*.sh` helper scripts, because the worktree sandbox refuses compound shell commands. This follows the plan's rule that every multi-command step runs through bash.

## Observations for the operator

- `.planning/PROJECT.md` changed beyond the spec's list: the "Tooling baseline on `main`" line and the Runtime line. AGENTS.md's project block is generated from PROJECT.md, so the two must match, or the next regeneration reverts AGENTS.md.
- The PR's changelog pass may add internal lines for the README deletion and the TruffleHog stage change. This task added neither.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md` still ships in the npm package. It is a subdirectory file map, not a per-layer README, so it was left in place.
- Rows 39 and 40 of `.planning/WINDOWS.md` still name `platform/README.md`. They are historical ledger rows that only gsd-tools writes.
- `demos/run-browse-demo.sh:17` (and `:32`) still tell demo users they need Node 22.6 or later, which is below the new engines range. This plan left the file unchanged.
- When you record this task in STATE.md, describe the Node change without the old floor literal, for example "mirror the write-file-atomic Node range in engines". The final grep in `verify-1.sh` scans the live tree, STATE.md included.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: commit `cba45a32` is an ancestor of HEAD.
- FOUND: all 10 modified files are present. All 8 deleted READMEs are absent, and `orchestrators/reconcile/README.md` is present.
- `verify-1.sh` and `verify-2.sh` both passed on HEAD `cba45a32`.

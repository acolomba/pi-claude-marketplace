---
phase: 261005-rmz
plan: 01
subsystem: tooling/fallow
tags: [fallow, duplication, suppression, conventions]
status: complete
requires: []
provides:
  - inline code-duplication markers for the three reviewed render-arm clone groups
affects:
  - fallow dupes and fallow audit reports
tech-stack:
  added: []
  patterns:
    - "fallow-ignore-next-line code-duplication -- reviewed: <reason> above a render map's skipped arm"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
    - .planning/codebase/CONVENTIONS.md
decisions:
  - "Reviewed render-arm clone groups are hidden with inline code-duplication markers, not ignoredClones: fallow gives mid-expression fragments no stable key, only per-report -rN handles"
metrics:
  duration: 8m
  completed: 2026-10-05
actuals:
  tokens: 1500
  tasks: 1
  commits: 1
plan_head_before: 69aedc14b1a7a4fdf614439db620b018f82d5f70
plan_head_after: 9cc55ca9d5b5ae6ca97c8e69f28ef8626d101432
---

# Quick 261005-rmz: Hide the reviewed render-map arm clone groups from fallow Summary

Four identical `// fallow-ignore-next-line code-duplication -- reviewed: ...` markers above the `skipped:` arm of UPDATE_CONTEXT.render, ENABLE_RENDER, REINSTALL_RENDER, and UPDATE_RENDER drop exactly the three reviewed render-arm clone groups. `.fallowrc.json` is unchanged, and CONVENTIONS.md explains why these groups have no stable `ignoredClones` key.

## Results

| Item | Value |
| --- | --- |
| Commit | `9cc55ca9` build(fallow): suppress the reviewed render-map clone groups |
| Commit numstat | four `.ts` files `1 0`; CONVENTIONS.md `2 2` |
| `fallow dupes` groups | 42 before, 39 after (exactly the three targets removed) |
| Neighbour groups | enable-disable/install and enable-disable/fetch still reported |
| `fallow audit --base origin/main` | `pass` |
| `.fallowrc.json` `ignoredClones` | `["dup:cc950b18:2"]` (unchanged) |
| `fallow-ignore` marker count | 14 (CONVENTIONS.md updated to match) |
| `npm run fallow` (verify chain) | exit 0 |
| Commit hook | passed, about 10 s, but `prettier` and `npm run check:commit` reported "(no files to check)" (see Deviations) |
| `npm run check` on committed tree | exit 0 (Node v26.10.0) |

Baseline (Step 1) matched the plan: `-r24` (marketplace/update 86-95 + enable-disable 88-93), `-r38` (marketplace/update 92-94 + enable-disable 90-92 + reinstall 86-90), `-r10` (enable-disable 86-91 + plugin/update 68-77). No other group made only of render-map arms appeared.

## Deviations from Plan

**1. [Environment] Commit hook skipped `check:commit` and `prettier` inside the agent worktree**
- **Found during:** Step 5
- **Issue:** `git commit` ran the hook, but the two local hooks reported "(no files to check)" even though four staged `.ts` files match their `files:` patterns. A manual `pre-commit run prettier --files <ts file>` in the same worktree matched and passed. So the file filter fails only for the commit-time hook inside this nested worktree (`.claude/worktrees/agent-*`). A likely cause, not confirmed: the staged paths are resolved relative to the main checkout, and the top-level `exclude: ^(...|\.claude/|...)` drops them.
- **Mitigation:** `npm run check`, a superset of `check:commit` that includes `format:check`, ran on the committed tree and exited 0. The `SKIP=npm-check pre-commit run --files` run before the commit was also clean.
- **Not fixed:** this is outside the task's scope. It matters to the current branch (`features/faster-precommit`): commits made from agent worktrees under `.claude/worktrees/` may get no `check:commit` from the hook.

Otherwise the plan ran exactly as written.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: all five modified files; each `.ts` file has exactly one marker directly above its `skipped:` arm (verify chain "markers ok" and "dupes ok")
- FOUND: commit 9cc55ca9 is HEAD of the worktree branch

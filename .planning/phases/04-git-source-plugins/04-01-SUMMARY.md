---
phase: 04-git-source-plugins
plan: 01
subsystem: plugin git sources
tags: [cucumber, git-source, clone-cache, mirror]
requirements-completed: [INS-05, UPD-02]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - test/orchestrators/plugin/clone-cache.test.ts
    - features/plugin/git-source.feature
    - features/plugin/git-source-update.feature
    - CHANGELOG.md
commits: [791a60dd, 9b1eb193]
status: complete
completed: 2026-10-23
---

# Phase 4 Plan 01: Clone an unpinned plugin mirror once; a warm-cache update

**Product fix (D-05):** `materializeOrRefreshPluginMirror` no longer refreshes a
mirror it has just cloned, so the first install of an unpinned git plugin makes
one upload-pack pair, as `marketplace add` and Claude Code do. A warm mirror and
a `raced` promotion still refresh in place (D-79.1-02, D-79.1-03).

## Accomplishments

- `clone-cache.ts`: keeps the promotion result and skips `refreshGitHubClone`
  when it is `"renamed"`; doc comment updated.
- `clone-cache.test.ts`: the cold-mirror test asserts no fetch; the raced test
  asserts one refresh fetch; the PROV-03 auth test calls twice so the warm
  refresh carries the bundle. 66/66 pass.
- `git-source.feature`: the install Outline's request log is one pair for each
  of `github`, `url`, `git-subdir`.
- `git-source-update.feature`: new scenario "Updating a plugin to a revision
  the clone cache already holds makes no request" (UPD-02): `updated` from
  `{mono revision 1}` to `{mono revision 2}`, no request, a new session offers
  both 2.0.0 skills.

## Verification

- `node --test test/orchestrators/plugin/clone-cache.test.ts`: 66 pass.
- `npx cucumber-js features/plugin/`: 104 scenarios pass (after Task 1).
- `npx cucumber-js features/plugin/git-source-update.feature`: 2 pass.
- Commit hook (`check:commit`, direct coverage of the pair) passed on both commits.

## Deviations

- The first commit attempt was killed (exit 137) under machine load
  (load average ~100 from parallel sessions). pre-commit had stashed the
  unstaged `git-source-update.feature` edit and never restored it; it was
  recovered with `git apply` from `~/.cache/pre-commit/patch1792741142-1565526`
  and committed separately (9b1eb193).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

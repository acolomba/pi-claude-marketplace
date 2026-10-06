---
phase: 261004-u3o
plan: 01
subsystem: auth, info messaging
tags: [refactor, types, dead-members]
status: complete
requires: []
provides:
  - PLUGIN_INFO_RENDER typed as Record<PluginInfoStatus, RenderFn<PluginInfoCascadeMsg>>
  - DeviceFlowResult and AuthAttemptResult without the unread marker field
affects:
  - scripts/check-unused-type-members.exceptions.json (three entries now match no member)
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - extensions/pi-claude-marketplace/domain/auth-registry.ts
    - tests/domain/device-flow-contract.ts
    - tests/domain/github-auth.test.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/platform/git-auth-callbacks.test.ts
    - tests/platform/git.test.ts
decisions:
  - "E1 used the C-01 Record form; lint accepted it, no fallback needed"
  - "Commits ran without a pathspec after confirming the index held only the task paths, because `git commit -- <path>` tripped the TruffleHog hook"
metrics:
  duration: ~23min
  completed: 2026-10-04
actuals:
  tokens: 6346
  tasks: 2
  commits: 2
plan_head_before: e805dfd03c3fab587c80bcc8162e578b76dd6372
plan_head_after: 96d79b724eb2b1ce0b30f51da3125f88d9604127
---

# Quick Task 261004-u3o: Remove three unread type members Summary

The info render map now uses a `Record` over `PluginInfoStatus` with no `status` filter. The unread `authAttempted` marker is gone from `DeviceFlowResult`, `AuthAttemptResult`, every `initiateDeviceFlow` result, and every test literal. The D-32-05 comment citations are gone too.

Verification scope: focused task verification passed; full phase/PR verification pending.

## Commits

| Task | SHA      | Title                                                             |
| ---- | -------- | ----------------------------------------------------------------- |
| 1    | 930ec26f | refactor(info): type the info render map without a status filter |
| 2    | 96d79b72 | refactor(auth): drop the unread authAttempted flag               |

Commit 1 holds exactly `info.messaging.ts`. Commit 2 holds exactly the twelve auth paths. Neither commit contains a `.planning/`, `scripts/`, `.github/`, or `.pre-commit-config.yaml` path.

## Verification logs (`tmp/u3o/`, last line of each)

| Log                     | Last line                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| tests-1.log             | TESTS_EXIT=0 (4 tests, info.messaging.test.ts)                          |
| typecheck-1.log         | TYPECHECK_EXIT=0                                                         |
| lint-1.log              | LINT_EXIT=0 (0 errors; 19 warnings, none in info.messaging.ts)          |
| precommit-1.log         | PRECOMMIT_EXIT=0                                                         |
| gitlint-1.log           | GITLINT_EXIT=0                                                           |
| audit-1.json            | `"verdict":"pass"`                                                       |
| tests-2.log             | TESTS_EXIT=0 (706 tests, 11 files incl. no-credential-leak.test.ts)     |
| typecheck-2.log         | TYPECHECK_EXIT=0                                                         |
| lint-2.log              | LINT_EXIT=0                                                              |
| precommit-2.log         | PRECOMMIT_EXIT=0                                                         |
| gitlint-2.log           | GITLINT_EXIT=0                                                           |
| audit-2.json            | `"verdict":"pass"`                                                       |
| commit-1.log / 1b.log   | COMMIT_EXIT=1 (TruffleHog "files were modified", pathspec commit)       |
| commit-1c.log           | COMMIT_EXIT=0                                                            |
| commit-2.log / 2b.log   | COMMIT_EXIT=1 (operator edited `scripts/init.sh` during the hook run)   |
| commit-2c.log           | COMMIT_EXIT=0                                                            |
| trufflehog-diag.log     | DIAG_EXIT=0 (TruffleHog passes with an unstaged file stashed)           |

Selected hook scope (`npm run check:changed -- --list`):

- Task 1: scope `focused`, reason "Changed pairs and their production consumers".
- Task 2: scope `focused`, reason "Changed pairs and their production consumers; Test support and its consumers". The commit-time hook ran 2704 consumer tests, and all passed.

Plan F11 expected scope `broad`. The operator's ci.yml / `.pre-commit-config.yaml` edits were committed before this run (e805dfd0), so both runs were `focused`.

Task 1 `<verify>` exited 0. Task 2 `<verify>` passed every clause except the final `git status --porcelain -- extensions tests scripts docs` check. That check listed ` M scripts/init.sh`, an operator edit made in this checkout during the run. This task never touched or staged that file. With `scripts/init.sh` excluded, the status check is empty.

## E7 numstat and leftover check

- Tests numstat after `sed`, after Prettier, and in the commit: 3 added, 51 deleted. Every row matches the plan's E7 table.
- `git grep -n -e authAttempted -e D-32-05 -- extensions tests` printed `GREP_EXIT=1`, so nothing is left.
- Prettier left all twelve Task 2 files and the Task 1 file unchanged. No line was rewrapped.
- The `buildAuthCallbacks` body (from `export function buildAuthCallbacks` to the end of the file) is byte-identical before and after (`cmp` exit 0).

## Type-member gate state (OD-2)

`scripts/check-unused-type-members.exceptions.json` and `scripts/check-unused-type-members.contracts.json` are unchanged. Nothing was re-pinned. Neither `lint:type-members` nor `lint:type-members:audit` ran. The exceptions file still holds these three entries, which now match no member:

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts:68:69`
- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:41:39`
- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:42:34`

Until the follow-up gate-removal task lands, `npm run lint:type-members` and the last step of `npm run check` refuse because of these entries.

## Deviations from Plan

1. **[Rule 3 - Blocking] Commits ran without a pathspec.** The plan's `git commit -F msg -- <paths>` failed twice in Task 1: TruffleHog reported "files were modified by this hook", even though every check passed. Before each commit, `git diff --cached --name-only` showed that the index held only the task's paths. The commit therefore ran without a pathspec, and the result is the same commit. Task 2 committed the same way. Commit message files went to the session scratchpad, not `tmp/u3o/`, as the session constraints required.
2. **Concurrent operator edit.** During Task 2's first commit attempt, the operator edited `scripts/init.sh` (the hook reported "files were modified"). The second attempt hit the same kind of stash conflict. A diagnostic `pre-commit run trufflehog` with the unstaged file stashed passed, so the stash alone does not cause the failure. The third attempt succeeded. The operator's `scripts/init.sh` edit was left in place, unstaged, and never stashed or reverted by hand.
3. **Gitlint run.** Plan F12/F13 predate the installed hooks. Both messages were linted with the `--files` form, and the installed commit-msg hook linted them again at commit time.

No source edit deviated from E1-E7. No C-01 fallback was needed.

## Follow-ups (out of scope)

- Remove the type-member gate and its three stale exception entries (follow-up task 261004-u7n).
- `.planning/WINDOWS.md` waived deviations 36, 39, and 40 (recorded_at 2026-09-17T06:03:12.118Z, 06:03:14.040Z, 06:03:14.703Z) describe these members. Close them with `gsd-tools windows fixed <id>` if wanted.
- The `initiateDeviceFlow` doc comment sits above `safePollToken`, not above its own function (C-03).
- Add the CHANGELOG Internal line at PR time.
- `shared/notify-context.ts` keeps its own per-status filter. This task did not change it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-u3o-01 mitigated: the `buildAuthCallbacks` body is byte-identical, and the callbacks and auth-host tests pass. T-u3o-02 mitigated: no `reason:` value changed, and `no-credential-leak.test.ts` passes.

## Self-Check: PASSED

- FOUND: 930ec26f, 96d79b72 in `git log`
- FOUND: all 13 modified files exist

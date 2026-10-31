---
phase: quick-261027-ac6
plan: 01
quick_id: 261027-ac6
subsystem: install-rollback-reporting
status: complete
tags: [install, import, apply, rollback, leaks, AS-7, MIM-03]
requirements: [MIM-03]
dependency_graph:
  requires: [261027-9jj]
  provides: [D-PL6-20 leak listing on install, import, and apply failed rows]
  affects: [enable, bootstrap, autoapply load (same ledger rows)]
tech-stack:
  added: []
  patterns:
    - "a failed undo stands in a ManualRecoveryError for the bridge error (same message, no cause) so the phase cause keeps one link"
    - "redactCauseChain keeps ManualRecoveryError links, leaks redacted"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/shared/notification-resolve.test.ts
    - test/shared/redact-absolute-paths.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - features/plugin/install-rollback.feature
    - features/plugin/import.feature
    - features/plugin/apply.feature
key-decisions:
  - "D-PL6-20: a skill that a failed skills undo leaves staged is listed in the failed row's `leaks` -- install lists the full directory path, import and apply list it cut to its last segment (D-PL6-12). Settles Phase 6 uncertain choice 6.15 (`06-06-SUMMARY.md` item 14)."
metrics:
  duration: 19m
  completed: 2026-10-27
actuals:
  tokens: 9300
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 00b001934b06ab90d914ae2cd51a3447f91ae0e1
plan_head_after: 9ccd88e9c895fb61d34cd063a84d2d08dc9d9ef6
---

# Quick Task 261027-ac6: List the skill a failed skills undo leaves staged Summary

When an install's skills undo cannot remove a staged skill, the failed row's `leaks` now names that skill directory: the full path in `install`, the bare skill name in `import` and `apply`. The `[skills]` phase row and its one-link cause are unchanged.

## What changed

- `install-outcome.ts`: the skills phase undo wraps `unstagePluginSkills` in a try/catch. The new module-private `skillsUndoError` passes a `PathContainmentError` through unchanged (PI-14). For any other failure it checks each staged skill directory with `pathExists` (one `Promise.all`) and throws `new ManualRecoveryError(<bridge message>, <directories still on disk>)` in place of the bridge error. It does not wrap it.
- `notification-resolve.ts`: `resolveFailure` collects `manualRecoveryLeaks` of the row cause, then of each rollback phase cause in phase order. It lists each path once (F-5, through a `Set`) and then runs `redactCredentials` on each.
- `redact-absolute-paths.ts`: `redactCauseChain` rebuilds a `ManualRecoveryError` link as a `ManualRecoveryError`, with its message and each leak passed through `redactAbsolutePaths`. Every other link stays a plain `Error`. The depth bound, the truncation sentinel, and the `undefined` return are unchanged. The leak reaches import and apply through their existing `redactedRollbackPartials`, so `execute.ts` and `apply.ts` are not edited.

## Decision row

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **D-PL6-20 (plugin-lifecycle, Phase 6): a skill that a failed skills undo leaves staged is listed in the failed row's `leaks`.** `install` lists the skill directory's path. `import` and `apply` list it cut to its last segment (D-PL6-12). The `[skills]` phase row and its cause do not change. | A `{rollback partial}` row said that files may remain, but not which files. The user needs the path to remove the skill by hand (AS-7). | ✓ Good |

## Commits

| Task | Commit | Title | Hook pre-commit pass |
|------|--------|-------|----------------------|
| 1 | `5c5ad5f6` | fix(install): list the skill a failed skills undo leaves staged | `npm run check:commit....Passed` |
| 2 | `9ccd88e9` | fix(import): list the skill a failed undo leaves, in import and apply | `npm run check:commit....Passed` (second attempt; see Deviations) |

## RED evidence

- **Task 1, install scenario (unchanged source):** `npx cucumber-js --name 'An install whose skills rollback cannot finish names the skills phase'` gave `1 scenario (1 failed)` at "Then the result lists these plugins:". The diff was `-    ""` / `+    "{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-skill"` in the `leaks` cell.
- **Task 1, unit cases before the change:**
  - (a) "D-PL6-20: a skills undo that cannot remove a skill names its directory as the leak" failed. The partial's cause was the raw `Error`, not a `ManualRecoveryError`.
  - (b) "PI-14: a skills undo that meets a symlink rethrows the containment refusal unwrapped" passed, as planned.
  - (c) "D-PL6-20 lists the leaks of the row cause, then of each rollback phase cause, once" failed.
  - (d) "D-PL6-20 redacts the credentials of a rollback phase cause's leaks" failed.
- **Task 2, scenarios after Task 1 only:** `npx cucumber-js --name 'rollback cannot finish|cannot finish the rollback'` gave `8 scenarios (1 passed, 7 failed)`. All seven import and apply scenarios failed with `-    ""` against `+    "demo-skill"` or `+    "lib-skill"`. The install scenario passed.
- **Task 2, unit cases before the change:** both new `redactCauseChain` cases failed ("keeps a manual-recovery link with its leaked paths redacted", "keeps a manual-recovery head with no cause, its leaked paths redacted"). All three MIM-03 cases in `apply.test.ts` failed (`tests 3, fail 3`).

## Verification

- Task 1 verify: install scenario 1/1 passed. Direct coverage of `install-outcome.ts` and `notification-resolve.ts` exited 0 (100%). The eight read-only skill scenarios passed 8/8. MIM-03 passed 3/3 with unchanged text.
- Task 2 verify: direct coverage of `redact-absolute-paths.ts` and `reconcile/apply.ts` exited 0. MIM-03 passed 3/3 with the `leaked:` lines. The eight scenarios passed 8/8. `install-rollback.feature`, `import.feature`, and `apply.feature` passed together: `73 scenarios (73 passed)`.
- Grep gates: `resources/skills/demo-skill` in install-rollback.feature = 1. `new ManualRecoveryError(` in install-outcome.ts = 1. `D-PL6-20` is present in install-outcome.ts, notification-resolve.ts, and redact-absolute-paths.ts. `ManualRecoveryError` in redact-absolute-paths.ts = 4. `leaked: hello-tool` = 1. `leaked: bar-tool` = 2.
- Invariant: `git diff --name-only 00b00193..HEAD` lists exactly the ten `files_modified`. The diff over `orchestrators/import`, `orchestrators/reconcile`, `bridges`, `shared/errors.ts`, and `shared/notification-grammar.ts` is empty.
- **Full gate:** `{ npm run check > "$LOG" 2>&1; echo "CHECK_EXIT=$?" >> "$LOG"; }` printed **CHECK_EXIT=0**. The log has no failed step. The cucumber stage shows `917 scenarios (917 passed)`, and the merged LCOV is `coverage/direct.lcov (291 records)`. Commit `9ccd88e9c895fb61d34cd063a84d2d08dc9d9ef6`, tree `7d21c3497d285a83bf3516719aa080951bc26e16`, Node v26.12.1. Scope: the whole tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `sonarjs/no-misleading-array-reverse` on `redactCauseChain`**
- **Found during:** Task 2 commit (the first `git commit` failed in the hook's lint step, so nothing was committed)
- **Issue:** `for (const link of links.reverse())` reverses the array inside the loop header.
- **Fix:** Moved `links.reverse();` to its own statement before the loop. `truncated` is computed before the reverse, so its value is the same. The redact suite passed 18/18. The second commit attempt passed the hook.
- **Files modified:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- **Commit:** `9ccd88e9`

**2. Test helpers in install-outcome.test.ts.** Cases (a) and (b) share two module-private helpers: `commandsFailAfterSkills(afterSkills)`, which wraps the transaction, and `skillsLedgerOptions(cwd)`. The plan wrote each case's transaction out in full. The helpers avoid a new clone group for fallow, and `npm run fallow` passed.

No other deviations.

## Uncertain choices (for user review)

From the plan:

1. The leak is the skill directory's path (`<scope root>/pi-claude-marketplace/resources/skills/<name>`), as the `leaks` contract and the `leaked: <path>` line read. It is not mcp's `failed to restore <file> at <path>: <message>` sentence. The error stays on the `[skills]` phase row.
2. `import` and `apply` show the leak cut to its last segment (`demo-skill`), as they cut every other path on the row (D-PL6-12, T-55-02-02). `install` shows the full path.
3. The leak rides the skills phase's cause. It does not ride the row cause or `RunPhasesResult.leaks` (AS-5), so `execute.ts` and `apply.ts` stay unedited.
4. The stand-in `ManualRecoveryError` keeps the bridge error's message and drops its stack and errno fields. Nothing after the ledger reads them.
5. Only directories that `pathExists` (lstat) finds after the failed undo are listed. If that check itself throws, its error becomes the phase cause.
6. `redactCauseChain` keeps every `ManualRecoveryError` link it rebuilds. So an import or apply row whose own chain holds one (for example an mcp restore that leaked) now lists those leaks too, redacted. No test or scenario has such a row.
7. Only the skills undo produces a leak. A failed commands, agents, hooks, mcp, or workflows undo still leaves `leaks` empty.
8. Standalone `enable`, `bootstrap`, and an autoapply load render the same ledger rows, so they list the skill too. No scenario or unit case pins a real skills undo failure on those paths.
9. Scenario titles are unchanged, so the `--name` filter still selects the eight scenarios.
10. `resolveFailure` lists a path once (first occurrence), as `errorWithManualRecovery` dedupes (F-5).

Made during execution:

11. A non-containment error that the bridge raises before any removal, such as an `assertSafeName` refusal, also becomes a `ManualRecoveryError` that lists every staged directory still present. That is all of them, because nothing was removed. This follows from choice 5 and was not tested separately.
12. In `redactCauseChain`, the leak redaction uses `redactAbsolutePaths`, the same as link messages. It does not use `redactCredentials`. Credential redaction of leaks still happens later, in `resolveFailure`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Notes for the orchestrator

- `06-CONTEXT.md`'s decision list does not record D-PL6-20 yet.
- The milestone CHANGELOG sub-bullet on rollback rows could add that `install`, `import`, and `apply` now name the skill a failed rollback leaves behind.
- `06-VERIFICATION.md`'s `covered_digest` is stale. `features/plugin/{install-rollback,import,apply}.feature` and `test/orchestrators/reconcile/apply.test.ts` are in its `covered_files`.
- STATE.md, ROADMAP.md, and this SUMMARY were not edited or committed by the executor (the docs commit is yours).

## Self-Check: PASSED

- Commits `5c5ad5f6` and `9ccd88e9` are ancestors of HEAD.
- All ten modified files exist. `CHECK_EXIT=0` on HEAD `9ccd88e9`.

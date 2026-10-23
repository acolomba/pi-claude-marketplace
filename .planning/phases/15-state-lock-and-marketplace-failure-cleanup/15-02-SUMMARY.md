---
phase: 15-state-lock-and-marketplace-failure-cleanup
plan: 02
subsystem: plugin orchestrators (update, reinstall, prune)
tags: [state-lock, StateLockHeldError, cucumber, failure-row]
status: complete

requires:
  - phase: 15-state-lock-and-marketplace-failure-cleanup
    provides: the install, enable, and disable lock-held scenarios (15-01) in features/plugin/state-lock.feature
provides:
  - update reports a held state lock as `lock held` instead of `unreadable manifest`, with the StateLockHeldError cause chain
  - reinstall's lock-held row carries the StateLockHeldError cause chain
  - six more state-lock scenarios (update, reinstall, prune; project and user scope), 14 in total
  - the phase's final `npm run check` on the combined tree
affects: []

actuals:
  tokens: 5450
  tasks: 3
  commits: 3
plan_head_before: ab6307d56413a4da88495e5e3eb4c3dad9528f62
plan_head_after: 532c88f57b13cba301b46698d62099d12430f16e

tech-stack:
  added: []
  patterns:
    - "A private typed-identity helper returns `ContentReason | undefined`, so a classifier at the cognitive ceiling can gain an arm"

key-files:
  created: []
  modified:
    - features/plugin/state-lock.feature
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - test/orchestrators/plugin/reinstall-record.test.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts

key-decisions:
  - "update: typedDirectFailReason holds the typed-identity arms of narrowDirectFailReason, led by `instanceof StateLockHeldError` -> `lock held`; the transport, errno, and `unreadable manifest` fallback ladder is unchanged"
  - "reinstall: isRenderedCause(error) (layer refusal or StateLockHeldError) decides whether failedOutcome carries `cause`"

requirements-completed: [FLR-01]

duration: ~45 min
completed: 2026-10-23
---

# Phase 15 Plan 02: Lock-held rows for update, reinstall, and prune Summary

`update` now fails with `{lock held}` instead of `{unreadable manifest}` while another process
holds the scope's state lock. `reinstall`'s lock-held row now carries the StateLockHeldError
cause chain, like uninstall. `prune` is stated as observed, with its basename-redacted cause.
Six new scenarios cover both scopes, and `npm run check` passes on the combined tree.

## Commits

| Task | Commit | Subject | Hook |
| ---- | ------ | ------- | ---- |
| 1 | ab5b8d95 | fix(update): report a held state lock as lock held | `npm run check:commit` Passed; every other hook Passed or Skipped |
| 2 | a024a66d | fix(reinstall): show the cause of a held state lock | `npm run check:commit` Passed; every other hook Passed or Skipped |
| 3 | 532c88f5 | test(features): prune under a held state lock | `npm run check:commit` Passed; every other hook Passed or Skipped |

`SKIP=npm-check pre-commit run --files <changed files>` ran clean before each commit. No fixer
changed a file.

## Task 1: update

**Scenarios red** (`npx cucumber-js features/plugin/state-lock.feature --name 'Updating a plugin'`,
exit 1): `2 scenarios (2 failed)`, `28 steps (20 passed, 6 skipped, 2 failed)`. Both failed
only on the reasons cell of `the result lists these plugins:`:

```text
+     'unreadable manifest',
-     'lock held',
```

The cause chain cell already matched in both scopes.

**Unit red** (`node --test --test-name-pattern 'FLR-01' test/orchestrators/plugin/update-flow.test.ts`, exit 1):

```text
✖ FLR-01: a held scope lock fails an update that is due as lock held and keeps its cause
  +       '  ⊘ hello (failed) {unreadable manifest}\n' +
  -       '  ⊘ hello (failed) {lock held}\n' +
          '    cause: Another pi-claude-marketplace operation is in progress for project scope (/tmp/update-flr01-lock-held-TRIvGJ/.pi/pi-claude-marketplace/.state-lock). Retry after it completes. -> Lock file is already being held',
```

The case seeds `hello` at `1.0.0` against a manifest that offers `1.1.0`, holds the real
project lock with `proper-lockfile` (released in `finally`), and compares the whole
notification list with `refusedUpdateNotification`. It also checks that the `state.json`
bytes did not change.

**Fix:** the typed-identity arms of `narrowDirectFailReason` (`MarketplaceNotFoundError`
through `DependencyDeclarationsUnreadableError`) moved into the private
`typedDirectFailReason(primary): ContentReason | undefined`. A new first arm,
`instanceof StateLockHeldError`, returns `"lock held"`. `narrowDirectFailReason` keeps the
`CleanupContextError` unwrap, takes the helper's answer when there is one, and otherwise runs
the unchanged transport ladder, errno ladder, and `"unreadable manifest"` fallback.
`reasonsFromTypedError` and `notifyDirectFailure` are unchanged.

**Green:** `npm run test:coverage:direct -- .../update-flow.ts` exit 0 (100%; it runs the whole
owner test). `npx fallow health --fail-on-issues` exit 0. The feature file: `10 scenarios (10
passed)`, `132 steps (132 passed)`.

**Planted check** (lock arm deleted, then restored from a backup): the FLR-01 case failed
(`pass 0, fail 1`, `{unreadable manifest}` against `{lock held}`). Both update scenarios failed
(`2 scenarios (2 failed)`, `+ 'unreadable manifest'`).

## Task 2: reinstall

**Scenarios red** (`--name 'Reinstalling a plugin'`, exit 1): `2 scenarios (2 failed)`,
`26 steps (18 passed, 6 skipped, 2 failed)`. Both failed only because the row had no
`cause chain` and `cause truncated` columns, and so no cause chain value. The reasons cell
already read `lock held`.

**Unit red** (`node --test test/orchestrators/plugin/reinstall-record.test.ts`, exit 1):
`pass 16, fail 1`. The new case "FLR-01: a held state lock carries lock held and its cause"
failed only on the missing `cause:` field. `notes` and `reasons` already matched.

**Fix:** `isRenderedCause(error): error is LayerRefusal | StateLockHeldError` in
`reinstall-record.ts`; `failedOutcome` now spreads `cause: input.error` when it holds. The
`ReinstallFailedOutcome.cause` doc comment in `orchestrators/types.ts` now says the field is
also set for a held state lock, whose cause line names the lock file the way the uninstall row
does (D-01). No type changed. The cause reaches the row with no change outside these two
files, so the D-05 fallback was not needed.

**Green:** owner test 17/17 pass. `npm run test:coverage:direct` exit 0 for `reinstall-record.ts`
and for `types.ts`. `node --test test/orchestrators/reconcile/backfill.test.ts` exit 0 (reconcile
reads only `reasons[0]` of a failed reinstall). The feature file: `12 scenarios (12 passed)`,
`158 steps (158 passed)`.

**Planted check** (guard reduced to `return isLayerRefusal(error);`, then restored from a
backup): the FLR-01 case failed (`pass 0, fail 1`). Both reinstall scenarios failed
(`2 scenarios (2 failed)`).

## Task 3: prune

Test only. Both scenarios passed on their first run, as written from the catalog and the plan
(`2 scenarios (2 passed)`, `28 steps (28 passed)`). The observed reason is `lock held`, so the
bug policy did not apply.

Full file: `npx cucumber-js features/plugin/state-lock.feature` exit 0, `14 scenarios (14
passed)`, `186 steps (186 passed)`. `npm run check:features` exit 0.

## Final row tables (as the green run compared them)

Every new scenario has the same four result fields: kind `cascade`, severity `error`, needs
reload `false`, summary `A plugin operation has failed.`. Each has one row.

Update and reinstall (identical rows):

| marketplace name | marketplace scope | id | name | status | reasons | scope | cause chain | cause truncated | leaks | rollback partial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fixtures | project | demo@fixtures | demo | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false | | |
| fixtures | user | demo@fixtures | demo | failed | lock held | user | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false | | |

Prune (D-06, the lock named by its basename):

| marketplace name | marketplace scope | id | name | status | reasons | scope | cause chain | cause truncated | leaks | rollback partial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| (prune) | project | (prune)@(prune) | (prune) | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes., Lock file is already being held | false | | |
| (prune) | user | (prune)@(prune) | (prune) | failed | lock held | user | Another pi-claude-marketplace operation is in progress for user scope (.state-lock). Retry after it completes., Lock file is already being held | false | | |

What each scenario checks after the failed command:

- update: record `demo@fixtures 1.0.0 true` (the republished `1.1.0` is not taken);
  `claude-plugins.json` declares `demo@fixtures`; staged `skill demo-skill`.
- reinstall: record `demo@fixtures 1.0.0 true`; `claude-plugins.json` declares
  `demo@fixtures`; staged `skill demo-skill`.
- prune: record `lib@fixtures 1.0.0 true` (the orphaned dependency stays);
  `claude-plugins.json` declares no plugins; staged `skill lib-skill`.

## Acceptance checks

- `instanceof StateLockHeldError`: update-flow.ts 1 (baseline 0); reinstall-record.ts 2 (baseline 1).
- `^  Scenario` in state-lock.feature: 10 after Task 1, 12 after Task 2, 14 after Task 3.
- `(prune)@(prune)` in state-lock.feature: 2.
- `lock held` in update-flow.test.ts: 7 (baseline 5). In reinstall-record.test.ts: 3 (baseline 1).
- `state lock` (case-insensitive) in orchestrators/types.ts: 1 (baseline 0).

## Phase gate

| Command | Exit | Commit | Node | Scope |
| --- | --- | --- | --- | --- |
| `npm run check` (foreground-equivalent: backgrounded once, waited for completion) | 0 | 532c88f5 | v26.12.1 | combined tree of 15-01..15-04 plus this plan; working tree clean apart from the untracked `fallow-setup/` skill directories |

The run printed `493 scenarios (493 passed)` for `test:cucumber` and
`Merged LCOV: coverage/direct.lcov (280 records)` for the all-pair direct coverage, and nothing
else failed (static checks, unpaired, integration all quiet).

## Deviations from Plan

None. The plan was executed as written.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

- No deviations. No Phase 1 file, step module, or other phase's feature file changed. The
  scenarios use only existing steps (D-12).
- D-05 is done, not deferred: the cause reached the reinstall row through
  `reinstall-record.ts` and the `types.ts` comment alone.
- D-06 stays deferred as CONTEXT records: prune's cause chain names `(.state-lock)` while every
  other command prints the absolute lock path. The scenarios state the redacted text.
- `update-flow.ts::reasonsFromTypedError` (the autoupdate cascade's classifier) still maps a
  lock error to its fallback, as the plan says. No command reaches it with a held lock.
- `actuals.commits` and `plan_head_after` count the three task commits. This SUMMARY gets its
  own `docs` commit after them, and no other `.planning` file is staged.
- `actuals.tokens` is chars/4 over the plan's code diff (21,786 chars).
- CHANGELOG.md is not edited. The user-visible reason changes belong in the milestone PR entry.
- I did not run `windows append`, `state.*`, or `phase.complete`, as instructed.

## Self-Check: PASSED

- FOUND: features/plugin/state-lock.feature, update-flow.ts, update-flow.test.ts,
  reinstall-record.ts, reinstall-record.test.ts, types.ts (all modified, all committed)
- FOUND: ab5b8d95, a024a66d, 532c88f5 (all ancestors of HEAD)

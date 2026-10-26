---
phase: 15-state-lock-and-marketplace-failure-cleanup
plan: 01
subsystem: plugin orchestrators (install, enable, disable)
tags: [state-lock, StateLockHeldError, cucumber, failure-row]
status: complete

requires:
  - phase: 01-suite-foundation
    provides: the state-lock holder step, the result and record steps, and the two uninstall seeds of features/plugin/state-lock.feature
provides:
  - install, enable, and disable report a held state lock as `lock held` with the StateLockHeldError cause chain
  - six state-lock scenarios (install, enable, disable; project and user scope)
affects: [15-02 (shares features/plugin/state-lock.feature)]

actuals:
  tokens: 5222
  tasks: 2
  commits: 2
plan_head_before: f86d44aa1e29400b5dfe9b2e43f34cd55cbb47a0
plan_head_after: 2f06d18481f64cae6191ca2492e6323960f39880

tech-stack:
  added: []
  patterns:
    - "A private reasons helper beside the existing classifier picks the standalone row's brace; only `instanceof StateLockHeldError` selects `lock held`"

key-files:
  created: []
  modified:
    - features/plugin/state-lock.feature
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - test/orchestrators/plugin/install.messaging.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - test/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "install: runtimeFailureReasons(err, authReason) picks Branch 4's reasons; the cause rule is unchanged, so the lock row keeps its cause chain"
  - "enable/disable: standaloneTransactionThrowReasons(cause) picks the standalone row's reasons; the orchestrated outcome stays on classifyTransactionThrow"

requirements-completed: [FLR-01]

duration: ~70 min (most of it the commit hook under a load average of 40-60)
completed: 2026-10-23
---

# Phase 15 Plan 01: Lock-held rows for install, enable, and disable Summary

`install`, `enable`, and `disable` now fail with `{lock held}` and the StateLockHeldError
cause chain while another process holds the scope's state lock, in both scopes. Two private
helpers, each narrowing with `instanceof StateLockHeldError`, are proven by six new scenarios
and two unit cases.

## Commits

| Task | Commit | Subject | Hook |
| ---- | ------ | ------- | ---- |
| 1 | 4a9d5fa0 | fix(install): report a held state lock as lock held | `npm run check:commit` Passed (all pre-commit hooks Passed or Skipped) |
| 2 | 2f06d184 | fix(enable): report a held state lock as lock held | `npm run check:commit` Passed (all pre-commit hooks Passed or Skipped) |

`SKIP=npm-check pre-commit run --files <changed files>` ran clean before each commit. No fixer
changed a file.

## Task 1: install

**Scenarios red** (`npx cucumber-js features/plugin/state-lock.feature`, exit 1):
`4 scenarios (2 passed, 2 failed)`, `48 steps (42 passed, 4 skipped, 2 failed)`. Both install
scenarios failed only on the reasons cell of `the result lists these plugins:`:

```text
+     '',
-     'lock held',
```

The cause chain cell already matched in both scopes.

**Unit red** (`node --test --test-name-pattern 'FLR-01' test/orchestrators/plugin/install.messaging.test.ts`, exit 1):

```text
✖ FLR-01: a held state lock fails the row as lock held and keeps its cause chain
  +   reasons: [],
  -   reasons: [
  -     'lock held'
  -   ],
```

**Fix:** `runtimeFailureReasons(err, authReason)` in `install.messaging.ts`. It returns
`["lock held"]` for a `StateLockHeldError`, `[authReason]` for a git auth challenge, and `[]`
otherwise. The `cause` rule is unchanged (dropped only for the auth reason). Fallow complexity
of `composeInstallFailureMessage` went from cyclomatic 20 / cognitive 15 to 19 / 14.

**Green:** owner test 57/57 pass; `npm run test:coverage:direct -- .../install.messaging.ts`
exit 0 (100%); feature file `4 scenarios (4 passed)`, `48 steps (48 passed)`.

**Planted check** (lock arm made `if (false && err instanceof StateLockHeldError)`, then
reverted from a backup): the FLR-01 unit case failed (`pass 0, fail 1`). Both install
scenarios failed: `4 scenarios (2 passed, 2 failed)`.

## Task 2: enable and disable

**Scenarios red** (exit 1): `8 scenarios (4 passed, 4 failed)`,
`104 steps (88 passed, 12 skipped, 4 failed)`. All four new scenarios failed only on the
reasons cell (`+ ''` / `- 'lock held'`).

**Unit red** (`node --test --test-name-pattern 'FLR-01' test/orchestrators/plugin/enable-disable.test.ts`, exit 1):

```text
✖ FLR-01: a held project lock fails a standalone disable as lock held with its cause and changes nothing
  +       '  ⊘ foo (failed)\n' +
  -       '  ⊘ foo (failed) {lock held}\n' +
          '    cause: Another pi-claude-marketplace operation is in progress for project scope (/tmp/enable-disable-TolQae/project/.pi/pi-claude-marketplace/.state-lock). Retry after it completes. -> Lock file is already being held',
```

**Fix:** `standaloneTransactionThrowReasons(cause)` beside `classifyTransactionThrow` in
`enable-disable.ts`. It returns `[cause.reason]` for an `EnableRefusedError`, `["lock held"]`
for a `StateLockHeldError`, and `[]` otherwise. The orchestrated outcome still uses
`classifyTransactionThrow`. After the change, fallow measures `runSetEnabledOutcome` at
cyclomatic 9 / cognitive 11.

**Green:** owner test 169/169 pass. This includes the unchanged `EnableRefusedError` and
config-write cases. `npm run test:coverage:direct -- .../enable-disable.ts` exit 0 (100%).
Feature file `8 scenarios (8 passed)`, `104 steps (104 passed)`.

**Planted check** (lock arm replaced by `return [];`, then reverted from a backup): the FLR-01
unit case failed (`pass 0, fail 1`). All four enable/disable scenarios failed:
`8 scenarios (4 passed, 4 failed)`.

## Final row tables (as the green run compared them)

Every new scenario has the same four result fields: kind `cascade`, severity `error`, needs
reload `false`, summary `A plugin operation has failed.`. Each has one row:

| marketplace name | marketplace scope | id | name | status | reasons | scope | cause chain | cause truncated | leaks | rollback partial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fixtures | project | demo@fixtures | demo | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false | | |
| fixtures | user | demo@fixtures | demo | failed | lock held | user | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false | | |

No row carries a version column. The actual rows have none.

What each scenario checks after the failed command:

- install: `the <scope> scope has no installed plugins`; `claude-plugins.json` declares no plugins.
- enable: record `demo@fixtures 1.0.0 false`, `keep@fixtures 1.0.0 true`. `claude-plugins.json`
  declares `demo@fixtures` with `enabled false` and `keep@fixtures` with no `enabled` field.
  Staged: `skill keep-skill`.
- disable: record `demo@fixtures 1.0.0 true`; `claude-plugins.json` declares `demo@fixtures`;
  staged: `skill demo-skill`.

## Acceptance checks

- `instanceof StateLockHeldError`: install.messaging.ts 1 (baseline 0); enable-disable.ts 2 (baseline 1).
- `^  Scenario` in state-lock.feature: 8 (baseline 2).
- `lock held` in install.messaging.test.ts: 2 (baseline 0). In enable-disable.test.ts: 3 (baseline 1).

## Deviations from Plan

None. The plan was executed as written.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

- No deviations. No Phase 1 file, step module, or other phase's feature file changed.
  `features/plugin/state-lock.feature` now holds 8 scenarios. Plan 15-02 appends to it.
- `actuals.commits` and `plan_head_after` count the two task commits. This SUMMARY gets its
  own `docs` commit after them.
- The plan measured `runSetEnabledOutcome` at cognitive 14 before the change. After the
  change, fallow reports 11. I did not re-measure the old code, so I cannot say whether the
  helper took 3 points away or the 14 was measured differently.
- Environment: the machine's load average was 40-60 during this run. The first commit hook ran
  about 20 minutes, almost all of it in ESLint with a cold cache. It passed. Expect slow hooks
  and slow gates in this worktree while sibling sessions run.
- I did not run `npm run check` here. The plan leaves it to the wave gate and to 15-02.
- CHANGELOG.md is not edited. The user-visible change belongs in the milestone PR entry.

## Self-Check: PASSED

- FOUND: features/plugin/state-lock.feature, install.messaging.ts, install.messaging.test.ts,
  enable-disable.ts, enable-disable.test.ts (all modified, all committed)
- FOUND: 4a9d5fa0, 2f06d184 (both ancestors of HEAD)

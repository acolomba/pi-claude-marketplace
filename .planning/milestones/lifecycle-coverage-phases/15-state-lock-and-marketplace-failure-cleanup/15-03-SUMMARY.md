---
phase: 15-state-lock-and-marketplace-failure-cleanup
plan: 03
subsystem: marketplace orchestrators (add, remove, update)
tags: [state-lock, StateLockHeldError, cucumber, failure-row, marketplaceFailureRows]
status: complete

requires:
  - phase: 01-suite-foundation
    provides: the state-lock holder step, the result, config, record, stage, and git-clone steps
provides:
  - marketplace add and remove report a held state lock as `lock held` with the StateLockHeldError cause chain, in both modes
  - features/marketplace/state-lock.feature (add Outline over scope and source kind, remove and update in both scopes)
affects: [reconcile mp-add-failed and mp-remove-failed rows, import addOnePlannedMarketplace]

actuals:
  tokens: 5919
  tasks: 3
  commits: 3
plan_head_before: e7296bbe788e955c9e2e7b033fad2981b8c7d765
plan_head_after: 383cce5f05a6bba060ac0a5a1b82897922f3c072

tech-stack:
  added: []
  patterns:
    - "A lock-held arm tests the raw caught value with `instanceof StateLockHeldError` and reports through `marketplaceFailureRows`"

key-files:
  created:
    - features/marketplace/state-lock.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - test/orchestrators/marketplace/remove.test.ts
    - test/integration/marketplace-layer-remove.test.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - test/orchestrators/marketplace/add.test.ts

key-decisions:
  - "remove: the catch dispatch of runRemoveOutcome moved into surfaceRemoveStop, which gained the lock-held arm through surfaceMarketplaceFailure"
  - "add: surfaceLockHeldAdd runs before classifyAddError and names the row by the typed source"
  - "an orchestrated add under a held lock now returns reason `lock held` instead of `unparseable`; an orchestrated remove returns a failed outcome instead of throwing"

requirements-completed: [FLR-02]

duration: ~45 min
completed: 2026-10-23
---

# Phase 15 Plan 03: Lock-held rows for marketplace add, remove, and update Summary

`marketplace add` and `marketplace remove` now fail with the result that `marketplace update`
gives under a held state lock. That result is the failed marketplace header with one failed
child, which carries `{lock held}` and the StateLockHeldError cause chain. Before this change
both commands gave `internal-error`. A new feature file with 12 scenario rows covers add, remove,
and update in both scopes.

## Commits

| Task | Commit | Subject | Hook |
| ---- | ------ | ------- | ---- |
| 1 | efa6cbf4 | fix(marketplace): report a held state lock on remove | `npm run check:commit` Passed, gitlint Passed, every other hook Passed or Skipped (1m45s) |
| 2 | 79447715 | fix(marketplace): report a held state lock on add | `npm run check:commit` Passed, gitlint Passed, every other hook Passed or Skipped (1m46s) |
| 3 | 383cce5f | test(features): marketplace update under a held state lock | `npm run check:commit` Passed, gitlint Passed, every other hook Passed or Skipped (39s) |

`SKIP=npm-check pre-commit run --files <changed files>` ran clean before each commit. No fixer
changed a file.

## Task 1: remove

**Scenarios red** (`npx cucumber-js features/marketplace/state-lock.feature`, exit 1):
`2 scenarios (2 failed)`, `28 steps (16 passed, 10 skipped, 2 failed)`. In both scopes the
failure was on `the result has these fields:`:

```text
                 'kind',
           +     'internal-error'
           -     'cascade'
...
                 'summary',
           +     'Command failed unexpectedly.'
           -     'Some operations have failed.'
               ],
           +   [
           +     'cause chain',
           +     'Another pi-claude-marketplace operation is in progress for project scope ([path], Lock file is already being held'
```

**Unit red** (`node --test --test-name-pattern 'FLR-02' test/orchestrators/marketplace/remove.test.ts`):
`pass 0, fail 2`. Both cases rejected with the raw lock error:

```text
✖ FLR-02: a standalone remove under a held state lock reports lock held and changes nothing
  Error [StateLockHeldError]: Another pi-claude-marketplace operation is in progress for project scope (/tmp/marketplace-remove-7fQQle/project/.pi/pi-claude-marketplace/.state-lock). Retry after it completes.
      at withExistingScopeLock (.../transaction/with-state-guard.ts:135:13)
      at async runRemoveOutcome (.../orchestrators/marketplace/remove.ts:1276:5)
    [cause]: Error: Lock file is already being held { code: 'ELOCKED' }
```

**Fix:** the catch body of `runRemoveOutcome` moved, with its arms in the same order, into the
private `surfaceRemoveStop(err, { opts, orchestrated, scope, configBasename,
cfgInvalidSentinel, mcpConfigNotices })`. A new arm,
`err instanceof StateLockHeldError`, comes after `DeclarationIndexStop` and before the
CFG-03/rethrow tail. It returns `surfaceMarketplaceFailure({ ..., reason: "lock held", error:
err })`. The `runRemoveOutcome` catch is now a single call. The hook's fallow and ESLint gates
passed.

**Integration, before and after**
(`test/integration/marketplace-layer-remove.test.ts`):

- Before: "a remove while another holder has the scope's state lock rejects and changes
  nothing". It used `createNotificationBoundary(2)` and `await assert.rejects(removal,
  StateLockHeldError)`. The notifications were `[ADDED, installed("alpha")]`.
- After: "a remove while another holder has the scope's state lock fails as lock held and
  changes nothing". It uses `createNotificationBoundary(3)` and `await removeMp(scope, boundary)`.
  The notifications are `[ADDED, installed("alpha"), { message: "Some operations have
  failed.\n\n⊘ mp [project] (failed)\n  ⊘ mp (failed) {lock held}\n    cause: Another
  pi-claude-marketplace operation is in progress for project scope
  (${scope.locations.stateLockFile}). Retry after it completes. -> Lock file is already being
  held", severity: "error" }]`. The footprint assertion is unchanged. The `StateLockHeldError`
  import was dropped because nothing else used it.

**Green:** owner test 55/55 pass. `npm run test:coverage:direct -- .../remove.ts` exit 0 (100%).
`node --test test/integration/marketplace-layer-remove.test.ts` 11/11 pass. The feature file
gave `2 scenarios (2 passed)`, `28 steps (28 passed)`.

**Planted check:** I changed the lock arm to `if (false && err instanceof StateLockHeldError)`,
then restored the file from a backup. The FLR-02 unit cases gave `pass 0, fail 2`. The feature
file gave `2 scenarios (2 failed)`, `28 steps (16 passed, 10 skipped, 2 failed)`.

## Task 2: add

**Scenarios red** (exit 1): `10 scenarios (2 passed, 8 failed)`,
`108 steps (68 passed, 32 skipped, 8 failed)`. All eight Outline rows failed with
`'internal-error'` / `'Command failed unexpectedly.'` on `the result has these fields:`, the
same diff as above.

**Unit red** (`node --test --test-name-pattern 'FLR-02' test/orchestrators/marketplace/add.test.ts`):
`pass 0, fail 2`. The standalone case rejected with the raw `StateLockHeldError` (at
`runAddOutcome`, add.ts:952). The orchestrated case returned `unparseable`:

```text
    {
      cause: 'Another pi-claude-marketplace operation is in progress for project scope (/tmp/mp-add-bpSR0K/.pi/pi-claude-marketplace/.state-lock). Retry after it completes.',
  +   reason: 'unparseable',
  -   reason: 'lock held',
      status: 'failed'
    }
```

**Fix:** `handleAddFailure` has a new first arm: `if (err instanceof StateLockHeldError) return
surfaceLockHeldAdd(opts, err, orchestrated)`. It runs before `classifyAddError`. In standalone
mode, `surfaceLockHeldAdd` sends `marketplaceFailureRows(opts.rawSource, opts.scope, "lock
held", err)` through `ADD_CONTEXT` with `"single"`. In both modes it returns `{ status:
"failed", reason: "lock held", error: err, cause: errorMessage(err) }`. I updated the three
comments that described the lock error as rethrown: the `classifyAddError` doc, the
`handleAddFailure` doc, and the standalone rethrow comment.

**Green:** owner test 123/123 pass. `npm run test:coverage:direct -- .../add.ts` exit 0 (100%).
The feature file gave `10 scenarios (10 passed)`, `100 steps (100 passed)`.

**Planted check:** I changed the arm to test `unwrapAddError(err) instanceof
StateLockHeldError`, then restored the file from a backup. This is the hazard the plan names,
because the unwrap peels one level of `Error.cause`. The FLR-02 unit cases gave `pass 0, fail 2`.
The feature file gave `10 scenarios (2 passed, 8 failed)`: every Outline row was
`internal-error` again.

## Task 3: update

No product change. The two update scenarios passed on the first run, because the reference shape
holds. The feature file gave `12 scenarios (12 passed)`, `128 steps (128 passed)`.
`npm run check:features` exit 0. `grep -c '^  Scenario'` gives 5.

## Final row tables (as the green run compared them)

Every scenario has the same four result fields: kind `cascade`, severity `error`, needs reload
`false`, summary `Some operations have failed.`.

Remove and update, one row each:

| marketplace name | marketplace scope | marketplace status | id | name | status | reasons | scope | cause chain | cause truncated | leaks | rollback partial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fixtures | project | failed | fixtures@fixtures | fixtures | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false | | |
| fixtures | user | failed | fixtures@fixtures | fixtures | failed | lock held | user | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false | | |

After the command fails, each remove and update scenario checks four things. `claude-plugins.json`
declares the marketplace `fixtures` (`{home}/marketplaces/fixtures`) and the plugin
`demo@fixtures`. The record holds `demo@fixtures 1.0.0 true`. The scope stages `skill demo-skill`.

Add Outline, one row per Examples line, named by the typed source:

| marketplace name | marketplace scope | marketplace status | id | name | status | reasons | scope | cause chain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<source>` | `<scope>` | failed | `<source>@<source>` | `<source>` | failed | lock held | `<scope>` | Another pi-claude-marketplace operation is in progress for `<scope>` scope (`<scope root>`/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held |

Cause truncated is `false`. Leaks and rollback partial are empty. The Examples are:
`project`/`{project dir}/.pi` and `user`/`{agent dir}`, each with dir
`{home}/marketplaces/tools`, file `{home}/marketplaces/tools/.claude-plugin/marketplace.json`,
`@url` `https://{git host}/acme/tools.git`, and `@github` `acme/tools`. After each row, the
scope's `claude-plugins.json` does not exist and the scope holds no git clones.

## Wider runs (no gate claimed)

- `npm run test:modules` exit 0.
- `npm run test:integration` exit 0.
- `npm run test:cucumber` exit 0: `481 scenarios (481 passed)`, `4608 steps (4608 passed)`.
- I did not run `npm run check`. The wave gate runs it on the combined tree.

## Acceptance checks

- `instanceof StateLockHeldError`: remove.ts 1 (baseline 0); add.ts 1 (baseline 0).
- `marketplaceFailureRows` in add.ts: 2 (baseline 0).
- `^  Scenario` in state-lock.feature: 2 after Task 1, 3 after Task 2, 5 after Task 3.
  `@url\|@github`: 2.
- `lock held`: remove.test.ts 4, marketplace-layer-remove.test.ts 2, add.test.ts 4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The exotic-throw add case pinned the number of prototype reads**

- **Found during:** Task 2.
- **Issue:** "normalizes a structurally classified exotic throw in orchestrated mode" throws a
  Proxy. Its first two prototype reads report `MarketplaceDuplicateNameError.prototype`, and the
  case expects exactly 5 reads. The new `instanceof StateLockHeldError` arm uses one read before
  the classifier. So the classifier saw `null`, and the case got `unparseable`.
- **Fix:** the Proxy now reports the duplicate prototype for the first three reads, and the case
  expects 6 reads. The case still proves the same thing: classification and the `instanceof
  Error` wrap read the prototype separately, and the outcome is still `duplicate name` with
  `new Error("[object Object]")`.
- **Files modified:** test/orchestrators/marketplace/add.test.ts.
- **Commit:** 79447715.

**2. [Scenario step] The add Outline does not state "the scope has no installed plugins"**

- **Found during:** Task 2. The behavior bullet listed the step, but the action list did not.
- **Issue:** the step refuses a scope that has no `state.json` ("does not exist, which is not an
  empty record"). A lock-held add never creates `state.json`, so all eight rows failed on that
  step.
- **Fix:** I dropped the step. The Outline states what the action list and D-08 name: no
  `claude-plugins.json` and no git clones. No shared step says that a scope has no `state.json`.
  D-12 forbids a new step module here.
- **Commit:** 79447715.

**3. Unit cases are two named cases each, not a data-row loop**

The plan suggested rows modeled on the D-05-07 pair. That pair branches on `orchestrated` inside
the loop body. I wrote each mode as its own case, so the loop body has no conditional
(cases.md). The orchestrated case asserts the error by class and structured fields (`scope`,
`lockPath`), not by message.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

- **D-04 interpretation (add row name), repeated for the user.** D-04 says that the add row
  "names the marketplace the add would have created." The add takes the scope lock before it
  reads a manifest or clones (`runAddInGuard`), so under a held lock it cannot know that name. A
  git source cannot be named without a clone. The row therefore names the typed source, as every
  add failure before the manifest read does (ATTR-07 A2, "named as typed" in add.feature). If you
  meant the manifest name, that is a follow-up change to `surfaceLockHeldAdd`.
- The add row's JSON id is `<source>@<source>`, the synthetic shape of `marketplaceFailureRows`.
  ROWID-01 in BACKLOG.md tracks it. ADD-10's fetched-URL child row of other add failures keeps
  the source alone as its id.
- Two orchestrated results change, and both now match D-01. Reconcile's `mp-add-failed` row for
  a lock-held add says `lock held`, where it said `unparseable`. An orchestrated lock-held remove
  returns `{ status: "failed", reason: "lock held" }` instead of throwing. Reconcile rendered the
  thrown error as `lock held` already. The full unit suite and integration suite pass.
- Deviations 1 to 3 above: an exotic-throw test pin was adjusted, one Outline step was dropped
  because the shared step refuses a missing `state.json`, and the unit cases are two named cases
  each instead of a loop.
- No Phase 1 file, step module, or other phase's feature file changed. No `.planning` file other
  than this SUMMARY is committed.
- CHANGELOG.md is not edited. The user-visible change belongs in the milestone PR entry.
- I did not run `npm run check`. The plan leaves it to the wave gate.

## Self-Check: PASSED

- FOUND: features/marketplace/state-lock.feature (created); remove.ts, remove.test.ts,
  marketplace-layer-remove.test.ts, add.ts, add.test.ts (modified). All are committed.
- FOUND: efa6cbf4, 79447715, 383cce5f (all ancestors of HEAD).

---
phase: 15-state-lock-and-marketplace-failure-cleanup
plan: 04
subsystem: cucumber features (marketplace failed add, marketplace remove)
tags: [cucumber, failed-add, sources-staging, plugin-clones, clone-gc, NFR-5]
status: complete

requires:
  - phase: 01-suite-foundation
    provides: the git-host arms, `which failed` setup, result, config, git-clone, and request-log steps
provides:
  - "Then the {word} scope holds no marketplace checkout (features/step_definitions/marketplace/failed-add.steps.ts)"
  - four failed-add scenarios (404, dropped connection, invalid json, retry after a dropped connection)
  - two marketplace remove plugin-clone scenarios (all clones deleted; shared pinned clone kept)
affects: [features/marketplace/failed-add.feature, features/marketplace/remove.feature]

actuals:
  tokens: 2031
  tasks: 3
  commits: 3
plan_head_before: 6b39f80eaffb7db3e23bf1293612f6e1676599f3
plan_head_after: ae9daa3e2376cbb453410dc66ecb1c8ad48e6fdb

tech-stack:
  added: []
  patterns:
    - "A scope-reading Then compares both checkout directories as one keyed value against empty lists, with a missing directory read as empty"

key-files:
  created:
    - features/step_definitions/marketplace/failed-add.steps.ts
  modified:
    - features/marketplace/failed-add.feature
    - features/marketplace/remove.feature

key-decisions:
  - "Each leaves-nothing scenario uses `marketplace list` as its When and the failing add as a `which failed` setup step"
  - "The three leaves-nothing scenarios stay separate scenarios, as the plan names them, not an Outline"
  - "Marketplace remove rows carry no version column (measured), so the tables omit it"

metrics:
  duration: ~25m
  completed: 2026-10-23
requirements-completed: [FLR-03, FLR-04]
---

# Phase 15 Plan 04: Failed add leftovers and remove clone cleanup Summary

A failed url `marketplace add` (404, dropped connection, invalid json) is now proven to leave no checkout under `sources/` or `sources-staging/`, no git clone, no `claude-plugins.json`, and no listed marketplace, and an add retried after a dropped connection succeeds (FLR-03). `marketplace remove` is proven to delete the `plugin-clones/` entries only its plugins used, keep a pinned clone another marketplace's plugin uses, and make no request to the git host (FLR-04, NFR-5). Test-only: no product change.

## Commits

| Task | Commit | Subject | Hook |
| ---- | ------ | ------- | ---- |
| 1 | d37251fc | test(features): a failed url add leaves no checkout | passed (npm run check:commit, gitlint, prettier, TruffleHog) |
| 2 | 1455e2ed | test(features): failed url adds leave nothing and retry | passed (npm run check:commit, gitlint) |
| 3 | ae9daa3e | test(features): marketplace remove cleans plugin clones | passed (npm run check:commit, gitlint) |

`SKIP=npm-check pre-commit run --files <changed files>` passed before each commit with no fixer output.

## The new step (final text)

```ts
// The entry names of `directory`; an absent directory holds none.
async function entryNames(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  return (await readdir(directory)).sort((left, right) => left.localeCompare(right));
}

Then(
  "the {word} scope holds no marketplace checkout",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    assert.deepStrictEqual(
      {
        sources: await entryNames(path.join(extensionRoot, "sources")),
        "sources-staging": await entryNames(path.join(extensionRoot, "sources-staging")),
      },
      { sources: [], "sources-staging": [] },
    );
  },
);
```

## Planted check (Task 1, by hand, reverted)

Plant: in `orchestrators/marketplace/add.ts`, the clone-failure catch of the git add body (the path a 404 takes) replaced `await cleanupStaging(removalOps, stagingDir, "marketplace clone staging")` with `undefined`. Run: `npx cucumber-js features/marketplace/failed-add.feature --name "404 leaves no marketplace"`.

- Result: exit 1. `Then the project scope holds no marketplace checkout` failed:
  ```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    {
  +   'sources-staging': [
  +     '6b20bdab-3a4e-4094-b0d2-19a38c24f75e'
  +   ],
  -   'sources-staging': [],
      sources: []
    }
  ```
- With the two Thens swapped (also temporary), `the project scope holds no git clones` passed and the checkout step still failed (11 steps: 9 passed, 1 skipped, 1 failed), so the git-clone step cannot see the leftover staging checkout. That is why D-10 needs the new step.
- Restored: `git checkout -- extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `git diff --quiet` confirmed it; the feature file was restored from a scratch copy before the commit.

## Row tables as the run showed them

Leaves-nothing scenarios (404, dropped connection, invalid json), `When the user runs "/claude:plugin marketplace list"`:

```
| kind         | cascade |
| severity     | info    |
| needs reload | false   |
```
then `the result lists no marketplaces`, `holds no marketplace checkout`, `holds no git clones`, and `claude-plugins.json` of the project scope does not exist.

Retry after a dropped connection: fields `cascade / info / false`; marketplaces `| tools | project | added |`; `claude-plugins.json` declares `| tools | https://{git host}/acme/tools.git |`.

Remove deletes both clones (`marketplace remove gits --scope project`), fields `cascade / info / true`:

```
| marketplace name | marketplace scope | marketplace status | id        | name | status      | reasons | scope   |
| gits             | project           | removed            | ghp@gits  | ghp  | uninstalled |         | project |
| gits             | project           | removed            | subp@gits | subp | uninstalled |         | project |
```
then `the project scope holds no git clones` and `the git host receives no request`.

Remove keeps the shared pinned clone, fields `cascade / info / true`:

```
| marketplace name | marketplace scope | marketplace status | id        | name | status      | reasons | scope   |
| gits             | project           | removed            | subp@gits | subp | uninstalled |         | project |
```
```
| clone  | origin                           | revision          |
| plugin | https://{git host}/acme/mono.git | {mono revision 1} |
```
then `the git host receives no request`.

## Verification

- `npx cucumber-js features/marketplace/failed-add.feature features/marketplace/remove.feature`: exit 0, 57 scenarios (57 passed), 622 steps (622 passed).
- `npm run check:features`: exit 0 after each task.
- Acceptance counts: step text in the module `1`; `sources-staging` in the module `>= 1`; failed-add `^  Scenario` `3` after Task 1 and `6` after Task 2; `holds no marketplace checkout` in the feature `3`; `drops the connection` `2`; remove.feature `^  Scenario` `35` (baseline 33); `acme/mono.git` `1`; `the git host receives no request` `2`.
- Tracer gate (Task 1): verify re-run passed end-to-end before expanding.
- `npm run check` on the combined tree was not run here; the plan leaves it to the wave gate and plan 15-02.

## Deviations from Plan

None - plan executed exactly as written. The remove rows carry no `version` column, which the plan allowed for ("with a version column if the actual rows carry one").

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

- No product bug surfaced; FLR-03 and FLR-04 needed no fix, so nothing here overlaps plan 15-03's `add.ts` / `remove.ts` edits.
- Three leaves-nothing scenarios of one behavior are written as separate scenarios, as the plan's acceptance counts require. The cucumber rules allow an Outline for three or more variants but do not require one; a reviewer may prefer an Outline, which would need a step that names each failure cause.
- The two remove scenarios are appended at the end of `remove.feature`, after its scope Outlines.
- `npm run check` on the combined tree is still owed by the wave gate.

## Self-Check: PASSED

- FOUND: features/step_definitions/marketplace/failed-add.steps.ts
- FOUND: features/marketplace/failed-add.feature, features/marketplace/remove.feature
- FOUND: d37251fc, 1455e2ed, ae9daa3e (ancestors of HEAD)

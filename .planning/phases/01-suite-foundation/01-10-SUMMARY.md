---
phase: 01-suite-foundation
plan: 10
subsystem: testing
tags: [cucumber, git-source, https-git-host, plugin-clones, fetch, update, uninstall, reconcile, behavioral-tests]

requires:
  - phase: 01-suite-foundation
    provides: "01-06: `{git repository}` (marketplace form), the arming helper with a disarming release, `the git host serves the {git repository} again`, and the request-log steps; 01-08: `GitPluginRepository` records and revision tokens; 01-09: the marketplaces config writer; 01-04: `plugin/installation.steps.ts`"
provides:
  - "`{git repository}` names a repository by the plugin it serves: `plugin \"<name>\"`"
  - "World method `gitRepositoryServing(plugin)`"
  - "features/lib/git-clones.ts: `readGitClones(extensionRoot)` and the type `GitClone`"
  - "Steps `Then the {word} scope holds these git clones:` (`| clone | origin | revision |`) and `Then the {word} scope holds no git clones`"
  - "Seeds: plugin fetch retried after a 404 (fetch.feature), two uninstalls that keep or remove a clone (git-source.feature), an update to a new revision (git-source-update.feature), and a reconcile that adds a hand-declared marketplace (reconcile.feature)"
affects: [phase-4-git-source, phase-11-reconcile, phase-12-fetch, phase-15-failures]

actuals:
  tokens: 6000
  tasks: 3
  commits: 3

plan_head_before: 354e0bcf98662328b8029dfdbab626f9b26e9df1
plan_head_after: 4aebd3c99ef025544c642322bf0c6f67ca5737fc

tech-stack:
  added: []
  patterns:
    - "A git clone is stated by its origin URL and, when pinned, by its revision token; its directory key, which hashes a URL with the random port, never appears in a table"
    - "A git host repository is named by what it serves: a marketplace, or a plugin that exactly one recorded plugin repository holds"

key-files:
  created:
    - features/lib/git-clones.ts
    - features/plugin/fetch.feature
    - features/plugin/git-source-update.feature
  modified:
    - features/support/git-repository.ts
    - features/support/world.ts
    - features/step_definitions/git-host.steps.ts
    - features/step_definitions/plugin/installation.steps.ts
    - features/plugin/git-source.feature
    - features/plugin/reconcile.feature
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "The plugin form of `{git repository}` resolves through `gitRepositoryServing`, which fails when no recorded repository or more than one holds the plugin now, so an ambiguous name never arms a guess"
  - "The clone reader fails on a `plugin-clones/` entry that is not a directory or not named by a clone key, and on a checkout with no origin URL, so a stray staging directory or a broken clone shows up"
  - "A github plugin clone records `https://github.com/acme/<repo>.git` as its origin (the canonical identity, rewritten to the git host only on the wire), so the update seed states that URL as it is"

patterns-established:
  - "Clone tables: `| clone | origin | revision |`, rows sorted by clone kind, origin, and revision; a mirror clone and a marketplace clone have an empty revision"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "The git host arms, lifts, and logs a plugin repository named as `plugin \"<name>\"`, proven by a plugin fetch that fails on a 404 and succeeds once the host serves the repository again"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/fetch.feature#Fetching a plugin succeeds again once the git host serves its repository again"
        status: pass
    human_judgment: false
  - id: D2
    description: "A scenario states the git clones of a scope by origin URL and revision, or that it holds none, proven by two uninstalls and an update to a new revision"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "npx cucumber-js features/plugin/git-source.feature features/plugin/git-source-update.feature (7 scenarios passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A seed fails when the marketplaces config writer leaves a run token unexpanded in a source (closes WINDOWS #110)"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/reconcile.feature#A new session adds a marketplace that a config declares by hand and installs its plugin"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step and export is used; the feature gate, the commit hooks, and the whole cucumber suite pass"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (462 scenarios, 4382 steps passed)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 10: Plugin repository arms and the git clones of a scope Summary

**The git-host steps now arm, lift, and log a plugin's repository named as `plugin "<name>"`, and a scenario can state the plugin and marketplace clones of a scope by origin URL and revision token. Four new seeds prove a fetch retried after a 404, two uninstalls that keep or remove a clone, and an update to a new revision. An extra reconcile seed closes the token-expansion gap in the marketplaces config writer.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-23T04:26:31Z
- **Completed:** 2026-10-23T04:36:27Z
- **Tasks:** 2 planned, plus 1 added by the orchestrator
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- `features/support/git-repository.ts`: the parameter type matches `/(marketplace|plugin) "([^"]*)"/` and returns `{ subject, name }`. Every existing `marketplace "<name>"` line still matches.
- `features/support/world.ts`: `gitRepositoryServing(plugin)` returns the one recorded git plugin repository that holds the plugin now. It fails, and names the plugin, when no repository holds it or when more than one does.
- `features/step_definitions/git-host.steps.ts`: the resolver's plugin case returns the owner and name of `gitRepositoryServing(name)`. The marketplace case still fails for a marketplace that is not a git source. Arming goes through the same helper, which registers a disarming release (T-01-25).
- `features/lib/git-clones.ts` (new): `readGitClones(extensionRoot)` lists each directory under `plugin-clones/`, which must be named by a mirror key (`<12 hex>`) or a pinned key (`<12 hex>-<12 hex>`), and each directory under `sources/` that holds `.git`. For each one it returns `{ clone, origin, pin? }`, with the origin read from `[remote "origin"] url` in `.git/config`. It reads only under the extension root it is given (T-01-27).
- `features/step_definitions/plugin/installation.steps.ts`: the two clone steps. Origins and pins are projected through the run tokens, so the host reads `{git host}` and a pin reads `{mono revision 1}`.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`: `{git repository}` names a repository by the marketplace or the plugin it serves.

## Final Text of New Steps

- `Given the git host answers {int} for the {git repository}`, `... drops the connection for the {git repository}`, `... requires the user {string} with the password {string} for the {git repository}`, and `Given the git host serves the {git repository} again` now also take `plugin "<name>"` (no new step text).
- `Then the {word} scope holds these git clones:` with columns `clone` (`plugin` or `marketplace`), `origin`, and `revision` (a revision token for a pinned plugin clone, empty otherwise).
- `Then the {word} scope holds no git clones`

## Seed Results (measured)

- **fetch.feature, "Fetching a plugin succeeds again once the git host serves its repository again"** (new feature, Phase 12 owns it afterwards): `ghp` is installed from `gits` (dir) as an unpinned github source. The host is armed 404 for `plugin "ghp"`, the first fetch fails (every payload is an error), and the arm is lifted. The retried fetch reports `cascade` / `info` / needs reload `false` and one row `gits` / `project` / `ghp@gits` / `ghp` / `available` / no reasons. Request log:

  | method | path                                            | status |
  | ------ | ----------------------------------------------- | ------ |
  | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
  | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

- **git-source.feature, "Uninstalling one of two plugins pinned to one commit keeps the clone the other still uses":** `subp` and `subq` from `mono` are pinned git-subdir sources and both are installed. Uninstalling `subp` reports `cascade` / `info` / needs reload `true` and one row `gits` / `project` / `subp@gits` / `subp` / `uninstalled` / no reasons / `project` / `{mono revision 1}`. The project scope holds one clone: `plugin` / `https://{git host}/acme/mono.git` / `{mono revision 1}`.
- **git-source.feature, "Uninstalling the only installation of a git-source plugin removes its clone":** uninstalling `ghp@gits` reports `cascade` / `info` / needs reload `true` and the row `uninstalled` at `{ghp revision 1}`. The project scope holds no git clones.
- **git-source-update.feature, "Updating a git-source plugin fetches its new revision"** (new feature, Phase 4 owns it afterwards): `gits` is published as a url source and offers `ghp` as an unpinned github source. After `ghp` holds `2.0.0`, the update reports `cascade` / `info` / needs reload `true` and the row `gits` / `project` / `ghp@gits` / `ghp` / `updated` / no reasons / `project` / from `{ghp revision 1}` / to `{ghp revision 2}`. Request log (the marketplace clone is refreshed first):

  | method | path                                             | status |
  | ------ | ------------------------------------------------ | ------ |
  | GET    | /acme/gits.git/info/refs?service=git-upload-pack | 200    |
  | POST   | /acme/gits.git/git-upload-pack                   | 200    |
  | GET    | /acme/ghp.git/info/refs?service=git-upload-pack  | 200    |
  | POST   | /acme/ghp.git/git-upload-pack                    | 200    |

  Clones after the update: `marketplace` / `https://{git host}/acme/gits.git` / empty, and `plugin` / `https://github.com/acme/ghp.git` / empty.

- **reconcile.feature, "A new session adds a marketplace that a config declares by hand and installs its plugin"** (added by the orchestrator): the base config declares `fixtures` with the source `{home}/marketplaces/fixtures` and the plugin `demo`. The new session reports one `reconcile-applied-cascade` / `info` / needs reload `false` / tally `Reconcile` 0 failures, 0 warnings, success count 2, and one row `fixtures` / `project` / marketplace status `added` / `demo@fixtures` / `demo` / `installed` / no reasons / `project`. It offers `/skill:demo-skill`.

## Planted Checks

Each check was made by hand, run, and reverted from a backup. `cmp` confirmed each restore.

1. **Task 1 (a): the plugin case resolves to the marketplace's name** (`directory: "gits"`) while `gits` is a dir marketplace. `npx cucumber-js features/plugin/fetch.feature` failed in the arming step, because the host serves no such repository:

   ```
   Given the git host answers 404 for the plugin "ghp"
       Error: the git host serves no repository acme/gits.git to arm
   1 scenario (1 failed)
   14 steps (7 passed, 6 skipped, 1 failed)
   ```

2. **Task 1 (b): the same plant, with `gits` published as a url source**, so the wrong repository exists and the arm succeeds. The failing fetch setup failed because the fetch succeeded, as the plan requires:

   ```
   Given the user has run "/claude:plugin fetch ghp@gits --scope project", which failed
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       +     kind: 'cascade', ... status: 'available' ... severity: 'info'
       - []
   ```

3. **Task 2 (a): the reader skips `sources/`.** The update seed failed on the clone table, which lost its marketplace row:

   ```
   Then the project scope holds these git clones:
       -     'marketplace',
       -     'https://{git host}/acme/gits.git',
   ```

4. **Task 2 (b): the second state of `ghp` repeats `1.0.0` and pushes nothing** (`pushPluginRepository` returned early). The update seed failed because nothing moved:

   ```
   Then the result has these fields:
         'needs reload',
       +     'false'
       -     'true'
   1 scenario (1 failed)
   ```

5. **Orchestrator seed: the marketplaces writer leaves the source unexpanded** (`source: entry.source`). The reconcile seed failed. The session reported two error results, the marketplace `failed` with `unsupported source` and `demo` `failed` with `unreadable`, so `the result has these fields:` failed with `expected exactly one result`.

## Task Commits

1. **Task 1: Arm and disarm a plugin's repository, seeded by a fetch retried after a 404** - `ac899792` (test), `test(features): arm the repository of a plugin`. Hook: every hook passed on the first attempt, including `npm run check:commit` and gitlint. `SKIP=npm-check pre-commit run --files ...` passed before the commit with no fixer writes. Tracer gate (end-of-phase mode, automated verify only): after the commit I re-ran `npx cucumber-js features/plugin/fetch.feature features/marketplace/failed-add.feature features/marketplace/git-source.feature` (32 scenarios passed) and `npm run check:features` (exit 0), then started Task 2.
2. **Task 2: State the git clones of a scope, seeded by two uninstalls and an update** - `d0c8a515` (test), `test(features): state the git clones of a scope`. Hook: `npm run check:commit` passed and gitlint passed on the first attempt.
3. **Added by the orchestrator: the reconcile seed for a hand-declared marketplace** - `4aebd3c9` (test), `test(features): reconcile a hand-declared marketplace and its plugin`. Hook: `npm run check:commit` passed and gitlint passed on the first attempt.

## Files Created/Modified

- `features/lib/git-clones.ts` - the plugin and marketplace clones of a scope, with origins and pins
- `features/support/git-repository.ts` - the plugin form of `{git repository}`
- `features/support/world.ts` - `gitRepositoryServing`
- `features/step_definitions/git-host.steps.ts` - the plugin case of the resolver
- `features/step_definitions/plugin/installation.steps.ts` - the two clone steps
- `features/plugin/fetch.feature` - `Feature: Plugin fetch` and its seed
- `features/plugin/git-source.feature` - the two uninstall seeds
- `features/plugin/git-source-update.feature` - `Feature: Plugin git source update` and its seed
- `features/plugin/reconcile.feature` - the hand-declared marketplace seed
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - the `{git repository}` sentence

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Added by orchestrator

**1. Reconcile seed for the token expansion of the marketplaces config writer**
- **Found during:** dispatch. Plan 01-09 left WINDOWS #110 open: no seed failed when `a config in scope {word} and layer {word}, with these marketplaces:` left a run token in a source.
- **Change:** one seed in `features/plugin/reconcile.feature` whose base config declares `fixtures` at `{home}/marketplaces/fixtures` and the plugin `demo`. A new session adds the marketplace, installs the plugin, and offers its skill, and the scenario compares the whole reconcile report.
- **Verification:** planted check 5 failed the seed. `npx cucumber-js features/plugin/reconcile.feature` passed (2 scenarios).
- **Ledger:** WINDOWS #110 marked `fixed` through `gsd-tools windows fixed 110`.
- **Committed in:** 4aebd3c9

### Planted check widened

**2. The Task 1 planted check ran in two forms**
- **Found during:** Task 1. With `gits` as a dir marketplace there is no marketplace repository, so the plant failed in the arming step (the host's own guard) and never reached the failing fetch.
- **Change:** a second, uncommitted variant published `gits` as a url source, so the wrong repository existed. That variant failed in the failing fetch setup, as the plan states. Both are recorded above, and both were reverted.

---

**Total deviations:** 2 (1 added by the orchestrator, 1 widened planted check). Nothing was auto-fixed.
**Impact on plan:** None on the planned artifacts. No product file changed.

## Suspicious Values and Bug Candidates

- No product bug blocked a seed, and no product file changed.
- **Phase 12 (fetch):** a successful `fetch` reports the plugin row as `available`, not as a fetched or refreshed status. Whether that wording matches what a user expects from a fetch is Phase 12's to judge.
- **Phase 4 (update):** an update of a github plugin from a url marketplace refreshes the marketplace clone first, then fetches the plugin repository once. A github plugin clone records `https://github.com/acme/ghp.git` as its origin, not the git host's address; the product rewrites it only on the wire. Both look intended (PUP-2, D-77-06). I record them, and I did not change them.
- **Phase 11 (reconcile):** a marketplace source that is an unexpanded `{home}/...` path is reported as `unsupported source`, and its plugin as `unreadable`, twice (the two RPC session bindings). A relative path that does not exist may deserve a clearer reason. Phase 11 decides.

## Issues Encountered

None.

## Verification

- `npx cucumber-js features/plugin/fetch.feature features/marketplace/failed-add.feature features/marketplace/git-source.feature`: 32 scenarios, 295 steps passed.
- `npx cucumber-js features/plugin/git-source.feature features/plugin/git-source-update.feature`: 7 scenarios, 83 steps passed.
- `npx cucumber-js features/plugin/reconcile.feature`: 2 scenarios passed.
- `npm run check:features`: exit 0 after each task.
- `npm run test:cucumber` (Node v26.12.1, at `4aebd3c9`): 462 scenarios, 4382 steps passed.
- Acceptance greps: `marketplace|plugin` in git-repository.ts 1; `gitRepositoryServing` in world.ts 1 and in git-host.steps.ts 1; `export async function readGitClones` 1; each clone step text 1; `revision 2}` in git-source-update.feature 1.
- The phase gate runs `npm run check` on the combined tree.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Phase complete, ready for the phase gate. Phases 4, 11, 12, and 15 can arm plugin repositories and state the clones a command leaves. `fetch.feature` passes to Phase 12 and `git-source-update.feature` to Phase 4.

## Self-Check: PASSED

- FOUND: features/lib/git-clones.ts, features/plugin/fetch.feature, features/plugin/git-source-update.feature
- FOUND: ac899792, d0c8a515, 4aebd3c9 (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*

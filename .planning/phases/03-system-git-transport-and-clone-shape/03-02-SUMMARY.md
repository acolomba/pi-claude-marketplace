---
phase: 03-system-git-transport-and-clone-shape
plan: "02"
subsystem: domain/source parsing
tags: [git, sha-pin, ref, input-refusal, cucumber, SG-TRN-02]

requires: []
provides:
  - "parsePluginSource refuses a git-backed sha that is not 40 or 64 hex digits (after lower-casing) with Claude Code's `Invalid sha` reason"
  - "parsePluginSource refuses a ref that starts with `-` in every path that sets a ref (object field, url and github url #fragment, owner/repo #ref and @ref) with Claude Code's `Invalid ref` reason"
  - "a 64-hex (SHA-256) commit is accepted and lower-cased like a 40-hex one"
  - "cucumber step: the marketplace <name> pins the plugin <plugin> to the commit <commit> (run tokens expanded)"
affects: [system git transport, clone-cache pin ladder, failure-message wording]

actuals:
  tokens: 4124
  tasks: 2
  commits: 2
plan_head_before: e8fbff279978c0beaba3dbb5c5d31741ce4b8724
plan_head_after: 46782ab1e2e176dd293cc91d34f78ea786fdd7cd

tech-stack:
  added: []
  patterns:
    - "Input refusals reuse the parser's `unknown` source arm, so marketplace add reports `{unsupported source}` through parseAddableSource and install reports an unavailable plugin through classifySourceSupport, both before any git process starts"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - test/domain/source.test.ts
    - features/step_definitions/plugin/git-source.steps.ts
    - features/plugin/git-source.feature
    - features/marketplace/url-source.feature

key-decisions:
  - "The sha refusal reports the value as the manifest wrote it; the accepted pin is stored lower-cased (GV-01, clone key)"
  - "withOptionalSourceFields returns ParsedSource non-generically, because sonarjs/function-return-type rejects a generic `T | UnknownSource`"
  - "One helper (refRefusal) owns the ref wording; refusedRefSource wraps it for the string forms, and the object path combines it with shaRefusal"

patterns-established:
  - "A pin or ref refusal is a pure parse: concurrent commands reading the same entry reach the same refusal with no shared state"

requirements-completed: ["SG-TRN-02"]

coverage:
  - id: D1
    description: "An abbreviated or crafted sha is refused while parsing with Claude Code's wording; 40- and 64-hex shas parse lower-cased"
    requirement: "SG-TRN-02"
    verification:
      - kind: unit
        ref: "test/domain/source.test.ts#SG-TRN-02: refuses an abbreviated commit SHA (and the traversal, 41-digit, and SHA-256 rows)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts (100%)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Installing a plugin pinned to an abbreviated commit fails as unavailable/unsupported source, records nothing, leaves no clone, and sends the git host no request"
    requirement: "SG-TRN-02"
    verification:
      - kind: e2e
        ref: "features/plugin/git-source.feature#Installing a plugin pinned to an abbreviated commit is refused before git runs (adapter profile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A ref that starts with a dash is refused in every source form; a dash after the first character is still accepted"
    requirement: "SG-TRN-02"
    verification:
      - kind: unit
        ref: "test/domain/source.test.ts#SG-TRN-02: refuses a ... reference that starts with a dash (7 rows) and the two keep rows"
        status: pass
    human_judgment: false
  - id: D4
    description: "marketplace add of a url whose #ref starts with a dash, and install of a plugin whose entry ref is -x, are refused before any git request"
    requirement: "SG-TRN-02"
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a marketplace whose ref starts with a dash is refused before git runs (adapter profile)"
        status: pass
      - kind: e2e
        ref: "features/plugin/git-source.feature#Installing a plugin whose ref starts with a dash is refused before git runs (adapter profile)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-24
status: complete
---

# Phase 03 Plan 02: SHA-pin and dash-ref input refusals Summary

**The source parser now refuses a sha that is not a full 40- or 64-hex commit and any ref that starts with `-`, with Claude Code 2.1.330's `eLo` wording. So an abbreviated pin no longer installs unpinned, and a ref such as `--upload-pack=<cmd>` never reaches git.**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-11-24T02:47:32Z
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments

- `domain/source.ts`: `FULL_SHA_RE` is now `/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/`, applied to the lower-cased value. `shaRefusal` and `refRefusal` give Claude Code's two reasons. `withOptionalSourceFields` returns an `unknown` source for a refused sha or object ref, where it used to drop the sha silently. `parseUrlSource`, `parseGitHubUrl`, and `parseShorthandSourceForm` refuse a dash-led `#`/`@` ref through `refusedRefSource`.
- Unit rows: the two old "drops" rows are now refusal rows. New rows cover a 41-digit sha, a 64-hex sha in lower and upper case, seven dash-ref refusals (github, url, and git-subdir objects; a url fragment `--upload-pack=x`; a github URL fragment; the `#` and `@` shorthands), and two rows that keep `feature/-x`.
- Three cucumber scenarios. Each fails on the code before its task and passes after it.

## Task Commits

1. **Task 1 (tracer): an abbreviated sha is refused before git runs**, `fc1b9bf` (fix). Unit RED and GREEN in one commit, as the sandbox notes require.
2. **Task 2: a dash-led ref is refused for plugins and for marketplace add**, `46782ab` (fix). Unit RED and GREEN in one commit.

The SUMMARY commit follows these two.

## TDD evidence (RED, then GREEN)

The commit hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each RED was run locally and is recorded here. RED and GREEN were committed together.

**Task 1 unit RED** (`node --import scripts/isolated-pi-home.mjs --test --test-reporter=tap test/domain/source.test.ts`, exit 1):
```
    not ok 38 - SG-TRN-02: refuses an abbreviated commit SHA
    not ok 40 - SG-TRN-02: refuses a traversal-shaped commit SHA
    not ok 41 - SG-TRN-02: refuses a 41-digit commit SHA
    not ok 42 - SG-TRN-02: accepts a full lowercase SHA-256 commit
    not ok 43 - SG-TRN-02: lowercases a full uppercase SHA-256 commit
# tests 197  # pass 192  # fail 5
```
Semantic assessment: every target row ran and failed on its `deepStrictEqual` assertion for the planned behavior. The old parser dropped the bad sha, so it returned a pinless source instead of the refusal, and it dropped the 64-hex sha because of the 40-only regex. There were no load, syntax, or fixture faults.

**Task 1 scenario RED** (`npx cucumber-js --profile adapter --name 'Installing a plugin pinned to an abbreviated commit is refused before git runs'`, run on the original `source.ts`, exit 1): `Then the result has these fields` failed with actual `severity info`, `needs reload true` and no summary. The old code installed the plugin unpinned. GREEN: 1 scenario, 14 steps passed.

**Task 2 unit RED** (same command, exit 1): `not ok 44` to `not ok 50`, the seven dash-ref refusal rows, failed on their assertions (`# tests 206 # pass 199 # fail 7`). The two `feature/-x` keep rows passed, as expected. Semantic assessment: each target row ran and failed because the old parser kept the ref.

**Task 2 scenario RED** (`--name 'ref starts with a dash is refused before git runs'`, run on the Task 1 `source.ts`, exit 1). The marketplace add row read `source missing` where the scenario expects `unsupported source`, so the old code sent `-x` to the git host. The install row read `failed` with the cause `Could not find -x.`, so the old code passed `-x` to git as a ref. GREEN: both feature files under the adapter profile, 38 scenarios and 497 steps passed.

**GREEN verify (both tasks):** `test/domain/source.test.ts` 206/206 pass. `npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts` exit 0, at 100%. `typecheck`, `check:features`, and `eslint --max-warnings 0` on the touched files all exit 0. `npx fallow dupes` is clean. Neighbouring suites also pass: clone-key, version, git-source-probe, clone-cache, list-candidate-version, install-clone-probe, plugin info and fetch, marketplace add and update, import, and reconcile plan, 1,476 tests in total. Both commits passed the pre-commit hook, `npm run check:commit` included.

**Tracer gate:** after `fc1b9bf`, the three Task 1 verify commands were run again and all three passed. Only then did Task 2 start.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/source.ts`: the sha and dash-ref refusals.
- `test/domain/source.test.ts`: the refusal, SHA-256, and keep rows.
- `features/step_definitions/plugin/git-source.steps.ts`: the new step `the marketplace {string} pins the plugin {string} to the commit {string}`, which expands run tokens.
- `features/plugin/git-source.feature`: two install-refusal scenarios.
- `features/marketplace/url-source.feature`: the marketplace-add refusal scenario.

## Decisions Made

- The refusal reason quotes the value as the manifest wrote it, as upstream does. An accepted sha is stored lower-cased.
- `withOptionalSourceFields` returns `ParsedSource`, not a generic `T | UnknownSource`. The first commit attempt failed the hook's lint on `sonarjs/function-return-type`, and the non-generic signature fixes that. All three callers already returned `ParsedSource`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The sha step lives in the git-source step module, not in `features/lib/git-plugin.ts` or `publishing.steps.ts`**
- **Found during:** Task 1
- **Issue:** The plan proposed sha and ref columns on the offers table, or a new step. `features/step_definitions/plugin/git-source.steps.ts` already owns `changeGitPluginSource`, with the steps `names the ref {string} for the plugin {string}` and `pins the plugin {string} to a commit its repository lacks`.
- **Fix:** One new step in that module, `the marketplace {string} pins the plugin {string} to the commit {string}`. Task 2 reuses the existing `names the ref` step. The offers table and `pinned` are unchanged.
- **Files modified:** features/step_definitions/plugin/git-source.steps.ts
- **Committed in:** fc1b9bf

**2. [Rule 1 - Scenario accuracy] The abbreviated pin is the 12-digit `{urlp revision 1}`, not a 7-character prefix**
- **Found during:** Task 1
- **Issue:** The commit changes on every run. Only the 12-digit revision token and the 40-hex commit token are projected, so a 7-character prefix could not appear in a scenario.
- **Fix:** The entry pins `{urlp revision 1}`, the real 12-hex prefix of the repository's revision. That is an abbreviated sha all the same.
- **Committed in:** fc1b9bf

**3. [Plan accuracy] The install row is `unavailable / unsupported source`, and no row carries the refusal text**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan expected the install row to be "failed with the unsupported-source reason and the cause naming the sha refusal", and the marketplace-add row to carry the cause `Cannot add marketplace from ...`. In fact the resolver's note folds into the closed reason vocabulary (`unsupported source`), and an unavailable plugin row or a failed marketplace row has no cause column. The recordTable step compares every field a record holds, so the scenarios already check the whole row.
- **Fix:** The scenarios state the full row as it is: `unavailable | unsupported source` for an install, `failed | unsupported source` for a marketplace add. The refusal wording is checked by the unit rows. The `UnsupportedSourceError` message still carries it (`Cannot add marketplace from "<raw>": Invalid ref "-x": cannot start with "-"`), as does the resolver note (`unsupported source kind: unknown (Invalid sha "...": ...)`).
- **Committed in:** fc1b9bf, 46782ab

**4. [Rule 1 - Lint] `sonarjs/function-return-type` on the generic helper**
- **Found during:** Task 1 commit (the hook's `check:commit`)
- **Fix:** A non-generic `ParsedSource` return type, see Decisions.
- **Committed in:** fc1b9bf

**Total deviations:** 4 (1 blocking, 2 scenario or plan accuracy, 1 lint). **Impact:** none on scope. Every scenario checks the full result, the record, the clones, and the request log.

## Issues Encountered

- The new worktree had no optional-peer cache. `node scripts/install-test-peers.mjs`, the project's own setup script, filled it before the first cucumber run.

## Note for the failure-message phase

The two refusal texts are Claude Code 2.1.330's `eLo` wording: `Invalid sha "<x>": must be a full commit hash (40 or 64 hex digits)` and `Invalid ref "<x>": cannot start with "-"`. They travel on the unsupported-source cause. For an install, that is `unsupported source kind: unknown (<reason>)` in the resolver note. For a marketplace add, it is `Cannot add marketplace from "<raw>": <reason>` on `UnsupportedSourceError`. Neither reaches a result row today.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-04 (a dash-led ref reaching git's option parser) and T-03-05 (an abbreviated sha installing unpinned) are mitigated in `domain/source.ts`. T-03-SC: no package was installed, and no dependency file changed.

## Orchestrator actions

None. The plan asks for no `windows append`.

## User Setup Required

None.

## Next Phase Readiness

Every git-backed source that reaches the transport now carries either no sha or a full lower-case commit id, and no ref that starts with `-`. Later plans can rely on that when they build the `--end-of-options` and attached `--branch=` layers.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/source.ts, test/domain/source.test.ts, features/step_definitions/plugin/git-source.steps.ts, features/plugin/git-source.feature, features/marketplace/url-source.feature
- FOUND: fc1b9bf, 46782ab (on this branch, after e8fbff2)
- Acceptance greps: `40 or 64 hex digits` = 1; `abbreviated commit is refused before git runs` = 1; `cannot start with` = 1; `ref starts with a dash is refused before git runs` = 1 in each feature file.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*

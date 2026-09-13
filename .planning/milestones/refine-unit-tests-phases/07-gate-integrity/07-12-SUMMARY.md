---
phase: 07-gate-integrity
plan: 12
subsystem: orchestrators/plugin
tags: [reinstall, dependency-injection, test-only-surface, GGAT-04]
status: complete

requires:
  - "07-10 (removed the sibling `__operations` bag in the same file neighbourhood)"
provides:
  - "`stateTransaction?`, `removeDataDir?`, `cloneCacheSeam?` as typed top-level members of `ReinstallPluginOptions` and `ReinstallPluginsOptions`"
  - "Zero `__`-prefixed options members anywhere under `extensions/`, so 07-13's gate can ship green"
affects:
  - "07-13 (the `__`-prefixed member gate — its last live offender is gone)"
  - "07-15 (unowned-export census — one export removed; see the delta below)"

tech-stack:
  added: []
  patterns:
    - "Typed optional collaborator port on the options interface (`cloneCacheSeam?` form shared with install-flow.ts, fetch.ts, info.ts)"
    - "Conditional-spread forwarding `...(x !== undefined && { x })` per named capability under exactOptionalPropertyTypes"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts

key-decisions:
  - "The retry-case factory `observeRetryDeps` was renamed `observeRetryCollaborators` and now returns `Required<Pick<ReinstallPluginOptions, \"removeDataDir\" | \"stateTransaction\">>`; each case destructures it and names both capabilities at the call site, so no bag survives under a new spelling."
  - "The two inline `const deps: ReinstallPluginDeps` literals became one `const` per capability (`RemoveDataDirFn`, `LockedStateTransactionDeps`), so the case declares the capabilities it exercises rather than an object."
  - "Tasks 1 and 2 landed in one commit: five executors share this working tree and a signature-only commit would leave the tests red for siblings who cannot fix them."
  - "One test case was ADDED. Splitting one cascade-forwarding branch into three made `stateTransaction` forwarding its own branch, and no bulk case exercised it — direct-pair coverage fell to 98/99 until the case existed."

requirements-completed: [GGAT-04]

coverage:
  - deliverable: "The three capabilities are named, typed, documented members of both options interfaces"
    human_judgment: false
    verification:
      - kind: command
        ref: "git grep -c '__deps' -- . ':!.planning' → 0; git grep -c 'ReinstallPluginDeps' → 0"
        status: pass
      - kind: command
        ref: "npm run typecheck"
        status: pass
  - deliverable: "The bulk cascade forwards each capability by name and forwards none that was not supplied"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#PRL-03: a bulk cascade forwards the state-transaction seam to every per-plugin reinstall"
        status: pass
      - kind: test
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#retry proof: reinstall: a bulk cascade keeps the earlier committed target and the retry reinstalls the ordered set once"
        status: pass
  - deliverable: "Reinstall behaviour, ordering, rollback, and notifications are unchanged"
    human_judgment: false
    verification:
      - kind: command
        ref: "node --test on the four reinstall-family suites (159 tests, 0 fail)"
        status: pass
      - kind: command
        ref: "npm run check (whole chain, exit 0)"
        status: pass
      - kind: command
        ref: "npm run test:integration inside the chain (32 tests, 0 fail — same count as before)"
        status: pass
  - deliverable: "The owner module keeps complete direct-pair coverage"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm run test:coverage:direct -- .../reinstall-flow.ts (branches 99/99, functions 18/18, lines 924/924)"
        status: pass

metrics:
  duration: "52 min"
  completed: 2026-09-10

actuals:
  tokens: 71000
  tasks: 3
  commits: 1
  plan_head_before: 5b8d8f32d568293969b7bb3e0de41b2567330a71
---

# Phase 07 Plan 12: Remove `__deps` Summary

The reinstall flow's locked-state transaction, plugin-data-directory removal, and clone-cache seam
are now three named, documented, typed members of both reinstall options interfaces, so every
substitution is visible at the call site instead of hidden inside an anonymous bag.

## Accomplishments

- **`ReinstallPluginDeps` is retired and both `__deps` members are gone.** `stateTransaction?:
  LockedStateTransactionDeps`, `removeDataDir?: RemoveDataDirFn`, and `cloneCacheSeam?:
  ReinstallCloneCacheSeam` sit on `ReinstallPluginOptions` and on `ReinstallPluginsOptions`, each
  with a doc comment in the form `install-flow.ts:163`, `fetch.ts:111`, and `info.ts:127` already
  use — a sentence naming the seam plus the statement that production callers leave it undefined.
- **The bulk cascade forwards three named members** through the file's existing
  `...(x !== undefined && { x })` idiom instead of one opaque object. An absent capability stays
  absent rather than becoming an explicit `undefined`, so `exactOptionalPropertyTypes` is satisfied
  without a cast.
- **All 54 owner-test call sites name their capabilities individually.** No helper takes or spreads
  a deps-shaped object; the retry factory now returns two named collaborators that each case
  destructures.
- **No default was added at any use site.** `removeDataDir`'s fallback to `defaultRemoveDataDir`
  still lives in `reinstall-replace.ts` and was not duplicated.

## The Nine Pre-Change Sites and What Each Became

`ReinstallPluginDeps` had three members and nine sites inside `reinstall-flow.ts`.

| # | Before | After |
|---|---|---|
| 1 | `ReinstallPluginDeps` interface, `:119-123` | deleted — no member and no consumer remained |
| 2 | `ReinstallPluginDeps.stateTransaction`, `:120` | `ReinstallPluginOptions.stateTransaction` `:135` and `ReinstallPluginsOptions.stateTransaction` `:161` |
| 3 | `ReinstallPluginDeps.removeDataDir`, `:121` | `ReinstallPluginOptions.removeDataDir` `:140` and `ReinstallPluginsOptions.removeDataDir` `:166` |
| 4 | `ReinstallPluginDeps.cloneCacheSeam`, `:122` | `ReinstallPluginOptions.cloneCacheSeam` `:144` and `ReinstallPluginsOptions.cloneCacheSeam` `:171` |
| 5 | `ReinstallPluginOptions.__deps`, `:138` | replaced by rows 2-4's single-plugin half |
| 6 | `ReinstallPluginsOptions.__deps`, `:151` | replaced by rows 2-4's bulk half |
| 7 | read `opts.__deps?.stateTransaction`, `:257` | `opts.stateTransaction`, `:277` |
| 8 | read `opts.__deps?.removeDataDir`, `:396-397` | `opts.removeDataDir`, `:416-417` |
| 9 | forward `...(opts.__deps !== undefined && { __deps: opts.__deps })`, `:531` | three named conditional spreads, `:551-553` |
| 10 | read `opts.__deps?.cloneCacheSeam`, `:714-715` | `opts.cloneCacheSeam`, `:736-737` |

Rows 1-9 are the plan's nine; row 10 is the third read site, counted inside row 4's member in the
plan's arithmetic and listed separately here so every line movement is attributable.

## One-For-One Reachability

A capability newly reachable from a call site that could not reach it before would be a widened
surface. None is.

| Capability | Could reach it before | Can reach it now | Difference |
|---|---|---|---|
| `stateTransaction` | any caller of `reinstallPlugin` (`ReinstallPluginOptions.__deps`) and any caller of `reinstallPlugins`, which forwarded the whole bag | the same two option surfaces, now as a named member | none |
| `removeDataDir` | same two surfaces, via the bag | same two surfaces, named | none |
| `cloneCacheSeam` | same two surfaces, via the bag | same two surfaces, named | none |

Both production callers — `edge/register.ts:87` (`createNodeReinstallPlugins`) and
`orchestrators/reconcile/backfill.ts:214` (`createNodeReinstallPlugin`) — supply none of the three,
before or after: `grep -n 'stateTransaction\|removeDataDir\|cloneCacheSeam'` over those two files
and over `edge/handlers/plugin/reinstall.ts` returns nothing. The bag was already only reachable
from tests, and the promotion neither adds nor removes a reachable site.

The one substantive difference is inside the cascade, and it is a narrowing rather than a widening:
`...(opts.__deps !== undefined && { __deps: opts.__deps })` forwarded whatever the bag held as one
unit; the three replacement spreads each test their own member, so supplying one capability no
longer carries the object that could have held the other two.

## Assertion Counts, Before and After

Measured with identical commands over `git show HEAD~1:<file>` (before) and the working tree
(after). No count decreased.

| Metric | Command | Before | After |
|---|---|---|---|
| Cases | `grep -c '^test('` | 112 | **113** |
| Ordering assertions | `grep -cE 'assert\.deepStrictEqual\((firstSchedule\|secondSchedule)'` | 26 | 26 |
| Invocation-count assertions | `grep -cE 'assert\.[a-zA-Z]+\([^)]*\.length'` | 38 | 38 |
| Fault-injection sites | `grep -cE 'assert\.rejects\|Promise\.reject\|throw new Error'` | 19 | 19 |
| `createRetryReinstall` sites | `grep -c 'createRetryReinstall('` | 13 | 13 |
| `observeReinstallOperations` sites | `grep -c 'observeReinstallOperations('` | 4 | 4 |
| Total `assert.*` calls | `grep -c 'assert\.'` | 636 | **638** |
| `deps` occurrences | `grep -c 'deps'` | 70 | **2** |
| `__deps` occurrences | `grep -c '__deps'` | 54 | **0** |

The case count rose by one and the assert count by two because one case was added (see Deviation
1). No case was consolidated, renamed, or removed: the 112 pre-existing titles are all still
present, and `node --test` reports 116 tests (113 top-level plus the 3 nested cases the file has
always carried) against 115 before.

### The Two Surviving `deps` Occurrences

Both are unrelated temp-directory prefixes, not the bag:

| Line | Text | What it is |
|---|---|---|
| 918 | `mkdtemp(path.join(tmpdir(), "reinstall-output-deps-"))` | a case-owned root name |
| 1533 | `mkdtemp(path.join(tmpdir(), "reinstall-bulk-soft-deps-"))` | a case-owned root name for the soft-dependency cascade |

Neither names a capability bag, and neither was touched.

### The Three Migrated Shapes

| Shape | Sites | Became |
|---|---|---|
| `__deps: { <one or more members> }` inline literal | 26 | those members hoisted to the options level, one nesting level shallower |
| `__deps: deps` where `deps` came from the retry factory | 26 | `removeDataDir,` and `stateTransaction,` shorthand, inserted in the literal's existing alphabetical position |
| `__deps: deps` where `deps` was an inline `removeDataDir`-only literal | 2 | `removeDataDir,` shorthand |

## Export Census Delta (for 07-15)

**One export removed, none added.** `reinstall-flow.ts` carried 9 exported symbols and now carries
8.

| Export | Before | After |
|---|---|---|
| `ReinstallHooksRouting` | 113 | 113 |
| `ReinstallPluginDeps` | 119 | **removed** |
| `ReinstallPluginOptions` | 126 | 119 |
| `ReinstallPluginsOptions` | 142 | 148 |
| `ReinstallPluginFn` | 155 | 175 |
| `ReinstallPluginsFn` | 160 | 180 |
| `createReinstallPlugin` | 180 | 200 |
| `createNodeReinstallPlugin` | 196 | 216 |
| `createNodeReinstallPlugins` | 204 | 224 |

The three promoted members are members of two already-exported interfaces, not new exports. The
downstream line movement is caused by the doc comments the promoted members carry.

## Runtime-State Confirmation

No persisted record, npm script, CI job, or pre-commit hook names the removed identifiers, so the
removal touches nothing outside the source tree.

| Surface | Check | Result |
|---|---|---|
| Repository source | `git grep -n "__deps" -- . ':!.planning'` | no matches |
| Repository source | `git grep -n "ReinstallPluginDeps" -- . ':!.planning'` | no matches |
| npm scripts | `grep -c "__deps\|ReinstallPluginDeps" package.json` | 0 |
| CI workflows | `grep -rn "__deps\|ReinstallPluginDeps" .github` | none |
| Pre-commit hooks | `grep -c "__deps\|ReinstallPluginDeps" .pre-commit-config.yaml` | 0 |
| Build/coverage scripts | `grep -rn "__deps\|ReinstallPluginDeps" scripts` | none |
| Serialization | all three capabilities are in-memory functions/records held on an options object; no `JSON.stringify` or atomic-write path reaches them | never serialized |

The remaining `__deps` hits in the tree are all inside `.planning/` — the plan, research, patterns,
and context documents that specify this removal. They are not source.

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx eslint` on both owned files `--max-warnings=0` | exit 0 |
| `npx prettier --check` on both owned files | clean |
| `npx fallow health --fail-on-issues --format human` | exit 0, 0 above threshold |
| `node --test` owner suite | 116 tests, 0 fail |
| `node --test` reinstall family (flow, replace, record, edge handler) | 159 tests, 0 fail |
| `node --test "tests/architecture/*.test.ts"` | 383 tests, 0 fail |
| `npm run test:coverage:direct -- .../reinstall-flow.ts` | pass — branches 99/99, functions 18/18, lines 924/924 |
| `npm run check` | **exit 0** |
| `npm run test:integration` (inside the chain) | 32 tests, 0 fail — same count as before |
| `SKIP=trufflehog pre-commit run --files <owned files>` | clean before the commit |

Integration case count is 32 before and after. This plan touched zero files under
`tests/integration/`, so the count is unchanged by construction as well as by measurement.

## Deviations from Plan

### 1. [Rule 2 - Missing critical] One test case added for the cascade's `stateTransaction` forwarding

- **Found during:** Task 2
- **Issue:** `npm run test:coverage:direct -- .../reinstall-flow.ts` reported `branches 98/99`.
  Splitting one cascade-forwarding branch (`opts.__deps !== undefined`) into three named ones made
  `opts.stateTransaction !== undefined` its own branch, and no bulk case had ever supplied a state
  transaction through `reinstallPlugins` — the bag carried it there implicitly whenever a case
  supplied `cloneCacheSeam` or `removeDataDir`. Task 2's own `<verify>` requires that command to
  exit 0.
- **Fix:** Added `PRL-03: a bulk cascade forwards the state-transaction seam to every per-plugin
  reinstall`. It reinstalls two path-source plugins under one marketplace target with a substituted
  `saveState` that records its `extensionRoot` and delegates to the real one, then asserts both
  plugins reinstalled and that the substituted call fired once per cascaded plugin. The proof is an
  invocation-count proof of the forwarding, which is precisely the behaviour the promotion changed.
- **Files modified:** `tests/orchestrators/plugin/reinstall-flow.test.ts`
- **Verification:** branches 99/99, and the suite reports 116 tests, 0 fail
- **Commit:** `8cacc233`

### 2. [Rule 3 - Blocker] Tasks 1 and 2 committed together

- **Found during:** Task 1
- **Issue:** Task 1 removes two members from two exported interfaces; Task 2 migrates the 54 test
  call sites that pass them. Committing Task 1 alone leaves the owner suite red under a whole-repo
  `tsc --noEmit`, and the pre-commit `npm-typecheck` hook is `pass_filenames: false`. Four sibling
  executors share this working tree and could not fix a file they do not own. Task 1's `<verify>`
  block also runs `npm run typecheck` over the whole tree, which cannot pass until Task 2 lands.
- **Fix:** Both tasks landed in commit `8cacc233`. Task 3 produced no code change and therefore no
  commit of its own. This mirrors the same call recorded in `07-10-SUMMARY.md`.
- **Files modified:** both declared files
- **Verification:** `npm run check` exit 0
- **Commit:** `8cacc233`

### 3. [Rule 3 - Blocker] The retry factory was renamed and its return type re-expressed

- **Found during:** Task 2
- **Issue:** `observeRetryDeps` declared `: ReinstallPluginDeps`, the interface Task 1 deletes, so
  it could not compile unchanged. Leaving the name would also have kept the bag's spelling on a
  function whose whole purpose is to hand a case its collaborators.
- **Fix:** Renamed to `observeRetryCollaborators`, returning
  `Required<Pick<ReinstallPluginOptions, "removeDataDir" | "stateTransaction">>` — the two options
  members, both present. Every one of its 13 call sites destructures it
  (`const { removeDataDir, stateTransaction } = observeRetryCollaborators(...)`) and names both at
  the reinstall call. No helper takes or spreads a deps-shaped argument, so the plan's prohibition
  on reconstituting the bag holds.
- **Files modified:** `tests/orchestrators/plugin/reinstall-flow.test.ts`
- **Verification:** `grep -c 'deps'` fell from 70 to 2, both unrelated temp-dir names
- **Commit:** `8cacc233`

**Total deviations:** 3 auto-fixed (1 Rule 2 — missing critical proof; 2 Rule 3 — blocking issues).
**Impact:** none on behaviour. No production operation order, rollback sequence, state byte, or
notification changed.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. `T-07-33` is closed by construction — the anonymous substitution point is gone. `T-07-34` is
answered by the reachability table above: no capability became reachable from a site that could not
reach it. `T-07-35` is answered by the assertion-count table: no count decreased and no case was
consolidated. No new network endpoint, auth path, file-access pattern, or schema at a trust
boundary was introduced.

## Sibling Noise Encountered

`SKIP=trufflehog pre-commit run --files <owned files>` failed twice on `npm-lint` ("files were
modified by this hook") and `npm-format-check` (`tests/architecture/import-boundaries.test.ts`),
while a concurrent executor was mid-edit on files under `tests/architecture/`. Neither failure
named a file this plan owns. Running `npm run typecheck` and `prettier --check` directly
immediately afterwards both reported clean, and the hooks passed on re-run. No edit was made to any
non-owned file.

## Issues Encountered

None.

## Next Phase Readiness

`__deps` and `__operations` are both gone from source, so no `__`-prefixed options member survives
anywhere under `extensions/` and `07-13-PLAN.md`'s gate can ship green against its own tree.
`07-15`'s unowned-export census must subtract `ReinstallPluginDeps` from `reinstall-flow.ts` and
pick up the shifted line numbers recorded above.

## Self-Check: PASSED

Both modified files exist on disk. Commit `8cacc233` resolves in `git log --all` and touches
exactly the two declared files (`git diff --diff-filter=D --name-only HEAD~1 HEAD` → no deletions).
`.planning/STATE.md` and `.planning/ROADMAP.md` carry no commit from this plan.

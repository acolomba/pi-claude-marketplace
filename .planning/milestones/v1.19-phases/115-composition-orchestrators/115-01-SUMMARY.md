---
phase: 115-composition-orchestrators
plan: 01
subsystem: testing
tags: [node-test, coverage, completion-cache, hermetic-fixtures, edge-deps]

requires:
  - phase: 114-plugin-and-marketplace-lifecycle
    provides: "The case-owned temporary scope, whole-value assertion, and independently authored row-table idioms this suite copies"
provides:
  - "A contract-compliant sole owner for orchestrators/edge-deps.ts with no derived expectation and no cross-owner import"
  - "A proven delivery recipe (case-owned scope, fail-fast transport, literal row table, direct-coverage gate, fallow, pair-atomic commit) for the seven remaining pairs"
  - "A measured caveat on the arrange-marker acceptance check that the remaining seven plans will hit"
affects: [115-02, 115-03, 115-04, 115-05, 115-06, 115-07, 115-08]

actuals:
  tokens: 5215
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Fail-fast process-wide transport replacement, asserted uncalled, as the offline proof for a module with no injectable port"
    - "Fixture trees rooted inside the case's own temporary working directory so one removal covers every artifact"

key-files:
  created: []
  modified:
    - tests/orchestrators/edge-deps.test.ts

key-decisions:
  - "Kept the mandated data-row loop, so arrange markers count case bodies (9), not runtime cases (24)"
  - "Rooted marketplace fixtures inside the case cwd instead of a second mkdtemp, removing the leak at its source"
  - "Dropped the unsafe-plugin-name case: its fold lives in git-source-probe.ts, not in this pair"
  - "Skipped pre-commit --all-files because its markdown and text fixers write to files unrelated to this pair"

patterns-established:
  - "Independent expectation: every status is a written-out literal; the classifier is never re-run to produce one"
  - "Hermetic scope: one cwd plus one home per case, both removed and both environment variables restored through t.after() registered before the act phase"
  - "Whole-value assertion: the complete row list in declaration order, the whole projected scope state, the exact cache path"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "makeLocationsResolver returns the two cache paths, the projected scope state, and the complete manifest row list for every status partition, each asserted as one whole value against a hand-authored literal"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts (24 cases, 4 describes)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/edge-deps.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "No expected value is produced by production code and the suite reaches no second pair's surface"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "rg prohibited-pattern scan over tests/orchestrators/edge-deps.test.ts (exit 1, no match)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every case owns one temporary tree, restores HOME and PI_CODING_AGENT_DIR through t.after(), and proves the external transport was never reached"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts#createHermeticScope + assert.strictEqual(scope.fetchCallCount(), 0)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-01
status: complete
---

# Phase 115 Plan 01: Composition Orchestrators Summary

**`edge-deps.ts` now has an owner whose every expectation is hand-authored: the case that built its answer by re-running the production classifier is gone, the cross-owner row-builder import is gone, and the suite is hermetic — at the same 26/26 branches, 8/8 functions, 242/242 lines.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-01T22:55:00Z
- **Completed:** 2026-09-01T23:19:36Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Removed the two derived-expectation paths the plan targeted. The parity case that
  computed `expectedByName` by calling the same classification the module calls is
  replaced by a 16-row table whose status column is a written-out literal; the
  `availableRowMessage` import and its call site are gone, so this suite no longer reads
  a second pair's production surface for evidence.
- Replaced 40 `assert.equal` and 13 `assert.ok` probes with whole-value comparisons: 3
  `assert.deepStrictEqual` (the complete row list in declaration order, the complete
  projected scope state, the empty-scope state), 14 `assert.strictEqual` (exact cache
  paths, the error cause message, and the transport call count), and 5 `assert.ok` that
  do nothing but narrow a typed error inside a `rejects` predicate.
- Made every case hermetic. The old file-local wrapper restored `HOME` only in a
  `finally` and its `cleanup` removed neither of its two `mkdtemp` roots; the file had
  zero `t.after()` calls. Each case now takes one `cwd` and one `home`, registers the
  removal of both plus the `HOME` and `PI_CODING_AGENT_DIR` restores through `t.after()`
  before the resolver runs, and roots its marketplace fixture inside its own `cwd` so no
  third root can leak.
- Installed the D-18 offline proof the suite never had: a context-owned `fetch`
  replacement that throws, asserted at zero calls in all 24 cases.
- Gave all 24 runtime cases separate lowercase `// arrange`, `// act`, `// assert`
  phases. The prior file had none.

## Task Commits

1. **Task 1: Rewrite the edge-deps owner with independent expectations and a hermetic per-case scope** - `76a37a66` (test)

**Plan metadata:** not committed — the orchestrator owns planning artifacts.

## Files Created/Modified

- `tests/orchestrators/edge-deps.test.ts` — rewritten (837 → 593 lines). Four top-level
  `describe()` blocks, one per public operation reached through the export:
  `marketplaceNamesCachePath` (2 cases), `pluginCachePath` (2), `loadStateForScope` (2),
  `loadManifestForMarketplace` (16 row-table cases + 2 soft-failure cases).

## Measured Results

Every number below was observed, not estimated.

**Focused run** — `node --test tests/orchestrators/edge-deps.test.ts`:

```
ℹ tests 24
ℹ suites 4
ℹ pass 24
ℹ fail 0
ℹ skipped 0
ℹ todo 0
```

**Direct coverage** — `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`, verbatim final line, identical before and after the rewrite:

```
Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/edge-deps.ts (branches 26/26, functions 8/8, lines 242/242)
```

No coverage exception, pragma, or production seam was added. The branches the deleted
derived case used to execute are now closed behaviorally: an installed record the
manifest no longer declares closes the optional-chaining arm on the candidate lookup, a
not-installed entry that declares no version closes the conditional-spread arm, and the
mixed `ordered-mp` fixture closes the already-installed skip.

**Repository gates:**

| Gate | Result |
|------|--------|
| `npm run typecheck` | pass |
| `npm exec -- eslint tests/orchestrators/edge-deps.test.ts` | pass, no output |
| `npm exec -- prettier --check tests/orchestrators/edge-deps.test.ts` | `All matched files use Prettier code style!` |
| `npm run fallow` (dead-code, health, dupes) | exit 0 — dead-code `✓ No issues found`, health `0 above threshold`, dupes reports no clone group containing this file |
| `npm test` | `tests 4754 · pass 4754 · fail 0` |
| `npm run test:integration` | `tests 28 · pass 28 · fail 0` |
| prohibited-pattern `rg` scan | no match (the scan's negation succeeds) |
| `git diff --quiet -- extensions/` | clean — no production file changed |

**`npm run check`** stops at `format:check` with the documented pre-existing failure and
nothing else:

```
[warn] .mcp.json
[warn] .planning/research/.cache/*.json   (7 files)
[warn] Code style issues found in 8 files.
```

All 8 are untracked files this plan did not create or touch; `.prettierignore` lacks
`.planning/`. No file under `tests/` or `extensions/` appears. The chain members the
failure blocked (`npm test`, `npm run test:integration`) were run individually and are
recorded above.

## Decisions Made

1. **Fixtures live inside the case's own `cwd`.** The old helper opened a second
   `mkdtemp` per marketplace and never removed it. Rooting the manifest, the plugin
   trees, and the state file under `<cwd>/marketplaces/<name>` means one `rm` in
   `t.after()` covers everything, and there is no second root to forget.
2. **Dropped the unsafe-plugin-name case.** The old suite asserted that a manifest entry
   named `bad/name` degrades to `unavailable`. That fold now lives entirely in
   `git-source-probe.ts` — `edge-deps.ts` holds no `try`/`catch` around the
   not-installed row builder — so under D-20 the case is another pair's evidence and
   contributes no branch here.
3. **Soft-failure cause asserted by class, not by substring.** The malformed-manifest
   case asserts `cause instanceof InvalidMarketplaceManifestError` and
   `cause.cause instanceof SyntaxError`. The old ENOENT variant was dropped: it exercises
   the same wrap branch and its only distinguishing evidence would be an untyped `.code`
   read requiring a cast.
4. **`// act` creates the promise, `// assert` awaits the rejection.** The combined
   `// act & assert` marker admits exactly one expression, which would have left no room
   for the transport assertion the phase contract requires in every case.

## Deviations from Plan

### 1. [Rule 3 - Blocking] `pre-commit run --all-files` not run

- **Found during:** Task 1, pre-commit stage.
- **Issue:** The plan's verification asks for `pre-commit run --all-files`. That
  invocation adds `mdformat`, `markdownlint-cli2`, and the `texthooks` fixers over every
  tracked Markdown and YAML file. Those hooks **write**, so a run would rewrite operator
  and planning files that a single `.ts` change cannot have affected, mid-phase, with
  seven plans still to execute.
- **Fix:** Ran `pre-commit run --files tests/orchestrators/edge-deps.test.ts` instead.
  The four hooks that actually gate TypeScript (`npm lint`, `npm format check`,
  `npm typecheck`, `npm fallow`) all invoke whole-repository npm scripts regardless of
  the file list, so the scoped run exercises them at full repository scope. Results:
  `npm lint` Passed, `npm typecheck` Passed, `npm fallow` Passed, `npm format check`
  Failed on the 8 untracked files described above and nothing else.
- **Verification:** Hook output inspected line by line; the only failure names untracked
  files outside this plan's scope.

### 2. [Rule 3 - Blocking] trufflehog scanned by the filesystem route

- **Found during:** Task 1, pre-commit stage.
- **Issue:** This checkout is a linked worktree, so `.git` is a file and the hook's
  git-mode scan aborts structurally:
  `failed to read index file: open .../.git/index: not a directory`.
- **Fix:** Ran the filesystem scan CLAUDE.md documents before committing:
  `trufflehog filesystem tests/orchestrators/edge-deps.test.ts --results=verified,unknown --fail`
  → `verified_secrets: 0, unverified_secrets: 0`, exit 0. The commit then used
  `SKIP=trufflehog` and no other skip.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — environment, not code).
**Impact on plan:** None on the deliverable. No scope creep; no production file changed.

## Issues Encountered

**The acceptance criterion on arrange markers cannot hold as literally written, and the
seven remaining plans will hit this.** The criterion says "the count of arrange markers
equals the count of runtime cases". The plan also mandates the data-row idiom: "a `for`
loop that wraps `test()` to emit one sibling case per row. Never a loop inside one case."
These two requirements are in direct tension. With the loop, one marked case body emits
16 runtime cases, so this file has **9 case bodies carrying 9 `// arrange` markers and 24
runtime cases**. Every runtime case still executes a body with all three phases in order,
which is what the rule in `.claude/rules/typescript-unit-testing.md` actually requires
("Data rows still use separate phases"). The plan's own `verify` command is satisfied —
it only runs `rg -c '^\s+// arrange$'`, which needs a non-zero count. Read the criterion
as **markers equal case bodies**; a verifier comparing markers to runtime cases will
report a false gap on every pair that uses a row table.

**No other part of the recipe misfired.** All 16 hand-authored status literals matched
production on the first run, the direct-coverage gate held at 100 percent without a
single behavioral case being added for coverage's sake, and `fallow dupes` reported no
clone group containing this file — the single shared fixture helper (rather than the two
near-identical layout helpers the old file carried) is what keeps it clear.

**Git hooks are not installed in this checkout.** `core.hooksPath` points at
`/home/acolomba/pi-claude-marketplace/.git/hooks`, which has no `pre-commit` file, so
`git commit` runs no hooks here. The manual `pre-commit run` is therefore the only gate,
not a preview of one — worth knowing for the remaining seven commits, since a hook
failure will not stop a commit on its own.

## User Setup Required

None.

## Next Phase Readiness

The recipe is proven and the seven remaining plans can adopt it as written. Three points
to carry forward:

1. **Marker counting.** Expect markers to equal case bodies, not runtime cases, wherever
   a row table is used.
2. **`format:check` is red locally** until `.mcp.json` and `.planning/research/.cache/`
   are either removed, gitignored, or added to `.prettierignore`. Every plan in this
   phase will see it; none of them caused it. It does not reach CI, which checks out a
   clean tree.
3. **`pre-commit run --all-files` writes.** Prefer the scoped `--files` form for
   TypeScript-only changes; the gating hooks run at repository scope either way.

---
*Phase: 115-composition-orchestrators*
*Completed: 2026-09-01*

## Self-Check: PASSED

- `tests/orchestrators/edge-deps.test.ts` — present, committed in `76a37a66`.
- `76a37a66` — present in `git log`.
- `extensions/` — no change (`git diff --quiet` clean, working tree and committed).

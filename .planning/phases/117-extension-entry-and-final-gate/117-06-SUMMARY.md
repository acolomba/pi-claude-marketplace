---
phase: 117-extension-entry-and-final-gate
plan: "06"
subsystem: testing
tags: [node-test, unit-tests, coverage, marketplace, cascade, hooks]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "D-117-01's fold branch and the correspondence gate baseline that names the cascade supplement"
provides:
  - "The cross-bridge cascade footprint evidence living in tests/orchestrators/marketplace/shared.test.ts, the mirrored owner of the module it measures"
  - "One fewer corresponding-test violation: 4 to 3"
  - "A measured reading that the cascade's on-disk hooks removal is caught by exactly one assertion in the owner suite"
affects: [117-08, 117-12]

actuals:
  tokens: 11500
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A destructive verb is owned through its footprint: the surviving case reads the scope root back rather than trusting the returned outcome"

key-files:
  created: []
  modified:
    - tests/orchestrators/marketplace/shared.test.ts
  deleted:
    - tests/orchestrators/marketplace/cascade.test.ts

key-decisions:
  - "Dropped the supplement's idempotence case: the owner's existing malformed-MCP case already carries the whole claim, because it seeds no hooks subtree and still reads dropped.hooks as the plugin name"
  - "Carried only the footprint case, and strengthened its disk read from a single-file existence probe to a whole-value readdir of the hooks directory"
  - "Reused the owner's pluginRecord and createProjectScope; deleted the supplement's makePluginRecord and withTmpScope rather than carrying near-duplicates past fallow dupes"
  - "Ran the plan's literal plant AND a sharper one, because the literal plant failed the case on the returned outcome rather than on the disk read"

patterns-established:
  - "Plant at the granularity the case claims: to prove an on-disk read is load-bearing, delete the filesystem call, not the whole production step whose return value the case also asserts"

requirements-completed: [OWN-06, CASE-02, CASE-03, DEL-01]

coverage:
  - id: D1
    description: "The cross-bridge cascade evidence lives in the mirrored owner of orchestrators/marketplace/shared.ts, and the supplement is deleted"
    requirement: "OWN-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin deletes the staged hooks subtree from the scope root"
        status: pass
      - kind: other
        ref: "test ! -e tests/orchestrators/marketplace/cascade.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pair reports complete direct function, line and branch coverage with the owner run alone"
    requirement: "CASE-02"
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The correspondence gate names the cascade supplement in no verdict; the phase total falls from 4 to 3"
    requirement: "DEL-01"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The surviving case's on-disk read is load-bearing, proven by deleting the rm inside removeHookConfig"
    requirement: "CASE-03"
    verification: []
    human_judgment: true
    rationale: "The plant is a one-time destructive measurement against production sources that are reverted before the commit. No standing gate reproduces it; the verbatim readings below are the record."

duration: 13 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 06: Cross-bridge cascade fold Summary

**The cascade supplement's footprint evidence now lives in `tests/orchestrators/marketplace/shared.test.ts` as one case that reads the hooks directory back after the cascade, and a sharpened plant proves that read is the only assertion in the owner suite that catches a missing `rm`.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-03T18:36:06Z (bounded by the previous plan's close-out commit; dispatch time was not separately instrumented)
- **Completed:** 2026-09-03T18:49:00Z
- **Tasks:** 1
- **Files modified:** 1 modified, 1 deleted

## Accomplishments

- Folded the cross-bridge cascade supplement into the mirrored owner of the single module it measures, `orchestrators/marketplace/shared.ts`, and deleted it in the same commit.
- Kept the on-disk half of the cascade proven, and strengthened it: the supplement probed one file for existence, the merged case compares the whole `readdir` of the hooks directory against `[]`.
- Dropped one of the two folded cases as already owned, and named the owner case that carries its claim.
- Ran both the plan's literal plant and a sharper one, and reported that the literal plant does not discriminate what the plan wanted it to.
- Correspondence violations: 4 to 3.

## The three pre-fold questions

**1. Which of the owner's five existing cascade cases already proves what a folded case proves?**

`cascadeUnstagePlugin reports hook partial when malformed MCP JSON fails last` already carries the
whole claim of the supplement's second case, `cross-bridge lifecycle keeps hook removal idempotent
when the subtree is absent`. That owner case seeds no hooks subtree, passes a record whose
`resources.hooks` is empty, and still asserts `dropped.hooks` is `["sample"]` — so the hooks phase
completed against an absent subtree and the cascade continued past it to mcp. Reading production
confirms why the two cases cannot differ: `cascadeUnstagePlugin` sets
`dropped.hooks = [hooksResult.removed]` and `removeHookConfig` returns `{ removed: pluginName }`
unconditionally after `rm(dir, { recursive: true, force: true })` — it never consults
`installedPlugin.resources.hooks`. The folded case was dropped.

The supplement's first case, `cross-bridge lifecycle removes the hooks subtree and records the hook
drop`, is NOT owned. The owner's `returns every removed resource in five-kind order` seeds a hooks
subtree and asserts the returned outcome, but never reads the tree back; the only other owner case to
touch the hooks directory on disk,
`returns typed foreign-agent failure and stops before hooks`, asserts the subtree SURVIVES when the
cascade stops early. Nothing in the owner asserted that the subtree actually leaves the disk. That
case was carried.

**2. What does each folded case observe that an outcome-shape assertion cannot?**

Only the carried case observes anything an outcome-shape assertion cannot: the hooks subtree really
leaving a real temporary scope root. That is the footprint half — the returned `UnstageOutcome` can be
correct while nothing left the disk, which is exactly what the sharpened plant below demonstrates. The
carried case keeps its on-disk read, upgraded from the supplement's `readFile`-in-a-`try` existence
probe to `assert.deepStrictEqual(await readdir(locations.hooksDir), [])`, a whole-value comparison.

**3. Does the owner's existing plugin-record factory produce a record the folded case can use?**

Yes, unchanged. The owner's `pluginRecord(resources)` takes a `Partial<PluginRecord["resources"]>`, so
`pluginRecord({ hooks: ["sample"] })` is all the carried case needs; the supplement's `makePluginRecord`
differed only in its literal filler values (`0.0.1`/`/tmp` versus `1.2.3`/`/plugins/sample`), which no
assertion reads. It was deleted rather than carried. The supplement's `withTmpScope` was likewise
dropped in favour of the owner's `createProjectScope(t, label)`, which creates one `mkdtemp` per case
and removes it through the test context. Exactly one plugin-record factory survives in the merged file
and `fallow dupes` is silent about it.

## The plants (verbatim)

**Plant 1 — the plan's literal wording: delete the hooks-subtree removal from the production cascade.**
Removed both lines of the hooks slot in
`extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`:

```
    const hooksResult = await removeHookConfig({ locations, pluginName: plugin });
    dropped.hooks = [hooksResult.removed];
```

`node --test tests/orchestrators/marketplace/shared.test.ts` reported `pass 41`, `fail 4`. The merged
case failed, but on the wrong assertion:

```
✖ cascadeUnstagePlugin deletes the staged hooks subtree from the scope root (7.177863ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + []
  - [
  -   'sample'
  - ]

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/tests/orchestrators/marketplace/shared.test.ts:634:10)
```

Line 634 is `assert.deepStrictEqual(outcome.dropped.hooks, ["sample"])` — the returned-outcome
assertion, not the disk read. Three other cases failed alongside it. **This plant does not separate a
footprint read from an outcome-shape assertion**: it removes the production step whose return value
the case also asserts, so an outcome-only case would have gone red identically. Reported rather than
papered over.

**Plant 2 — sharpened to the granularity the case actually claims: delete only the filesystem call.**
Removed one line from `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`:

```
  await rm(dir, { recursive: true, force: true });
```

`removeHookConfig` still returns `{ removed: pluginName }`, so every outcome-shape assertion in the
repository stays satisfied. `node --test tests/orchestrators/marketplace/shared.test.ts` reported
`pass 44`, `fail 1` — the merged case alone:

```
✖ cascadeUnstagePlugin deletes the staged hooks subtree from the scope root (7.784534ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + [
  +   'sample'
  + ]
  - []

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/tests/orchestrators/marketplace/shared.test.ts:635:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ 'sample' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

Line 635 is the `readdir` — the disk read, and nothing else in the owner suite noticed. The on-disk
half is load-bearing, and it is the sole assertion in this suite that carries it.

Both production files were reverted before the commit. `git diff --quiet -- extensions/ package.json`
exits 0, and the commit's `--name-status` lists only the two test paths.

## Task Commits

1. **Task 1: Fold the cross-bridge cascade evidence into the marketplace shared owner** — `7414ab8d` (test)

The merge and the deletion are one commit, as the plan requires: there is no coherent intermediate
state in which the cases live in two places.

**git records no rename.** A merge into an existing file cannot show one — git detects renames by
similarity, and 19 changed lines added to a 1220-line owner share nothing structural with the 127-line
file they replace. `git log -1 --name-status --find-renames=50%` prints `D` and `M`, never `R`.

## Files Created/Modified

- `tests/orchestrators/marketplace/shared.test.ts` — gained the folded footprint case and the `readdir` import; now 45 cases.
- `tests/orchestrators/marketplace/cascade.test.ts` — deleted (127 lines).

## Gate readings

Every gate was run separately and its own exit code read, never a pipeline's (`npm run check` was not
used: its `format:check` link fails on the operator's pre-existing untracked files).

| Gate | Reading |
| --- | --- |
| `node --test tests/orchestrators/marketplace/shared.test.ts` | exit 0 — `tests 45`, `pass 45`, `fail 0` |
| `npm run test:coverage:direct -- .../orchestrators/marketplace/shared.ts` | exit 0 — `Direct coverage passed: ... (branches 81/81, functions 11/11, lines 650/650)` |
| `npm run typecheck` | exit 0 |
| `eslint tests/orchestrators/marketplace/shared.test.ts` | exit 0 |
| `prettier --check tests/orchestrators/marketplace/shared.test.ts` | exit 0 |
| `npm run fallow` | exit 0 — dead-code `✓ No issues found`, health `0 above threshold`, dupes names no marketplace test |
| `npm test` | exit 0 — `tests 5141`, `suites 295`, `pass 5141`, `fail 0` |
| anti-pattern scan (`only`/`skip`/`todo`, ignore pragmas, `anyTimes`, `mock.module`, plan/phase/wave refs, relocation prose) | no match |
| `rg -c '^\s*// arrange$'` | 32 |
| `node scripts/check-corresponding-tests.mjs` | 3 violations, none naming `marketplace/cascade` |
| `test ! -e tests/orchestrators/marketplace/cascade.test.ts` | exit 0 |
| `git diff --quiet -- extensions/ package.json` | exit 0 |
| trufflehog `filesystem` on the changed path | exit 0 — `chunks: 5, bytes: 50464, verified_secrets: 0, unverified_secrets: 0` |
| `SKIP=trufflehog,npm-format-check pre-commit run --files ...` | exit 0 — every applicable hook Passed, including `npm lint`, `npm typecheck`, `npm fallow` |

Direct coverage was also measured BEFORE the fold and read the same `branches 81/81, functions 11/11,
lines 650/650`, so the fold neither gained nor lost coverage — it added an assertion, not a path.

Remaining correspondence violations, all owned by 117-08 and untouched here:

```
missing-test: tests/index.test.ts
unexpected-test: tests/edge/index-handler.test.ts
unexpected-test: tests/shared/index-smoke.test.ts
```

## Decisions Made

- **The dropped case is named, not silently removed.** T-117-06-B asked that idempotence evidence not vanish quietly; the malformed-MCP owner case carries it, and production was read to confirm the two cases cannot diverge.
- **The disk read was strengthened while being relocated.** The rule against changing assertions during a relocation protects a case's claim; replacing an existence probe with a whole-value `readdir` comparison keeps the same claim and makes it a complete-value assertion, which the repository's own rules prefer.
- **The plant was run twice.** The plan named a plant that turned out not to discriminate; running only that plant would have produced a green-looking RED that proved the wrong thing.

## Deviations from Plan

**1. [Rule 2 - Missing critical] The plan's literal plant did not isolate the on-disk read; a second, sharper plant was run**

- **Found during:** Task 1
- **Issue:** The plan directed "delete the hooks-subtree removal from the production cascade" to prove the footprint read is load-bearing. Deleting the cascade's hooks slot also removes the source of `dropped.hooks`, so the merged case failed on its returned-outcome assertion (line 634) and the disk read was never reached. The plant would have gone RED against a case with no disk read at all, so it could not support the claim the plan wanted from it.
- **Fix:** Ran a second plant at the granularity of the claim — deleted only `await rm(dir, { recursive: true, force: true })` inside `removeHookConfig`, leaving the returned outcome correct. That plant failed exactly one case in the suite, on the `readdir` (line 635).
- **Files modified:** none in the commit — both plants were reverted; `git diff --quiet -- extensions/ package.json` exits 0.
- **Verification:** Both readings are recorded verbatim above.
- **Committed in:** n/a (measurement only)

---

**Total deviations:** 1 auto-fixed (1 missing-critical evidence step).
**Impact on plan:** The plan's evidence goal is met more strongly than its literal instruction would have achieved. No scope change; no production file is altered.

## Issues Encountered

The shell in this checkout is **zsh**, not fish as the phase field notes state. It shares the property
the notes care about (no word-splitting of unquoted parameters) but it also aliases `$status` to `$?`,
so `cmd | tail; echo $status` silently reports the exit code of `tail`. An early `npm run fallow`
reading of `exit=0` was taken that way and was therefore meaningless. Every gate above was re-run
without a pipe before its exit code was read. This is the "green run that checked nothing" class, and
it is why the readings are tabulated from unpiped runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/orchestrators/marketplace/` now contains only mirrored owners; the cascade supplement is gone.
- Correspondence violations stand at 3, all of them `tests/index.test.ts`-shaped and owned by 117-08.
- Requirement IDs `OWN-06`, `CASE-02`, `CASE-03` and `DEL-01` are recorded here but deliberately NOT marked complete: each is declared by more than one plan in this phase, and D-117-12 owns the closing sweep.
- Nothing was appended to `deferred-items.md` or `WINDOWS.md`; this plan found no out-of-scope defect.

## Self-Check: PASSED

- `tests/orchestrators/marketplace/shared.test.ts` exists on disk.
- `tests/orchestrators/marketplace/cascade.test.ts` is absent from disk.
- Commit `7414ab8d` is present in `git log --oneline --all`.
- `git diff --quiet -- extensions/ package.json` exits 0.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*

---
phase: 114-degradation-and-documentation
plan: 02
subsystem: notify
tags: [soft-dep, workflows, coverage-gate, negative-control, closed-set]
status: complete

requires:
  - "shared/concerns/soft-dep.ts::Dependency member \"workflows\""
  - "orchestrators/types.ts::declaresWorkflows (3 outcome shapes)"
  - "orchestrators/plugin/shared.ts::LedgerDegradationSignals.stagedWorkflows"
provides:
  - "orchestrators/plugin/list.ts::dependenciesFromDeclares 3rd declares-flag"
  - "orchestrators/plugin/shared.ts::enableRowDependencies widened Pick + third arm"
  - "orchestrators/plugin/reinstall.messaging.ts::dependenciesFromOutcome third arm"
  - "orchestrators/plugin/update-row.ts::outcomeDependencies 3rd declares-flag"
  - "orchestrators/import/execute.ts::PluginInstalledOutcome.declaresWorkflows"
  - "orchestrators/reconcile/apply-outcomes.ts::dependenciesFromInstall third arm"
  - "tests/architecture/workflows-marker-coverage.test.ts (the criterion-3 gate)"
affects:
  - "docs/output-catalog.md (plan 04 owns the two rendered states)"
  - "docs/workflows-compatibility.md (plan 04)"

tech-stack:
  added: []
  patterns:
    - "one-assertion projection over a closed site list, so one reverted arm reddens exactly one row"
    - "compile-time refusal pin via a module-level @ts-expect-error"

key-files:
  created:
    - tests/architecture/workflows-marker-coverage.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/update-row.test.ts
    - tests/orchestrators/plugin/reinstall.messaging.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/reconcile/apply-outcomes.test.ts
    - tests/orchestrators/reconcile/notify.test.ts

decisions:
  - "All SEVEN sites were individually negative-controlled, not the one the plan required. Each deletion reddened exactly one row and that row named its own file."
  - "`reconcile/notify.ts` needed NO threading change: `PluginEnabledOutcome` extends `EnableDegradationSignals`, which is `LedgerDegradationSignals`, so plan 01's `stagedWorkflows` member already reaches `enableRowDependencies` through the projection. Only its doc comment moved."
  - "`update-row.ts::outcomeDependencies` keeps its ternary-spread body rather than gaining a third `if` block. The plan's action step says to match the local idiom per site; its acceptance criterion's `exactly three if blocks` reads onto the five sites that use the push form."
  - "The gate drives its cases SEQUENTIALLY rather than through `Promise.all`. Three cases swap `process.env.HOME`, and a concurrent drive would race that global."
  - "`enableRowDependencies`'s `partition?: never` refusal gained a compile-time pin (a module-level `@ts-expect-error` in `shared.test.ts`). It had none, so the widening could have silently dropped it."

metrics:
  duration: "~2h20m"
  completed: 2026-09-08

actuals:
  tokens: 10200
  tasks: 3
  commits: 2

plan_head_before: b7732300a54fd9cd985f907c756f6dedc3d4d835
---

# Phase 114 Plan 02: Marker coverage at every derivation site — Summary

Every `Dependency[]` derivation under `orchestrators/` now stamps `workflows`,
and a gate rather than a grep proves it: seven cases, one assertion, and a
negative control run at all seven sites.

## What was built

**The six remaining derivations (WDEP-02 / WDEP-04).** `list.ts` derives its
flag from the persisted `record.resources.workflows` array length, beside the
two `record.resources` reads its siblings take. `shared.ts` widens
`enableRowDependencies`'s `Pick` to `stagedWorkflows`. `reinstall.messaging.ts`,
`update-row.ts`, `import/execute.ts` and `reconcile/apply-outcomes.ts` each gain
a third arm off their outcome's `declaresWorkflows`. Every site appends
`workflows` LAST, so every existing two-marker brace is byte-unchanged.

**The gap plan 01 left open is closed.** An enable or update that stages a
workflow into a session with no host engine now renders
`{requires pi-dynamic-workflows}` beside the `needs attention` summary line it
was already stamping. The Broken Windows entry recording that gap (id 32,
`[workflows-replay]`) is marked `fixed`.

**The coverage gate.** `tests/architecture/workflows-marker-coverage.test.ts`
holds seven `{ site, drive }` records and one `assert.deepEqual` over a
projection of `{ site, marked, clean }`. Two cases call an already-exported
derivation, two go through an exported outcome-to-row composer, and three drive
a full `installPlugin` / `listPlugins` / `importClaudeSettings` run under a
hermetic `HOME`. Every case asserts on the RENDERED row, so all seven prove the
same end-to-end claim (D-114-05).

**No production export was added to serve a test.** RESEARCH assumption A6 held
at all seven sites. The diff for the gate's commit touches only the new suite.

**The engine-absent runs use the decoy tool name `workflow`,** not an empty tool
list, so the gate re-proves the WDEP-01 discriminator through all seven
surfaces for free.

## The negative control (mandatory, criterion 3)

Run first at `orchestrators/import/execute.ts` — one of the three sites
reachable only by driving a full orchestrator, and therefore one of the three a
coverage gate can most easily satisfy vacuously. The gate was green on an
unmodified tree immediately before.

`dependenciesFromInstalled`'s `workflows` arm was deleted and nothing else
touched. Verbatim output:

```
✖ WDEP-04 / SNM-06: every Dependency[] derivation site renders the host-engine marker (240.811396ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2984.443614

✖ failing tests:

test at tests/architecture/workflows-marker-coverage.test.ts:437:1
✖ WDEP-04 / SNM-06: every Dependency[] derivation site renders the host-engine marker (240.811396ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  ... Skipped lines

    [
      {
        clean: true,
        marked: true,
        site: 'extensions/pi-claude-marketplace/orchestrators/plugin/install.ts'
  ...
        clean: true,
  +     marked: false,
  -     marked: true,
        site: 'extensions/pi-claude-marketplace/orchestrators/import/execute.ts'
      },
      {
        clean: true,
        marked: true,

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/workflows-marker-coverage.test.ts:455:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/install.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/list.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/import/execute.ts', marked: false, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts', marked: true, clean: true } ],
    expected: [ { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/install.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/list.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/import/execute.ts', marked: true, clean: true }, { site: 'extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts', marked: true, clean: true } ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

**Exactly one row differs, and its `site` value is
`extensions/pi-claude-marketplace/orchestrators/import/execute.ts`.** The arm
was restored, `git diff HEAD --stat` for that file is empty, and the gate is
green again.

### Which sites were individually controlled

**All seven.** The plan required one; the other six were cheap once the first
was set up, and a partial control that goes unstated is the failure mode this
control exists to remove. Each deletion produced exactly one `marked: false`
row, and that row named its own file:

| # | Site whose arm was deleted | Row that reddened |
|---|---|---|
| 1 | `orchestrators/import/execute.ts` | `orchestrators/import/execute.ts` |
| 2 | `orchestrators/plugin/install.ts` | `orchestrators/plugin/install.ts` |
| 3 | `orchestrators/plugin/list.ts` | `orchestrators/plugin/list.ts` |
| 4 | `orchestrators/plugin/shared.ts` | `orchestrators/plugin/shared.ts` |
| 5 | `orchestrators/plugin/reinstall.messaging.ts` | `orchestrators/plugin/reinstall.messaging.ts` |
| 6 | `orchestrators/reconcile/apply-outcomes.ts` | `orchestrators/reconcile/apply-outcomes.ts` |
| 7 | `orchestrators/plugin/update-row.ts` | `orchestrators/plugin/update-row.ts` |

No deletion ever reddened more than one row, so no case is asserting on a
shared composer instead of its own site's derivation. No deletion left the gate
green, so no case's drive is vacuous. `git status` reports no modification to
any of the seven after the run.

Runs 2 and 3 are the other two full-orchestrator sites, which is where the
"drive never staged a workflow" failure mode lives. Runs 4-7 cover the Tier A
and Tier B sites.

## The five pinned expectations that had to change

Widening the enable and update derivations moved bytes that five existing cases
pinned. **These changes are the gap closing, not a regression**, and each one is
recorded here so a reviewer does not have to reconstruct why:

| Suite | Case | What moved |
|---|---|---|
| `enable-disable.test.ts` | `WLIF-06: a name in both the recorded and the staged set retires nothing` | `(installed)` → `(installed) {requires pi-dynamic-workflows}`. **This is the exact case plan 01 named.** Its row previously carried `A plugin operation needs attention.` with an empty brace — the row said it needed attention and named nothing. |
| `enable-disable.test.ts` | `WLIF-06: an enable whose source dropped a workflow names the retired command` | `{stale workflow command}` → `{stale workflow command, requires pi-dynamic-workflows}` |
| `enable-disable.test.ts` | `WLIF-06: a renamed workflow retires a command exactly as a deletion does` | same, via its `assert.match` regex |
| `enable-disable.test.ts` | `WLIF-06: three retired names stamp exactly one token` | same, via its `assert.match` regex |
| `update.test.ts` | `WLIF-06: an update that withdrew a workflow names the reload remedy` | `(updated) {stale workflow command}` → `(updated) {stale workflow command, requires pi-dynamic-workflows}` |

The two regex cases were tightened rather than loosened: each now pins the full
brace including the composition order, so they also assert the WDEP-02
"workflows composes LAST" rule at their own surface.

Every one of the five stages a workflow into a session whose fake `getAllTools`
returns nothing, so every one of them genuinely reaches the engine-absent arm.
None was "refitted until green" — the marker is the fact the row was missing.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 - Missing critical] `enableRowDependencies`'s `partition?: never`
refusal had no compile-time pin**

- **Found during:** Task 1
- **Issue:** The plan's own must-have requires that the refusal "survives the
  `Pick` widening" — it is what excludes the update and reinstall outcome
  shapes that would otherwise match structurally and silently return an empty
  array (WR-01). Nothing in the tree failed if it were deleted:
  `grep -n 'ts-expect-error' tests/orchestrators/plugin/shared.test.ts` printed
  nothing.
- **Fix:** Added a module-level `@ts-expect-error` pin in `shared.test.ts`,
  copying the idiom `tests/shared/concerns/soft-dep.test.ts` uses for the
  `Dependency` union. Dropping the refusal now fails `npm run typecheck` with an
  unused-`@ts-expect-error` error.
- **Files modified:** `tests/orchestrators/plugin/shared.test.ts`
- **Commit:** 0877b6a3

**2. [Rule 3 - Blocking] `list.test.ts`'s `makeCtx` had no tool-list seam**

- **Found during:** Task 1
- **Issue:** `WFLW-04: a non-empty persisted workflow inventory leaves the
  installed row unchanged` seeds `resources.workflows` and drives a `makeCtx()`
  whose `getAllTools()` returns `[]`, so it now sees the engine-absent marker and
  its claim ("unchanged") is false. The suite's `makeCtx` took no parameters.
- **Fix:** Parameterized it as `makeCtx({ toolNames })`, mirroring
  `install.test.ts`'s existing seam, and gave the WFLW-04 case
  `["workflow_control"]`. That restores the case's ORIGINAL claim exactly — the
  row IS unchanged when the engine is loaded — rather than refitting its
  expected bytes. Two new cases carry the new claims.
- **Files modified:** `tests/orchestrators/plugin/list.test.ts`
- **Commit:** 0877b6a3

### Notes on what the plan expected and what the tree held

- **`reconcile/notify.ts` needed no threading.** The plan's action step says to
  check whether the enable projection needs `stagedWorkflows` threaded to reach
  `enableRowDependencies`. It does not: `PluginEnabledOutcome extends
  PluginOutcomeBase, EnableDegradationSignals`, and `EnableDegradationSignals` is
  a direct alias of `LedgerDegradationSignals`, so plan 01's optional member is
  already on the projection's outcome and `reconcile/apply.ts:539` already
  populates it. Only the function's doc comment moved.

- **`update-row.ts` keeps its ternary-spread body.** Its `outcomeDependencies`
  is a `return [...(a ? [...] : []), ...]` expression, not the `if`-push form the
  other five use. The plan's action step says "Match the LOCAL idiom at each
  site — do not normalize one into another", so the third arm is a third spread.
  Its acceptance criterion's "exactly three `if` blocks" therefore reads onto the
  five push-form sites; the ordering claim it is really about (workflows LAST) is
  satisfied and gate-proven at all six.

- **`reinstall.messaging.ts`'s diff contains the WORD `companionSeverity`, in a
  comment, not a call.** The plan's action step directs recording the no-raise
  asymmetry as deliberate so a later reader does not repair it as an oversight;
  the comment is that record. `grep` for a call finds none.

- **The forced sweep was small this time.** `npm run typecheck` reported 4
  errors across 2 test files, not the 89 plan 01 saw — because plan 01 had
  already made `declaresWorkflows` REQUIRED on the three outcome shapes, so most
  call sites were already carrying it. `npm test` surfaced 5 further runtime-only
  failures (the pinned-byte cases above), which typecheck could not have caught.

- **`sonarjs/no-identical-functions` did NOT fire** on the now-three-arm copies
  (RESEARCH assumption A2, previously unmeasured). `npm run lint` is clean and
  `npm run fallow` exits 0 with no new dupes clone and no health breach. No
  shared helper was extracted and no disable directive was added.

## Known Stubs

None. The two entries plan 01 recorded under this heading —
`enableRowDependencies` and `update-row.ts::outcomeDependencies` — are the two
derivations this plan closed.

## Threat Flags

None. No file changed here introduces a network endpoint, an auth path, a file
access pattern or a schema change. `git diff --name-only` for `package.json`,
`package-lock.json`, `sonar-project.properties` and `CHANGELOG.md` is empty
across both commits (D-114-07, T-114-SC).

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm test` | `# fail 0`, 5560 tests |
| `node --test tests/architecture/workflows-marker-coverage.test.ts` | `# fail 0`, 7 cases in 1 assertion |
| Negative control, all 7 sites | each deletion reddens exactly 1 row naming its own file; all restored, no residue |
| `node --test tests/architecture/unit-suite-glob-completeness.test.ts tests/architecture/no-stale-test-citations.test.ts` | `# fail 0` |
| `npm run lint` | clean; no `no-identical-functions` |
| `npm run fallow` | exit 0 |
| `npm run format:check` | clean |
| `npm run test:corresponding` / `:negative` | both passed |
| `npm run check` | exit 0 |
| `grep -c 'workflows'` on the six edited orchestrators | 6 / 9 / 4 / 4 / 3 / 3 — none zero |
| `grep -c 'partition?: never' .../plugin/shared.ts` | 2 (the signature plus its `WR-01` doc-comment mention) |
| `grep -c 'orchestrators/' .../workflows-marker-coverage.test.ts` | 22 (>= 7) |
| `grep -c 'assert.deepEqual' .../workflows-marker-coverage.test.ts` | 1 |
| `grep -cE '^\s*(import\|} from) .*\.test\.ts' .../workflows-marker-coverage.test.ts` | 0 |
| `git diff HEAD --name-only -- .../plugin/info.ts` | empty across both commits |
| `git diff --name-only -- package.json package-lock.json` | empty |

One acceptance criterion reads differently than written, benignly:
`grep -c 'partition?: never'` prints **2**, not the "at least 1" the criterion
asks for. The second match is the doc comment naming the refusal, which the plan
directs to extend rather than rewrite.

**Commit-count basis.** `actuals.commits: 2` counts the two TASK commits
(`0877b6a3`, `3464f1b4`), matching the basis `114-01-SUMMARY.md` used. A
`git rev-list --count b7732300..HEAD` run after this file lands reads higher,
because it also counts this SUMMARY's own docs commit and this note's. The
`plan_head_before` field is recorded so either basis can be re-derived.

**Estimate calibration note.** `actuals.tokens` above is measured as
`chars / 4` over the realized diff (`git diff <base>..HEAD` restricted to added
and removed content lines): 40,872 chars → ~10,200. That instrument is NOT the
one plan 01's `tokens: 60000` used — plan 01's own diff measures 77,129 chars
(~19,300) on this instrument. Both numbers are recorded so a later calibrator
can pick one scale rather than averaging two.

## Self-Check: PASSED

- `tests/architecture/workflows-marker-coverage.test.ts` — FOUND, 7 site paths,
  1 assertion, 0 imports from any `*.test.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — FOUND,
  derives from `record.resources.workflows.length > 0`
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — FOUND,
  `Pick` includes `"stagedWorkflows"`, `partition?: never` intact
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` — FOUND, no `companionSeverity` call
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` — FOUND
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` — FOUND,
  `declaresWorkflows` on the row interface and at the producer
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` — FOUND
- Commit `0877b6a3` — FOUND
- Commit `3464f1b4` — FOUND
- `orchestrators/plugin/info.ts` — NOT in either commit's diff, as required
- `.claude/settings.json` / `.codex/config.toml` — NOT staged, NOT modified by
  this plan
- `.planning/workstreams/workflows/STATE.md` / `ROADMAP.md` — NOT modified

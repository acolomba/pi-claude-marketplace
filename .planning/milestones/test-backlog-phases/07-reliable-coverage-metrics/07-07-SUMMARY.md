---
phase: 07-reliable-coverage-metrics
plan: "07"
subsystem: testing
tags: [coverage, istanbul, lcov, v8, crap, fallow, certification, node-test]

# Dependency graph
requires:
  - phase: 07-05
    provides: "coverage:unit:verified and the accepted bundle (coverage/unit.manifest.json, unit.istanbul.json, unit.validation.json, unit.lcov) with the population and denominators recorded apart"
  - phase: 07-06
    provides: "coverage:risk, the shipped policy (30, Fallow 3.23.0) and the exact anchor join; the 07-06 run 96fa8e3e as the reproducibility reference"
  - phase: 07-04
    provides: "coverage:validate consumer mode and the correspondence pass the readback repeats"
provides:
  - ".planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md: the certified measurement of the stable production tree on two full runs (published bundle 20260918T175717646Z-4402189b): identities, three denominators, independent recounts, 21 syntax deficits with cause/kind/disposition, the CRAP distribution (0 of 1865 at or above 30, max 20.00) and the activation conditions, all met"
  - "scripts/coverage-acceptance.mjs and the summary-mismatch readback: an accepted manifest whose population or denominators are another run's is refused by coverage:validate (and so by coverage:risk); before, copied counts passed every consumer"
  - "docs/coverage-metrics.md: user-facing reference for the commands, artifacts, exit statuses, the two coverage models, the CRAP gate and the known limits (V8 block model, Node's cross-process merge, Fallow pin, runtime binding)"
  - "Controls: reproducibility of an unchanged tree, refusal of a historical summary, an implicit else that never runs scoring at its complexity, and a rethrow no process executed that the merged native LCOV still counts (Node's mergeCoverageRanges, identical in v24.11.0 and v26.8.2)"
affects: [07-08]

# Actuals (#2632) -- chars/4 over the realized diff (64113 chars, 9 files, +761/-109), never a harness token count.
actuals:
  tokens: 16000
  tasks: 2
  commits: 2
plan_head_before: 9e39c87be5acb5b09ee3f9ec58fa4c9de15d159e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Readback recomputes what publication summarized: the acceptance summary (population, native and syntax denominators) lives in one module bound by the acceptance tooling digests, is computed at publication and recomputed on every readback, so a count a reader takes from the manifest is the run's and never a historical record"
    - "Certification figures are recounted apart from the pipeline before they are written down: LCOV totals by line, map counters by key, population both ways against the tree and the inventory, function nodes with a plain acorn walk, then compared with the recorded summary"
    - "Two runs of the identical tree are the reproducibility evidence: every certified figure equal, 52 of 18911 counters differing in count only (timing- and poll-dependent tests), none between zero and nonzero"

key-files:
  created:
    - .planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md
    - docs/coverage-metrics.md
    - scripts/coverage-acceptance.mjs
  modified:
    - scripts/coverage-unit.mjs
    - scripts/coverage-validate.mjs
    - scripts/coverage-capture.manifest.mjs
    - tests/scripts/coverage-unit.test.ts
    - tests/scripts/check-coverage-risk.test.ts
    - tests/scripts/check-coverage-risk-fixtures.ts

key-decisions:
  - "The accepted manifest's population and denominators are verified on readback (summary-mismatch), a Rule 2 completion of T-07-07-01: a probe showed copied counts passing coverage:validate, coverage:capture --verify and coverage:risk with every digest agreeing"
  - "The one unexecuted statement (discover.ts:289 `throw err;`) is unreachable by construction and compiler-forced (BC-019 in the direct-pair pin); no test is fabricated for it, no exclusion is added, and its 6.0073 score and the 10392/10393 statement total stand"
  - "The native LCOV's 100 percent over-reports that line: Node's cross-process mergeCoverageRanges drops the nested zero-count block when the enclosing catch span matches exactly with a nonzero count in either merge order; the raw records, the direct single-process pair and the map keep it at zero. D-01 keeps the native gate as Node reports it; the limit is pinned by a control and documented"
  - "Nine implicit-else arms are defensive narrowing no production input falsifies; ten are designed paths untested at the arm level with every statement executed. They are reported with dispositions and left for a bounded follow-up plan; none blocks activation because none changes a statement count, a CRAP score or a native total"
  - "The tracer feedback gate re-ran the full capture instead of reusing run 1, and the second run is the published bundle: the two runs agree on every certified figure, which is the reproducibility evidence the certification rests on"
  - "The three superseded run directories (07-01, 07-05, 07-06 and this plan's run 1) were pruned after their identities were recorded; only the published run's directory remains"
  - "Commit scopes follow the repository's Conventional Commits rule (`feat(coverage)`, `docs(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "Validator refusal row for a manifest summary that is not the bundle's: `{ kind: \"summary-mismatch\", field: \"population\" | \"denominators\" }`, after the receipt comparison"
  - "Risk fixtures may carry several test files to place a module in several processes; anchors of async declarations name the `async` keyword"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A fresh full unit capture of the stable tree accounts for every production module, function and statement, with exact Fallow correspondence, and its recorded summary cannot be a historical count: 239 = 239 = 239 files, 1865 functions both ways, every statement span accepted, zero join failures, native 100 percent, and a manifest whose population or denominators are another run's is refused on readback"
    requirement: METRIC-01
    verification:
      - kind: integration
        ref: "npm run coverage:unit:verified && npm run coverage:validate (run 20260918T174436245Z-3a4ec95a, exit 0 / 0; re-run 20260918T175717646Z-4402189b, exit 0 / 0)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#refuses the consumer readback once the recorded summary is another run's"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#publishes the same map and summary for a second run of an unchanged tree"
        status: pass
      - kind: other
        ref: "scratch certification audit (LCOV recount, map recount, population both ways, acorn function count) equal to the recorded summary on both runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every native/syntax denominator difference and every syntax deficit has an evidence-backed cause, kind and disposition; the native 100 percent and the policy of 30 are unchanged; the risk gate passes with 0 of 1865 at or above 30 and the direct-pair floors are unchanged"
    requirement: METRIC-02
    verification:
      - kind: integration
        ref: "npm run coverage:validate && npm run coverage:risk && npm run test:coverage:direct:all (exit 0 / 0 / 0 on the published bundle; 239 pairs, 2 pinned shortfalls matched exactly)"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#scores a function whose implicit else is never taken at its full statement coverage"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#scores a rethrow no process executed although the merged native lines count it"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/coverage-metrics.md describes the tooling, its contract and its limits for a reader outside the phase"
    verification: []
    human_judgment: true
    rationale: "Prose adequacy for its readers is a judgment; the facts in it are the ones the measurement record certifies"

# Metrics
duration: 1h 12m
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 07: Certified production coverage measurement Summary

**Two full runs of the stable production tree certify 239 files, 1865/1865 functions, 10392/10393 statements and 6633/6653 arms at native 100 percent, with every one of the 21 syntax deficits explained (one compiler-forced unreachable `throw`, nineteen implicit-else arms), 0 of 1865 functions at or above CRAP 30 (max 20.00), the direct floors unchanged, and the accepted manifest's counts now verified on readback.**

## Performance

- **Duration:** 1h 12m (two full-population runs of 7.5 and 8 minutes, one direct-pair run of 8.3 minutes, one pre-commit pipeline run of about 10 minutes)
- **Started:** 2026-09-18T17:12:00Z
- **Completed:** 2026-09-18T18:24:00Z
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- **The measurement is fresh, complete and reproducible.** Run 1 (`20260918T174436245Z-3a4ec95a`) and run 2 (`20260918T175717646Z-4402189b`, the published bundle) inventoried the same 703 files (digest `3623260465ffae2b`) and recorded the same denominators: native 230 records, 63825/63825 lines, 1890/1890 functions, 9234/9234 branches; syntax 239 files, 1865/1865 functions, 10392/10393 statements, 6633/6653 arms. A scratch audit recounted the LCOV by line and the map by counter, matched the 239 `.ts` files on disk to the 239 inventoried paths and the 239 map keys both ways, and counted 1865 function nodes with a plain acorn walk, per file equal to `fnMap`. The wrapper joined all 1865 functions to Fallow's 1865 production rows in both directions with zero failures of any kind.
- **Every discrepancy has a cause, a kind and a disposition** (07-MEASUREMENT.md section 8). The 25 extra native functions are V8's `<instance_members_initializer>` entries. The one unexecuted statement, `throw err;` at `bridges/commands/discover.ts:289`, is reachable only by patching `instanceof` or making `CommandNameError`'s constructor throw, and its guard is the compiler-forced narrowing already recorded as BC-019. Native still counts that line as executed: Node's cross-process `mergeCoverageRanges` drops the nested zero-count block when the enclosing catch span matches exactly with a nonzero count, in either merge order (reproduced in a two-file experiment, identical code in v24.11.0 and v26.8.2, and pinned by a shipping control). The nineteen implicit-else arms split into nine defensive narrowings no production input falsifies and ten designed paths untested at the arm level; none touches a statement count, a CRAP score or a native total.
- **The policy outcome is evidenced, not assumed.** `coverage:risk` passed both runs: 1865 functions, 13030 non-production rows not gated, max 20.00 held by six fully covered cyclomatic-20 functions, one partial function at 6.0073, zero label drift, every row `istanbul`. The boundary is proven by the shipping controls (exactly 30 refused, 29.952 passed), not by the population.
- **A gap in the acceptance contract closed on the way.** The accepted manifest's `acceptance.population` and `acceptance.denominators` were never recomputed on readback; copied counts passed `coverage:validate`, `coverage:capture --verify` and `coverage:risk`. The summary now lives in `scripts/coverage-acceptance.mjs` (bound by the acceptance tooling digests), `coverage-unit.mjs` computes it at publication, and the accepted mode of `coverage-validate.mjs` recomputes it and refuses `summary-mismatch` rows. Both runs were made on these bytes.
- **The activation conditions are all met** (07-MEASUREMENT.md 8.6): full conformance, exact complete correspondence, fresh artifacts, native 100 percent, unchanged direct floors (`test:coverage:direct:all`: 239 pairs, 2 pinned shortfalls matched exactly), an evidenced policy-30 outcome and zero unexplained gaps. No substantive product or metric-policy conflict was established; nothing was changed to reach the verdict.

## Task Commits

1. **Task 1: Measure the stable entire production population with the accepted producer** (tracer) - `8d8a16b7` (feat: the acceptance summary readback, five new controls and the measurement record from run 1)
2. **Task 2: Resolve measurement discrepancies and certify the activation conditions** - `604ad0f9` (docs: the dispositions, the certification and `docs/coverage-metrics.md`)

**Plan metadata:** the `docs:` commit that adds this file and one WINDOWS ledger row.

Tracer feedback gate (interactive, `human_verify_mode: end-of-phase`, automated-only verify): `npm run coverage:unit:verified && npm run coverage:validate` re-run after the Task 1 commit, exit 0 / 0 in 477 s and 5.9 s, run `4402189b`; every certified figure equal to run 1; expansion continued without a checkpoint. The re-run replaced the public bundle, so the record certifies run 2 and keeps run 1's identities beside it.

## Exact commands and results

| Command | Result |
| --- | --- |
| Precondition checks | `06-VERIFICATION.md` `status: passed`; last `extensions/` commit `31ed3c72` (2026-09-17); Phase 7 touched only tooling, its tests, `vendor/coverage/` and the package manifests |
| Readback gap probe (one-function fixture root, denominators and population rewritten canonically in both manifest copies) | before the fix: `coverage:validate` exit 0, `coverage:capture --verify` exit 0, `coverage:risk` exit 0; after: `coverage:validate` exit 1 `{"kind":"summary-mismatch","field":"denominators"}`, `coverage:risk` exit 1 wrapping the same row |
| `node --test tests/scripts/check-coverage-risk.test.ts` (with the two new controls) | 19 pass, 0 fail (33 s); the first attempt failed on the anchor column of the `async` declarations (7, not 13) and the fixture now names the `async` keyword |
| `node --test tests/scripts/coverage-unit.test.ts` (with the two new controls) | 20 pass, 0 fail |
| nine coverage tooling suites (unit, validation, unit negative, risk negative, capture, producer, correspondence, schema, source-map) | 186 pass, 0 fail (82 s) |
| `npx tsc --noEmit`, `npx eslint <changed files>`, `npx prettier --check <changed files>` | clean (one TS2783 duplicate-key error in the rethrow control was fixed before the hook run) |
| `SKIP=trufflehog pre-commit run --files <7 code files>` + trufflehog filesystem scan | every hook passed (prettier, lint, format check, typecheck, fallow, direct coverage, type members); 0 verified / 0 unverified secrets |
| `sha256sum -c` over the seven code files after run 1 | all OK: the run measured the committed bytes |
| `npm run coverage:unit:verified && npm run coverage:validate` (Task 1 verify, run 1 `3a4ec95a`) | exit 0 in 446 s, exit 0 in 5.9 s; `239 production file(s), 230 loaded, 9 unloaded (8 type-only, 1 executable); native 63825/63825 line(s), 1890/1890 function(s), 9234/9234 branch(es); syntax 1865/1865 function(s), 10392/10393 statement(s), 6633/6653 branch arm(s)` |
| `npm run coverage:risk -- --report coverage/unit.risk.json` (run 1) | exit 0 in 11.4 s; `1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at .../plugin-browser.ts:108:0 (statusTag), policy < 30; 13030 other row(s) not gated` |
| scratch certification audit (run 1) | recounted native and syntax totals equal to the recorded summary; population 239/239/239 both ways, no inventory drift; 1865 acorn function nodes, zero per-file mismatches; zero native zero-count entries; 21 deficits (1 statement, 20 arms); histogram <5: 1394, 5-9.99: 377, 10-19.99: 88, 20-29.99: 6, >=30: 0; label drift 0; non-`istanbul` rows 0 |
| raw V8 ranges of `collectCommandFile` (run 1) | present in 57 of 541 snapshots: 46 whole function at 0, 10 with the catch at 0, 1 with the catch at 1 and the `if` block [288,290] at 0; LCOV `DA:288,1 DA:289,1 DA:290,1`, no `BRDA` for 288; map statement 289:6 at 0, `if` 288:4 arms `[0, 1]` |
| Node merge experiment (scratch project, `attempt`/`probe` shape, two test files) | single process: `DA:15,0` and `BRDA:14,...,0` for the `throw`; two processes in either order: `DA:15,1`, no `BRDA` for line 14; `mergeCoverageRanges` and `mapRangeToLines` byte-identical between v24.11.0 and v26.8.2 |
| `npm run coverage:unit:verified && npm run coverage:validate` (tracer gate re-run, run 2 `4402189b`) | exit 0 in 477 s, exit 0 in 5.9 s; identical summary line |
| run 1 against run 2 | 18911 counters, 52 differ in count (31 `shared/path-containment.ts`, 15 `bridges/hooks/async-rewake/pid-table.ts`, 4 `bridges/hooks/runtime.ts`, 2 `shared/path-safety.ts`), 0 zero/nonzero flips; run 2's map digest `fa867583c050e8d1` equals 07-06's run map digest |
| `npm run coverage:validate && npm run coverage:risk -- --report coverage/unit.risk.json && npm run test:coverage:direct:all` (Task 2 verify, run 2) | exit 0 (6.1 s), exit 0 (11.6 s, same line as run 1), exit 0 (`All-pair run complete: 239 pairs in 497.2s`, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly`) |
| scratch certification audit (run 2) | every field identical to run 1 (denominators, population, deficits, function counts, histogram, partial, top, label drift) |
| `npm run coverage:validate` after pruning the superseded run directories | exit 0 on `4402189b` |
| `SKIP=trufflehog pre-commit run --files docs/coverage-metrics.md 07-MEASUREMENT.md` (twice) + trufflehog | all hooks passed (mdformat padded the tables on the first pass), second pass clean; 0 / 0 secrets |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-07-T1 | Population fixture: a second `verify` of the same root yields a map byte-equal to the first run's `unit.istanbul.json` and an equal `population`/`denominators` under a second run id; tally root with the population root's summary written into both manifest copies: rows `summary-mismatch population`, `summary-mismatch denominators` in that order. Guard fixture from its text: cyclomatic 2, four statements all executed, score 2, `native { records 1, lines 7/7, functions 1/1, branches 2/2 }`, `syntax { files 1, functions 1/1, statements 4/4, branchArms 2/1 }`. Rethrow fixture from its text: `attempt` cc 2, 3/3; `probe` cc 3 (one `catch`, one `if`), 5 statements with 4 executed, `3 * 3 * (1 - 4/5) ** 3 + 3`, Fallow labels 80 and 3.1; `native.lines 17/17`, `native.functions 2/2`, `syntax.statements 8/7`, `syntax.branchArms 4/3`. Real tree: the figures in 07-MEASUREMENT.md sections 4 to 7, each recounted apart before being written. | A readback that trusts the manifest's counts; a pipeline whose output depends on run order or timing at the coverage level; a gate that scores from branch arms or from lines; a report that hides the Node merge limit or claims the throw ran; a certification that copies 07-05's or the research's numbers | New tooling behavior and controls only; no production exclusion, native threshold, direct pin, census pin, suppression or existing assertion changed; `maxCrap: 0` stays disabled; `.fallowrc.json` and the `check` chain untouched |
| 07-07-T2 | Each of the 21 deficits read against its executed source and classified with a stated mechanism (section 8.3 tables); the 25-function native excess enumerated per file; the merge limit reproduced independently of the repository and located in Node's source; `coverage:validate`, `coverage:risk` and `test:coverage:direct:all` exit 0 on the published bundle; the activation table complete | A disposition without a mechanism; an arm erased by an exclusion, an ignore hint or a fabricated input; a threshold or configuration changed to reach green; a native regression claimed where the model differs; a certification made on a stale or substituted bundle | Documentation only in this task; the verify chain confirms the native aggregate, the direct floors and the policy verdict unchanged |

Partial/zero/error paths recorded: partial coverage 16/17 on the real tree and 4/5 on the rethrow fixture; zero coverage of one statement and 20 arms on the real tree, of the implicit else on the guard fixture and of the `throw` block on the rethrow fixture; zero mismatches in every recount; `summary-mismatch` refusal rows on both fields; the pre-fix probe as the negative control of the readback gap; the TS2783 compile error and the anchor-column failure as the two development-time failures, both fixed before the hook run.

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64; npm 11.19.1; Fallow 3.23.0 (signed, lockfile resolution), health report schema 11; producer `ast-v8-to-istanbul` 1.0.6-project.1 payload `29377dc2bb113e40`, acorn 8.18.0, istanbul-lib-coverage 3.2.2, sourcemap-codec 1.6.0, adapter `28109d6802aaa61e`. CI's Node 24 has not executed the capture in this plan; its LCOV merge code is byte-identical to v26.8.2's.
- Final file digests (sha256, first 16): `scripts/coverage-acceptance.mjs` `6bb3e8b48a09ffc5`, `scripts/coverage-unit.mjs` `135ca575e2385faf`, `scripts/coverage-validate.mjs` `2846000baf145e22`, `scripts/coverage-capture.manifest.mjs` `5c02b8820d36e769`, `tests/scripts/coverage-unit.test.ts` `15dc65001090de9c`, `tests/scripts/check-coverage-risk.test.ts` `e3cb445fc2508f93`, `tests/scripts/check-coverage-risk-fixtures.ts` `a72e59cae396f90c`, `docs/coverage-metrics.md` `4e4f3f308e2c427b`, `07-MEASUREMENT.md` `84bf91d19088b8c5`.
- Published bundle `20260918T175717646Z-4402189b` (accepted 2026-09-18T18:05:10Z): manifest `99556b2f08f1f1db`, map `fa867583c050e8d1`, LCOV `4dc4b36c2675a794`, validation receipt `4087f35149a7bffa`, captured manifest `2faf097e4d47a1ad`, inventory `3623260465ffae2b`. Run 1 `3a4ec95a`: manifest `97c1ca0764d5aba8`, map `30fa2af358ed87e0`, LCOV `d82050fd915f31be`, receipt `709fa24a27f44b26`, captured `0229a9605cccacaf`.
- Capture tooling unchanged except `coverage-capture.manifest.mjs` (one entry added to the acceptance list); acceptance tooling changed in `coverage-unit.mjs`, `coverage-validate.mjs` and the new `coverage-acceptance.mjs`, which is why the 07-06 bundle was replaced by a fresh run rather than reused. No dependency added or changed.

## Files Created/Modified

- `.planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md` - the certification record: preconditions, two run identities, three denominators, independent verification, 21 deficits, CRAP distribution, dispositions and activation conditions
- `docs/coverage-metrics.md` - user-facing reference: invocation table, artifacts, exit statuses, what an accepted bundle proves, the two denominators, the CRAP gate, what a clean result does not mean, runtime and tools
- `scripts/coverage-acceptance.mjs` - `productionPaths`, `acceptanceSummary` (population, native totals, syntax totals)
- `scripts/coverage-unit.mjs` - publishes the shared summary
- `scripts/coverage-validate.mjs` - accepted mode recomputes the summary and refuses `summary-mismatch`
- `scripts/coverage-capture.manifest.mjs` - `coverage-acceptance.mjs` in `ACCEPTANCE_FILES`
- `tests/scripts/coverage-unit.test.ts` - reproducibility and historical-summary controls
- `tests/scripts/check-coverage-risk-fixtures.ts` - `guardFixture`, `rethrowFixture`; cyclomatic rule states `catch`
- `tests/scripts/check-coverage-risk.test.ts` - implicit-else and rethrow controls with denominator assertions

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The accepted manifest's summary is verified on readback**

- **Found during:** Task 1 (deciding what "historical counts cannot satisfy acceptance" must reject)
- **Issue:** `acceptance.population` and `acceptance.denominators` were recorded at publication and never recomputed; a manifest carrying another run's counts passed `coverage:validate`, `coverage:capture --verify` and `coverage:risk` with every digest agreeing (probe in the exact-commands table). T-07-07-01 assigns `mitigate` to substituted results.
- **Fix:** `scripts/coverage-acceptance.mjs` (new, in the acceptance tooling list), `coverage-unit.mjs` and `coverage-validate.mjs` (`summary-mismatch` rows after the receipt check); two controls in `coverage-unit.test.ts`
- **Files modified:** `scripts/coverage-acceptance.mjs`, `scripts/coverage-unit.mjs`, `scripts/coverage-validate.mjs`, `scripts/coverage-capture.manifest.mjs` (all outside the plan's file list, recorded as WINDOWS row 57)
- **Verification:** the probe refuses after the fix; 20/20 in `coverage-unit.test.ts`; 186/186 across the nine tooling suites; both full runs accepted on the new bytes
- **Committed in:** `8d8a16b7`

**2. [Structure] The two new risk fixtures live in the corpus module**

- **Found during:** Task 1
- **Issue:** the plan lists `check-coverage-risk.test.ts` only; the fixtures follow the corpus pattern of 07-06 (`check-coverage-risk-fixtures.ts`), whose header rule for cyclomatic complexity now also names `catch` (Fallow counts a catch clause, verified on the installed consumer: `probe` cc 3)
- **Fix:** `guardFixture` and `rethrowFixture` in the fixture module; recorded in WINDOWS row 57 with the files above
- **Committed in:** `8d8a16b7`

**3. [Process] Three superseded run directories were pruned**

- **Found during:** Task 1 and Task 2
- **Issue:** `coverage/runs/` held 07-01's, 07-05's and 07-06's runs (2.4 GB) and, after the tracer re-run, this plan's run 1; the orchestrator's rules ask for pruning of unreferenced runs
- **Fix:** removed `6c0485ba`, `99cf68ec`, `96fa8e3e` and `3a4ec95a` after recording their identities; `coverage/runs/` holds the published `4402189b` (809 MB); `coverage:validate` exit 0 afterwards
- **Committed in:** not a commit (gitignored)

---

**Total deviations:** 3 (1 missing critical, 1 structural, 1 process).
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened; `maxCrap: 0` stays disabled; `.fallowrc.json`, the `check` chain, the policy file, the direct pins and every earlier assertion contract are unchanged; no production source under `extensions/` changed. The Rule 2 fix strengthens the acceptance contract and required no new dependency.

## Issues Encountered

- The consumer anchors an `async function` declaration at the `async` keyword (column 7), not at `function`; the fixture header now states it and the rethrow anchors name `async function`.
- Spreading `syntax` into an object that also held `native.functions` produced TS2783 (`functions` twice); the assertion nests `native` and `syntax` instead.
- A first draft of the certification audit resolved LCOV `SF:` paths against the map's absolute keys without `path.resolve` and reported zero mismatches over zero comparisons; the audit now resolves paths and reports the population it compared, so its zero is a measured zero.
- The research's `throw err;` reachability question is settled with existing evidence: the direct-pair pin already records BC-019 for `discover.ts` 288-290 with `lines 412/414` in the single-process pair run, which is also what proves the multi-process LCOV over-reports the line.

## Known limits

- The certification is for Node v26.8.2 locally; CI's Node 24 makes its own capture and binds its own runtime (07-08 wires it). The Node merge limit applies there too by source identity, but has not been executed there in this plan.
- Two runs agree on every certified figure, and 52 of 18911 counters differ in execution count between them (timing- and poll-dependent tests), so map and LCOV bytes differ from run to run while the coverage does not; the reproducibility control pins byte equality only on the deterministic fixture.
- The ten reachable implicit-else arms are reported, not tested; a bounded follow-up plan with exact ownership would add the arm-level tests under the unit-testing rules. They do not gate activation.
- The rethrow control pins Node's cross-process merge behavior; if a future Node keeps the nested zero-count block, `native.lines` would read 16/17 and the control fails on purpose, telling the reader to update `docs/coverage-metrics.md` and 07-MEASUREMENT.md.
- `docs/coverage-metrics.md` states that `npm run check` and CI do not run these commands yet; 07-08 must update that sentence when it activates them.
- `check-coverage-risk.test.ts` now takes about 35 s (12 fixture roots through the pipeline) and `coverage-unit.test.ts` about 45 s (the reproducibility control runs the population root twice, the historical control two roots); both ran inside both full captures.
- The full `npm run check` chain was not run here (phase-close gate, 07-08); typecheck, lint, format, fallow, direct coverage and the type-member gates ran through pre-commit on the code commit, and the whole unit selection (311 files, the changed suites included) passed inside both captures.

## Threat Flags

None new. `scripts/coverage-acceptance.mjs` reads the run's inventory, the LCOV the manifest names and the map under the root, all paths already read by the pipeline; it spawns nothing and writes nothing.

## Next Phase Readiness

- 07-08 can activate `coverage:unit:verified`, `coverage:validate`, `coverage:risk` and the two negative runners in `check` and CI: the certification (07-MEASUREMENT.md 8.6) records every activation condition met on the published bundle `4402189b`.
- 07-08 must know: the accepted bundle is stale as soon as any inventoried file changes (`extensions/**`, `tests/**` outside e2e/integration/live-uat, `scripts/**`, the resource files), so CI makes its own capture; `docs/coverage-metrics.md` line "npm run check and CI do not run these commands yet" needs updating on activation; the readback now includes `summary-mismatch`, so any future edit to `coverage-acceptance.mjs`, `coverage-unit.mjs` or `coverage-validate.mjs` invalidates the accepted bundle (`tool-changed`, stage `acceptance`) until a fresh run.
- Candidate follow-up (not blocking): a bounded plan for the ten reachable implicit-else arms listed in 07-MEASUREMENT.md 8.3, with exact test ownership.
- Repository state: two code/doc commits on `features/test-backlog`; `.planning/WINDOWS.md` gained one deviation row (committed with this file); `coverage/runs/` holds one run (809 MB); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-18*

## Self-Check: PASSED

All three created files exist on disk and both commits (8d8a16b7, 604ad0f9) are in `git log`; `commits: 2` was measured as `git rev-list --count 9e39c87b..HEAD`.

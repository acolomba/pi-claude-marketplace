---
phase: 07-reliable-coverage-metrics
plan: "06"
subsystem: testing
tags: [coverage, crap, fallow, istanbul, policy, negative-controls, node-test]

# Dependency graph
requires:
  - phase: 07-04
    provides: "syntaxInventory and the fail-closed coverage:validate consumer mode"
  - phase: 07-05
    provides: "the accepted bundle (coverage/unit.manifest.json state accepted, coverage/unit.istanbul.json) published by coverage:unit:verified, and the readback consumers use"
  - phase: 07-03
    provides: "openCaptureRun/recordedModule (the run's original and executed texts) and the syntax primitives in coverage-syntax.mjs"
provides:
  - "scripts/check-coverage-risk.mjs (`npm run coverage:risk [--root] [--report] [--consumer]`): the production CRAP policy applied to the current accepted bundle through the installed Fallow 3.23.0; every production function anchored from the run's executed text, joined one-to-one to the consumer's rows through the original line's byte/UTF-16 boundaries, required to carry measured `istanbul` provenance and an agreeing percentage, and scored `cc * cc * (1 - coverage) ** 3 + cc` with the unrounded coverage against the shipped threshold"
  - "scripts/coverage-risk-policy.json: threshold 30 and the exact consumer (fallow 3.23.0, health report schema 11); the wrapper reads only this file"
  - "scripts/check-coverage-risk.negative.mjs (`npm run coverage:risk:negative`): 20 offender/benign controls through the shipping wrapper and the shipped policy, with `--wrapper`/`--pipeline` stand-in seams"
  - "tests/scripts/check-coverage-risk.test.ts (17), check-coverage-risk.negative.test.ts (8) and check-coverage-risk-fixtures.ts (classify, grade, below, twins, unicode corpora with anchors, complexities and statement counts written from the source text)"
  - "`--report` JSON (kind pi-claude-marketplace-coverage-risk, schema 1): every production function with its anchor, complexity, statements, coverage, score and the consumer's own labels beside it, plus the production and non-production denominators"
affects: [07-07, 07-08]

# Actuals (#2632) -- chars/4 over the realized diff (95323 chars, 7 files, +2829/-0), never a harness token count.
actuals:
  tokens: 23800
  tasks: 3
  commits: 5
plan_head_before: 787a5791f9bf78ed765859deed98d08c2e60bc85

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consumer output is data, never a verdict: Fallow runs once in a diagnostic form (`--report-only --max-crap 1 --format json --no-cache --quiet`, every function a finding, exit always 0) with `FALLOW_*` overrides stripped and the accepted map passed explicitly; its version, report kind, schema and enumeration counts are checked before a single row is read"
    - "Anchor join, not name join: a production row joins the AST function whose node start (the value of a method or property, the node otherwise, moved back over an erased type parameter list) sits at exactly the row's line and column; the consumer's byte column is converted through the original source line and a column that splits a character is a failure"
    - "Independent coverage before the consumer's: statement coverage is `covered / total` over the syntax inventory's statements contained in the body (nested functions included), the entry count only for a body with no statement; the consumer's `coverage_pct` must agree to 1e-9 and its one-decimal `crap` to 0.05, and the gate compares the wrapper's own unrounded score with the threshold"
    - "Two denominators, one gate: production rows must all be measured and are all gated; rows for tests and scripts are counted (`13021 other row(s) not gated` on the real tree) and never demand invented coverage"
    - "Negative controls through the shipping tool: a consumer stand-in runs the installed Fallow and edits one row of its report (swap, estimate, drop, duplicate, shift, version), which is what a name-, proximity- or estimate-based consumer would answer; bundle offenders republish the map with agreeing digests and are refused by the validator step"

key-files:
  created:
    - scripts/check-coverage-risk.mjs
    - scripts/coverage-risk-policy.json
    - scripts/check-coverage-risk.negative.mjs
    - tests/scripts/check-coverage-risk.test.ts
    - tests/scripts/check-coverage-risk.negative.test.ts
    - tests/scripts/check-coverage-risk-fixtures.ts
  modified:
    - package.json

key-decisions:
  - "The wrapper checks the public pointer's `state: accepted` before invoking coverage:validate: on a captured bundle the validator's candidate mode would judge a map and write a receipt, which a gate must never do; `not-accepted` is refused with nothing read"
  - "Fallow 3.23.0 reports a method at its parameter list and a TypeScript function node at its type parameter list (`load<T>(` anchors at `<`, `opt?(` at `(`); the anchor is the executed node start moved back over exactly the characters the strip erased, with an erased `?` left outside, and this rule is proven on the installed consumer by the twins fixture, not assumed"
  - "Fallow's `col` is a UTF-8 byte offset (the `width` function after `\"pi U+1F389\"` sits at UTF-16 column 35, byte column 38, code point 34); the wrapper converts the consumer's column to UTF-16 through the original line and never shifts an Istanbul span"
  - "Fallow's own `--max-crap 30` gates its one-decimal label: a true 29.952 is labeled 30 and reported alongside the exact 30; the wrapper's arithmetic is the policy, so 29.952 passes and 30 fails, as D-06 requires"
  - "scripts/coverage-correspondence.mjs is unchanged although the plan listed it: the join needs only the syntax primitives already exported, and changing an acceptance tooling script would have invalidated the accepted bundle's digests; the anchor walk lives in the wrapper"
  - "Commit scopes follow the repository's Conventional Commits rule (`test(coverage)`, `feat(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "Risk report rows are `{ path, line, column, name, cyclomatic, statements: { total, covered }, coverage, crap, reported: { coverage, crap, source } }`, sorted by path, line, column; a gate refusal row is the same row plus `threshold`"
  - "Wrapper refusal rows wrap a child's rows the way coverage-unit.mjs does: `{ kind: \"validation\", status, failures: [...] }`, with the child's stderr re-emitted indented"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Under the shipped policy of 30, an uncovered complexity-6 function scores 42 and is refused with its exact anchor, complexity, statement counts and score; the same function fully exercised scores 6 and passes with `istanbul` provenance; a root with no bundle, a captured bundle nobody accepted and a stale source are refused before any consumer runs; the policy file, package alias and whole-tree health thresholds are pinned"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#refuses an uncovered complexity-6 function at CRAP 42 under the shipped policy of 30"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#passes the same function fully exercised at CRAP 6 with measured provenance"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#ships the policy at 30 beside unchanged whole-tree health thresholds"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#refuses an accepted bundle whose source changed since the run"
        status: pass
      - kind: integration
        ref: "npm run coverage:unit:verified && npm run coverage:risk -- --report (real population, run 20260918T165606022Z-96fa8e3e, 1865 production functions joined, max CRAP 20.00, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repeated-name methods, same-line arrows, a partly executed nested callback, a method with an erased type parameter list, an optional method and two statement-empty bodies each join their exact anchor with independently counted coverage; a consumer that swaps the twins' coverage, drops the nested row, reports one column off or names another version is refused; exactly 30 is refused and 29.952 passes although the consumer labels and gates it as 30; byte columns are converted through the original line and a column that splits a character is refused"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#joins repeated-name, same-line and nested functions to their exact anchors with independent coverage"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#refuses a consumer whose two count methods carry each other's coverage"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#refuses an uncovered complexity-5 function at exactly 30"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#passes a true score of 29.952 that the consumer displays as 30"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#meets the consumer's own threshold of 30 with below labeled 30"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#converts the consumer's byte columns through the original source line"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.test.ts#refuses a consumer column that splits a character"
        status: pass
    human_judgment: false
  - id: D3
    description: "The negative runner drives the shipping wrapper and policy through 20 controls (offender/benign pair, exact-30/29.952 pair, missing manifest, not accepted, changed source, changed acceptance tool, schema change, negative column the consumer would clamp, deleted nested function, counter swap, estimated row, omitted row, duplicated row, wrong join, consumer version, all-tree denominator with the existing health gate still rejecting a complexity-21 test function, a production offender beside that test row, inherited FALLOW_COVERAGE), and the runner itself rejects a wrapper that passes every root, names the wrong kind, writes an unparsable row, ends by signal, exits without a row or does not run"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.negative.test.ts#names every control it ran when the real tools answer"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.negative.test.ts#rejects a wrapper that passes every root"
        status: pass
      - kind: unit
        ref: "tests/scripts/check-coverage-risk.negative.test.ts#rejects a wrapper that names the wrong row kind"
        status: pass
      - kind: other
        ref: "node scripts/check-coverage-risk.negative.mjs (20 of 20, 30 s)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 40m
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 06: Measured production CRAP policy and exact Fallow correspondence Summary

**`npm run coverage:risk` gates every production function at CRAP 30 from the accepted unit bundle, joining each of the installed Fallow's rows to its exact source anchor and scoring with the unrounded coverage; on the real tree 1865 functions join, all measured, max 20.00, 0 at or above 30.**

## Performance

- **Duration:** 1h 40m
- **Started:** 2026-09-18T15:26:00Z
- **Completed:** 2026-09-18T17:06:00Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- **The shipping wrapper** (`scripts/check-coverage-risk.mjs`) reads the shipped policy (`scripts/coverage-risk-policy.json`: threshold 30, fallow 3.23.0, health report schema 11), requires the public bundle to be in the accepted state and to pass `coverage-validate.mjs` now, anchors every production function from the run's own executed text, runs the installed Fallow once in a diagnostic form that lists every function with `FALLOW_*` overrides removed, converts each production row's byte column through the original line, joins it to exactly one anchor (and every anchor to exactly one row), requires `coverage_source: "istanbul"` with a `coverage_pct` equal to the independent proportion of contained statements (nested functions included; the entry count only for a statement-empty body), and refuses any function whose `cc * cc * (1 - coverage) ** 3 + cc` meets or exceeds 30. Rows for tests and scripts are counted and never gated. `.fallowrc.json` (cyclomatic 20, cognitive 15, unit size 60, `maxCrap: 0`) and the `check`/`fallow` chain are untouched; activation waits for 07-07 and 07-08.
- **The controls prove the join and the boundary on the installed consumer**: the uncovered complexity-6 function scores 42 and is refused, exercised it scores 6 and passes; `count` in `Left` and `Right`, two arrows on one line, a partly executed nested callback (2 of 3 statements, score 2.148), `static async load<T>(`, `opt?(`, and two statement-empty methods of which one runs all join their exact anchors; a consumer that swaps the twins' coverage, drops the nested row, reports one column off or names another version is refused; exactly 30 is refused while 29.952 passes although Fallow labels it 30 and reports it under its own `--max-crap 30`; the byte-column convention is established with a function after `"pi U+1F389"` (UTF-16 35, bytes 38, code points 34) and a column that splits the emoji is refused.
- **The negative runner** (`scripts/check-coverage-risk.negative.mjs`, `npm run coverage:risk:negative`) discriminates 20 properties through the shipping wrapper in 30 s, each offender paired with its restoration, and its own test rejects a wrapper that always passes, names the wrong kind, writes an unparsable row, ends by signal, exits 1 without a row or does not run.
- **Real-population evidence, not certification**: after the last code commit, `npm run coverage:unit:verified` accepted run `20260918T165606022Z-96fa8e3e` (7m28s) and `npm run coverage:risk` passed it in 11.6 s: 1865 production functions in 239 files, every one `istanbul`, 13021 non-production rows (all `estimated`, not gated), max CRAP 20.00 (six complexity-20 functions at 100 percent), one partial function (`bridges/commands/discover.ts:246 collectCommandFile`, 16 of 17 statements, 6.007), four statement-empty bodies under the entry rule, 0 at or above 30, and no label difference beyond 0.05 between Fallow's rounded scores and the wrapper's arithmetic.

## Task Commits

1. **Task 1: Trace the real covered/uncovered CC6 fixtures through Fallow** (tracer) - `3a7e9fc3` (test, RED: `RED_EVIDENCE_OK`, target `refuses an uncovered complexity-6 function at CRAP 42 under the shipped policy of 30` failed with `rows: []` against the expected `crap` row because the wrapper module does not exist; 6 of 6 failed) then `fdb06042` (feat, GREEN: 6 of 6)
2. **Task 2: Prove exact consumer joins and the threshold boundary** - `91737e14` (test; see TDD Gate Compliance: every control was green against the tracer's implementation, `INVALID_RED` / `unexpected_green`; no `feat` commit because no code changed)
3. **Task 3: Exercise the shipping metric gate against misleading consumer inputs** - `08c852fd` (test, RED: `RED_EVIDENCE_OK`, target `names every control it ran when the real tools answer` failed because the runner module does not exist; 7 of 8 failed) then `57f4298b` (feat, GREEN: 8 of 8 and `node scripts/check-coverage-risk.negative.mjs` 20 of 20)

**Plan metadata:** the `docs:` commit that adds this file and one WINDOWS ledger row.

Tracer feedback gate (interactive, `human_verify_mode: end-of-phase`, automated-only verify): `node --test tests/scripts/check-coverage-risk.test.ts` re-run on the committed Task 1 bytes, 6 pass 0 fail; expansion continued without a checkpoint.

## TDD Gate Compliance

- Tasks 1 and 3 each have a `test(coverage)` commit preceding their `feat(coverage)` commit, with RED records classified `RED_EVIDENCE_OK` (`target_test_failed`) by `gsd-tools check tdd-red-evidence` on the exact committed test bytes before implementation.
- **Task 2 has no failing RED.** Its 17 controls (11 new) were run against the tracer commit `fdb06042` before any Task 2 code and all passed; the record was classified `INVALID_RED` / `unexpected_green`. Investigation: the tracer's `done` ("exact measured provenance") and its action ("compare independently specified CC, statement coverage, score, source identity and exit status") already required the exact anchor join, the byte-column conversion and the unrounded arithmetic, so the tracer implementation is the Task 2 implementation. The controls are not wrong: earlier versions of them failed on a miscounted non-production row and on a mis-selected fixture row, and the method-shape rows added to the twins fixture at this point (type parameter list, optional marker, statement-empty bodies) were predicted from the consumer probe and confirmed on the installed Fallow. No wrapper change was made to manufacture a red; Task 2 is committed as `test(coverage)` alone and `scripts/check-coverage-risk.mjs` and `scripts/coverage-correspondence.mjs` are unchanged by it.
- Commit scopes are `coverage`, per the repository's Conventional Commits rule, so the generic `test(07-06)`/`feat(07-06)` grep finds nothing by design. No REFACTOR commits.

## Exact commands and results

| Command | Result |
| --- | --- |
| `fallow health --root . --coverage coverage/unit.istanbul.json --format json --no-cache --report-only --max-crap 1 --quiet` (probe of the 07-05 bundle before any code) | exit 0 in 3.8 s; `functions_analyzed` 14724 = findings = `functions_above_threshold`; 1865 production rows all `istanbul`, 12859 others `estimated`; `col` is a byte offset at the function node start (`function` after `export `, `(` of a method, `<` of a type parameter list) |
| join experiment (scratch) of those 1865 rows against `syntaxInventory` anchors | 1771 joined at `outer.start`, 94 unjoined: every one a method or property whose consumer anchor is its parameter list; 0 coverage mismatches on the joined rows with body-span containment; 4 statement-empty bodies agree under the entry rule |
| `node --test --test-reporter=tap tests/scripts/check-coverage-risk.test.ts` (Task 1 RED) | exit 1; 6 tests, 0 pass; `RED_EVIDENCE_OK` |
| `node --test tests/scripts/check-coverage-risk.test.ts` (Task 1 verify, tracer re-run on committed bytes) | 6 pass, 0 fail (8.2 s) |
| `node --test --test-reporter=tap tests/scripts/check-coverage-risk.test.ts` (Task 2, before any Task 2 code) | exit 0; 17 pass, 0 fail (34 s); `INVALID_RED` / `unexpected_green` |
| `node --test tests/scripts/check-coverage-risk.test.ts` (Task 2 verify, final bytes) | 17 pass, 0 fail |
| `node --test --test-reporter=tap tests/scripts/check-coverage-risk.negative.test.ts` (Task 3 RED) | exit 1; 8 tests, 1 pass, 7 fail (`Cannot find module .../check-coverage-risk.negative.mjs`); `RED_EVIDENCE_OK` |
| `node --test tests/scripts/check-coverage-risk.negative.test.ts && node scripts/check-coverage-risk.negative.mjs` (Task 3 verify) | 8 pass, 0 fail (63 s); `Coverage risk negative controls passed (20 of 20).` (30 s) |
| `fallow health ... --max-crap 30 --coverage <map>` on the grade root (exact 30) and the below root (29.952) | exit 1 for both; both listed with `crap: 30`, `exceeded: "crap"`; the installed consumer gates its one-decimal label |
| `npm run coverage:risk` on the 07-05 bundle after the new files existed | exit 1: `validation` row carrying `stale-input` with the four added files and the changed `package.json`; the freshness contract holds on the real tree |
| `npm run coverage:unit:verified` (real population, final tree) | exit 0 in 7m28s; run `20260918T165606022Z-96fa8e3e`: 311 workers, 541 raw snapshots, 615 modules loaded, 239 production sources (230 loaded, 9 unloaded); native 63825/63825 lines, 1890/1890 functions, 9234/9234 branches; syntax 1865/1865 functions, 10392/10393 statements, 6633/6653 branch arms |
| `npm run coverage:risk -- --report <scratch>/real-risk.json` | exit 0 in 11.6 s; `Coverage risk verified: 20260918T165606022Z-96fa8e3e, 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts:108:0 (statusTag), policy < 30; 13021 other row(s) not gated`; score histogram <5: 1394, 5-9: 377, 10-19: 88, 20: 6 |
| `SKIP=trufflehog pre-commit run --files ...` (three runs over the five commits' file sets) + trufflehog filesystem scan of each set | every hook passed (prettier, lint, format check, typecheck, fallow dead-code/cycles/health/dupes, direct coverage, type members and their negative controls when package.json changed); 0 verified / 0 unverified secrets |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-06-T1 | From the fixture text: `classify` at 1:7, five `if`s (cyclomatic 6), eleven statements; uncovered 0/11 and 36 + 6 = 42 refused with the literal `crap` row and `threshold: 30`; exercised 11/11 and 6 with the literal verified line, `other: { rows: 2, estimated: 2 }` (the test callback and its map arrow) and `reported: { coverage: 100, crap: 6, source: "istanbul" }`; the policy file, `.fallowrc.json` health block and `coverage:risk` alias as literals; `missing-manifest`, `not-accepted` (state `captured`) and `validation`/`stale-input` rows as literals | A wrapper that gates Fallow's `--report-only` exit status, one that reads a lowered threshold from the root, one that accepts a captured bundle or a stale source, one that gates non-production rows, one that changes `.fallowrc.json` | New tooling only: no production export, native aggregate, direct pin or existing assertion changed |
| 07-06-T2 | Ten twins rows written from the source: anchors by unique snippets (`(items: string[]): number {\n    return items.length;` for `Left.count`, `<T>(x: T): Promise<T>` for `load`, `(): void {}\n  idle` for `noop`), statement counts by hand (outer 4 with 3 covered including the nested body's, callback 3 with 2), scores by the formula; `coverage-mismatch` rows with `reported`/`measured` swapped between the two `count`s; `function-unreported` at 16:20; `row-unjoined` at 15:8 beside `function-unreported` at 15:7; `consumer-identity` on `version`; `5 * 5 * 1 + 5 = 30` refused, `8 * 8 * 0.7 ** 3 + 8 = 29.952` passed with `reported: { coverage: 30, crap: 30 }`; Fallow's own `--max-crap 30` rows for both; UTF-16 35 / bytes 38 / code points 34 from the line text; `anchor-unit` at byte 25 | A consumer joined by name, by nearest position or by estimate; a threshold compared with the rounded label; a column read as UTF-16 or code points; a nested function's statements counted only for the outer or only for the inner function | Same |
| 07-06-T3 | 20 control labels in order and the closing count as the runner's whole stdout; each offender's rows as literals (`schema-key` with `missing: ["branchMap"]`, `position` with the -1 column on `statementMap[0]`, `function-missing` with the callback's `decl` 14:20-14:21 and `loc` 14:31-19:3, the `both`/21 health finding for `ladder`, `; 4 other row(s) not gated`); the runner's own failure messages as regexes per defect; workspace directories before and after a failed run | An always-passing wrapper, a wrong kind, an unparsable row, a signal, a bare exit 1, a wrapper that does not run, a control order silently changed, a workspace left behind, a runner that rewrites the policy or passes `--min-score 0` | Same |

Partial/zero/error paths recorded: partial coverage 16/17 on the real tree and 2/3, 3/4, 3/10 on fixtures; zero coverage on `Right.count`, `same[1]`, `idle`, `grade` and the uncovered `classify`; zero statements under the entry rule (`noop` entered, `idle` not); `missing-manifest`, `not-accepted`, `validation` (stale input, acceptance tool, schema, position, missing function), `consumer-identity`, `coverage-mismatch`, `coverage-source`, `function-unreported`, `row-unjoined`, `row-duplicate`, `anchor-unit` and `crap` rows; launch/signal/unparsable/always-pass/silent harness defects.

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64; npm 11.19.1; Fallow 3.23.0 (signed, lockfile resolution), health report `schema_version` 11. CI's Node 24 has not been exercised by this plan.
- Final file digests (sha256, first 16): `scripts/check-coverage-risk.mjs` `715f49e59415afb4`, `scripts/check-coverage-risk.negative.mjs` `9d852a85e112077d`, `scripts/coverage-risk-policy.json` `70e34efcc64912a5`, `tests/scripts/check-coverage-risk.test.ts` `0f475a639b5a3f03`, `tests/scripts/check-coverage-risk.negative.test.ts` `71cbe5eeaa98ca12`, `tests/scripts/check-coverage-risk-fixtures.ts` `ed943f2a489466fc`.
- Real-population accepted bundle `20260918T165606022Z-96fa8e3e`: captured manifest `e7ea0a50e661af2b`, map `fa867583c050e8d1`, validation receipt `028c518330cc38f0`, LCOV `3c8b0167ac43b67b`; acceptance tooling digests unchanged from 07-05 (`coverage-correspondence.mjs` `8c3c2cd2fa67f08a`); producer payload `29377dc2bb113e40` (1.0.6-project.1).
- No dependency added or changed; no acceptance or capture tooling script changed.

## Real-population measurement (evidence, not certification)

On the final tree the wrapper joined all 1865 production functions of 239 files (215 files declare a function) to Fallow's 1865 `istanbul` rows in both directions; 13021 rows for tests and scripts are `estimated` and not gated. Every score is below 30: six functions of cyclomatic 20 at 100 percent score 20.00 (`plugin-browser.ts` `statusTag`, `statusDescription`, `availableActions`; `install.messaging.ts` `composeInstallFailureMessage`; `notification-grammar.ts` `renderPluginRow`; `notification-types.ts` `pluginVersion`), 88 score 10 to 19, 377 score 5 to 9, 1394 below 5. The one partial function is `bridges/commands/discover.ts:246:0 collectCommandFile` (16 of 17 statements, the `throw err;` the research named; 6.007, labeled 6). Four bodies hold no statement (`bridges/mcp/stage.ts:354 abortPreparedMcp`, `orchestrators/plugin/enable-disable.ts:134` and `:477`, `platform/git-credential.ts:165:28`) and use the entry rule at 100 percent. This is the measurement the wrapper makes today; 07-07 owns the stable certified measurement and the reassessment D-06 asks for before activation.

## Files Created/Modified

- `scripts/check-coverage-risk.mjs` - `npm run coverage:risk`: policy, accepted-state check, validator step, anchors, diagnostic consumer run, identity and enumeration checks, byte-column conversion, one-to-one join, provenance and agreement checks, unrounded scoring, `--report`, `--consumer` seam
- `scripts/coverage-risk-policy.json` - threshold 30 and the exact consumer
- `scripts/check-coverage-risk.negative.mjs` - `npm run coverage:risk:negative`: 20 controls with `--wrapper`/`--pipeline` seams and consumer stand-ins
- `tests/scripts/check-coverage-risk-fixtures.ts` - classify (exercised/uncovered), grade, below, twins (with method shapes) and unicode corpora; `expectedRows`, `crapOf`
- `tests/scripts/check-coverage-risk.test.ts` - 17 controls
- `tests/scripts/check-coverage-risk.negative.test.ts` - 8 controls
- `package.json` - `coverage:risk`, `coverage:risk:negative`; the `check`/`fallow` chain is unchanged

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Structure] The policy corpus lives in a sibling fixture module**

- **Found during:** Task 1
- **Issue:** the plan names only the test files; the fixtures follow the `coverage-producer-fixtures.ts` pattern and are shared by the two test files
- **Fix:** `tests/scripts/check-coverage-risk-fixtures.ts`, recorded in `.planning/WINDOWS.md` as a `deviation` row
- **Committed in:** `3a7e9fc3`

**2. [Scope] `scripts/coverage-correspondence.mjs` is unchanged**

- **Found during:** Task 2 design
- **Issue:** the plan lists it among Task 2's files; the anchor join needs only `parseExecuted`, `childNodes`, `declaredFunction`, `lineStartsOf` and `locate` from `coverage-syntax.mjs` plus `syntaxInventory`'s statements, and any change to an acceptance tooling script would have invalidated the accepted bundle's `acceptance.tooling` digests for every consumer
- **Fix:** the walk that records each function node's own start lives in the wrapper (`collectFunctions`, `anchorOffset`)

**3. [TDD] Task 2 had no failing RED**

- See TDD Gate Compliance above; no code changed for Task 2.

---

**Total deviations:** 3 (1 structural, 1 scope, 1 TDD).
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened; `maxCrap: 0` stays disabled; the `check`/`fallow` chain, `.fallowrc.json`, the direct pins and every earlier assertion contract are unchanged; no production export or extension code changed.

## Issues Encountered

- The pre-commit `npm-*` hooks validate the whole tree, not the file set: a hook run that overlapped an edit reported `files were modified by this hook` on typecheck and had to be repeated; the wait loops that polled for the hook's completion matched their own command line and had to be replaced.
- `[...text]` over a string trips `@typescript-eslint/no-misused-spread`; the code-point count in the unicode control uses `match(/./gsu)`.
- `delete map[id]` trips `@typescript-eslint/no-dynamic-delete` in `.mjs` scripts too; the deleted-record control rebuilds `fnMap` and `f` with `Object.fromEntries`.
- The Write tool turned `" "`-style escapes into the literal characters; the strip-blank set was rewritten with escapes to match `coverage-source-map.mjs`.

## Known limits

- The consumer join is a contract with Fallow 3.23.0 as installed: its byte columns, its anchor at a method's parameter list or type parameter list, its one-decimal `crap` label and its `--max-crap 1` enumeration are pinned by the policy's version and report schema; a Fallow upgrade fails `consumer-identity` until the policy is revised and the controls re-run. An erased optional marker followed by a type parameter list (`opt?<T>(`) is anchored at `<` by construction but has no fixture.
- A counter swap inside the accepted map itself is not detectable by this wrapper (the consumer and the wrapper read the same map); the `counter-swap` control is a consumer that swaps its rows, which is what a name-based join produces. The map's counters are bound to the run by 07-02's conformance corpus and 07-05's digests.
- `--consumer` is a control seam on the shipping wrapper (07-05's seams live on the negative runner only); `npm run coverage:risk` never passes it and the default is the installed launcher.
- A root whose production population declares no function prints `no production function` and passes; the real tree has 1865.
- The real run created `coverage/runs/20260918T165606022Z-96fa8e3e` (808 MB) and moved the public pointer to it; the 07-01 (`6c0485ba`, 789 MB) and 07-05 (`99cf68ec`, 804 MB) run directories are now unreferenced and were left in place, as they are not this plan's to remove. Fixture roots and the negative runner's workspace are removed after each run.
- `check-coverage-risk.test.ts` takes about 35 s (ten fixture roots through the pipeline) and `check-coverage-risk.negative.test.ts` about 65 s (one faithful run of 20 controls plus six early-failing defective runs); both are in the unit selection and ran inside the real-population capture.
- Verified on Node v26.8.2 and npm 11.19.1; the full `npm run check` chain was not run here (phase-close gate, 07-08); typecheck, lint, format, fallow, direct coverage and the type-member gates ran through pre-commit on every commit, and the whole unit selection (309 files, my two included) passed inside `coverage:unit:verified`.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: subprocess | scripts/check-coverage-risk.mjs | Spawns `coverage-validate.mjs` and the Fallow launcher under `process.execPath` with argv arrays (no shell), cwd at the root, `FALLOW_*` removed from the consumer's environment; launch, signal and status are three different rows. `--consumer` accepts any executable path by design (control seam). |
| threat_flag: file-write | scripts/check-coverage-risk.mjs | Writes the `--report` JSON atomically at the caller's path (removed first) and nothing else; the validator runs in its read-only accepted mode only. |
| threat_flag: subprocess | scripts/check-coverage-risk.negative.mjs | Writes consumer stand-in scripts under its own temporary workspace and runs them through the wrapper's `--consumer` seam; the workspace is removed in `finally`. |

## Next Phase Readiness

- 07-07 can run `npm run coverage:unit:verified && npm run coverage:risk -- --report coverage/unit.risk.json` for the certified measurement; the report lists every production function with its score and the consumer's labels, and the six complexity-20 functions are the current maximum.
- 07-08 wires `coverage:risk` and `coverage:risk:negative` after `coverage:validate` in `check` and CI; the wrapper is inert on import, takes `--root` for fixtures and exits 2 on usage errors.
- Repository state: five code commits on `features/test-backlog`; `.planning/WINDOWS.md` gained one deviation row (committed with this file); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-18*

## Self-Check: PASSED

All six created files exist on disk and all five commits (3a7e9fc3, fdb06042, 91737e14, 08c852fd, 57f4298b) are in `git log`; `commits: 5` was measured as `git rev-list --count 787a5791..HEAD`.

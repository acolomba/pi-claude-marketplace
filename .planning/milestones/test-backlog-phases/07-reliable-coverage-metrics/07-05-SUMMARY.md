---
phase: 07-reliable-coverage-metrics
plan: "05"
subsystem: testing
tags: [coverage, istanbul, lcov, v8, manifest, sha256, negative-controls, node-test]

# Dependency graph
requires:
  - phase: 07-01
    provides: "coverage-capture.mjs run bundles (raw V8 snapshots, source/executed stores, inventory snapshot, captured manifest) and verifyCaptureBundle readback"
  - phase: 07-02
    provides: "the qualified producer adapter (loadProducer, convertScripts, producerIdentity) and the producer CLI"
  - phase: 07-03
    provides: "executedSourceMap, openCaptureRun, recordedModule, restoreSourceNames, positionFailures and the run request form"
  - phase: 07-04
    provides: "syntaxInventory/correspondenceFailures, fileFailures/mapFiles and the fail-closed coverage:validate CLI with its receipt"
provides:
  - "scripts/coverage-unit.mjs (`npm run coverage:unit:verified [--root]`): one native run captured, converted, validated and published as one accepted bundle -- coverage/unit.lcov unchanged, coverage/unit.istanbul.json, coverage/unit.validation.json and, last, an accepted coverage/unit.manifest.json binding the captured manifest, both receipts, the conversion tooling digests, the production population and the native and syntax denominators; any refusal removes every public artifact and keeps the run directory"
  - "scripts/coverage-producer.mjs snapshot requests `{ run, modules, raw }`: every module of a run converted from its raw files in order, snapshots read once each, merged through Istanbul's merger, files in path order; a snapshot listed twice, unknown or changed, a loaded module no snapshot carries and an unloaded module a snapshot carries are refused; a never-loaded module gets the producer's zero-execution model"
  - "scripts/coverage-capture.mjs records an executed text for every production source no test loaded (`unloaded` records, inventory snapshot stripped under the same runtime); verifyCaptureBundle reads accepted bundles, checks the acceptance digests and requires every production source to be represented"
  - "scripts/coverage-validate.mjs with no arguments verifies an accepted bundle: producer identity, full re-validation of the map from the run's bytes, receipt equality; a source the run never loaded must carry only zero counters"
  - "scripts/coverage-unit.negative.mjs (`npm run coverage:unit:negative`): 32 offender/benign controls through the shipping pipeline and readback, with `--pipeline`/`--validator` stand-in seams"
  - "tests/scripts/coverage-unit.test.ts (18), coverage-unit.negative.test.ts (9), 10 snapshot controls in coverage-producer.test.ts, coverage-unit-fixtures.ts (four-source population) and coverage-projection.ts (shared projection)"
affects: [07-06, 07-07, 07-08]

# Actuals (#2632) -- chars/4 over the realized diff (153175 chars, 16 files, +3342/-231), never a harness token count.
actuals:
  tokens: 38300
  tasks: 3
  commits: 7
plan_head_before: 55fad38f339168f6f00fa37b27bbd9b30da94e01

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Accepted bundle as a superset: the captured manifest is promoted by adding `state: accepted` and an `acceptance` block; it is written to runs/<id>/accepted.json and byte-copied to the public pointer last, while runs/<id>/manifest.json stays the immutable captured record its digest is bound to"
    - "Every production source is in the run: a source no test loaded is recorded by the capture from the inventory snapshot, stripped by the same runtime, so `recordedModule` serves loaded and unloaded modules alike and `verifyCaptureBundle` refuses a bundle that represents fewer sources than it inventoried"
    - "Zero-execution model, not omission: a never-loaded module is converted with `functions: []`, which the producer maps to every construct at count 0; the validator then requires every counter of an unloaded source to be zero, and the correspondence forces an empty record for a type-only module and a full record for an executable one"
    - "Two denominators, labeled apart: native (Node's LCOV over the loaded files) and syntax (the model over every production file) are recorded side by side and never equated; the fixture shows 4/4 native branches against 0/2 syntax branch arms and 2 native records against 4 syntax files"
    - "Consumer readback revalidates: `coverage:validate` on an accepted bundle re-derives the receipt from the run's bytes and requires it to equal the stored one, so a republished map whose every digest agrees is still refused at the exact offending row"
    - "Negative controls drive the shipping tools one property at a time, offender then restoration, and the runner itself is tested through pass-through stand-ins that misbehave at one scripted invocation"

key-files:
  created:
    - scripts/coverage-unit.mjs
    - scripts/coverage-unit.negative.mjs
    - tests/scripts/coverage-unit.test.ts
    - tests/scripts/coverage-unit.negative.test.ts
    - tests/scripts/coverage-unit-fixtures.ts
    - tests/scripts/coverage-projection.ts
  modified:
    - scripts/coverage-capture.mjs
    - scripts/coverage-capture.manifest.mjs
    - scripts/coverage-producer.mjs
    - scripts/coverage-producer.convert.mjs
    - scripts/coverage-source-map.mjs
    - scripts/coverage-correspondence.mjs
    - scripts/coverage-validate.mjs
    - tests/scripts/coverage-producer.test.ts
    - tests/scripts/coverage-source-map.test.ts
    - package.json

key-decisions:
  - "The conversion runs through the producer CLI as one snapshot request, not through one request per module: raw files are read once each (539 on the real population), converted with a fresh AST per record and merged as they go, so memory stays bounded and the pipeline uses the same CLI the corpus qualified"
  - "The unloaded executed text is recorded by the capture, under the runtime the run binds, rather than derived by every consumer; consumers therefore never call stripTypeScriptTypes and the strip proof applies to unloaded modules exactly as to loaded ones"
  - "A snapshot's identity is the raw file the run listed (one V8 isolate); two identical raw files from two real processes are two executions, so duplicates are refused by path, never by digest"
  - "The validation receipt keeps its 07-04 shape and binds the captured manifest digest; the accepted manifest records that digest as `acceptance.captured`, so the receipt stays valid across promotion and the consumer mode recomputes it from runs/<id>/manifest.json"
  - "A refused pipeline step removes every public artifact, LCOV included: a public LCOV without an accepted map is a half bundle, and the run directory keeps the evidence"
  - "The map's files are emitted in path order, making the merged bytes a function of the run alone; the fixture proved the same snapshots reversed produced different bytes before"
  - "Commit scopes follow the repository's Conventional Commits rule (`test(coverage)`, `feat(coverage)`, `fix(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "Pipeline rows carry child rows: a refused step is `{ kind: capture|conversion|validation, status, failures: [...] }`, and the child's stderr is re-emitted indented so the pipeline's own rows stay the only rows a reader parses"
  - "Fixture roots for population controls list every source with its expected projection (`populationSources()`), so one loop compares the whole map against hand-written spans"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "One native unit run yields the LCOV unchanged, a validated Istanbul map and an accepted manifest whose digests bind them; the consumer readback accepts exactly that bundle and refuses it once the map, receipt, LCOV or manifest is missing, changed or replaced by another run's, and revalidates the map instead of trusting digests"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#publishes the LCOV unchanged, the validated Istanbul map and an accepted manifest from one native run"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#passes the consumer readback of coverage:validate and coverage:capture --verify"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#refuses the consumer readback once another run's Istanbul map replaces this one"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#revalidates the accepted map on readback instead of trusting its digests"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#publishes nothing and keeps the failed run's evidence when a test fails"
        status: pass
      - kind: integration
        ref: "npm run coverage:unit:verified && npm run coverage:validate (real population, run 20260918T151045032Z-99cf68ec, exit 0 both)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every production source is accounted for: two workers' records merge into faithful counters in either order, an imported but uncalled function stays at zero, a never-loaded executable module carries the complete zero-execution model, a type-only module an empty record, and native and syntax denominators are recorded apart; a snapshot listed twice, unknown or changed, a loaded module no snapshot carries and a module the run did not record are refused"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#accounts for every production source: merged workers, an uncalled import, an unloaded module and a type-only module"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#converts a run's snapshots into one merged map whose bytes do not depend on their order"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#converts the snapshot of tests/domain/pair-first.test.ts alone to that worker's counters"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#gives a module the run never loaded the producer's complete zero-execution model"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses a snapshot listed twice and writes nothing"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#refuses an unloaded executable source recorded as an empty map"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.test.ts#refuses an unloaded source whose record shows execution"
        status: pass
    human_judgment: false
  - id: D3
    description: "The negative runner drives the shipping pipeline and readback through 32 controls (inputs, tooling, producer identity, every artifact missing or changed, dropped unloaded record, malformed coordinate, missing function and statement, execution on an unloaded source, foreign run report and bundle, integration LCOV substitution, inherited coverage environment, failed tests, interrupted worker), each offender paired with its restoration, and the runner itself fails on a tool that accepts everything, names the wrong diagnostic, writes an unparsable row, ends by signal, exits without a row or publishes nothing"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-unit.negative.test.ts#names every control it ran when the real tools answer"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.negative.test.ts#rejects a validator that accepts every bundle"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.negative.test.ts#rejects a validator that names the wrong diagnostic"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-unit.negative.test.ts#rejects a validator ended by a signal"
        status: pass
      - kind: other
        ref: "node scripts/coverage-unit.negative.mjs (32 of 32, 18 s)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 59m
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 05: Complete Same-Run Conversion and Atomic Accepted Artifacts Summary

**`npm run coverage:unit:verified` turns one native unit run into one accepted bundle -- LCOV unchanged, every production source converted (loaded modules merged across workers, never-loaded ones at the producer's zero model, type-only ones as empty records), validated against the run's own bytes and published under a manifest written last that binds every artifact, tool and receipt -- and `coverage:validate` with no arguments re-derives that acceptance or refuses at the exact row; on the real population the bundle reads back at 63825/63825 native lines, 1890/1890 functions, 9234/9234 branches and 1865/1865 syntax functions, 10392/10393 statements, 6633/6653 branch arms**

## Performance

- **Duration:** 1h 59m (seven pre-commit pipeline runs of 7 to 12 minutes each, two full-population runs of about 7 minutes)
- **Started:** 2026-09-18T13:23:16Z
- **Completed:** 2026-09-18T15:22Z
- **Tasks:** 3 (each RED then GREEN) plus one bug fix found by the full-population run
- **Files modified:** 16 (6 created, 10 modified)

## Accomplishments

- **One run, one bundle.** `coverage-unit.mjs` removes the previous public bundle, runs `coverage-capture.mjs` once, reads the captured bundle back as a consumer, writes a snapshot request naming every production source and every raw file of the run, runs `coverage-producer.mjs` (map and producer receipt into the run directory), runs `coverage-validate.mjs` against that map (validation receipt into the run directory), and only then assembles `runs/<id>/accepted.json`: the captured manifest plus `state: "accepted"` and an `acceptance` block with the captured manifest digest, the eight conversion/validation script digests, the producer identity receipt (payload digest of the 1.0.6-project.1 delivery, acorn 8.18.0, istanbul-lib-coverage 3.2.2, sourcemap-codec 1.6.0, Node/V8, adapter digest), the validation receipt digest and model versions, the map digest, the population and the two denominators. The map and validation receipt are copied to `coverage/unit.istanbul.json` and `coverage/unit.validation.json`, the manifest is copied to `coverage/unit.manifest.json` last, and the bundle is read back. Any refusal removes the four public files, keeps the run directory and exits 1 with rows such as `{ kind: "capture", status: 1, failures: [{ kind: "tests-failed", status: 1 }] }`.
- **No production source vanishes.** The capture now writes an `unloaded` record for every production source no worker loaded, with its executed text stripped from the inventory snapshot under the same Node and stored content-addressed; `verifyCaptureBundle` refuses a bundle whose loaded plus unloaded records do not cover the inventoried production set (`unrepresented-source`). The producer's snapshot request converts a never-loaded module with `functions: []`, the producer's own zero-execution model (every construct at count 0, the implicit else as the absent location), and refuses an unloaded module that some snapshot does carry (`unexpected-record`) or a loaded module no snapshot carries (`unobserved-module`). The validator requires every counter of an unloaded source to be zero (`unloaded-hits`); the correspondence already forces an executable module's full record and a type-only module's empty one. On the real population, 230 of 239 production sources were loaded; of the 9 unloaded, 8 are type-only and one (`orchestrators/types.ts`) is executable because `import { type ContentReason }` survives stripping as a side-effect import -- faithfully reported, not hidden (D-07).
- **Workers merge faithfully and deterministically.** Each raw file is one snapshot (one V8 isolate), listed once (`duplicate-snapshot`), present in the manifest (`unknown-snapshot`) and unchanged (`stale-snapshot`); each record is converted from a fresh Acorn AST over the run's one recorded executed text and merged through Istanbul's merger, and the merged map lists files in path order, so the same snapshots reversed produce byte-identical output (they did not before). One worker alone shows its own counters (`first` 1 / `second` 0 and `first` 0 / `second` 2); merged, `first` 1 and `second` 2.
- **Consumers recheck, they do not trust.** `coverage:validate` on an accepted bundle verifies every digest (captured manifest, map in run and public, receipts in run and public, producer receipt, LCOV, raw files, stores), the capture and acceptance tooling digests and the runtime, requires the installed producer's identity to equal the recorded one (`producer-changed`), validates the map again in full from the run's bytes and requires the receipt that validation yields to equal the stored one (`receipt-mismatch`). A map republished with a negative column, a dropped function, a dropped statement or a nonzero counter on an unloaded source -- every digest rewritten to agree -- is refused at that exact row.
- **The negative runner discriminates 32 properties** through the shipping tools in 18 seconds: a source added, removed or changed; a test, `package.json` or `package-lock.json` changed; a capture or acceptance tool digest changed; the producer identity changed; a raw file, the LCOV, the map, the receipt missing or changed; the manifest missing or empty; an unloaded record dropped; a malformed coordinate, a missing function, a missing statement and execution on an unloaded source republished with agreeing digests; another run's map; another run's whole bundle; the native LCOV of an integration test in place of the unit LCOV; an inherited `NODE_V8_COVERAGE`/`PI_CM_COVERAGE_*` pointing at another run; a failing test; an interrupted worker. Each offender's restoration must pass again; both pipeline refusals must leave no public file and one failed run directory. Its own test hands it pass-through stand-ins that misbehave at one invocation.

## Task Commits

1. **Task 1: Publish one captured run through conversion, validation and readback** (tracer) - `c7a3a1d2` (test, RED: `RED_EVIDENCE_OK`, target `publishes the LCOV unchanged, the validated Istanbul map and an accepted manifest from one native run` failed on `assert.strictEqual(verified.status, 0)` with `1 !== 0`; 12 of 12 failed) then `691e7841` (feat, GREEN: 12/12 and 150/150 across the eight coverage suites)
2. **Task 2: Merge workers and account for every production source** - `c74dab78` (test, RED: `RED_EVIDENCE_OK`, target `converts a run's snapshots into one merged map whose bytes do not depend on their order` failed on `deepStrictEqual` of the two output buffers; 15 of the 16 new controls were already green on the Task 1 implementation) then `5916a7fd` (feat, GREEN: 46/46)
3. **Task 3: Reject stale and substituted artifacts through executable controls** - `970feb66` (test, RED: `RED_EVIDENCE_OK`, target `names every control it ran when the real tools answer` failed because the runner does not exist; 8 of 9 failed) then `77f111bf` (feat, GREEN: 9/9 and `node scripts/coverage-unit.negative.mjs` 32 of 32)
4. **Fix after the full-population run** - `77d8920f` (fix): the strip proof admitted only U+0020 and U+FEFF as blanks; Node's strip mode writes a blank of the same UTF-8 length (U+00A0 for two bytes, U+2002 for three), so a removed interface whose comment held `§` refused the whole production conversion as a `transform`

**Plan metadata:** the `docs:` commit that adds this file and the seven ledger rows.

Tracer feedback gate (interactive, `human_verify_mode: end-of-phase`, automated-only verify): `node --test tests/scripts/coverage-unit.test.ts` re-run on the committed Task 1 bytes, 12 pass 0 fail; expansion continued without a checkpoint.

## TDD Gate Compliance

- Each task has a `test(coverage)` commit preceding its `feat(coverage)` commit; every RED record was classified `RED_EVIDENCE_OK` (`target_test_failed`) with `gsd-tools check tdd-red-evidence` before implementation.
- Task 2's RED had one failing control of 16: the Task 1 implementation already handled the population (the capture's `unloaded` records, the zero model, the classification and the denominators were needed to make the tracer's manifest complete), so the other 15 pin behaviour that existed. None was weakened; the failing one drove the path-ordered output.
- Task 3's test 9 (`removes its workspace after a control fails`) was green at RED because no runner meant no workspace; it pins the cleanup once the runner exists.
- The fix commit follows its own control: `accepts the same-length blanks strip mode writes ...` was written first and failed on the `transform` row for `∑` before the proof admitted U+2002.
- Commit scopes are `coverage`, per the repository's Conventional Commits rule, so the generic `test(07-05)`/`feat(07-05)` grep finds nothing by design. No REFACTOR commits.

## Exact commands and results

| Command | Result |
| --- | --- |
| `node --test --test-reporter=tap tests/scripts/coverage-unit.test.ts` (Task 1 RED) | exit 1; 12 tests, 0 pass; target failed on `1 !== 0` (module not found); `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-unit.test.ts` (Task 1 verify, before and after the GREEN commit) | 12 pass, 0 fail |
| eight coverage suites after Task 1 GREEN | 150 pass, 0 fail |
| `node --test --test-reporter=tap tests/scripts/coverage-unit.test.ts tests/scripts/coverage-producer.test.ts` (Task 2 RED) | exit 1; 46 tests, 45 pass, 1 fail (reversed snapshots differ in bytes); `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-unit.test.ts tests/scripts/coverage-producer.test.ts` (Task 2 verify) | 46 pass, 0 fail |
| `node --test --test-reporter=tap tests/scripts/coverage-unit.negative.test.ts` (Task 3 RED) | exit 1; 9 tests, 1 pass, 8 fail; `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-unit.negative.test.ts && node scripts/coverage-unit.negative.mjs` (Task 3 verify) | 9 pass, 0 fail (43 s); `Verified unit coverage negative controls passed (32 of 32).` (18 s) |
| `npm run coverage:unit:verified` (real population, first attempt, run `20260918T145314658Z-3519fd41`) | capture accepted (309 workers, 539 raw records, 610 modules, 9 unloaded); conversion refused: `auth-registry.ts is not a position-preserving strip of its source` `{"kind":"transform","line":37,"column":47,"original":"§","executed":" "}` (the executed character is U+00A0); pipeline exit 1, no public file; run directory pruned after the fix |
| `node --test tests/scripts/coverage-source-map.test.ts` (fix control, before the proof change) | 28 tests, 27 pass; the new control failed with `{"kind":"transform","line":1,"column":24,"original":"∑","executed":" "}` (U+2002) |
| `npm run coverage:unit:verified` (real population, run `20260918T151045032Z-99cf68ec`) | exit 0 in 7m28s; `Coverage unit verified: ... 239 production file(s), 230 loaded, 9 unloaded (8 type-only, 1 executable); native 63825/63825 line(s), 1890/1890 function(s), 9234/9234 branch(es); syntax 1865/1865 function(s), 10392/10393 statement(s), 6633/6653 branch arm(s)`; run directory 804 MB |
| `npm run coverage:validate` (consumer mode on that bundle) | `Coverage bundle verified: 20260918T151045032Z-99cf68ec, 239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es), schema 1, syntax model 1; manifest coverage/unit.manifest.json`, exit 0 in 6.2 s |
| `node scripts/coverage-capture.mjs --verify` | `Coverage capture verified: 20260918T151045032Z-99cf68ec`, exit 0 |
| all eight coverage suites on the final tree | 176 pass, 0 fail (38 s) |
| `npm run test:corresponding`, `npx tsc --noEmit`, `npx eslint`, `npm run fallow` | passed / clean / exit 0 |
| `SKIP=trufflehog pre-commit run --files ...` (seven runs) + trufflehog filesystem scan of each set | every hook passed on every set (lint, format, typecheck, fallow, direct coverage, type members, and the type-members negative controls when package.json changed); 0 verified / 0 unverified secrets |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-05-T1 | Tally fixture: stdout line with 3/3 lines, 1/1 functions, 2/2 native branches (root and function blocks) against 1/1 functions, 1/1 statements, 0/0 syntax arms; public LCOV bytes equal the run's; the map's projection equals the hand-written fixture; five acceptance digests recomputed with `createHash` over the public files and the run manifest; the public manifest equals `accepted.json` byte for byte; readback rows written as literals (`missing-artifact`, `artifact-digest`, `missing-manifest`, `position` with the -1 column); no public file after a failed test and a run manifest with `[{ kind: "tests-failed", status: 1 }]` | A pipeline that publishes the map before validation, a manifest written before the artifacts, a consumer that trusts digests (the republish control), a stale acceptance surviving a failed replacement, an LCOV rewritten by the conversion | No production exclusion, native threshold, direct pin or existing assertion changed; `maxCrap: 0` stays disabled |
| 07-05-T2 | Population fixture written from four sources: `pair.ts` merged 1/2 and per worker 1/0 and 0/2; `idle.ts` function 0; `unimported.ts` one function, three statements, one `if` with `[0, 0]` and the absent else; `types.ts` empty record; population block with source digests from the fixture text and executed digests from Node's strip oracle; native `{ records 2, lines 10/8, functions 3/2, branches 4/4 }` and syntax `{ files 4, functions 4/2, statements 6/2, arms 2/0 }` derived by hand (Node lists no branch for a function V8 never entered); refusal rows for `unloaded-hits`, the seven `*-missing` rows of an emptied executable record, `statement-unproven` on a type-only record, `unrepresented-source` | A merge that depends on order, a duplicate snapshot summed twice, a never-loaded file dropped or emptied, a type-only file given records, an unloaded file with hits, equating native and syntax denominators | Same |
| 07-05-T3 | 32 control labels in order and the closing count as the runner's whole stdout; each offender's rows as literals (spans counted out of the fixture text; the foreign bundle's first row plus a rule for the rest); the runner's own failure messages as regexes per defect; workspace directories before and after a failed run | An always-passing validator, a wrong kind, an unparsable row, a signal, a bare exit 1, a pipeline exiting 0 without a bundle, a control order silently changed, a workspace left behind | Same |

Partial/zero/error paths recorded: partial merged counters (1 and 2 from 1/0 and 0/2), zero-hit imported function, zero-execution model with an absent else, empty type-only record, one uncovered statement and 20 uncovered arms on the real population, `capture` rows carrying `tests-failed` and `interrupted-worker,missing-capture`, 28 readback refusals, 4 republished-content refusals, 6 snapshot-request refusals, launch/signal/unparsable/always-pass/silent harness defects.

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64; npm 11.19.1. CI's Node 24 has not been exercised by this plan.
- Final file digests (sha256, first 16): `scripts/coverage-unit.mjs` `6a9fcab0f7f87ed3`, `scripts/coverage-unit.negative.mjs` `b8f5efa190e98074`, `scripts/coverage-capture.mjs` `f5786483140575c6`, `scripts/coverage-capture.manifest.mjs` `7292c20b46f741cf`, `scripts/coverage-producer.mjs` `335165b8ad637536`, `scripts/coverage-producer.convert.mjs` `28109d6802aaa61e`, `scripts/coverage-source-map.mjs` `c519451726908f32`, `scripts/coverage-correspondence.mjs` `8c3c2cd2fa67f08a`, `scripts/coverage-validate.mjs` `8b359043ac198afd`, `tests/scripts/coverage-unit.test.ts` `cb76ad019dd3e687`, `tests/scripts/coverage-unit.negative.test.ts` `9db428c940b7761c`, `tests/scripts/coverage-unit-fixtures.ts` `54398204d12ebcb6`, `tests/scripts/coverage-projection.ts` `cfba0dd65b8e7e3b`, `tests/scripts/coverage-producer.test.ts` `0f783ac87c1162d3`, `tests/scripts/coverage-source-map.test.ts` `eb1aba8bbcb798f7`.
- Real-population accepted bundle `20260918T151045032Z-99cf68ec`: captured manifest `41a955234668b581`, map `8944a4fff7b563ad`, validation receipt `5aee18b469c46716`, LCOV `5b01f9bd2b1dba51`, inventory `7cb99a72f3d26e29`, invocation `80087ad523fb89aa`; producer payload `29377dc2bb113e40` (1.0.6-project.1), adapter `28109d6802aaa61e`; acceptance tooling digests equal the final file digests above (`coverage-syntax.mjs` `9f29639eb6aa0890`, `coverage-schema.mjs` `8e6bac135366b1d3` unchanged from 07-04).
- The adapter (`coverage-producer.convert.mjs`) changed twice here (merger export, path order), so `npm run coverage:producer:check` was rerun each time: 28/28 at the final bytes. The producer identity receipt of every run records the adapter digest in force.
- No dependency added or changed.

## Real-population measurement (evidence, not certification)

The accepted bundle on this snapshot: 309 workers, 539 raw snapshots, 610 modules loaded, 239 production sources (230 loaded, 9 unloaded: `bridges/agents/types.ts`, `bridges/commands/types.ts`, `bridges/hooks/exec-result.ts`, `bridges/mcp/types.ts`, `bridges/skills/types.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/import/types.ts` type-only; `orchestrators/types.ts` executable with no construct, because `import { type ContentReason } from "../shared/notification-types.ts"` strips to an empty import that still loads its module). Native: 230 records, 63825/63825 lines, 1890/1890 functions, 9234/9234 branches (D-01 holds). Syntax model: 239 files, 1865/1865 functions, 10392/10393 statements, 6633/6653 branch arms. The 21 syntax deficits are reported here for 07-07, not resolved: the one statement is `throw err;` at `bridges/commands/discover.ts:289` (the arm 0 of the `if` at 288:4), and the 20 remaining arms are all implicit-else arms of `if` statements whose condition was never false (`notification-grammar.ts:171`, `reconcile/apply.ts:618`, `update-swap.ts:318/328/338`, `update-flow.ts:583`, `reinstall-record.ts:78`, `install-outcome.ts:991`, `plugin/info.ts:304/1602/1622`, `clone-cache.ts:331`, `marketplace/autoupdate.ts:528`, `marketplace/add.ts:734`, `plugin-browser.ts:309/392`, `domain/source.ts:181`, `skills/stage.ts:391`, `hooks/spawn-helpers.ts:113`). Native branches count V8 block ranges and do not model an implicit else, which is why the two denominators disagree and are kept apart (D-07). The tree changed during this plan (its own scripts and tests are part of the inventory), so this is a working measurement, not the stable certification 07-07 owns.

## Files Created/Modified

- `scripts/coverage-unit.mjs` - `npm run coverage:unit:verified`: capture, snapshot request, conversion, validation, population and denominators, acceptance record, publication order, readback, all-or-nothing public artifacts
- `scripts/coverage-unit.negative.mjs` - `npm run coverage:unit:negative`: 32 controls with `--pipeline`/`--validator` seams
- `scripts/coverage-capture.mjs` - `unloaded` records (executed text of never-loaded production sources), `unstrippable-source` failure
- `scripts/coverage-capture.manifest.mjs` - `PUBLIC_ISTANBUL_PATH`, `PUBLIC_VALIDATION_PATH`, `acceptanceToolingIdentity`, `malformed-manifest`, accepted-state readback (`accepted.json` byte equality, acceptance tooling, acceptance artifact digests), `populationFailures` (`unrepresented-source`, `duplicate-record`)
- `scripts/coverage-producer.mjs` - snapshot request form, `unknown-snapshot`, `duplicate-snapshot`, `stale-snapshot`, `duplicate-script`, `unobserved-module`, `unexpected-record`, zero-execution model
- `scripts/coverage-producer.convert.mjs` - `createCoverageMerger`, files in path order
- `scripts/coverage-source-map.mjs` - `recordedModule` serves loaded and unloaded records with `loaded`; the strip proof admits U+0020, U+00A0, U+2002, U+FEFF
- `scripts/coverage-correspondence.mjs` - `classifySyntax` (type-only when the stripped program has no statement)
- `scripts/coverage-validate.mjs` - candidate mode (07-04) plus `unloaded-hits`; consumer mode for accepted bundles (`producer-changed`, full re-validation, `receipt-mismatch`); usage error for `--map`/`--receipt` on an accepted bundle
- `tests/scripts/coverage-unit-fixtures.ts` - the four-source population with hand-written expectations
- `tests/scripts/coverage-projection.ts` - `projectCoverage`, `expectedCoverage`, `spanKey`, `compareSpans`
- `tests/scripts/coverage-unit.test.ts` - 18 controls
- `tests/scripts/coverage-unit.negative.test.ts` - 9 controls
- `tests/scripts/coverage-producer.test.ts` - 10 snapshot-request controls; imports the shared projection
- `tests/scripts/coverage-source-map.test.ts` - the same-length blanks control
- `package.json` - `coverage:unit:verified`, `coverage:unit:negative`; the normal `test`/`check` path is unchanged until 07-08

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The capture records every unloaded production source**

- **Found during:** Task 1 design
- **Issue:** the plan's first truth ("every production source is represented, including unloaded runtime files") cannot hold from loads alone: a source no test imports leaves no executed text anywhere, and a consumer stripping it itself would print the runtime's ExperimentalWarning into every readback and re-derive under whatever Node happens to run
- **Fix:** `coverage-capture.mjs` strips the inventory snapshot of each unloaded production source in the capture process, stores it content-addressed and records `{ path, source, executed }` under `unloaded`; `recordedModule` serves those records; `verifyCaptureBundle` requires the union to cover the inventoried production set
- **Files modified:** `scripts/coverage-capture.mjs`, `scripts/coverage-source-map.mjs` (outside the plan's list), `scripts/coverage-capture.manifest.mjs`
- **Verification:** population controls, `unrepresented-source` control, real run with 9 unloaded records
- **Committed in:** `691e7841`

**2. [Rule 2 - Missing Critical] `coverage:validate` learned the accepted state**

- **Found during:** Task 1
- **Issue:** the plan names `coverage:validate` without arguments as the consumer of the published manifest/map; the CLI 07-04 created after the plan was written only accepted candidates and would have deleted the bundle's receipt on every readback
- **Fix:** the state of the public pointer selects the mode; the accepted mode is read-only, checks the producer identity, re-validates and compares receipts; the candidate mode gains the `unloaded-hits` rule
- **Files modified:** `scripts/coverage-validate.mjs` (outside the plan's list)
- **Committed in:** `691e7841`

**3. [Rule 1 - Bug] The strip proof refused two- and three-byte blanks**

- **Found during:** the first full-population run
- **Issue:** Node's strip mode writes a blank of the same UTF-8 length for every removed character (U+00A0 for two bytes, U+2002 for three), and the proof admitted only U+0020 and U+FEFF, so `domain/auth-registry.ts` (a `§` inside a removed interface's comment) refused the entire conversion
- **Fix:** the proof admits the four blanks; a control strips one character of each length and checks Node's output against the rule
- **Files modified:** `scripts/coverage-source-map.mjs`, `tests/scripts/coverage-source-map.test.ts` (outside the plan's list)
- **Verification:** 28/28 source-map controls; the real population converts
- **Committed in:** `77d8920f`

**4. [Rule 3 - Blocking] The adapter exports a merger and orders files**

- **Found during:** Task 1 (streaming conversion) and Task 2 (RED)
- **Issue:** merging snapshot by snapshot needs Istanbul's merger as an object the CLI can feed, and the merged map's file order followed the first snapshot read, so the same run converted from reversed snapshots gave different bytes
- **Fix:** `createCoverageMerger` in `coverage-producer.convert.mjs`, `toJSON` in path order
- **Files modified:** `scripts/coverage-producer.convert.mjs` (outside the plan's list)
- **Committed in:** `691e7841`, `5916a7fd`

**5. [Structure] Shared projection and population fixture modules**

- **Found during:** Task 1 and Task 2
- **Issue:** the producer test's private projection helpers were needed by the new controls (a copy would trip fallow's duplicate gate), and the four-source fixture follows the sibling-module pattern of the earlier corpora
- **Fix:** `tests/scripts/coverage-projection.ts` (the producer test imports it) and `tests/scripts/coverage-unit-fixtures.ts`
- **Committed in:** `c7a3a1d2`, `c74dab78`

---

**Total deviations:** 5 (2 missing critical, 1 bug, 1 blocking, 1 structural). The seven files touched outside the plan's list are recorded in `.planning/WINDOWS.md` as `deviation` rows 49 to 55.
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened; `maxCrap: 0` stays disabled; no production export or extension code changed; the 07-04 receipt shape and every earlier assertion contract are unchanged.

## Issues Encountered

- The capture CLI prints its rows as pretty JSON (pinned by thirteen 07-01 controls), while every later tool prints one row per line. `coverage-unit.mjs` therefore reads a refused capture's failures from the manifest of the one run directory the capture created rather than parsing its stderr.
- An empty `NODE_V8_COVERAGE` in the environment makes a native `--experimental-test-coverage` run exit 1 after printing its report; the negative runner's integration reference run deletes the variable instead of blanking it. The capture is unaffected because it sets the destination explicitly.
- Node lists no LCOV branch for a function V8 never entered, so `idle.ts` contributes one native branch (the module root), not two; the population expectation was corrected with that mechanism written beside it.
- The failure order of an interrupted worker is `tests-failed, interrupted-worker, missing-capture` (outcome before reconciliation); the negative runner pins that order.

## Known limits

- A working measurement, not a certified one: the inventory includes `scripts/**` and `tests/**`, which this plan changed between runs, so the accepted bundle describes this snapshot only. 07-07 owns the stable measurement and the 21 syntax deficits listed above.
- The `orchestrators/types.ts` finding (a value import kept for its side effect in a module meant to be type-only) is reported as an unloaded executable source with no construct; whether to make it `import type` is a source repair for a bounded later plan, not this one.
- `map-mismatch` between snapshots of one module is unreachable by construction (every snapshot is converted from the run's one recorded executed text), so no such row exists; the merged map is revalidated against that text instead.
- The consumer mode compares receipts as canonical JSON; a validator tooling change shows up as `receipt-mismatch` (fields `tooling`) and, first, as `tool-changed` with `stage: "acceptance"` from the bundle readback.
- `foreign-run-bundle` asserts the first row exactly and requires every further row to be `missing-artifact` under the foreign run prefix, because the rest of that list depends on the foreign run's store digests.
- The runner's stand-in tests take about 43 s (one faithful run of 32 controls plus seven early-failing defective runs); the eight coverage suites take 38 s together.
- Run directories are not pruned automatically: the accepted run is 804 MB under gitignored `coverage/runs/`; the refused first run (798 MB) was removed by hand after its evidence was recorded, and 07-01's run directory was left in place.
- Verified on Node v26.8.2 and npm 11.19.1; the full `npm run check` chain was not run here (phase-close gate, 07-08); typecheck, lint, format, fallow, direct coverage and the type-member gates ran through pre-commit on every commit.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: file-write | scripts/coverage-unit.mjs | Writes `coverage/unit.istanbul.json`, `coverage/unit.validation.json` and `coverage/unit.manifest.json` atomically under the root and removes all four public files on any refusal; every path is derived from the root and the run prefix. |
| threat_flag: subprocess | scripts/coverage-unit.mjs, scripts/coverage-unit.negative.mjs | Spawn the sibling scripts under `process.execPath` with argv arrays (no shell); a launch failure, a signal and a refusal are three different rows, and the negative runner's stand-in seams accept any executable path by design. |

## Next Phase Readiness

- 07-06 can read the accepted bundle (`coverage/unit.manifest.json`, `state: "accepted"`) and consume `coverage/unit.istanbul.json` after `npm run coverage:validate` exits 0; `acceptance.population.unloaded` and `acceptance.denominators` tell it which files carry zero-execution models and how the native and syntax counts differ.
- 07-07 has the deficit list above to investigate and `npm run coverage:unit:verified && npm run coverage:validate` as its two commands.
- 07-08 wires `coverage:unit:verified`, `coverage:validate` and `coverage:unit:negative` into `check` and CI; the tools are inert on import and take `--root` for fixtures.
- Repository state: seven code commits on `features/test-backlog`; `.planning/WINDOWS.md` gained seven deviation rows (committed with this file); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-18*

## Self-Check: PASSED

All six created files exist on disk and all seven commits (c7a3a1d2, 691e7841, c74dab78, 5916a7fd, 970feb66, 77f111bf, 77d8920f) are in `git log`; `commits: 7` was measured as `git rev-list --count 55fad38f..HEAD`.

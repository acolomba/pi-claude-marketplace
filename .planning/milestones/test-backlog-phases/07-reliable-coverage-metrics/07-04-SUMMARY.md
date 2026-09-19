---
phase: 07-reliable-coverage-metrics
plan: "04"
subsystem: testing
tags: [coverage, istanbul, acorn, ast, schema, correspondence, fallow, receipt, sha256]

# Dependency graph
requires:
  - phase: 07-01
    provides: "capture run bundles (content-addressed sources/ and executed/ stores, inventory, manifest) and verifyCaptureBundle readback"
  - phase: 07-02
    provides: "the qualified producer and its fixture corpus conventions (spanOf/prefixOf, absent implicit-else location)"
  - phase: 07-03
    provides: "executedSourceMap, openCaptureRun, recordedModule, positionFailures and the run request form of the producer CLI"
provides:
  - "scripts/coverage-syntax.mjs: the shared AST primitives (fresh Acorn parse, child-node walk, newline-only line model, one definition of a function's decl/body spans) that name restoration and the correspondence inventory both read"
  - "scripts/coverage-correspondence.mjs: syntaxInventory (versioned coverage syntax model 1 over executed JavaScript: functions with decl/loc and node offsets, statements, branches with flattened logical chains and the absent implicit else) and correspondenceFailures (function/statement/branch -missing, -duplicate, -unproven rows keyed by exact spans only)"
  - "scripts/coverage-schema.mjs: fileFailures (exact file/record/location/position key sets, typed fields, map/counter key equality, finite nonnegative integer hits, branch arity per pinned type, concrete positions, absent location only as an if's second location) and mapFiles (absolute canonical contained keys equal to their record's path, no two keys naming one file)"
  - "scripts/coverage-validate.mjs (`npm run coverage:validate [--root] [--map] [--receipt]`): the fail-closed operation over a published capture bundle that writes coverage/unit.validation.json only for an accepted map and removes any earlier receipt first"
  - "tests/scripts/coverage-correspondence.test.ts (13), coverage-schema.test.ts (29), coverage-validation.test.ts (17) with coverage-correspondence-fixtures.ts (twins fixture) and coverage-run-support.ts (capture-and-convert, map publishing, installed-Fallow helpers)"
affects: [07-05, 07-06, 07-07, 07-08]

# Actuals (#2632) -- chars/4 over the realized diff (110073 chars, 11 files, +3020/-85), never a harness token count.
actuals:
  tokens: 27500
  tasks: 3
  commits: 7
plan_head_before: 89c504850baac4bc68e039a87aedf1a775846c19

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identity by exact span: two coverage records are the same construct only when their decl/loc (functions), loc (statements) or type/loc/locations (branches) are equal; names, hit counts, ratios and nearby positions never take part, so a dropped twin is missing even when its namesake sits beside it"
    - "Inventory from syntax alone: the expected functions, statements and branches come from a fresh parse of the executed text under a versioned model, never from the producer's output; the V8 script root is left as runtime evidence by node offsets rather than counted as a declared function"
    - "Schema before consumer: Fallow's tolerant parser clamps a negative position, scores zero-filled coordinates and estimates a function no record matches, so a map is accepted only after the strict schema and the correspondence pass; a Fallow run is evidence of consumption, never of validity"
    - "Implicit else is one exact form in one exact slot: both positions without coordinates (`{}` on readback, `{line: undefined, column: undefined}` in memory), admitted only as the second location of an `if`, and only when the syntax declares that `if` without an alternate"
    - "Acceptance receipt bound to bytes: run id, public-manifest digest, map-bytes digest, per-module source/executed digests, schema and syntax versions, validator-script digests and runtime; removed before every validation so a refusal leaves no earlier acceptance behind"
    - "Exit codes discriminate: refusal is 1 with `{ kind, ... }` rows on stderr, usage/setup failure is 2 with no row, a launch failure carries no row; every control asserts status and rows as one value"

key-files:
  created:
    - scripts/coverage-syntax.mjs
    - scripts/coverage-correspondence.mjs
    - scripts/coverage-schema.mjs
    - scripts/coverage-validate.mjs
    - tests/scripts/coverage-correspondence.test.ts
    - tests/scripts/coverage-correspondence-fixtures.ts
    - tests/scripts/coverage-schema.test.ts
    - tests/scripts/coverage-validation.test.ts
    - tests/scripts/coverage-run-support.ts
  modified:
    - scripts/coverage-source-map.mjs
    - package.json

key-decisions:
  - "Correspondence is a bijection on exact spans per record kind; a hit count or a name is never consulted, and the syntax model (version 1) lists the constructs and the span the producer reports for each, so a producer change is a model change"
  - "The schema module imports positionFailures from coverage-source-map.mjs rather than restating the concrete-position rules, and adds the narrower absent-location policy on top; branch arity per type (if 2, cond-expr 2, default-arg 1, binary-expr >= 2, switch >= 1) is pinned as producer schema"
  - "A map key must be absolute and normalized and equal to its record's path; a relative key is `path-not-canonical`, a key outside the root is `foreign-path`, and a second key resolving to an already-seen file is `duplicate-file` against the first, so the validator can never silently overwrite one file's record with another's"
  - "The validator writes its receipt only on acceptance and deletes any receipt before starting; `--map` and `--receipt` resolve against `--root`; a root that is not a directory is a usage error, not a refusal"
  - "The installed Fallow (3.23.0, the lockfile's resolution) is exercised in report-only mode with a CRAP ceiling of 1 so every function is listed with its `coverage_source`; the controls pin that it consumes the implicit else, a negative column and a dropped callback alike, which is the reason the schema is the gate"
  - "The `malformed-json` row carries the repository path only, not the parser's message text, so the row is deterministic across Node versions"
  - "Commit scopes follow the repository's Conventional Commits rule (`test(coverage)`, `feat(coverage)`, `refactor(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "A library module needs a static consumer for fallow: coverage-schema.mjs was wired into the validator CLI in the same commit that created it, and the CLI prints the schema version it applied so the version constant has a consumer too"
  - "Support helpers shared by several control files (capturedConversion, writeMap, fallowHealth) live in coverage-run-support.ts; each test file keeps only the shapes it asserts"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A map converted from a captured module whose two nested callbacks share a name, a hit count and a statement hit ratio, and a manually authored exact map of the same module, both pass the correspondence check; dropping either callback, one of its statements or its if branch is reported at the exact spans, and an invented or duplicated record is unproven or duplicated whatever its name or count"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#accepts the converted map of a captured module whose twin callbacks share a name, a hit count and a statement ratio"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#accepts a manually authored exact map"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#inventories every function, statement and branch of the executed text at syntax version 1"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects a map missing the first check callback while its twin remains"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects a map missing the never-taken return of the first callback"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects a map missing the twice-run declarator of the first callback"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects a map missing the if branch inside the first callback"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects records the source does not declare instead of matching a nearby one"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects two records for one declared function"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#leaves the V8 script root as runtime evidence rather than a declared function"
        status: pass
    human_judgment: false
  - id: D2
    description: "The strict schema accepts the converted map on readback and in the producer's in-memory absent form, keeps the implicit else as a location without coordinates that the installed Fallow consumes with the expected per-function coverage, and refuses a negative column (which Fallow clamps), zero coordinates in the else slot, an absent location anywhere else, a half-absent location, mismatched counter keys, negative/fractional/null/string hits, wrong branch counter or location counts, an unknown branch type, and unknown or missing keys at every level"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#accepts the converted map of a captured module on readback and its in-memory absent form"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#keeps the implicit else as a location without coordinates that the installed Fallow consumes"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses a negative column that the installed Fallow consumes as a matched map"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses an if branch carrying zero coordinates in place of the absent else"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses an if branch carrying an absent location where the if statement belongs"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses an if branch carrying a location whose start alone is absent"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses an absent location in a branch that is not an if"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses counters whose keys differ from their map"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses a branch type the pinned producer does not emit"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects an if branch whose absent else is replaced by zero coordinates"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-correspondence.test.ts#rejects an if branch whose absent else is replaced by the span of the consequent"
        status: pass
    human_judgment: false
  - id: D3
    description: "Map keys are canonical contained paths: a key naming another file than its record, a relative key, a key outside the root and two keys resolving to one file are each refused with their own row, and a map or record that is not an object is malformed"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#keys every canonical contained file of a map by its repository path"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses a map whose key names another file than its record"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses a file outside the root and a relative key"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-schema.test.ts#refuses two keys that resolve to one file"
        status: pass
    human_judgment: false
  - id: D4
    description: "`npm run coverage:validate` accepts the complete converted map of a captured fixture root and writes a receipt whose digests bind the run manifest, the map bytes, the module stores and the validator scripts; it refuses, with exit 1 and the exact row, a dropped callback (which the installed Fallow scores from an estimate instead of refusing), a dropped statement, mismatched counters, a file outside the root, a file named twice, a file the run did not inventory, an empty map, a source edited after the capture, a changed capture tooling digest, a map that is not JSON and a missing map; it removes an earlier receipt on refusal; usage and setup failures exit 2 without a row and a launch failure carries no row"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#accepts the converted map of a captured fixture root"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#writes an acceptance receipt bound to the run, the map bytes and the validator bytes"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#refuses a map whose first check callback was dropped, which the installed Fallow scores from an estimate"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#refuses a map whose never-taken return statement was dropped, naming its exact span"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#refuses a source that changed after the capture instead of relocating its records"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#refuses a run whose capture tooling digests changed"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#removes the acceptance receipt of an earlier run when the map is refused"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-validation.test.ts#distinguishes a launch failure from a refusal by the absence of rows"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 45m
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 04: Independent Function/Statement Correspondence and Strict Schemas Summary

**A coverage map is now accepted only when a fresh AST inventory of the executed text finds every function, statement and branch at exactly its span and nothing else, the map has exactly the producer's shape with concrete positions and an absent location only where an `if` has no `else`, its keys are canonical contained paths, and the run it names is current; `coverage:validate` performs that operation as a process and writes a receipt bound to the digests of every input**

## Performance

- **Duration:** 1h 45m across two executors: Task 1 (2026-09-17, about 40 min, commits 16:37 and 16:55 local) by the previous executor, which was terminated by a provider rate limit (HTTP 429) while preparing Task 2; Tasks 2 and 3 plus the inherited refactor (2026-09-18 12:05 to 13:05 UTC) by this continuation. Five pre-commit pipeline runs of about 7 minutes each.
- **Started:** 2026-09-17T20:20Z (approximate; first commit 20:37:03Z)
- **Completed:** 2026-09-18T13:05Z
- **Tasks:** 3 (each RED then GREEN) plus one inherited refactor commit
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- **Correspondence is exact and independent.** `syntaxInventory` parses the executed JavaScript afresh and lists, under coverage syntax model 1, every function (decl and body spans as the producer reports them, plus node offsets), every statement of the adopted Istanbul model (including declarator initializers, class field values and arrow expression bodies) and every branch (an `if` with its absent implicit else, ternaries, whole logical chains with nested operands flattened, switches, default arguments). `correspondenceFailures` keys records by span alone: the twins fixture has two callbacks both named `check`, both run twice, both executing three of four statements, and dropping the first is `function-missing` at its decl and loc while the twin remains; a record at a shifted span is `function-unproven`, a repeated record is `function-duplicate`. The V8 script root (offsets 0 to the text length) is set apart by node offsets rather than counted.
- **The schema, not Fallow, is the gate.** `fileFailures` requires exactly `{ path, statementMap, fnMap, branchMap, s, f, b }`, `{ name, decl, loc, line }` per function, `{ type, loc, locations, line }` per branch, `{ start, end }` per location and only `line`/`column` per position; map and counter key sets equal; hits finite nonnegative integers; one counter per branch location with the arity of the pinned type; every position concrete inside the source (through `positionFailures`); and an absent location only as the second location of an `if`. The installed Fallow 3.23.0 was run on the same maps: it reports the complete twins map as 4 matched functions at 80/75/80/75 percent, and it reports a map with a negative column identically (4 matched), so its parse proves nothing about validity.
- **The implicit else is one exact form in one exact slot.** The converted map carries `{ start: {}, end: {} }` as the second location of each `if`, the producer's in-memory form carries `undefined` coordinates, and both are accepted; zero coordinates in that slot are a `position` row, an absent location as the first location or in a `binary-expr` is an `absent-location` row, a half-absent location is a `position` row, and the correspondence rejects an `if` whose absent else is replaced by zeros or by the consequent's own span as `branch-missing` plus `branch-unproven`.
- **`coverage:validate` is a fail-closed process with a receipt.** It reads the bundle back through `verifyCaptureBundle`, opens the run, requires the map to name by canonical contained paths exactly the production sources the run inventoried, re-proves each record against the run's own immutable source and executed text (strip proof, schema, correspondence), and refuses with exit 1 and one row per finding. On acceptance it writes `coverage/unit.validation.json`: run id, public-manifest digest, map-bytes digest, per-module source/executed digests, `model: { coverageSchema: 1, syntax: 1 }`, the digests of the five validator scripts and the runtime. Any earlier receipt is removed before validation begins. Usage and setup failures (unknown option, root not a directory) exit 2 with no row.

## Task Commits

1. **Task 1: Reject a missing nested function and its body statements independently** (tracer, previous executor) - `763ee1de` (test: twins fixture, run support, 11 correspondence controls) then `0b80e535` (feat: `coverage-correspondence.mjs`, first `coverage-validate.mjs` and its two controls, `coverage:validate` alias)
2. **Inherited refactor** - `d9201d31` (refactor: `coverage-syntax.mjs` shared by the source-map and correspondence walkers; see Deviations)
3. **Task 2: Validate report schema, paths, counters and exact implicit-else semantics** - `e3d6ef7e` (test, RED: `RED_EVIDENCE_OK`, target `refuses a negative column that the installed Fallow consumes as a matched map` failed with `ERR_MODULE_NOT_FOUND` for `scripts/coverage-schema.mjs`; 29 of 42 failed) then `6ef1ad63` (feat, GREEN: 44/44 with the two validation controls)
4. **Task 3: Make the validator a real fail-closed CLI operation** - `c13b9cfe` (test, RED: `RED_EVIDENCE_OK`, target `writes an acceptance receipt bound to the run, the map bytes and the validator bytes` failed on `deepStrictEqual(undefined, {...})`; 6 of 59 failed) then `c0bb8b93` (feat, GREEN: 59/59)

**Plan metadata:** the `docs:` commit that adds this file and the three ledger rows.

Tracer feedback gate (Task 1): the previous executor's Task 1 GREEN was verified by the orchestrator (37/37 across the correspondence and source-map suites on the interrupted tree) and this continuation re-ran `node --test tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-validation.test.ts tests/scripts/coverage-producer.test.ts` before touching anything: 57 pass, 0 fail. Expansion continued without a checkpoint (`human_verify_mode: end-of-phase`, automated-only verify).

## TDD Gate Compliance

- Each task has a `test(coverage)` commit preceding its `feat(coverage)` commit. The Task 2 and Task 3 RED records were classified `RED_EVIDENCE_OK` (`target_test_failed`) with `gsd-tools check tdd-red-evidence` before implementation; Task 1's RED/GREEN pair was verified by the orchestrator before this continuation started.
- Task 2's RED target failed on the missing module rather than on a value assertion: the schema module did not exist, so no assertion could be reached. Three Task 2 controls were already green at RED and pin behaviour that existed: the Fallow-consumption control needs no new code, and the two correspondence controls for a replaced implicit else were already refused by the Task 1 keys.
- Task 3's RED had 6 failing controls out of 17; the other 11 CLI controls (dropped statement, counters, foreign path, duplicate, unlisted, empty map, stale source, tool change and the two usage/launch controls) were already green because the Task 1 CLI and the Task 2 schema wiring covered them. They pin that behaviour; none was weakened.
- Commit scopes are `coverage`, per the repository's Conventional Commits rule, so the generic `test(07-04)`/`feat(07-04)` grep finds nothing by design. One `refactor(coverage)` commit exists (the inherited extraction), verified against 57 controls before committing.

## Exact commands and results

| Command | Result |
| --- | --- |
| `node --test tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-validation.test.ts tests/scripts/coverage-producer.test.ts` (on the inherited uncommitted refactor, before any edit) | 57 pass, 0 fail (9.1 s) |
| `node --test --test-reporter=tap tests/scripts/coverage-schema.test.ts tests/scripts/coverage-correspondence.test.ts` (Task 2 RED) | exit 1; 42 tests, 13 pass, 29 fail; every failing case is a schema case; `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-schema.test.ts tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-validation.test.ts` (Task 2 GREEN) | 44 pass, 0 fail |
| `node --test --test-reporter=tap tests/scripts/coverage-validation.test.ts tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-schema.test.ts` (Task 3 RED) | exit 1; 59 tests, 53 pass, 6 fail (stdout line, receipt, receipt removal, `malformed-json` row, relative `--map`, root-not-directory exit); `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-validation.test.ts tests/scripts/coverage-correspondence.test.ts tests/scripts/coverage-schema.test.ts` (Task 3 verify) | 59 pass, 0 fail (25.0 s) |
| `node --test tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-producer.test.ts` (after the GREEN) | 45 pass, 0 fail |
| installed Fallow probe: `fallow health --root <fixture> --coverage <map> --format json --no-cache --report-only --max-crap 1` on the complete twins map / dropped first callback / negative column / zero-filled else | complete: 4 of 5 matched, twins.ts functions 80/75/80/75 `istanbul`; dropped: 3 matched, the dropped `check` is `estimated` with no `coverage_pct`; negative column: 4 matched; zero-filled else: 4 matched; exit 0 every time |
| `SKIP=trufflehog pre-commit run --files ...` (five runs: refactor, Task 2 RED, Task 2 GREEN, Task 3 RED, Task 3 GREEN) + trufflehog filesystem scan of each set | every hook passed on every set (lint, format, typecheck, fallow dead-code/cycles/health/dupes, direct coverage, type members); 0 verified / 0 unverified secrets |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-04-T1 | Twins fixture written from the source text: 4 functions, 10 statements and 4 branches with spans named by unique snippets and hits from V8 block semantics; the manual map built from those expectations passes; the dropped callback's exact decl/loc, the dropped statement's loc and the dropped branch's type/loc/locations are literal rows; the V8 root is `{ 0, text.length, count 1 }` | Equal counts (3 vs 3 after a drop and a fill), 100% AST hits, nearest-name or nearest-line lookup (both callbacks are `check`, both hit 2, both 3/4 statements), function-entry recovery without body statements | No production exclusion, native threshold, direct pin or existing assertion changed; `maxCrap: 0` stays disabled |
| 07-04-T2 | Per-function Fallow percentages 80/75/80/75 derived by hand from the fixture's statements inside each body; the absent else as `{ start: {}, end: {} }` literal; one literal row per malformed variant (position, absent-location, counter-keys, hit, branch-cardinality, branch-type, schema-key, schema-type, path-mismatch, path-not-canonical, foreign-path, duplicate-file, malformed-map, malformed-file) | Fallow parse success as validation (it consumes the negative column and the zero-filled else), zero-filling the implicit else, an absent location in a `cond-expr` or first `if` slot passing as an implicit else, counters that ignore a dropped key, a branch with one counter for two locations, an unknown key riding along | Same |
| 07-04-T3 | Receipt compared whole against digests the test computes itself (sha256 of the public manifest bytes, the map bytes, the five validator scripts) plus the run's own module digests; each refusal asserted as `{ status, rows }` with literal rows; `stale-input` names exactly the edited source; `tool-changed` after rewriting one capture digest in both manifests; exit 2 with no row for usage/setup; exit 1 with no row for a launch failure | Process failure alone as detection (the launch control has status 1 and no row), a receipt that does not cover map or tool bytes, a stale receipt surviving a refusal, a relocated record after a source edit, Fallow's silent estimate for the dropped callback | Same |

Partial/zero/error paths recorded: partially executed callback bodies (3 of 4 statements, twice), never-taken `return`s (0 hits) beside twice-run declarators, short-circuited `binary-expr` operands (`[1, 0]`), absent implicit else with counters `[0, 2]`, an empty map, a map with a foreign key and no production file, a map that is not JSON, a missing map, a launch failure, two usage errors, and 29 schema refusals.

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64; npm 11.19.1. Fallow: 3.23.0 as installed and resolved by `package-lock.json` (the research document describes 3.22.0; the consumer behaviour recorded here is the installed 3.23.0's).
- File digests at the final code commit (sha256, first 16): `scripts/coverage-syntax.mjs` `9f29639eb6aa0890`, `scripts/coverage-correspondence.mjs` `93ae8d723df594a7`, `scripts/coverage-schema.mjs` `8e6bac135366b1d3`, `scripts/coverage-validate.mjs` `41f23b3b76920495`, `scripts/coverage-source-map.mjs` `0ca11426d80e1f25`, `tests/scripts/coverage-correspondence.test.ts` `ecfb853e7fc7c2d6`, `tests/scripts/coverage-correspondence-fixtures.ts` `b96d12a646523591`, `tests/scripts/coverage-schema.test.ts` `b099fc7394045983`, `tests/scripts/coverage-validation.test.ts` `b1459f808526eccb`, `tests/scripts/coverage-run-support.ts` `cd05ab625f236430`.
- The validator receipt binds the full digests of the five validator scripts at run time; the producer identity receipt of 07-02 is a separate record. `scripts/coverage-source-map.mjs` changed here (the walker extraction), so 07-05 must embed its new digest wherever it records tooling; `scripts/coverage-producer.convert.mjs` and the producer delivery are untouched.
- No dependency added or changed.

## Files Created/Modified

- `scripts/coverage-syntax.mjs` - parseExecuted, childNodes, lineStartsOf, locate, declaredFunction (decl/body/name/outer)
- `scripts/coverage-correspondence.mjs` - the syntax model, syntaxInventory, correspondenceFailures
- `scripts/coverage-schema.mjs` - the schema model, fileFailures, mapFiles
- `scripts/coverage-validate.mjs` - `npm run coverage:validate`: bundle readback, run identity, population, per-file strip proof + schema + correspondence, receipt, exit codes
- `scripts/coverage-source-map.mjs` - imports the shared primitives instead of carrying its own copies
- `package.json` - `coverage:validate`
- `tests/scripts/coverage-correspondence-fixtures.ts` - the twins fixture with hand-written expectations
- `tests/scripts/coverage-run-support.ts` - createRoot, captureFixture, convertFromRun, capturedConversion, writeMap, fallowHealth, refusalRows and the Istanbul/V8 shapes
- `tests/scripts/coverage-correspondence.test.ts` - 13 controls
- `tests/scripts/coverage-schema.test.ts` - 29 controls
- `tests/scripts/coverage-validation.test.ts` - 17 process controls

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Interruption and continuation

The executor that completed Task 1 was terminated by a provider rate limit (HTTP 429) while preparing Task 2, leaving Task 1's two commits on the branch and an uncommitted refactor in the working tree (`scripts/coverage-syntax.mjs` new; `scripts/coverage-correspondence.mjs` and `scripts/coverage-source-map.mjs` importing from it). This continuation read the three files and their diff, confirmed the extraction is behaviour-preserving (the merged `declaredFunction` returns the union of the two former records, `name` and `outer`; 57/57 across four suites; fallow clean), ran the pipeline on exactly those files and committed it as `d9201d31` before starting Task 2. Nothing from Task 1 was redone.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared AST primitives extracted into `scripts/coverage-syntax.mjs`**

- **Found during:** Task 1 (previous executor, after the GREEN commit)
- **Issue:** `coverage-source-map.mjs` (07-03) and the new `coverage-correspondence.mjs` each carried the same parse, child-node walk, line model and declared-function code; fallow's duplicate and health gates flag the copies, and two definitions of a function's spans could drift apart
- **Fix:** one module holds them; the declared-function record carries both the identifier name (name restoration) and the outer node offsets (correspondence)
- **Files modified:** `scripts/coverage-syntax.mjs` (new), `scripts/coverage-correspondence.mjs`, `scripts/coverage-source-map.mjs` (outside the plan's file list)
- **Verification:** 57/57; `npm run fallow` clean in the pipeline
- **Committed in:** `d9201d31`

**2. [Rule 3 - Blocking] The validator CLI, its controls and the package alias were created in Task 1, and the schema module was wired into the CLI in Task 2**

- **Found during:** Task 1 and Task 2 (fallow dead-code)
- **Issue:** a new `scripts/*.mjs` with no static consumer is an unused file and an export without a static consumer an unused export; the tests reach the libraries through dynamic imports fallow cannot follow. The plan placed the CLI, the alias and the wiring in Task 3
- **Fix:** Task 1's GREEN added `coverage-validate.mjs`, `coverage:validate` and two process controls as the consumer of the correspondence module; Task 2's GREEN imported `fileFailures`/`mapFiles`/`COVERAGE_SCHEMA_VERSION` into the CLI and printed the schema version; Task 3 then added the receipt, exit-code and path semantics and the remaining controls. No suppression marker was added
- **Files modified:** `scripts/coverage-validate.mjs`, `package.json`, `tests/scripts/coverage-validation.test.ts` (all in the plan's list, under a different task)
- **Committed in:** `0b80e535`, `6ef1ad63`

**3. [Structure] Fixtures and shared support live in sibling modules**

- **Found during:** Task 1 (fixtures) and Task 2 (support extensions)
- **Issue:** the plan names only the test files; the twins fixture follows the `coverage-producer-fixtures.ts` pattern, and the capture-and-convert, map publishing and Fallow helpers are shared by three test files (a copy in each would trip fallow's duplicate gate)
- **Fix:** `tests/scripts/coverage-correspondence-fixtures.ts` and `tests/scripts/coverage-run-support.ts`
- **Committed in:** `763ee1de`, `e3d6ef7e`, `c13b9cfe`

**4. [Evidence] Fallow estimates rather than approximately matches**

- **Found during:** Task 3
- **Issue:** the plan expects "a deliberately incomplete map that Fallow would approximately match" (the research observed a nearby-anonymous fallback in 3.22.0). The installed 3.23.0 does not join the dropped `check` callback to its twin or to any neighbour: it reports the function as `coverage_source: "estimated"` with no `coverage_pct`, on the twins fixture and on the nested-logical and unicode fixtures probed by hand
- **Fix:** the control records what the installed consumer does: it consumes the incomplete map with exit 0 and substitutes an estimate, so it does not refuse; the validator refuses with the exact `function-missing` row. Either behaviour would feed a wrong CRAP score silently; the assertion is against the installed version
- **Files modified:** `tests/scripts/coverage-validation.test.ts`
- **Committed in:** `c13b9cfe`

---

**Total deviations:** 4 (2 blocking gate fixes, 1 structural, 1 evidence) plus the interruption. The three that touch files outside the plan's list are recorded in `.planning/WINDOWS.md` as `deviation` rows 46, 47 and 48.
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened; `maxCrap: 0` stays disabled; no production export or extension code changed.

## Issues Encountered

- Fallow's `--max-crap 0` means "disabled" (the repository's own setting), so a probe with it lists no functions; the controls use `--report-only --max-crap 1` to list every function with its `coverage_source`.
- `path.join` normalizes `..`, so the first duplicate-file control produced two equal keys; the detour key is built by string concatenation.
- A required key that is missing was first reported twice (as missing and as the wrong type); the type check now runs only on present fields.

## Known limits

- The syntax model covers the constructs the pinned producer emits for this repository's sources. Class field initializers are statements at their value; class static blocks, labeled-statement bodies and generator/async syntax produce no records of their own beyond the statement and function rules listed in the model, and a construct the producer starts emitting is a model version bump, not a silent acceptance.
- Coverage ignore hints are not part of the model: a construct the syntax declares but a hint suppressed is `*-missing`. None occurs in the extension sources.
- The correspondence proves spans, not counters: a wrong hit count on a present record is outside this plan (the producer corpus of 07-02 covers hits for its fixtures; the merge semantics of 07-05 cover summed counters).
- `mapFiles` compares normalized path strings; a symlinked directory that makes two normalized paths name one inode is not detected. The run's inventory (which the validator requires the map to match exactly) is enumerated from the tree, so such a key would be `unlisted-file`.
- The receipt binds bytes; it does not itself re-verify on read. 07-05 must check a receipt's digests against the artifacts before trusting an acceptance, and must re-run `coverage:validate` whenever any bound input changes.
- The Fallow controls pin the installed 3.23.0; a Fallow upgrade that changes the report shape or the estimate behaviour is a control failure to review, not a validator defect. 07-06 owns the exact consumer join.
- Verified on Node v26.8.2 and npm 11.19.1; CI's Node 24 has not been exercised by this plan. The full `npm run check` chain was not run here (phase-close gate, 07-08); typecheck, lint, format, fallow, direct coverage and the type-member gate ran through pre-commit on every commit.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: file-write | scripts/coverage-validate.mjs | The validator now writes `coverage/unit.validation.json` (or `--receipt`, resolved against `--root`) atomically on acceptance and removes it before every run. The receipt is bound to input digests and is an input to 07-05's accepted manifest, not an authorization to publish. |

## Next Phase Readiness

- 07-05 can import `fileFailures`/`mapFiles` from `scripts/coverage-schema.mjs` and `correspondenceFailures`/`syntaxInventory` from `scripts/coverage-correspondence.mjs`, or run `coverage:validate` as a process; the receipt at `coverage/unit.validation.json` names the digests its accepted manifest must embed, and `syntaxInventory(...).functions[*].offsets` is what 07-05's unloaded-file and type-only classification can use to tell declared functions from V8 roots.
- 07-05's merge must revalidate correspondence after merging workers; the validator accepts one file record per production source and does not itself merge.
- Repository state: seven code commits on `features/test-backlog`; `.planning/WINDOWS.md` gained three deviation rows (committed with this file); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-18*

## Self-Check: PASSED

All nine created files exist on disk and all seven commits (763ee1de, 0b80e535, d9201d31, e3d6ef7e, 6ef1ad63, c13b9cfe, c0bb8b93) are in `git log`; `commits: 7` was measured as `git rev-list --count 89c50485..HEAD`.

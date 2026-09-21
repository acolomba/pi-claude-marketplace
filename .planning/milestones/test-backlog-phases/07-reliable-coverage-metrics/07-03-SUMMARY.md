---
phase: 07-reliable-coverage-metrics
plan: "03"
subsystem: testing
tags: [coverage, istanbul, source-map, sourcemap-codec, acorn, utf-16, strip-types, name-restoration]

# Dependency graph
requires:
  - phase: 07-01
    provides: "capture run bundles: content-addressed sources/ and executed/ stores, module records with digests, tooling and runtime identity in manifest.json"
  - phase: 07-02
    provides: "the qualified producer adapter (loadProducer, convertScripts) and the `coverage:producer` CLI with explicit `{ url, code, sourceMap, coverage }` requests"
provides:
  - "scripts/coverage-source-map.mjs: executedSourceMap (proof that the executed text is a position-preserving strip of the original, then an identity map with every UTF-16 column and the line-length column), openCaptureRun and recordedModule (run/tool/runtime/digest identity), restoreSourceNames (names only from the declaration at the exact decl/loc spans), positionFailures (concrete-position validation)"
  - "scripts/coverage-producer.mjs: run requests `{ run: <manifest.json>, scripts: [{ path, coverage }] }` that read the module from the run's stores; declaration names restored; positions validated in memory and again on the serialized JSON before the atomic write"
  - "tests/scripts/coverage-source-map.test.ts + coverage-source-map-fixtures.ts: 27 controls over three captured fixtures (endpoints, declarations, crlf) plus library rows"
affects: [07-04, 07-05, 07-07, 07-08]

# Actuals (#2632) -- chars/4 over the realized diff (67691 chars), never a harness token count.
actuals:
  tokens: 16900
  tasks: 2
  commits: 4
plan_head_before: 9032848ee3df949266cfc66ab46f39f8b18e0ec6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Executed-source proof before mapping: executed === original, or original.length body + `\\n\\n//# sourceURL=<url>` trailer where every differing body character is a space or the U+FEFF pad of a removed surrogate pair and every line terminator keeps its offset; anything else is a `{ kind }` refusal, never a shifted or clamped coordinate"
    - "Identity map from the original text: one segment per UTF-16 column of every original line plus the line-length column, encoded with @jridgewell/sourcemap-codec; trailer lines have no mapping"
    - "Run identity before mapping: manifest kind/schema/status, run directory equal to coverage/runs/<runId>, capture tooling digests equal to the scripts in use, Node version equal to process.version, and every store entry hashing to the manifest digest"
    - "Names by exact spans: a fresh Acorn parse of the executed text yields (decl, body) spans per declared function; an Istanbul function is renamed only when a declaration sits at exactly its decl and loc, anonymous declarations keep the producer label, an unmatched function is `function-unproven`"
    - "Concrete positions twice: positionFailures runs on the merged map in memory and on JSON.parse of the serialized text; only a branch location with no coordinates at all is admitted (the pinned implicit-else form)"

key-files:
  created:
    - scripts/coverage-source-map.mjs
    - tests/scripts/coverage-source-map.test.ts
    - tests/scripts/coverage-source-map-fixtures.ts
  modified:
    - scripts/coverage-producer.mjs
    - scripts/coverage-producer.convert.mjs

key-decisions:
  - "The explicit request form of 07-02 is kept unchanged as the raw producer-conformance path; only run requests restore names, while position validation applies to both forms"
  - "Position bounds come from the source map's `sourcesContent[0]` keyed by the path the producer files the coverage under (a `file://` source or one resolved against the coverage URL's directory), so the validator needs no second reading of the file"
  - "Line/column coordinates follow the `\\n` line model the producer and Istanbul use; `\\r` is a column of its line, which the CRLF fixture pins"
  - "A computed or literal method key declares no identifier, so such a function keeps the producer's label rather than a name read from a key expression"
  - "SourceMapError is module-private: the CLI maps any non-usage error to exit 1 and prints its rows, and the tests discriminate on `name` and `failures`; an export without a static consumer fails fallow"
  - "Commit scopes follow the repository's Conventional Commits rule (`test(coverage)`, `feat(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "Refusal rows are printed as `  {json}` lines after the message, the same shape loadProducer uses, so a CLI test reads them back with one parser"
  - "Fixture expectations are written from the source text with spanOf/prefixOf/suffixOf; the restored-name expectation for a repeated spelling is the spelling itself at a different span"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A captured module converts from the run's own stores through an exact identity map: two opposite-coverage arrows on one line after a surrogate pair keep distinct UTF-16 columns, bodies and hits, and two bodies ending at the end of their line resolve to the line-length column with no Infinity or null"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#converts the run's recorded module through the exact identity mapping"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#maps every UTF-16 column of every original line to itself, including the line-length column"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a conversion whose endpoints are not finite instead of writing null"
        status: pass
    human_judgment: false
  - id: D2
    description: "An executed text that is not a position-preserving strip of the original is refused: dropped character, moved line boundary, changed non-type character, trailer naming another module; a stored source or executed text that no longer hashes to its digest, a run whose tooling or Node version changed, and a module the run never loaded are refused before any mapping"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses executed text that dropped a character"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses executed text that moved a line boundary"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses executed text that changed a character outside a type"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses executed text whose trailer names another module"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a recorded source whose bytes no longer hash to the manifest digest"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a run whose capture tooling changed"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a run captured under another Node version"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a recorded executed text whose bytes no longer hash to the manifest digest"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a recorded executed text that is not a strip of its source"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a module the run never loaded"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repeated methods, accessors and constructors are renamed only through the declaration at their exact spans, a real `count_2` keeps its name, an arrow keeps its anonymous label, a function whose spans match no declaration is refused instead of matched by name or nearby line, and CRLF/blank-line coordinates stay exact"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#restores each repeated method, accessor and constructor name from its declaration and keeps a real _2 suffix"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#keeps CRLF and blank-line coordinates exact"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#restores a repeated spelling only through the declaration at its exact spans"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#refuses a function whose spans match no declaration instead of taking the nearest name"
        status: pass
      - kind: other
        ref: "node scripts/coverage-producer.mjs on extensions/pi-claude-marketplace/shared/errors.ts from run 20260917T170221887Z-6c0485ba (163 raw records): 36 functions, 16 named `constructor`, 3 anonymous labels, no `_N` suffix, no null"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every location is validated as a concrete position in memory and again on JSON readback: Infinity, the null it becomes, negative, fractional, reversed, past the line or the text, absent outside an implicit-else branch location, and a `line` field that is not the start line are each one failure; finite coordinates with an implicit-else location pass"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports finite coordinates with an implicit-else branch location as 0 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports an Infinity end column as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a null end column read back from JSON as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a negative column as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a fractional line as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a reversed span as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a column past the line length as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a line past the text as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a statement without coordinates as 1 position failure(s)"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-source-map.test.ts#reports a function line field that is not its start line as 1 position failure(s)"
        status: pass
    human_judgment: false

# Metrics
duration: 50min
completed: 2026-09-17
status: complete
---

# Phase 7 Plan 03: Exact Executed-Source Mapping and AST-Proven Identities Summary

**The producer CLI now converts a captured module from the run's own immutable source and executed text through an identity map that proves position preservation and carries every UTF-16 column plus the line-length endpoint; function names come only from the declaration at their exact spans, and every location is checked as a concrete position in memory and on JSON readback before anything is written**

## Performance

- **Duration:** 50 min (four pre-commit pipeline runs of about 7 minutes each)
- **Started:** 2026-09-17T19:24:10Z
- **Completed:** 2026-09-17T20:14Z
- **Tasks:** 2 (each RED then GREEN)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- **Position preservation is proven, not assumed.** `executedSourceMap` accepts an executed text only when it is the original itself (a JavaScript module) or the original's length followed by `\n\n//# sourceURL=<url>`, with every differing body character a space or the U+FEFF pad Node's strip mode writes for the second unit of a removed surrogate pair, and every `\n`/`\r` at its original offset. A dropped character (`executed-length`), a moved terminator (`line-boundary`), a changed non-type character (`transform`, with line, column and both characters) or a trailer naming another module (`executed-trailer`) refuses the module. The map then carries one segment per UTF-16 column of every original line plus the line-length column, so bodies ending at a line end resolve to finite endpoints; lines the trailer adds are unmapped.
- **Run identity gates every mapping.** A run request names `coverage/runs/<runId>/manifest.json`; `openCaptureRun` requires the capture schema/kind, `status: "captured"`, the manifest's own run directory, capture tooling digests equal to the scripts in use (`tool-changed`) and the recorded Node version (`runtime-changed`); `recordedModule` reads `sources/<digest>` and `executed/<digest>` and requires both to hash to the manifest (`stale-source`, `stale-executed`, `missing-artifact`, `module-not-captured`). A module named by several raw records is read and mapped once.
- **Names are source-proven.** A fresh Acorn parse of the executed text lists every declared function with the decl span the producer reports (method key, function id, or first character of an anonymous function or arrow) and its body span. An Istanbul function is renamed only when a declaration sits at exactly its decl and loc: `pick_2`..`pick_5`, `skip_2`, `current_2`, `constructor_2` become `pick`, `skip`, `current`, `constructor`; `count_2` stays `count_2`; `(anonymous_13)` stays; a function whose spans match no declaration is `function-unproven` and the conversion fails. No suffix is stripped and no nearby line is consulted.
- **Positions are validated twice.** `positionFailures` requires integer lines within the text, columns within the line length (the line length itself included), start not after end, and `line` fields equal to the start line; only a branch location with no coordinates at all is admitted, as the producer's implicit-else form. The CLI runs it on the merged map and again on `JSON.parse` of the text it is about to write, so an `Infinity` endpoint is reported as `position` rows (which print as `null`, the value JSON would have stored) and no output file appears.

## Task Commits

1. **Task 1: Convert one captured Unicode same-line function pair exactly** (tracer) - `5d2f35de` (test, RED: `RED_EVIDENCE_OK`, target failed on `assert.strictEqual(conversion.run.status, 0)` with `Request script 0 lacks a string url`) then `b29e38f7` (feat, GREEN: 7/7)
2. **Task 2: Restore original names through exact source declarations and reject drift** - `1f5e3669` (test, RED: `RED_EVIDENCE_OK`, target failed on the names `pick_2`..`pick_5`, `skip_2`, `current_2`, `constructor_2`; every coordinate and hit already matched) then `9611350c` (feat, GREEN: 27/27)

**Plan metadata:** the `docs:` commit that adds this file and the two ledger rows.

Tracer feedback gate (interactive, `human_verify_mode: end-of-phase`, automated-only verify): `node --test tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-producer.test.ts` re-run on the committed Task 1 bytes, 25 pass 0 fail; expansion continued without a checkpoint.

## TDD Gate Compliance

- Each task has a `test(coverage)` commit preceding its `feat(coverage)` commit; both RED records were classified `RED_EVIDENCE_OK` (`target_test_failed`) with `gsd-tools check tdd-red-evidence` before implementation.
- Five Task 2 controls (`tool-changed`, `runtime-changed`, `stale-executed`, transform through the CLI, `module-not-captured`) were already green at Task 2 RED: the run identity checks were implemented with the run request in Task 1's GREEN because reading a content-addressed store without checking its digest, or mapping a run whose tooling changed, would have shipped an unverified path even briefly. They pin behaviour that existed; no control was weakened.
- Commit scopes are `coverage`, per the repository's Conventional Commits rule, so the generic `test(07-03)`/`feat(07-03)` grep finds nothing by design. No REFACTOR commits.

## Exact commands and results

| Command | Result |
| --- | --- |
| `node --test --test-reporter=tap tests/scripts/coverage-source-map.test.ts` (Task 1 RED) | exit 1; 7 tests, 0 pass; target `converts the run's recorded module through the exact identity mapping` failed on `1 !== 0`; `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-source-map.test.ts tests/scripts/coverage-producer.test.ts` (Task 1 verify, before and after the GREEN commit) | 25 pass, 0 fail (10.8 s) |
| hand trace of the endpoints fixture through the CLI | `(anonymous_0)` decl 1:33-1:34 loc 1:47-1:48 hits 1; `(anonymous_1)` decl 1:57-1:58 loc 1:71-1:72 hits 0; `width` decl 2:16-2:21 loc 2:44-2:66 hits 1; statements 1:19-1:24 (1), 1:33-1:48 (1), 1:47-1:48 (1), 1:57-1:72 (1), 1:71-1:72 (0), 2:46-2:64 (1); line 1 is 72 and line 2 is 66 UTF-16 units; no `null` in the output |
| `node --test --test-reporter=tap tests/scripts/coverage-source-map.test.ts` (Task 2 RED) | exit 1; 27 tests, 12 pass, 15 fail; target failed only on names; `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-source-map.test.ts` (Task 2 verify) | 27 pass, 0 fail |
| `node --test tests/scripts/coverage-producer.test.ts` (after the adapter/CLI change) | 18 pass, 0 fail |
| `npm run test:corresponding` | passed |
| `node scripts/coverage-producer.mjs --request <errors.ts from run 20260917T170221887Z-6c0485ba, 163 raw records>` | exit 0 in 6.5 s; 36 functions, 142 statements, 44 branches; 16 `constructor`, `(anonymous_6)`, `(anonymous_22)`, `(anonymous_35)`; no `_N` label; no `null`; decl spans read back from the source give the same identifiers |
| `SKIP=trufflehog pre-commit run --files ...` (four runs) + trufflehog filesystem scan | every hook passed on every commit set after one `npm fallow` refusal (see Deviations); 0 verified / 0 unverified secrets |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-03-T1 | Endpoints fixture written by hand: two arrows after `"π🎉"` at UTF-16 columns 33 and 57, bodies at 47-48 and 71-72 with hits 1 and 0, `width` body 2:44-2:66 with the closing brace at the line length; identity segments computed from the original text with `decode`; four refusal rows with literal line/column values; the stale-source row with the digest of the rewritten bytes | A converter counting code points or bytes (columns move by 1 or 3), a map without the line-length column (Infinity endpoints), a strip that changed or moved a character, a store read without its digest | No production exclusion, native threshold, direct pin or existing assertion changed; `maxCrap: 0` stays disabled |
| 07-03-T2 | Declarations fixture: 14 functions with names written as the source spelling at each span (`pick` x5, `skip` x2, `constructor` x2, `current` x2, `count_2`, `nested`, `(anonymous_13)`), 17 statements with hits from V8 semantics; CRLF fixture with `\r` counted as a column; obsolete-run rows with literal kinds and, for the transform, line 9 column 19 `u`->`v`; ten position rows with the exact offending location | Stripping `_N` by regex (`count_2` -> `count`), matching by nearest name or line (the shifted-span control), accepting a stale store or a changed tool, clamping or nulling a coordinate, a `line` field disagreeing with its location | Same |

Partial/zero/error paths recorded: zero-hit functions (`skip`, `other.pick`, set `current`, `Counter.pick`, `count_2`, inner `pick`), zero-hit statements with a covered declarator on the same line, opposite coverage on one line twice, absent implicit-else location accepted only in a branch, four transform refusals, six run/store refusals, one unproven-function refusal, ten position rows, one CLI Infinity refusal with no output file.

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64; the capture tooling digests compared are those of `coverage-capture.mjs`, `coverage-capture.manifest.mjs` and `coverage-capture.runtime.mjs` in the tree.
- File digests at the final commit (sha256, first 16): `scripts/coverage-source-map.mjs` `939c35bfcd815221`, `scripts/coverage-producer.mjs` `196523489f46f706`, `scripts/coverage-producer.convert.mjs` `b92e6d6472dd9b75`, `tests/scripts/coverage-source-map.test.ts` `f967c17d52485f72`, `tests/scripts/coverage-source-map-fixtures.ts` `873a3983a93a3530`.
- The producer identity receipt of 07-02 still binds the adapter digest; `coverage-producer.convert.mjs` changed here, so `npm run coverage:producer:check` was rerun (18/18) and 07-05 must embed the new adapter digest when it records receipts.
- No dependency added; `acorn` and `@jridgewell/sourcemap-codec` are the exact versions 07-02 installed.

## Files Created/Modified

- `scripts/coverage-source-map.mjs` - executed-source proof and identity map; run, tool, runtime and store identity; declaration-based name restoration; concrete-position validation
- `scripts/coverage-producer.mjs` - run request form, name restoration for run requests, in-memory and readback position validation, atomic text write
- `scripts/coverage-producer.convert.mjs` - `convertScripts` returns plain file records
- `tests/scripts/coverage-source-map-fixtures.ts` - endpoints, declarations and crlf fixtures with hand-written expectations
- `tests/scripts/coverage-source-map.test.ts` - 27 controls

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `convertScripts` returned merger instances, not plain data**

- **Found during:** Task 2 (first GREEN run)
- **Issue:** istanbul-lib-coverage's `CoverageMap.toJSON()` yields `FileCoverage` instances whose maps live under `data`; `JSON.stringify` hid this, but spreading one record (name restoration) and reading `statementMap` (position validation) failed with `Cannot convert undefined or null to object`. The adapter's doc comment promised plain JSON data.
- **Fix:** `convertScripts` unwraps each file with its own `toJSON()`; `coverage-producer.convert.mjs` was not in the plan's file list
- **Files modified:** `scripts/coverage-producer.convert.mjs`
- **Verification:** 27/27 and 18/18
- **Committed in:** `9611350c`

**2. [Rule 3 - Blocking] `SourceMapError` is not exported**

- **Found during:** Task 1 (pre-commit `npm fallow`)
- **Issue:** `fallow dead-code` reported the exported class as consumer-less: the CLI never imports it and the tests discriminate on `name`/`failures`
- **Fix:** the class is module-private; no suppression marker added
- **Files modified:** `scripts/coverage-source-map.mjs`
- **Verification:** `fallow dead-code --fail-on-issues` clean; pipeline exit 0
- **Committed in:** `b29e38f7`

**3. [Structure] Fixtures live in a sibling support module**

- **Found during:** Task 1
- **Issue:** the plan names only the test file; the three fixtures with their expectations are 339 lines and follow the `coverage-producer-fixtures.ts` pattern
- **Fix:** `tests/scripts/coverage-source-map-fixtures.ts`, importing `spanOf`/`prefixOf`/`suffixOf` and the fixture types from the 07-02 module
- **Files modified:** `tests/scripts/coverage-source-map-fixtures.ts` (new)
- **Committed in:** `5d2f35de`

---

**Total deviations:** 3 (1 bug, 1 blocking gate fix, 1 structural). The two that touch files outside the plan's list are recorded in `.planning/WINDOWS.md` as `deviation` rows 44 and 45.
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened; `maxCrap: 0` stays disabled; no production export or extension code changed.

## Issues Encountered

- Node's strip mode pads the second UTF-16 unit of a removed surrogate pair with U+FEFF, not a space (probed on `// π🎉` inside a type literal and on a template-literal type); the proof admits exactly space and U+FEFF as blanks.
- The first draft of the "moved line boundary" control had an unreadable replacement expression; it was rewritten as a single `replace` of `"π🎉";\r\n\n` with `"π🎉"; \n\r` before the RED run.
- A local named `path` in one test shadowed the `node:path` import; renamed.

## Known limits

- The proof covers the transform Node's strip mode performs today (blanks in place, terminators kept, one trailer). A future Node whose stripping changes shape is a refusal, not a silent acceptance; the capture manifest's runtime identity makes such a run obsolete anyway.
- Lines are counted at `\n` only, as the producer and Istanbul count them. A lone `\r`, U+2028 or U+2029 inside a source is not refused; Acorn treats them as line breaks but the producer maps by offset, so coordinates stay consistent with the `\n` model.
- Name restoration proves identifiers only: a computed key (`[name]()`), a string-literal key or a private `#name` keeps whatever label the producer emitted. None occurs in the extension sources.
- `restoreSourceNames` checks that every Istanbul function has a declaration; the reverse (every declared function has an Istanbul record) is the correspondence validator of 07-04, and statement/branch correspondence likewise.
- `openCaptureRun` binds the run to the tooling and runtime and each store entry to its digest; it does not recompute the repository inventory against the tree. That is `verifyCaptureBundle` (07-01) and belongs to the acceptance step of 07-05, which must run it before any mapping is trusted as current.
- The single-module probe of the existing full-population run is evidence that the path works on real code; it is not a production measurement. That measurement is 07-07's.
- Verified on Node v26.8.2 and npm 11.19.1; CI's Node 24 has not been exercised by this plan. The full `npm run check` chain was not run here (phase-close gate, 07-08); typecheck, lint, format, fallow, direct coverage and the type-member gate ran through pre-commit on every commit.

## Threat Flags

None: no new network, authentication or file-access surface. The CLI reads only the run directory the request names and writes only the requested output paths.

## Next Phase Readiness

- 07-04 can import `positionFailures` and `restoreSourceNames` from `scripts/coverage-source-map.mjs` or run the CLI's run form; the concrete-position rows and the `function-unproven` row are its schema vocabulary starting point, and the implicit-else acceptance is limited to `branchMap[*].locations[*]`.
- 07-05 should build run requests from `verifyCaptureBundle`'s manifest (one script per raw record holding a production module's URL), embed the new adapter digest in receipts, and rerun `npm run coverage:producer:check`.
- Repository state: four code commits on `features/test-backlog`; `.planning/WINDOWS.md` gained two deviation rows (committed with this file); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-17*

## Self-Check: PASSED

All three created files exist on disk and all four task commits (5d2f35de, b29e38f7, 1f5e3669, 9611350c) are in `git log`; `commits: 4` was measured as `git rev-list --count 9032848e..HEAD`.

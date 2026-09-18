# Coverage metrics

Turns one native unit test run into a verified Istanbul coverage map and applies a CRAP policy to every production function.

Node's test runner reports line, function and branch coverage as LCOV. That report is the coverage gate this repository keeps at 100 percent for the production sources. Fallow, the static analysis tool that runs in `npm run check`, cannot read LCOV. It reads an Istanbul map (a JSON document with one record per file: the position of every function, statement and branch, and how many times each ran). The tooling in this document produces that map from the same run that produces the LCOV, proves that the map describes the source that ran, and then scores every production function with the CRAP metric (change risk anti-patterns: a score that grows with complexity and with uncovered statements).

Nothing here changes what the tests do, what the LCOV contains, or the whole-tree complexity and duplication limits in `.fallowrc.json`. `npm run check`, the pre-commit hooks and CI run the pipeline; the section "Where the commands run" says where.

## Invocation

| Command                                                     | What it runs                                                                                                                               | Cost                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `npm test`                                                  | The unit selection under the runner alone: no coverage, no capture. Runner options pass through: `npm test -- --test-name-pattern=<regex>` | one plain unit run                                                     |
| `npm run coverage:unit:verified`                            | The unit selection once, with capture, conversion, validation and publication of one accepted bundle                                       | one full unit run, about 7.5 minutes and 800 MB under `coverage/runs/` |
| `npm run test:coverage:unit`                                | The same as `coverage:unit:verified`; it is the unit half of `npm run test:coverage`                                                       | one full unit run                                                      |
| `npm run coverage:unit:current`                             | The published bundle, reused when `coverage:validate` accepts it now; `coverage:unit:verified` otherwise                                   | seconds, or one full unit run                                          |
| `npm run coverage:validate`                                 | The readback of the published bundle, the way every consumer reads it                                                                      | about 6 seconds                                                        |
| `npm run coverage:risk`                                     | The CRAP policy over the published bundle through the installed Fallow                                                                     | about 12 seconds                                                       |
| `npm run coverage:risk -- --report coverage/unit.risk.json` | The same gate, and writes every production function with its score                                                                         | about 12 seconds                                                       |
| `npm run coverage:capture`                                  | The capture step alone: the unit run and the captured manifest, no map                                                                     | one full unit run                                                      |
| `npm run coverage:capture -- --verify`                      | The readback of the captured manifest alone                                                                                                | seconds                                                                |
| `npm run coverage:unit:negative`                            | 32 offender and benign controls through the shipping pipeline and readback on small fixture roots                                          | about 20 seconds                                                       |
| `npm run coverage:risk:negative`                            | 20 offender and benign controls through the shipping gate and policy                                                                       | about 30 seconds                                                       |
| `npm run coverage:producer:check`                           | The conformance corpus of the producer package                                                                                             | one `node --test` run of the corpus                                    |
| `npm run coverage:producer:build -- --verify`               | The provenance of the vendored producer package: archive, license, patch and every digest                                                  | seconds, offline                                                       |

Every command takes `--root <dir>` to run against a fixture root laid out like the repository. The tests under `tests/scripts/coverage-*.test.ts` and `tests/scripts/check-coverage-risk*.test.ts` use that option.

`npm test` and every capture select the unit suite from one definition, `UNIT_TEST_PATTERNS` in `scripts/coverage-capture.manifest.mjs`, so the two cannot drift apart.

## Where the commands run

`npm run check` runs the unit suite once, through `test:coverage:unit`, and then `coverage:unit:negative`, `coverage:risk` and `coverage:risk:negative`. Those four members come after the typecheck, lint, Fallow, format, corresponding-test and direct-coverage gates and before the integration tests and the type-member gates. The chain launches no second unit run: `npm test` is not in it. `tests/architecture/coverage-metrics-pipeline.test.ts` pins this order, the scripts and the hooks below, and runs each of its predicates against a planted violation.

Two pre-commit hooks run on every commit that changes an input of the bundle: a production source, a file under the unit test tree, a script, the vendored producer, or one of the configuration files the inventory lists. `npm-coverage-unit` runs `coverage:unit:current`. It reuses the published bundle when `coverage:validate` accepts it against the staged tree, and runs the unit suite once otherwise. `npm-coverage-risk` then runs `coverage:risk` on that bundle. Only the producer reuses. The consumer refuses a missing or stale bundle and never captures.

In CI, three jobs make their own capture, each on its own runner: the `check` job of `ci.yml` (`npm run check`), the `sonarcloud` job (`npm run test:coverage`, whose unit half is `test:coverage:unit`) and the `pre-commit` job of `lint.yml` (the two hooks above, through `pre-commit run --all-files`). The `check` and `sonarcloud` jobs first run `coverage:producer:build -- --verify` and `coverage:producer:check`, so the provenance and the conformance of the installed producer are proved on the runner's Node 24 before that runner accepts any artifact. No job reads another job's bundle: a bundle binds one tree and one runtime, and a job that received one could not verify how it was made. Sonar reads `coverage/unit.lcov` and nothing else.

## When a command refuses a stale bundle

A consumer that finds the bundle missing or stale exits 1 and prints the rows that name the cause: `missing-manifest` when nothing is published, `stale-input` with the changed paths when an inventoried file differs from the run, `tool-changed` when a script of the pipeline differs, `runtime-changed` when Node differs, `summary-mismatch` when the recorded counts are another run's. `coverage:risk` prints `missing-manifest` itself and wraps the validator's other refusals in one `validation` row. No consumer regenerates anything. To get a current bundle, run `npm run coverage:unit:current` (reuses when it can, captures otherwise) or `npm run test:coverage:unit` (always captures). `npm run check` always captures.

## Updating the producer

`scripts/build-coverage-producer.mjs` pins the producer in its `DELIVERY` constant: the upstream version and registry integrity, every entry digest, the patch and its digest, the license digest and the archive integrity. To move to another upstream release: change the `DELIVERY` values, adapt or drop the patch, and run `npm run coverage:producer:build -- --build`. The build fetches the upstream tarball, refuses it unless its integrity matches, applies the patch, packs twice, refuses the build unless both archives are byte-identical, and writes the archive and the license under `vendor/coverage/`. Then update `vendor/coverage/PROVENANCE.md`, reinstall so that `package-lock.json` records the new archive, and run `npm run coverage:producer:check`: the conformance corpus must pass before any capture is accepted with the new producer. `npm run coverage:producer:build -- --verify` checks the vendored files offline; CI runs it before every capture. Ordinary tests and gates never rebuild or edit installed dependencies (D-05). The Fallow consumer is pinned apart, in `scripts/coverage-risk-policy.json`; an upgrade fails `consumer-identity` until the policy names the new version and the controls run again.

## Artifacts

An accepted run publishes four files under `coverage/`, which is gitignored:

| File                            | Content                                                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coverage/unit.lcov`            | Node's own LCOV, byte for byte as the runner wrote it. Sonar reads this file and nothing else.                                                                                                                       |
| `coverage/unit.istanbul.json`   | The Istanbul map for every production source.                                                                                                                                                                        |
| `coverage/unit.validation.json` | The receipt of the validation: the run, the digests of the manifest and the map, every validated module with the digests of its source and executed text, the model versions, the validator tooling and the runtime. |
| `coverage/unit.manifest.json`   | The accepted manifest, written last. It binds the LCOV, the map, both receipts, the producer identity, the tooling digests, the production population and the two denominators.                                      |

Each run also keeps its evidence under `coverage/runs/<runId>/`: the inventory of every input with its digest, the raw V8 records of every process, the source and executed text of every module, the worker records and the same four artifacts. A refused run keeps this directory with `status: "failed"` and publishes nothing. Run directories are not pruned; remove the ones you no longer reference.

## Exit status

| Status | Meaning                                                                                  |
| ------ | ---------------------------------------------------------------------------------------- |
| 0      | The bundle is accepted, or the gate passed.                                              |
| 1      | A refusal. Standard error carries the message and one `{ "kind": ... }` row per finding. |
| 2      | A usage error: an unknown option, or a root that is not a directory.                     |

A refusal at any step of `coverage:unit:verified` removes every public artifact. A public LCOV without an accepted map is a half bundle, and no consumer sees one.

## What an accepted bundle proves

The pipeline runs four steps in order and stops at the first refusal.

1. Capture. The unit selection runs once under the ordinary native runner flags. A preloaded module records, for every in-project module the loader evaluates, the source bytes and the exact JavaScript handed to V8 (Node's own type-stripped text, which preserves positions). Every input is hashed before the run, after the run and at publication. A file loaded but not inventoried, a module whose bytes changed during the run, a worker that did not finish, a raw record from an unregistered process, or a failing test refuses the run. A production source no test loaded is still recorded, with its executed text stripped under the same runtime.
2. Conversion. The producer (`ast-v8-to-istanbul` 1.0.6 with one reviewed patch, vendored under `vendor/coverage/`) converts every raw V8 record of the run into one map, one production file at a time, from a fresh parse of the recorded executed text and an explicit identity source map. Records from several processes are merged by Istanbul's own merger. A never-loaded executable module gets the zero-execution model: every construct present, every counter zero.
3. Validation. Every record is checked against the run's own bytes: the executed text must be a position-preserving strip of the source, every position must be a concrete coordinate in that source (no negative, null or infinite value, and no clamping), and an independent walk of the executed text must find exactly the functions, statements and branches the record declares, at exactly the recorded spans, both ways. A source the run never loaded must carry only zero counters.
4. Acceptance. The manifest records the digests of everything above, the population (loaded, unloaded executable, unloaded type-only) and the two denominators, then goes public last. The bundle is read back the way a consumer reads it before the command exits 0.

`coverage:validate` with no arguments repeats the readback on the published bundle: every digest, the inventory against the tree now, the tooling digests against the scripts now, the runtime, the installed producer against the recorded identity, the full validation of the map again, the receipt that validation yields against the stored one, and the population and denominators against the ones the bundle yields. A source edited since the run, a changed script, a different Node, a replaced map, or a manifest whose counts belong to another run are each refused at their exact row. Freshness is a content check; no file name or modification time is trusted.

## Two denominators

An accepted manifest records two measurements of the same run, under `acceptance.denominators`, and never equates them.

|                     | Native                                                                                           | Syntax                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source              | Node's LCOV                                                                                      | The accepted map                                                                                                                                                              |
| Population          | The production files some test loaded                                                            | Every production file                                                                                                                                                         |
| Functions           | V8 functions, including the synthetic initializer V8 creates for a class with field initializers | Functions the source declares                                                                                                                                                 |
| Lines or statements | Lines                                                                                            | Statements, as Istanbul defines them                                                                                                                                          |
| Branches            | V8 blocks: every code range V8 counted apart from its parent                                     | Branch arms: both arms of an `if` (the missing `else` included), both arms of a conditional, every operand of a logical chain, every case of a switch, every default argument |

On this repository the two disagree in expected ways. Native counts more functions than syntax by exactly the class field initializers. Native counts no branch for an `if` without `else` whose condition is always true, because no code exists on that path; syntax counts the implicit else as an arm at zero. Native counts a line as executed when any block on it ran; syntax counts each statement.

The native model is the 100 percent gate of D-01 and is unchanged. The syntax model is the one Fallow consumes. A deficit in the syntax model is not a native regression, and a native 100 percent does not prove that every statement ran (see the limits below).

## The CRAP gate

`npm run coverage:risk` reads one policy file, `scripts/coverage-risk-policy.json`: the threshold (30) and the exact consumer (Fallow 3.23.0, health report schema 11). The gate:

1. requires the published bundle to be in the accepted state and to pass `coverage:validate` now;
2. anchors every production function from the run's own executed text: the offset of the function node, its body span and the statements the body contains;
3. runs Fallow once in a diagnostic form that lists every function it analyzed, with the accepted map as its coverage input and every `FALLOW_*` environment override removed; Fallow's exit status decides nothing;
4. joins each production row to exactly one anchor and each anchor to exactly one row. Fallow reports columns as UTF-8 byte offsets; the gate converts them through the original line. A row it cannot join, a duplicate, an anchor no row reports, an estimated row, or a coverage percentage that differs from the independent proportion is a refusal;
5. scores each function as `cc * cc * (1 - coverage) ** 3 + cc`, with Fallow's cyclomatic complexity and the unrounded statement coverage. Coverage is the proportion of statements the body contains (nested functions included) that ran. A body with no statement uses the function's own entry count. A function at or above the threshold is a `crap` row and the gate exits 1.

At full statement coverage the score equals the cyclomatic complexity. An uncovered function of complexity 6 scores 42 and fails; the same function fully exercised scores 6. An uncovered function of complexity 5 scores exactly 30 and fails. Fallow's own one-decimal label is recorded beside every function and is never compared with the threshold: a true 29.952 passes although Fallow labels it 30.

Rows for tests and scripts are counted and never gated. The whole-tree limits in `.fallowrc.json` (cyclomatic 20, cognitive 15, unit size 60) are a separate gate and are not changed by this one.

## What a clean result does not mean

- V8 counts blocks, not statements. When a call throws, the statements after it in the same block keep the block's count, so an unreachable `return` after a throwing call reads as executed. A default parameter value (`AssignmentPattern`) that never applied is not detected as uncovered when its line ran. The map inherits both limits from the raw data; the producer documents them.
- Node merges the block ranges of every test process into one LCOV. The merge keeps a zero-count block only when it exactly matches a block of the other side, or nests inside a zero-count block the scan reaches before an exact match. A block that ran in no process but sits inside a range another process reports at the same span, with a nonzero count, is dropped, and the merged LCOV counts its lines as executed. The raw records of each process and the map converted from them keep the count at zero. On this repository that is one `throw err;` inside a catch clause that one process entered: the LCOV counts the line as executed, the map records the statement at 0, and the function's score reads 6.007 instead of 6.
- A never-loaded module is measured, not excused: its functions and statements are in the denominator at zero. A type-only module strips to nothing and has an empty record.
- The gate proves that every production row Fallow reports is the function the source declares and carries the coverage the map holds. It cannot detect a counter swap inside the map itself; the map's counters are bound to the run by the producer's conformance corpus and by the digests.
- The consumer join is a contract with Fallow 3.23.0 as installed: its byte columns, its anchor at a method's parameter list or type parameter list, its one-decimal label and its `--max-crap 1` enumeration. A Fallow upgrade fails `consumer-identity` until the policy file names the new version and the controls run again.
- A bundle binds the Node and V8 version that made it. A report made on one runtime is refused on another.

## Runtime and tools

The capture uses `module.registerHooks` and `module.stripTypeScriptTypes` and runs the tests with `--experimental-test-coverage`. The producer package is the vendored `vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz` (upstream 1.0.6, MIT, one patch that keeps nested callbacks inside logical expressions; see `vendor/coverage/PROVENANCE.md`), with acorn 8.18.0, istanbul-lib-coverage 3.2.2 and @jridgewell/sourcemap-codec 1.6.0 pinned. The consumer is Fallow 3.23.0. The accepted measurement of this repository was made on Node v26.8.2 (V8 14.6.202.34-node.28). Each CI job makes its own capture on Node 24, whose LCOV merge code is the same, after qualifying the producer on that runner.

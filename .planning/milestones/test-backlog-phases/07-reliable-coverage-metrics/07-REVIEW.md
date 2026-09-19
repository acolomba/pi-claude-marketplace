---
phase: 07-reliable-coverage-metrics
reviewed: 2026-09-18T21:13:30Z
depth: standard
files_reviewed: 51
files_reviewed_list:
  - docs/coverage-metrics.md
  - .fallowrc.json
  - .github/workflows/ci.yml
  - .github/workflows/lint.yml
  - .github/workflows/sonarcloud.yml
  - .gitignore
  - package.json
  - .pre-commit-config.yaml
  - scripts/build-coverage-producer.mjs
  - scripts/check-coverage-risk.mjs
  - scripts/check-coverage-risk.negative.mjs
  - scripts/coverage-acceptance.mjs
  - scripts/coverage-capture.manifest.mjs
  - scripts/coverage-capture.mjs
  - scripts/coverage-capture.runtime.mjs
  - scripts/coverage-correspondence.mjs
  - scripts/coverage-producer.convert.mjs
  - scripts/coverage-producer.mjs
  - scripts/coverage-risk-policy.json
  - scripts/coverage-schema.mjs
  - scripts/coverage-source-map.mjs
  - scripts/coverage-syntax.mjs
  - scripts/coverage-unit.mjs
  - scripts/coverage-unit.negative.mjs
  - scripts/coverage-validate.mjs
  - sonar-project.properties
  - tests/architecture/coverage-metrics-pipeline.test.ts
  - tests/architecture/pre-commit-hooks.ts
  - tests/architecture/unit-suite-glob-completeness.test.ts
  - tests/architecture/unused-type-member-gate.test.ts
  - tests/scripts/check-coverage-risk-fixtures.ts
  - tests/scripts/check-coverage-risk.negative.test.ts
  - tests/scripts/check-coverage-risk.test.ts
  - tests/scripts/coverage-capture.test.ts
  - tests/scripts/coverage-correspondence-fixtures.ts
  - tests/scripts/coverage-correspondence.test.ts
  - tests/scripts/coverage-producer-fixtures.ts
  - tests/scripts/coverage-producer.test.ts
  - tests/scripts/coverage-projection.ts
  - tests/scripts/coverage-run-support.ts
  - tests/scripts/coverage-schema.test.ts
  - tests/scripts/coverage-source-map-fixtures.ts
  - tests/scripts/coverage-source-map.test.ts
  - tests/scripts/coverage-unit-fixtures.ts
  - tests/scripts/coverage-unit.negative.test.ts
  - tests/scripts/coverage-unit.test.ts
  - tests/scripts/coverage-validation.test.ts
  - vendor/coverage/ast-v8-to-istanbul-1.0.6.patch
  - vendor/coverage/LICENSE
  - vendor/coverage/PROVENANCE.md
findings:
  critical: 0
  warning: 5
  info: 9
  total: 14
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-09-18T21:13:30Z
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

## Summary

The phase adds a coverage-metrics tool chain under `scripts/` (capture runtime + CLI, manifest/inventory contract, producer adapter and CLI, executed-source mapping, syntax correspondence, strict schema, validator, acceptance orchestration, CRAP gate, two negative runners, a vendored-producer builder), its `node:test` controls, a vendored patched `ast-v8-to-istanbul` tarball, and the wiring into `npm run check`, two pre-commit hooks and three CI workflows.

The core identity chain holds up under tracing: every artifact is content-addressed and re-hashed on readback; `storedText` requires every store entry to hash to its name (which also closes the read-then-copy window in `snapshotInventory`); the accepted receipt binds the full `runtimeIdentity()` (node, v8, platform, arch); the risk gate refuses a `captured`-only bundle before spawning the validator; `package-lock.json` resolves the producer to the vendored archive with the same `sha512` integrity that `DELIVERY.archive.integrity` pins; the vendored tarball is verified offline in both CI jobs that capture. The workflow YAML has no `${{ }}` inside `run:` blocks, all installs use `--ignore-scripts`, and `persist-credentials: false` is set everywhere. The tests use `node:test` + `node:assert/strict`, `mkdtemp` roots, no `only/skip/todo`, no shared mutable module state, no process-global mocks.

No blocker was found. The five warnings are: the risk gate feeds Fallow a map path taken from a manifest field the readback never verifies (rather than the constant it did verify); the producer module is executed before its identity is checked; the acceptance orchestrator skips public-artifact cleanup on any non-refusal error, contradicting the documented "removes every public artifact" contract; Fallow's stderr is discarded on a consumer failure; and run directories (about 800 MB each) accumulate without bound under every `npm run check` and every pre-commit miss.

## Warnings

### WR-01: Risk gate reads the map path from an unverified manifest field

**File:** `scripts/check-coverage-risk.mjs:664`
**Issue:** `riskVerdict` builds `mapPath` from `manifest.acceptance.artifacts.public.istanbul`, a string stored in the public manifest. `verifyCaptureBundle` (`scripts/coverage-capture.manifest.mjs:450-461`) verifies the digest of the constant `PUBLIC_ISTANBUL_PATH`, never of whatever `public.istanbul` says, and `coverage-validate.mjs:376` re-validates `acceptance.artifacts.istanbul.path` (the run-directory copy), not the public one. So the file the gate hands to Fallow at `:422` and reads at `:665` is selected by a field no step of the readback checks. `populationAnchors` only proves the map's *shape* matches the run's executed text; a differently-hit map at a manifest-named path would pass the gate and Fallow consistently. Today the field always equals the constant, so this is a hole in the trust argument rather than a live bug.
**Fix:** Use the verified constant and drop the indirection:
```js
import { PUBLIC_ISTANBUL_PATH, PUBLIC_MANIFEST_PATH, RUNS_DIRECTORY, writeJsonAtomically } from "./coverage-capture.manifest.mjs";
// ...
const mapPath = path.join(options.root, PUBLIC_ISTANBUL_PATH);
```
Optionally also have `verifyCaptureBundle` refuse when `acceptance.artifacts.public.istanbul !== PUBLIC_ISTANBUL_PATH` (and the same for `validation`), so the recorded pointer and the verified path cannot diverge.

### WR-02: Producer code runs before its identity is qualified

**File:** `scripts/coverage-producer.convert.mjs:151-174`
**Issue:** `loadProducer` performs `await import(entryUrl)` at `:151`, then hashes the entry file and checks version, license, location and lock record at `:157-166`, and only then throws for the installed producer. By the time `producer-payload` or `lock-resolution` can be reported, the producer's top-level code has already executed in the calling process (the validator, the acceptance orchestrator, the producer CLI). The header comment promises "Loading the installed producer with any of those off throws" -- it does, but after loading. As a qualification step meant to distinguish the maintained delivery from a tampered `node_modules`, verify-after-execute cannot protect against the case it detects.
**Fix:** Resolve the entry, compute `identity` and `deliveryFailures` from the bytes on disk first, and import only when qualified (or when an explicit control `entry` was given):
```js
const entryPath = fileURLToPath(entryUrl);
const { directory, version } = producerPackage(entryPath);
const identity = { /* ...digests from readFileSync(entryPath)... */ };
const failures = deliveryFailures(identity, root);
if (entry === undefined && failures.length > 0) { throw new ProducerError(/* rows */, failures); }
const loaded = await import(entryUrl);
```

### WR-03: Public artifacts survive a non-refusal crash of the acceptance pipeline

**File:** `scripts/coverage-unit.mjs:374-382`
**Issue:** `refuse` calls `removePublicArtifacts(root)` only when `error.failures` is an array; any other error (a `TypeError`, an `ENOENT` from `readJson` in `acceptedManifest`, an acorn `SyntaxError` from `classifySyntax` in `acceptanceSummary`) is rethrown at `:376` *before* cleanup. After `capture(root)` has published `coverage/unit.lcov` and a `state: "captured"` manifest, such a crash leaves that half bundle public. `docs/coverage-metrics.md:68` states "A refusal at any step of `coverage:unit:verified` removes every public artifact." `coverage:risk` still refuses the captured state, but `coverage:validate` with no arguments would treat a stale `coverage/unit.istanbul.json` as a candidate map against it (see IN-04), and Sonar would read the LCOV of a run the pipeline never accepted if the caller ignored the non-zero exit.
**Fix:** Clean up unconditionally, then decide how to report:
```js
function refuse(root, error) {
  removePublicArtifacts(root);
  if (!Array.isArray(error.failures)) { throw error; }
  // ...print rows...
}
```

### WR-04: Consumer stderr is discarded when Fallow fails

**File:** `scripts/check-coverage-risk.mjs:420-435`
**Issue:** `consumerReport` spawns Fallow with default piped stdio and, on `status !== 0`, throws a single row `{ kind: "consumer", outcome: "status", status }`. `completed.stderr` is never re-emitted, unlike the validator path (`validateBundle` at `:243` calls `reemit`). A Fallow crash (unsupported flag after an upgrade, a `.fallowrc.json` parse error, a missing platform binary) reports only an exit code, and the docs' promise that "Standard error carries the message" (`docs/coverage-metrics.md:65`) is not kept for the step most likely to fail on a new runner.
**Fix:** Relay the consumer's stderr the way the validator's is relayed:
```js
const completed = spawnSync(process.execPath, [consumer, "health", ...], { cwd: root, encoding: "utf8", env, maxBuffer: CHILD_OUTPUT_BUDGET });
reemit(completed.stderr ?? "");
```

### WR-05: Run directories grow without bound

**File:** `scripts/coverage-capture.mjs:131-148`, `scripts/coverage-unit.mjs:357-361`
**Issue:** `createRun` removes only the two public pointers; every run keeps its own `coverage/runs/<runId>/` with the raw V8 records of every process, the source and executed stores and the inventory snapshot -- about 800 MB per run per `docs/coverage-metrics.md:14`. Nothing prunes: not a refused run, not a superseded accepted run, not `removePublicArtifacts`. `npm run check` always captures, and each pre-commit miss captures, so a developer's `coverage/` grows by ~0.8 GB per gated commit and by another 0.8 GB each time the chain is run locally; the docs acknowledge this only as "remove the ones you no longer reference" (`:58`). `coverage/` is gitignored, so nothing else notices.
**Fix:** On a successful publish, prune every run directory the new public manifest does not name (keep the accepted run; optionally keep the most recent failed run as evidence), or add a `coverage:runs:prune` script and call it from `coverage:unit:verified` after `publish` succeeds:
```js
for (const runId of runDirectories(root)) {
  if (runId !== accepted.runId) { rmSync(path.join(root, RUNS_DIRECTORY, runId), { recursive: true, force: true }); }
}
```

## Info

### IN-01: `--root` accepts a non-directory despite the documented exit 2

**File:** `scripts/coverage-capture.mjs:108-110`, `scripts/coverage-unit.mjs:108-110`
**Issue:** Both `parseArguments` check only `existsSync(options.root)` but report "Root is not a directory". A regular file passes and the command later fails with exit 1 from `readdirSync`, not the exit 2 `docs/coverage-metrics.md:66` promises for "a root that is not a directory". `coverage-validate.mjs:111` and `check-coverage-risk.mjs:123` do it right.
**Fix:** `if (!existsSync(root) || !statSync(root).isDirectory()) throw new UsageError(...)`.

### IN-02: Malformed inputs crash with a stack instead of a `{ kind }` row

**File:** `scripts/build-coverage-producer.mjs:171-173`, `scripts/coverage-capture.manifest.mjs:467-480`
**Issue:** `parsePatch` dereferences `current.hunks` when an `@@` line precedes any `--- a/` header (`current` is `null`, a `TypeError` that `patchFailures` rethrows at `:316`). `artifactFailures` calls `manifest.raw.map`, `manifest.modules.flatMap` and `manifest.workers.length` after `readPublicManifest` deliberately tolerated `manifest.raw ?? []`; a manifest missing those arrays throws instead of yielding a refusal row. All paths still exit 1 (fail-closed), but the structured-row contract the docs describe is not honored for these shapes.
**Fix:** Guard `current === null` with a `patch-format` `DeliveryError`; in `readPublicManifest`, refuse (`malformed-manifest`) unless `raw`, `modules` and `workers` are arrays before returning the manifest.

### IN-03: Producer identity binds the absolute checkout path

**File:** `scripts/coverage-producer.convert.mjs:162`, `scripts/coverage-validate.mjs:336-344`
**Issue:** `identity.entry` is the absolute path of `node_modules/ast-v8-to-istanbul/dist/index.mjs`. It is recorded in the acceptance record and compared by `producerFailures`, so an accepted bundle is refused (`producer-changed`, field `producer`) after the checkout is moved or renamed even though every byte is identical. `docs/coverage-metrics.md:79` says "Freshness is a content check; no file name or modification time is trusted."
**Fix:** Record `entry` relative to the repository root (or omit it from the compared identity and keep `payloadDigest`, which already pins the bytes).

### IN-04: `coverage:capture` alone leaves stale public map and receipt beside a fresh captured manifest

**File:** `scripts/coverage-capture.mjs:142-145`
**Issue:** `createRun` removes `PUBLIC_MANIFEST_PATH` and `PUBLIC_LCOV_PATH` but not `PUBLIC_ISTANBUL_PATH` / `PUBLIC_VALIDATION_PATH` (those are removed only by `coverage-unit.mjs:357`). After a standalone `npm run coverage:capture` on an unchanged tree, `npm run coverage:validate` treats the previous run's `coverage/unit.istanbul.json` as the candidate map for the new run; since validation checks shape and positions, not hits against raw records, the old map is accepted and a receipt is written for it. The verified pipeline is unaffected (it passes an explicit run-directory map), but the standalone flow is misleading.
**Fix:** Remove all four public paths in `createRun` (export `PUBLIC_PATHS` from the manifest module and share it).

### IN-05: Node floor of the scripts is higher than `engines` advertises

**File:** `package.json:36-38,101`, `scripts/coverage-capture.runtime.mjs:27`, `scripts/coverage-capture.manifest.mjs:17`
**Issue:** `npm test` now routes through `scripts/coverage-capture.mjs`, which imports `stripTypeScriptTypes` (Node 22.13+) and, via the manifest module, `fs.globSync` (Node 22.0+); the runtime hook needs `module.registerHooks` (Node 22.15+). On Node 20.19 the ESM named import fails at link time, so `npm test` cannot start, while `engines.node` still says `>=20.19.0`. Dev tooling already needs Node 22.22+ because of `write-file-atomic@^8`, so this is a documentation/engines inconsistency rather than a regression in practice.
**Fix:** Either raise `engines.node` (or add a `devEngines` note) to the real floor, or state in `docs/coverage-metrics.md` that the coverage scripts need Node >= 22.15.

### IN-06: Docs overstate the shared `--root` option

**File:** `docs/coverage-metrics.md:27`
**Issue:** "Every command takes `--root <dir>`" -- `coverage-producer.mjs` takes `--request/--out/--receipt/--producer` and `build-coverage-producer.mjs` takes `--build/--verify/--vendor/--upstream`; neither accepts `--root` (both exit 2 on it).
**Fix:** Qualify the sentence ("Every consumer and the capture take `--root <dir>`") or list the two exceptions.

### IN-07: Worker registration relies on pid uniqueness within a run

**File:** `scripts/coverage-capture.runtime.mjs:53-68`
**Issue:** `<pid>.start.json` is written with `flag: "wx"`, so a pid reused within one run (an 8-minute run that spawns thousands of short-lived `node -e` children, on a kernel with `pid_max` = 32768) makes the second process throw at hook import and fail its test, refusing the whole capture. The failure is loud (fail-closed), but its cause would be hard to recognize from the refusal.
**Fix:** Key the record by `${pid}-${startTimeOrRandom}` and carry the pid inside, or catch `EEXIST` and record a `pid-reused` refusal row that names both registrations.

### IN-08: Refusal tests match a `kind` substring rather than the full row

**File:** `tests/scripts/coverage-capture.test.ts:899-900,951,1063`
**Issue:** These cases assert `assert.match(stderr, /"kind": "stale-input"/u)` (and similar) instead of comparing the complete `{ kind, ... }` rows the CLI prints. A regression that emits the right kind with wrong detail (missing `changed` paths, an extra row) still passes. The negative runner (`coverage-unit.negative.mjs`) does compare exact rows, so the gap is in the unit control's discrimination, not in the gate. Per `skills/typescript-unit-testing-review/SKILL.md`, whole-value comparison is the expected form.
**Fix:** Parse the rows from stderr (the CLI prints pretty JSON here; `coverage-unit.mjs` prints one row per line) and `assert.deepStrictEqual` the array.

### IN-09: `--reuse-current` treats a validator crash as "stale, rerun"

**File:** `scripts/coverage-unit.mjs:334-337`
**Issue:** `currentAccepted` maps any validator exit 1 to "the published bundle is not current; the unit suite runs anew". A validator crash (IN-02 shapes, an unexpected `TypeError`) also exits 1, so a broken validator silently degrades the reuse path into an eight-minute rerun on every commit rather than surfacing the defect. This is fail-safe for the gate but hides tooling bugs behind cost.
**Fix:** Distinguish a structured refusal (stderr has at least one `{ kind }` row) from a crash (no rows) and raise an `AcceptanceError` for the latter.

---

_Reviewed: 2026-09-18T21:13:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

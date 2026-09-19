---
phase: 07-reliable-coverage-metrics
plan: "01"
subsystem: testing
tags: [coverage, v8, lcov, node-test, registerHooks, stripTypeScriptTypes, sha256, manifest]

# Dependency graph
requires: []
provides:
  - "scripts/coverage-capture.mjs: `npm run coverage:capture` runs the unit selection once under the native flags and publishes coverage/unit.lcov plus coverage/unit.manifest.json atomically; `--verify` reads a bundle back; `--root <dir>` runs an isolated fixture root under the same rules"
  - "scripts/coverage-capture.runtime.mjs: NODE_OPTIONS=--import preload that registers every process under the run, records immutable source bytes and Node's own strip-mode JavaScript per in-project module, and refuses non-native formats"
  - "scripts/coverage-capture.manifest.mjs: the one authoritative unit selection, inventory rules and digests, manifest schema v1, atomic JSON write, and the consumer readback verification"
  - "tests/scripts/coverage-capture.test.ts: 34 child-process controls against fixture roots, with the ordinary native runner as the equivalence oracle"
affects: [07-02, 07-03, 07-04, 07-05, 07-07, 07-08]

# Actuals (#2632) -- chars/4 over the realized diff (81488 chars), never a harness token count.
actuals:
  tokens: 20400
  tasks: 3
  commits: 5
plan_head_before: 587bb5674e2c91e205b7b73ec8be76679230bed2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same-run capture: NODE_V8_COVERAGE set on the `node --test --experimental-test-coverage` runner, which copies every worker's raw V8 file into that directory after writing the LCOV"
    - "Executed-source identity: a synchronous `registerHooks` load hook returns `stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: url })` for `module-typescript` loads, the same call and `//# sourceURL` trailer Node's translator makes, so the recorded text is the evaluated text"
    - "Run directory per capture under coverage/runs/<runId>/ with content-addressed sources/, executed/ and inventory/ stores, per-process workers/<pid>.{start,exit,loads,refusals} records, raw/ and unit.lcov; manifest.json written last, public pointer copied byte-for-byte after it"
    - "Failure taxonomy as data: every refusal is a `{ kind, ... }` row in the manifest (launch, signal, tests-failed, drift, loaded-bytes-differ, unlisted-module, unsupported-format, interrupted-worker, missing-capture, unregistered-capture, missing-worker, empty-production-inventory, ...) and readback refusals mirror it (missing-manifest, unsupported-version, not-captured, foreign-path, manifest-mismatch, runtime-changed, tool-changed, stale-input, missing-artifact, artifact-digest, duplicate-record)"

key-files:
  created:
    - scripts/coverage-capture.mjs
    - scripts/coverage-capture.runtime.mjs
    - scripts/coverage-capture.manifest.mjs
    - tests/scripts/coverage-capture.test.ts
  modified:
    - package.json
    - .fallowrc.json

key-decisions:
  - "The hook supplies Node's own strip output (with the sourceURL trailer) back to the loader, so V8 evaluates the recorded bytes; raw ranges and LCOV were byte-identical to the ordinary runner on the fixture"
  - "The runtime rides NODE_OPTIONS, not execArgv, so nested Node subprocesses that tests spawn register too; a raw record whose pid was never registered refuses the run"
  - "Worker completion is required only for runner children; nested processes may end by signal and are kept as evidence"
  - "The inventory binds extensions/**, tests/** minus e2e/integration/live-uat, scripts/** and a fixed resource list, hashed before execution, after execution and before publication; a loaded module outside it is a failure, not an omission"
  - "`state` is `captured` for everything this CLI writes; `accepted` is reserved for the converted-Istanbul acceptance so a passing test process alone never certifies converted output"
  - "The runtime preload is declared as a fallow entry point in .fallowrc.json because `--import` loads it and no module imports it; no suppression marker was added"
  - "Commit scopes follow the repository's Conventional Commits rule (`test(coverage)`, `feat(coverage)`, `fix(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "Fixture roots mirror the repository layout (extensions/pi-claude-marketplace, tests/<root>, tests/index.test.ts, package.json type module) and run under the identical selection patterns and native flags; no weaker coverage configuration exists"
  - "Nested-runner hygiene: a `node --test` spawned from inside a worker must shed NODE_TEST_CONTEXT and NODE_TEST_WORKER_ID or it skips every file with exit 0; the CLI sheds them itself and the native reference does the same"
  - "Controls that replace NODE_OPTIONS also empty NODE_V8_COVERAGE, so an enclosing capture never receives an unregistered raw record from a test's own child"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "One native unit run yields LCOV, raw V8 and executed-source records under one run identity, equal to the ordinary runner's outcomes and production LCOV counts; non-native formats and foreign loaders are refused"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#captures LCOV, raw V8 and executed sources from one native unit run that matches ordinary execution"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#refuses an in-project module whose format is not natively strippable ESM"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#refuses a foreign --import in NODE_OPTIONS before running anything"
        status: pass
    human_judgment: false
  - id: D2
    description: "The capture selects exactly the `npm test` population, keeps TEST_CONCURRENCY and native reporter arguments, inventories every input with digests, and refuses failed tests, interrupted workers, missing or unregistered raw captures, empty production inventories and unlisted modules while recording nested subprocess evidence"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#selects exactly the population npm test names, one worker per file"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#rejects a worker that dies by signal as interrupted and uncaptured"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#rejects a raw capture from a process the run never registered"
        status: pass
      - kind: integration
        ref: "npm run coverage:capture (real population, run 20260917T170221887Z-6c0485ba: 302 workers, 532 raw records, 587 modules, 6694/6694 tests, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Source edits during loading, tree drift, changed tooling, a different runtime, stale or missing or swapped artifacts and duplicate records invalidate success; successful bundles are published atomically with the pointer last and verified again on readback"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#rejects a module whose loaded bytes differ from the pre-run inventory even after it is restored"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#refuses a bundle on readback when the capture tooling changed"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-capture.test.ts#starting a replacement run removes only the previous public pointer and report"
        status: pass
      - kind: integration
        ref: "node scripts/coverage-capture.mjs --verify (run 20260917T170221887Z-6c0485ba, exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 26m
completed: 2026-09-17
status: complete
---

# Phase 7 Plan 01: Immutable Same-Run Native Coverage Capture Summary

**`npm run coverage:capture` runs the unit selection once and publishes LCOV, raw V8 and the exact executed source bytes under one hashed run identity; drift, incomplete workers and stale bundles are refused on capture and on readback**

## Performance

- **Duration:** 1h 26m
- **Started:** 2026-09-17T15:43:49Z
- **Completed:** 2026-09-17T17:09:23Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- One native run supplies everything: `NODE_V8_COVERAGE` is set on the `node --test --experimental-test-coverage` runner, which copies each worker's raw V8 file into the run's `raw/` after writing the LCOV. A preloaded synchronous load hook hands Node's own strip-mode JavaScript (including the `//# sourceURL` trailer Node's translator appends) back to the loader, so the recorded executed text is the evaluated text. On the fixture the raw V8 ranges and the LCOV are byte-identical to the ordinary runner.
- Complete process and input evidence: every process registers a start record at import and an exit record on normal exit; each selected test must have exactly one runner child with an exit record and a raw file; a raw file from an unregistered pid refuses the run; nested subprocesses (232 in the real run) are recorded and may end by signal. The inventory (production sources, unit test tree, scripts, fixed resource list) is hashed before execution, after execution and before publication; every loaded in-project module must be in it with the same bytes.
- Immutable bundles: the run directory keeps content-addressed `sources/`, `executed/` and `inventory/` stores, `workers/` records, `raw/`, `unit.lcov` and `manifest.json`; a failed run keeps all of it with `status: "failed"` and publishes nothing; a successful run copies the LCOV, re-hashes it and only then writes `coverage/unit.manifest.json` as a byte copy of the run manifest. `--verify` recomputes the inventory and every digest and refuses stale input, changed tooling, another runtime, missing or swapped artifacts, foreign paths, duplicate records and pointer/run disagreement.
- The complete existing unit population captured once on this snapshot (evidence, not certification): 302 workers, 532 raw records, 587 modules (230 of 239 production sources loaded; the 9 unloaded ones are in the pre-run snapshot), 6694/6694 tests, native production LCOV 63825/63825 lines, 1890/1890 functions, 9234/9234 branches, readback verified.

## Task Commits

1. **Task 1: Capture one native unit fixture and its exact executed source (tracer)** - `83c41ceb` (test, RED) then `3bebe6ec` (feat, GREEN)
2. **Task 2: Bind the full authoritative unit selection and worker population** - `93d2e3b2` (test)
3. **Task 3: Reject drift and publish only complete immutable capture bundles** - `1c97278e` (test)
4. **Fix-up after the real-population capture** - `53283c55` (fix): the foreign-import control now empties `NODE_V8_COVERAGE` so it leaves no unregistered raw record in an enclosing capture; manifest assembly names its parts directly

**Plan metadata:** see the `docs:` commit that adds this file.

## TDD Gate Compliance

- Task 1 RED: `node --test --test-reporter=tap tests/scripts/coverage-capture.test.ts` exited 1 with the target test failing on `assert.strictEqual(capture.status, 0)`; `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (5 tests, 0 pass, 5 fail). GREEN: 6/6 pass.
- Tasks 2 and 3 RED were unexpected GREEN. Investigated: the tracer's implementation already established the whole manifest interface the plan's Task 1 action demanded (selection, invocation, inventory digests, worker and raw reconciliation, module store, drift checks, atomic publication, readback), so the Task 2 and Task 3 controls pinned behaviour that existed rather than driving new implementation. They were committed as `test(coverage)` commits with no `feat` counterpart. No control was weakened to reach green; each negative control asserts a specific failure kind (and, where the plan names it, the exact failure rows).
- Commit scopes are `coverage`, per the repository's Conventional Commits rule, so the `test(07-01)`/`feat(07-01)` grep in the generic gate finds nothing by design.

## Exact commands and results

| Command | Result |
| --- | --- |
| `node --test tests/scripts/coverage-capture.test.ts` | 34 tests, 34 pass, 0 fail (about 25 s; every case spawns the CLI against a fresh fixture root) |
| `npx tsc --noEmit`, `npx eslint <4 files>`, `npx prettier --check <6 files>` | clean |
| `npm run fallow` | exit 0 after declaring `scripts/coverage-capture.runtime.mjs` as an entry point and splitting `reconcileProcesses` (cognitive 19 -> under 15) |
| `SKIP=trufflehog pre-commit run --files ...` (four runs, one per commit set) | every hook passed except `npm format check`, which fails only on `.planning/config.json`, an uncommitted orchestrator edit outside this plan (left untouched); trufflehog: 0 verified, 0 unverified |
| `npm run test:corresponding`, `npm run lint:workflows` | passed |
| `npm run coverage:capture` (real population, first attempt) | refused with exactly one `unregistered-capture`: the foreign-import control's own CLI child had shed the outer runtime while inheriting the outer `NODE_V8_COVERAGE`; fixed in `53283c55` |
| `npm run coverage:capture` (real population, run `20260917T170221887Z-6c0485ba`) | exit 0 in 6m02s; 302 workers, 532 raw records, 587 modules; inventory 239 production / 391 tests / 25 tooling / 18 resources; 6694/6694 tests; LCOV 63825/63825, 1890/1890, 9234/9234 |
| `node scripts/coverage-capture.mjs --verify` | `Coverage capture verified: 20260917T170221887Z-6c0485ba`, exit 0 |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-01-T1 | Fixture LCOV counts written by hand (index.ts 7/7 lines, 1/1 functions; parity.ts 7/11 lines, 1/2 functions) and equal to the ordinary runner's per-record counts; pass/fail summary 3/0 equal on both sides; executed text equals `stripTypeScriptTypes(source, { mode: "strip", sourceUrl })` computed in the test; digests recomputed with `createHash` | A hook that changes native results, a capture that rereads mutable source instead of recorded bytes, a raw set missing the production URL, a `.cjs` accepted silently, a foreign loader accepted | Production exclusions, native thresholds, direct pins and existing assertions unchanged |
| 07-01-T2 | Selection patterns equal the quoted tokens of `package.json` `scripts.test`; argv equals the literal native flag list with and without `--test-concurrency`; inventory equals a hand-built five-entry list with digests and sizes; each negative control names its exact failure rows | A selection that differs from `npm test`, a silently omitted worker, a killed worker passing, an unregistered raw file accepted, an empty production tree passing, an unlisted module omitted, a child's override redirecting the parent run | Same |
| 07-01-T3 | Exact `loaded-bytes-differ` row with both digests; exact `drift` rows for added/removed/changed; readback accepts a fresh bundle and refuses eleven planted defects by kind; replacement runs leave unrelated files and the earlier run directory intact | Freshness by mtime or filename, a failed run leaving an accepted pointer, offset-shift repair of a changed source, cleanup touching unrelated files, a tampered pointer accepted | Same |

Partial/zero/error paths recorded: partial coverage (parity.ts), zero production inventory, zero workers (refused before execution), failed tests, externally killed worker, unregistered raw, foreign loader, unsupported format, mid-load edit, drift in three directions, eleven readback refusals.

## Files Created/Modified

- `scripts/coverage-capture.mjs` - the CLI: argument parsing, foreign-loader refusal, run directory creation and previous-pointer invalidation, pre-run inventory snapshot, runner environment and argv, outcome classification, process/raw/module reconciliation, manifest assembly, atomic publication, `--verify`
- `scripts/coverage-capture.runtime.mjs` - the `--import` preload: process registration, content-addressed source and executed stores, load records, format refusals
- `scripts/coverage-capture.manifest.mjs` - selection patterns, native flags, public paths, inventory enumeration and difference, tooling and runtime identity, foreign-loader token detection, atomic JSON write, readback verification
- `tests/scripts/coverage-capture.test.ts` - 34 controls
- `package.json` - `coverage:capture` script; the normal `test`/`check` path is unchanged until 07-08
- `.fallowrc.json` - `scripts/coverage-capture.runtime.mjs` added to `entry`

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64; recorded in every manifest and required equal on readback. Package `engines` unchanged. CI's Node 24 has not been exercised by this plan.
- Tooling digests recorded per run: `coverage-capture.mjs`, `coverage-capture.manifest.mjs`, `coverage-capture.runtime.mjs` (SHA-256 of the files next to the manifest module).
- Real-run identities: invocation digest `10bc00aa16686735...`, inventory digest `988dc340a3716bdd...`, LCOV digest `244671064069f3de...`.
- No dependencies added; nothing under `node_modules` is touched or recorded.

## Decisions Made

See `key-decisions` above. Two worth restating:

- Node writes a V8 coverage file even when a process signals itself (`process.kill(process.pid, "SIGKILL")`), because `process.kill` runs the exit hooks first. Only an external SIGKILL leaves a worker without an exit record and without a raw file, so the interrupted-worker control has a child kill its parent.
- `--experimental-transform-types` is not accepted by Node 26 at all (`bad option`), so the foreign-loader controls use a foreign `--import` in `NODE_OPTIONS` and a `--require` preload on the capture process; the refusal list still names the transform flag and `--no-strip-types` for runtimes that accept them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declared the runtime preload as a fallow entry point**

- **Found during:** Task 1 (pre-commit `npm fallow`)
- **Issue:** `fallow dead-code` reported `scripts/coverage-capture.runtime.mjs` as an unused file: it is loaded through `NODE_OPTIONS=--import` and no module imports it, so it is unreachable from every package-script entry point
- **Fix:** added it to `entry` in `.fallowrc.json` (a root declaration, not a suppression marker); `.fallowrc.json` was not in the plan's file list
- **Files modified:** `.fallowrc.json`
- **Verification:** `npm run fallow` exit 0; `tests/architecture/fallow-production-mode.test.ts` overrides `entry` in its fixtures, so it is unaffected
- **Committed in:** `3bebe6ec`

**2. [Rule 1 - Bug] The foreign-import control leaked a raw record into an enclosing capture**

- **Found during:** the real-population capture after Task 3
- **Issue:** the control replaces `NODE_OPTIONS`, which sheds an outer capture's runtime, while the CLI child still inherited the outer `NODE_V8_COVERAGE`; the outer run refused it as `unregistered-capture` (the refusal itself was correct)
- **Fix:** the control empties `NODE_V8_COVERAGE` too
- **Files modified:** `tests/scripts/coverage-capture.test.ts` (plus a naming cleanup in `scripts/coverage-capture.mjs`)
- **Verification:** second real capture exit 0 and `--verify` exit 0
- **Committed in:** `53283c55`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened. `.fallowrc.json` gained one entry root.

## Issues Encountered

- A nested `node --test` inherits `NODE_TEST_CONTEXT` from its worker and then skips every file with a warning and exit 0, which is a wrong answer shaped like success. The CLI sheds `NODE_TEST_CONTEXT` and `NODE_TEST_WORKER_ID` before spawning the runner, and the native reference in the test does the same.
- `pre-commit`'s `npm format check` fails on `.planning/config.json`, an uncommitted edit by the orchestrator (it reflows one array). It is outside this plan and was left untouched; every file in this plan passes `prettier --check`.

## Known limits

- `stripTypeScriptTypes` prints `ExperimentalWarning: stripTypeScriptTypes is an experimental feature` once per process that strips TypeScript (302 lines on the full run). It is stderr noise only; the native outcomes and coverage were unchanged. No suite test asserts on the stderr of a nested process that loads TypeScript, so nothing broke. 07-08 can decide whether `--disable-warning=ExperimentalWarning` on the runner is acceptable.
- The full-population run directory is about 789 MB (raw V8 for 532 processes includes Node's internal scripts). It lives under the gitignored `coverage/runs/` and nothing prunes it; cleanup is deliberately limited to the two public files at the start of a replacement run.
- The inventory binds files under `extensions/`, `tests/` (minus `e2e`, `integration`, `live-uat`), `scripts/` and a fixed resource list. A resource a test reads through `fs` from outside those roots is not bound.
- `launch`, runner-level `signal` and `reused-run` refusals are implemented but have no planted control: they cannot be produced deterministically from a fixture root without faking the Node executable.
- Native equivalence is proven on the fixture (byte-identical LCOV and raw ranges); the complete-population comparison against `npm run test:coverage:unit` is 07-07's stable measurement. The numbers above are evidence for the "can be captured once" criterion, not a certified baseline.
- Native LCOV function counts (1890) are Node's; they are not equated with future AST counts.
- A native reference run spawned from inside an enclosing capture registers as a raw-less nested process of that capture (its `NODE_V8_COVERAGE` points at the test's scratch directory). Expected and harmless.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: file-access | scripts/coverage-capture.runtime.mjs | The preload writes records to whatever `PI_CM_COVERAGE_RUN_DIR` names; it is set by the CLI to the run directory and inherited by children. A test may point a child at another directory (the override control), which keeps that child out of the parent run. The hook does not require the directory to be inside the root. |

## Next Phase Readiness

- 07-02 (producer qualification) can read `coverage/runs/<runId>/executed/<digest>` for the exact evaluated JavaScript and `sources/<digest>` for the original bytes of every loaded production module, and `inventory/<digest>` for the nine production sources no test loads.
- 07-05 owns the `accepted` state and must extend `verifyCaptureBundle` rather than re-deriving freshness.
- Repository state: five code commits on `features/test-backlog`; `.planning/STATE.md`, `.planning/config.json`, `.planning/state.json`, `.claude/settings.json`, `.codex/config.toml`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted orchestrator/operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-17*

## Self-Check: PASSED

All four created files exist on disk and all five task commits (83c41ceb, 3bebe6ec, 93d2e3b2, 1c97278e, 53283c55) are in `git log`.

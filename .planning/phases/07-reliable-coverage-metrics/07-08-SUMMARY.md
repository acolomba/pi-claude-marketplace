---
phase: 07-reliable-coverage-metrics
plan: "08"
subsystem: testing
tags: [coverage, crap, fallow, node-test, pre-commit, ci, sonar, npm-scripts]

# Dependency graph
requires:
  - phase: 07-07
    provides: "The certified measurement (07-MEASUREMENT.md sections 1 to 8) with every activation condition met on bundle 4402189b, and the accepted-bundle readback that refuses summary-mismatch"
  - phase: 07-06
    provides: "coverage:risk, the shipped policy (30, Fallow 3.23.0) and coverage:risk:negative"
  - phase: 07-05
    provides: "coverage:unit:verified (coverage-unit.mjs), coverage:validate and coverage:unit:negative"
  - phase: 07-01
    provides: "coverage-capture.mjs and the one authoritative UNIT_TEST_PATTERNS selection in coverage-capture.manifest.mjs"
provides:
  - "npm run check runs the unit suite exactly once, through test:coverage:unit (the verified capture), then coverage:unit:negative, coverage:risk and coverage:risk:negative; npm test is no longer a chain member and every earlier gate is retained"
  - "npm test runs the same selection through coverage-capture.mjs --plain (no coverage, no capture, --test-* runner options forwarded), so ordinary and captured execution share one glob"
  - "coverage:unit:current (coverage-unit.mjs --reuse-current): the producer's orchestration step that reuses an accepted bundle only when coverage-validate.mjs accepts it now and captures anew otherwise; consumers never reuse or regenerate"
  - "Two pre-commit hooks, npm-coverage-unit then npm-coverage-risk, whole-project, triggered on the inventory an accepted bundle binds"
  - "CI: the check and sonarcloud jobs qualify the vendored producer on their runner (provenance verify + conformance corpus) before capturing; the pre-commit job runs the hooks; ceilings raised to 30 minutes; Sonar still reads only coverage/unit.lcov"
  - "tests/architecture/coverage-metrics-pipeline.test.ts (30 cases) and the shared hook reader tests/architecture/pre-commit-hooks.ts"
  - "docs/coverage-metrics.md: where the commands run, what a stale bundle looks like and how to refresh it, how to move the producer to another release; 07-MEASUREMENT.md section 9: the activation record on the final tree"
affects: [phase-close, verification, ci]

# Actuals (#2632) -- chars/4 over the realized diff (88315 chars, 15 files, +1213/-150), never a harness token count.
actuals:
  tokens: 22079
  tasks: 3
  commits: 4
  plan_head_before: a41959c59aedcfe5f696ab7f948dea48170a3ab9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One unit launch per check: the chain's unit execution is the verified capture; a second launcher (npm test, coverage:capture, coverage:unit:current) in the chain is a gate finding"
    - "Producer reuses, consumer refuses: only the orchestration step (--reuse-current) may skip a capture, and only after the full consumer readback accepts the published bundle; a consumer handed a stale bundle exits 1 and writes nothing"
    - "Wiring gates run every structural predicate against planted violations (chain order, workflow step order, Sonar input), so a green case proves the predicate fires"
    - "Each CI job that consumes a capture makes its own on its own runtime and qualifies the installed producer there first; no job reads another job's bundle"

key-files:
  created:
    - tests/architecture/coverage-metrics-pipeline.test.ts
    - tests/architecture/pre-commit-hooks.ts
  modified:
    - package.json
    - .pre-commit-config.yaml
    - scripts/coverage-unit.mjs
    - scripts/coverage-capture.mjs
    - .github/workflows/ci.yml
    - .github/workflows/lint.yml
    - .github/workflows/sonarcloud.yml
    - sonar-project.properties
    - docs/coverage-metrics.md
    - .planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md
    - tests/architecture/unit-suite-glob-completeness.test.ts
    - tests/architecture/unused-type-member-gate.test.ts
    - tests/scripts/coverage-capture.test.ts

key-decisions:
  - "test:coverage:unit delegates to coverage:unit:verified and is the chain's one unit launch; npm test becomes coverage-capture.mjs --plain so the selection has one definition (D-10)"
  - "The pre-commit producer hook runs coverage:unit:current: reuse only after coverage-validate.mjs accepts the published accepted bundle against the staged tree; a captured-only bundle, a refused readback or no bundle means a fresh run. The consumer hook runs coverage:risk unchanged and never captures"
  - "The hook trigger is the bundle's inventory (extensions/**, tests/** minus e2e/integration/live-uat, scripts/**, vendor/coverage/**, the nine resource files); workflows are not bundle inputs and keep their own gate"
  - "CI qualifies the producer per runner with the existing coverage:producer:build -- --verify and coverage:producer:check before any capture, instead of trusting the local Node 26 evidence for Node 24; ceilings of the check and pre-commit jobs go to 30 minutes"
  - "The lint.yml pre-commit job runs the coverage hooks (its own capture) rather than skipping them; sharing ci.yml's bundle would mean consuming an artifact the job cannot verify"
  - "Superseded run directories (07-07's 4402189b, the refused a047b707 and the three hook runs) were pruned after their identities were recorded; the published run is e88ba46e"
  - "Commit scopes follow the repository's Conventional Commits rule (test/feat/ci/docs with the coverage scope), not the GSD {phase}-{plan} scope"

patterns-established:
  - "Hook reader shared by gates: tests/architecture/pre-commit-hooks.ts reads the repo: local hooks in file order so a gate can pin which hook runs first"
  - "Workflow step parser in the wiring gate reads inline run: values and run: | blocks by indentation; qualification order is asserted as command order"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "npm run check runs the unit suite once through the verified capture, validates it and consumes the CRAP policy after it, with every earlier gate kept; a missing or stale bundle cannot make the consumer succeed or regenerate anything"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/architecture/coverage-metrics-pipeline.test.ts#the check chain launches the unit suite once through the verified capture and consumes its risk after it"
        status: pass
      - kind: unit
        ref: "tests/architecture/coverage-metrics-pipeline.test.ts#the consumer refuses a stale bundle without regenerating it"
        status: pass
      - kind: unit
        ref: "tests/architecture/coverage-metrics-pipeline.test.ts#the reusable producer captures once and reuses the accepted bundle of an unchanged tree"
        status: pass
      - kind: integration
        ref: "npm run check on e4ca798a (exit 0, 1287 s; capture e88ba46e, coverage:risk passed inside the chain)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CI and pre-commit run the same ordered pipeline with the producer qualified on the runner, and Sonar reads only the native coverage/unit.lcov"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/architecture/coverage-metrics-pipeline.test.ts#CI qualifies the producer on its runner before the check chain accepts a capture"
        status: pass
      - kind: unit
        ref: "tests/architecture/coverage-metrics-pipeline.test.ts#Sonar reads the native unit LCOV of the verified capture and nothing else"
        status: pass
      - kind: other
        ref: "npm run lint:workflows && npm run lint:workflows:negative (exit 0 / 0); SKIP=trufflehog pre-commit run --files on the workflows (yamllint, yamlfmt, zizmor, workflow gate all passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The final tree keeps native production coverage at exactly 100 percent, the policy-30 verdict, the direct pins and the certified denominators through the activated path"
    requirement: METRIC-02
    verification:
      - kind: integration
        ref: "capture e88ba46e inside npm run check: native 63825/63825 lines, 1890/1890 functions, 9234/9234 branches; syntax 1865/1865, 10392/10393, 6633/6653; coverage:risk 0 of 1865 at or above 30, max 20.00; npm run test:coverage:direct:all exit 0, 239 pairs, 2 pinned shortfalls matched exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/coverage-metrics.md describes where the commands run, the refusal rows and the producer update procedure for a reader outside the phase"
    verification: []
    human_judgment: true
    rationale: "Prose adequacy is a judgment; the facts in it are the ones the wiring gate and the measurement record pin"

# Metrics
duration: 2h 21m
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 08: Activate the coverage-risk pipeline in check, pre-commit and CI Summary

**`npm run check` now runs the unit suite exactly once through the verified capture and applies the CRAP policy of 30 after it, `npm test` and the capture share one selection, two pre-commit hooks run a reusing producer before a never-reusing consumer, each CI job captures on its own runner after qualifying the producer there, Sonar still reads only the native LCOV, and the final activated chain exited 0 in 21 min 27 s with native 100 percent and 0 of 1865 functions at or above 30.**

## Performance

- **Duration:** 2h 21m (four full unit captures of 6 to 8 minutes each inside the pre-commit hooks and the final chain, one 21-minute `npm run check`, one 8-minute direct-pair run, and about 70 minutes of pre-commit pipeline time across four commits)
- **Started:** 2026-09-18T18:34:49Z
- **Completed:** 2026-09-18T20:56:00Z
- **Tasks:** 3
- **Files modified:** 15 (2 created, 13 modified)

## Accomplishments

- **One unit launch per check.** `test:coverage:unit` runs `coverage:unit:verified`; the chain runs it after the direct-coverage negative controls and follows it with `coverage:unit:negative`, `coverage:risk` and `coverage:risk:negative`, then the integration tests and the type-member gates. `npm test` left the chain; every other member stayed. `npm test` itself now runs `coverage-capture.mjs --plain`, the same `UNIT_TEST_PATTERNS` under the runner alone with `--test-*` options forwarded (`npm test -- --test-name-pattern=<regex>` ran one matching case across 311 files in 27 s).
- **Producer reuses, consumer refuses.** `coverage-unit.mjs --reuse-current` reports the published bundle as reused only when it is `accepted` and `coverage-validate.mjs` accepts it now; a captured-only bundle, a refusal or no bundle runs the four steps. The refusal rows are relayed so the reader sees why a fresh run follows. `check-coverage-risk.mjs` is unchanged: it exits 1 on a missing or stale bundle, creates no run directory and leaves a bare `coverage/unit.lcov` at the inherited path unread.
- **Pre-commit runs the same path.** `npm-coverage-unit` (`coverage:unit:current`) then `npm-coverage-risk` (`coverage:risk`), both `pass_filenames: false`, both triggered by the inventory an accepted bundle binds and by nothing else (workflows keep their own gate). The hooks ran on every code commit of this plan: the first run of the implementation commit refused its fresh capture because a new unit test failed, which is the designed outcome, and the consumer refused with `missing-manifest`; the later runs accepted.
- **CI captures per runner.** The `check` job and the `sonarcloud` job run `coverage:producer:build -- --verify` and `coverage:producer:check` before `npm run check` and `npm run test:coverage`, so the installed producer's provenance and conformance are proved on the runner's Node 24 before any artifact is accepted there. The `pre-commit` job of `lint.yml` runs the two hooks through `--all-files` and makes its own capture. Ceilings of the `check` and `pre-commit` jobs are 30 minutes. `sonar.javascript.lcov.reportPaths=coverage/unit.lcov` is unchanged; the LCOV is Node's own, published only from an accepted bundle.
- **The wiring is a gate.** `tests/architecture/coverage-metrics-pipeline.test.ts` pins the chain order and its single unit launch, the script wiring, the hook order and trigger, the plain and reuse modes on fixture roots, the consumer's refusals, the CI qualification order, the Sonar input and the Node family; every structural predicate also runs against planted violations (a second unit launch, the consumer ahead of the producer, a retired gate, a missing negative runner, a chain without qualification, a qualification after the chain, a merged Sonar input).
- **The final gates are current.** `npm run check` on the final code tree (`e4ca798a`): exit 0 in 1287 s; its capture `20260918T202613550Z-e88ba46e` recorded the certified denominators exactly (native 63825/63825, 1890/1890, 9234/9234; syntax 1865/1865, 10392/10393, 6633/6653), zero `DA:...,0`/`BRDA:...,0`/`FNDA:0,...` entries, and `coverage:risk` passed with 0 of 1865 at or above 30, max 20.00, the same histogram and the same single partial function (`collectCommandFile`, 16/17, 6.0073). `npm run test:coverage:direct:all`: exit 0 in 494 s, 239 pairs, 2 pinned shortfalls matched exactly.

## Task Commits

1. **Task 1 (tracer, TDD): Integrate one authoritative unit capture into the local check order** - RED `037801d3` (test: the wiring gate, 13 of 19 cases failing on the planned behavior, `RED_EVIDENCE_OK`), GREEN `14658799` (feat: scripts, hooks, plain and reuse modes, the two rewired tests)
2. **Task 2: Use the same tested pipeline in CI and preserve Sonar's native input** - `e4ca798a` (ci: producer qualification per runner, ceilings, Sonar comment, 11 more gate cases)
3. **Task 3: Verify final gates and publish the supported measurement contract** - `dd4cd41c` (docs: `docs/coverage-metrics.md` and `07-MEASUREMENT.md` section 9)

**Plan metadata:** the `docs:` commit that adds this file and one WINDOWS ledger row.

Tracer feedback gate (interactive, `human_verify_mode: end-of-phase`, automated-only verify): after the GREEN commit, `node --test tests/architecture/coverage-metrics-pipeline.test.ts && npm run coverage:unit:negative && npm run coverage:risk:negative` re-ran on the committed tree: 19/19, 32 of 32, 20 of 20, exit 0 in 75 s; expansion continued without a checkpoint.

## Exact commands and results

| Command | Result |
| --- | --- |
| Precondition: `npm run coverage:validate` on the dispatch tree (`a41959c5`) | exit 0 in 6.1 s on 07-07's bundle `4402189b`; 07-MEASUREMENT.md 8.6 lists every activation condition met |
| RED: `node --test --test-reporter=tap tests/architecture/coverage-metrics-pipeline.test.ts` | exit 1, 19 tests, 6 pass, 13 fail (the six passing cases are the planted-predicate controls and the pre-existing `missing-manifest` refusal); `gsd-tools check tdd-red-evidence`: `RED_EVIDENCE_OK`, target "the check chain launches the unit suite once through the verified capture and consumes its risk after it" |
| GREEN: `node --test tests/architecture/coverage-metrics-pipeline.test.ts` | 19 pass, 0 fail (after two test-authoring fixes: the report regex needed the `m` flag because child output precedes the report line; the forwarded-option case needed a one-file fixture because the spec reporter counts a file with no matching test as one passed test) |
| Task 1 verify: `node --test tests/architecture/coverage-metrics-pipeline.test.ts && npm run coverage:unit:negative && npm run coverage:risk:negative` | 19/19; 32 of 32; 20 of 20; 75 s |
| Suites that read the changed files (14 files) | 294 pass, 0 fail (73 s); `coverage-capture.test.ts`, `coverage-unit.test.ts`, `unit-suite-glob-completeness.test.ts`, `unused-type-member-gate.test.ts` and the pipeline gate together: 87 pass |
| `npm test -- "--test-name-pattern=COV-04 npm test runs"` | exit 0 in 27 s; `node scripts/coverage-capture.mjs --plain --test-name-pattern=...`; 1 matching case ran |
| Pre-commit, RED files (3) | all hooks passed in 5 min 42 s (lint, format, typecheck, fallow, direct coverage, type members) |
| Pre-commit, GREEN files (7), first run | 18 min 56 s, exit 1: every older hook passed; `npm-coverage-unit` found the bundle stale (`tool-changed`, `tool-changed` acceptance, `stale-input` with the changed paths), captured anew and refused with `tests-failed` because `gate-targets.test.ts` D-07-06 found two production paths spelled in the new gate; `npm-coverage-risk` refused with `missing-manifest` |
| Fix | the gate spells its one production path through the registry (`NETWORK_FREE_TARGETS`); `gate-targets.test.ts` + the pipeline gate: 34 pass |
| Pre-commit, GREEN files (7), second run | 20 min 20 s, exit 0; `npm-coverage-unit` captured run `b20c5a35` and `npm-coverage-risk` passed |
| Task 2 verify: `node --test tests/architecture/coverage-metrics-pipeline.test.ts && npm run lint:workflows && npm run lint:workflows:negative` | 30 pass (after fixing the planted workflow builder to the real `- name:` / `run:` step shape); workflow gate passed; negative controls passed |
| Pre-commit, Task 2 files (5), first run | 13 min 30 s, exit 1: `npm fallow` health refused `commandsIn` at cognitive complexity 18 (limit 15); the coverage hooks passed (run `bd4ce1cd`) |
| Fix | the parser split into `commandsIn`, `runStep` and `blockLine`; `npm run fallow` exit 0 |
| Pre-commit, Task 2 files (5), second run | 13 min 22 s, exit 0 (run `e5578996`) |
| Task 3 verify: `npm run check` on `e4ca798a` | exit 0 in 1287 s (started 20:21:52Z); capture `e88ba46e`: 312 workers, 543 raw records, 618 modules, 9 unloaded; `Coverage unit verified ... native 63825/63825 line(s), 1890/1890 function(s), 9234/9234 branch(es); syntax 1865/1865 function(s), 10392/10393 statement(s), 6633/6653 branch arm(s)`; `Coverage risk verified: ... 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 ... policy < 30; 13092 other row(s) not gated` |
| `npm run test:coverage:direct:all` | exit 0 in 494 s; `All-pair run complete: 239 pairs in 493.6s`; `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly` |
| `npm run coverage:risk -- --report coverage/unit.risk.json` on `e88ba46e` | exit 0 in 11.6 s; histogram <5: 1394, 5-9.99: 377, 10-19.99: 88, 20-29.99: 6, >=30: 0; one partial function 6.0073; `failures` empty |
| `grep -c` of zero entries in `coverage/unit.lcov` | 0 |
| Prune of superseded runs, then `npm run coverage:validate` | `coverage/runs/` holds `e88ba46e` (810 MB); exit 0 |
| Pre-commit, docs (2 files) | mdformat padded the table on the first pass; second pass clean; trufflehog 0 / 0 on every commit's files |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-08-T1 | `chainFindings(check)` is `[]` and each planted chain yields its named finding; the five script strings are pinned literally; the two hooks are read in file order with `pass_filenames: false` and one trigger; the trigger matches 19 representative inputs and none of 8 non-inputs; plain mode on the population fixture: `{ status 0, tests 3, pass 3, fail 0, captured false }`, forwarded `--test-name-pattern=doubles` on a one-file root: `tests 1`, a failing test: `status 1, fail 1`, `--verbose`: status 2 and the exact usage line; reuse mode: verified then reused with one run directory, verified again with a new run id after a source or `package.json` change, verified (not reused) for a captured-only bundle; consumer after a source change: status 1, kinds `["validation"]`, same published run id, one run directory; consumer with a bare LCOV and no manifest: `missing-manifest`, LCOV bytes unchanged, no run directory | A chain that runs `npm test` and the capture both; `coverage:risk` before the capture; a retired gate; a consumer that captures when stale or reads the inherited LCOV; a producer that reuses a captured bundle or one the validator refuses; an `npm test` glob that drifts from the capture's | New tooling behavior only; `maxCrap: 0`, `.fallowrc.json`, the policy, the direct pin, the census pins and every existing assertion unchanged; no production source changed |
| 07-08-T2 | `qualificationFindings(commandsIn(ci.yml), "npm run check")` and the Sonar counterpart are `[]`; planted workflows without qualification, with it after the chain, or without the chain yield their findings, and a block-form qualification before the chain yields none; `sonar.javascript.lcov.reportPaths` is exactly one line `coverage/unit.lcov` and planted merged inputs are findings; `test:coverage` runs `test:coverage:unit` before the integration and e2e halves; every `node-version` in the three workflows is `"24"`; `lint.yml` has no `SKIP` | A job that consumes a capture without proving the producer on its runtime; Sonar fed integration or e2e LCOV; a Node family change; a pre-commit job that skips the coverage hooks | Configuration and gate cases only; `sonar-project.properties` keeps its report path; workflows keep `npm ci --ignore-scripts` and pinned action identities |
| 07-08-T3 | The final chain exits 0 with the capture's denominators equal to 07-MEASUREMENT.md section 4 field by field, zero LCOV zero-entries, `coverage:risk` at 0 of 1865 and max 20.00, the direct-pair run at 239 pairs with 2 pinned shortfalls matched; the documents no longer say the chain does not run the commands | Evidence from a run that predates a tested-input change; a denominator copied from 07-07 instead of measured; a threshold or pin moved to reach green | Documentation and measurement record only after the run; `docs/` and `.planning/` are not inventoried, so the evidence stays current |

Partial/zero/error paths recorded: the refused capture `a047b707` (`tests-failed`) and the consumer's `missing-manifest` after it; the `stale-input`/`tool-changed` rows that selected each fresh run; exit 2 with the exact usage line for a non-runner argument; a failing fixture test through plain mode; zero run directories after a consumer refusal; the fallow health refusal and the D-07-06 refusal as the two development-time failures, both fixed before the hook run that committed.

## Tool and source identities

- Runtime: Node v26.8.2 (V8 14.6.202.34-node.28), linux x64, npm 11.19.1; Fallow 3.23.0; producer `ast-v8-to-istanbul` 1.0.6-project.1, payload `29377dc2bb113e40`.
- Final file digests (sha256, first 16): `scripts/coverage-capture.mjs` `38a0f883631d8dd9`, `scripts/coverage-unit.mjs` `783af4d545e374db`, `package.json` `82651404c4adc2da`, `.pre-commit-config.yaml` `5500c9e72cd1debf`, `sonar-project.properties` `4a25c100cd9a7085`, `.github/workflows/ci.yml` `2ddd1dd9c1689c57`, `lint.yml` `1c4bb6b23de036b1`, `sonarcloud.yml` `618327af54726f34`, `tests/architecture/coverage-metrics-pipeline.test.ts` `ee6437c098ba7905`, `tests/architecture/pre-commit-hooks.ts` `1044fdb72fc73e44`, `tests/architecture/unit-suite-glob-completeness.test.ts` `ee9d9946aa25557a`, `tests/architecture/unused-type-member-gate.test.ts` `4270183736a6fc93`, `tests/scripts/coverage-capture.test.ts` `074dcd35e87a9ab8`.
- Published bundle `20260918T202613550Z-e88ba46e` (accepted 2026-09-18T20:33:31Z): manifest `0354c37558e90999`, map `b62ee36aa1589112`, LCOV `9b11e54120f56e0b`, validation receipt `09d810296ef32bf1`, captured manifest `1379c4af0b703d2b`, inventory `0842aade8a157300` (239 production, 409 tests, 39 tooling, 18 resources).
- Capture tooling changed in `coverage-capture.mjs` only; acceptance tooling changed in `coverage-unit.mjs` only; the other capture and acceptance scripts carry the digests of 07-MEASUREMENT.md section 2. No dependency added or changed; `package-lock.json` untouched.

## Files Created/Modified

- `package.json` - `check` chain reordered around one unit launch; `test`, `test:coverage:unit`, `coverage:unit:current`
- `.pre-commit-config.yaml` - `npm-coverage-unit` and `npm-coverage-risk` hooks
- `scripts/coverage-capture.mjs` - `--plain` mode; `concurrencyArguments` shared with the capture
- `scripts/coverage-unit.mjs` - `--reuse-current`; `relayStderr`, `publishedState`, `currentAccepted`; `report` takes the verb
- `.github/workflows/ci.yml`, `sonarcloud.yml` - producer qualification step before the chain; 30-minute ceiling on `check`
- `.github/workflows/lint.yml` - 30-minute ceiling on `pre-commit` with the reason
- `sonar-project.properties` - comment on the verified capture as the LCOV's producer; report path unchanged
- `tests/architecture/coverage-metrics-pipeline.test.ts` - the wiring gate, 30 cases
- `tests/architecture/pre-commit-hooks.ts` - the shared `repo: local` hook reader
- `tests/architecture/unused-type-member-gate.test.ts` - imports the shared reader
- `tests/architecture/unit-suite-glob-completeness.test.ts` - expands the module's `UNIT_TEST_PATTERNS` against the tree; pins `npm test`
- `tests/scripts/coverage-capture.test.ts` - the expected selection patterns as literals
- `docs/coverage-metrics.md` - new commands in the invocation table; "Where the commands run", "When a command refuses a stale bundle", "Updating the producer"; runtime paragraph
- `.planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md` - section 9 (activation) and the run-directory cell of section 2

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Structure] Five files outside the plan's list**

- **Found during:** Task 1
- **Issue:** the plan lists `package.json`, `.pre-commit-config.yaml`, `scripts/coverage-unit.mjs` and the new gate. The plain mode the plan names as its example lives in `scripts/coverage-capture.mjs`; the hook reader the gate needs was inline in `tests/architecture/unused-type-member-gate.test.ts` and would have been a duplicate `fallow dupes` finding; `tests/architecture/unit-suite-glob-completeness.test.ts` and `tests/scripts/coverage-capture.test.ts` scraped the unit glob out of `package.json` and broke once `npm test` delegated to the module.
- **Fix:** `--plain` in `coverage-capture.mjs`; `tests/architecture/pre-commit-hooks.ts` imported by both gates; the two tests read the authoritative selection (the completeness gate expands the module's patterns through a child `node`, the capture test pins the two patterns literally). Recorded as WINDOWS row 58.
- **Verification:** 294 pass across the suites that read the changed files; the full chain exit 0
- **Committed in:** `037801d3` (reader), `14658799` (the rest)

**2. [Rule 1 - Bug] The new gate spelled production paths outside the registry**

- **Found during:** Task 1, first pre-commit run of the GREEN files
- **Issue:** the hook-trigger case listed two production paths as literals; `gate-targets.test.ts` D-07-06 refused them, the fresh capture inside the hook refused with `tests-failed`, and the consumer hook refused with `missing-manifest`
- **Fix:** the case spells one production path through `NETWORK_FREE_TARGETS`, annotated `(typeof NETWORK_FREE_TARGETS)[number]`
- **Verification:** `gate-targets.test.ts` and the pipeline gate 34 pass; the second hook run accepted
- **Committed in:** `14658799`

**3. [Rule 1 - Bug] The workflow parser exceeded the cognitive-complexity ceiling**

- **Found during:** Task 2, first pre-commit run
- **Issue:** `fallow health` refused `commandsIn` at cognitive 18 (limit 15)
- **Fix:** split into `commandsIn`, `runStep` and `blockLine`
- **Verification:** `npm run fallow` exit 0; 30 pass; the second hook run accepted
- **Committed in:** `e4ca798a`

**4. [Process] Superseded run directories pruned**

- **Found during:** Task 3
- **Issue:** `coverage/runs/` held six runs (4.8 GB): 07-07's certified `4402189b`, the refused `a047b707`, the three hook runs and the final `e88ba46e`
- **Fix:** removed all but `e88ba46e` after recording their identities in 07-MEASUREMENT.md 9.4; `coverage:validate` exit 0 afterwards
- **Committed in:** not a commit (gitignored)

---

**Total deviations:** 4 (1 structural, 2 bugs in new test code, 1 process).
**Impact on plan:** No coverage configuration, census pin, threshold, suppression, direct pin or `.fallowrc.json` value was weakened; `maxCrap: 0` stays disabled and the policy stays 30; no production source under `extensions/` changed; no dependency changed. The structural deviation removes a glob duplication the plan asked to remove.

## Issues Encountered

- The spec reporter counts a test file with no test matching `--test-name-pattern` as one passed test, so a multi-file fixture cannot assert `tests 1`; the forwarded-option case uses a one-file root.
- `coverage-unit.mjs` streams the child steps' stdout before its own report line, so the gate's report regex reads with the `m` flag.
- pre-commit's `entry` is executed without a shell, so the producer and the consumer are two hooks rather than one `a && b` entry; hook order in the file is what the gate pins.
- pre-commit prints a hook's output only on failure, so the accepted runs of the hooks are identified by the manifests they published, not by the log.

## Known limits

- Every figure here is Node v26.8.2. CI's Node 24 makes its own capture on the first push that reaches the workflows and qualifies the producer there first; the Node merge limit of 07-MEASUREMENT.md 8.1 applies by source identity.
- A commit that touches any inventoried file now costs one full unit run in pre-commit (about 7 to 8 minutes) unless `npm run check` or an earlier hook run already published a bundle of exactly those bytes; `coverage:unit:current` says which of the two happened.
- The `check` job's local wall time is 21 min 27 s; its CI ceiling is 30 minutes and has not yet been exercised on a runner.
- Run directories are not pruned automatically; each capture adds about 810 MB under `coverage/runs/`.
- The ten reachable implicit-else arms of 07-MEASUREMENT.md 8.3 remain reported, not tested; unchanged by activation.

## Threat Flags

None new. `--plain` spawns `node --test` with the same selection and the developer's own `--test-*` options; `--reuse-current` spawns the existing validator and reads the manifest the pipeline already reads; no new network, file or authentication surface.

## Next Phase Readiness

- The phase's activation is complete: the pipeline runs in `npm run check`, in pre-commit and in the three CI jobs; 07-MEASUREMENT.md section 9 records the final measurement on the activated path.
- For the verifier: `npm run check` (exit 0, 1287 s) and `npm run test:coverage:direct:all` (exit 0, 494 s) ran on the final code tree `e4ca798a`; the two later commits touch only `docs/` and `.planning/`, which are not inventoried, so `coverage:validate` still exits 0 on `e88ba46e`. Spot-check with `npm run coverage:validate` and `node --test tests/architecture/coverage-metrics-pipeline.test.ts`; re-running the whole chain repeats the evidence.
- CI has not run the activated workflows yet (the branch is `features/test-backlog`; CI triggers on `main` pushes and pull requests). The first PR run exercises the Node 24 capture and the 30-minute ceilings.
- Repository state: four code/doc commits on `features/test-backlog`; `.planning/WINDOWS.md` gained row 58 (committed with this file); `coverage/runs/` holds one run (810 MB); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-18*

## Self-Check: PASSED

Both created files exist on disk and all four commits (037801d3, 14658799, e4ca798a, dd4cd41c) are in `git log`; `commits: 4` was measured as `git rev-list --count a41959c5..HEAD`.

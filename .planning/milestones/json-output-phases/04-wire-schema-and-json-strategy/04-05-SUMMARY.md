---
phase: 04-wire-schema-and-json-strategy
plan: "05"
subsystem: notifications
tags: [wire-payload, json-schema, catalog-uat, wire-08, jout-02]

requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: presentNotification, toWirePayload over presentations and raw surfaces, the 18-kind NOTIFICATION_PAYLOAD_SCHEMA, redaction at every serialization site
provides:
  - fixture-maps.ts, the catalog fixture list the byte contract and the wire proof share
  - a present hook on CatalogFixture for the four emit-driven fixtures
  - catalog-wire.test.ts, the JOUT-02 / WIRE-01 / WIRE-05 validation and the WIRE-08 payload walk, each with controls
affects: [json-output]

actuals:
  tokens: 7700
  tasks: 2
  commits: 2
plan_head_before: d86a1e4033890038c3cb91c8e8cf9fb3b5047ee6
plan_head_after: d8d213a03c7653c75278a335d29920e02a2011db

tech-stack:
  added: []
  patterns:
    - "A catalog-wide proof presents each fixture once at module level, so the strict three-read Pi mock proves no presentation repeats"
    - "Validation reads JSON.parse(JSON.stringify(payload)); a separate walk reads the unserialized payload for what a round trip would hide"
    - "Planted-control assertions name the exact schema error or walk finding, so a control cannot pass for a different reason"

key-files:
  created:
    - tests/architecture/catalog-uat/fixture-maps.ts
    - tests/architecture/catalog-uat/catalog-wire.test.ts
  modified:
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/fixture-types.ts
    - tests/architecture/catalog-uat/fixtures/plugin-list.ts
    - tests/architecture/catalog-uat/fixtures/plugin-update.ts

key-decisions:
  - "WIRE-08: the walk's path pattern is redactAbsolutePaths' pattern plus a bare UNC root (\\\\server\\share), which the redactor does not match"
  - "WIRE-08: the planted path, Error, and undefined offenders extend the prune committed-warning payload, the one catalog payload with a top-level cause chain"

patterns-established:
  - "An emit-driven catalog fixture supplies present(run), built with the same presenter and row policies as its emit seam"

requirements-completed: [JOUT-02, WIRE-08, WIRE-01]

coverage:
  - id: D1
    description: "Every catalog example (260) and one sample per raw kind (8) converts to a payload the compiled union accepts after a JSON round trip, in catalog order, with tuple-set equality"
    requirement: JOUT-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-wire.test.ts#JOUT-02: every catalog example and raw kind converts to a schema-valid payload"
        status: pass
    human_judgment: false
  - id: D2
    description: "The validation fails for a {} converter, a planted off-vocabulary reason, and a foreign raw-only member"
    requirement: JOUT-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-wire.test.ts#JOUT-02 control cases (3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WIRE-05 across the catalog: summary exactly on warning and error, noOp only on the two no-op tuples, content reasons on the two list emit rows"
    requirement: WIRE-01
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-wire.test.ts#WIRE-05 cases (3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No payload carries a path its text hides, a live Error, an undefined or null member, a function or symbol, or a non-finite number; planted offenders each yield one finding"
    requirement: WIRE-08
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-wire.test.ts#WIRE-08 cases (6)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase gate green on d8d213a0: full check, corpus 3134/0, catalog diff empty, pack lists the schema, schema regeneration leaves no diff"
    requirement: WIRE-01
    verification:
      - kind: other
        ref: "precommit-05-t2.log (scope full, PRECOMMIT_EXIT=0) and the gate commands below"
        status: pass
    human_judgment: false

duration: 67min
completed: 2026-10-03
status: complete
---

# Phase 4 Plan 05: Catalog-wide Wire Proof Summary

**Every one of the 260 catalog examples and every raw kind now converts to a payload the wire union accepts. A walk over those payloads finds no path the text hides, no live `Error`, and no absent member. A `{}` converter, a planted bad reason, a foreign member, and four planted walk offenders each make the proofs fail. The phase gate is green.**

## Performance

- **Duration:** about 67 min
- **Started:** 2026-10-03T19:50:55Z
- **Completed:** 2026-10-03T20:57:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `fixture-maps.ts` holds `FIXTURE_MAPS` (21 imports, same order), `mergeFixtureMaps`, and `tupleKey`. The contract test imports them. Its cases, pins, and `emit`/`notify` driving are unchanged, and it passes 4/4 (260 states, 39,143 bytes).
- `CatalogFixture.present?` is new. The two plugin-list emit fixtures present through `presentCascade` with `LIST_CONTEXT.rowPolicies`. The two update no-op fixtures present through `presentUpdateNoOp` with `UPDATE_CONTEXT.rowPolicies`. Both use the label and cardinality their `notify*WithContext` seam sets.
- `catalog-wire.test.ts` presents each fixture once at module level, in catalog order, and calls `verifyPi`. It then converts 268 payloads (260 examples and 8 raw samples) and validates each JSON round trip against `Compile(NOTIFICATION_PAYLOAD_SCHEMA)`. The raw table is a mapped type over `RawSurface["kind"]`.
- WIRE-05 holds across the catalog. `summary` appears exactly on warning and error structured payloads. `noOp: true` appears only on `all-up-to-date-noop` and `skip-partially-upgradable-bulk`. The `available` and `remote` emit rows carry `["installs disabled"]`.
- `walkPayload` reads each unserialized payload. It checks prototypes (only `Object.prototype` or `Array.prototype`), `undefined`/`null` members, function, symbol, and bigint values, non-finite numbers, and absolute paths missing from the text form.

## Task Commits

1. **Task 1: Every catalog example and raw kind validates against the one union**: `7be69820` (test). TASK_BASE `d86a1e4033890038c3cb91c8e8cf9fb3b5047ee6`.
2. **Task 2: No payload discloses a path its text hides or a live Error; phase gate**: `d8d213a0` (test). TASK_BASE `7be6982041f82cef59d044675afa2d811d7daa81`.

## Control Results

| Control | Result |
| --- | --- |
| Real converter | 0 failures, 268 converted (260 + 8), catalog order and tuple set equal the parsed catalog |
| `{}` converter | rejected: one failure per example and raw sample (268) |
| Planted off-vocabulary reason (`as never`) | rejected: exactly one failure, `planted section::off-vocabulary reason`, errors include `/marketplaces/0/plugins/0/reasons/0 must be equal to one of the allowed values` |
| Foreign raw-only member (`causeMessage` on a cascade) | rejected: exactly one failure, errors include `/causeMessage schema is false` |
| Walk over every real payload | 0 findings, visited 268 = payload count |
| Path-source marketplace info (positive control) | `$.source.absPath` detected with empty text, accepted with the catalog block |
| POSIX path mid-string in a cause link | rejected: exactly one finding |
| Windows path mid-string in a cause link | rejected: exactly one finding |
| `Error` instance member | rejected: exactly one finding (`[object Error] is not a plain object`) |
| `undefined` member | rejected: exactly one finding |

Mutation checks on the walk (temporary copies, deleted afterwards): disabling the text comparison failed 3 cases (the positive control and both path plants). Disabling the prototype check failed the `Error` case. Disabling the `undefined`/`null` check failed the `undefined` case.

## Phase Gate

All on the committed tree `d8d213a0` (tree `76a3c1e0`), Node v26.10.0:

| Command | Result |
| --- | --- |
| `npm run check` | reused: Task 2's pre-commit run (`SKIP=trufflehog pre-commit run --files tests/architecture/catalog-uat/catalog-wire.test.ts`, log `scratchpad/precommit-05-t2.log`, `check:changed --list` scope `full`, which runs `npm run check` and `test:coverage:direct:all`), `PRECOMMIT_EXIT=0`, on exactly the tree committed as `d8d213a0` with no other change |
| Corpus wrapper | `Corpus: 3134 present, 0 extra`, `CORPUS_EXIT=0` |
| `git diff --exit-code 4e6c568a -- docs/output-catalog.md` | empty (exit 0) |
| `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | 4/4 pass |
| `npm pack --dry-run --json` check | `packed: schema/claude-plugin.schema.json` |
| `npm run schema:generate && git diff --exit-code -- schema/claude-plugin.schema.json` | exit 0, no diff |

## Verification

- Task 1: typecheck clean. `catalog-wire`, `catalog-contract`, `catalog-parser`, and `gate-targets` pass (41 tests). ESLint on `tests/architecture/catalog-uat` is clean. `npx fallow dupes --fail-on-issues` and `npx fallow health` exit 0, and the dupes report names neither catalog test. The catalog diff is empty. `fallow audit` verdict: `warn`.
- Task 1 acceptance: `Compile(NOTIFICATION_PAYLOAD_SCHEMA)` is on one line of the wire test. `typebox/compile` is in neither production wire module. `present: (run)` appears twice in each fixture file. No `"extensions/pi-claude-marketplace/` literal is in the wire test or `fixture-maps.ts`.
- Task 2: `catalog-wire.test.ts` passes 13/13. ESLint is clean. `fallow dupes` and `fallow health` exit 0. `fallow audit` verdict: `warn`.
- Both task pre-commit runs used the full scope and exited 0 (`precommit-05-t1.log`, `precommit-05-t2.log`).

## Decisions Made

- The walk's path pattern adds a bare UNC root (`\\server\share`) to `redactAbsolutePaths`' roots, because the plan names UNC roots and the redactor matches only the `\\?\` long-path form.
- The planted offenders extend the `/claude:plugin prune::committed-warning` payload, whose top-level `cause.causeChain` is the cause link the plan asks to plant into.
- The raw `plugin-path-skipped` sample carries a POSIX path its text shows. The real-payload walk therefore also accepts a shown path on a raw kind.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The skip-partially-upgradable rows became one constant**
- **Found during:** Task 1
- **Issue:** The `present` hook needs the fixture's rows. The rows were written out twice inline (message and emit). A third copy would be a clone for `fallow dupes`.
- **Fix:** `SKIP_PARTIALLY_UPGRADABLE_ROWS` (`as const`) is read by the message, the `emit` closure, and `present`. The emit closure calls the same seam with the same values. The contract test (4/4, 260 states, 39,143 bytes) and the corpus (3134/0) prove the bytes did not change.
- **Files modified:** tests/architecture/catalog-uat/fixtures/plugin-update.ts
- **Commit:** 7be69820

**2. [Rule 3 - Blocking] The walk's `typeof` switch lists every remaining arm**
- **Found during:** Task 2 (ESLint `switch-exhaustiveness-check` rejected a `default`-free switch missing `bigint`, `function`, `symbol`, and `undefined`)
- **Fix:** Those four arms report a finding. This also reports a bigint, which no JSON payload can carry.
- **Commit:** d8d213a0

**3. The planted controls assert the exact rejection reason**
- The union reports every member's errors. So the planted-fixture and foreign-member cases also assert that the expected leaf error is in the list. A control therefore cannot pass because of some other rejection.

**Total deviations:** 2 auto-fixed (both blocking) and 1 strengthening. **Impact:** none on scope. Only test files changed, and the corpus and catalog did not move.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Issues Encountered

None.

## Requirements

`requirements.ready-ids` reports JOUT-02, WIRE-08, and WIRE-01 ready (3/3): no other plan of this phase declares them without a SUMMARY. This plan's own verification passed, so all three are marked complete.

## Next Phase Readiness

Every phase 4 plan is complete. Phase complete, ready for the orchestrator's review, verification, and `phase.complete`.

## Self-Check: PASSED

---
phase: 98-lifecycle-regression-and-contract-documentation
plan: 04
subsystem: testing
tags: [architecture-gate, node-test, typebox, closed-set, enumeration-equality]

# Dependency graph
requires:
  - phase: 98-lifecycle-regression-and-contract-documentation
    provides: "98-01 and 98-03 carrier results — the post-carrier closed sets this gate pins"
provides:
  - "tests/architecture/compat-01-no-expansion.test.ts — the single audit surface for the COMPAT-01 no-expansion promise"
  - "tests/helpers/source-scan.ts — shared repository-root, comment-stripping, and forbidden-surface scanning helper"
  - "PLUGIN_INSTALL_RECORD_SCHEMA exported from persistence/state-io.ts"
affects: [output-catalog amendments, any future closed-set or glyph addition, documentation reconciliation]

actuals:
  tokens: 4475
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enumeration-equality closed-set pins against hand-written literal member lists"
    - "Gate delegation through a shared non-test helper instead of importing a *.test.ts module"

key-files:
  created:
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/helpers/source-scan.ts
  modified:
    - tests/architecture/no-orchestrator-network.test.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts

key-decisions:
  - "The glyph pins are written as code-point escapes rather than the characters themselves, so the assertion states the code point instead of asking a reader to identify a character by eye"
  - "The helper exports exactly three runtime symbols; the COMPAT-01 gate composes its own read-and-strip helper over REPO_ROOT and stripComments rather than widening the shared module's surface"
  - "The header names the forbidden concurrency surfaces descriptively rather than by their API spelling, because the acceptance criteria negative-grep those spellings"

patterns-established:
  - "Enumeration equality over count pins: a count catches a member added, not one renamed or swapped; the two gates split the duty, with lengths owned by notify-closed-set-locks and membership owned here"
  - "Delegation is mechanical: a clause proven by another gate is documented in this file and pinned by asserting the other gate still lists the surface, never by importing that gate"

requirements-completed: [COMPAT-01]

coverage:
  - id: D1
    description: "The four closed sets are pinned by enumeration equality against hand-written literal member lists, in declared order"
    requirement: COMPAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: STATUS_TOKENS holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: PLUGIN_STATUSES holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: MARKETPLACE_STATUSES holds exactly its inherited members, in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each glyph constant is pinned to its exact code point and an eighth glyph export fails the gate"
    requirement: COMPAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: every glyph constant holds its inherited code point"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the notify module declares no eighth glyph export"
        status: pass
    human_judgment: false
  - id: D3
    description: "The persisted install record's key set is exactly its eight inherited fields, with no manifest-snapshot-shaped or orphan-shaped key"
    requirement: COMPAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the persisted install record holds exactly its inherited key set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: no manifest-snapshot or orphan field reached the install record"
        status: pass
    human_judgment: false
  - id: D4
    description: "The state schema version union is unchanged and the default state still writes the current version, proving no migration was introduced"
    requirement: COMPAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the state schema version union is unchanged"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the default state still declares the current schema version"
        status: pass
    human_judgment: false
  - id: D5
    description: "The network clause delegates to the orchestrator-network gate through a shared helper, with no test module importing another"
    requirement: COMPAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the network clause is covered by the orchestrator-network gate"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
    human_judgment: false
  - id: D6
    description: "The gate demonstrably fails under a deliberate closed-set mutation, so it is not asserting a tautology"
    requirement: COMPAT-01
    verification:
      - kind: other
        ref: "Mutation check: append \"mutation-probe\" to STATUS_TOKENS, run node --test tests/architecture/compat-01-no-expansion.test.ts, observe exit 1 and one red assertion, revert"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-10
status: complete
---

# Phase 98 Plan 04: COMPAT-01 No-Expansion Contract Gate Summary

**One architecture test now holds every structural clause of the no-expansion promise — four closed sets pinned by enumeration equality, seven glyph code points plus an eighth-glyph tripwire, the install record's key set, the state schema version union, and a network clause delegated through a shared scanning helper.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-10T03:35Z (approx.)
- **Completed:** 2026-08-10T04:05Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `tests/architecture/compat-01-no-expansion.test.ts` holds all eleven COMPAT-01 clauses in one readable file, with a header that narrates each clause, its requirement anchor, and the rationale for every non-obvious mechanic.
- The four closed sets are pinned by **enumeration equality** against hand-written literal member lists in declared order. A count pin catches an appended member; it does not catch a renamed or swapped one. The existing length pins in `notify-closed-set-locks.test.ts` are not duplicated — that file still owns the counts, this one owns membership.
- The persistence clauses read the record key set off the newly exported `PLUGIN_INSTALL_RECORD_SCHEMA` and the version union off `STATE_SCHEMA.properties.schemaVersion.anyOf`, so both pin the schema itself rather than a hand-maintained field list that would drift.
- The network clause **delegates**: `tests/helpers/source-scan.ts` now owns the read/strip/accumulate mechanic that both gates share, and the COMPAT-01 file asserts the orchestrator-network gate still lists both info surfaces among its targets. No test module imports another.
- The mandatory mutation check was performed and drove the gate red on exactly the mutated clause.

## Task Commits

1. **Task 1: Extract the source-scanning helper and delegate the existing network gate to it** — `defe9424` (refactor)
2. **Task 2: Author the COMPAT-01 no-expansion gate** — `1bee9f2e` (test)

## Files Created/Modified

- `tests/helpers/source-scan.ts` (new) — exports `REPO_ROOT`, `stripComments`, and `assertNoForbiddenSurface`; reads every target through `node:fs/promises` so no file can be silently skipped by a line tool.
- `tests/architecture/compat-01-no-expansion.test.ts` (new) — the eleven-case COMPAT-01 gate.
- `tests/architecture/no-orchestrator-network.test.ts` — mechanical extraction; keeps its target list, pattern list, test title, header rationale, and failure message. Case count unchanged at 1, before and after.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `PLUGIN_INSTALL_RECORD_SCHEMA` is now exported (the single production change in this plan). No production consumer imports it.

## Verification Results

| Check | Result |
|---|---|
| `node --test tests/architecture/no-orchestrator-network.test.ts` (before extraction) | exit 0, 1 case, 1 pass |
| `node --test tests/architecture/no-orchestrator-network.test.ts` (after extraction) | exit 0, 1 case, 1 pass — identical |
| `node --test tests/architecture/compat-01-no-expansion.test.ts` | exit 0, 11 cases, 11 pass |
| `node --test "tests/architecture/*.test.ts"` | exit 0, 343 tests, 342 pass, 0 fail, 1 skipped |
| `node --test "tests/persistence/*.test.ts"` | exit 0, 179 tests, 179 pass |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |

The single skip in the architecture suite is pre-existing and platform-conditional (`D-62-05: reapOrphans on non-Linux platform soft-skips SIGKILL`, skipped because this host is Linux). It is unrelated to this plan.

### Mandatory mutation check

`"mutation-probe"` was appended to the `STATUS_TOKENS` tuple in `shared/notify.ts`, immediately after the tail member `"remote"`.

- **Result:** `node --test tests/architecture/compat-01-no-expansion.test.ts` exited **1** — 11 tests, 10 pass, **1 fail**.
- **Red assertion:** `COMPAT-01: STATUS_TOKENS holds exactly its inherited members, in order` — an `AssertionError` whose `actual` carried the extra member against the hand-written `expected` list.
- **Blast radius:** exactly one clause went red; the other ten stayed green, confirming the pins are independent rather than coupled through a shared derivation.
- **Revert:** `shared/notify.ts` was restored from a pre-mutation copy and `git diff` on that file is empty. The full architecture suite and every static check were then re-run green (table above).

The gate therefore fails when a closed set grows, which is the property the enumeration pins exist to provide. A derived expected list would have stayed green here.

## Post-carrier verification of the pinned sets

The plan requires the gate to pin the **post-carrier** sets, not the lists quoted in the research document. Every literal list was re-read off the live constants in the working tree before it was written into the gate:

| Set | Live size | Carrier impact |
|---|---|---|
| `REASONS` | 38 | unchanged by 98-01 / 98-03 |
| `STATUS_TOKENS` | 24 | unchanged |
| `PLUGIN_STATUSES` | 19 | unchanged |
| `MARKETPLACE_STATUSES` | 7 | unchanged |
| glyph exports | 7 | unchanged |
| install-record keys | 8 | unchanged |

Both carrier summaries record the same fact from their own side (98-01: "Zero additions to `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES` or the glyph exports"; 98-03: "Nothing was minted"). The gate's literals and the carriers' claims agree, and the gate is now the mechanism that keeps them agreeing.

## Decisions Made

- **Glyph pins written as code-point escapes.** `"●"` rather than the character. Several of these glyphs are visually near-identical at a glance; the escape makes the assertion state the code point rather than relying on the reader to identify a character.
- **The shared helper exports exactly three runtime symbols.** The COMPAT-01 gate composes a small local `readStrippedSource` over `REPO_ROOT` and `stripComments` instead of widening the helper with a fourth export, keeping the helper's surface at what the plan specified.
- **The helper's failure message is a callback, not a string.** `assertNoForbiddenSurface` takes `(offenders) => string` so the network gate keeps its own requirement-anchored wording byte-identically after the extraction, which is what makes the extraction mechanical rather than behavior-changing.
- **The header names concurrency-forbidden surfaces descriptively.** Spelling the API names in the "MUST NOT be added" paragraph would have defeated the negative greps in the acceptance criteria; the paragraph says so explicitly so the wording is not "corrected" later.

## Deviations from Plan

**None** — plan executed as written. Two in-flight corrections are worth recording as execution notes rather than deviations, because both were self-inflicted authoring errors caught before commit:

1. **A literal NUL byte was written into the gate's header** while describing the escape-sequence finding — precisely the hazard that paragraph documents. It was replaced with its `\u0000` escape spelling before any commit; the committed file contains zero NUL bytes.
2. **The glyph assertions were first authored with literal glyph characters** while the adjacent comment claimed escapes. Converted to escapes so the code and its rationale agree.

## Issues Encountered

- **`npm run typecheck && npm run lint && npm run format:check` exceeds the 120s foreground budget** on this host. Runs were moved to background jobs with direct exit-code capture rather than piping, so no exit code was masked.
- **The worktree trufflehog pre-commit hook fails structurally**, as CLAUDE.md documents: `.git` is a file in a linked worktree, so the git-mode scan cannot read an index. Both commits were preceded by a clean `trufflehog filesystem ... --results=verified,unknown --fail` pass over exactly the staged paths (0 verified, 0 unverified), and only `trufflehog` was skipped. Every other hook passed, including `npm lint`, `npm format check`, and `npm typecheck`.

## Known Stubs

None. Every clause in the gate performs a real assertion against a live constant or a live source read; the mutation check proves the closed-set clauses can fail.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- COMPAT-01 is enforced. Any future addition to a closed set, a glyph, the install record, or the state schema version union now fails a named test and forces a deliberate amendment alongside its catalog row and renderer arm.
- `tests/helpers/source-scan.ts` is available to any further source-scanning gate; a third gate should import it rather than re-implement the mechanic.
- The documentation reconciliation work can rely on the gate's literal lists as the authoritative post-carrier vocabulary.

## Self-Check: PASSED

- Files claimed created/modified: all 4 present on disk, plus this summary.
- Commits claimed: `defe9424` and `1bee9f2e` both present in `git log`.
- `PLUGIN_INSTALL_RECORD_SCHEMA` confirmed exported from `persistence/state-io.ts`.

---
*Phase: 98-lifecycle-regression-and-contract-documentation*
*Completed: 2026-08-10*

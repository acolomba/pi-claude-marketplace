---
phase: 117-extension-entry-and-final-gate
plan: "04"
subsystem: testing
tags: [node-test, correspondence-gate, git-rename, architecture-suites]

requires:
  - phase: 116-edge-surface
    provides: the correspondence gate and its structural root exemption, which this plan relies on rather than amends
provides:
  - the cross-surface reason-parity supplement relocated to tests/architecture/ with a git rename at 95 percent
  - the materialization-gate supplement relocated to tests/architecture/ with a git rename at 100 percent
  - two correspondence-gate violations resolved, 7 down to 5, with no exemption entry created
affects: [117-12, correspondence-gate sweep, suite ownership]

actuals:
  tokens: 2247
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A supplement that spans production modules relocates to the architecture root; only a supplement with one owning module folds into that owner's mirrored suite."
    - "A move that also needs a specifier fix stays ONE commit: the pure-move half would not typecheck on its own, and git still records the rename."

key-files:
  created:
    - tests/architecture/cross-surface-reason-parity.test.ts
    - tests/architecture/integration-materialization-gate.test.ts
    - .planning/phases/117-extension-entry-and-final-gate/deferred-items.md
  modified: []

key-decisions:
  - "D-117-04a: both orphan supplements relocate to tests/architecture/ rather than fold into a mirrored owner, because each spans several production modules and none of them owns it"
  - "D-117-04b: each move is one commit carrying the move plus its specifier fix, not a move commit and a rewrite commit"

patterns-established:
  - "Ownership test for a supplement: name the production modules it imports and ask which one the claim belongs to. When the claim IS the relation between two or more of them, no module owns it and the architecture root does."
  - "Stage the rename BEFORE reading any rename-similarity gate: the gate reads the staged diff, so an unstaged read reports no rename and fails for the wrong reason."

requirements-completed: []

coverage:
  - id: D1
    description: "The cross-surface reason-parity supplement sits at tests/architecture/cross-surface-reason-parity.test.ts, every case intact, with its production specifiers shortened by the one level the move removes."
    requirement: "OWN-06"
    verification:
      - kind: unit
        ref: "node --test tests/architecture/cross-surface-reason-parity.test.ts (16 tests, 16 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "npm run typecheck (exit 0) — proves the depth change was not missed"
        status: pass
      - kind: other
        ref: "git diff --cached -M --summary -> rename tests/{orchestrators/plugin => architecture}/cross-surface-reason-parity.test.ts (95%)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The materialization-gate supplement sits at tests/architecture/integration-materialization-gate.test.ts as a pure move, every production specifier unchanged."
    requirement: "OWN-04"
    verification:
      - kind: unit
        ref: "node --test tests/architecture/integration-materialization-gate.test.ts (1 test, 1 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "git diff --cached -M --summary -> rename tests/{bridges => architecture}/integration-materialization-gate.test.ts (100%)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The correspondence gate names neither suite in any verdict — two orphan violations resolved without a gate change and without an exemption entry."
    requirement: "DEL-03"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs — 7 violations before, 5 after; neither suite name appears in the output"
        status: pass
      - kind: other
        ref: "git diff --quiet -- extensions/ package.json (exit 0) — no production or npm-script change bought the green"
        status: pass
    human_judgment: false
  - id: D4
    description: "No case in either suite was rewritten, merged, split or dropped, and the repository suite total is unchanged."
    verification:
      - kind: unit
        ref: "npm test — 5143 tests across 295 suites, 0 fail, identical to the pre-plan baseline"
        status: pass
      - kind: other
        ref: "git log --follow reaches d00eb1f6 (113-22) and 7f08ae31 (111-20) through the two renames"
        status: pass
    human_judgment: false

duration: 22 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 04: Relocate the two module-spanning supplements Summary

**Two orphan test suites moved to `tests/architecture/` as git renames at 95 and 100 percent similarity, dropping the correspondence gate from 7 violations to 5 without a gate change, an exemption entry, or a production edit.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-03T17:53:00Z (approx.)
- **Completed:** 2026-09-03T18:15:40Z
- **Tasks:** 2
- **Files modified:** 2 (both relocations; 1 additional planning file created)

## Accomplishments

- Relocated the cross-surface reason-parity supplement out of `tests/orchestrators/plugin/` into `tests/architecture/`, shortening its two production import specifiers by the one directory level the move removes. All 16 cases pass at the new path.
- Relocated the materialization-gate supplement out of `tests/bridges/` into `tests/architecture/` as a pure move — the suite sat two levels below the repository root and still does, so every production specifier is byte-identical. Its 1 case passes at the new path.
- Cut the correspondence gate's violation set from 7 to 5. Both resolutions come from the gate's existing structural root exemption (`nonCorrespondingRoots = {architecture, e2e, integration}` in `scripts/check-corresponding-tests.mjs`), so no exemption list, ownership registry or name-keyed opt-out was created — SUITE-04 stays intact.

## Why neither suite has a single owner

**`cross-surface-reason-parity.test.ts` spans `orchestrators/plugin/install.messaging.ts` and `shared/probe-classifiers.ts`.** It asserts that the install presenter's `narrowResolverReasons` and the shared classifier's `narrowResolverNotes` / `narrowUnsupportedKinds` emit the *same* token for the same on-disk condition — the claim is the equality between the two modules, so neither one of them owns it and folding it into either mirrored suite would file the contract under only half of its subject.

**`integration-materialization-gate.test.ts` spans `bridges/mcp/parse.ts`, `bridges/mcp/stage.ts` and `persistence/locations.ts`.** It drives `resolvePluginMcpServers`, then `prepareStageMcpServers` and `commitPreparedMcp`, then reads the scope-rooted `locationsFor` bundle to prove that an MCP-only install materializes no agent, command or skill target. The claim is about what the three steps do in combination, so no one module owns it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Relocate the cross-surface reason-parity supplement** — `34330cb0` (test)
2. **Task 2: Relocate the materialization-gate supplement** — `45cd2b5e` (test)

## Files Created/Modified

- `tests/architecture/cross-surface-reason-parity.test.ts` — the reason-parity supplement at its new path; only change is the two specifiers dropping from `../../../extensions/…` to `../../extensions/…`
- `tests/architecture/integration-materialization-gate.test.ts` — the materialization-gate supplement at its new path, content byte-identical
- `.planning/phases/117-extension-entry-and-final-gate/deferred-items.md` — records one out-of-scope discovery (below)

## Gate results

Each gate was run separately and its exit code read. `npm run check` was deliberately not used: its `format:check` link fails on the operator's pre-existing untracked files and short-circuits before the tests.

| Gate | Result |
| --- | --- |
| `node --test` on the reason-parity suite | 16 tests, 16 pass, 0 fail |
| `node --test` on the materialization-gate suite | 1 test, 1 pass, 0 fail |
| `npm run typecheck` | exit 0 |
| `npm exec -- eslint` on each moved path | exit 0 |
| `npm exec -- prettier --check` on each moved path | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 5143 tests, 295 suites, 0 fail — unchanged from the measured baseline |
| `node scripts/check-corresponding-tests.mjs` | 7 violations before, 6 after Task 1, 5 after Task 2; neither suite named in any verdict |
| relocation-history scan on each moved file | no match |
| old paths | both absent |
| `git diff --quiet -- extensions/ package.json` | exit 0 after both tasks |
| staged rename summary | 95% (reason-parity), 100% (materialization-gate) |

The rename gate reads the STAGED diff, so each task staged its literal paths first and only then ran the verify block. `git log --follow` now reaches back through both moves — to `d00eb1f6` (113-22) for the reason-parity suite and `7f08ae31` (111-20) for the materialization-gate suite.

Both commits were preceded by a trufflehog **filesystem** scan of the literal path (git-mode aborts structurally in this linked worktree): 1 chunk / 4690 bytes and 1 chunk / 4299 bytes, both `verified_secrets: 0` and `unverified_secrets: 0`. Hooks then ran via `SKIP=trufflehog,npm-format-check pre-commit run --files <path>`, all Passed. `--no-verify` was never used and `SKIP=` was never extended beyond those two.

## Decisions Made

- **D-117-04a — relocate, do not fold.** D-117-01 folds a supplement into the mirrored owner of the module it measures, and relocates only when the supplement spans modules. Reading both suites confirmed the span case for each (see above), so both relocate.
- **D-117-04b — one commit per move, not two.** The 116-17 rule splits a move from a total rewrite so git can still see the rename. It does not apply here: the reason-parity move needs a two-character specifier fix, and the pure-move half would leave the suite importing a path one level too deep and would not typecheck. Kept as one commit each; git recorded 95 percent and 100 percent similarity, well above the threshold, and the gate is falsifiable — a move plus a total rewrite, and an edit with no move, both report no rename.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Out-of-scope discovery (logged, not fixed):** the doc comment on `isHooksResolverNote` in `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` pins the cross-surface parity contract to `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`, the path Task 1 vacated. Correcting it is a production edit, which this plan forbids and which both of its verify blocks assert against (`git diff --quiet -- extensions/ package.json`). Recorded in `.planning/phases/117-extension-entry-and-final-gate/deferred-items.md` and in the `.planning/WINDOWS.md` ledger for the 117-12 sweep. Impact is documentation only — no gate reads the cited path, and the pinning suite still runs, at its new location.

**Requirements not swept:** `requirements.ready-ids` reports 0 of 3 ready (OWN-06, OWN-04, DEL-03 are each declared by more than one plan in this phase). `REQUIREMENTS.md` is untouched, as the phase's shared-ID gate intends; D-117-12 owns the final sweep.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The correspondence gate now reports 5 violations: `missing-test: tests/index.test.ts`, and unexpected tests at `tests/edge/index-handler.test.ts`, `tests/orchestrators/marketplace/cascade.test.ts`, `tests/shared/device-flow-prompt.test.ts` and `tests/shared/index-smoke.test.ts`. Those are the remaining plans' subjects.
- `tests/architecture/` is the established home for cross-module evidence; a later plan adding such a suite should place it there rather than seek an exemption.
- No blockers.

## Self-Check: PASSED

- `tests/architecture/cross-surface-reason-parity.test.ts` — FOUND
- `tests/architecture/integration-materialization-gate.test.ts` — FOUND
- commit `34330cb0` — FOUND
- commit `45cd2b5e` — FOUND

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*

---
phase: 04-variable-expansion-at-claude-code-parity
plan: 06
subsystem: packaging
tags: [peer-range, adapter-contract, docs]
status: complete

requires:
  - phase: 04-05
    provides: "The last edit to tests/bridges/mcp/adapter-entry.test.ts before this plan's AFILE-06 change"
provides:
  - "package.json and the package-lock.json root declare the optional pi-mcp-adapter peer as >=5.1.0 <6"
  - "The PIFL-03 peer-floor gate and the AFILE-06 ServerEntry floor assertion pin >=5.1.0 <6"
  - "README.md and README.es.md name pi-mcp-adapter 5.1.0 or a later 5.x release; PIFL-03 records the D-04-17 amendment"
affects: [04-07, 04-08, 04-09]

actuals:
  tokens: 1554
  tasks: 2
  commits: 1
plan_head_before: 5d8376e0f0d3ce8eb6f75ea05edc0306a602b883
plan_head_after: 76ec707c57ae906c590291d1dc5a93b4e749a336

tech-stack:
  added: []
  patterns:
    - "An optional peer whose internals a feature relies on carries an upper bound, pinned by both the peer gate and the contract assertion"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - tests/architecture/peer-floor.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - README.md
    - README.es.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The AFILE-06 failure message now says the range moved and asks to re-prove the variable escape against the new range's interpolation passes, as well as the vendored keys"
  - "AVAR-03 stays Pending in REQUIREMENTS.md: plans 04-08 and 04-09 still declare it (requirements.ready-ids reported 0/1 ready)"

requirements-completed: [AVAR-03]

coverage:
  - id: D1
    description: "package.json declares pi-mcp-adapter as an optional peer >=5.1.0 <6, and the lock root mirrors it with no lock package added"
    requirement: AVAR-03
    verification:
      - kind: unit
        ref: "tests/architecture/peer-floor.test.ts#package.json declares pi-mcp-adapter as an optional peer at >=5.1.0 <6 (PIFL-03)"
        status: pass
      - kind: unit
        ref: "tests/architecture/peer-floor.test.ts#package-lock.json root peerDependencies mirrors package.json for pi-mcp-adapter (PIFL-03)"
        status: pass
      - kind: unit
        ref: "tests/architecture/peer-floor.test.ts#pi-mcp-adapter is never installed as a dependency, a devDependency, or a lock package (PIFL-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The AFILE-06 floor assertion pins >=5.1.0 <6 and its failure message names the escape re-proof"
    requirement: AVAR-03
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06: the vendored ServerEntry keys match the pi-mcp-adapter floor"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md and README.es.md name 5.1.0 or a later 5.x release; PIFL-03 names >=5.1.0 <6 with the D-04-17 note"
    requirement: AVAR-03
    verification:
      - kind: command
        ref: "rg -n \"5\\.1\\.0 or a later 5\\.x release\" README.md; rg -n \"5\\.1\\.0 o una versión 5\\.x posterior\" README.es.md; rg -n \"pi-mcp-adapter >=5\\.1\\.0 <6\" .planning/REQUIREMENTS.md"
        status: pass
    human_judgment: false

duration: 5 min
completed: 2026-10-07
---

# Phase 4 Plan 06: pi-mcp-adapter peer range on 5.x Summary

**The optional pi-mcp-adapter peer is now `>=5.1.0 <6` in package.json, the lock root, both gates, both READMEs and PIFL-03, so no 6.x adapter is admitted before the variable escape is re-proven against it.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T18:12:07Z
- **Completed:** 2026-10-07T18:17:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `package.json` `peerDependencies["pi-mcp-adapter"]` is `>=5.1.0 <6`; `peerDependenciesMeta` keeps `optional: true`.
- `npm install --package-lock-only --ignore-scripts` changed one line in `package-lock.json`: the root `peerDependencies["pi-mcp-adapter"]`. No package was added, and no other line changed (no bin-path drift).
- `tests/architecture/peer-floor.test.ts`: the PIFL-03 title and both range assertions say `>=5.1.0 <6` (3 matches).
- `tests/bridges/mcp/adapter-entry.test.ts`: the AFILE-06 assertion expects `>=5.1.0 <6`; its failure message says the range moved and adds the escape re-proof to the re-check list.
- README.md: `5.1.0 or a later 5.x release`. README.es.md: `5.1.0 o una versión 5.x posterior`.
- `.planning/REQUIREMENTS.md` PIFL-03 names `pi-mcp-adapter >=5.1.0 <6` and carries the D-04-17 amendment note after the D-04-12 note.

## Task Commits

The plan directs one commit for both tasks:

1. **Tasks 1 and 2** - `76ec707c` (build(deps): keep the pi-mcp-adapter peer on 5.x)

## Files Created/Modified

- `package.json` - optional peer range `>=5.1.0 <6`
- `package-lock.json` - root `peerDependencies` mirror (one line)
- `tests/architecture/peer-floor.test.ts` - PIFL-03 title and two range assertions
- `tests/bridges/mcp/adapter-entry.test.ts` - AFILE-06 range assertion and failure message
- `README.md`, `README.es.md` - prerequisite line
- `.planning/REQUIREMENTS.md` - PIFL-03 range and D-04-17 note

## Verification

Node v26.10.0. All commands ran on the main checkout at `features/mcp-4`.

| Command | Exit | Result |
| --- | --- | --- |
| Task 1 `<verify>`: `node --test tests/architecture/peer-floor.test.ts tests/bridges/mcp/adapter-entry.test.ts && test "$(node -p ...)" = ">=5.1.0 <6 >=5.1.0 <6"` | 0 | 42 tests, 0 fail; range check passed |
| Tracer gate re-run of Task 1 `<verify>` (end-of-phase, automated only) | 0 | Tracer verified end-to-end |
| `node -p "Object.keys(require('./package-lock.json').packages).filter((k) => k.endsWith('/pi-mcp-adapter')).length"` | 0 | `0` |
| `TMPDIR=/var/tmp/mcp4-p4-06 npm run test:modules` (before and after commit) | 0 | pass |
| `npm run test:architecture` (before and after commit) | 0 | pass |
| `TMPDIR=/var/tmp/mcp4-p4-06 npm run test:integration` (before and after commit) | 0 | pass |
| Task 2 `<verify>` (full chain as written, after commit) | 0 | prints `build(deps): keep the pi-mcp-adapter peer on 5.x` |
| `npm run format` | 0 | no file changed |
| `TMPDIR=/var/tmp/mcp4-p4-06 SKIP=npm-check pre-commit run --files <7 paths>` | 0 | `PRECOMMIT_EXIT=0` on the first run; mdformat and markdownlint-cli2 passed |
| `npx fallow audit --base 5d8376e0` | 0 | `No issues in 7 changed files` |
| `git diff 5d8376e0..HEAD -- extensions tests` has no added `D-04-NN` line | 0 | pass |
| `node --test tests/architecture/peer-floor.test.ts` (plan `<verification>`, never-a-dependency case) | 0 | pass, 0 fail |

**Commit hook result (`76ec707c`):** `npm run check:commit` Passed on the first pass (staging package.json made it run every direct-coverage pair); gitlint Passed.

focused task verification passed; full phase/PR verification pending.

## Decisions Made

- The AFILE-06 failure message names the escape re-proof as a fourth item, so a range change points at plan 04-08's CI proof as well as the vendored keys.
- AVAR-03 is not marked complete in REQUIREMENTS.md: `requirements.ready-ids` reports it blocked by 04-08 and 04-09, which still declare it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx fallow audit` printed a pre-existing `WARN` about a `node_modules/.cache/typescript/tsconfig.tsbuildinfo` entry point; it is not an audit verdict, and the audit exited 0.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-18 is mitigated by the `>=5.1.0 <6` range and its two gates; T-04-SC is accepted as planned (the lock diff is the one root peer line).

## Next Phase Readiness

Ready for 04-07.

## Self-Check: PASSED

- FOUND: all 7 modified files exist and carry the new range or wording.
- FOUND: `76ec707c` is an ancestor of HEAD.

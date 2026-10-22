---
phase: 07-marketplace-autoupdate
plan: "04"
subsystem: testing
tags: [cucumber, marketplace, autoupdate, phase-gate]

requires:
  - phase: 07-marketplace-autoupdate
    provides: 07-01's scopeless unscoped miss, 07-02's inherited local value, 07-03's broken-base scenario and docs; the feature file already holds their scenarios
provides:
  - Named-flip scenarios for one marketplace (AU-01 on, AU-02 already on, AU-04 off)
  - The AU-03 source-kind Outline `A newly added marketplace has autoupdate off` (dir and file run; url and github bind and stay excluded)
  - AU-05 persistence through a new Pi session in `marketplace list` and `marketplace info`
  - The AU-06 / D-01 nameless both-scope row order and the AU-09 unscoped named flip over both scopes
  - A green combined-tree `npm run check` for the whole phase
affects: [08, 09-url-source-kind, 10-github-source-kind]

actuals:
  tokens: 2500
  tasks: 3
  commits: 3
plan_head_before: 743706588c35fcc1d8eb0921dc1b3933e89e53e6
plan_head_after: f5dd8ed1fa76ea63640f15c11689df18b7dc4094

tech-stack:
  added: []
  patterns:
    - "Persistence pin: a Given enable, a Given new Pi session, then one list or info When, asserting a value (`true`) the default cannot produce"
    - "Order pin: names and starting values chosen so that insertion order and alphabetical order each differ from the expected row order in every scope"

key-files:
  created: []
  modified:
    - features/marketplace/autoupdate.feature

key-decisions:
  - "The new scenarios sit at the top of autoupdate.feature in task order (one marketplace, then new-marketplace default and persistence, then both scopes), before the earlier layer scenarios."
  - "No step, library, support, production, or cucumber.json change: every step used already existed, and every scenario passed on its first run against the final code."

patterns-established:
  - "A behavior pin that passes on first run is recorded as a pin, not a RED step; the plan carries no RED evidence."

requirements-completed: [AU-01, AU-02, AU-03, AU-04, AU-05, AU-06, AU-09]

coverage:
  - id: D1
    description: "Named autoupdate turns autoupdate on, a repeat is skipped as already autoupdate, and noautoupdate turns it off, each with the whole result and the exact base declaration"
    requirement: AU-01
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate turns it on for a marketplace"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate on a marketplace that has it on skips it as already autoupdate"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Disabling autoupdate turns it off for a marketplace"
        status: pass
    human_judgment: false
  - id: D2
    description: "A newly added marketplace has autoupdate off: noautoupdate is skipped as already no autoupdate and writes no autoupdate value (dir and file rows run; url and github rows bind under check:features)"
    requirement: AU-03
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#A newly added marketplace has autoupdate off"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false
  - id: D3
    description: "An enabled autoupdate shows as true in the marketplace list and the marketplace info of a new Pi session"
    requirement: AU-05
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#An enabled autoupdate shows in the marketplace list of a new session"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#An enabled autoupdate shows in the marketplace info of a new session"
        status: pass
    human_judgment: false
  - id: D4
    description: "A nameless autoupdate over both scopes changes every marketplace that is off, lists changed rows before already-on rows in insertion order with project first, and leaves every base config true"
    requirement: AU-06
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate for every marketplace lists the changed marketplaces of each scope before the ones already on"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unscoped named autoupdate for a name both scopes hold judges each scope on its own, with no tally"
    requirement: AU-09
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate without a scope judges each scope that holds the marketplace on its own"
        status: pass
    human_judgment: false
  - id: D6
    description: "The combined tree of the phase passes npm run check"
    verification:
      - kind: other
        ref: "npm run check (exit 0 on f5dd8ed1, 231 scenarios passed)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-20
status: complete
---

# Phase 7 Plan 04: Named, default, persistence, and both-scope autoupdate scenarios Summary

**Nine new scenario runs in `features/marketplace/autoupdate.feature` pin the named flips (on, already on, off), the off default of a newly added marketplace as a source-kind Outline, the enabled value surviving a new Pi session in `list` and `info`, the D-01 row order of a nameless flip over both scopes, and an unscoped named flip over both scopes; every one passed on its first run, and the combined tree passes `npm run check`.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-20T04:34:08Z
- **Completed:** 2026-10-20T04:40:59Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- AU-01 / AU-02 / AU-04: `autoupdate tools --scope project` reports `tools | project | autoupdate enabled` and the base config declares `autoupdate true`; a repeat reports `skipped` / `already autoupdate` and keeps `true`; `noautoupdate` after an enable reports `autoupdate disabled` and writes `false`. Each asserts kind `cascade`, severity `info`, needs reload `false`, no tally, and no plugin rows.
- AU-03: the Outline `A newly added marketplace has autoupdate off` adds with `--scope project` and runs `noautoupdate`, which reports `skipped` / `already no autoupdate`; the config table has no `autoupdate` column, so a written `false` would fail. The untagged block runs `dir` and `file`; the `@url` and `@github` blocks bind under `check:features` and stay excluded by the unchanged `cucumber.json`.
- AU-05: after an enable and `Given the user has started a new pi session`, `marketplace list` shows `tools | project | true` with the `Marketplace list` tally, and `marketplace info tools --scope project` shows the whole info payload with `details autoupdate true`.
- AU-06 / D-01: project `zeta`, `alpha`, `mid` and user `bravo`, `yankee`, with `zeta`, `mid`, and `bravo` already on. The nameless flip lists `alpha, zeta, mid` then `yankee, bravo` with tally success count `5`; insertion order (`zeta, alpha, mid` / `bravo, yankee`) and alphabetical order (`alpha, mid, zeta` / `bravo, yankee`) both differ. Both base configs end with every entry `true`.
- AU-09: an unscoped `autoupdate tools` with the project already on reports `tools | project | skipped | already autoupdate`, then `tools | user | autoupdate enabled`, with no tally; both base configs end with `true`.

## Task Commits

1. **Task 1: Named flips on one marketplace (AU-01, AU-02, AU-04)** - `16ef1fdd` (test)
2. **Task 2: New-marketplace default Outline and persistence across a new session (AU-03, AU-05)** - `cfeeb99e` (test)
3. **Task 3: Nameless and unscoped flips over both scopes, then the phase gate (AU-06, D-01, AU-09)** - `f5dd8ed1` (test)

**Plan metadata:** the `docs(planning)` commit that carries this SUMMARY.

The tracer feedback gate after Task 1 (interactive run, `end-of-phase`, automated-only verify) re-ran the Task 1 named cucumber run: exit 0, `3 scenarios (3 passed)`, then expansion continued.

## Verification

Node v26.11.1, branch `features/cucumber-behavioral-tests`, hermetic cucumber sandbox.

| Command | Exit | Result | At |
| ------- | ---- | ------ | -- |
| `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(Enabling autoupdate turns it on for a marketplace\|Enabling autoupdate on a marketplace that has it on skips it as already autoupdate\|Disabling autoupdate turns it off for a marketplace)$'` | 0 | 3 scenarios (3 passed), 26 steps | Task 1 tree, and again after `16ef1fdd` (tracer gate) |
| `npx cucumber-js features/marketplace/autoupdate.feature` | 0 | 26 scenarios (26 passed) | Task 1 tree |
| `npm run test:cucumber -- ... --name '^(A newly added marketplace has autoupdate off\|An enabled autoupdate shows in the marketplace list of a new session\|An enabled autoupdate shows in the marketplace info of a new session)$'` | 0 | 4 scenarios (4 passed), 33 steps | Task 2 tree |
| `npm run test:cucumber -- ... --name '^(Enabling autoupdate for every marketplace lists the changed marketplaces of each scope before the ones already on\|Enabling autoupdate without a scope judges each scope that holds the marketplace on its own)$'` | 0 | 2 scenarios (2 passed), 31 steps | Task 3 tree |
| `npm run check:features` | 0 | no "Feature gate failed" | after each task |
| `SKIP=npm-check pre-commit run --files features/marketplace/autoupdate.feature` | 0 | no fixer rewrote the file | before each commit |
| commit hook `npm run check:commit` | Passed | | `16ef1fdd`, `cfeeb99e`, `f5dd8ed1`, without `--no-verify` |
| `git diff --quiet HEAD -- cucumber.json` | 0 | exclusion untouched | after Task 2 |

### Phase gate

- **Command:** `npm run check` (foreground, output to a log file, exit status read directly)
- **Exit status:** 0
- **Commit:** `f5dd8ed1fa76ea63640f15c11689df18b7dc4094`, clean working tree
- **Node:** v26.11.1
- **Scope:** the combined tree, all four plans of the phase
- **Run:** 2026-10-20T04:39:02Z to 04:40:46Z. `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) all passed; `test:unpaired` and `test:integration` passed; cucumber `231 scenarios (231 passed)`, `2476 steps (2476 passed)`; `test:coverage:direct:all` merged `coverage/direct.lcov` (280 records) with no shortfall.
- `git status --short -- extensions tests features docs` printed nothing after the gate.

### Acceptance criteria

- Task 1: each of the three titles appears once (baseline 0); each scenario states the whole field set, the whole row set, and the exact base declaration; the whole feature file passes. PASS.
- Task 2: `A newly added marketplace has autoupdate off` appears once, with one untagged, one `@url`, and one `@github` block and four rows in total; both AU-05 scenarios start a new session in a `Given` before their one `When` and assert `true`; `cucumber.json` unchanged. PASS.
- Task 3: each of the two titles appears once (baseline 0); the D-01 rows list `alpha, zeta, mid` then `yankee, bravo`; `npm run check` exits 0 on the final code commit. PASS.

## Flagged probe assumptions

These are review targets carried from the plan, not unresolved requirements:

- `AU-01 / unclassified / unresolved`: the whole-result named-enable scenario is the manual-review target; no unseen edge is claimed resolved.
- `AU-02 / unclassified / unresolved`: the repeat-enable scenario is the manual-review target.
- `AU-03 / unclassified / unresolved`: the source-kind Outline proves the stated default; the probe's unspecified edge stays flagged.
- `AU-04 / unclassified / unresolved`: the enable-then-disable scenario is the manual-review target.
- 07-RESEARCH.md A1: "a flagless add" in CONTEXT.md's AU-03 bullet is read as an add without `--local`, so the Outline adds with `--scope project`. If the user meant no flags at all, the add lands in the default `user` scope and the config assertion moves there.

## Files Created/Modified

- `features/marketplace/autoupdate.feature` - eight new scenarios (one an Outline with four rows) at the top of the file

## Decisions Made

- The scenarios go at the top of the file in task order, as the plan's placement note asks.
- No step was added: all used steps already existed, and `check:features` reports none unused or undefined.

## Deviations from Plan

None - plan executed exactly as written. Every scenario matched the planned tables on its first run, so no comparison against probes P6, P7, or P8 was needed.

## Issues Encountered

None.

## Known Stubs

None. The `@url` and `@github` Outline rows are excluded by design until Phases 9 and 10 add their stand-ins; they bind under `check:features`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 is complete: all four plans have summaries and the combined tree passes `npm run check`. Ready for phase verification.
- The `@url` and `@github` rows of the AU-03 Outline turn on when Phases 9 and 10 remove their tags from `cucumber.json`.

---
*Phase: 07-marketplace-autoupdate*
*Completed: 2026-10-20*

## Self-Check: PASSED

- `features/marketplace/autoupdate.feature` exists and holds every new title once.
- Commits `16ef1fdd`, `cfeeb99e`, and `f5dd8ed1` are ancestors of HEAD; `git rev-list --count 743706588c..f5dd8ed1` is 3.

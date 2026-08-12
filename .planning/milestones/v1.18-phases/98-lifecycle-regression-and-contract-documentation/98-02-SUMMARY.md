---
phase: 98-lifecycle-regression-and-contract-documentation
plan: 02
subsystem: testing
tags: [uninstall, cascade, hooks, mcp, agents-index, regression-coverage]

# Dependency graph
requires:
  - phase: 97-disabled-state-classification-repair
    provides: the disabled-record shape (all five resources arrays empty) that the sixth case characterizes
provides:
  - a five-kind seedFullPlugin fixture (hooks was the missing fifth)
  - six LIFE-04 cases proving a manifest-absent record still uninstalls, one resource kind per case
  - an mcp.json ownership assertion that rejects a document-clobbering rewrite
affects: [DOC-08 documentation reconciliation, COMPAT-01 no-expansion gate]

actuals:
  tokens: 3000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One resource kind asserted per regression case, so a single bridge-arm regression turns exactly one case red and names the arm"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/uninstall.test.ts

key-decisions:
  - "The expected (uninstalled) row is a single module-level constant shared by all six cases rather than six copies of the literal. PU-1 keeps its own inline literal, so no pre-existing assertion changed, and the constant carries the same bytes -- the point of the cases is that the resource-kind mix does not move the row."
  - "The hooks seed block sits between the agents and mcp blocks so the fixture reads in the same order the cascade drops the kinds (skills, commands, agents, hooks, mcp)."
  - "The manifest-absent property was already true of every fixture in this suite (no test writes a marketplace.json under its temp cwd). It is now asserted explicitly before each uninstall rather than left incidental, and named in a comment on the seed."
  - "The empty-resources case seeds state directly and runs the REAL cascade, unlike PU-8 (b) which stubs it. The stub proves the reload-hint gate; this case proves every bridge arm is a no-op on empty input rather than a throw."

patterns-established:
  - "A per-kind regression suite asserts the artifact of exactly one kind plus the shared invariants (record removed, row bytes), never the full end-state -- the end-state assertion already lives in PU-1."
  - "An ownership-scoped removal is proven by seeding a differently-owned neighbour and asserting it survives; asserting only the owned key's absence would pass under a clobbering rewrite."

requirements-completed: [LIFE-04]

coverage:
  - id: D1
    description: "A plugin whose marketplace manifest does not exist on disk still has its skill directory, command file, agent file and agents-index row removed by the normal uninstall path"
    requirement: "LIFE-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LIFE-04: manifest-absent uninstall removes the skill directory"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LIFE-04: manifest-absent uninstall removes the command file"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LIFE-04: manifest-absent uninstall removes the agent file and its index row"
        status: pass
    human_judgment: false
  - id: D2
    description: "The two kinds the fixture previously never proved -- the staged hooks config and the owned mcp.json server entry -- are removed, and the mcp removal is scoped to the keys the record owns"
    requirement: "LIFE-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LIFE-04: manifest-absent uninstall removes the staged hooks config"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LIFE-04: manifest-absent uninstall removes only the owned mcp.json server"
        status: pass
    human_judgment: false
  - id: D3
    description: "A manifest-absent record whose five resources arrays are all empty -- the disabled-record shape -- uninstalls cleanly through the real cascade with no throw"
    requirement: "LIFE-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LIFE-04: manifest-absent uninstall of a record with no resources still converges"
        status: pass
    human_judgment: false
  - id: D4
    description: "The widened fixture does not disturb any pre-existing case in the suite, and no pre-existing assertion was edited"
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/uninstall.test.ts (42 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "git diff HEAD~3 -- tests/orchestrators/plugin/uninstall.test.ts | grep '^-' shows only the two seed-factory signature lines"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-09
status: complete
---

# Phase 98 Plan 02: Lifecycle regression and contract documentation Summary

**`seedFullPlugin` now seeds all five resource kinds, and six isolated `LIFE-04:` cases prove a plugin whose marketplace manifest does not exist on disk still drops every owned artifact and its own record through the normal uninstall path.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-09T22:51Z (approx.)
- **Completed:** 2026-08-09T23:11Z (approx.)
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- The fixture gap is closed: `seedFullPlugin` seeds the staged hooks config at `<hooksDir>/<plugin>/hooks.json` and records the plugin on the record's hooks slot, so the cascade's fifth arm finally has something to drop in this suite. Hooks coverage previously existed only at the `cascadeUnstagePlugin` level in the marketplace cascade suite, never through `uninstallPlugin`.
- Six `LIFE-04:` cases characterize the manifest-independent path, one resource kind each: skills, commands, agents (file plus index row), hooks, mcp, and the empty-resources edge. Each asserts the recorded manifest path does not exist before the call, so the coverage is about the record driving uninstall rather than ordinary uninstall behavior.
- The mcp case seeds a second server carrying a different owning-plugin marker and asserts it survives. A rewrite that clobbered the document would pass an "owned key is gone" assertion and fail this one.
- All six pin the same `(uninstalled)` row bytes, so the resource-kind mix is proven not to move the rendered row.
- No pre-existing assertion changed. The only removed lines across the three commits are the seed factory's return-type line and its return statement, both widened with `hooksFile`.

## Task Commits

1. **Task 1: Extend `seedFullPlugin` with the fifth resource kind** — `640f1c8c` (test)
2. **Task 2: Five isolated per-kind LIFE-04 cases** — `9747607b` (test)
3. **Task 3: The empty-resources manifest-absent case** — `009391a1` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/uninstall.test.ts` — hooks seed block and widened return type on `seedFullPlugin`; a `LIFE-04` section carrying the shared row constant, a `manifestPathFor` helper and six cases

## Decisions Made

- **Shared row constant.** The six new cases assert against one module-level `LIFE_04_UNINSTALLED_ROW` constant holding the same bytes `PU-1` pins inline. The plan asked for the string to be copied rather than retyped; a constant satisfies that without touching `PU-1`, and it makes the "one stable row across all kinds" claim structural instead of six coincidences.
- **Seed block placement.** The hooks block sits between the agents and mcp blocks, matching the order `cascadeUnstagePlugin` drops the kinds. The comment ladder in the factory now reads in cascade order.
- **Explicit manifest absence.** Every fixture in this suite already pointed `manifestPath` at a `marketplace.json` no test writes. That was incidental; it is now asserted per case and named in a comment on the seed, which is what makes a future fixture change that starts writing a manifest fail loudly rather than silently weaken the coverage.
- **Real cascade on the empty case.** `PU-8 (b)` covers the zero-resource record with a stubbed cascade to isolate the reload-hint gate. The new case seeds state directly and lets the real cascade run, which is what proves each arm no-ops on empty input (`unstagePluginSkills` with an empty name list, `removeHookConfig` with `force: true`, `unstageMcpServers` against an absent `mcp.json`).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- None. The three `<verify>` blocks all passed first run: `node --test tests/orchestrators/plugin/uninstall.test.ts` (36 → 41 → 42 pass, 0 fail), `npm run typecheck` exit 0, `npm run lint` exit 0, `npm run format:check` exit 0.
- Worth noting for anyone reading the estimate line: the plan estimated 40000 tokens at low confidence; the realized diff is ~3000 on the same chars/4 scale. Characterization work over an already-correct path is much cheaper than the estimate assumed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LIFE-04 is closed. The remaining lifecycle-coverage requirements are LIFE-05 (`tests/orchestrators/plugin/update.test.ts`) and LIFE-06 (`tests/orchestrators/marketplace/update.test.ts`); neither shares a file with this plan.
- For the phase-review carrier list: `PU-1` asserts three of the five kinds it now seeds — the hooks file and the mcp server key are seeded but not asserted there. That is deliberate under D-98-12 (the per-kind cases own those assertions), but a reviewer scanning `PU-1` alone would still read it as an incomplete end-state assertion. Worth a decision on whether `PU-1` should be widened to the full five now that the fixture seeds them.

## Self-Check: PASSED

`tests/orchestrators/plugin/uninstall.test.ts` present on disk with 6 `test("LIFE-04:` cases; all three commits (`640f1c8c`, `9747607b`, `009391a1`) resolve in `git log`.

---
*Phase: 98-lifecycle-regression-and-contract-documentation*
*Completed: 2026-08-09*

---
phase: 101-workflow-component-kind-recognition
plan: 01
subsystem: domain
tags: [typebox, resolver, closed-set, component-kinds, workflows, notify]

# Dependency graph
requires:
  - phase: HOOK-01 admission (already in tree)
    provides: the two-tuple split (public closed set vs. path-bearing subset) that this widening extends
provides:
  - "`workflows` as the 5th member of SUPPORTED_COMPONENT_KINDS and the 4th of SUPPORTED_COMPONENT_PATH_KINDS"
  - "required `componentPaths.workflows` on ComponentPathsSchema, PartialResolution and emptyResolution()"
  - "`workflows` field in SUPPORTED_COMPONENT_PATH_FIELDS (domain/components/plugin.ts)"
  - "six-slot COMPONENT_KINDS tuple + `workflows` member on PluginInfoComponentsResolved.components"
  - "the `.js` suffix arm of nameFromEntry -- the name-source seam a later phase re-points at meta.name"
  - "`workflows:` line on /claude:plugin info, rendered last among per-kind component lines"
affects: [101-02, 101-03, 101-04, workflow-name-extraction, workflow-materialization, workflow-soft-dependency]

actuals:
  tokens: 7400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "closed-set widening driven by a length-exact tuple: grow the interface, then grow the tuple; the intermediate typecheck failure is the enforcement mechanism"
    - "suffix-as-variable in nameFromEntry: strip by the suffix's own length, never a hard-coded count"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/domain/components/plugin.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/domain/resolver-strict.test.ts
    - tests/architecture/hooks-foundation.test.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "componentPaths.workflows is REQUIRED, not optional -- the 22 compile errors it forces are the closure proof, and no consumer needs `?? []`"
  - "the two lenient `unavailable`-arm literals seed `workflows: [\"workflows\"]`, so a structurally-broken plugin still enumerates its workflows directory rather than reading as absent on that one surface"
  - "nameFromEntry strips by `suffix.length` rather than the pre-existing `-3`; the hard-coded count is what makes a new kind fail silently"
  - "no reason token, status token, glyph, persisted field or schema version was added -- the COMPAT-01 and notify-closed-set pins pass with zero edits"

patterns-established:
  - "Closed-set widening: the length-exact COMPONENT_KINDS tuple makes it impossible for the renderer to silently omit a newly-admitted kind"
  - "Both-axes admission reuses collectStrictComponentKind unchanged -- no per-kind discovery function, convention probe, or path validator was introduced"

requirements-completed: [WFLW-01, WFLW-02, WFLW-03, WFLW-04]

coverage:
  - id: D1
    description: "A plugin whose only component evidence is <pluginRoot>/workflows/ resolves installable with `workflows` in `supported` and componentPaths.workflows equal to [\"workflows\"]"
    requirement: WFLW-01
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-01 implicit-by-convention populates componentPaths.workflows when neither entry nor manifest declares it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Declared `workflows` manifest paths flow through the existing readPathOrArray -> validateComponentPath chain with no new validator"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts (SupportedPathKind-generic collector; declared-path cases are pinned by plan 101-02)"
        status: unknown
    human_judgment: true
    rationale: "This plan admits the kind into the path-bearing tuple; the declared-path, absent-path, escaping-path and loose-mode cases are authored by plan 101-02 and are not yet asserted here."
  - id: D3
    description: "The zero-signal outcome is closed: a workflows-bearing plugin no longer resolves with an empty supported array, and is not demoted"
    requirement: WFLW-03
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-03 a workflows-only plugin resolves with a NON-EMPTY supported set and no demotion"
        status: pass
    human_judgment: false
  - id: D4
    description: "/claude:plugin info renders `    workflows: deploy, release` last among the per-kind component lines"
    requirement: WFLW-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#WFLW-03: convention-only workflows/ renders a `workflows:` line last among the per-kind component lines"
        status: pass
    human_judgment: false
  - id: D5
    description: "componentPaths.workflows is a required member and the whole tree typechecks with no `?? []` at any consumer"
    requirement: WFLW-04
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0)"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-foundation.test.ts#HOOK-01 / WFLW-04: SUPPORTED_COMPONENT_KINDS is the closed set [skills,commands,agents,hooks,workflows]"
        status: pass
    human_judgment: false
  - id: D6
    description: "The no-expansion architecture gates pass with their files unedited -- no reason token, status token, glyph, persisted field or schema version added"
    requirement: WFLW-04
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts + tests/architecture/notify-closed-set-locks.test.ts (18 tests, unedited)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-14
status: complete
---

# Phase 101 Plan 01: Workflow component-kind recognition Summary

**`workflows` admitted to both resolver tuples on the convention axis as well as the manifest axis, with a required `componentPaths.workflows` member and a `workflows:` line on `/claude:plugin info`**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-14T18:12:00Z
- **Completed:** 2026-08-14T18:37:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- A plugin shipping `<pluginRoot>/workflows/` and declaring nothing now resolves `installable` with `workflows` in `supported` and `componentPaths.workflows` equal to `["workflows"]`. That is the shape every sampled real plugin ships, and it was previously the zero-signal case.
- `componentPaths.workflows` is a required schema member. Making it required is what forced all 22 construction sites into the open at once; `npm run typecheck` exiting 0 is the proof the set is closed.
- `/claude:plugin info` renders the enumerated scripts on a `workflows:` line, positioned last among the per-kind component lines by the now six-slot `COMPONENT_KINDS` tuple.
- `nameFromEntry` picks its suffix by kind and strips by that suffix's own length. The previous unguarded `.md` tail with a hard-coded `-3` was the phase's highest-risk silent failure: widening the union without touching the body compiles cleanly and renders nothing.
- The closed-set gates (`compat-01-no-expansion`, `notify-closed-set-locks`) pass with zero edits — no reason token, status token, glyph, persisted field, or schema version was added.

## Task Commits

1. **Task 1: End-to-end — a convention-only workflows plugin renders `workflows: deploy` on `info`** — `49e95c1c` (feat)
2. **Task 2: Pin the headline requirement proofs** — `8435145b` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/resolver.ts` — `workflows` appended to both supported-kind tuples; required `workflows` member on `ComponentPathsSchema`, `PartialResolution.componentPaths` and `emptyResolution()`; tuple and loop doc comments amended so the public/path-bearing split still reads correctly with a second both-axes kind
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` — `workflows` added to `SUPPORTED_COMPONENT_PATH_FIELDS` (documentation of the supported set; the TypeBox objects were already open)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `.js` suffix arm and widened `kind` unions on `nameFromEntry` / `discoverComponentNames`; `workflows` param member, return member, discovery call and conditional spread in `composeResolvedComponents`; `workflows: ["workflows"]` in `deriveLenientComponentPaths` and the warm-git `unavailable` literal
- `extensions/pi-claude-marketplace/shared/notify.ts` — `workflows` member on `PluginInfoComponentsResolved.components`; `COMPONENT_KINDS` grown to six slots with `workflows` last; the tuple's own arithmetic comment and the two stale render-order comments corrected
- `tests/orchestrators/plugin/info.test.ts` — the end-to-end tracer: a convention-only workflows plugin renders `    workflows: deploy, release`, asserted positionally after the `skills:` line
- `tests/domain/resolver-strict.test.ts` — the convention-only primary case (WFLW-01) and the zero-signal-closure case (WFLW-03)
- `tests/architecture/hooks-foundation.test.ts` — the public closed-set pin updated in place to five kinds; the locked-shape-and-order rationale message unchanged
- 9 further test files — the compile-forced `workflows: []` literal, one line each

## Decisions Made

- **`componentPaths.workflows` required, not optional.** Confirmed the locked decision by executing it: 16 test literals plus 6 production sites turned red simultaneously, which is exactly the enumeration mechanism the plan wanted. No consumer needed `?? []`.
- **Both lenient `unavailable`-arm literals seed the convention.** These two sites exist so a structurally-broken plugin still enumerates its on-disk components; omitting `workflows` would have made that arm the one surface where a workflows directory reads as absent, re-opening the zero-signal outcome on a narrow path. No existing fixture contains a `workflows` directory, so no assertion moved.
- **Suffix by variable, strip by its length.** A literal `-3` is coincidentally correct for `.js`, so copying it would have re-created the trap for the next kind admitted.
- **`hooks` left where it is in `UNSUPPORTED_COMPONENT_FIELDS`.** That grouping is stale from the earlier admission; correcting it is out of scope here and would enlarge the reviewable diff for no behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Two comments made factually false by the widening**

- **Found during:** Task 1
- **Issue:** `tests/orchestrators/plugin/info.test.ts` described `COMPONENT_KINDS` as a "5-tuple" and `tests/shared/notify-v2.test.ts` stated the render order as `agents, commands, mcp, skills`. Both became wrong the moment the tuple grew (the second was already stale — it omitted `hooks`).
- **Fix:** Dropped the arity from the first (so it cannot rot again) and wrote the full six-kind order into the second. Both sites are named in the phase's stale-comment sweep.
- **Files modified:** `tests/orchestrators/plugin/info.test.ts`, `tests/shared/notify-v2.test.ts`
- **Verification:** `npm run check` green; both files' suites pass.
- **Committed in:** `49e95c1c` (Task 1 commit)

**2. [Bookkeeping] REQUIREMENTS.md rows left `Pending` rather than marked complete**

- **Found during:** State updates
- **Issue:** The execute-plan step marks every ID in the plan's `requirements` frontmatter complete. But the traceability rows in `REQUIREMENTS.md` are scoped to **Phase 101**, not to a plan, and all four plans in the phase carry the same four IDs. Marking them here would claim WFLW-01..04 satisfied while three plans still owe proofs — WFLW-02's declared-path / absent-path / escaping-path matrix is authored by `101-02`, and the boundary pins by `101-04`.
- **Fix:** Left all four rows `Pending`. They should be marked when the phase's plans are all summarized, which is the granularity the rows actually carry.
- **Files modified:** none (`REQUIREMENTS.md` deliberately untouched)
- **Verification:** `grep 'WFLW-0' .planning/workstreams/workflows/REQUIREMENTS.md` shows four unchecked rows.
- **Committed in:** n/a

---

**Total deviations:** 1 auto-fixed (1 correctness), 1 bookkeeping judgment call
**Impact on plan:** Comment accuracy only, no behavior change, no scope creep. `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` also mentions `COMPONENT_KINDS` but names no arity, so it was left untouched. The requirement rows need marking at phase completion — flagged here so it is not lost.

## Issues Encountered

- **The intermediate red gate between the two task commits is by design.** Task 1 grows the tuple, which leaves the closed-set pin in `tests/architecture/hooks-foundation.test.ts` failing until Task 2 updates it. The plan sequences the tasks this way deliberately (Task 1's verify is scoped to typecheck plus the info/resolver suites). `npm run check` is green at the plan's end, which is the boundary the phase gate names.
- **Both required RED states were observed in order**, as the plan's TDD behavior block specifies: first the `workflows:` line missing entirely (kind not admitted), then — with the tuples, schema and composer all wired but before the `nameFromEntry` arm — the same missing line via the silent path, every `.js` entry filtered out by the `.md` test. The second red is the one that would have shipped as a green-tests-but-no-output phase.

## User Setup Required

None — no external service configuration required. No package was installed; every symbol touched is in-repo or an already-declared dependency.

## Next Phase Readiness

- **Ready for wave 2.** `npm run check` is green (typecheck, ESLint, Prettier, unit and integration suites).
- Plan `101-02` can author the declared-path, absent-path, escaping-path and loose-mode cases against the now-admitted kind; `101-03` can add the paired catalog block and `FIXTURES` entry for the `workflows:` line; `101-04` can pin `compatibility.supported` recording `"workflows"`.
- **Seam handed forward:** the `workflows` arm of `nameFromEntry` renders the file stem. The later name-extraction phase re-points that single arm at the script's extracted `meta.name`; nothing else in the render path changes.
- **Two consequences of the moved boundary are expected, not defects:** a reconcile backfill re-materializes a `installable: false` record whose supported set newly grows, and `update` on a disabled workflow-bearing record writes one refresh row. Both are one-time, idempotent, and have an exact precedent in the earlier `hooks` admission. Neither is code touched by this plan.
- **Deliberately not updated:** the PRD's component-kind prose. A half-updated PRD — kind admitted, bridge absent, degradation unstated — is worse than a consistently-behind one; the documentation phase owns those lines.

## Self-Check: PASSED

All modified files verified present on disk; both commit hashes verified in `git log`.

---
*Phase: 101-workflow-component-kind-recognition*
*Completed: 2026-08-14*

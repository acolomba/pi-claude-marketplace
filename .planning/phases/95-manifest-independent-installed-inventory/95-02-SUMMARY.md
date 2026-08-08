---
phase: 95-manifest-independent-installed-inventory
plan: 02
subsystem: api
tags: [typescript, node-test, llm-tool-surface, payload-projection]

# Dependency graph
requires:
  - phase: 95-manifest-independent-installed-inventory
    plan: 01
    provides: "`reasons` stamped on the `installed` and `partially-installed` list rows"
provides:
  - "`details.plugins[i].reasons` on the `pi_claude_marketplace_plugin_list` payload for both installed-family arms"
  - "The flat `content[0].text` reason trailer on those rows"
  - "Tool-execute assertions pinning the manifest-absent and manifest-declared payload shapes"
affects: [96-plugin-info, 97-disabled-state-predicate, 98-lifecycle-and-docs-reconciliation]

actuals:
  tokens: 14434
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split an optional-field arm from a required-field arm rather than widening one condition, so `exactOptionalPropertyTypes` keeps guarding the optional case"
    - "Non-vacuity check: neutralize the production arm, confirm the new assertion turns red, restore"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/edge/handlers/tools.test.ts

key-decisions:
  - "Give `installed` its own guarded arm ahead of the required-`reasons` conjunct; a clean row must project with no `reasons` key, never an empty array (INV-05, D-95-06)"
  - "Leave `projectRowStatus` byte-unchanged — the widening adds information inside the `installed` bucket rather than re-partitioning it"
  - "Rewrite only the comments on code this plan edited; the retired anchors elsewhere in `tools.ts` stay for Phase 98's DOC-08"

patterns-established:
  - "The tool payload and the rendered row are verified together in one test, so the two surfaces cannot silently diverge"

requirements-completed: [INV-05]

coverage:
  - id: D1
    description: "A manifest-absent degraded record's tool payload carries `[\"not in manifest\", \"unsupported component\"]` in row order, and its flat line carries the same trailer"
    requirement: INV-05
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#pi_claude_marketplace_plugin_list :: force-installed plugin projects [installed] with version through execute"
        status: pass
    human_judgment: false
  - id: D2
    description: "A manifest-absent clean installed record's tool payload carries `[\"not in manifest\"]`, with `status` still `installed` and the recorded version intact"
    requirement: INV-05
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#INV-05 :: a manifest-absent installed record carries [not in manifest] on the tool payload"
        status: pass
    human_judgment: false
  - id: D3
    description: "A manifest-declared installed record projects with no `reasons` field, so the brace is a property of manifest absence rather than of the installed status"
    requirement: INV-05
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#INV-05 :: a manifest-declared installed record projects with no reasons field"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#pi_claude_marketplace_plugin_list :: upgradable plugin (manifest version > installed) -> [installed] no reasons"
        status: pass
    human_judgment: false
  - id: D4
    description: "COMPAT-01 and NFR-5 survive the widening: no reason-token growth, no orchestrator network import, no catalog byte change"
    requirement: INV-05
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 95 Plan 02: LLM tool-surface reason projection Summary

**An agent calling `pi_claude_marketplace_plugin_list` now reads the same
manifest-absence and degradation facts a human reads on `/claude:plugin list`,
instead of a payload where a degraded install looked identical to a clean one**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-08T18:36:00Z
- **Completed:** 2026-08-08T19:01:00Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- `pluginReasons` forwards reasons on both installed-family arms. A degraded,
  manifest-absent record now reaches the agent as
  `reasons: ["not in manifest", "unsupported component"]` where it previously
  reached it with no `reasons` key at all — the same payload a clean install
  produced.
- The flat line and the structured payload are asserted together in every new
  test, so the text view and the `details` view cannot drift apart without a
  test turning red.
- A clean installed row still projects with **no** `reasons` key. The `installed`
  arm guards on both `undefined` and empty length, so neither an absent field nor
  an empty array becomes `[]` on the payload.
- `projectRowStatus` is byte-unchanged. All four installed-family statuses still
  flatten to the one `installed` tool bucket; INV-05 adds information inside that
  bucket rather than re-partitioning it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen `pluginReasons` to forward reasons on both installed-family
   arms** — `1797912` (test, RED) → `c091ebc` (feat, GREEN)
2. **Task 2: Assert the installed-arm tool payload and gate the phase
   invariants** — `99f6a00` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — `pluginReasons`
  gains a guarded `installed` arm and `partially-installed` joins the existing
  required-`reasons` conjunct; the function's doc comment restated.
- `tests/edge/handlers/tools.test.ts` — the existing manifest-absent partial
  fixture gains a `deepEqual` reasons assertion, a flat-line trailer assertion
  and a widened local `details` annotation, and its stale comment is corrected;
  two new tool-execute tests cover the `installed` arm and its
  manifest-declared control.

## Decisions Made

- **Two arms, not one condition.** `PluginInstalledMessage.reasons` is optional
  while `PluginPartiallyInstalledMessage.reasons` is required. Folding both into
  one conjunct would have forced a cast or lost the `exactOptionalPropertyTypes`
  guarantee on the optional case, so the `installed` arm returns early with its
  own `p.reasons !== undefined && p.reasons.length > 0` test.
- **Two conjuncts stayed a conjunct.** The plan permitted converting to this
  file's exhaustive-switch convention if the projection grew past two conjuncts.
  It did not: the required-`reasons` branch holds four statuses in one `if` and
  the optional case is a separate early return, which is two branches total. A
  switch would have added ten unreachable arms for no added exhaustiveness the
  type system does not already give here.
- **No comment sweep.** `tools.ts` still cites `RLD-04` in three places outside
  the edited function; those stay for Phase 98's DOC-08 reconciliation, per the
  phase context's prohibition on sweeping.

## Deviations from Plan

None — the plan executed as written. No auto-fix rule fired, no architectural
question arose, and no acceptance criterion needed reinterpretation.

## Verification Evidence

- `node --test tests/edge/handlers/tools.test.ts` — 27 pass / 0 fail, two more
  than the 25 before this plan.
- `npm run check` exits 0 (typecheck, lint, format, unit, integration, e2e) with
  `PI_SUBAGENTS_ROOT` pointed at the Pi-managed pi-subagents install. Integration
  is 18/18 with that set; the two pi-subagents suites that 95-01 deferred pass
  here, confirming that failure was the stale global peer and not a code defect.
- The three architecture gates pass with their own files unmodified:
  `notify-closed-set-locks`, `no-orchestrator-network`, `catalog-uat` — 11 pass /
  0 fail, `git status --porcelain tests/architecture/` empty.
- **Non-vacuity check.** The new positive test was confirmed to depend on the
  production change: with the `installed` arm's return replaced by `undefined`,
  `INV-05 :: a manifest-absent installed record carries [not in manifest] on the
  tool payload` fails; the file was restored from git immediately after.
- Grep gates: `partially-installed` count rose 4 → 5 (exactly the one new
  conjunct member), the `p.reasons !== undefined` guard appears once inside
  `pluginReasons`, `RLD-04` still returns 3, and no GSD planning reference
  appears in either file.
- `git diff` on `tools.ts` shows hunks only at the `pluginReasons` doc comment
  and body — no hunk inside `projectRowStatus`.
- The phase's implementation commits touch exactly the five expected source paths
  plus `.planning/` artifacts: `orchestrators/plugin/list.ts`,
  `orchestrators/plugin/list.messaging.ts`, `edge/handlers/tools.ts`,
  `tests/orchestrators/plugin/list-manifest-absent.test.ts`,
  `tests/edge/handlers/tools.test.ts`. No sixth path, and nothing under `docs/`.

## Known Stubs

None. Every payload field this plan describes is produced by the real tool
execute path and asserted on the tool output, not inferred from the row builder.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready.** INV-05 is the last requirement in this phase's scope; INV-01..04 and
  BOUND-03 landed in 95-01. The phase's requirement set is complete.
- **Carried to Phase 98 (DOC-08).** `shared/notify.ts` still states in two places
  that the list orchestrator omits `reasons` on the steady-state inventory row,
  and `tools.ts` still cites the retired `RLD-04 / D-08` anchors outside
  `pluginReasons`. Both are stale after this milestone and both were deliberately
  left out of this phase's edit set. `docs/output-catalog.md` is likewise
  untouched: the catalog's hand-written payload fixtures omit `reasons`, so the
  rendered bytes are unchanged and adding a catalog state here would pre-empt
  DOC-08.

---

*Phase: 95-manifest-independent-installed-inventory*
*Completed: 2026-08-08*

## Self-Check: PASSED

Both claimed source files and the summary exist on disk; all 4 commits
(`1797912`, `c091ebc`, `99f6a00`, `b26ecb3`) resolve in `git log`.

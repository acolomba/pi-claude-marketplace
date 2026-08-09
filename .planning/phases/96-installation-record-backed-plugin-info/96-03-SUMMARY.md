---
phase: 96-installation-record-backed-plugin-info
plan: 03
subsystem: api
tags: [typescript, node-test, orchestrator, notify, network-boundary, output-catalog]

# Dependency graph
requires:
  - phase: 96-installation-record-backed-plugin-info
    plan: 01
    provides: "`buildStateOnlyInstalledRow` and the byte-exact manifest-absent suite this plan extends"
  - phase: 96-installation-record-backed-plugin-info
    plan: 02
    provides: "`composeStateOnlyComponents` / `readStateOnlyHookEntries` and the hooks-degraded row this plan composes the skip note against"
provides:
  - "an executable INFO-12 guard: five call counters on two injected seams pinned at 0 for `--fetch`, bare, and a git-source-shaped record"
  - "`isStateOnlyInfoBlock` / `buildFetchSkipBlock` / `emitStateOnlyFetchSkip` — the D-96-04 skip note, emitted from BOTH `getPluginInfo` arms"
  - "`skipped` on info's command-local cascade render map, delegating to the exported `pluginRow` composer"
  - "two more byte-gated output-catalog states: the surface's first `warning` state and the record-backed two-scope fan-out"
affects: [97 disabled-state classification repair, 98 DOC-08 contract reconciliation]

actuals:
  tokens: 9200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Abstinence proved by call count, not by control flow: the seam the production path would use is injected as a recording double and every counter is asserted at 0, so the claim has a way to fail"
    - "A requested-but-impossible flag is reported as its own `warning` notification beside an unchanged info block, rather than being folded into the block or dropped"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "`emitStateOnlyFetchSkip` derives each block's scope and autoupdate flag from the `PluginInfoMessage` itself (`marketplaceScope`, `marketplaceDetails.autoupdate`) instead of taking a parallel array of pairs. The block already carries both facts, and a pairing the caller assembles by hand is a desync waiting to happen."
  - "The skip note is a cascade row, not a body line inside the info block. `PluginInfoRow.status` admits no `skipped`, so the standalone envelope cannot carry it; inventing a `fetch: skipped` body line would add renderer vocabulary for one caller. The IL-2 break is the one the disabled-inventory path in the same function already takes, with the same commented justification."
  - "`severity: \"warning\"` is stamped on the row rather than left to default. The envelope MAX-reduces its rows, so an omitted severity routes the whole note to `info` with no summary — a skip note that reads like a success."
  - "The two-scope skip note pluralizes to `Some plugin operations need attention.` The plan's expectation carried the singular form; the central `buildSummaryLineForCascade` counts rows, and asserting the singular would have pinned a string the renderer never produces."

patterns-established:
  - "A command-local render-map status set can widen without touching any closed set in `shared/notify.ts`: `notify-closed-set-locks.test.ts` passes unmodified because `skipped` was already a central `PluginStatus`"
  - "The `as const satisfies CommandContext<...>` pin is the enforcement mechanism, not documentation — widening the status set makes a missing render arm a compile error"

requirements-completed: [INFO-12]
# INFO-09 was completed in 96-01; this plan adds its two-scope fan-out state to
# the catalog and pins the severity change, but claims no new requirement for it.

coverage:
  - id: D1
    description: "`info --fetch` against a manifest-absent installation record makes zero calls to the injected clone seam and zero calls to the injected credential seam, asserted as call counts on the mocks"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-12 / NFR-5: `info --fetch` on a manifest-absent record makes ZERO clone-seam and ZERO credential-seam calls"
        status: pass
    human_judgment: false
    rationale: "The same `fetchSeamWith` seam records `cloneCalls.length >= 1` in the manifest-backed `--fetch` tests in `info.test.ts`, so the counters are live instruments rather than always-zero fields."
  - id: D2
    description: "Bare `info` against the same record makes the same five zero seam calls"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-12 / NFR-5: bare `info` on a manifest-absent record makes the same ZERO seam calls"
        status: pass
    human_judgment: false
  - id: D3
    description: "A git-source-shaped record (remote `resolvedSource`) under `--fetch` still makes zero seam calls — the arm never consults the source kind"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-12 / NFR-5: a git-source-shaped manifest-absent record under `--fetch` still makes ZERO seam calls"
        status: pass
    human_judgment: false
  - id: D4
    description: "`buildStateOnlyInstalledRow` takes no `fetchCtx` and constructs no `GitProbe`, so neither `makeFetchProbe` call site is reachable from the state-only arm"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: true
    rationale: "The architecture gate keeps the git surface out of `info.ts` entirely, and the three zero-call tests keep the behavior pinned. Neither can assert that the SIGNATURE stays free of a `fetchCtx` parameter; that is a reading of the declaration, recorded in its doc comment."
  - id: D5
    description: "`info --fetch` on a manifest-absent record emits a `⊘ <plugin> v<version> (skipped) {not in manifest}` note at `warning` severity with the `A plugin operation needs attention.` summary, beside an info block whose bytes match the bare run"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04: `info --fetch` on a manifest-absent record emits the skip note beside an unchanged info block"
        status: pass
    human_judgment: false
  - id: D6
    description: "A bare run and a manifest-DECLARED plugin under `--fetch` emit no skip note — the note is keyed on the arm that fired, not on the flag alone"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04: bare `info` on the same record emits NO skip note"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04: `info --fetch` on a manifest-DECLARED plugin emits NO skip note"
        status: pass
    human_judgment: false
  - id: D7
    description: "A hooks-degraded state-only record under `--fetch` still emits the skip note, and the skip row's brace stays `{not in manifest}` alone"
    requirement: INFO-12
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04: a hooks-degraded state-only record under `--fetch` still emits the skip note"
        status: pass
    human_judgment: false
  - id: D8
    description: "A manifest-absent record in BOTH scopes renders ONE `plugin-info-cascade` at info severity, project-first, plus exactly ONE skip notification carrying one block per scope"
    requirement: INFO-09
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04: two state-only scopes under `--fetch` produce ONE skip notification carrying both blocks"
        status: pass
    human_judgment: false
  - id: D9
    description: "Both new states are published in docs/output-catalog.md and pinned byte-for-byte in both directions, including the severity comparison on the new `warning` state"
    verification:
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts"
        status: pass
    human_judgment: true
    rationale: "The byte gate proves the rendered bytes match. It cannot judge whether the fan-out prose makes clear that a real failure is STILL separated out as its own error notification — the reader has to take that away, and it is the whole reason the severity change is not a regression."

# Metrics
duration: 40min
completed: 2026-08-09
status: complete
---

# Phase 96 Plan 03: Network abstinence and the reported fetch skip Summary

**The state-only info arm's silence about the network is now a property three tests can falsify, and a `--fetch` it cannot carry out says so out loud at `warning` severity instead of rendering the same bytes as a bare run.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-09T02:55:23Z
- **Completed:** 2026-08-09T03:35:50Z
- **Tasks:** 3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- Turned INFO-12 from an accident into an assertion. Before the arm split, a manifest-absent name returned before any fetch-capable builder existed. The arm now sits downstream of `buildInfoFetchContext`, so three tests inject the real clone-cache seam over a mock `gitOps` and a mock `CredentialOps`, then pin `cloneCalls`, `fetchCalls`, `fillCalls`, `approveCalls` and `rejectCalls` at zero — under `--fetch`, bare, and against a record whose `resolvedSource` is a remote URL.
- Added the D-96-04 skip note. `PLUGIN_INFO_STATUSES` widened to `["disabled", "skipped"]`, the `as const satisfies` pin forced the new render arm, and that arm delegates to the exported `pluginRow` composer so its bytes cannot drift from the central renderer or from `update`'s `(skipped) {not in manifest}` precedent.
- Wired the emission into BOTH `getPluginInfo` arms — the single-scope early return and the fan-out — through one helper, so the arm that returns early (the likely miss) is covered directly by its own test.
- Published two catalog states: the info surface's first `warning` state, and the two-scope record-backed fan-out whose severity the arm split changed from two `error` notifications to one `info` cascade.

## Task Commits

Each task was committed atomically:

1. **Task 1: Assert the network abstinence of the state-only arm** - `40fa4f33` (test)
2. **Task 2: Report the requested fetch as skipped** - `4fbd3258` (feat)
3. **Task 3: Publish both states in the catalog** - `8f842314` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - extended `buildStateOnlyInstalledRow`'s doc comment with the structural INFO-12 argument and the test that keeps it true; added `isStateOnlyInfoBlock`, `buildFetchSkipBlock`, `emitStateOnlyFetchSkip`; called the emitter from both `getPluginInfo` arms
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts` - widened `PLUGIN_INFO_STATUSES` and `PluginInfoCascadeMsg`, added the `skipped` render arm, rewrote the file header's surface-boundary note to describe two cascade rows instead of one
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` - the `fetchSeamWith` seam factory copied file-private, a `resolvedSource` seed knob, and eight new cases (three INFO-12, five D-96-04); the suite is now 23 tests
- `docs/output-catalog.md` - `state-only-fetch-skipped` and `state-only-installed-both-scopes-fan-out`, plus a severity-routing paragraph that now names `warning`
- `tests/architecture/catalog-uat.test.ts` - the two matching fixtures (one cascade literal with `expectedSeverity: "warning"`, one `plugin-info-cascade` literal) and the enumerating comment

## Decisions Made

- **The emitter reads scope and autoupdate off the block.** The plan described passing the built blocks "paired with their scope and autoupdate flag". `PluginInfoMessage` already carries `marketplaceScope` and `marketplaceDetails.autoupdate`, so the pairing would have been a second copy of two facts that must agree with the first. The helper takes `readonly PluginInfoMessage[]` and derives both.
- **The skip note is a second notification.** `PluginInfoRow.status` has no `skipped` member, so the standalone envelope cannot express the note at all. The alternative — a `fetch: skipped` body line inside the info block — would keep IL-2 at the cost of renderer vocabulary invented for one caller. The chosen shape follows the disabled-inventory precedent in the same function, with the same commented justification.
- **`severity: "warning"` is explicit on the row.** The envelope MAX-reduces row severities, so omitting the field routes the note to `info` with no summary line. That is the exact failure the note exists to prevent: an outcome that reads like a success.
- **The two-scope note's summary is plural.** The plan's expectation reused the singular `A plugin operation needs attention.` for the two-block case. `buildSummaryLineForCascade` counts rows, and two skipped rows produce `Some plugin operations need attention.` The assertion was corrected to the string the renderer produces; pinning the plan's literal would have pinned a byte form that does not exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The two-scope skip-note expectation used the singular summary**

- **Found during:** Task 2 (the fifth D-96-04 test)
- **Issue:** The plan specified `"A plugin operation needs attention."` as the summary for the two-scope skip note. The central `countSkippedRows` / `buildSummaryLineForCascade` pair counts rows across all blocks, so two skipped rows pluralize to `"Some plugin operations need attention."` The test failed on the first run against correct production output.
- **Fix:** Corrected the expectation to the plural form and commented why. Production code unchanged — the renderer was right.
- **Files modified:** tests/orchestrators/plugin/info-manifest-absent.test.ts
- **Verification:** The five D-96-04 tests pass; `tests/architecture/notify-closed-set-locks.test.ts` passes unmodified.
- **Committed in:** `4fbd3258` (Task 2 commit)

**2. [Rule 2 - Missing critical consistency] The emitter's block/scope pairing was collapsed**

- **Found during:** Task 2 (`emitStateOnlyFetchSkip`)
- **Issue:** The plan's signature takes the blocks "paired with their scope and autoupdate flag". Both facts already live on the block (`marketplaceScope`, `marketplaceDetails.autoupdate`), so the pairing introduces a second source that can disagree with the first — the kind of duplication CLAUDE.md's surgical-change and simplicity rules point away from.
- **Fix:** The helper takes `readonly PluginInfoMessage[]` and reads both fields off each block. `buildFetchSkipBlock` keeps the plan's four-parameter shape, so its symmetry with `buildDisabledInventoryBlock` is intact.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- **Verification:** The single-scope, hooks-degraded and two-scope tests all assert the rendered `[project]` / `[user]` brackets and the absent `<autoupdate>` marker, so the derivation is pinned at the byte level.
- **Committed in:** `4fbd3258` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug in a plan expectation, 1 consistency)
**Impact on plan:** Every behavioral must-have holds. No new exported symbol, no new reason token, no new plugin-status token, and `shared/notify.ts` is untouched.

## Issues Encountered

- `grep` still cannot read `info.ts` (the NUL byte makes it look binary). Every inspection used `Read` or `node -e` with `readFile`.
- The worktree trufflehog hook fails structurally on every commit (`.git` is a file, not a directory). Each commit was preceded by a clean `trufflehog filesystem` scan over the changed paths, then committed with `SKIP=trufflehog` per the project's documented worktree procedure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- INFO-12 is complete and, more usefully, falsifiable. Note the limit of the guard: the three tests pin BEHAVIOR, and `no-orchestrator-network.test.ts` pins the IMPORTS. Neither can see a `fetchCtx` parameter appearing on `buildStateOnlyInstalledRow`; only the doc comment records that constraint.
- `isStateOnlyInfoBlock` infers the arm from the rendered row. It is exact today because only the state-only arm stamps `not in manifest` on a non-failed info row. A future arm that does the same would silently acquire a skip note; the manifest-declared negative control is the tripwire, and a third consumer of "which arm fired" should convert `buildBlock` to return a discriminated result instead.
- The 96-02 constraint still holds and now has a second reason to hold: the state-only arm opens exactly ONE file, so a bare read reason on that row means hooks. This plan added no disk read.
- D-96-02's folded-row catalog note in the list section is still open, as it was after 96-01 and 96-02.
- `shared/notify.ts` and its closed sets are untouched; `notify-closed-set-locks.test.ts` passes with no count change.

---
*Phase: 96-installation-record-backed-plugin-info*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 5 source artifacts and the SUMMARY exist on disk; all 3 task commits
(`40fa4f33`, `4fbd3258`, `8f842314`) are present in git history. `npm run check`
exits 0 with `PI_SUBAGENTS_ROOT` set (3293 tests, 0 failures). No stubs, no
skipped tests, no unrun `<verify>` blocks.

---
phase: 29-load-converges-on-the-catalog
plan: 13
subsystem: reconcile
tags: [apply, convergence, growth-move, backfill-retired, reinstall, output-catalog, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-12: apply's convergeScope runs revision moves through PluginUpdateOperations.convergePlugin"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-11: planConvergence plans growth-only moves (revisionChanged false, grew true)"
provides:
  - "PluginConvergeTarget.rematerialize: the converge runner turns skipSameRevision off for a growth-only move, overwrite stays off (D-10, D-25, D-26)"
  - "apply runs every planner move; a growth-only move reports the plugin-backfilled row, a grown revision move leads its (updated) row with {components now supported}"
  - "the load-time backfill, its extension-version gate, EXTENSION_VERSION and ScopeReadResult.stateExisted are deleted; lastReconciledExtensionVersion stays readable and nothing writes it (D-13)"
  - "/claude:plugin reinstall builds its bulk entry around createReinstallOperation; createNodeReinstallPlugins(reinstallPlugin) takes the single-plugin operation"
  - "step: the published plugin {string} of the marketplace {string} no longer has an output style"
  - "scenario: Apply makes a partially installed plugin whole when its new version needs no unsupported component"
affects: [29-14, apply, reinstall, pending, load]

actuals:
  tokens: 72201
  tasks: 3
  commits: 3
plan_head_before: e6846a44c9c5cf2b51cad8218daa48c938d1d62a
plan_head_after: 676d4cd29bd3b84e48d07388b97cb6bf103e98fc

tech-stack:
  added: []
  patterns:
    - "One converge entry, two policies: the target's rematerialize flag selects a runner whose only difference is skipSameRevision"
    - "A growth-only move maps the update runner's updated outcome onto the existing plugin-backfilled outcome, so the backfill row composers stay the single source of the growth row bytes"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - docs/output-catalog.md
    - features/plugin/apply.feature
    - features/lib/published-marketplace.ts
    - features/step_definitions/plugin/publishing.steps.ts
  deleted:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/shared/extension-version.ts
    - test/orchestrators/reconcile/backfill.test.ts
    - test/shared/extension-version.test.ts
    - test/architecture/extension-version-sync.test.ts

key-decisions:
  - "A growth-only move's updated outcome becomes a plugin-backfilled outcome in apply.ts (private grownMoveOutcomes): version = toVersion, installable = no partialDegrade kinds, unsupported = partialDegrade kinds, the orphan-rewake and malformed signals through the existing installedRowDegradation, MCP notices carried. Any other result goes through convergedMoveOutcomes."
  - "withGrowthMarker in notify.ts prepends components now supported to the (updated) or (partially-installed) row of a move with grew, on both row forms"
  - "apply test records now state the supported kinds their trees have: pluginRecord derives a default supported set from the seeded resources (impliedSupported), and fixtures whose records name no resources pass supported explicitly, so only the growth cases grow"
  - "supportedSetGrew is now private to convergence.ts (its only other caller was the backfill)"
  - "Three backfill behaviors were not moved because the design replaced them: the stamp gate and its writes (D-13), the RECON-04 outcome dedupe (convergence plans on the state the apply pass left), and the silent skip of a record removed between the snapshot and the re-materialize (the runner's failed row is the honest result now, as for revision moves since 29-12)"

patterns-established:
  - "Growth moves and revision moves share convergePlugin; only the policy knob differs"

requirements-completed: [APL-02, APL-01]

coverage:
  - id: D1
    description: "rematerialize on PluginConvergeTarget and the policy switch in convergePlugin; overwrite stays off on both policies"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/types.test.ts#PLUGIN_CONVERGE_TARGET (rematerialize required)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-10 / D-25: convergePlugin with rematerialize re-materializes the recorded revision"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-26 / T-29-29 / T-29-35: convergePlugin keeps an agent file a user edited and fails the move when rematerialize is true"
        status: pass
    human_judgment: false
  - id: D2
    description: "apply re-materializes grown plugins with the backfill row, keeps clean records clean, never grows a disabled record, and makes a partial record whole"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#applyReconcile catalog convergence"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#convergedMoveOutcomes WCONV-03"
        status: pass
      - kind: integration
        ref: "test/integration/workflow-kind-inversion.test.ts#WCONV-01 / WCONV-02: a load leaves a record whose kind was invisible alone, one apply converges it, and the next apply rewrites nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The made-whole scenario: a --partial plugin whose new version drops its output style is listed as will update, moved by apply, and listed installed"
    requirement: APL-02
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply makes a partially installed plugin whole when its new version needs no unsupported component"
        status: pass
    human_judgment: false
  - id: D4
    description: "The backfill, its stamp gate and EXTENSION_VERSION are gone; reinstall runs through createReinstallOperation; fallow dead-code stays green"
    requirement: APL-01
    verification:
      - kind: other
        ref: "npx fallow dead-code --trace extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts:createReinstallOperation (USED by edge/register.ts)"
        status: pass
      - kind: other
        ref: "npm run fallow"
        status: pass
      - kind: e2e
        ref: "features/plugin/reinstall.feature"
        status: pass
    human_judgment: false
  - id: D5
    description: "The catalog and the production comments describe growth moves as apply's"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 48min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 13: Apply Re-materializes Grown Plugins; the Backfill Retires Summary

**`apply` now re-materializes a plugin whose supported set grew, at its recorded revision, through the same converge runner as a catalog move. It reports the backfill row. The load-time backfill, its extension-version gate and `EXTENSION_VERSION` are deleted, and `reinstall` builds its bulk entry around `createReinstallOperation`.**

## Performance

- **Duration:** 48 min
- **Started:** 2026-10-24T22:08:41Z
- **Completed:** 2026-10-24T22:57:02Z
- **Tasks:** 3
- **Files modified:** 44 (5 deleted)

## Accomplishments

- `PluginConvergeTarget.rematerialize` selects `{ ...CONVERGE_MATERIALIZATION, skipSameRevision: false }`. `overwrite` stays `false`, so a user-edited agent is still kept (T-29-35).
- `apply`'s `convergeScope` runs every planner move. A growth-only move reports `(installed) {components now supported}` or `(partially-installed) {components now supported, <kinds>}`. A revision move that also grew leads its `(updated)` row with `{components now supported}`.
- The backfill module, `shared/extension-version.ts`, their three test files and `ScopeReadResult.stateExisted` are gone. `lastReconciledExtensionVersion` stays in `STATE_SCHEMA` with its carry-through (4 mentions in state-io.ts). No code writes it, and an apply test proves an old stamp stays as written.
- `/claude:plugin reinstall` runs `createNodeReinstallPlugins(createReinstallOperation(hooksRouting, deps.completionCache))`. Both factories keep production callers.
- New publishing step and the made-whole scenario (D-19).

## Task Commits

1. **Task 1: End-to-end -- apply makes a partially installed plugin whole** - `5d064514` (feat)
2. **Task 2: Retire the backfill and the extension-version stamp; route reinstall through the single-plugin operation** - `f160c91d` (refactor)
3. **Task 3: The catalog and the source comments describe apply's growth moves** - `676d4cd2` (docs)

## Moved backfill behaviors (none dropped silently)

| Backfill case | New home |
| --- | --- |
| BFILL-01 promotes a grown plugin to a full record | apply.test `D-10 / D-25 / WCONV-03: a plugin whose supported set grew is re-materialized ...`; integration `WCONV-01 / WCONV-02 ...` |
| BFILL-01 partial re-materialize keeps the unsupported kinds | apply.test `D-12 / D-25: a partial record whose supported set grew stays partial ...` |
| SURF-05 orphan rewake / WARN-01 malformed kinds on a promotion | apply.test `SURF-05 / WARN-01: a growth move names the orphan rewake and the malformed skill ...` |
| WCONV-01 clean record grown and promoted | apply.test growth case (record `installable: true`) |
| WCONV-01 declines to degrade a clean record | apply.test `WCONV-01 / T-29-33 ...`; convergence.test `D-10 / WCONV-01: a grown set whose candidate would drop components is declined ...` |
| ENBL-08 disabled record never grows | apply.test `ENBL-08: a disabled record whose supported set grew ...`; convergence.test `ENBL-08: a disabled record whose supported set grew is not a move` |
| RECON-04 no re-materialize behind a same-pass disable | apply.test `RECON-04 / ENBL-08: a plugin the same apply disables is not re-materialized ...` |
| D-68-03 no growth / not a superset | convergence.test `BFILL-01: ... at the recorded revision is not a move` (both NOT_GROWN cases) |
| D-18-12 a promotion records the offered version | apply.test `WCONV-03: a revision move whose supported set also grew ...` (records 1.1.0) |
| AFILE-04 MCP comments notice on a promotion | apply.test `AFILE-04: a growth move that rewrites a commented mcp-adapter.json ...` |
| SF-01 failed re-materialize reports its reason | apply.test `D-13: a growth move that fails to materialize ...` |
| Per-plugin isolation, sibling still converges | apply.test `D-13: a move that fails to materialize reports its reason and the next move still runs` |
| WR-05 no unsolicited state.json | apply.test `WR-05: an apply over a declared scope that records nothing brings no state.json into existence` |
| DLS-01 a delisted plugin does not block another's growth | convergence.test `DLS-01: a delisted record whose installed copy reads does not stop another plugin's growth move` |
| D-05-07 delisted with no copy fails closed | convergence.test `D-05-07: a scope whose declaration walk cannot be read previews no move at all` |
| SF-02 manifest no longer declares / cannot be read | convergence.test `DLS-D1 ...` and `D-05-07: a scope whose marketplace manifest cannot be read previews no move` |
| Stamp gate cases (BFILL-02, D-68-01, RECON-05 stamp, D-68-03 stamp, WR-01, WR-02, SF-02 gate-open) | retired by D-13: no gate exists. apply.test `BFILL-01 / D-13 ...` proves an old stamp stays as written |
| NFR-5 git source skipped at load | replaced: apply may clone a git target on a cache miss (D-11), covered by 29-12's git-source-update scenario |

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] apply test fixtures grew once growth ran on every apply**
- **Found during:** Task 1
- **Issue:** 22 apply.test cases seeded records with `supported: []` over trees that have components, so after Task 1 each of them showed a growth row.
- **Fix:** `pluginRecord` derives a default `supported` set from the seeded resources (`impliedSupported`). Records that name no resources pass `supported: ["skills"]` explicitly. The growth cases pass their supported set explicitly.
- **Files modified:** test/orchestrators/reconcile/apply.test.ts
- **Committed in:** 5d064514

**2. [Rule 3 - Blocking] Literals and owners outside the plan's file list**
- **Found during:** Tasks 1 and 2
- **Issue:** `rematerialize` is required, so the `convergePlugin` call in test/orchestrators/plugin/operations.test.ts no longer compiled. Removing `stateExisted` broke literals in test/orchestrators/reconcile/delisted-plugins.test.ts. The growth-marker branch in notify.ts needed its owner test (test/orchestrators/reconcile/notify.test.ts) for 100% direct coverage.
- **Fix:** Added `rematerialize: false`, dropped `stateExisted`, and added two notify.test cases.
- **Committed in:** 5d064514, f160c91d

**3. [Rule 1 - Bug] Stale convergeScope doc from 29-12**
- **Found during:** Task 2
- **Issue:** The `convergeScope` doc and the apply loop comments still said a growth-only move is left to the backfill.
- **Fix:** Rewrote them to say the move re-materializes the recorded revision.
- **Committed in:** f160c91d

**4. [Acceptance criterion, not satisfiable as written] One-line grep for the reinstall wiring**
- **Found during:** Task 2
- **Issue:** `grep -c 'createNodeReinstallPlugins(createReinstallOperation(' extensions/pi-claude-marketplace/edge/register.ts` prints `0`, because the call is 116 characters long and Prettier (printWidth 100) splits it over three lines. A shorter variable name still does not fit.
- **Fix:** None needed: the code is the exact expression the plan asks for. `tr -d ' \n' < register.ts | grep -c 'createNodeReinstallPlugins(createReinstallOperation('` prints `1`, and the fallow trace reports `createReinstallOperation` USED by edge/register.ts.
- **Committed in:** f160c91d

**5. [Scope] supportedSetGrew made private**
- **Found during:** Task 2
- **Issue:** Its only importer outside convergence.ts was the deleted backfill, so fallow would report it as unused.
- **Fix:** Removed the `export` and rewrote its doc comment.
- **Committed in:** f160c91d

---

**Total deviations:** 5 (1 bug, 3 blocking/scope, 1 unsatisfiable grep). **Impact:** no behavior beyond the plan's; every change is needed for the gates or for correct docs.

## Issues Encountered

None beyond the deviations above.

## Verification

- Task verifies: owner suites (types, update-flow, operations, apply, notify, convergence, read-pass, reinstall-flow, reinstall handler, register, index), 100% direct coverage for apply.ts, update-flow.ts, notify.ts, reinstall-flow.ts, register.ts, convergence.ts, read-pass.ts, types.ts and operations.ts, `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm run test:unpaired`, `npm run test:integration`, `npm run check:features`, `features/plugin/apply.feature`, `features/plugin/reinstall.feature`, and the catalog contract.
- Acceptance: step grep `1`, `readonly rematerialize` grep `1`, both deleted files absent, `lastReconciledExtensionVersion` in state-io.ts `4`, catalog phrase grep `0`, stale-comment rg exit 1, both fallow traces USED (see deviation 4 for the reinstall-wiring grep).
- `npm run check` at 676d4cd2: **exit 0**. Tail:

```text
16 hooks (16 passed)
790 scenarios (790 passed)
7632 steps (7632 passed)
0m 27.275s (3m 13.899s executing your code)
Merged LCOV: coverage/direct.lcov (284 records)
exit=0
```

(284 records, down from 286: the backfill and extension-version source-test pairs are deleted.)

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. (T-29-33: apply.test proves a clean record whose grown candidate is partially available is declined and state.json is unchanged. T-29-34: the schema keeps the optional stamp and its carry-through, and an apply test reloads an old stamp unchanged. T-29-35: the growth policy changes only `skipSameRevision`, and the update-flow test proves a user-edited agent is kept under `rematerialize: true`.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 29-14. Notes for it:

- `orchestrators/reconcile/README.md` still names `backfill.ts`.
- `orchestrators/reconcile/types.ts` still has a historical note ("Both moved from apply.ts when the backfill pass became its own module").
- The memory/version-bump checklist names `EXTENSION_VERSION`, which no longer exists.
- The `plugin-backfilled` outcome kind and `backfilledRowFromOutcome` keep their names; they now report `apply`'s growth move.

## Self-Check: PASSED

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*

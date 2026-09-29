---
phase: 01-presentation-model
plan: 05
subsystem: notify
tags: [notify, presentation-model, text-strategy, soft-dep-markers, architecture-gate]

requires:
  - phase: 01-presentation-model
    provides: "01-04 resolveRows composes soft-dep markers under each command's marker policy; RenderFn over ResolvedRow"
provides:
  - "notify-context.ts: RenderFn<M> = (row: ResolvedRow<M>, mpScope: Scope) => string; dispatchRow(context, row, mpScope)"
  - "notification-grammar.ts: probe-free helpers and renderers; composeReasons(reasons) formats a resolved list only"
  - "notification-dispatch.ts: the one softDepStatus(pi) snapshot per emission feeds resolveRows only"
  - "tests/architecture/gate-targets.ts: SOFT_DEP_MARKER_DERIVATION_TARGETS"
  - "tests/architecture/workflows-marker-coverage.test.ts: the softDepMarkers call-site scan and its planted control"
affects: [json-output wire strategy (Phase 2), Phase 7 docs note on composeReasons prose]

actuals:
  tokens: 40800
  tasks: 2
  commits: 2
plan_head_before: 93ba067316b35a3472dfb46b92f47d1b4c122cff
plan_head_after: 51cb953eed77cb534610cdf47d5a3ee309bdfba9

tech-stack:
  added: []
  patterns:
    - "Text strategy is probe-free: arms and grammar helpers format resolved rows; the soft-dep snapshot stops at resolveRows"
    - "Single marker derivation site, bound by a filesMatching scan with a planted-copy control"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/orchestrators/**/*.messaging.ts (13 files)
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notify-context.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-summary.test.ts
    - tests/orchestrators/**/*.messaging.test.ts (12 files)
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/gate-targets.ts
    - tests/architecture/workflows-marker-coverage.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "composeReasons(reasons) takes only the resolved list; the three declares-flags go with the probe, because every caller passed false once resolve owned the markers"
  - "The planted control copies a real registered orchestrator and appends the call, instead of creating a new orchestrators/planted.ts, because D-07-05/06 forbid naming an unregistered production path in a gate file and registry entries must resolve"
  - "Comments that credited hard-coded false flags for MSG-SD-3 / ENBL-15 / SNM-11 now credit the marker policy, which maps those statuses to off in every context"

patterns-established:
  - "A new soft-dep marker caller must go through resolveRows; the D-12 scan turns a second softDepMarkers call site red"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "RenderFn is (row, mpScope); dispatchRow, the emitters, and every messaging arm take no probe; a probe-taking arm is a compile error"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-context.test.ts (@ts-expect-error D-13: a render arm takes no soft-dep probe argument)"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#context dispatch forwards the row and the enclosing marketplace scope, and no probe"
        status: pass
    human_judgment: false
  - id: D2
    description: "notification-grammar.ts imports neither SoftDepStatus nor softDepMarkers; composeReasons(reasons) returns an empty string for an undefined or empty list and otherwise the comma-joined brace"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#omits an undefined reasons block"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#omits an empty reasons block"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#renders resolved reasons in their supplied order and adds none"
        status: pass
      - kind: other
        ref: "! rg -n \"SoftDepStatus|softDepMarkers\" extensions/pi-claude-marketplace/shared/notification-grammar.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-12 / SC-5: softDepMarkers is called only from shared/notification-resolve.ts, and a call planted in a copy of a real orchestrator is reported by the same scan"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-marker-coverage.test.ts#D-12 / SC-5: softDepMarkers is called only from the resolve module"
        status: pass
      - kind: unit
        ref: "tests/architecture/workflows-marker-coverage.test.ts#D-12: the derivation-site scan reports a softDepMarkers call planted in a copy of a real orchestrator"
        status: pass
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Emitted bytes are unchanged: the wire corpus and the output catalog match, and npm run check passes"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2f173031 -- docs/output-catalog.md"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 73min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 05: Probe-Free Text Strategy Summary

**Render arms and the grammar now take resolved rows and no soft-dep probe. `RenderFn` is `(row, mpScope)`, `composeReasons(reasons)` only formats a resolved list, and the grammar imports neither `SoftDepStatus` nor `softDepMarkers`. An architecture scan binds every `softDepMarkers(` call to `shared/notification-resolve.ts`, and a planted control proves the scan fires. All 2622 corpus entries and the output catalog are byte-identical.**

## Performance

- **Duration:** 73 min
- **Started:** 2026-09-29T19:18:37Z
- **Completed:** 2026-09-29T20:32:31Z
- **Tasks:** 2
- **Files modified:** 37

## Accomplishments

- Nothing in this plan was done before it started. 01-04 had moved `RenderFn` onto `ResolvedRow` but left the `probe` parameter in the signature, in every arm, and in every grammar helper.
- `notify-context.ts`: `RenderFn<M>` is `(row: ResolvedRow<M>, mpScope: Scope) => string`. The four entry points pass `(row, mpScope) => dispatchRow(context, row, mpScope)`, and the file no longer imports `SoftDepStatus`.
- `notification-grammar.ts`: every helper and renderer in the plan's interface list lost its probe, including `renderMpHeader(mp)`, `composeMarketplaceBlock(mp)`, `composeReconcileAppliedBody(marketplaces)`, `composePluginLinesWith(p, mpScope, renderRow)`, and the four info renderers. `composeReasons(reasons)` keeps its name and formats the list it is given.
- `notification-dispatch.ts`: `notify()` still reads `softDepStatus(pi)` once per emission, so the `getAllTools()` pins stay unchanged. The snapshot feeds `resolveRows` only. `dispatchInfoMessage` keeps its probe parameter for the reconcile-applied arm's `resolveRows` and passes it to no renderer.
- All 13 affected messaging files: each arm is `(p, mpScope) => ...` and passes no probe. The eight `*_RENDER` annotations are unchanged.
- `workflows-marker-coverage.test.ts` gains two cases. The first requires the `softDepMarkers(` call-site set to be exactly `SOFT_DEP_MARKER_DERIVATION_TARGETS`, checked in both directions. The second is a planted control. All the file's WDEP-04 cases are still there.

## Task Commits

1. **Task 1: Render arms and the grammar take resolved rows and no probe** - `a16d35a1` (refactor)
2. **Task 2: workflows-marker-coverage scans the resolve derivation site (D-12, SC-5)** - `51cb953e` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify-context.ts` - `RenderFn` and `dispatchRow` without a probe
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - probe-free helpers; one-argument `composeReasons`; comments restated
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` - the probe reaches `resolveRows` only
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - one comment on `PluginUninstalledMessage.reasons` restated
- `extensions/pi-claude-marketplace/orchestrators/**/*.messaging.ts` - arms take `(p, mpScope)`; comments restated in reinstall, reconcile, install, enable-disable, and list
- `tests/shared/*.test.ts`, `tests/orchestrators/**/*.messaging.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts` - probe arguments, constants, helpers, and imports removed; asserted bytes unchanged
- `tests/architecture/gate-targets.ts` - `SOFT_DEP_MARKER_DERIVATION_TARGETS`
- `tests/architecture/workflows-marker-coverage.test.ts` - header names both claims; the D-12 scan and its planted control
- `scripts/check-unused-type-members.contracts.json` - 32 pin locations moved by line only; no pin targeted a removed `probe`

## Decisions Made

- `composeReasons` dropped its three declares-flags along with the probe. The plan's target signature is `composeReasons(reasons)`, and once resolve owned the markers every caller passed `false` for all three flags.
- The planted control appends a `softDepMarkers(...)` call to a copy of `orchestrators/reconcile/apply-outcomes.ts`, a registered target, and does not create a new `orchestrators/planted.ts`. See deviation 3.
- Comments that said MSG-SD-3, ENBL-15, and SNM-11 held because the flags were hard-coded `false` now say that the marker policy maps `uninstalled`, `disabled`, `available`, and `remote` to off in every context. `CENTRAL_MARKER_POLICY` and all 18 context tables agree on this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale prose] Comments outside the plan's list described the removed flags**
- **Found during:** Task 1
- **Issue:** Comments in `reconcile.messaging.ts`, `install.messaging.ts`, `enable-disable.messaging.ts`, `list.messaging.ts`, and `shared/notification-types.ts` said the arms passed hard-coded `false` soft-dep flags, and those arguments no longer exist. `notification-types.ts` is not in the plan's file list.
- **Fix:** Each comment now credits the marker policy, the mechanism that actually keeps those rows marker-free.
- **Files modified:** the four messaging files and `shared/notification-types.ts`
- **Committed in:** `a16d35a1`

**2. [Rule 3 - Blocking] Tests outside the plan's file list passed the probe**
- **Found during:** Task 1
- **Issue:** `tests/shared/notification-dispatch.test.ts` and `tests/shared/notification-summary.test.ts` declare row renderers with a `_probe` parameter, and one dispatch case asserted the probe the emitter forwarded.
- **Fix:** The renderers take `(row)`. The forwarding case now asserts the recorded arguments are exactly `[row, "user"]`, so a probe forwarded as a third argument fails it.
- **Committed in:** `a16d35a1`

**3. [Plan wording] The planted caller is a copy of a real orchestrator, not a new `planted.ts`**
- **Found during:** Task 2
- **Issue:** `gate-targets.test.ts` fails a gate file that names an unregistered production path, and it fails a registry entry that does not resolve. A literal `extensions/pi-claude-marketplace/orchestrators/planted.ts` breaks one rule or the other. `plantOffender` also reads the real file it appends to.
- **Fix:** The control copies the registered target and a real orchestrator (`PLANTED_CALLER_HOST`, typed `(typeof WORKFLOWS_MARKER_COVERAGE_TARGETS)[number]`) into a temp root, appends a call, and asserts the scan reports both files. This is the D-07-01 mechanic the other gates use.
- **Verification:** the case passes; `gate-targets.test.ts` passes
- **Committed in:** `51cb953e`

**4. [Rule 2 - Missing proof] D-13 had no negative type check**
- **Found during:** Task 1
- **Issue:** The positive `satisfies RenderFn` check in `notify-context.test.ts` stays true even if `RenderFn` regains an optional probe.
- **Fix:** An `@ts-expect-error` case: a `(row, probe, scope)` arm does not satisfy `RenderFn`.
- **Committed in:** `a16d35a1`

**5. [Plan wording] The RenderFn acceptance grep is single-line**
- **Found during:** Task 1
- **Issue:** Prettier wraps the declaration at 100 columns, so the literal one-line `rg` pattern cannot match.
- **Fix:** None needed. The multiline form `rg -U "RenderFn<M extends PluginNotificationMessage> = \(\s*row: ResolvedRow<M>,\s*mpScope: Scope,?\s*\) => string"` matches lines 44-47.

---

**Total deviations:** 5 (1 stale-prose fix, 1 blocking test fix, 1 added proof, 2 plan-wording adjustments).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- As in 01-02 through 01-04, the first corpus check failed until the type-member contract pins were moved.
- One pre-commit run failed `npm-type-members-negative` with "plant-removed: the report differs from the baseline" and "files were modified". Task 2 edits landed while that hook was running. Run again on the quiet tree, all 7 controls passed.
- `fallow audit` returns `warn`, not `fail`. Measured with `--base HEAD`, this change adds two advisory clone groups. One is the render-map arms shared by `enable-disable.messaging.ts` and `marketplace/update.messaging.ts` (`partially-installed` / `skipped` / `failed`). The other is shared by `enable-disable.messaging.ts` and `install.messaging.ts` (the `installed` arm and `partially-installed`). These arm lines already matched across files when each one carried `probe`; removing the argument made the matched regions reach fallow's threshold. The enable-disable / fetch group from 01-04 kept its size. `npm run fallow` passes. Removing the clones would need a shared-arms helper or passing `partiallyInstalledRow` by reference, now that its signature matches `RenderFn`. Both are outside this plan.

## Verification

- `npm run typecheck`, `npm run lint`: pass.
- The plan's focused suite, plus `notification-summary.test.ts`: 629/629.
- `! rg -n "SoftDepStatus|softDepMarkers" extensions/pi-claude-marketplace/shared/notification-grammar.ts`: no match.
- `! rg -n "\(p, _?probe, mpScope\)|, probe\)|probe: SoftDepStatus|, probe,$" ... -g '*.messaging.ts'`: no match.
- `rg -n "probe" extensions/pi-claude-marketplace/shared/notification-grammar.ts`: two prose hits only, both "probe-derived reason" wording the plan keeps.
- `node scripts/notify-corpus.mjs check`: `Notify corpus check passed: 2622 baseline entries present, 5 extra.` The five extras are the D-12 cases from 01-04.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty (exit 0).
- `npm run test:coverage:direct -- --base HEAD`: "Direct coverage passed" for all 18 changed or paired production files. Examples: notification-grammar.ts at 180/180 branches, notify-context.ts at 19/19, notification-dispatch.ts at 44/44.
- `npm run fallow`, `npm run lint:type-members`, `npm run lint:type-members:negative` (7 of 7): pass.
- `node --test tests/architecture/workflows-marker-coverage.test.ts tests/architecture/gate-targets.test.ts`: 19/19, including both D-12 cases.
- `npm run check`, run unpiped and logged: `CHECK_EXIT=0`. Unit 7352/7352, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

The text strategy takes resolved rows only, and nothing probe-shaped remains in the render path. Phase 2 can add a JSON strategy over the same `ResolvedRow` / `ResolvedMarketplace` model. The Phase 7 docs note from 01-04 still applies: `docs/output-catalog.md` prose says `composeReasons` appends the soft-dependency markers, and that has been false since 01-04.

## Self-Check: PASSED

- `.planning/phases/01-presentation-model/01-05-SUMMARY.md` exists.
- Commits `a16d35a1` and `51cb953e` exist on `features/json`.

---
*Phase: 01-presentation-model*
*Completed: 2026-09-29*

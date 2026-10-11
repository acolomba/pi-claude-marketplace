---
phase: 01-presentation-model
plan: 04
subsystem: notify
tags: [notify, presentation-model, resolve-step, soft-dep-markers, marker-policy]

requires:
  - phase: 01-presentation-model
    provides: "01-03 resolveRows with failure and hint facts, ResolvedRow, ResolvedMarketplace, and the hasRenderArm floor"
provides:
  - "notification-resolve.ts: MarkerPolicy, CENTRAL_MARKER_POLICY, ResolvedRowFacts.reasons, resolveRows(marketplaces, snapshot, markers, hasRenderArm?)"
  - "notify-context.ts: CommandContext.markers; RenderFn over ResolvedRow<M>"
  - "markers tables on all 18 *_CONTEXT consts"
  - "tests/architecture/soft-dep-marker-policy.test.ts: the SC-5 per-verb marker table as data"
affects: [01-presentation-model probe removal from arms (D-13), Phase 2 policy extension, json-output wire schema]

actuals:
  tokens: 45700
  tasks: 2
  commits: 2
plan_head_before: f013bfe3a02c11b02f9517c82b32441563762b29
plan_head_after: e3044f280e808b7c3984390676dec5121b462926

tech-stack:
  added: []
  patterns:
    - "Marker policy as data: a total per-status `markers` map beside `render` on each CommandContext, pinned by the same `as const satisfies CommandContext<...>` anchor"
    - "Resolved reasons: content reasons first, then softDepMarkers(on && declares ...) in agents, mcp, workflows order, never sorted or de-duplicated"
    - "Render arms and grammar helpers take resolved rows and pass three false declares-flags to composeReasons"

key-files:
  created:
    - tests/architecture/soft-dep-marker-policy.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/orchestrators/**/*.messaging.ts (15 files, 18 contexts)
    - tests/shared/notification-resolve.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notify-context.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-summary.test.ts
    - tests/orchestrators/**/*.messaging.test.ts (15 files)
    - tests/orchestrators/plugin/shared.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "MarkerPolicy is Partial<Readonly<Record<status, boolean>>> and CommandContext.markers is Readonly<Record<Status, boolean>>, because @typescript-eslint/consistent-indexed-object-style rejects the mapped-type spelling"
  - "resolveRow stays an if-chain ending in a fallback return, so an out-of-band row whose status no branch names still resolves (with reasons: []) and reaches the missing-arm diagnostic"
  - "Each context emitter reads softDepStatus(pi) once, before resolveRows, and hands the same snapshot to the resolve step and the renderers"
  - "renderMpHeader takes a ResolvedMarketplace, because a resolved marketplace is no longer assignable to MarketplaceNotificationMessage"

patterns-established:
  - "New marker decision: set the status's value in the context's markers map and in the SC-5 table literal; typecheck fails until the map is total"
  - "Arm tests build rows as `satisfies ResolvedRow<XMsg>` literals with the final reasons written out; they never call resolveRows"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "resolveRows composes each row's final reasons as content reasons followed by softDepMarkers gated by the row status's policy value and the snapshot; order is content, agents, mcp, workflows; duplicates are kept; a row without dependencies or a status the policy does not name gets no marker"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#D-12: a agents dependency with the policy on and its companion missing resolves reasons orphan rewake, requires pi-subagents"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#PMOD-01: puts content reasons first, then the agents, mcp, workflows markers"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#PMOD-01: keeps duplicate content reasons ahead of the markers"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#D-12: a status the policy does not name gets no marker"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-resolve.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every CommandContext carries a total markers map; the four notify-context entry points and the three context emitters pass it to resolveRows; the legacy notify() path and the standalone reconcile-applied arm read CENTRAL_MARKER_POLICY"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notify-context.test.ts#D-12: notifyWithContext composes row markers under the context's marker policy"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#D-12: context dispatch composes each row's markers under the caller's marker policy"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC-5: the per-verb marker table is stated as an independent literal and deep-compared against all 18 contexts and CENTRAL_MARKER_POLICY; flipping FETCH_CONTEXT.markers.remote turned exactly that row red"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/architecture/soft-dep-marker-policy.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Render arms and grammar helpers take resolved rows and read no dependencies; arm tests pass literal resolved rows"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/**/*.messaging.test.ts"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-grammar.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Emitted bytes are unchanged: the wire corpus, the output catalog, and catalog-contract all match, and npm run check passes"
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

duration: 122min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 04: Marker Policy Summary

**`resolveRows` now composes each row's `{requires ...}` markers from the soft-dep snapshot and its command's `markers` policy, so every render arm receives final reasons. All 18 command contexts carry the policy as data, the legacy path reads `CENTRAL_MARKER_POLICY`, and an SC-5 test states the whole table. All 2622 corpus entries and the output catalog are byte-identical.**

## Performance

- **Duration:** 122 min
- **Started:** 2026-09-29T17:12:33Z
- **Completed:** 2026-09-29T19:14:23Z
- **Tasks:** 2
- **Files modified:** 42 (1 created)

## Accomplishments

- `notification-resolve.ts` exports `MarkerPolicy` and `CENTRAL_MARKER_POLICY` (on for `installed`, `updated`, `reinstalled`, and `partially-installed`; off for the other 15 statuses). `ResolvedRowFacts` gains `reasons`, and `ResolvedRow` omits `reasons` and `dependencies`. `resolveRows(marketplaces, snapshot, markers, hasRenderArm?)` sets each row's `reasons` to its content reasons followed by `softDepMarkers(on && ...)`, where `on` is the status's policy value. A status the policy does not name counts as off.
- `CommandContext` gains `markers`, total over the command's statuses. `RenderFn<M>` takes a `ResolvedRow<M>`. The four notify functions pass `context.markers` to the emitters, and each emitter passes it with its one `softDepStatus(pi)` snapshot to `resolveRows`.
- `installedLikeRow`, `partiallyInstalledRow`, the central `installed` / `updated` / `reinstalled` arms, and the inline `updated` arm in `marketplace/update.messaging.ts` pass three `false` flags to `composeReasons`. The grammar no longer reads a row's `dependencies`. The row helpers take `ResolvedRow<...>` parameters, and the eight `*_RENDER` annotations keep their text.
- `tests/architecture/soft-dep-marker-policy.test.ts` states the per-verb table as 19 literal rows, one `test()` each.

## Task Commits

1. **Task 1: Markers compose in resolve from each command's marker policy** - `1f76e042` (feat)
2. **Task 2: The per-verb marker table is stated as data in an owner test (SC-5)** - `e3044f28` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` - `MarkerPolicy`, `CENTRAL_MARKER_POLICY`, marker composition in `resolveRows`
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - `CommandContext.markers`; `RenderFn` over resolved rows; `context.markers` passed to the emitters
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` - emitters take the policy; `notify()` and the reconcile-applied arm use `CENTRAL_MARKER_POLICY`
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - helpers take resolved rows and stop reading `dependencies`
- `extensions/pi-claude-marketplace/orchestrators/**/*.messaging.ts` - `markers` on all 18 contexts; stale comments about dependency threading restated
- `tests/architecture/soft-dep-marker-policy.test.ts` - SC-5 table (new)
- `tests/shared/notification-resolve.test.ts` - the derivation cases (policy x dependency x snapshot, order, duplicates, no dependencies, unnamed status)
- `tests/orchestrators/**/*.messaging.test.ts`, `tests/shared/notification-grammar.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts` - literal resolved rows
- `tests/shared/notify-context.test.ts`, `tests/shared/notification-dispatch.test.ts`, `tests/shared/notification-summary.test.ts`, `tests/orchestrators/plugin/shared.test.ts` - `markers` on test contexts and emitter calls
- `scripts/check-unused-type-members.contracts.json` - pins moved with their lines

## Decisions Made

- The policy types use `Record` spellings. `@typescript-eslint/consistent-indexed-object-style` rejects the mapped-type form the plan gave, and the meaning is the same.
- `resolveRow` stays an if-chain that ends in `return { ...row, reasons }`. An exhaustive `switch` would return `undefined` for an out-of-band status, and the frozen unknown-status case in the resolve tests pins that such a row still resolves and reaches the missing-arm diagnostic.
- Each emitter reads `softDepStatus(pi)` before `resolveRows` and reuses that one snapshot for the renderers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Policy types spelled with `Record`**
- **Found during:** Task 1
- **Issue:** `{ readonly [K in ...]?: boolean }` and `{ readonly [K in Status]: boolean }` fail `@typescript-eslint/consistent-indexed-object-style`.
- **Fix:** `MarkerPolicy = Partial<Readonly<Record<PluginNotificationMessage["status"], boolean>>>`; `markers: Readonly<Record<Status, boolean>>`.
- **Files modified:** `notification-resolve.ts`, `notify-context.ts`
- **Committed in:** `1f76e042`

**2. [Rule 1 - Bug] Out-of-band rows keep resolving**
- **Found during:** Task 1
- **Issue:** A first `switch` version returned `undefined` for a status no case names, and its unused destructured bindings failed `sonarjs/no-unused-vars`.
- **Fix:** An if-chain whose branches hand the destructured `reasons` and `dependencies` to a `ReasonComposer`, with a final fallback return.
- **Files modified:** `notification-resolve.ts`
- **Verification:** "keeps a frozen row's severity and adds no name to its resolved copy" passes; direct coverage 79/79 branches.
- **Committed in:** `1f76e042`

**3. [Rule 3 - Blocking] `renderMpHeader` takes a `ResolvedMarketplace`**
- **Found during:** Task 1
- **Issue:** With `reasons` required on resolved rows, a `ResolvedMarketplace` no longer assigns to `MarketplaceNotificationMessage`.
- **Fix:** Widened the parameter; both production callers already pass resolved marketplaces.
- **Files modified:** `notification-grammar.ts`
- **Committed in:** `1f76e042`

**4. [Rule 3 - Blocking] Tests outside the plan's file list**
- **Found during:** Task 1
- **Issue:** `tests/orchestrators/plugin/shared.test.ts` builds `CommandContext` literals; `tests/orchestrators/marketplace/{add,list}.messaging.test.ts` pin the context keys; `tests/shared/notification-dispatch.test.ts` and `notification-summary.test.ts` call the emitters directly.
- **Fix:** Added `markers` tables, the `markers` key, and the new emitter argument.
- **Committed in:** `1f76e042`

**5. [Rule 2 - Missing coverage] The policy reaches `resolveRows`**
- **Found during:** Task 1
- **Issue:** Once arms stop deriving markers, no unit case proved that the notify entry points and emitters forward `context.markers`; only the corpus would notice.
- **Fix:** A data-driven case per notify-context entry point, and one emitter case in the dispatch tests.
- **Files modified:** `tests/shared/notify-context.test.ts`, `tests/shared/notification-dispatch.test.ts`
- **Committed in:** `1f76e042`

**6. [Plan wording] One arm test removed**
- **Found during:** Task 1
- **Issue:** "omits loaded dependency markers from an installed row" in `tests/orchestrators/import/execute.messaging.test.ts` tested derivation. As a resolved row it duplicates "renders an installed row with optional fields omitted".
- **Fix:** Removed; the loaded-snapshot rows in `notification-resolve.test.ts` own that fact.
- **Committed in:** `1f76e042`

**7. [Rule 1 - Stale prose] Comments that described dependency threading**
- **Found during:** Task 1
- **Issue:** Doc comments in eight messaging files and the grammar said arms read `dependencies` or inject markers at render time.
- **Fix:** Restated each claim as it now holds (resolve composes under the policy).
- **Committed in:** `1f76e042`

**8. [Rule 3 - Blocking] `renderPendingRow` contract repinned by column as well as line**
- **Found during:** Task 1
- **Issue:** Wrapping the `Extract<...>` in `ResolvedRow<...>` moved the pinned tokens right, so a line-only shift could not match.
- **Fix:** `id` `notification-grammar.ts:823:9`, `filter` `821:5`. The other pins moved by line only.
- **Committed in:** `1f76e042`

---

**Total deviations:** 8 (1 bug, 5 blocking or coverage fixes, 1 stale-prose fix, 1 plan-wording adjustment).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- As in 01-02 and 01-03, the first corpus check failed until the contract pins were repinned (`unused-type-member-gate.test.ts` read an empty report).
- `fallow audit` returns `warn` with one introduced clone group, `dup:c77b3abb6f87acd9-r4`: the tail of the render map plus the context const in `enable-disable.messaging.ts` and `fetch.messaging.ts`. `npm run fallow` passes. The other introduced groups are the corpus scripts from 01-01.

## Verification

- `node scripts/notify-corpus.mjs check`: `Notify corpus check passed: 2622 baseline entries present, 5 extra.` The five extras are the new D-12 cases. It passed after Task 1 and again as the tracer re-run.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty (exit 0).
- `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/soft-dep-marker-policy.test.ts`: 23/23.
- Direct coverage passed for all 19 changed production files, including notification-resolve.ts (79/79 branches), notify-context.ts (19/19), notification-grammar.ts (181/181), and notification-dispatch.ts (44/44).
- `rg -c "markers:" ... -g '*.messaging.ts'` totals 18; the grammar reads no row `dependencies`; `softDepMarkers(` is called in notification-resolve.ts.
- SC-5 spot check: setting `FETCH_CONTEXT.markers.remote` to `true` turned exactly the FETCH_CONTEXT row red (18 pass, 1 fail); reverted.
- `npm run check`, run unpiped and logged: `CHECK_EXIT=0`. Unit suite 7350/7350, integration 36/36, type-member gate and its 7 negative controls passed.

## Note for the Phase 7 docs work

`docs/output-catalog.md` prose says `composeReasons` appends the soft-dependency markers. They are now composed in `resolveRows`. The catalog is byte-locked this milestone, so it was not edited.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Every render arm receives final reasons, so the next plan can drop the probe parameter from `RenderFn` and the arms (D-13). `composeReasons` still takes declares-flags because marketplace headers and info rows call it with three `false` flags.

## Self-Check: PASSED

- `tests/architecture/soft-dep-marker-policy.test.ts` and this SUMMARY exist.
- Commits `1f76e042` and `e3044f28` exist on `features/json`.

---
*Phase: 01-presentation-model*
*Completed: 2026-09-29*

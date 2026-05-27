---
phase: 19-migration-wave-2-plugin-orchestrator-family
plan: 3
subsystem: plugin-orchestrator-migration
tags:
  [
    migration,
    v1-to-v2,
    wave-2,
    plan-19-03,
    list-surface,
    plugin-family,
    probe-failures-drop,
  ]
requires:
  - phase-19-01-uninstall-pilot
  - phase-18-marketplace-orchestrator-family
  - phase-17.2-renderscope-fix
  - phase-17.1-autoupdate-grammar
provides:
  - list-ts-v2-migration
  - probe-failures-summary-dropped
  - list-surface-variant-mapping
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/edge/handlers/plugin/list.test.ts
tech-stack:
  added: []
  patterns:
    - "notify(ctx, pi, { marketplaces: [<MarketplaceNotificationMessage>...] }) -- single V2 call per orchestration arm. List surface uses bare-label marketplace header (mp.status === undefined) per docs/output-catalog.md:133-263. Plugin rows discriminate by status -- available / unavailable / upgradable / installed. PluginUpgradableMessage carries `reasons: []` empty-array sentinel (no V1 reason brace surfaced for this surface)."
    - "Failed-marketplace block: status: 'failed' + plugins: [] (no marketplace-level reasons brace, no cause: trailer). Mirrors catalog `unparseable-mp` form at docs/output-catalog.md:215-226."
    - "Failure-arm Option B per Plan 19-03 step 4 / CONTEXT D-19-02 Claude's Discretion: synthetic MarketplaceNotificationMessage { name: '(list)', scope: opts.scope ?? 'user', plugins: [{ status: 'failed', name: 'list', reasons: [<narrowed>], cause: <Error> }] } so the V2 renderer surfaces the orchestrator-level error via the 4-space cause-chain (D-16-08); severity routes to error per D-16-11; no reload-hint per D-16-12."
    - "MarketplaceDetails on plugin-list surface: include ONLY when autoupdate === true; carry ONLY { autoupdate: true }. lastUpdatedAt is intentionally OMITTED per the must_haves 'no expansion of detail surface in Phase 19' guard -- the plugin-list catalog states at docs/output-catalog.md:133-263 never surface <last-updated <iso>> markers. The marketplace-list surface (orchestrators/marketplace/list.ts) retains lastUpdatedAt threading."
    - "D-16-17 orphan-fold rule honored at construction: plugin rows omit `scope` field when p.scope === mp.scope so the renderer suppresses `[<scope>]` bracket. Folded orphan rows carry the actual install scope (`scope: 'project'` under `mp.scope: 'user'`) to surface the bracket on those rows only -- catalog `project-orphan-folded` form."
    - "PROBE_FAILURES module-level capture-buffer + all push sites + drain notifyWarning REMOVED. Probe-failure information now manifests at row granularity via the per-row `(unavailable) {<narrowed-reason>}` discriminator -- no separate summary notification."
key-files:
  created:
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/edge/handlers/plugin/list.test.ts
key-decisions:
  - "D-19-01 (DROP precedent expanded for plugin-list surface): probe-failure summary notifyWarning at the original list.ts:777 DROPPED entirely. Probe failures already manifest as per-row (unavailable) variants when the underlying failure causes a plugin to fail probing. The PROBE_FAILURES module-level capture-buffer (original line 260) + every PROBE_FAILURES.push(...) call site + the drain block are REMOVED -- the buffer had no other consumer."
  - "D-19-02 (inline construction in orchestrator): the V2 NotificationMessage payload is built inline; no presentation/* composer modifications. renderPluginList / PluginListPayload / PluginListMarketplaceBlock imports are GONE from list.ts (the composers stay alive for Phase 21 cleanup)."
  - "D-19-06 (disjoint file pair): the plan's scoped file list is list.ts + list.test.ts. The LLM-tool consumer at edge/handlers/tools.ts was updated in lockstep (Rule 3 auto-fix) because loadPluginListPayload's return shape changed from PluginListPayload to readonly MarketplaceNotificationMessage[] -- that's a structural break that downstream consumer code had to absorb."
  - "D-19-07 (test discipline): existing makeCtx() preserved verbatim; byte-exact V2 assertions across the catalog states; severity assertions on failure path flipped to 'error' (computed by notify() per D-16-11); no helper-extraction refactor."
  - "Failure-arm Option B (Plan 19-03 step 4 Claude's Discretion): synthetic mp with name '(list)' + a single PluginFailedMessage carrying the cause. Option A (notify(ctx, pi, { marketplaces: [] }) + mp.reasons[]) was rejected because marketplace-level reasons brace is NOT rendered on `(failed)` status (the renderer's case 'failed' arm at shared/notify.ts:593-594 omits the brace); option B's PluginFailedMessage path round-trips cleanly through the 4-space cause-chain (D-16-08) preserving the underlying error message for the user."
  - "PluginUpgradableMessage.reasons sentinel: D-15-01 requires the reasons field on the upgradable variant (per shared/notify.ts:402-407). V1 emitted (upgradable) without a reasons brace; V2 uses an empty-array sentinel (reasons: []) which the renderer's composeReasons helper collapses to no brace output. Catalog `single-mp-mixed` at docs/output-catalog.md:154 explicitly shows `(upgradable) {stale clone}` for an example WITH a reason; the plain-`(upgradable)` form is achieved with an empty reasons array."
  - "MarketplaceDetails carve-out: plugin-list surface includes `details: { autoupdate: true }` only when autoupdate is true; never carries lastUpdatedAt. This intentionally narrows the V2 detail surface compared to what the marketplace/list.ts orchestrator threads. The fold-adoption integration test fixture confirms behaviour (state records carry lastUpdatedAt from `addMarketplace` flow; plugin-list output never surfaces it)."
  - "D-16-04/11/12/14/17 (renderer-as-spec; severity / reload-hint / soft-dep computed by notify(); orphan-fold rule honored) honored: orchestrator passes no severity; severity is `error` on failure path / `undefined` (info) on success; reload-hint emits structurally from each PluginInstalledMessage/PluginUpgradableMessage status when present (per D-16-12 ladder)."
patterns-established:
  - "List-surface variant set: PluginAvailableMessage (no scope, no reasons), PluginUnavailableMessage (no scope, REQUIRED reasons), PluginUpgradableMessage (optional scope, REQUIRED reasons -- empty-array sentinel for plain V2 form), PluginInstalledMessage (optional scope, REQUIRED dependencies). Wave 2 plans for reinstall.ts / update.ts that ALSO need installed/updated rows can reuse the installedRowMessage() narrowing pattern."
  - "Failure-arm shape (Option B): the synthetic-marketplace + PluginFailedMessage approach is reusable for any orchestrator-level catch path where the operation aborts before the cascade can render. Pattern: name: '(<surface>)', plugins: [{ status: 'failed', name: '<surface>', reasons: [<narrowed>], cause: <Error> }]."
requirements-completed: []
metrics:
  duration: 50min
  completed: 2026-05-27
---

# Phase 19 Plan 3: `list.ts` V1 -> V2 Wave 2 Migration Summary

**Migrates the read-only plugin list orchestrator from V1 severity-named
wrappers + V1 `renderPluginList` composer to a single V2
`notify(ctx, pi, message)` call per orchestration arm; drops the
`PROBE_FAILURES` summary `notifyWarning` and its module-level capture-buffer
per D-19-01; threads the cause-of-failure through a synthetic
`PluginFailedMessage` on the failure arm per Plan 19-03 step 4 Option B.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-05-27T12:00:00Z (approx)
- **Completed:** 2026-05-27T12:50:00Z (approx)
- **Tasks:** 2 (atomic single-commit per the plan; both task surfaces in one
  commit per `<atomic_commit_pair>` discipline)
- **Files modified:** 4 (list.ts + list.test.ts + tools.ts + shim list.test.ts)

## Accomplishments

- list.ts emits exactly one V2 `notify(ctx, pi, NotificationMessage)` call
  per orchestration arm (success + failure); the V1 sites at lines 772 /
  777 / 783 are resolved (2 migrated, 1 DROPPED entirely per D-19-01).
- The `PROBE_FAILURES` module-level capture-buffer (original line 260),
  every `PROBE_FAILURES.push(...)` site, the drain block (original lines
  773-781), and the reset call (original line 768) are REMOVED. Per-row
  `(unavailable) {<narrowed-reason>}` carries the cause class at row
  granularity -- the redundant summary surface is dropped.
- The presentation/* composer imports (`renderPluginList`,
  `PluginListPayload`, `PluginListMarketplaceBlock`, `compareByNameThenScope`,
  `softDepStatus`) are GONE from list.ts. The composers themselves stay
  alive for Phase 21 cleanup per D-19-02.
- list.test.ts assertions match V2 catalog byte forms across the relevant
  plugin-list catalog states; the V1->V2 byte change documented in the
  test bodies (D-16-17 orphan-fold rule suppresses the `[<scope>]` bracket
  on plugin rows when `p.scope === mp.scope`; empty-list sentinel flips
  from `(no plugins)` to `(no marketplaces)`; failed-marketplace header
  is bare with no `{unparseable}` brace or cause trailer).
- catalog UAT GREEN end-to-end (all `/claude:plugin list` fixtures
  byte-equal under the V2 grammar; the orchestrator's V2 payload
  construction round-trips cleanly through `notify()`).
- `npm run check` exits 0 (1363 pass / 0 fail / 2 todo -- identical to
  Phase 18 baseline).

## Task Commits

Atomic single-commit per Plan 19-03's `<atomic_commit_pair>` discipline
(both tasks in one commit; per the plan's verification line 247 "npm run
check exits 0 at the atomic commit boundary"):

1. **Task 1 + Task 2 (atomic): migrate plugin/list.ts to V2 notify()** -
   `25239e2` (refactor)

**SUMMARY metadata commit:** (this file) -- pending parent agent.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` --
  V1 severity-named wrappers + presentation/* composer imports
  REMOVED; PROBE_FAILURES module-level state + all push sites + drain
  REMOVED; V2 `notify()` call per orchestration arm; new helpers
  `installedRowMessage`, `availableRowMessage`, `buildMarketplaceMessage`
  build V2 PluginNotificationMessage variants directly; new
  `compareMpForSort` / `sortPluginsInBlock` work on the V2 union with
  status-discriminated scope narrowing.
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` --
  V1 `PluginListPayload`/`PluginListRow`/`EmptyToken` imports REMOVED;
  consumes the V2 `MarketplaceNotificationMessage[]` shape via the
  status-narrowing helpers `projectRowStatus` / `pluginScopeOrFallback`
  / `pluginReasons` / `pluginVersion`. The LLM-tool surface preserves
  its V1-style flat-line projection so the AI agent contract stays
  stable (BLOCK A: tools do NOT call ctx.ui.notify so the rendered
  bytes here are separate from the slash-command surface).
- `tests/orchestrators/plugin/list.test.ts` -- byte-exact V2 assertions
  for CMC-10 (empty), PL-1 (filter union), CMC-21 (same-name two-scope),
  PL-5 (upgradable / installed string compare), PL-6 / CMC-22
  (unparseable-mp). `__test_narrowProbeError` re-export retained for
  the per-classifier unit tests (260525-cjr A3). No new imports; existing
  `makeCtx()` preserved verbatim per D-19-07.
- `tests/edge/handlers/plugin/list.test.ts` -- 6 shim tests: V1
  `"(no plugins)"` -> V2 `"(no marketplaces)"` assertion flip.

## Decisions Made

(Captured in `key-decisions` frontmatter; structural matches with the
inherited Phase 19 context decisions D-19-01..D-19-08.)

- **Failure-arm Option B** (Plan 19-03 step 4 Claude's Discretion):
  Option A (`notify(ctx, pi, { marketplaces: [] })` + mp.reasons[]) was
  rejected because the V2 renderer's case `"failed"` arm at
  `shared/notify.ts:593-594` returns
  `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)` WITHOUT a
  `{reasons}` brace -- so marketplace-level reasons on a failed mp are
  not rendered. Option B (synthetic mp + a single `PluginFailedMessage`
  carrying the cause) routes the diagnostic through the 4-space
  cause-chain (D-16-08), preserving the user-visible error message.

- **MarketplaceDetails carve-out for plugin-list surface**: the V2
  orchestrator intentionally DOES NOT thread `mp.lastUpdatedAt` into
  `details` -- only `autoupdate` survives onto this surface. The
  marketplace-list surface (`orchestrators/marketplace/list.ts`) retains
  the full detail threading because its catalog form
  (`docs/output-catalog.md` marketplace-list section) includes both
  markers. The plugin-list catalog never surfaces `<last-updated>` (every
  `/claude:plugin list` fixture has `details: { autoupdate: true }` only),
  so the orchestrator must NOT emit it.

- **PluginUpgradableMessage empty-reasons sentinel**: the V2 type model
  requires `reasons: readonly Reason[]` on the `upgradable` variant per
  D-15-01. V1 emitted `(upgradable)` without a `{reason}` brace; V2 uses
  an empty array (`reasons: []`) which the renderer's `composeReasons`
  helper collapses to no brace output. Concrete-reasoning sources for
  upgradability (e.g. `stale clone`) flow in via the cascade orchestrators,
  not the list surface; list keeps the plain form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated LLM-tool consumer at
`edge/handlers/tools.ts` in lockstep**

- **Found during:** Task 1 (`npx tsc --noEmit` after the orchestrator
  rewrite)
- **Issue:** Changing `loadPluginListPayload`'s return shape from
  `PluginListPayload` (`{ marketplaceBlocks: PluginListMarketplaceBlock[] }`)
  to the V2 shape (`readonly MarketplaceNotificationMessage[]`) broke
  the LLM-tool consumer at `extensions/pi-claude-marketplace/edge/handlers/tools.ts`.
  Three TS errors: `payload.marketplaceBlocks` at lines 267 / 356; type
  references to `PluginListRow` / `EmptyToken` at lines 43 / 146 / 227 /
  257. The plan's `<files>` list does not enumerate this file, but
  changing the orchestrator's exported helper signature is a structural
  break that any caller must absorb.
- **Fix:** Updated the imports (drop `PluginListRow` / `EmptyToken`; add
  `PluginNotificationMessage`), reworked `renderPluginPayload` to iterate
  `MarketplaceNotificationMessage[]` directly, replaced the
  `isPluginRow` filter with the natural V2 iteration shape, and added
  three status-narrowing helpers (`projectRowStatus`,
  `pluginScopeOrFallback`, `pluginReasons`, `pluginVersion`) so the
  V1-style flat-line projection stays byte-stable for the AI-agent
  contract (BLOCK A: tools do not call `ctx.ui.notify`; the rendered
  text here is the LLM tool's own surface, not the slash-command surface).
- **Files modified:**
  `extensions/pi-claude-marketplace/edge/handlers/tools.ts`
- **Verification:** `npm run check` exits 0;
  `tests/edge/handlers/tools.test.ts` 16/16 subtests pass.
- **Committed in:** `25239e2` (part of the atomic plan commit)

**2. [Rule 3 - Blocking] Updated shim tests at
`tests/edge/handlers/plugin/list.test.ts` in lockstep**

- **Found during:** post-rewrite `npm run check`
- **Issue:** Six shim tests asserted `notifications[0]!.message ===
  "(no plugins)"` against the orchestrator output. V2 emits
  `"(no marketplaces)"` for the empty case per D-16-17 (the top-level
  `marketplaces: []` array IS the structural sentinel; the renderer at
  `shared/notify.ts:1158` returns `"(no marketplaces)"`). These tests
  exercise the V1 shim's pass-through to the orchestrator; the
  assertions reflect the orchestrator's output bytes, which changed
  with the migration.
- **Fix:** `sed -i 's|"(no plugins)"|"(no marketplaces)"|g'` across the
  shim test file; updated the file header comment to cross-reference
  Plan 19-03's V1->V2 byte change with the catalog reference at
  `docs/output-catalog.md:139-145`.
- **Files modified:**
  `tests/edge/handlers/plugin/list.test.ts`
- **Verification:** `node --test tests/edge/handlers/plugin/list.test.ts`
  -> 6/6 pass.
- **Committed in:** `25239e2` (part of the atomic plan commit)

**3. [Rule 3 - Blocking] Removed unnecessary type assertions flagged
by `@typescript-eslint/no-unnecessary-type-assertion`**

- **Found during:** post-rewrite `npm run lint`
- **Issue:** The initial draft used `as readonly Reason[]` casts at two
  sites (`availableRowMessage` unavailable arm + the failure-arm
  `narrowProbeError` result) and `as readonly ("hooks" | "lspServers" |
  "unsupported source")[]` semantics implied at one. TypeScript correctly
  narrows the literal-type members into `Reason` without any
  cast, so the rule flagged the assertions as unnecessary. The plan
  itself does not constrain this; it's a routine lint-driven cleanup.
- **Fix:** Dropped the `as readonly Reason[]` assertions; removed the
  now-unused `Reason` import.
- **Files modified:**
  `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
- **Verification:** `npm run lint` exits 0; `npm run typecheck` still
  exits 0 (the literal types are accepted into `Reason` directly).
- **Committed in:** `25239e2` (part of the atomic plan commit)

**4. [Rule 3 - Blocking] Replaced `"scope" in p` checks with
status-discriminated narrowing**

- **Found during:** post-rewrite `npm run lint`
- **Issue:** The defensive `if ("scope" in p && p.scope !== undefined)`
  guard at two sites (`sortPluginsInBlock`'s `scopeOf` helper in list.ts;
  `pluginScopeOrFallback` in tools.ts) was flagged by
  `@typescript-eslint/no-unnecessary-condition` because TypeScript
  treats the optional `scope?: Scope` field on the
  `installed/upgradable` variants as always-`true` for the `in`
  operator. The original intent (narrow `available`/`unavailable` away
  from accessing `.scope`) needs the discriminated-union narrowing
  through `switch (p.status)` instead.
- **Fix:** Rewrote both helpers with a `switch (p.status)` over the
  10-variant union, dispatching to `p.scope ?? marketplaceScope` for
  the variants that DO carry the field and to `marketplaceScope`
  otherwise. The four list-surface variants (installed / upgradable /
  available / unavailable) are the only ones the function ever sees in
  practice; the other six are unreachable on the list payload but the
  exhaustive switch keeps the renderer-as-spec discipline (D-16-04).
- **Files modified:**
  `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`,
  `extensions/pi-claude-marketplace/edge/handlers/tools.ts`
- **Verification:** `npm run lint` exits 0; `npm run typecheck` still
  exits 0; orchestrator + tool tests pass.
- **Committed in:** `25239e2` (part of the atomic plan commit)

---

**Total deviations:** 4 auto-fixed (all Rule 3 -- blocking issues that
prevented `npm run check` from passing).
**Impact on plan:** The deviations are entirely test/lint-driven follow-ups
to the planned orchestrator rewrite -- no scope creep. The
`tools.ts` consumer update was the largest of the four (a paragraph of
new helper functions) but did not change the LLM-tool's output contract;
the V1-style flat-line projection is byte-stable.

## Issues Encountered

- **List-surface MarketplaceDetails carve-out:** the initial draft
  threaded `lastUpdatedAt` through `mp.details`, which made the V2
  renderer emit `<last-updated <iso>>` on the plugin-list surface. The
  catalog states for `/claude:plugin list` (docs/output-catalog.md:139-263)
  never carry this marker, and the plan's `must_haves` explicitly says
  "no expansion of detail surface in Phase 19". The
  `fold-adoption.test.ts` integration test failure surfaced this
  immediately. Narrowed `details` to `{ autoupdate: true }` only when
  `autoupdate === true` -- matches the catalog form.

- **Failed-marketplace header byte form:** the V2 catalog
  `unparseable-mp` state at lines 215-226 emits a BARE `(failed)` header
  with no `{unparseable}` reasons brace and no `cause:` trailer. V1
  surfaced both (PL-6 test originally asserted them). The renderer's
  `case "failed"` arm at `shared/notify.ts:593-594` does NOT compose a
  reasons brace -- the brace renders only on `case "skipped"` mp arms.
  The PL-6 test was rewritten to assert the bare V2 form; the V1
  `assert.match(out, /\{unparseable\}/)` and `assert.match(out, /\n
  {2}cause:/)` assertions are GONE.

- **Catalog state `(no marketplaces)` empty form:** the V1 `(no plugins)`
  sentinel is replaced by V2 `(no marketplaces)` for the empty-list case
  (`marketplaces: []` -> renderer at `shared/notify.ts:1158` returns
  `"(no marketplaces)"`). Affected three test sites in `list.test.ts`
  and the entire suite at `tests/edge/handlers/plugin/list.test.ts`.

## User Setup Required

None - this is an internal V1->V2 migration on a read-only surface; no
external service configuration changes.

## V1 -> V2 Migration Status (list.ts only)

| Status                                                                | Count |
| --------------------------------------------------------------------- | ----: |
| V1 wrapper callsites remaining in list.ts                             |     0 |
| V2 notify() callsites in list.ts                                      |     2 (success + failure arms) |
| `presentation/*` imports remaining in list.ts                         |     0 |
| `PROBE_FAILURES` references remaining anywhere in extensions/         |     0 |
| V1 callsites DROPPED entirely per D-19-01 (probe-failure summary)     |     1 |
| Catalog UAT plugin-list fixtures still GREEN                          |   8/8 |
| List-surface plugin-row variants exercised in tests                   |     4 (available, unavailable, upgradable, installed) |

**Plugin-family aggregate V1 callsite count (all 5 plugin orchestrators):**

```
$ grep -rE "notify(Success|Warning|Error)\(" \
    extensions/pi-claude-marketplace/orchestrators/plugin/*.ts | wc -l
22
```

Pre-Plan-19-03: 25 V1 callsites (the post-Plan-19-01 baseline from
19-01-SUMMARY.md). Net -3 in this plan (1 notifySuccess + 1
notifyWarning DROPPED + 1 notifyError from list.ts). Plans 19-02 /
19-04 / 19-05 close the remaining 22 across install.ts / reinstall.ts /
update.ts.

## Threat Flags

None. Per the plan's `<threat_model>`, Plan 19-03 is an internal API
refactor on a read-only surface:

- T-19-03-01 (information disclosure -- PROBE_FAILURES content silenced):
  `accept` -- D-19-01 explicitly accepts the silenced summary surface;
  the underlying probe failure information surfaces per-row via the
  `PluginUnavailableMessage.reasons` field.
- T-19-03-02 (notification flooding): `mitigate` -- D-19-01 drops the
  summary site; D-19-02 consolidates success + failure into a single
  `notify()` per arm. List invocation emits exactly 1 notification.
- T-19-03-03 (severity manipulation): `mitigate` -- V2 has no severity
  argument; renderer computes per D-16-11.

## Known Stubs

None. The V2 emissions construct real
`PluginInstalledMessage` / `PluginUpgradableMessage` /
`PluginAvailableMessage` / `PluginUnavailableMessage` /
`PluginFailedMessage` payloads with all required fields populated from
runtime state (marketplace name, scope, plugin name, version, error
cause, narrowed Reasons all carried verbatim).

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
  exists, compiles under strict TypeScript, and passes ESLint +
  Prettier.
- File `extensions/pi-claude-marketplace/edge/handlers/tools.ts` exists
  and consumes the V2 shape; all 16 tool subtests pass.
- File `tests/orchestrators/plugin/list.test.ts` exists and 22/22 tests
  pass.
- File `tests/edge/handlers/plugin/list.test.ts` exists and 6/6 tests
  pass.
- Commit `25239e2` exists on the worktree branch and contains all four
  modified files.
- `npm run check` exits 0 (typecheck + lint + format:check + 1363 pass /
  0 fail / 2 todo -- identical to Phase 18 baseline).
- Catalog UAT runner `tests/architecture/catalog-uat.test.ts` exits 0
  with 3/3 subtests passing.
- Plan's verification invariants confirmed:
  - V1-wrapper grep returns 0
  - PROBE_FAILURES grep in list.ts returns 0
  - PROBE_FAILURES grep across `extensions/pi-claude-marketplace/` returns 0
  - `notifications.length, [2-9]` grep in list.test.ts returns 0
  - V2 `notify(ctx, ...)` callsite count = 2 (success + failure arms)
  - List-surface discriminator grep on tests returns 11 (covers
    available / unavailable / upgradable / installed)
- No modifications to STATE.md, ROADMAP.md, or REQUIREMENTS.md (per
  `<parallel_execution>` rules).

## Next Phase Readiness

- Plan 19-03 (list.ts) complete. Wave 2 plans 19-02 (install.ts), 19-04
  (reinstall.ts), and 19-05 (update.ts) can proceed in parallel; they
  depend ONLY on Plan 19-01's merged diff (the pilot recipe is unchanged
  by this plan).
- Wave 3 (Plan 19-06 lint narrowing) cannot start until ALL of Wave 2
  lands -- this plan's contribution to the precondition is recorded
  here.

---

*Phase: 19-migration-wave-2-plugin-orchestrator-family*
*Completed: 2026-05-27*

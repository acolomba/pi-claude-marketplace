---
phase: 05-plugin-orchestrators
plan: 09
subsystem: orchestrator
tags:
  [
    phase-05,
    orchestrator,
    update,
    hand-rolled,
    withStateGuard,
    PUP-9,
    WR-04,
    security,
  ]

# Dependency graph
requires:
  - phase: 05-01
    provides: "PluginUpdatePhase3Error + Phase3Failure + RECOVERY_PLUGIN_REINSTALL_PREFIX"
  - phase: 05-02
    provides: "formatErrorWithCauses + cascade-orchestrator no-throw discipline"
  - phase: 05-03
    provides: "componentPaths.* array shape (COMP-01) + bridge discover/prepare/commit primitives"
  - phase: 05-04
    provides: "assertNoCrossPluginConflicts + CrossPluginGeneratedNames shape"
  - phase: 05-06
    provides: "withStateGuard composition pattern + installPlugin precedents"
provides:
  - "updateSinglePlugin: PluginUpdateFn -- cascade-safe never-throws PluginUpdateFn impl"
  - "updatePlugins(opts) -- PUP-1 three-form direct entrypoint with syncCloneOnce memoization"
  - "Hand-rolled 3-phase swap (D-03; NOT runPhases): prepare -> state-guard swap -> physical-replace aggregate"
  - "PUP-6 phase-3a aggregate via PluginUpdatePhase3Error + RECOVERY_PLUGIN_REINSTALL_PREFIX recovery hint"
  - "WR-04 stagedAgents/stagedMcpServers fields populated on success for Phase 4 cascade-side RH-5 composition"
  - "orchestrators/plugin/index.ts barrel + orchestrators/index.ts top-level barrel ready for Phase 6 edge router"
affects: [05-10, 06, 07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HAND-ROLLED 3-phase swap (D-03) -- NOT runPhases; chosen for heterogeneous-undo flow per Phase 4 D-02 precedent"
    - "Paired entrypoints (cascade-safe + direct) sharing a single 3-phase implementation parameterized by `cascade: boolean`"
    - "PUP-9 routing flag: cascade path catches throws into partition='failed'; direct path surfaces phase-2-or-earlier throws via notifyError"
    - "syncCloneOnce memoization per (scope, marketplace) pair using a Set<string> key"
    - "removePluginRecord shallow-clone helper for PI-6 cross-plugin guard re-check on update (excludes self from conflict scan)"
    - "Phase-3a aggregate-with-continue: each bridge commit runs in its own try/catch; failures land in Phase3Failure[]; DO NOT fail-fast (D-03)"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/index.ts
    - tests/orchestrators/plugin/update.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/index.ts

key-decisions:
  - "D-03 hand-rolled discipline preserved -- the 3-phase swap is NOT composed via runPhases (heterogeneous-undo flow does not fit the ledger contract)"
  - "PUP-9 routing is encoded as a single boolean (`cascade`) on the internal ThreePhaseArgs, plus an optional `ctx` for the direct-path phase-3a aggregate notifyError fire. The cascade path passes ctx=undefined; the direct path passes the real ctx"
  - "refreshGitHubClone inlined into update.ts (mirrors Phase 4 marketplace/update.ts) since Phase 4 did not export the helper -- D-11 import boundary forbids importing the per-subcommand files directly"
  - "updateSinglePlugin defaults cwd to process.cwd() because the PluginUpdateFn signature carries only (plugin, marketplace, scope). Phase 7 wiring may add a dependency-injection seam if needed"
  - "Phase-2 stale-version check (ST-9) re-reads the plugin record inside the withStateGuard closure and throws if record.version !== fromVersion. The guard does NOT save on throw (ST-7); prep handles are aborted by the outer catch"
  - "Direct-path syncClone failure aborts the WHOLE batch (returns early after notifyError) because subsequent plugins in the same marketplace would read a stale or partially-refreshed manifest"

patterns-established:
  - "Pattern: paired cascade-safe + direct entrypoints sharing a single private implementation -- the cascade-safe variant catches all throws; the direct variant lets them propagate to its own outer catch"
  - "Pattern: 3-phase swap as a hand-rolled sequence of try/catch blocks (Phase 1 prepare with reverse-order abort + appendLeaks; Phase 2 withStateGuard with abort-on-throw; Phase 3a aggregate-with-continue across the four bridge commits)"
  - "Pattern: PUP-7 abort sequencing must guard each handle individually (each abort signature differs -- abortPreparedMcp is sync void, abortPreparedAgents returns a leak descriptor, the other two are async void)"
  - "Pattern: PI-6 cross-plugin guard on update excludes THIS plugin's currently-recorded resources via a shallow-clone helper (removePluginRecord) so updating own name {a,b} -> {a,c} does not self-conflict on 'a'"

requirements-completed:
  - PUP-1
  - PUP-2
  - PUP-3
  - PUP-4
  - PUP-5
  - PUP-6
  - PUP-7
  - PUP-8
  - PUP-9
  - AS-3
  - AS-7
  - NFR-2
  - NFR-3

# Metrics
duration: ~21 min
completed: 2026-05-11
---

# Phase 05 Plan 09: Plugin Update Orchestrator Summary

**`updateSinglePlugin: PluginUpdateFn` (cascade-safe; never throws) + `updatePlugins(opts)` (direct entrypoint for PUP-1 three forms) ship the hand-rolled 3-phase swap (D-03) -- Phase 1 sequential bridge prepare into tmp; Phase 2 `withStateGuard` with ST-9 stale-version check + resource swap; Phase 3a physical replace aggregating failures across skills/commands/agents/mcp without fail-fast; Phase 3b composes a `PluginUpdatePhase3Error` carrying the `RECOVERY_PLUGIN_REINSTALL_PREFIX` recovery hint or returns a success outcome with WR-04 `stagedAgents`/`stagedMcpServers`. PUP-9 routing via a `cascade: boolean` flag: cascade path captures all throws into `partition='failed'`; direct path surfaces phase-2-or-earlier throws via `notifyError`. The two new barrels (`orchestrators/plugin/index.ts` + `orchestrators/index.ts` extension) make Phase 6's edge router import-clean.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-05-11T03:47:00Z (approximate)
- **Completed:** 2026-05-11T04:08:30Z (approximate)
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 extended)

## Accomplishments

- **Paired entrypoints (D-09 corollary).** `updateSinglePlugin: PluginUpdateFn` lands the cascade-safe impl reserved by Phase 4 D-05; Phase 4's marketplace autoupdate cascade now has an implementation to wire in Phase 7. `updatePlugins(opts)` provides the direct entrypoint for the three PUP-1 forms (`{kind:"all"}`, `{kind:"marketplace", marketplace}`, `{kind:"plugin", plugin, marketplace}`).
- **HAND-ROLLED 3-phase swap (D-03).** The implementation is a sequence of try/catch blocks -- NOT a `runPhases<C>` ledger. This matches the Phase 4 D-02 precedent for heterogeneous-undo flow: Phase 3a aggregates failures across the four bridge commits and CONTINUES across failures (not fail-fast) so the partial-replace state is fully observed.
- **PUP-9 routing.** A single `cascade: boolean` flag (with optional `ctx` for direct-path notification) on the internal `ThreePhaseArgs` interface drives the dual-mode behavior. `updateSinglePlugin` catches all throws into `partition='failed'` outcomes; `updatePlugins` lets phase-2-or-earlier throws bubble to its outer catch where `notifyError` fires. The phase-3a aggregate-error path emits `notifyError` only on the direct path (cascade leaves notification to the marketplace orchestrator).
- **PUP-2 syncCloneOnce memoization.** Per (scope, marketplace) pair, using a Set<string> key. Path-source marketplaces are noops (NFR-5: no network); github-source marketplaces refresh via the D-14 sequence (`fetch + forceUpdateRef + checkout`). Test asserts two plugins in the SAME marketplace trigger exactly one fetch/forceUpdateRef/checkout.
- **PI-6 cross-plugin guard on update.** Re-runs against state with THIS plugin's record excluded via the `removePluginRecord` helper, so updating own resource names {a,b} -> {a,c} does not self-conflict on 'a'.
- **WR-04 fields populated on success.** `stagedAgents` and `stagedMcpServers` on the `PluginUpdateOutcome` -- consumed by Phase 4's marketplace `update.ts` cascade-side composition for RH-5 soft-dep warnings.
- **Barrels for Phase 6.** `orchestrators/plugin/index.ts` mirrors the Phase 4 marketplace barrel; `orchestrators/index.ts` extends from `export {}` placeholder to explicit named re-exports from both per-subcommand barrels (prefix-distinct names = no collisions).
- **Test coverage.** 15 PUP-* tests in `tests/orchestrators/plugin/update.test.ts` cover PUP-1..9 + WR-04 + NFR-5 against on-disk path-source fixtures + a github-source fixture for the syncCloneOnce memoization assertion (`makeMockGitOps`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build `orchestrators/plugin/update.ts` with paired entrypoints + hand-rolled 3-phase swap** -- `bbb0224` (feat)
2. **Task 2: Create `orchestrators/plugin/index.ts` barrel + extend `orchestrators/index.ts`** -- `c55d93e` (feat)
3. **Task 3: Create `tests/orchestrators/plugin/update.test.ts` covering PUP-1..9** -- `d5c86e9` (test)

## Files Created/Modified

- **Created:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (955 lines) -- `updateSinglePlugin: PluginUpdateFn`, `updatePlugins(opts)`, internal `runThreePhaseUpdate`, `enumerateTargets`, `refreshGitHubClone` (inlined from Phase 4), `loadCachedMarketplaceManifest`, `resolveUpdateVersion`, `pickAgentsSourceDir`, `removePluginRecord`, `renderPartitionAndNotify`, `renderPartition`.
- **Created:** `extensions/pi-claude-marketplace/orchestrators/plugin/index.ts` (23 lines) -- per-subcommand barrel mirroring `orchestrators/marketplace/index.ts`. Exports `installPlugin`, `uninstallPlugin`, `updatePlugins`, `updateSinglePlugin`, `listPlugins`, `assertNoCrossPluginConflicts` and their option/type shapes.
- **Modified:** `extensions/pi-claude-marketplace/orchestrators/index.ts` (8 lines -> 59 lines) -- replaced `export {}` placeholder with explicit named re-exports from both per-subcommand barrels plus the cross-orchestrator type contracts (`PluginUpdateFn`, `PluginUpdateOutcome`, `PluginUpdatePartition`).
- **Created:** `tests/orchestrators/plugin/update.test.ts` (813 lines after prettier) -- 15 tests covering PUP-1..9 + WR-04 + NFR-5. `seedPathMarketplace` helper builds the marketplace tree + plugin source tree on disk and seeds `state.json`; `rewriteManifest` simulates a manifest mutation between calls.

## Decisions Made

- **`UpdatePluginsTarget` exposed as a public type.** The plan snippet inlined the target shape into `UpdatePluginsOptions.target`. The successor splits it out as `UpdatePluginsTarget` (exported) so Phase 6's edge layer can construct it explicitly + type-narrow callers.
- **Direct-path syncClone failure aborts the whole batch.** When `syncCloneOnce` throws inside `updatePlugins`, the function fires `notifyError` and returns early. Continuing past a syncClone failure would mean reading stale or partially-refreshed manifests for the remaining plugins in that marketplace -- a worse failure mode than telling the user to retry.
- **`updateSinglePlugin` defaults cwd to `process.cwd()`.** The `PluginUpdateFn` signature carries only `(plugin, marketplace, scope)`. Phase 7's wiring of the marketplace autoupdate cascade can inject a closure that captures the session cwd; the default is correct for the common case (user runs `/claude:marketplace update <mp>` from within their workspace).
- **`refreshGitHubClone` is inlined in `update.ts`.** Phase 4's `marketplace/update.ts::refreshGitHubClone` is a private function -- the D-11 import boundary forbids importing it directly from `orchestrators/marketplace/update.ts`. The inline copy mirrors the Phase 4 D-14 sequence (`fetch + forceUpdateRef + checkout`) verbatim. Future refactor: promote the helper to `orchestrators/marketplace/shared.ts` so both modules can share it.
- **Top-level orchestrators barrel uses named re-exports.** The alternative (`export *`) would work for this surface (no prefix collisions today), but explicit named exports follow the Phase 4 `marketplace/index.ts` precedent and make every cross-orchestrator dependency line-grep-able.
- **PUP-6 phase-3 test uses a file-vs-dir filesystem collision to force a deterministic failure.** Pre-creating a regular file at the skills bridge's per-skill target path (`<skillsTargetDir>/<generatedName>`) reliably triggers `EEXIST`/`ENOTDIR` at the bridge's `rename(staging, target)` call -- the simplest defensive injection point that does not depend on platform-specific permission semantics.

## Deviations from Plan

- **`UpdatePluginsTarget` exported as a top-level type instead of being inlined.** The plan snippet inlined the discriminated union into `UpdatePluginsOptions.target`; splitting it out makes the Phase 6 edge layer's parse step cleaner and re-uses the existing TypeScript narrowing pattern (mirrors how `ParsedSource` is exported separately from the marketplace state record). No functional impact.
- **`removePluginRecord` shallow-clone helper added.** The plan snippet mentioned the concept ("build a virtual state with this plugin's record removed") but did not specify a helper name. The successor extracted it for testability and to keep the 3-phase function readable. Shallow-clone discipline keeps it cheap on hot paths.
- **Direct-path catch surfaces ALL syncClone + phase-2 throws via `notifyError`, not just the first one.** The plan snippet showed a `return;` after `notifyError`; the successor preserves that semantic but additionally documents that the batch is intentionally aborted on the first failure (so the user sees a single coherent error rather than a partial-batch state).

**Total deviations:** 3 documented. No auto-fixed bug deviations. No architectural Rule 4 changes.
**Impact on plan:** No scope creep. Each deviation is a refinement of the snippet's intent.

## Issues Encountered

- **Prettier reformatted the test file after first commit.** The pre-commit `format:check` ran `prettier --check` which flagged the test file; I ran `prettier --write` and re-staged. The reformat was purely whitespace (wrapping a function signature across multiple lines).
- **Gitlint title length.** First commit attempt used a 75-char title (above the 72-char gitlint cap). Shortened to `feat(05-09): plugin update with hand-rolled 3-phase swap` and re-attempted.
- **TruffleHog skipped in worktree mode.** Per the parallel-executor protocol, TruffleHog is skipped via `SKIP=trufflehog`; this is the documented worktree opt-out.

## Next Phase Readiness

- All three Phase 5 mutating orchestrators (install + uninstall + update) now ship. The `PluginUpdateFn` reserved by Phase 4 D-05 has its concrete implementation; Phase 7's wiring will pass `updateSinglePlugin` as the `pluginUpdate` option to `updateMarketplace`/`updateAllMarketplaces` so the marketplace autoupdate cascade can drive per-plugin updates.
- The barrels (`orchestrators/plugin/index.ts` + `orchestrators/index.ts` extension) make Phase 6's edge router import-clean -- the router can `import { installPlugin, uninstallPlugin, updatePlugins, listPlugins, addMarketplace, ... } from "../orchestrators/index.ts"` without reaching into per-subcommand files.
- The hand-rolled 3-phase pattern is now established for Phase 5's update path. It coexists with the 5-phase ledger pattern from install (`runPhases`) because the two orchestrators have different undo semantics: install requires reverse-order undo for the staged resources (ledger fits); update requires aggregate-with-continue across bridge commits (hand-rolled fits).
- The `removePluginRecord` helper + PI-6 cross-plugin guard re-check pattern on update is reusable by any future orchestrator that wants to validate name conflicts against a per-plugin-excluded state snapshot.
- Phase 5 Plan 10 (final docs + cross-cutting) and Phase 6 (edge router) can now consume the complete plugin orchestrator surface.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/index.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/index.ts`: FOUND (modified)
- `tests/orchestrators/plugin/update.test.ts`: FOUND
- Commit `bbb0224`: FOUND
- Commit `c55d93e`: FOUND
- Commit `d5c86e9`: FOUND
- `npm run check` green (626/626 tests pass; typecheck, eslint, prettier all clean)
- All 15 PUP-* tests in the new test file PASS
- `tests/architecture/no-orchestrator-network.test.ts` continues to pass; the new `update.ts` is implicitly clean by construction (no platform-git import; gitOps reached only via the `orchestrators/marketplace/shared.ts` injection seam, which is the same surface Phase 4 used)

---

*Phase: 05-plugin-orchestrators*
*Completed: 2026-05-11*

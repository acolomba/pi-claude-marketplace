---
phase: 61-if-field-permission-rule-matcher
plan: 02
subsystem: hooks
tags: [if-field, parse-time-compile, routing-entry, match-03, d-61-02, d-61-03, d-61-04, hook-03, nfr-7]

# Dependency graph
requires:
  - phase: 61-if-field-permission-rule-matcher
    plan: 01
    provides: glob.ts / bash.ts / IfPredicate union + MATCH_ALL_IF sentinel + IF_PREFIX_TARGETS table + architecture-test scaffold
  - phase: 60-hook-execution-payload-translators-env-vars
    provides: hookDebugLog seam, errorMessage helper
  - phase: 58-matcher-parser-tool-name-mapping-supportability-gate
    provides: parseHooksConfig discriminated-result precedent, TOOL_EVENTS closed set
provides:
  - `HOOK_HANDLER_SCHEMA` admits optional `if: { type: "string" }` while preserving `required: ["type"]` (HOOK-03 forward-compat)
  - `compileIfPredicate(rawIf, claudeEvent, ctx)` pure-and-total parse-time entry in `bridges/hooks/if-field/index.ts`
  - `parseHooksConfig<P>(raw, ctx, compileIf)` generic widening — side-Map of compiled predicates rides on the success arm
  - `RoutingEntry.ifPredicate: IfPredicate` always-present-with-sentinel field
  - `flattenPluginIntoBuckets` populates ifPredicate from the parser side-Map; misses fall back to MATCH_ALL_IF
affects:
  - 61-03 dispatch-time consult: `ifFires(entry.ifPredicate, event, ctx)` consult is now a single-line insertion in `reduceBucket`

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generic-parameter callback injection (`CompileIfCallback<P>`) preserves D-11 import direction: the domain parser never type-depends on the bridge `IfPredicate` union"
    - "Always-present-with-sentinel routing field: dispatch switch is total without an `undefined` arm; `assertNever` continues to enforce NFR-7 exhaustiveness"
    - "Parse-time side-Map keyed on `${claudeEvent}|${groupIndex}|${handlerIndex}` — registration-time-translation stance from Phase 58 preserved; flatten reads the map and never recompiles"
    - "Fail-open compile boundary: every `compileIfPredicate` failure path collapses to MATCH_ALL_IF and emits a `hookDebugLog`; the function NEVER throws past its return type (T-61-06 mitigation)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/architecture/hooks-if-field.test.ts
    - tests/architecture/hooks-dispatch.test.ts
    - tests/architecture/hooks-exec.test.ts
    - tests/architecture/hooks-reducer.test.ts
    - tests/bridges/hooks/dispatch-exec.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/domain/components/hooks.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "Callback injection over upward import: domain MUST NOT import bridges (D-11 layering). The plan's original instruction to put `compileIfPredicate` in `domain/components/hooks.ts` and have it import the glob/bash primitives from `bridges/hooks/if-field/` would have violated the lint rule. Instead, `parseHooksConfig<P>` consumes a generic `CompileIfCallback<P>` and the bridge wires `compileIfPredicate` (which lives in `bridges/hooks/if-field/index.ts` alongside the glob engine) at the call site. The resolver supplies a no-op `(): null => null` callback because its outcome is the discriminated installable arm only — the side-Map is unreachable from the resolver."
  - "Generic parameter `P` over fixed `unknown`: the initial draft used `IfPredicateOpaque = unknown` which broke downstream `.kind` introspection (no-unsafe-member-access). Widening to `parseHooksConfig<P>` lets the bridge layer's concrete `IfPredicate` discriminated union flow out via the inferred return type without the domain parser importing the union."
  - "A1 projectRoot fallback wired uniformly: every production call site (resolver / hydrate / install / reinstall / update) constructs the `CompileIfPredicateContext` as `{ homedir: os.homedir(), cwd, projectRoot: cwd }`. The interface keeps `projectRoot` distinct so a future Pi version exposing it can wire it without renaming."
  - "ctx threading through `hydrateScopeFromState`: the event-router's project-scope hydrate path previously had no cwd in scope at `tryHydrateOnePlugin`; threaded it from `opts.cwd` down through `hydrateCacheFromDisk` -> `hydrateScopeFromState` -> `tryHydrateOnePlugin` so the path-glob anchor matches the project root the user is in."
  - "HOOK_HANDLER_SCHEMA stays at `required: [\"type\"]`: the architecture-test fixture `MATCH-03: handler without if field still passes HOOKS_VALIDATOR.Check` pins this regression — adding `if` to required would red-fail CI."

patterns-established:
  - "Callback-injection seam for layered architecture: when a downstream layer wants to participate in a domain function's algorithm but the domain layer cannot import upward, the domain function exposes a generic callback parameter. The downstream layer wires the real implementation; sibling layers (here: resolver) supply a no-op."
  - "Side-Map carries compile results across the parse/flatten seam: rather than mutating the parsed config in place, parse emits a separate `ReadonlyMap<string, P>` keyed on a deterministic tuple. Flatten reads the map by key and falls back to a sentinel on miss."

requirements-completed: []  # MATCH-03 amendment + closure lands in Plan 03

# Metrics
duration: ~95min
completed: 2026-06-15
---

# Phase 61 Plan 02: Parse-Time Compile + RoutingEntry Wire Summary

**parse-time `if`-field compile attached to every RoutingEntry via a side-Map; D-61-02 fail-open everywhere; dispatch consult (Plan 03) is now a single-line insertion against `entry.ifPredicate`.**

## Performance

- **Duration:** ~95 min (architectural rethink + generic-parameter rewire mid-execution)
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 2
- **Files modified:** 16 (7 source + 9 test)

## Accomplishments

- Extended `HOOK_HANDLER_SCHEMA` with the optional `if: { type: "string" }` property while preserving `additionalProperties: true` and `required: ["type"]` (HOOK-03 forward-compat invariant); architecture-test fixture pins the regression.
- Implemented `compileIfPredicate(rawIf, claudeEvent, ctx)` in `bridges/hooks/if-field/index.ts` as a pure-and-total function that handles all five compile paths (`Bash` / `Read` / `Edit` / `Write` / MCP literal / MCP server-prefix) with D-61-02 fail-open semantics on every failure mode (unknown prefix, malformed syntax, broken glob, empty input, non-tool event).
- Widened `parseHooksConfig` to a generic `parseHooksConfig<P>(raw, ctx, compileIf)` that consumes a caller-supplied `CompileIfCallback<P>` and emits a `CompiledIfPredicateMap<P>` side-Map keyed on `${claudeEvent}|${groupIndex}|${handlerIndex}`. The generic parameter preserves the D-11 import direction (domain MUST NOT import bridges) while letting the concrete `IfPredicate` discriminated union flow out typed correctly.
- Updated 22 call sites: 5 production sites (resolver / event-router hydrate / install / reinstall / update) thread the real `compileIfPredicate` callback; the resolver supplies a `(): null => null` no-op. All 17 test sites updated (some indirectly through factory functions).
- Extended `RoutingEntry` with `readonly ifPredicate: IfPredicate` always-present field. `flattenPluginIntoBuckets` reads the side-Map from `CacheEntry.ifPredicates` and falls back to `MATCH_ALL_IF` on miss (referential-equality sentinel — verified in architecture test).
- Threaded `ifPredicates` through `addPluginConfigToCache` so the hydrate / install / reinstall / update arms can persist the side-Map into the parsed-config cache.
- Plan 03 can now wire the `ifFires(entry.ifPredicate, event, ctx, claudeEvent)` consult inside `reduceBucket` as a single-line insertion — all expensive work (glob compile + Bash parser compile + MCP regex match) happens at registration time.

## Task Commits

Each task was committed atomically:

1. **Task 1: schema + compileIfPredicate + parseHooksConfig generic** — `3b1de5d` (feat)
2. **Task 2: RoutingEntry.ifPredicate + flatten populates from side-Map** — `560a57d` (feat)

## Files Created/Modified

### Source files (7 modified)

- `extensions/pi-claude-marketplace/domain/components/hooks.ts` — Schema extension (`if: { type: "string" }` added to `HOOK_HANDLER_SCHEMA.properties`; `HookHandlerEntry.if?: string` declared; `required` stays `["type"]`). New types: `CompileIfPredicateContext`, `CompileIfCallback<P>`, `CompiledIfPredicateMap<P>`. New helpers: `ifPredicateMapKey`, `buildIfPredicateMap` + `compileGroupIfPredicates` (extracted for cognitive-complexity ceiling). `parseHooksConfig<P>` widened to a generic and threads the side-Map.
- `extensions/pi-claude-marketplace/domain/resolver.ts` — Adds `os.homedir` import; passes a no-op `(): null => null` compileIf to `parseHooksConfig` at the standalone-hooks read seam (the resolver only consumes the installable verdict).
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` — Adds `compileIfPredicate` + `MATCH_ALL_IF` + `IfPredicate` imports. `RoutingEntry` gains `readonly ifPredicate: IfPredicate`. `CacheEntry` gains `ifPredicates: ReadonlyMap<string, IfPredicate>`. `addPluginConfigToCache(..., ifPredicates)` signature widening. `flattenPluginIntoBuckets` reads the per-handler key and falls back to `MATCH_ALL_IF`. `hydrateCacheFromDisk` threads `opts.cwd` through `hydrateScopeFromState` -> `tryHydrateOnePlugin` for the `CompileIfPredicateContext`.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` — Hosts the new `compileIfPredicate` function (90 LoC) with the five compile paths + per-prefix dispatch arm. Exposes `CompileIfPredicateContext` interface. Imports `TOOL_EVENTS` + `IF_PREFIX_TARGETS` from `domain/components/`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — Adds `os.homedir` + `compileIfPredicate` imports; threads `cwd` into `addInstalledPluginHooksToCache`; passes the real callback to `parseHooksConfig` and the side-Map to `addPluginConfigToCache`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — Same threading pattern as install.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — Same threading pattern; `cwd` already in scope on `ThreePhaseArgs`.

### Test files (9 modified)

- `tests/architecture/hooks-if-field.test.ts` — 17 new tests covering `compileIfPredicate` truth table (5 success paths + 6 fall-open paths + 3 tool-event-dispatch paths + 1 hookDebugLog assertion); 2 new tests covering the `HOOK_HANDLER_SCHEMA: required-stays-["type"]` regression; 3 new tests covering `parseHooksConfig` side-Map shape (empty / populated / fail-open); 1 new end-to-end test for `ifPredicate rides on RoutingEntry`. Plan 02 todos removed; only 3 Plan 03 dispatch-time consult todos remain.
- `tests/architecture/hooks-dispatch.test.ts` — `makeEntry` adds `ifPredicate: MATCH_ALL_IF`; `addPluginConfigToCache` call sites pass `new Map()`.
- `tests/architecture/hooks-exec.test.ts` — Same `makeEntry` + import additions.
- `tests/architecture/hooks-reducer.test.ts` — Same `makeEntry` + import additions.
- `tests/bridges/hooks/dispatch-exec.test.ts` — Same `makeEntry` + import additions.
- `tests/bridges/hooks/event-router.test.ts` — All 19 `addPluginConfigToCache` call sites updated via sed; `makeEntry` factory updated.
- `tests/domain/components/hooks.test.ts` — 15 `parseHooksConfig` call sites updated; `TEST_IF_CTX` + `TEST_COMPILE_IF` synthetic fixtures factored at top of file.
- `tests/orchestrators/plugin/uninstall.test.ts` — 1 `parseHooksConfig` + 1 `addPluginConfigToCache` + 1 RoutingEntry literal updated; imports `compileIfPredicate` + `MATCH_ALL_IF`.
- `tests/orchestrators/plugin/update.test.ts` — 1 `parseHooksConfig` + 1 `addPluginConfigToCache` updated.

## Decisions Made

- **D-61-02 callback-injection seam (Rule 3 auto-fix):** The plan's original action prose put `compileIfPredicate` in `domain/components/hooks.ts` and had it import from `bridges/hooks/if-field/index.ts`. ESLint's `import-x/no-restricted-paths` rule blocks domain from importing upward (D-11). The fix preserved Plan 01's bridge placement and introduced a generic-parameter callback (`CompileIfCallback<P>`) at the domain seam. The bridge layer wires the real `compileIfPredicate`; the resolver supplies a no-op. **No architectural change to Plan 01's outputs was needed.** This is documented as a deviation below.
- **Generic `P` over `unknown`:** Initial draft used `IfPredicateOpaque = unknown` which broke `.kind` introspection downstream (test files, dispatch code) under `@typescript-eslint/no-unsafe-member-access`. Widened to `parseHooksConfig<P>` + `CompiledIfPredicateMap<P>` + `HookConfigParseResult<P>`. Type inference at call sites recovers the concrete `IfPredicate` union without the domain parser importing it.
- **Resolver no-op callback returns `null`:** Domain code is forbidden from constructing the bridge `IfPredicate` shape, so the resolver supplies `(): null => null`. The resolver's caller (`applyHooksConfig`) discards the side-Map; the `null` is unreachable. This keeps the resolver's outcome the same discriminated `installable` arm it was before.
- **`compileGroupIfPredicates` helper extraction:** `buildIfPredicateMap` cognitive complexity initially hit 17 (cap is 15). Extracted the per-group handler walk into a helper. No behavioral change.
- **`hydrateScopeFromState` cwd threading:** Originally took only `(state, loc)`. Widened to `(state, loc, cwd)` and threaded through `tryHydrateOnePlugin(scope, marketplace, pluginId, hooksJsonPath, hooksDir, cwd)` so the `CompileIfPredicateContext` constructed at the parse seam has the right cwd for project-scope. `hydrateProjectScopeForCwd` reuses this with the explicit cwd from `resources_discover`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Architectural import direction (`domain/ MUST NOT import upward`)**

- **Found during:** Task 1 lint after the initial draft
- **Issue:** Plan 02's action prose put `compileIfPredicate` in `domain/components/hooks.ts` and instructed the imports of `compileBashGlob` / `compilePathGlob` / `MATCH_ALL_IF` / `type IfPredicate` / `type CompileIfPredicateContext` from `bridges/hooks/if-field/index.ts`. ESLint's `import-x/no-restricted-paths` rule (BLOCK C, D-11) blocks this — domain MUST NOT import from bridges.
- **Fix:** Kept the `compileIfPredicate` function physically in `bridges/hooks/if-field/index.ts` (Plan 01's location for the if-field primitives). Introduced a generic-parameter callback (`CompileIfCallback<P>`) at the `parseHooksConfig` seam so the domain parser invokes the bridge function without importing it. The bridge layer (`event-router.ts`) and orchestrators wire the real `compileIfPredicate`; the resolver supplies a no-op `(): null => null` because its outcome only needs the discriminated installable arm.
- **Files modified (deviation-only delta):** `extensions/pi-claude-marketplace/domain/components/hooks.ts` (parseHooksConfig signature widening + CompileIfCallback type), `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` (gained `compileIfPredicate` + bridge-side imports of `TOOL_EVENTS` + `IF_PREFIX_TARGETS`), `extensions/pi-claude-marketplace/domain/resolver.ts` (no-op callback).
- **Verification:** `npm run lint` GREEN; the architectural test (D-11 directional containment) still passes.
- **Committed in:** `3b1de5d` (Task 1 commit)

**2. [Rule 1 - Bug] `IfPredicateOpaque = unknown` breaks downstream introspection**

- **Found during:** Task 1 lint iteration 2
- **Issue:** First fix attempt used `type IfPredicateOpaque = unknown` so the domain parser never type-depended on the bridge union. Downstream consumers (tests, bridge dispatch) then failed `@typescript-eslint/no-unsafe-member-access` and `@typescript-eslint/no-unsafe-call` when introspecting `.kind` on `result.ifPredicates.get(key)`.
- **Fix:** Widened every parser-side type to be generic over `P`: `CompileIfCallback<P>`, `CompiledIfPredicateMap<P>`, `HookConfigParseResult<P>`, `parseHooksConfig<P>`, `buildIfPredicateMap<P>`, `compileGroupIfPredicates<P>`. The concrete `IfPredicate` union flows out via type inference at call sites without the domain parser importing it.
- **Verification:** `npm run lint` GREEN; downstream `.kind` introspection in tests + flatten code is typed correctly.
- **Committed in:** `3b1de5d` (Task 1 commit)

**3. [Rule 1 - Bug] Cognitive-complexity ceiling on `buildIfPredicateMap`**

- **Found during:** Task 1 lint
- **Issue:** `buildIfPredicateMap` triple-nested loop (Object.entries -> groups -> handlers) hit cognitive complexity 17; cap is 15.
- **Fix:** Extracted `compileGroupIfPredicates<P>` for the per-group handler walk. No behavioral change.
- **Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`
- **Verification:** `npm run lint` GREEN.
- **Committed in:** `3b1de5d` (Task 1 commit)

**4. [Rule 2 - Missing Critical] `hydrateScopeFromState` had no cwd in scope at the parse seam**

- **Found during:** Task 1 (event-router signature update)
- **Issue:** `hydrateScopeFromState(state, loc)` -> `tryHydrateOnePlugin` -> `parseHooksConfig` had no cwd in scope. Constructing `CompileIfPredicateContext` from `process.cwd()` would silently mis-anchor path globs when the Pi session's project root differs from the process cwd.
- **Fix:** Threaded `cwd` from `hydrateCacheFromDisk(opts.cwd)` down through `hydrateScopeFromState(state, loc, cwd)` -> `tryHydrateOnePlugin(..., cwd)`. The hydrate path now uses the project-scope cwd `opts.cwd` (set from `resources_discover.event.cwd` at the entrypoint).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
- **Verification:** Existing event-router tests pass; `npm run check` GREEN.
- **Committed in:** `3b1de5d` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 Rule 3 architectural-import + 1 Rule 1 generic-parameter rewire + 1 Rule 1 cognitive-complexity refactor + 1 Rule 2 cwd threading)

**Impact on plan:** All four deviations preserve the plan's documented behavior. The largest (Rule 3 + Rule 1 generic) was an architectural rethink: `compileIfPredicate` lives at the bridge layer (Plan 01's original placement) but the parse-time-compile semantic is preserved via callback injection. No scope creep; no plan-task addition; no test surface deletion.

## Issues Encountered

- The plan's action prose under-specified the architectural-import constraint: it said "import from `bridges/hooks/if-field/index.ts`" without checking that domain/ can't import bridges/. This was the largest mid-execution rework: the initial draft was rewritten to use callback injection. ~30 min of the 95-min total was the rework + Rule 1 cleanup pass for `IfPredicateOpaque`.
- Many test fixtures (8 files) constructed `RoutingEntry` literals or called `addPluginConfigToCache` with old signatures. Mostly resolved by sed for `addPluginConfigToCache(scope, mp, plugin, config)` -> `(..., config, new Map())` and individual `ifPredicate: MATCH_ALL_IF` additions to `makeEntry` factories. No semantic test changes — only fixture updates to satisfy the new types.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 03 (dispatch consult + REQUIREMENTS.md amendment)** can wire the dispatch-time consult against `entry.ifPredicate` as a single-line insertion in `reduceBucket`:
  ```typescript
  if (!ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)) {
    continue;  // hook does not apply
  }
  ```
  The `ifFires(predicate, event, ctx, claudeEvent): boolean` function is the only new symbol Plan 03 needs to author; everything it consumes (`predicate.kind`, `MATCH_ALL_IF` sentinel, `IF_PREFIX_TARGETS` cross-tool sets, `parseBashSubcommands`) is exported from `bridges/hooks/if-field/`.
- **REQUIREMENTS.md amendment** (atomic-supersession per D-61-03): Plan 03 closes MATCH-03 by amending the closed-set list to reflect the upstream-faithful prefix set + cross-tool semantic.
- No blockers; both Plan 03 dispatch wire-ins are 1-line additions against a typed surface.

## Self-Check: PASSED

- All 11 modified source files exist (verified via `git log --stat` on `560a57d` + `3b1de5d`).
- Both commits exist in `git log --oneline`:
  - `3b1de5d` Task 1 (feat: parse-time compileIfPredicate + parseHooksConfig side-Map) — FOUND
  - `560a57d` Task 2 (feat: RoutingEntry.ifPredicate + flatten populates from side-Map) — FOUND
- `npm run check` GREEN at both task-completion checkpoints.
- New architecture-test block "ifPredicate rides on RoutingEntry" passes; all 17 `compileIfPredicate` truth-table fixtures pass; the HOOK_HANDLER_SCHEMA regression fixture passes.
- 38 tests in `hooks-if-field.test.ts` (35 active + 3 todo for Plan 03).
- Comment policy clean: `grep -nE 'Phase [0-9]+|Pitfall [0-9]+|Plan [0-9]+-[0-9]+|Wave [0-9]+|Task [0-9]+'` returns 0 matches in the source files touched (modulo allowed traceability anchors like D-61-NN, MATCH-03, NFR-7, etc.).

---

*Phase: 61-if-field-permission-rule-matcher*
*Completed: 2026-06-15*

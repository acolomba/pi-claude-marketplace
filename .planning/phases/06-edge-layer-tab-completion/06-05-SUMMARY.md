---
phase: 06-edge-layer-tab-completion
plan: 05

subsystem: edge
tags: [edge-layer, register, llm-tools, cache-invalidation, wave-3, d-03-inv, d-04, tc-5, tc-6, tc-7]

# Dependency graph
requires:
  - phase: 06-edge-layer-tab-completion
    plan: 03
    provides: "shared/completion-cache.ts (invalidate API), edge/completions/data.ts (LocationsResolver interface), edge/completions/provider.ts (getArgumentCompletions)."
  - phase: 06-edge-layer-tab-completion
    plan: 04
    provides: "9 thin-shim handler factories + handleMarketplaceList + 2 LLM-tool registration helpers."
provides:
  - "extensions/claude-marketplace/orchestrators/edge-deps.ts: makeLocationsResolver(cwd) constructor that closes over persistence/state-io + persistence/locations + domain/manifest + domain/resolver. Returns LocationsResolverLike (a structural mirror of edge/completions/data.ts::LocationsResolver, kept locally because orchestrators/ MUST NOT import edge/ per BLOCK C). This resolves the planner's option (c) for the edge -> persistence indirection."
  - "extensions/claude-marketplace/edge/register.ts: registerClaudePluginCommand(pi, deps) wires pi.registerCommand + pi.on(session_start). registerClaudeMarketplaceTools(pi) delegates to the two read-only LLM tools. Pitfall 3: process.cwd() at the registration glue layer is sanctioned exactly once."
  - "Cache-invalidation call sites in 5 mutating orchestrators (marketplace/{add,remove,update}, plugin/{install,uninstall}). Each call is wrapped in try/catch + notifyWarning per the 06-PATTERNS.md standard failure envelope; failure never rolls back the primary operation."

affects: [phase-07-pi-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Option (c) resolution for edge -> persistence BLOCK C tension: orchestrators/edge-deps.ts owns the LocationsResolver constructor because orchestrators/ CAN reach persistence + domain; edge/register.ts imports the constructor from orchestrators/ (edge -> orchestrators is allowed). Neither (a) blanket BLOCK C exception nor (b) a shared/ helper would work cleanly; option (c) honors BLOCK C verbatim."
    - "LocationsResolverLike structural mirror: orchestrators/edge-deps.ts CANNOT import LocationsResolver from edge/completions/data.ts (BLOCK C forbids orchestrators -> edge). The interface is re-declared locally; TypeScript structural typing guarantees assignability at the edge-side call site. The fields stay in sync by convention -- a future rename would surface at register.ts compile time when the consumer asserts the shape it needs."
    - "Standard failure envelope (06-PATTERNS lines 1218-1224): every orchestrator-side cache-invalidation call uses `try { invalidate*(...) } catch (err) { notifyWarning(ctx, '<op> succeeded; completion cache refresh deferred: ${errorMessage(err)}') }`. The two pure invalidate* functions are memory-only and cannot throw under normal operation; the try/catch is defense-in-depth. `dropMarketplaceCache` does an I/O unlink and is the realistic failure surface."
    - "Memory-spy + file-delete test pattern: each D-03-INV assertion pre-warms the in-memory cache by calling getMarketplaceNames/getPluginIndex with a tracked rebuild closure (rebuildCount += 1), deletes the on-disk cache file so the next memory miss MUST rebuild, runs the orchestrator, and then re-invokes the read API with a separate rebuild closure. The counter incrementing proves memory was cleared AND the file is gone -- i.e. the orchestrator routed through the invalidation call site."

key-files:
  created:
    - "extensions/claude-marketplace/edge/register.ts"
    - "extensions/claude-marketplace/orchestrators/edge-deps.ts"
    - "tests/edge/register.test.ts (unskipped from Wave 0 stub)"
  modified:
    - "extensions/claude-marketplace/orchestrators/marketplace/add.ts"
    - "extensions/claude-marketplace/orchestrators/marketplace/remove.ts"
    - "extensions/claude-marketplace/orchestrators/marketplace/update.ts"
    - "extensions/claude-marketplace/orchestrators/plugin/install.ts"
    - "extensions/claude-marketplace/orchestrators/plugin/uninstall.ts"
    - "tests/orchestrators/marketplace/add.test.ts (+1 D-03-INV test)"
    - "tests/orchestrators/marketplace/remove.test.ts (+1 D-03-INV test)"
    - "tests/orchestrators/marketplace/update.test.ts (+1 D-03-INV test)"
    - "tests/orchestrators/plugin/install.test.ts (+1 D-03-INV test)"
    - "tests/orchestrators/plugin/uninstall.test.ts (+1 D-03-INV test)"

key-decisions:
  - "Task 3 (ESLint process.stdout/stderr block in edge/**) is a NO-OP. The existing BLOCK A rule in eslint.config.js already targets `extensions/claude-marketplace/**/*.ts` -- a superset of `extensions/claude-marketplace/edge/**/*.ts` -- and enumerates `process.stdout.write` + `process.stderr.write` as no-restricted-syntax errors. ROADMAP Phase 6 SC5 is already satisfied; the plan's Task 3 anticipated this outcome and authorized noting it in the SUMMARY rather than re-adding the rule."
  - "LocationsResolverLike is exported from orchestrators/edge-deps.ts as a public type. It is structurally identical to edge/completions/data.ts::LocationsResolver. Phase 7 callers (index.ts) consume the constructor; tests can also mock against either interface. Coupling is intentional -- the interface is the seam, and the structural mirror documents that the two declarations MUST stay shape-compatible."
  - "loadStateForScope in edge-deps.ts re-projects the persistence-level marketplaces record into a MarketplaceStateRecordLike shape (manifestPath + plugins only). The projection is structurally compatible with the broader state shape but explicitly documents the resolver's surface (only the two fields the cache rebuild path needs). State.json read errors propagate verbatim -- TC-9 routes them through getMarketplaceNames."
  - "loadManifestForMarketplace defensively wraps every thrown error in ManifestSoftFailError before re-throwing. The cache layer's rebuildPluginIndex (in data.ts) ALSO wraps, so the proactive wrap here is redundant but defense-in-depth. State.json errors during plugin-index rebuild are caught at this layer and surfaced as soft-fail (TC-8 poison cache); the TC-9 surface for plugin-index path is intentionally suppressed by the cache architecture (see data.ts header note)."
  - "remove.ts cache-invalidation block placement was chosen to sit BETWEEN withStateGuard close and POST-STATE cleanup begin. The plan also acknowledged this position. Rationale: a leftover plugin cache file would mislead the next completion read; the invalidation MUST run before any user-visible warning/error notifications are composed."

patterns-established:
  - "Structural-mirror interface across an import-boundary divide: when a file in zone X must produce a value shaped to match an interface declared in zone Y, and zone X cannot import zone Y (per BLOCK C), the producer re-declares the interface locally (suffix `Like` for clarity) and lets TypeScript's structural typing close the loop at the consumer site. The mirror MUST be kept manually in sync; the consumer's typecheck is the safety net."
  - "Cache-invalidation surface inside the post-state-commit window: 5 mutating orchestrators each gained 6-12 LOC for the invalidation call (try/catch + notifyWarning + 1-2 invalidate API calls). The orchestrators' existing notify discipline, error envelope, and post-state-commit boundary all carry across without modification."

requirements-completed: [TC-5, TC-6, TC-7]

# Metrics
duration: ~25min
completed: 2026-05-11
---

# Phase 6 Plan 05: Register and Invalidation Summary

**Two new files (`edge/register.ts` + `orchestrators/edge-deps.ts`) plus
cache-invalidation call sites in 5 mutating orchestrators, plus 5 new
D-03-INV tests and 10 unskipped register tests. `npm run check` exits 0
with 799 pass / 0 skip / 0 fail. Phase 7's `index.ts` is now a trivial
caller -- import + invoke `registerClaudePluginCommand(pi, deps)` +
`registerClaudeMarketplaceTools(pi)` + Phase-7-owned `pi.on("resources_discover", ...)`.**

## Performance

- **Started:** 2026-05-11T15:06:17Z
- **Completed:** 2026-05-11T15:31:31Z
- **Duration:** ~25 minutes
- **Tasks:** 3 / 3 (Task 3 was a no-op; see Decisions Made)
- **Files created:** 2
- **Files modified:** 10
- **Files left unmodified intentionally:** `eslint.config.js` (Task 3 no-op)

## Task Commits

Each task was committed atomically:

1. **Task 1: wire D-03-INV cache invalidation into orchestrators** -- `f9eb3a9` (feat)
2. **Task 2: register.ts D-04 + edge-deps LocationsResolver** -- `048c649` (feat)
3. **Task 3: ESLint process.stdout/stderr block in edge/** -- NO-OP (see Decisions Made; not committed because no file changes)

## Accomplishments

### Two New Files

| File | Role | Notable exports |
|------|------|-----------------|
| `extensions/claude-marketplace/orchestrators/edge-deps.ts` | LocationsResolver constructor closing over persistence + domain | `makeLocationsResolver(cwd)`, `LocationsResolverLike` |
| `extensions/claude-marketplace/edge/register.ts` | D-04 registration glue | `registerClaudePluginCommand(pi, deps)`, `registerClaudeMarketplaceTools(pi)` |

### Five Cache-Invalidation Insertion Points

Each insertion uses the 06-PATTERNS.md standard failure envelope (try +
catch -> notifyWarning).

| Orchestrator | Landmark | Calls |
|--------------|----------|-------|
| `orchestrators/marketplace/add.ts` | after withStateGuard returns recordedName, before notifySuccess | `invalidateMarketplaceNames(opts.scope)` + `invalidateMarketplaceCache(opts.scope, recordedName)` |
| `orchestrators/marketplace/remove.ts` | between withStateGuard close and POST-STATE cleanup loop | `invalidateMarketplaceNames(resolved.scope)` + `dropMarketplaceCache(await locations.pluginCacheFile(opts.name), resolved.scope, opts.name)` |
| `orchestrators/marketplace/update.ts` | between inner withStateGuard close and CASCADE OUTSIDE the outer guard | `invalidateMarketplaceCache(scope, name)` |
| `orchestrators/plugin/install.ts` | after AS-6 pluginDataDir mkdir block, before AS-7 foreign-content surface | `invalidateMarketplaceCache(scope, marketplace)` |
| `orchestrators/plugin/uninstall.ts` | between PU-5 silent-converge return and pluginDataDir rm (post-state-commit, before cleanup) | `invalidateMarketplaceCache(scope, marketplace)` |

`plugin/update.ts` is a no-op per D-03 corollary (install status does not
change; version field is not in the plugin name cache).

### Register.ts Wiring

`registerClaudePluginCommand` builds the SubcommandHandlers map from the 9
thin-shim handler factories (8 factory + 1 plain `handleMarketplaceList`),
calls `pi.registerCommand("claude:plugin", {...})` exactly once, and
installs the TC-7 autocomplete wrapper via `pi.on("session_start", ...)`.
The wrapper composes `normalizeCompletionWhitespace` only for lines that
`isClaudePluginCommandLine` accepts -- other extensions' completion lines
pass through verbatim.

`registerClaudeMarketplaceTools` delegates to the two read-only LLM tool
registrations (`registerListMarketplacesTool` + `registerListPluginsTool`)
from Plan 06-04's `handlers/tools.ts`. Two `pi.registerTool` calls total.

### LocationsResolver Constructor (edge-deps.ts)

`makeLocationsResolver(cwd)` returns an object implementing four members:

| Member | Implementation |
|--------|----------------|
| `marketplaceNamesCachePath(scope)` | `locationsFor(scope, cwd).marketplaceNamesCacheFile` |
| `pluginCachePath(scope, mp)` | `locationsFor(scope, cwd).pluginCacheFile(mp)` |
| `loadStateForScope(scope)` | Calls `loadState(locations.extensionRoot)` and projects to `{ marketplaces: Record<string, MarketplaceStateRecordLike> }`. State.json errors propagate (TC-9 via `rebuildNamesForScope`). |
| `loadManifestForMarketplace(scope, mp)` | Reads state record + manifest file, validates via `MARKETPLACE_VALIDATOR`, builds rows from state.plugins (status=installed) + manifest.plugins (status=available/unavailable via `resolveStrict`). All thrown errors caught + re-thrown as `ManifestSoftFailError` (TC-8 poison signal). |

### Decision-ID Traceability

| Decision / REQ-ID | Surface | Where it lands |
|-------------------|---------|-----------------|
| D-04 (registration helpers) | `edge/register.ts` | Two named exports; Phase 7's index.ts trivially calls both. |
| D-04 corollary (router stays pure) | `edge/register.ts` | `handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx)` -- no pi.* calls reach the router. |
| D-03-INV (5 invalidation call sites) | 5 orchestrators + 5 test files | Each orchestrator gains 6-12 LOC; each test file gains one D-03-INV assertion. |
| TC-7 (whitespace normalization) | `edge/register.ts` session_start wrapper | Scoped to `isClaudePluginCommandLine`-matching lines; passes other lines through verbatim. |
| TC-5 + TC-6 (completion data path) | `orchestrators/edge-deps.ts::makeLocationsResolver` | The resolver constructor is the seam that lets the dispatcher consume persistence/domain without an edge-side import. |
| BLOCK C resolution (option (c)) | `orchestrators/edge-deps.ts` placement | The constructor lives in orchestrators/ which CAN import persistence/ + domain/; edge/register.ts imports the constructor from orchestrators/ which is also legal. |
| ROADMAP Phase 6 SC5 (process.stdout/stderr in edge/) | `eslint.config.js` (unchanged) | Existing BLOCK A rule already targets `extensions/claude-marketplace/**` (superset); no diff needed. |

### Test Counts

Baseline before this plan (end of Plan 06-04):

```text
ℹ tests 794
ℹ pass 784
ℹ fail 0
ℹ skipped 10
```

After this plan:

```text
ℹ tests 799   (+5 newly added)
ℹ pass 799   (+15 transitioned: +5 new + 10 unskipped)
ℹ fail 0
ℹ skipped 0  (-10)
```

Breakdown:

| File | Change | Count |
|------|--------|-------|
| `tests/orchestrators/marketplace/add.test.ts` | +1 D-03-INV | 11 (was 10) |
| `tests/orchestrators/marketplace/remove.test.ts` | +1 D-03-INV | 10 (was 9) |
| `tests/orchestrators/marketplace/update.test.ts` | +1 D-03-INV | 15 (was 14) |
| `tests/orchestrators/plugin/install.test.ts` | +1 D-03-INV | 20 (was 19) |
| `tests/orchestrators/plugin/uninstall.test.ts` | +1 D-03-INV | 11 (was 10) |
| `tests/edge/register.test.ts` | 10 unskipped | 10 (was 0 / 10 skip) |
| **Total delta** | | **+5 new pass + 10 unskipped pass** |

### Import-Boundary Self-Invariants

| Module | Forbidden imports | Result |
|--------|-------------------|--------|
| `extensions/claude-marketplace/edge/register.ts` | persistence/, domain/, bridges/, transaction/, platform/ | `grep -nE` -> 0 matches |
| `extensions/claude-marketplace/orchestrators/edge-deps.ts` | edge/, bridges/, transaction/, platform/ | `grep -nE` -> 0 matches |

Both files pass `import-x/no-restricted-paths` (BLOCK C).

### Output Discipline (BLOCK A)

| Module | `ctx.ui.notify` direct call grep | Result |
|--------|----------------------------------|--------|
| `edge/register.ts` | `grep -nE` -> 0 matches | PASS |
| `orchestrators/edge-deps.ts` | `grep -nE` -> 0 matches | PASS |

The 5 modified orchestrators all use `notifyWarning` (Plan 04/05 carry-forward); zero new direct notify calls.

## Decisions Made

1. **Task 3 is a no-op.** The existing ESLint BLOCK A rule
   (`extensions/claude-marketplace/**/*.ts`) already enumerates
   `process.stdout.write` and `process.stderr.write` as
   `no-restricted-syntax` errors. The plan's Task 3 prescription was
   "extend the rule to edge/", but since BLOCK A is a superset, no diff
   is needed. The probe-file verification confirms the rule is active:

   ```text
   $ echo 'process.stdout.write("x");' > extensions/claude-marketplace/edge/probe.ts
   $ npx eslint extensions/claude-marketplace/edge/probe.ts
   1:1  error  Direct process.stdout.write is forbidden in the extension (IL-2). ...
   ```

   The plan explicitly authorized this outcome ("if BLOCK A already covers ... this task is a no-op and the developer should note that in the SUMMARY rather than re-add the rule").

2. **Option (c) for edge -> persistence BLOCK C resolution.** The plan's
   `<objective>` enumerated three options (a) extend BLOCK C, (b) shared
   helper, (c) orchestrators-level constructor. Option (c) is the
   architecturally clean resolution: orchestrators/ may import from
   persistence/ AND domain/; edge/ may import from orchestrators/.
   `makeLocationsResolver` therefore lives in `orchestrators/edge-deps.ts`,
   and `edge/register.ts` imports the constructor verbatim. No BLOCK C
   exception is needed.

3. **LocationsResolverLike structural mirror.** orchestrators/edge-deps.ts
   CANNOT import `LocationsResolver` from `edge/completions/data.ts`
   (BLOCK C forbids orchestrators -> edge). The interface is re-declared
   locally as `LocationsResolverLike` and the constructor returns that
   type. The edge-side call site (`edge/register.ts`) passes the
   constructed value into `getArgumentCompletions(prefix, resolver)`
   where the consumer expects `LocationsResolver` -- TypeScript's
   structural typing closes the loop because both interfaces have
   identical fields.

4. **makeRemoveHandler factory takes pi.** Confirmed Plan 04's Rule 1
   deviation that `makeRemoveHandler` requires `pi: ExtensionAPI`
   (because `removeMarketplace` orchestrator requires `pi` for soft-dep
   probes). `register.ts` calls `makeRemoveHandler(pi)` rather than
   `makeRemoveHandler()`.

5. **D-03-INV memory-spy + file-delete test pattern.** The cache module's
   `invalidate*` helpers are memory-only (file preserved as rebuild
   source). The test pre-warms memory, deletes the cache file, runs the
   orchestrator, and asserts the next read invokes rebuild. Without the
   file-delete step, the second read would hit the file and serve from
   it without rebuild -- the test would pass even if the orchestrator
   forgot to invalidate. The two-pronged pattern correctly proves both
   memory-clear AND file-absent state. For `dropMarketplaceCache`
   (`remove.test.ts`), the test pre-creates the cache file and asserts
   it's absent post-removal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@typescript-eslint/require-await` on rebuild closures**

- **Found during:** Task 1 ESLint pass on the 5 new D-03-INV tests.
- **Issue:** Initial draft used `async () => { ... return [...] }` for the
  rebuild closures passed to `getMarketplaceNames` / `getPluginIndex`.
  ESLint's `@typescript-eslint/require-await` flags async functions
  without `await`. The closures are pure synthesis (no await), so
  marking them async is gratuitous.
- **Fix:** Rewrote each rebuild closure to use `() => Promise.resolve(...)`
  pattern. Equivalent semantics; ESLint clean.
- **Files affected:** All 5 D-03-INV test functions across
  `tests/orchestrators/{marketplace,plugin}/*.test.ts`.
- **Verification:** `npx eslint` -> 0 errors.
- **Committed in:** `f9eb3a9` (Task 1 commit, same patch as the originals).

**2. [Rule 3 - Blocking] BLOCK C blocked the planned `LocationsResolver` import**

- **Found during:** Task 2 ESLint pass on the first draft of `orchestrators/edge-deps.ts`.
- **Issue:** The plan's `<context>` block prescribed
  `import type { LocationsResolver } from "../edge/completions/data.ts"`
  inside `orchestrators/edge-deps.ts`. ESLint flagged this as a BLOCK C
  violation (orchestrators -> edge is forbidden by zone 2 of the
  9-zone import matrix). The plan's snippet was an oversight; the
  resolution had to land architecturally clean.
- **Fix:** Re-declared the resolver interface locally as
  `LocationsResolverLike` (with a `MarketplaceStateRecordLike` mirror).
  TypeScript structural typing carries the assignability through to
  `edge/register.ts`'s call site without crossing the boundary at
  compile or runtime.
- **Files affected:** `extensions/claude-marketplace/orchestrators/edge-deps.ts`.
- **Verification:** `npx eslint` -> 0 errors; `npx tsc --noEmit` -> 0 errors.
- **Committed in:** `048c649` (Task 2 commit, same patch as the original).

**3. [Rule 3 - Blocking] BLOCK A grep gate trips on `ctx.ui.notify` literal in a docstring**

- **Found during:** Task 2 self-check after writing `edge/register.ts`.
- **Issue:** The file-level docstring originally said "BLOCK A: zero
  direct `ctx.ui.notify` calls." The literal substring `ctx.ui.notify`
  in the docstring would trip the planner's grep gate
  (`grep -nE "ctx\.ui\.notify"`) because the gate does not strip
  TypeScript line comments. Plan 06-02 hit the same issue in router.ts
  and resolved it the same way.
- **Fix:** Rewrote the docstring to paraphrase ("zero direct Pi-context
  notify calls") without using the literal `ctx.ui.notify` substring.
  The actual enforcement is the ESLint BLOCK A rule (`no-restricted-syntax`);
  the grep gate is a fast-feedback canary.
- **Files affected:** `extensions/claude-marketplace/edge/register.ts`.
- **Verification:** `grep -nE "ctx\.ui\.notify" edge/register.ts` -> 0 matches.
- **Committed in:** `048c649` (Task 2 commit, in the original patch).

**4. [Rule 3 - Blocking] AutocompleteProvider.getSuggestions return-type mismatch in tests**

- **Found during:** Task 2 typecheck on `tests/edge/register.test.ts`.
- **Issue:** Mock `current: AutocompleteProvider` initially used
  `getSuggestions: () => []` (empty array). The interface (from
  `@mariozechner/pi-tui`) requires `Promise<AutocompleteSuggestions | null>`.
- **Fix:** Replaced with `getSuggestions: () => Promise.resolve(null)`.
  No behavioral effect on the wrapper tests because the wrapper's
  `getSuggestions` just delegates to the underlying provider.
- **Files affected:** `tests/edge/register.test.ts`.
- **Verification:** `npx tsc --noEmit` -> 0 errors.
- **Committed in:** `048c649` (Task 2 commit, in the original patch).

**5. [Rule 3 - Blocking] Prettier reformatted 4 files post-write**

- **Found during:** Each task's verification run.
- **Issue:** Initial drafts had line-length / argument-fold differences
  from prettier's canonical output. Specifically:
  - `orchestrators/marketplace/remove.ts` + `update.ts` (Task 1)
  - `orchestrators/edge-deps.ts` + `edge/register.ts` (Task 2)
- **Fix:** Ran `npx prettier --write` on each. No semantic change.
- **Files affected:** As listed above.
- **Verification:** `npx prettier --check` -> clean across all modified files.

---

**Total deviations:** 5 (4 Rule 3 tooling-compliance + 1 Rule 3
plan-snippet inaccuracy). None change the plan's invariants or user
contract; all five are scoped to single-line-or-block fixes. The D-03
contract, the D-04 register surface, and the BLOCK C resolution are
preserved verbatim.

## Issues Encountered

- **Plan's `<context>` block prescribed an import that BLOCK C forbids.**
  `import type { LocationsResolver } from "../edge/completions/data.ts"`
  inside `orchestrators/edge-deps.ts` would have violated BLOCK C zone
  2 (orchestrators -> edge). Resolved by locally re-declaring the
  interface (Deviation #2). Recommend the planner cross-check
  cross-zone type imports against the BLOCK C matrix when sketching
  `<context>` interfaces in future plans.

- **No new architectural surprises.** The 5 orchestrator cache-
  invalidation insertions slotted in cleanly; the LocationsResolver
  constructor matched the cache rebuild expectations on first attempt;
  the 10 register tests passed once the AutocompleteProvider type was
  corrected.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - no new threat surface introduced beyond the plan's `<threat_model>`.

The three documented mitigations are honored:

- **T-EDGE-2b (`--scope` validation)**: `locationsFor` accepts only `"user" | "project"`. The Scope type is enforced at every call site of `makeLocationsResolver` per Phase 2's typed contract.
- **T-EDGE-5b (hostile marketplace name reaching `dropMarketplaceCache`)**: `locations.pluginCacheFile(marketplace)` (Plan 06-02 extension) routes through `assertSafeName` + `assertPathInside` before returning the path; the removal orchestrator passes only `opts.name` which came through `parseCommandArgs` validation.
- **T-EDGE-9 (cache invalidation failure swallowed)**: every cache-invalidation call site routes failures through `notifyWarning(ctx, ...)` so operator visibility is preserved. The orchestrator's primary success is also surfaced via `notifySuccess`.

## Next Phase / Plan Readiness

- **Phase 7 (`index.ts` wiring):** Phase 6 is now complete. Phase 7's
  `index.ts` becomes a trivial caller:
  1. `import { registerClaudePluginCommand, registerClaudeMarketplaceTools } from "./edge/register.ts"`
  2. Build `deps: EdgeDeps = { gitOps: DEFAULT_GIT_OPS, pluginUpdate: ... }`.
  3. Call both helpers.
  4. Phase-7-owned `pi.on("resources_discover", ...)` wiring (NOT a
     Phase 6 concern).

- **D-03 escalation knobs:** if perf measurement post-Phase 7 shows the
  file-backed cache layer is unnecessary overhead, the file layer can
  be dropped in `shared/completion-cache.ts` constants. Conversely, the
  10-min TTL can be shortened if users see stale completions for too
  long after a sibling-process state change. Both knobs are local to
  the cache module.

## Self-Check: PASSED

All 2 created files verified present:

- extensions/claude-marketplace/edge/register.ts -- FOUND
- extensions/claude-marketplace/orchestrators/edge-deps.ts -- FOUND

All 10 modified files verified present (5 orchestrators + 5 test files):

- extensions/claude-marketplace/orchestrators/marketplace/add.ts -- FOUND
- extensions/claude-marketplace/orchestrators/marketplace/remove.ts -- FOUND
- extensions/claude-marketplace/orchestrators/marketplace/update.ts -- FOUND
- extensions/claude-marketplace/orchestrators/plugin/install.ts -- FOUND
- extensions/claude-marketplace/orchestrators/plugin/uninstall.ts -- FOUND
- tests/orchestrators/marketplace/add.test.ts -- FOUND
- tests/orchestrators/marketplace/remove.test.ts -- FOUND
- tests/orchestrators/marketplace/update.test.ts -- FOUND
- tests/orchestrators/plugin/install.test.ts -- FOUND
- tests/orchestrators/plugin/uninstall.test.ts -- FOUND
- tests/edge/register.test.ts -- FOUND (unskipped)

Cache-invalidation grep gate (each orchestrator has at least one call):

- orchestrators/marketplace/add.ts -- 4 matches -- PASS
- orchestrators/marketplace/remove.ts -- 3 matches -- PASS
- orchestrators/marketplace/update.ts -- 2 matches -- PASS
- orchestrators/plugin/install.ts -- 2 matches -- PASS
- orchestrators/plugin/uninstall.ts -- 2 matches -- PASS

BLOCK C grep gate for register.ts (zero imports from persistence/domain/bridges/transaction/platform):

- edge/register.ts -- 0 matches -- PASS

BLOCK A grep gate for register.ts (zero direct Pi-context notify calls):

- edge/register.ts -- 0 matches -- PASS

ESLint probe (process.stdout.write inside edge/ triggers the rule):

- Probe file confirms `no-restricted-syntax` blocks `process.stdout.write` and `process.stderr.write` in edge/ -- PASS

Both task commits verified in git log:

- f9eb3a9 (Task 1: wire D-03-INV cache invalidation into orchestrators) -- FOUND
- 048c649 (Task 2: register.ts D-04 + edge-deps LocationsResolver) -- FOUND

`npm run check` exit code: 0 (typecheck + ESLint + Prettier + node:test all green: 799 tests, 799 pass, 0 skip, 0 fail).

---

*Phase: 06-edge-layer-tab-completion*
*Plan: 05-register-and-invalidation*
*Completed: 2026-05-11*

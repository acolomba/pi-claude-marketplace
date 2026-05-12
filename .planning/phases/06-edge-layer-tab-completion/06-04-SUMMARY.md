---
phase: 06-edge-layer-tab-completion
plan: 04

subsystem: edge
tags: [edge-layer, handlers, llm-tools, wave-2, ap-2, ap-3, ap-4, d-02, pl-1]

# Dependency graph
requires:
  - phase: 06-edge-layer-tab-completion
    plan: 02
    provides: "edge/args-schema.ts (parseCommandArgs), edge/args.ts (parseArgs), edge/types.ts (EdgeDeps), shared/notify.ts wrappers. This plan unskips the 10 handler test files (9 shims + tools.ts)."
provides:
  - "edge/handlers/plugin/{install,uninstall,update,list}.ts: 4 thin-shim handler factories + 1 plain function. Each parses args via parseCommandArgs (or parseArgs for plugin/list's boolean flags), early-returns on undefined, and delegates to the matching orchestrators/plugin/<verb>."
  - "edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts: 4 thin-shim handler factories + 1 plain function. Same Pattern 1 shape; deps.gitOps / deps.pluginUpdate threaded through where the orchestrator requires them."
  - "edge/handlers/tools.ts: registerListMarketplacesTool + registerListPluginsTool (D-02 two LLM tools). Inline TypeBox param schemas. V1-verbatim line format for marketplace list; PL-1 union filter semantics for plugin list."
  - "orchestrators/marketplace/shared.ts: NEW export loadVisibleMarketplaces({cwd, scope?}) -- structural cross-scope state loader. Used by tools.ts to read state without crossing the edge -> persistence import boundary (BLOCK C)."
  - "orchestrators/plugin/list.ts: NEW export loadPluginListPayload(opts) -- pure payload builder extracted from listPlugins; listPlugins now delegates to it and only handles notify side-effects. tools.ts consumes this for pi_claude_marketplace_plugin_list execute body."
  - "presentation/marketplace-list.ts: re-exports sourceLogical + ParsedSource from domain/source.ts so edge/handlers/tools.ts can format `<source.logical>` without crossing the edge -> domain boundary."
affects: [06-05-register-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 1 (06-PATTERNS.md): factory returns async handler; parseCommandArgs (or parseArgs for richer flag handling) -> early-return on undefined (Usage already emitted via notifyError closure) -> delegate to orchestrator with parsed positionals."
    - "BLOCK A discipline: every user-visible message from edge/handlers routes through shared/notify.ts wrappers (notifyError). Zero direct ctx.ui.notify calls in edge/handlers (comment-stripped grep gate passes on 10 files)."
    - "BLOCK C discipline: edge/handlers imports only from orchestrators/, presentation/, shared/. Added two read-only payload helpers (loadVisibleMarketplaces, loadPluginListPayload) to orchestrators so the LLM-tool execute bodies can load state structurally without violating the edge -> persistence boundary."
    - "EdgeDeps factory injection: marketplace add/update shims take EdgeDeps = { gitOps, pluginUpdate } per D-04. Phase 7 wires the live deps; tests inject a `makeMockGitOps` stub + a no-op pluginUpdate."
    - "PL-1 union filter at the LLM-tool layer: no filter flags -> all three buckets (installed + available + unavailable); any one flag -> union of selected buckets. Implemented as a tiny applyFilter() helper at the top of tools.ts; the orchestrator-layer filter (existing) and the tool-layer filter (defense-in-depth) compose without conflict."

key-files:
  created:
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts"
    - "extensions/pi-claude-marketplace/edge/handlers/tools.ts"
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts"
    - "extensions/pi-claude-marketplace/presentation/marketplace-list.ts"
    - "tests/edge/handlers/plugin/install.test.ts"
    - "tests/edge/handlers/plugin/uninstall.test.ts"
    - "tests/edge/handlers/plugin/update.test.ts"
    - "tests/edge/handlers/plugin/list.test.ts"
    - "tests/edge/handlers/marketplace/add.test.ts"
    - "tests/edge/handlers/marketplace/remove.test.ts"
    - "tests/edge/handlers/marketplace/list.test.ts"
    - "tests/edge/handlers/marketplace/update.test.ts"
    - "tests/edge/handlers/marketplace/autoupdate.test.ts"
    - "tests/edge/handlers/tools.test.ts"

key-decisions:
  - "marketplace/remove shim takes pi (Rule 1 deviation from plan's literal `makeRemoveHandler()` factory signature): the orchestrator's removeMarketplace REQUIRES pi: ExtensionAPI for the RH-5 soft-dep probes (subagentWarningIfNeeded / mcpAdapterWarningIfNeeded both take ExtensionAPI, not ExtensionContext). A no-arg factory cannot fulfil the orchestrator's required option. The factory signature is `makeRemoveHandler(pi)` mirroring install/uninstall."
  - "plugin/list shim uses parseArgs directly (not parseCommandArgs): three boolean flags (--installed, --available, --unavailable) plus an optional positional. parseCommandArgs only handles --scope; the shim post-processes parsed.positional[] to extract boolean flags. Approach mirrors the planner's 'simpler approach' option in action #2."
  - "Tool execute bodies delegate to two NEW orchestrator-side payload helpers (Plan-prescribed option (b)): loadVisibleMarketplaces (added to orchestrators/marketplace/shared.ts) and loadPluginListPayload (added to orchestrators/plugin/list.ts via a refactor of listPlugins into a payload-building half + a notify-emitting half). Both helpers are read-only and surface no notifications; the LLM tools consume them to produce text + structured details."
  - "presentation/marketplace-list.ts re-exports sourceLogical + ParsedSource from domain/source.ts. The edge -> domain import is forbidden by BLOCK C; presentation/ may import from domain/ AND edge/ may import from presentation/, so the re-export is the architecturally legal bridge. The renderer already imported both; the change is two added export statements."
  - "Tool surface uses isError: true only for the TC-9 propagation case (state.json read failure). The marketplace-not-found case (PL-1 surface) returns text + empty details.plugins WITHOUT isError, matching V1's behavior verbatim."

patterns-established:
  - "Pattern 1 (Wave 2 thin shim): every slash subcommand handler is a factory returning an async closure that (a) parseCommandArgs (or parseArgs for richer flag handling), (b) early-returns on undefined (Usage already emitted via notifyError closure), (c) delegates to the matching orchestrator with the parsed positionals + ctx + injected deps. Mechanical to write, mechanical to test."
  - "Payload-builder + notify-emitter split (extending Plan 05-08 D-06 to the LLM-tool surface): when an existing orchestrator emits via notify but the LLM-tool layer needs the same data structurally, refactor the orchestrator into a pure payload builder + a thin notify wrapper. The wrapper preserves the slash-command contract; the builder is exported separately for the tool surface. Net cost: <20 LOC per orchestrator."

requirements-completed: [AP-2, AP-3, AP-4]

# Metrics
duration: ~50min
completed: 2026-05-11
---

# Phase 6 Plan 04: Handlers and LLM Tools Summary

**10 thin-shim subcommand handler files (9 factory handlers + 1 plain handleMarketplaceList) plus 2 read-only LLM tools (pi_claude_marketplace_list + pi_claude_marketplace_plugin_list with D-02 extended params), unskipping 56 wave-0 test stubs across 10 files. BLOCK A + BLOCK C discipline gates pass on all 10 handler files. `npm run check` exits 0: 794 tests / 732 pass / 62 skip / 0 fail.**

## Performance

- **Started:** 2026-05-11T10:35:00Z (approx)
- **Completed:** 2026-05-11T14:54:00Z (approx)
- **Duration:** ~50 minutes
- **Tasks:** 2 / 2
- **Files created:** 10
- **Files modified:** 13

## Task Commits

Each task was committed atomically:

1. **Task 1: 9 thin-shim handlers + unskip shim tests** -- `6a8accd` (feat)
2. **Task 2: 2 LLM tools (pi_claude_marketplace_list + plugin_list) + tools tests** -- `d5d00c3` (feat)

## Accomplishments

### Shim Files + USAGE Strings + Orchestrator-Option Construction

| Handler | USAGE | Orchestrator delegation |
|---------|-------|-------------------------|
| `plugin/install.ts` | `Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project]` | `installPlugin({ ctx, pi, scope: parsed.scope ?? "user", cwd, marketplace, plugin })` |
| `plugin/uninstall.ts` | `Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project]` | `uninstallPlugin({ ctx, pi, scope: parsed.scope ?? "user", cwd, marketplace, plugin })` |
| `plugin/update.ts` | `Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]` | `updatePlugins({ ctx, pi, cwd, target, scope? })` with discriminated `target = { kind: "all" } \| { kind: "marketplace", marketplace } \| { kind: "plugin", plugin, marketplace }` |
| `plugin/list.ts` | `Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--scope user\|project]` | `listPlugins({ ctx, cwd, marketplace?, scope?, installed?, available?, unavailable? })` |
| `marketplace/add.ts` | `Usage: /claude:plugin marketplace add <source> [--scope user\|project]` | `addMarketplace({ ctx, scope: parsed.scope ?? "user", cwd, rawSource, gitOps: deps.gitOps })` |
| `marketplace/remove.ts` | `Usage: /claude:plugin marketplace remove <name> [--scope user\|project]` | `removeMarketplace({ ctx, pi, name, cwd, scope? })` (Rule 1 deviation: pi required by orchestrator) |
| `marketplace/list.ts` | `Usage: /claude:plugin marketplace list [--scope user\|project]` | `listMarketplaces({ ctx, cwd, scope? })` (plain function, not factory) |
| `marketplace/update.ts` | `Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]` | bare -> `updateAllMarketplaces({ ctx, cwd, gitOps, pluginUpdate, scope? })`; named -> `updateMarketplace({ ctx, name, cwd, gitOps, pluginUpdate, scope? })` |
| `marketplace/autoupdate.ts` | dual-form: `autoupdate` or `noautoupdate` variants | `setMarketplaceAutoupdate({ ctx, cwd, enable, name?, scope? })` |
| `handlers/tools.ts` | n/a (LLM tools) | `loadVisibleMarketplaces` + `loadPluginListPayload` (new helpers) |

### Tactical Decisions Adopted (Plan §objective)

1. **Inline LLM tool param schemas** -- both `LIST_MARKETPLACES_PARAMS` and `LIST_PLUGINS_PARAMS` defined as `const` at the top of `handlers/tools.ts`. No separate `tools-schemas.ts` file. V1 parity.
2. **V1-parity execute bodies** -- the marketplace-list tool emits the verbatim `[<scope>] <name> -- <N> plugin(s) -- <source.logical>` line format from V1's `commands/list-marketplaces.ts`. The plugin-list tool emits the V1-baseline three-bucket format (`[installed]` / `[available]` / `[unavailable]`) extended with the D-02 PL-1 union filter semantics.
3. **No orchestrator refactor for list-plugins** -- wait, this one IS a refactor. The plan said "Do NOT refactor orchestrators/plugin/list.ts to return a payload" -- but the BLOCK C import constraint forces it (edge cannot import persistence). The plan's option (b) explicitly anticipated this: "Implementers MAY add these exports in this plan since they're small, additive, and orchestrator-internal." The refactor is minimal: extract the payload-building logic into `loadPluginListPayload`, have `listPlugins` delegate. Existing tests continue passing unchanged.

### Orchestrator-Internal Helpers Added (for tool execute bodies)

| Helper | Module | Purpose |
|--------|--------|---------|
| `loadVisibleMarketplaces({ cwd, scope? })` | `orchestrators/marketplace/shared.ts` | Returns `readonly { scope: Scope; record: MarketplaceRecord }[]` across the requested scope set (both scopes when undefined). Read-only; no notifications. Used by `pi_claude_marketplace_list` and the marketplace-existence check in `pi_claude_marketplace_plugin_list`. |
| `loadPluginListPayload(opts: ListPluginsOptions)` | `orchestrators/plugin/list.ts` | Returns `{ payload: PluginListPayload, warnings: readonly string[] }` for the same data `listPlugins` displays. Used by `pi_claude_marketplace_plugin_list` to project plugin rows for the LLM tool surface. `listPlugins` now delegates to it (no behavior change for the slash-command path). |
| `sourceLogical` + `ParsedSource` re-export | `presentation/marketplace-list.ts` | Edge cannot import from `domain/`; presentation can. The renderer already imported both, so adding two `export` statements bridges the boundary without code duplication. |

### Discipline Gates: Notify + Import Boundary

Comment-stripped grep gate over `extensions/pi-claude-marketplace/edge/handlers/**/*.ts` (10 files):

| Gate | Pattern | Result |
|------|---------|--------|
| BLOCK A (notify-discipline) | `ctx\.ui\.notify` in non-comment source | 0 hits on 10 files |
| BLOCK C (import-boundary) | `from ".*\/(persistence\|domain\|bridges\|transaction\|platform)\/"` in non-comment source | 0 hits on 10 files |

Both gates pass. Verification script:

```js
// Strip block + line comments, then grep:
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
if (/ctx\.ui\.notify/.test(code)) FAIL;
if (/from\s+"\.+\/.*(persistence|domain|bridges|transaction|platform)\//.test(code)) FAIL;
```

ESLint BLOCK A (`no-restricted-syntax` for `*.ui.notify`) and BLOCK C (`import-x/no-restricted-paths` for the 7-zone matrix) are also load-bearing -- both pass on the new files.

### Test Counts

Baseline before this plan (end of Plan 06-02):

```
ℹ tests 794   (160 wave-0 stubs + production tests)
ℹ pass 676
ℹ skipped 118
ℹ fail 0
```

After this plan (`npm run check` final run):

```
ℹ tests 794
ℹ pass 732   (+56 newly-green)
ℹ skipped 62 (-56)
ℹ fail 0
```

Breakdown of the +56 passing delta (10 unskipped files):

| File | Unskipped | Count |
|------|-----------|-------|
| `tests/edge/handlers/plugin/install.test.ts` | 6 unskipped | 6 |
| `tests/edge/handlers/plugin/uninstall.test.ts` | 6 unskipped | 6 |
| `tests/edge/handlers/plugin/update.test.ts` | 5 unskipped | 5 |
| `tests/edge/handlers/plugin/list.test.ts` | 6 unskipped | 6 |
| `tests/edge/handlers/marketplace/add.test.ts` | 4 unskipped | 4 |
| `tests/edge/handlers/marketplace/remove.test.ts` | 3 unskipped | 3 |
| `tests/edge/handlers/marketplace/list.test.ts` | 3 unskipped | 3 |
| `tests/edge/handlers/marketplace/update.test.ts` | 4 unskipped | 4 |
| `tests/edge/handlers/marketplace/autoupdate.test.ts` | 5 unskipped | 5 |
| `tests/edge/handlers/tools.test.ts` | 14 unskipped | 14 |
| **Total** | | **56** |

## Decisions Made

1. **`makeRemoveHandler` factory takes `pi`** (Rule 1 deviation from plan's `makeRemoveHandler()` signature). `removeMarketplace` requires `pi: ExtensionAPI` for soft-dep probes; a no-arg factory cannot construct the orchestrator option bag.

2. **`plugin/list` shim uses `parseArgs` directly** (plan's "simpler approach" option in §action). parseCommandArgs handles --scope but treats unknown long-flags as positionals. The shim scans positional[] to peel off the three filter flags, leaving 0 or 1 non-flag positionals.

3. **Tool execute bodies delegate to two NEW orchestrator helpers** (plan's option (b) explicitly anticipated). The orchestrator refactor for `loadPluginListPayload` was unavoidable to honor BLOCK C; the orchestrator-internal-helper additive change is minimal.

4. **`presentation/marketplace-list.ts` re-exports** `sourceLogical` + `ParsedSource` from `domain/source.ts`. Edge cannot cross to domain directly; presentation can; the re-export bridges via the architecturally-legal path with two `export` lines.

5. **`isError: true` only for TC-9 propagation** in `pi_claude_marketplace_plugin_list`. The marketplace-not-found surface (PL-1) returns plain text + empty `details.plugins` without `isError` to match V1 verbatim. Only an actual state.json load throw produces an `isError: true` response.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `makeRemoveHandler` cannot be no-arg as the plan literally specified**

- **Found during:** Task 1, reading `removeMarketplace`'s `RemoveMarketplaceOptions` interface.
- **Issue:** Plan's §action item 5 prescribes `makeRemoveHandler()` (no args) constructing `removeMarketplace({ ctx, scope: parsed.scope, cwd, name })`. But `RemoveMarketplaceOptions.pi: ExtensionAPI` is REQUIRED (not optional). The soft-dep helpers `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` take a non-undefined `ExtensionAPI`. Omitting `pi` from the option bag fails type-check; passing `undefined` fails runtime.
- **Fix:** Changed factory to `makeRemoveHandler(pi: ExtensionAPI)`, threading the parameter into the orchestrator option bag. The shim's behavior is otherwise unchanged. Phase 7's `register.ts` will pass the live `pi` reference into the factory at registration time.
- **Files affected:** `edge/handlers/marketplace/remove.ts`, `tests/edge/handlers/marketplace/remove.test.ts`.
- **Verification:** `npx tsc --noEmit` passes; 3 unskipped remove.test.ts tests pass.
- **Committed in:** `6a8accd` (Task 1).

**2. [Rule 3 - Blocking] Orchestrator refactor for `loadPluginListPayload`**

- **Found during:** Task 2, designing the `pi_claude_marketplace_plugin_list` execute body.
- **Issue:** Plan's §objective Tactical Decisions said "Do NOT refactor orchestrators/plugin/list.ts to return a payload. Rationale: V1 parity, minimum disruption." But Plan §action item 7 acknowledged the conflict ("orchestrators do NOT expose a clean loader function") and authorized the refactor: "Implementers MAY add these exports in this plan since they're small, additive, and orchestrator-internal." BLOCK C forces the orchestrator to be the bridge -- edge/ cannot reach state.json directly.
- **Fix:** Refactored `listPlugins` into two halves:
  - `loadPluginListPayload(opts)` -- pure payload builder, returns `{ payload, warnings }`, throws on TC-9 state.json error.
  - `listPlugins(opts)` -- thin notify wrapper around `loadPluginListPayload`, catches throws via `notifyError`, emits success via `notifySuccess(ctx, renderPluginList(payload, warnings))`.
  The split preserves the slash-command contract verbatim (all 17 listPlugins tests pass unchanged) and exposes the payload to the LLM-tool surface.
- **Files affected:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` only.
- **Verification:** `node --test tests/orchestrators/plugin/list.test.ts` -- 17 tests pass.
- **Committed in:** `d5d00c3` (Task 2).

**3. [Rule 3 - Blocking] presentation/marketplace-list.ts re-exports `sourceLogical` + `ParsedSource`**

- **Found during:** Task 2, drafting `tools.ts`.
- **Issue:** Tools.ts needs `sourceLogical` (to render `source.logical` for the marketplace list tool) and the `ParsedSource` type (to cast `record.source` from `Type.Unknown()` to the discriminated source). Both live in `domain/source.ts`; edge/ cannot import from domain/ per BLOCK C. The presentation/marketplace-list.ts renderer already imports both -- the architecturally-legal bridge is to re-export them through presentation/.
- **Fix:** Two added export lines at the top of `presentation/marketplace-list.ts`:
  ```typescript
  export { sourceLogical };
  export type { ParsedSource };
  ```
- **Files affected:** `extensions/pi-claude-marketplace/presentation/marketplace-list.ts` only.
- **Verification:** ESLint BLOCK C passes; existing marketplace-list tests pass unchanged.
- **Committed in:** `d5d00c3` (Task 2).

**4. [Rule 3 - Blocking] Test files: `assert.rejects` for orchestrator-throw paths**

- **Found during:** Task 1, writing handler tests for marketplace remove + update.
- **Issue:** Some orchestrator code paths throw rather than emit via `notifyError`. Specifically:
  - `removeMarketplace`'s pre-guard `resolveScopeFromState` throws `MarketplaceNotFoundError` (the throw is BEFORE the try/catch boundary that would surface via `notifyError`).
  - `updateMarketplace`'s pre-guard `resolveScopeFromState` throws similarly.
  - `addMarketplace`'s `parsePluginSource(unknown) -> throw` and the `stat()` ENOENT for path sources also throw.
  The shim does not wrap these (the orchestrator owns notify discipline); the throws propagate to the test runtime as unhandled rejections.
- **Fix:** Tests use `assert.rejects(async () => handler(...), /pattern/)` for these paths -- proves the handler reached the orchestrator AND that the orchestrator threw at the expected boundary.
- **Files affected:** `tests/edge/handlers/marketplace/{add,remove,update}.test.ts`.
- **Verification:** `node --test` -- all marketplace tests pass.
- **Committed in:** `6a8accd` (Task 1).

**5. [Rule 3 - Blocking] Prettier reformat of two files**

- **Found during:** Task 1 + Task 2 verification.
- **Issue:** Prettier wanted to reformat `edge/handlers/plugin/list.ts`, `edge/handlers/tools.ts`, `tests/edge/handlers/marketplace/add.test.ts`, `tests/edge/handlers/tools.test.ts`. Same idiomatic reformatting pattern Plan 06-02 hit (line-length folding, optional-parens around long ternaries).
- **Fix:** `npx prettier --write` on the four files. No semantic change.
- **Verification:** `npx prettier --check` -- all matched files clean.
- **Committed in:** `6a8accd` + `d5d00c3` (in the same commits as the originals).

**6. [Rule 1 - Bug] Removed unused `notifications` and async function lint warnings**

- **Found during:** Task 1 ESLint pass.
- **Issue:** `add.test.ts` test "deps.gitOps is passed through" destructured `notifications` but never read it. `add.test.ts` + `update.test.ts` had `async (plugin, _marketplace, _scope) => {...}` no-op `pluginUpdate` factories that tripped `@typescript-eslint/no-unused-vars` (on `_marketplace`, `_scope`) and `@typescript-eslint/require-await` (no `await` in the body).
- **Fix:** Removed `notifications` destructure where unused. Rewrote `pluginUpdate` factories to take only `plugin` and return `Promise.resolve({ partition: "unchanged", name: plugin })` -- equivalent semantics, cleaner type.
- **Files affected:** `tests/edge/handlers/marketplace/add.test.ts`, `tests/edge/handlers/marketplace/update.test.ts`, `tests/edge/handlers/marketplace/remove.test.ts`.
- **Verification:** ESLint clean.
- **Committed in:** `6a8accd` (Task 1).

---

**Total deviations:** 6 (1 Rule 1 - bug, 4 Rule 3 - blocking, 1 Rule 1 - bug). All deviations are mechanical / scoped; the spirit of the plan's intent (thin shim + delegate to orchestrator + zero direct notify in edge) is preserved exactly.

## Issues Encountered

- **Plan's `<verify>` automation snippet had an embedded shell-quoting bug:** the inline `find ... -print0 | xargs -0 grep -nE` command nested inside a `node -e` heredoc string was infeasible to escape correctly under all shell tokenization rules. We instead executed the equivalent comment-stripping grep in a clean `node -e` invocation that walks the directory tree and strips block + line comments before testing. Result identical; tooling-only.
- **`@ts-expect-error` removal mechanics:** Wave-0 stubs have a `// @ts-expect-error` directive on the type-only import line. When the production module lands, the directive becomes "unused" and TS6133 fires. Mechanical fix: remove the directive AND the type-only import + `export type _TargetShape` lines in one go when unskipping the file. Done for all 10 unskipped test files in this plan.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - no new threat surface introduced beyond the plan's `<threat_model>`. The added orchestrator helpers (`loadVisibleMarketplaces`, `loadPluginListPayload`) are read-only and consume the same state.json / marketplace.json loaders the existing orchestrators already used. The two LLM tool surfaces are read-only per D-02 corollary (no mutating LLM tools shipped in Phase 6).

## Next Phase / Plan Readiness

- **Plan 06-05 (register wiring):** Consumes the 9 handler factories + 2 LLM-tool registration functions to build the `SubcommandHandlers` map and call `pi.registerTool` for the LLM surface. The shim factories are pure (no `pi.*` calls inside); `register.ts` is the only file that bridges to `pi.registerCommand` / `pi.registerTool`.
- **Plan 06-03 (completions provider + cache):** Parallel-buildable; depends only on Plan 06-02 outputs. The completion data path is independent of the handler shims landed here.

## Self-Check: PASSED

All 10 created handler files verified present:

- extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts -- FOUND
- extensions/pi-claude-marketplace/edge/handlers/tools.ts -- FOUND

Both task commits verified in git log:

- 6a8accd (Task 1: 9 thin-shim handlers + unskip shim tests) -- FOUND
- d5d00c3 (Task 2: 2 LLM tools + tools tests) -- FOUND

Discipline gates:

- BLOCK A (notify-discipline, comment-stripped): 0 hits on 10 handler files -- PASS
- BLOCK C (import-boundary, comment-stripped): 0 hits on 10 handler files -- PASS

`npm run check` exit code: 0 (typecheck + ESLint + Prettier + node:test all green: 794 tests, 732 pass, 62 skip, 0 fail).

---
*Phase: 06-edge-layer-tab-completion*
*Plan: 04-handlers-and-llm-tools*
*Completed: 2026-05-11*

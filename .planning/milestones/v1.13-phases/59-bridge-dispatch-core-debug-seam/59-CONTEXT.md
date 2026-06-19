# Phase 59: Bridge Dispatch Core & Debug Seam - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 59 wires the runtime dispatch layer on top of Phases 57-58's
foundations. Five REQs (DISP-01..04, OBS-01) land:

1. **`pi.on(...)` registration (DISP-01).** The bridge calls
   `pi.on(piEventName, compositeHandler)` exactly once per supported Pi
   event type at extension-factory time. Routing state is read from a new
   `shared/event-router.ts` module.
2. **Sub-millisecond routing-table rebuild (DISP-02).**
   `rebuildRoutingTables(state, loc)` clears and rebuilds the routing
   tables synchronously after each scope's apply pass in
   `orchestrators/reconcile/apply.ts`. No disk I/O on the rebuild path —
   rebuild walks `state.installations` and reads from a bridge-owned
   in-memory parsed-config cache.
3. **Zombie-dispatch defense via epoch (DISP-03).** A module-level
   `liveEpoch` cell at `shared/event-router.ts` is bumped on each
   `registerHooksBridge(pi)` factory call. Composite handlers capture the
   current epoch at registration; a stale handler from a prior `/reload`
   compares its captured value against the current `liveEpoch` and
   no-ops on mismatch (NFR-2 `/reload` always suffices).
4. **Deterministic dispatch order (DISP-04).** Within one composite-handler
   invocation, entries dispatch via `compareByNameThenScope` (project-first,
   alphabetical) across plugins; within a single plugin's `hooks.json`,
   declaration order; sequential awaited fan-out (no `Promise.all`).
5. **Single debug-output seam (OBS-01).** A new `shared/debug-log.ts`
   replaces Phase 57's local `hookDebugLog` stub. Gated on
   `PI_CLAUDE_MARKETPLACE_DEBUG=1`. No `console.error`,
   `process.stderr.write`, or `ctx.ui.notify` calls in the dispatch path.

Phase 59 does NOT touch hook child-process execution (Phase 60), payload
translators (Phase 60), env vars (Phase 60), `if`-field filtering
(Phase 61), `asyncRewake` (Phase 62), lifecycle cascade (Phase 63),
`info <plugin>` rendering (Phase 63), or docs (Phase 63). The actual
hook EXECUTION layer is reached via a `dispatchHookExec(entry, event,
ctx)` stub that Phase 59 ships as a no-op; Phase 60 replaces the stub
body.

</domain>

<decisions>
## Implementation Decisions

### Pi → Claude event routing fan-out (DISP-01)

- **D-59-01 (7 Pi listeners, 8 Claude routes, `tool_result` isError
  split):** The bridge registers `pi.on(...)` for **7 distinct Pi event
  types** at factory time. The routing table is keyed by Claude event
  name (8 keys). The `tool_result` composite handler is the only one
  that fans out to two Claude-event routing buckets — it reads
  `event.isError` once at the top, then dispatches to the PostToolUse
  bucket (falsy/absent) or the PostToolUseFailure bucket (truthy). All
  other 6 Pi → Claude mappings are 1:1.

  Locked routing table:

  | Pi event | Claude event(s) | Per-event filter at registration time |
  | --- | --- | --- |
  | `session_start` | SessionStart | source ∈ {startup, resume, clear, compact} from D-58-06 matcher table |
  | `session_shutdown` | SessionEnd | reason ∈ {clear, resume, logout, prompt_input_exit, bypass_permissions_disabled, other} |
  | `session_before_compact` | PreCompact | trigger ∈ {manual, auto} |
  | `session_compact` | PostCompact | trigger ∈ {manual, auto} |
  | `input` | UserPromptSubmit | no matcher (TOOL-02 rejects any non-empty matcher per D-58-06) |
  | `tool_call` | PreToolUse | tool-name matcher (Phase 58's Pi-form `Set<string>` or MATCH_ALL sentinel) |
  | `tool_result` | **PostToolUse** + **PostToolUseFailure** | split on `event.isError` inside the composite handler; each branch reads its own routing bucket |

  Rationale: DISP-01's "exactly once per supported Pi event type" wording
  forbids two separate `pi.on("tool_result", ...)` registrations — even
  though Pi's runtime supports handler chaining, the bridge's contract
  is single-listener-per-event. The `event.isError` split inside one
  composite handler is functionally equivalent and keeps the table-build
  side keyed by Claude event names (8 buckets, not 7), which preserves
  per-Claude-event ordering and matcher application without per-dispatch
  re-derivation.

### Routing-table data source & rebuild

- **D-59-02 (bridge-owned parsed-config cache, hydrated at factory time,
  kept live by install/uninstall):** `rebuildRoutingTables(state, loc)`
  reads from an in-memory `Map<{scope, pluginId}, ParsedHooksConfig>`
  owned by `shared/event-router.ts`. The cache is populated at three
  moments:

  1. **Factory time hydration** — `registerHooksBridge(pi)` walks
     `state.installations` once on extension load, reads each installed
     plugin's `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json`
     from disk, and calls `parseHooksConfig` (Phase 58 leaf) to populate
     the cache. One-time cost per `/reload` (since Pi re-runs the
     factory on reload); aligns with the cache lifetime.
  2. **`installPlugin` cache-insert** — after the per-plugin lock's stage
     phase commits, the bridge adds the plugin's parsed hooks config to
     the cache. Same data flow as the existing v1.4 cascade slots.
  3. **`uninstallPlugin` cache-remove** — drops the entry before the
     reconcile rebuild runs.

  `rebuildRoutingTables` is then sub-millisecond: it walks
  `state.installations` for plugins whose `resources.hooks` is non-empty,
  looks up the parsed config in the cache, and assembles the per-Claude-
  event routing buckets via `compareByNameThenScope`. Zero disk reads on
  the rebuild path (DISP-02).

  Rationale: DISP-02's sub-ms constraint rules out disk I/O at rebuild
  time. Factory-time hydration covers the cold-load case; install/
  uninstall handles incremental changes. The cache survives across the
  factory's lifetime but resets on every `/reload` (factory re-runs).
  NFR-3 idempotency holds — cache state is fully derivable from
  state.json + on-disk hooks.json contents.

### liveEpoch lifecycle (DISP-03)

- **D-59-03 (bump at factory entry):** `shared/event-router.ts` declares
  `let liveEpoch = 0` at module top; `registerHooksBridge(pi)`
  increments at function entry (`liveEpoch += 1`). Each `/reload`
  re-runs the factory, so each load gets a fresh epoch. New composite
  handlers registered this load capture the current value via closure;
  old handlers from prior loads still hold their old captured value,
  compare against the current `liveEpoch` at dispatch time, mismatch,
  no-op.

  Single "bridge load" moment unifies cache hydration (D-59-02) and
  epoch bump — both happen at `registerHooksBridge` entry.

  Rationale: module top-level bump fires only once per Node process
  (Node caches modules across factory re-calls), so it does not defend
  against `/reload` zombies. Factory-entry bump is the natural
  per-`/reload` hook. The "module-level cell" wording in REQ DISP-03 is
  preserved: the cell is module-scoped; only the mutation site moves
  from top-level to factory entry.

### Composite handler / Phase 60 exec boundary

- **D-59-04 (stub `dispatchHookExec`, Phase 59 owns only ordering +
  epoch + table):** The composite handler shape Phase 59 ships:

  ```ts
  async function compositeHandler(event, ctx) {
    if (capturedEpoch !== liveEpoch) return;        // DISP-03
    const bucket = routingTable.get(claudeEventName);
    if (!bucket) return;
    for (const entry of bucket) {                    // DISP-04 order
      if (!matcherFires(entry, event)) continue;
      await dispatchHookExec(entry, event, ctx);     // Phase 60 fills
    }
  }
  ```

  `dispatchHookExec(entry, event, ctx)` is exported from
  `bridges/hooks/dispatch.ts` (or sibling — planner picks) as a no-op
  stub that returns `void` (or a sentinel). Phase 60 replaces the body
  with real `child_process.spawn` + payload translation + result
  aggregation (block / mutate event in place). Phase 59's composite
  handlers do NOT change signatures when Phase 60 lands — only the
  stub's body changes.

  Phase 59's architecture tests verify: (a) `pi.on(...)` registered
  exactly 7 times at factory time; (b) routing table contains expected
  Claude-event buckets after rebuild; (c) order = `compareByNameThenScope`
  cross-plugin + declaration order within plugin; (d) epoch mismatch
  no-ops without invoking `dispatchHookExec`; (e) `tool_result`
  composite handler reads `event.isError` and dispatches to the right
  bucket.

  Rationale: minimal Phase 59 surface = minimal Phase 60 risk of
  regressing Phase 59 contracts. The user's strict separation between
  dispatch and execution maps cleanly to one-stub-replacement. Phase
  59's tests do NOT exercise hook semantics (block, mutate); Phase 60
  owns those tests.

### OBS-01 debug-log seam migration

- **D-59-05 (migrate `hookDebugLog` from Phase 57 local stub to
  `shared/debug-log.ts`):** Phase 59 introduces
  `extensions/pi-claude-marketplace/shared/debug-log.ts` as the
  canonical seam (gated on `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`;
  `console.error` sink with per-file ESLint override). The Phase 57
  local stub at `domain/components/hooks.ts` is removed; existing
  callers (`probeHooksConfig` parse-error logger, Phase 58's TOOL-02
  detail logger) re-import from `shared/debug-log.ts`. Single
  source-of-truth matches OBS-01's wording.

  No behavior change — Phase 57's stub already implemented the
  env-gated console.error pattern; Phase 59 just moves the file and
  updates imports. The per-file ESLint console override moves with it.

### Claude's Discretion

- **`shared/event-router.ts` internal API shape.** REQ names the module
  and the function (`rebuildRoutingTables(state, loc)`). The exact
  public surface (e.g., separate `getRouting(claudeEvent)` reader,
  `addPluginToCache` / `removePluginFromCache` for install/uninstall
  callbacks, `currentEpoch()` reader for handler closures) is planner
  discretion. Recommended shape: a small module-state holder exposing
  `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`,
  `removePluginConfigFromCache`, and a `compositeHandlerFor(claudeEvent,
  capturedEpoch)` factory used at registration time.
- **Composite handler file placement.** Either
  `bridges/hooks/dispatch.ts` (named for the dispatch role) or
  `bridges/hooks/index.ts` (mirroring `bridges/{agents,commands,
  mcp,skills}/index.ts`). Mirror the existing bridges convention if
  the file size stays small; split into a `dispatch.ts` sibling if the
  composite handler + ordering helpers exceed ~150 lines.
- **`dispatchHookExec` stub location and signature.**
  `bridges/hooks/dispatch-exec.ts` (NEW) is the most natural placement
  — Phase 59 ships the no-op; Phase 60 fills the body in the same
  file. Signature: planner picks between `Promise<void>` (Phase 59) and
  `Promise<HookExecResult>` (Phase 60-ready shape with optional block /
  updatedInput / updatedToolOutput fields). The user picked the
  `Promise<void>` stub path (D-59-04) so Phase 60 owns the return type
  expansion in lockstep with the spawn impl.
- **Cache invalidation on `reinstall` / `update` orchestrators.**
  Phase 59's cache lives at `shared/event-router.ts` and is updated by
  install/uninstall. Reinstall and update are conceptually
  uninstall-then-install; the planner verifies they go through the
  same cache add/remove seams or wires explicit invalidation. The 4
  bridges/commands/skills/agents/mcp baseline doesn't have a cache —
  Phase 59's cache is hooks-specific, so the audit is narrow.
- **Architecture-test source-of-truth shape.** Follow Phase 57 P04 /
  Phase 58 P04 patterns. Specifically: a `pi.on` call-count fixture
  asserting exactly 7 registrations at factory time; a routing-table
  shape fixture asserting the 8 Claude-event buckets; an epoch-mismatch
  test that registers a handler, bumps the epoch, dispatches, asserts
  `dispatchHookExec` not called.
- **Cache eviction edge cases.** Per-plugin lock + atomic state.json
  write means race conditions are bounded by the existing v1.7
  transaction model. Planner verifies the cache add/remove sits
  inside the per-plugin lock so a concurrent `apply` rebuild observes
  consistent state. The existing `withStateGuard` seam is the safe
  inner boundary.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — DISP-01, DISP-02, DISP-03, DISP-04,
  OBS-01 (Phase 59 closure list).
- `.planning/ROADMAP.md` § "Phase 59" — goal + 5 success criteria;
  dependency on Phase 58 (dispatch reads parser output).
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook
  Bridge" — locked scope (bucket-A only); strict-supportability stance.

### Prior phase decisions (Phases 57-58 — foundations)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md`
  — D-57-01 (no `schemaVersion` bump; additive `resources.hooks:
  string[]`), D-57-02 (lenient top-level `Type.Record(...)`), D-57-03
  (`generatedName`-based persistence — runtime derives paths from
  `<scopeRoot>`), D-57-04 (parse failure → `installable: false` with
  `{unsupported hooks}` reason). Phase 59's factory-time cache hydrate
  walks `state.installations` per D-57-03 (runtime path derivation).
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md`
  — D-58-01 (atomic byte-form rename of `{hooks}` → `{unsupported
  hooks}`), D-58-03 (single-seam discriminated parser result),
  D-58-04 (TOOL-01 location at `domain/components/hook-tool-names.ts`),
  D-58-05 (`find ↔ Glob` mapping with LOW-confidence flag), D-58-06
  (per-non-tool-event closed-set source/reason/trigger maps with
  Pi-payload field translation at registration time — Phase 59
  consumes for filter-at-registration). Matcher parser output is
  Pi-form `Set<string>` or `MATCH_ALL` sentinel; Phase 59 reads
  directly without runtime Claude ↔ Pi translation.

### v1.13 research (advisory; scope-mismatch caveat applies)

- `.planning/research/SUMMARY.md` — § Convergences (epoch-based zombie
  defense, deterministic ordering); § Architecture build order. Note
  scope-mismatch caveat: bucket-B / D / soft-dep references are v1.14+.
- `.planning/research/ARCHITECTURE.md` § 6.0 "Build order" — dispatch
  layer sits between matcher parser and exec; Phase 59 lands the
  "register + table + dispatch" slice with exec stubbed.
- `.planning/research/PITFALLS.md` § Pitfall 1 (zombie handlers from
  prior loads — direct DISP-03 driver); § Pitfall 6 (re-registration
  on every reload without epoch); § Pitfall 11 (rebuild ordering
  affecting first-fires). Phase 59's epoch + sequential awaited
  fan-out mitigate.

### Authority sources (cross-reference at planning time)

- `docs/research/claude-hooks-vs-pi-events.md` § "Bucket A 1:1 mapping
  table" — exact Pi event names per bucket-A Claude event;
  `tool_result` `isError` split (lines 130-131) is the authoritative
  source for D-59-01's PostToolUse / PostToolUseFailure dispatch
  bucket key. § "Ordering" (lines 553+) — declared-order semantics
  per Claude Code's contract, which D-59-04 inherits.
- `docs/research/claude-hook-config-syntax.md` § "Matcher target
  field per event type" — definitive per-event matcher field
  semantics; Phase 59's per-Claude-event filter-at-registration
  reads this for the 5 non-tool events.

### Codebase landing sites (Phase 59 introduces)

- `extensions/pi-claude-marketplace/shared/event-router.ts` (NEW) —
  module-state holder: `liveEpoch` cell (D-59-03), parsed-config cache
  Map (D-59-02), `registerHooksBridge(pi)`, `rebuildRoutingTables(state,
  loc)`, `addPluginConfigToCache(scope, pluginId, parsed)`,
  `removePluginConfigFromCache(scope, pluginId)`,
  `compositeHandlerFor(claudeEvent, capturedEpoch)`.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` (NEW) —
  bridge entry point mirroring `bridges/{agents,commands,mcp,skills}/
  index.ts`. Exports the registration helper consumed by `index.ts`.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` (NEW,
  Claude's Discretion file split) — composite handler factory + the 7
  per-Pi-event handler bodies. Imports `dispatchHookExec` from sibling.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`
  (NEW) — `dispatchHookExec(entry, event, ctx)` no-op stub (D-59-04).
  Phase 60 fills the body.
- `extensions/pi-claude-marketplace/shared/debug-log.ts` (NEW) —
  canonical OBS-01 seam (D-59-05). Replaces Phase 57's local stub at
  `domain/components/hooks.ts`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
  — adds `rebuildRoutingTables(state, loc)` call after each scope's
  apply pass (DISP-02). Single new call site; no change to the
  outer reconcile contract.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` —
  adds `addPluginConfigToCache(scope, pluginId, parsed)` call inside
  the per-plugin lock's stage commit (D-59-02 cache lifecycle).
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
  — adds `removePluginConfigFromCache(scope, pluginId)` call inside
  the per-plugin lock (D-59-02 cache lifecycle).
- `extensions/pi-claude-marketplace/orchestrators/plugin/{reinstall,
  update}.ts` — verify cache add/remove sits inside the existing
  uninstall-then-install paths (Claude's Discretion audit).
- `extensions/pi-claude-marketplace/index.ts` — invokes
  `registerHooksBridge(pi, deps)` alongside the existing
  `registerCommandsBridge` / `registerAgentsBridge` / etc. calls at
  extension factory time.
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` — Phase
  57's local `hookDebugLog` stub deleted; existing callers re-import
  from `shared/debug-log.ts` (D-59-05).

### Architecture tests (Phase 59 adds)

- `tests/architecture/hooks-dispatch.test.ts` (NEW) — pin DISP-01..04
  + OBS-01 invariants: 7-Pi-listener count, 8-Claude-event-bucket
  routing table, `compareByNameThenScope` ordering, epoch mismatch
  no-ops, `event.isError` split inside `tool_result` composite handler.
  Pattern mirrors Phase 57's `hooks-foundation.test.ts` and Phase 58's
  TOOL-02 closed-set tests.
- `tests/architecture/notify-types.test.ts` — REASONS tuple unchanged
  (rename happened in Phase 58). Phase 59 binds zero new notify
  emissions.

### Peer dep — Pi event surface

- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  — confirmed Pi event names: `session_start`, `session_shutdown`,
  `session_before_compact`, `session_compact`, `input`, `tool_call`,
  `tool_result`. Each `pi.on(...)` registration has a typed
  `ExtensionHandler<EventType, EventResult?>` signature; Phase 59's
  composite handler matches.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`compareByNameThenScope`** (`shared/notify.ts`) — Phase 59's
  routing-table sort key. Already imported by reconcile/preview,
  reinstall, update, reconcile/apply, reconcile/notify. No new
  comparator needed.
- **`withLockedStateTransaction` / per-plugin lock** (`transaction/
  with-state-guard.ts`) — Phase 59's cache add/remove sits inside the
  existing per-plugin lock; concurrent rebuilds observe consistent
  cache state. No new locking primitives.
- **`parseHooksConfig`** (`domain/components/hooks.ts` — Phase 57
  baseline, Phase 58 extension) — Phase 59 calls at factory-time
  hydrate and at install-time cache populate. Discriminated result
  shape (D-57-04 / D-58-03) handles parse failure cleanly.
- **`hookDebugLog`** stub (`domain/components/hooks.ts` — Phase 57) —
  migrates to `shared/debug-log.ts` (D-59-05). Existing per-file
  ESLint override moves with it.
- **`SUPPORTED_COMPONENT_KINDS`** (`domain/resolver.ts:126`) — Phase
  57's `"hooks"` admission is unchanged; Phase 59 reads
  `resources.hooks` from state without touching the kinds list.
- **`locations.hooksDir`** (Phase 57 extension to `persistence/
  locations.ts`) — Phase 59's factory-time hydrate uses this to
  construct `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json`
  read paths.
- **Existing bridge pattern** (`bridges/{agents,commands,mcp,skills}/
  index.ts`) — Phase 59's `bridges/hooks/index.ts` mirrors. The four
  existing bridges are state-light; Phase 59's hooks bridge owns
  module state (cache + epoch) — the first bridge with non-trivial
  in-memory state.

### Established Patterns

- **Single notify emission per orchestrator invocation** (RECON-04 /
  IL-2) — Phase 59 binds ZERO new notify emissions. Dispatch is
  user-invisible at runtime (OBS-01 / IL-2); install-time hook errors
  continue to flow through Phase 57/58/63's existing notify paths.
- **Discriminated `installable: true | false` with `assertNever`
  exhaustiveness** (NFR-7) — Phase 59 reads
  `state.installations[scope][id]` and only loads parsed configs for
  installable plugins; the discriminator stays intact.
- **NFR-2 `/reload` always suffices** — Phase 59's epoch defense
  (D-59-03) is the load-bearing mechanism. Factory re-runs on reload;
  cache rehydrates from state.json + disk; new handlers capture new
  epoch; old handlers no-op via stale epoch.
- **NFR-3 idempotent / fail-clean** — Phase 59's cache is fully
  derivable from state.json + hooks.json files on disk. A crash
  mid-rebuild leaves no inconsistent state; next `/reload` rehydrates.
- **Architecture-test source-of-truth gates** (Phase 57 P04 / Phase 58
  P04 patterns) — Phase 59's `tests/architecture/hooks-dispatch.test.ts`
  follows the same closed-set introspection + fixture pattern. No new
  test infrastructure.

### Integration Points

- `index.ts` — extension factory adds `registerHooksBridge(pi, deps)`
  call alongside existing bridge registrations.
- `orchestrators/reconcile/apply.ts` — adds single
  `rebuildRoutingTables(state, loc)` call after each scope's apply
  pass.
- `orchestrators/plugin/install.ts` — adds
  `addPluginConfigToCache(scope, pluginId, parsed)` call inside the
  per-plugin lock's stage commit.
- `orchestrators/plugin/uninstall.ts` — adds
  `removePluginConfigFromCache(scope, pluginId)` call inside the
  per-plugin lock.
- `orchestrators/plugin/{reinstall, update}.ts` — audit pass: confirm
  cache add/remove flows through the existing uninstall-then-install
  paths (Claude's Discretion).
- `domain/components/hooks.ts` — Phase 57's local `hookDebugLog` stub
  removed; callers re-import from `shared/debug-log.ts`.
- Phase 59 does NOT touch `bridges/{agents,commands,mcp,skills}/`,
  `orchestrators/marketplace/*.ts`, `orchestrators/import/*.ts`,
  `shared/notify.ts`, `shared/path-safety.ts`, the catalog
  (`docs/output-catalog.md`), or the persistence schema layer.

</code_context>

<specifics>
## Specific Ideas

- The user locked the 7-Pi-listener / 8-Claude-route fan-out with
  `tool_result` splitting on `event.isError` inside one composite
  handler (D-59-01). The "single composite handler per Pi event type"
  invariant from DISP-01 is preserved without sacrificing per-Claude-
  event ordering.
- The user picked the bridge-owned cache approach (D-59-02) over
  re-parsing from disk on rebuild. Sub-ms DISP-02 constraint is the
  load-bearing reason; the cache lives in `shared/event-router.ts`
  alongside `liveEpoch`.
- The user picked factory-time cache hydration over lazy populate or
  applyReconcile-driven populate. Predictable one-time `/reload` cost
  beats dispatch-time latency surprise (D-59-02).
- The user unified the "bridge load" moment for both cache hydration
  AND `liveEpoch` bump at `registerHooksBridge` entry (D-59-03). The
  REQ wording "module-level cell" is preserved; only the mutation site
  moved from top-level to factory entry.
- The user picked the minimal Phase 59 surface (D-59-04) — stub
  `dispatchHookExec`, composite handlers own only ordering + epoch +
  table; Phase 60 fills the stub body without changing Phase 59
  signatures. Phase 59's tests do NOT exercise hook execution
  semantics (block, mutate); Phase 60 owns those.
- The user picked migrating the OBS-01 debug-log seam to
  `shared/debug-log.ts` (D-59-05) over keeping a thin re-export from
  Phase 57's local stub. Single source-of-truth matches OBS-01 wording.

</specifics>

<deferred>
## Deferred Ideas

- **Hook EXECUTION (spawn child_process)** — Phase 60 EXEC-01..04.
  Phase 59 ships the `dispatchHookExec` stub as a no-op; Phase 60
  fills the body with `node:child_process.spawn` + payload translation
  + env-vars (HOOK-05) + timeout/grace/SIGKILL (EXEC-02).
- **PAYL-01 payload translators** — Phase 60. The 8 bucket-A events
  each get a `bridges/hooks/payloads/<event>.ts` translator; PreToolUse
  / PostToolUse / PostToolUseFailure additionally translate Pi
  `event.toolName` → Claude `tool_name` via the Phase 58 TOOL-01 table.
- **`if`-field permission-rule matcher (MATCH-03)** — Phase 61. The
  `if` filter sits between dispatch (Phase 59) and exec (Phase 60).
  Phase 59's composite handler does NOT consult `if` — Phase 61
  inserts the `if` check between Phase 59's matcher fire and Phase
  60's exec invocation.
- **`asyncRewake` registry (HOOK-06 / EXEC-05)** — Phase 62. The
  registry lives at `bridges/hooks/async-rewake/registry.ts` and
  hooks into Phase 60's exec path; Phase 59's dispatch is unaffected.
- **SURF-01 `info <plugin>` hooks-line rendering** — Phase 63. Reads
  raw `hooks.json` separately from the dispatch path; no shared
  data flow with Phase 59's cache.
- **LIFE-01 5th cascade slot** — Phase 63. The reconcile cascade gains
  a "hooks bridge" slot (plan/stage/unstage/discover mirroring the
  existing 4). Phase 59's `rebuildRoutingTables` runs INSIDE
  `applyReconcile`'s per-scope apply pass; Phase 63 wires the
  user-visible cascade row.
- **D-59-04 return-type expansion** — Phase 60. The `dispatchHookExec`
  signature evolves from `Promise<void>` (Phase 59 stub) to
  `Promise<HookExecResult>` (Phase 60 — block / updatedInput /
  updatedToolOutput shape). Phase 59's composite handlers don't read
  the return value; Phase 60 adds the result-reducer logic to the
  composite handler body in lockstep with the signature change.
- **Routing-table architecture-test invariant scope** — keep the
  Phase 59 invariants narrow (count, ordering, epoch, isError split).
  Phase 60-62 add their own invariants without churning Phase 59's
  test file.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — v1.12 orchestrator-coverage backlog (uncovered failure arms in
  `orchestrators/plugin/{update,reinstall,install}.ts` +
  `orchestrators/marketplace/update.ts` + `orchestrators/edge-deps.ts`),
  unrelated to v1.13 hooks-dispatch scope. Kept in the pending todo
  pile (same disposition as Phases 57-58).

</deferred>

---

*Phase: 59-Bridge Dispatch Core & Debug Seam*
*Context gathered: 2026-06-14*

# Architecture Research

**Domain:** Brownfield bridge layer — Claude plugin hooks → Pi extension event bus, integrated into the v1.12 declarative config + load-time reconcile architecture of `pi-claude-marketplace`.
**Researched:** 2026-06-13
**Confidence:** HIGH (every integration point cites a real file under `extensions/pi-claude-marketplace/`; Pi-host event surface verified against the locally-installed `@earendil-works/pi-coding-agent` peer dep)

> Subsequent-milestone integration study. Pressure-tests the locked v1.13 hook-bridge design from `<milestone_context>`, surfaces integration gaps, and produces concrete code seams the roadmapper can lift directly into phase boundaries. Web ecosystem research is not applicable; the only authorities are this repo's source, the v1.12 ARCHITECTURE.md template, and `docs/research/claude-hooks-vs-pi-events.md`.

---

## 1. Standard Architecture

### Existing layering (confirmed in source, unchanged by v1.13)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ index.ts          extension entry: pi.on("resources_discover") -> reconcile, │
│                   then aggregateDiscoveredResources;                          │
│                   registerClaudePluginCommand, registerClaudeMarketplaceTools │
├──────────────────────────────────────────────────────────────────────────────┤
│ edge/             register.ts (slash-command + session_start TC-7 wrapper)    │
│                   router.ts, handlers/{plugin,marketplace}, completions, args │
├──────────────────────────────────────────────────────────────────────────────┤
│ orchestrators/    marketplace/{add,remove,autoupdate,update,info,list}        │
│                   plugin/{install,uninstall,update,reinstall,info,list,       │
│                           enable-disable,bootstrap,discover-names}            │
│                   import/{marketplaces(planner),execute,settings,refs}        │
│                   reconcile/{plan,apply,pending,notify,apply-outcomes,types}  │
│                   discover.ts (resources_discover aggregator)                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ bridges/          skills | commands | agents | mcp  (stage/unstage)           │
│ domain/           resolver (NFR-7 discriminated union), source, manifest,     │
│                   version, name, components/{plugin,mcp}                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ transaction/      withStateGuard, withLockedStateTransaction (per-scope       │
│                   proper-lockfile, retries:0), runPhases (ledger), rollback   │
├──────────────────────────────────────────────────────────────────────────────┤
│ persistence/      state-io.ts (STATE_SCHEMA, JIT validator, atomic write),    │
│                   config-io.ts (CONFIG_SCHEMA), config-merge.ts,              │
│                   migrate.ts, migrate-config.ts, config-write-back.ts,        │
│                   agents-index-{io,schema}.ts, locations.ts (branded paths)   │
│ platform/         pi-api, git, git-credential                                 │
│ shared/           notify.ts (closed-set output catalog), atomic-json,         │
│                   path-safety, errors                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### What v1.13 adds (new components in **bold**, modified in *italics*)

```
                        ┌────────────────────────────────────────────────┐
  index.ts ──► pi.on("resources_discover") ──► applyReconcile (unchanged)
       │                                       │
       │                                       └─► ALSO rebuilds bridge
       │                                            routing tables (NEW)
       │
       └──► **bridge/install(pi)** (NEW, runs ONCE at extension factory time
             before resources_discover handler returns the first time):
              registers one composite pi.on(...) per supported Pi event type,
              plus pi.events.on(...) for soft-dep buses. Handlers are
              installed exactly once; routing tables are mutable.

  bridges/hooks/    NEW component bridge (parallel to skills/commands/agents/mcp)
                    plan.ts        – pure: hooks.json -> stage plan
                    stage.ts       – atomic copy of hooks.json under
                                     <extensionRoot>/hooks/<plugin>/hooks.json
                    unstage.ts     – rm -rf the per-plugin hooks subtree
                    discover.ts    – plugin -> resolved hook config (parser)
                    matcher.ts     – literal + pipe-OR compile -> Set<string>
                    payloads/      – per-event field translators (bucket A/B/D)
                    dispatch.ts    – composite handler + routing tables
                    spawn.ts       – child-process exec + stdout-JSON parser

  hooks/            **NEW domain primitive** under domain/components/hooks.ts
                    typebox schema for one hooks.json entry (event, matcher,
                    hooks[], plus tolerated extension fields)

  *persistence/state-io.ts*  STATE_SCHEMA bumps schemaVersion 1 -> 2; PLUGIN
                             record gains `resources.hooks: readonly Routing[]`
                             (replaces a per-event Map, see §5.2).

  *domain/resolver.ts*       Walks <pluginRoot>/hooks/hooks.json as a new
                             standalone-file component (the array already
                             lists it as `hooks` -> "hooks/hooks.json"; today
                             it's in the unsupported set; v1.13 moves it to
                             supported).

  *orchestrators/plugin/{install,uninstall,update,reinstall}.ts*
                             Add the hooks bridge to the 4-bridge cascade
                             ordering. Hooks stage AFTER mcp, before state
                             commit (PI-9 extended).

  *orchestrators/reconcile/apply.ts*
                             After per-scope install/uninstall settles, call
                             bridge.rebuildRoutingTables(state) so dispatch
                             reflects the new desired set on /reload.

  *info.ts / list.ts*        New `hooks` component appears in components-list
                             rendering. New per-row marker {requires <dep>}
                             when a hook event soft-deps on pi-subagents.

  *shared/notify.ts*         Possible new closed-set token if hook-install
                             warnings (asyncRewake-extension surface) are
                             rendered as a distinct reason. See §6.3.

  shared/event-router.ts     **NEW** event-id -> Set<RoutingEntry> mutable
                             table; the composite handler reads from here.
```

---

## 2. Component Responsibilities

| Component                                       | New / Modified | Responsibility                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/components/hooks.ts`                    | **NEW**        | TypeBox schema for one hooks.json entry; forward-compatible parser that preserves unknown payload-extension fields. Output is a discriminated `ParsedHookEntry`; bucket-H events parse cleanly but are tagged `bucket: "H"` so the stage step can drop them.              |
| `bridges/hooks/plan.ts`                         | **NEW**        | Pure: takes a resolved plugin's `hooks/hooks.json` content, returns a `HookStagePlan` (entries to stage + entries dropped with reason). No I/O. Mirrors `bridges/agents/plan.ts` shape.                                                                                  |
| `bridges/hooks/stage.ts`                        | **NEW**        | Atomic copy of `hooks.json` to `<extensionRoot>/hooks/<plugin>/hooks.json` via `atomicWriteJson` after `assertPathInside(<extensionRoot>/hooks/, ...)`. Returns a `Routing[]` for state.                                                                                  |
| `bridges/hooks/unstage.ts`                      | **NEW**        | `rm -rf <extensionRoot>/hooks/<plugin>/` after path-containment check. Idempotent.                                                                                                                                                                                       |
| `bridges/hooks/discover.ts`                     | **NEW**        | Reads the staged hooks.json for a plugin and surfaces its event list for `info.ts`/`list.ts`.                                                                                                                                                                            |
| `bridges/hooks/matcher.ts`                      | **NEW**        | Compile-time: turns `"Edit|Write|MultiEdit"` into `Set<string>` and `"*"`/empty into `MATCH_ALL`. No regex engine.                                                                                                                                                       |
| `bridges/hooks/payloads/<event>.ts`             | **NEW** (~16)  | One file per supported Claude event; each exports `translate(piEvent) -> ClaudeHookPayload` and `applyResponse(claudeResp) -> PiEventResult`. Bucket A is mostly field renaming; bucket D files own the synthesis comments per `docs/research/...md`.                  |
| `bridges/hooks/dispatch.ts`                     | **NEW**        | The composite `pi.on(piEventName, handler)` callbacks + the routing-table lookups. Installed exactly once per Pi event type at extension factory time. Reads from `shared/event-router.ts`.                                                                              |
| `bridges/hooks/spawn.ts`                        | **NEW**        | Child-process exec of the hook command with the staged hooks-dir as CWD; stdout-JSON parsed with the same forward-tolerant schema as the entry parser; timeout + nonzero-exit-treated-as-block per Claude spec.                                                          |
| `shared/event-router.ts`                        | **NEW**        | Module-singleton `Map<PiEventName, Map<RoutingKey, RoutingEntry[]>>`. Mutable: cleared + rebuilt by `applyReconcile` on every `/reload`. The composite handler holds no closure-captured routing state; reads from the module every dispatch.                            |
| `bridges/hooks/lifecycle.ts`                    | **NEW**        | Two exports: `installComposites(pi)` (call ONCE at factory) and `rebuildRoutingTables(state, locations)` (call from `applyReconcile` after each scope's reconcile completes).                                                                                            |
| `persistence/state-io.ts`                       | *MODIFIED*     | `STATE_SCHEMA.schemaVersion: Type.Literal(1)` -> `Type.Union([Literal(1), Literal(2)])` during the grace window; migrate v1 -> v2 by initialising `resources.hooks = []` on every plugin record. After migration window, drop v1. See §5.4.                              |
| `persistence/migrate.ts`                        | *MODIFIED*     | Add a `migrateV1ToV2` pass: pure, additive (`resources.hooks ??= []`), no uninstall, no network. Mirrors the v1.12 autoupdate-scrub structure (gated migration, fire-and-forget persist).                                                                                |
| `domain/resolver.ts`                            | *MODIFIED*     | Move `hooks` from the unsupported standalone-file set into the supported set; the resolver's `componentPaths`-like surface gains a `hooks?: string` (relative path to `hooks/hooks.json` when present) so the install orchestrator can locate it without re-walking.    |
| `orchestrators/plugin/{install,uninstall,update,reinstall}.ts` | *MODIFIED* | Extend the PI-9 staging order: `skills+prompts -> agents -> mcp -> hooks -> state commit`. Roll back hooks first on phase failure (reverse order).                                                                                                                       |
| `orchestrators/plugin/info.ts`, `list.ts`       | *MODIFIED*     | Add `hooks` to the resolved-components surface; render under the existing `subject [scope] (status) {reason}` grammar; per-row `{requires pi-subagents}` already exists -- add `{requires pi-mcp}` reuse where a hook event soft-deps on it (none today, but the seam stays).                                                                                                                   |
| `orchestrators/reconcile/apply.ts`              | *MODIFIED*     | After the per-scope apply pass returns, call `rebuildRoutingTables(state, loc)` for that scope. Routing tables are scope-aware (per-scope plugin records).                                                                                                                |
| `shared/notify.ts`                              | *MODIFIED*     | Possible new closed-set `Reason` for "hook payload extension ignored" (e.g. `"async rewake unsupported"`). Catalog-UAT update in lockstep. May also reuse an existing reason -- decision deferred to the notify phase (see §6.3).                                       |

---

## 3. Recommended Project Structure (additions only)

```
extensions/pi-claude-marketplace/
├── bridges/
│   └── hooks/                       # NEW: 4th component bridge
│       ├── plan.ts                  # NEW: pure planner
│       ├── stage.ts                 # NEW: atomic copy of hooks.json
│       ├── unstage.ts               # NEW: per-plugin rm -rf
│       ├── discover.ts              # NEW: reader for info/list
│       ├── matcher.ts               # NEW: pipe-OR compile
│       ├── dispatch.ts              # NEW: composite pi.on handlers
│       ├── lifecycle.ts             # NEW: installComposites + rebuildRoutingTables
│       ├── spawn.ts                 # NEW: child-process exec + parse
│       └── payloads/
│           ├── session-start.ts     # NEW (A)
│           ├── user-prompt-submit.ts# NEW (A)
│           ├── pre-tool-use.ts      # NEW (A)
│           ├── post-tool-use.ts     # NEW (A)
│           ├── post-tool-use-failure.ts # NEW (A)
│           ├── pre-compact.ts       # NEW (A)
│           ├── post-compact.ts      # NEW (A)
│           ├── session-end.ts       # NEW (A)
│           ├── file-changed.ts      # NEW (B)
│           ├── cwd-changed.ts       # NEW (D)
│           ├── post-tool-batch.ts   # NEW (D)
│           ├── user-prompt-expansion.ts # NEW (D)
│           ├── stop.ts              # NEW (D, load-bearing -- ralph-wiggum canary)
│           ├── stop-failure.ts      # NEW (D)
│           ├── subagent-start.ts    # NEW (A+B, soft-dep pi-subagents)
│           └── subagent-stop.ts     # NEW (A+B, soft-dep pi-subagents)
├── domain/
│   └── components/
│       └── hooks.ts                 # NEW: ParsedHookEntry + parser
├── shared/
│   └── event-router.ts              # NEW: routing-table singleton
├── persistence/
│   ├── state-io.ts                  # MODIFIED: schemaVersion 1 -> 2
│   └── migrate.ts                   # MODIFIED: migrateV1ToV2
└── index.ts                         # MODIFIED: + bridge.installComposites(pi)
```

### Structure rationale

- **`bridges/hooks/` is the 4th sibling, not an `orchestrators/` member.** Hooks are a *component type* (parallel to skills, commands, agents, mcpServers), and the project already locates per-component logic under `bridges/`. The new bridge inherits the same plan/stage/unstage/discover quartet the other three bridges expose; this keeps the cascade-extension in `plugin/install.ts` mechanical -- "add one more cascade phase" -- and matches the v1.7 saga discipline (each bridge owns its rollback, the orchestrator owns sequencing).
- **`bridges/hooks/dispatch.ts` + `shared/event-router.ts` split.** Dispatch holds the *handlers* (composite `pi.on(...)` callbacks); the router holds the *routing table* (event -> plugin entries). The split is load-bearing: handlers are installed exactly once at extension-factory time and never re-registered (Pi has no `pi.off()` -- see §7.1); only the table is mutated on `/reload`. Putting the table in `shared/` (where `notify.ts` and other singletons live) keeps `bridges/hooks/` import-graph-flat.
- **`domain/components/hooks.ts` next to `plugin.ts`/`mcp.ts`.** The resolver already imports `PLUGIN_MANIFEST_VALIDATOR` and `MCP_SERVERS_VALIDATOR` from `domain/components/`. A `HOOKS_VALIDATOR` sibling completes the convention. The schema is forward-compatible by construction (preserves unknown payload-extension fields).
- **Per-event payload file under `bridges/hooks/payloads/`.** Each Claude event has different shape, different bucket, different synthesis caveats (B/D entries carry the loss-mode comments adjacent to their synthesizers per `docs/research/...md` §"Synthesis caveats"). One file per event makes "regression test for `Stop` synthesis" mechanically obvious and keeps the dispatcher under 200 LoC.

---

## 4. Architectural Patterns

### Pattern 1: Composite-per-Pi-event handler with mutable routing table (resolves the locked-design Q1)

**What:** Install **one** `pi.on(piEventName, handler)` per Pi event type at extension-factory time (`bridge.installComposites(pi)` invoked synchronously from `index.ts`). The handler does no plugin logic; it looks up its routing table in `shared/event-router.ts` and dispatches to every matching plugin's translator.

**Why this is right (vs. one `pi.on(...)` per plugin):**

1. **Pi has no `pi.off()`.** Verified in `@earendil-works/pi-coding-agent` package: `ExtensionAPI` exposes `pi.on`, `pi.events: EventBus`, `pi.sendUserMessage`, `pi.registerCommand`, `pi.registerTool` -- *no `off`/`unsubscribe`*. Per-plugin `pi.on(...)` registrations from a previous load would persist on `/reload`, accumulate every reload, and fire on stale plugin state. With per-plugin handlers, a plugin uninstall could not actually disable its hooks until process restart -- a direct NFR-2 violation ("no fix may require a Pi process restart; `Run /reload` must suffice").
2. **A "disabled" flag inside per-plugin handlers does not fix this.** Even with the flag, every reload installs N more handlers; after K reloads, K-1 of them are dead weight. Pi's event-fan-out cost grows unboundedly across reloads -- a long-running session pays for this.
3. **Composite handlers + a mutable routing table installed exactly once gives O(reload-count) handler installs = 1**, with routing-table rebuild being the only per-reload work. The composite reads the table on every dispatch; nothing is stale because the table is the single source of truth.

**Cost of routing-table rebuild per `/reload`:** Walk `state.plugins` (already in memory after `loadState`) for both scopes, iterate `record.resources.hooks`, populate `Map<PiEventName, Map<RoutingKey, RoutingEntry[]>>`. Pure synchronous data shuffle, no I/O. For the empirical first-party catalog (5 hook-using plugins, mostly 1-4 entries each) this is dozens of map inserts -- well under 1ms. Scales linearly with installed-plugin count, with a small constant.

**Deterministic dispatch ordering rule (locked-design Q1 edge case — two plugins, same event, overlapping matcher):** Sort routing entries by `(scope, plugin)` using the existing `compareByNameThenScope` from `shared/notify.ts` (project-first tie-break, then alphabetical). This is the same comparator the v1.3 output-grammar settled on; reusing it means catalog UAT renderings of hook-related rows match every other multi-plugin surface. Within a single plugin's entries, preserve `hooks.json` source order (Claude Code's documented behavior: matchers run in declared order within a hook config).

**Concurrency model (locked-design Q5 follow-up):** Within ONE composite handler invocation, dispatch is **sequential and awaited per routing entry**. This matches Claude Code's per-event serial semantics and is the only model that lets a hook's `{"decision": "block"}` short-circuit the rest of the chain. Across DIFFERENT Pi event types, Pi's own dispatch model controls -- the bridge does not coordinate cross-event ordering (Pi already serializes per-event-type in the agent loop). Document this in `bridges/hooks/dispatch.ts` header comment alongside the bucket-D synthesis caveats.

**Tradeoff acknowledged:** A composite handler is harder to per-plugin-debug than a per-plugin handler. Mitigation: a single debug-log line per dispatch with `(plugin, event, matcherHit, decision)` makes traceability mechanical (see §6.4 for the debug-log seam). Net: the no-unsubscribe constraint is decisive; the composite shape is the only one that satisfies NFR-2.

### Pattern 2: Hooks bridge mirrors the existing 4-bridge cascade contract

**What:** `bridges/hooks/{plan,stage,unstage,discover}.ts` matches the file partition and seam shape of `bridges/agents/`, `bridges/mcp/`, `bridges/skills/`, `bridges/commands/`. The cascade orchestrator (`orchestrators/plugin/install.ts`) extends from 4 bridges to 5 by inserting a `stageHooks(...)` call in the same shape as `stageMcpServers(...)`.

**Why:** v1.7 hardened the cascade into a per-bridge sequential-roll-forward + reverse-walk-on-failure ledger pattern (`transaction/runPhases.ts`). New bridges that conform to that shape inherit the rollback discipline automatically; bridges that don't conform create a surface where future failure modes cannot be pinned by `tests/transaction/phase-ledger.test.ts`. Conforming is cheap: `bridges/hooks/stage.ts` is a single `atomicWriteJson` of `hooks.json` (no per-entry copy -- the whole file moves as one unit), and `unstage.ts` is one `rm -rf`. The bridge's containment guarantee falls out of the per-plugin subdirectory under `<extensionRoot>/hooks/<plugin>/` -- no cross-plugin write is reachable.

### Pattern 3: State schema bump as additive optional, not breaking

**What:** `STATE_SCHEMA.schemaVersion` widens from `Type.Literal(1)` to `Type.Union([Literal(1), Literal(2)])`; the per-plugin `resources` object gains `hooks: Type.Array(Type.Object({event: ..., matcher: ..., bucket: ..., softDep: Type.Optional(...), ignoredExtensionFields: Type.Optional(Type.Record(...))}))`. The field is **required at v2** but **absent at v1**; the migration synthesizes `[]` for every existing plugin record on first load under v1.13 code.

**Migration semantics (resolves the locked-design Q2 first-load behavior):**

- First load of a v1.12 state.json under v1.13 code: `loadState` reads `schemaVersion === 1`; the existing `migrateLegacyMarketplaceRecords` chain gains a step that walks every `marketplaces[*].plugins[*]` and sets `resources.hooks ??= []` (additive, idempotent), then sets `schemaVersion = 2`. Persisted fire-and-forget by `persistMigratedState` (same shape as the v1.12 autoupdate scrub).
- Mid-flight crash before migrated persist: harmless. Next load re-runs the migration; same fixed point.
- A `claude-plugins.json` declared plugin's `enabled: true` whose state record has `resources.hooks: []` is a regular state -- it just means "no hooks staged yet (or this plugin declares none)." The reconcile loop's install step is the one that actually populates `resources.hooks` by calling `bridges/hooks/stage.ts`.
- Downgrade safety (v1.13 state.json read by v1.12 code): typebox's strict mode would *reject* `schemaVersion: 2`. Acceptable -- downgrades aren't a supported path; the user would have to manually delete state.json. Document in CHANGELOG.

**Concrete TypeBox diff (resolves locked-design Q2 schema shape):**

```typescript
// persistence/state-io.ts — DIFF
const HOOK_ROUTING_SCHEMA = Type.Object({
  // The Claude event name as written in hooks.json (canonical form;
  // bucket-H entries are dropped at parse time and never recorded here).
  event: Type.Union([
    Type.Literal("SessionStart"),
    Type.Literal("UserPromptSubmit"),
    Type.Literal("PreToolUse"),
    Type.Literal("PostToolUse"),
    Type.Literal("PostToolUseFailure"),
    Type.Literal("PostToolBatch"),
    Type.Literal("UserPromptExpansion"),
    Type.Literal("PreCompact"),
    Type.Literal("PostCompact"),
    Type.Literal("SessionEnd"),
    Type.Literal("Stop"),
    Type.Literal("StopFailure"),
    Type.Literal("FileChanged"),
    Type.Literal("CwdChanged"),
    Type.Literal("SubagentStart"),
    Type.Literal("SubagentStop"),
  ]),
  // Literal name OR pipe-OR alternation; never a regex (NON-GOAL).
  matcher: Type.String(),
  bucket: Type.Union([
    Type.Literal("A"), Type.Literal("B"), Type.Literal("D"),
    Type.Literal("soft-dep-conditional"),
  ]),
  softDep: Type.Optional(Type.Union([Type.Literal("pi-subagents")])),
  // Forward-compat: preserve unknown payload-extension fields (e.g.
  // asyncRewake) so a re-stage round-trips byte-identical (and the
  // install-time warning lists exactly what was tolerated).
  ignoredExtensionFields: Type.Optional(
    Type.Record(Type.String(), Type.Unknown()),
  ),
});

const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  // ...existing fields unchanged...
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    hooks: Type.Array(HOOK_ROUTING_SCHEMA),         // NEW
  }),
  // ...
});

export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),   // WIDEN
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
```

**Note:** `hooks` is array-shaped, **not** a `Map<EventName, Routing[]>`. A single plugin may declare two entries for the same event with different matchers; the array preserves declaration order (which Claude Code honors at dispatch time). The router-table builder (`event-router.ts`) does the grouping.

### Pattern 4: Routing-table rebuild is a side-effect of reconcile, not a parallel mechanism

**What:** `orchestrators/reconcile/apply.ts` already drives the full set of install/uninstall/enable/disable transitions per scope on every `/reload` (RECON-01..05). After its per-scope apply pass returns, before the single notify, call `bridge.rebuildRoutingTables(state, loc)` once per scope. The function is pure-ish: reads state in memory, mutates the `shared/event-router.ts` singleton, returns void.

**Why** (resolves the locked-design Q1 "rebuild on every /reload" cost concern): The reconcile pass is the only path that mutates `state.json` after the initial extension factory. By piggybacking on its single notify and its per-scope completion barrier, the rebuild is:

- Atomic w.r.t. the file (it reads the state object already loaded under the per-scope lock).
- Idempotent (clearing + rebuilding gives the same table for the same state).
- Free of cross-scope races (each scope owns its rebuild call serially within the apply pass).
- Triggered by the same events that mutate the disk state, with no separate lifecycle to keep in sync.

The cost of one full rebuild is bounded by `total installed plugins * avg hooks per plugin * avg events per hook`. For the empirical first-party catalog this is sub-millisecond. Even at 100 installed plugins with 5 hooks/plugin/3 events = 1500 map inserts: still microsecond-scale on Node 22.

### Pattern 5: Bucket-D synthesizers own their loss-mode comments + dedicated tests

**What:** Each bucket-D payload file (`bridges/hooks/payloads/{cwd-changed,post-tool-batch,user-prompt-expansion,stop,stop-failure}.ts`) carries its loss-mode comment block adjacent to the synthesizer body. The `docs/research/claude-hooks-vs-pi-events.md` "Synthesis caveats" table is the canonical wording -- the comment block in code lifts it verbatim.

**Why:** The risk surfaced in `docs/research/...md` is that bucket-D synthesizers "could quietly drift if Pi grows new tools, transform stages, or execution patterns." A canary plugin (`ralph-wiggum` for `Stop`) is named in the research note. Pinning each loss mode in a per-file regression test (`tests/bridges/hooks/payloads/stop.test.ts` -> "block-to-continue round-trip via pi.sendUserMessage") makes the synthesis contract executable: a future Pi change that breaks the synthesizer breaks the test, not user installs.

### Pattern 6: Soft-dep wiring uses the existing `softDepStatus(pi)` probe, not a new probe

**What:** `pi-subagents` presence is already probed by `softDepStatus(pi)` from `platform/pi-api.ts`. When `pi-subagents` is present, the bridge subscribes to `pi.events.on("subagent:async-started" / "subagent:async-complete", ...)` from inside `installComposites(pi)`; when absent, it skips those subscriptions and the routing table for `SubagentStart`/`SubagentStop` simply has no path that reaches a real handler. The per-row `{requires pi-subagents}` marker on `list`/`info` rows uses the existing `shared/notify.ts` `Dependency = "agents" | "mcp"` mechanism (which already drives the equivalent marker for agents/mcp); hooks reuse `Dependency = "agents"` because `pi-subagents` is the same soft dep that drives the agents bridge today.

**Why this is not a new soft-dep:** Adding a third Dependency token would force a closed-set bump in `notify.ts` plus a catalog-UAT change for every renderer that touches the row. Reusing `"agents"` keeps the wire-format unchanged. The reader interpretation is unambiguous: any row that says `{requires pi-subagents}` is missing the pi-subagents host that BOTH the agents bridge AND the subagent-hook bridge need.

---

## 5. Data Flow

### 5.1 Install-time data flow (new path through existing install orchestrator)

```
/claude:plugin install x@mp [--local]
  └─► edge -> orchestrators/plugin/install.ts::installPlugin
        └─► withLockedStateTransaction(loc, async tx => {
              // existing phases:
              await stageSkillsAndPrompts(plan)             // bridges/skills + commands
              await stageAgents(plan)                       // bridges/agents
              await stageMcpServers(plan)                   // bridges/mcp
              // NEW phase, between mcp and state commit:
              const hookPlan = planHooks(resolved.hooks)    // bridges/hooks/plan.ts
              const hookRouting = await stageHooks(hookPlan, loc) // bridges/hooks/stage.ts
              tx.state...resources.hooks = hookRouting      // discriminated record
              writeBackPluginEntry(loc, ...)                // v1.12 write-back, unchanged
              await tx.save()                               // existing state save
            })
        └─► notify(...)                                     // existing; +
                                                            // {hook payload extension ignored}
                                                            // reason if any
```

Where:

- `planHooks` parses `hooks.json` via `domain/components/hooks.ts`, drops bucket-H events (silent, debug-log only), separates `softDep`-conditional entries from direct entries, collects unknown payload-extension field names (for the install-time warning if any).
- `stageHooks` does `atomicWriteJson(<extensionRoot>/hooks/<plugin>/hooks.json, hookPlan.content)` after `assertPathInside` against `<extensionRoot>/hooks/`. Containment falls out: per-plugin subdir.

### 5.2 Runtime data flow (the new dispatch path)

```
Pi fires PreToolUse-equivalent event (tool_call)
  └─► composite handler (registered once at extension factory)
        └─► router.lookup("tool_call", event.toolName) -> RoutingEntry[]
              (sorted project-first-then-alphabetical; deterministic)
              └─► for each entry (sequential, awaited):
                    └─► matcher.matches(entry.matcher, event.toolName)?
                          ├─ no  -> continue (no log, no spawn)
                          └─ yes -> spawn child process
                                    └─► stdin: translate(event) per payloads/pre-tool-use.ts
                                    └─► stdout: JSON parse; apply response:
                                          - decision:"block" -> Pi tool_call returns
                                              { block: true, reason }
                                          - permissionDecision -> map to Pi semantics
                                          - updatedInput -> mutate event.input in place
                                    └─► nonzero exit -> treat as block + capture stderr
                                    └─► timeout -> treat as block + log
                    └─► debug-log: (plugin, event, decision, durationMs)
              └─► return aggregated Pi event result (first-blocker-wins or merge per event spec)
```

**Concurrency clarification (resolves locked-design Q5):** Within a single composite handler invocation, the `for each entry` loop is `for ... of` with `await` per body. Two routing entries for the same event NEVER run in parallel. This matches Claude Code's documented per-event semantics; the bridge's invariant comment block in `dispatch.ts` should cite this explicitly so a future "optimize with Promise.all" PR is unambiguously wrong. Across different Pi events (e.g. a `tool_call` and a `tool_result` fire in close succession), Pi's own event loop is the serializer -- the bridge does not interpose.

### 5.3 `/reload` flow (extension of the v1.12 reconcile)

```
Pi /reload
  └─► pi.on("resources_discover") handler [index.ts]
        ├─► applyReconcile({ ctx, pi, cwd: event.cwd })   // RECON-01..05
        │     ├─ readPassForScope(user)  -> plan
        │     ├─ readPassForScope(project) -> plan
        │     ├─ applyPassForScope(user)
        │     │     └─ install/uninstall/enable/disable cascade
        │     │     └─ NEW: bridge.rebuildRoutingTables(userState, userLoc)
        │     ├─ applyPassForScope(project)
        │     │     └─ install/uninstall/enable/disable cascade
        │     │     └─ NEW: bridge.rebuildRoutingTables(projectState, projectLoc)
        │     └─ single notify() — existing reconcile-applied-cascade
        └─► aggregateDiscoveredResources(...) -> { skillPaths, promptPaths }
```

**Note on mid-/reload event delivery (Pitfall, see §7.4):** Between `applyReconcile` start and `rebuildRoutingTables` for a given scope, Pi could theoretically fire a tool_call event in the middle. The current routing table is from the *previous* reload's state; it may dispatch to a plugin we are about to uninstall. Mitigations: (a) Pi's event ordering is single-threaded within the agent loop, so during reconcile (which runs inside `resources_discover` handler, awaited by Pi) no agent-loop event can fire -- `resources_discover` is part of Pi's setup-phase, not a runtime event interleaved with agent turns. This means the rebuild boundary is **safe by Pi's call ordering**, not by our locking. Document the assumption in `lifecycle.ts` so a future change to Pi's discover-handler scheduling surfaces as a code review concern. (b) Even if Pi did fire an event during reconcile, the worst case is one stale dispatch to a plugin whose hooks.json is still on disk -- the spawn proceeds against the old file, which is the same content the in-memory routing table thinks should run. The next event after `rebuildRoutingTables` returns reads the new table. There is no data corruption path.

### 5.4 State.json schema bump migration (resolves locked-design Q2)

```
load v1 state.json under v1.13 code:
  loadState(extensionRoot)
    └─ JSON.parse -> raw object with schemaVersion: 1, no plugin.resources.hooks
    └─ migrateLegacyMarketplaceRecords(raw, configExists, scrubAutoupdate)
        └─ existing autoupdate scrub (v1.12)
        └─ NEW: migrateV1ToV2(raw):
              for each marketplace:
                for each plugin:
                  plugin.resources.hooks ??= []
              raw.schemaVersion = 2
    └─ STATE_VALIDATOR.Check(raw)  // passes; schemaVersion is now in widened union
    └─ persistMigratedState(raw)   // fire-and-forget, IL-3 sanctioned warn on fail
    └─ return raw as ExtensionState

load v2 state.json under v1.13 code:
  loadState -> validates -> no migration -> return
```

**Field-by-field accounting for the bump (resolves locked-design Q2 in full):**

| Plugin-record field      | v1 status | v1.13 (v2) status                                  |
| ------------------------ | --------- | -------------------------------------------------- |
| `version`                | required  | unchanged                                          |
| `resolvedSource`         | required  | unchanged                                          |
| `compatibility.*`        | required  | unchanged                                          |
| `resources.skills`       | required  | unchanged                                          |
| `resources.prompts`      | required  | unchanged                                          |
| `resources.agents`       | required  | unchanged                                          |
| `resources.mcpServers`   | required  | unchanged                                          |
| `resources.hooks`        | --        | required (defaults `[]` on migration)              |
| `installedAt/updatedAt`  | required  | unchanged                                          |

### 5.5 Per-plugin file isolation (resolves locked-design Q3)

The v1.7-hardened containment model already says: each plugin owns its own subtree under each component-bridge's directory. For hooks, the subtree is `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/` (under the existing extensionRoot, NOT a new top-level dir under scopeRoot). This is correct because:

- `assertPathInside(<extensionRoot>, ...)` already covers it; no new containment rule needed.
- Uninstall = `rm -rf <extensionRoot>/hooks/<plugin>/`. Naturally drops the routing entries on the next `rebuildRoutingTables` because `state.plugins[mp][plugin].resources.hooks` was set to `[]` (or the record was removed entirely) inside the same locked uninstall transaction.
- Cross-plugin sharing is impossible: two plugins write to two different subdirs; the bridge never reads a sibling plugin's file.
- The `<plugin>` segment is the plugin's marketplace-derived name, which already passes through `assertSafeName` at install time (existing rule for `pluginDataDir`, line 184 of `locations.ts`). Reuse that helper for the hooks subdir: `path-separator chars, ".." / ".", ASCII control chars` are pre-rejected -- the existing defense applies.

---

## 6. Integration Points (code seams the roadmapper can name in phases)

| # | Boundary | File:Symbol | Phase ownership |
|---|----------|-------------|-----------------|
| 1 | Schema bump | `persistence/state-io.ts::STATE_SCHEMA`, `::PLUGIN_INSTALL_RECORD_SCHEMA` | Schema/state-split phase (blocker for everything else) |
| 2 | State migration | `persistence/migrate.ts::migrateLegacyMarketplaceRecords` (add `migrateV1ToV2` call), `::persistMigratedState` (unchanged) | Same phase as (1) |
| 3 | Hook parser + types | `domain/components/hooks.ts` (NEW); `domain/resolver.ts` (move `hooks` from unsupported standalone-file array on lines 156-162 into the supported set; surface a `hooks?: string` on the resolved-plugin shape near the `componentPaths` definition lines 41-44) | Parser phase (depends on (1) for schema shape) |
| 4 | Matcher compile | `bridges/hooks/matcher.ts` (NEW) | Parser phase or its own (small, leaf) |
| 5 | Stage / unstage / discover | `bridges/hooks/{plan,stage,unstage,discover}.ts` (NEW) | Bridge-shape phase (depends on (3)) |
| 6 | Install cascade extension | `orchestrators/plugin/install.ts` (extend the 4-bridge cascade to 5); equivalent extensions in `uninstall.ts`, `update.ts`, `reinstall.ts` | Lifecycle phase (depends on (5)) |
| 7 | Routing-table singleton + composites | `shared/event-router.ts` (NEW); `bridges/hooks/dispatch.ts` (NEW); `bridges/hooks/lifecycle.ts::installComposites` (NEW) | Dispatch-core phase (depends on (3,4); independent of (5,6)) |
| 8 | Composite registration site | `index.ts` (line ~62, after `registerClaudePluginCommand`, before `registerClaudeMarketplaceTools`); ONE-LINE call: `installComposites(pi)` | Dispatch-core phase |
| 9 | Routing-table rebuild call | `orchestrators/reconcile/apply.ts::applyPassForScope` (after the per-scope cascade returns, before the single notify) | Lifecycle integration phase (depends on (6,7)) |
| 10 | Per-event payload translators | `bridges/hooks/payloads/<event>.ts` (NEW, ~16 files) | Per-bucket phases (A as one phase; B FileChanged as its own; each D event arguably its own; soft-dep subagent as own) |
| 11 | Spawn + parse | `bridges/hooks/spawn.ts` (NEW) | Dispatch-core phase (parallel to payloads; both feed into (7)) |
| 12 | Info / list surface | `orchestrators/plugin/info.ts` (extend `composePluginInfoComponents` around lines 200-220 to include `hooks` alongside `agents/commands/mcp/skills`); `orchestrators/plugin/list.ts` (extend the renderPluginRow's components field) | Surface phase (depends on (5) for `bridges/hooks/discover.ts`) |
| 13 | Install-time warning emit | `orchestrators/plugin/install.ts` -> `notify(...)` (existing); new `Reason` value if needed (see §6.3) | Notify phase (same as (12) or separate) |
| 14 | Debug log emit | All bucket sites where "dropped because semantically inapplicable" or "ignored extension field" fires. NO existing project-wide debug log seam exists — the codebase routes everything through `ctx.ui.notify` or throws. Recommend: a single `shared/debug-log.ts` (NEW) wrapping `console.debug` gated on `process.env.PI_CLAUDE_MARKETPLACE_DEBUG`; bridge files import from here. This is the smallest IL-2/IL-3-respecting seam (IL-3 already sanctions one `console.warn` for migration save failures; a structured `console.debug` gated on env is a narrow precedent extension). | Same phase that introduces (3) parser |
| 15 | Bucket-H drop policy | `bridges/hooks/plan.ts` (silent drop + `debugLog("dropped %s:%s — bucket H", plugin, event)`); NO install-time warning | Same as (3) |
| 16 | Hook-payload-extension tolerance | `domain/components/hooks.ts` (preserve unknown fields on entry); `bridges/hooks/plan.ts` (collect `ignoredExtensionFields`); install notify references known set (`asyncRewake`, `rewakeMessage`, `rewakeSummary`) | Same phase as parser (3) + notify phase (13) |
| 17 | Soft-dep subscription | `bridges/hooks/lifecycle.ts::installComposites` -- inside, check `softDepStatus(pi).agents.present`; if true, `pi.events.on("subagent:async-started", ...)` / `"subagent:async-complete"` | Soft-dep phase |

### 6.1 Hook schema bump — landing site

`persistence/state-io.ts` lines 39-87. The bump is mechanical:

1. Add `HOOK_ROUTING_SCHEMA` definition above `PLUGIN_INSTALL_RECORD_SCHEMA`.
2. Add `hooks: Type.Array(HOOK_ROUTING_SCHEMA)` to the `resources` object literal (line 48).
3. Widen `schemaVersion: Type.Literal(1)` (line 85) to `Type.Union([Type.Literal(1), Type.Literal(2)])`.

The JIT validator (`STATE_VALIDATOR = Compile(STATE_SCHEMA)` line 92) recompiles automatically.

### 6.2 Reconcile routing-table rebuild — landing site

`orchestrators/reconcile/apply.ts`. Today the per-scope apply pass returns `PerEntryOutcome[]`; the call site is inside `applyReconcile` (line ~70). Add **one line** after each scope's apply completes:

```typescript
bridge.rebuildRoutingTables(state, loc);
```

where `state` is the post-cascade in-memory state for that scope. Pure call, sub-millisecond, no I/O.

### 6.3 `info.ts` / `list.ts` rendering — landing site

`orchestrators/plugin/info.ts` line ~205: `composePluginInfoComponents(...)` returns an object with `agents/commands/mcp/skills` optional fields. Add `hooks?: readonly string[]` keyed by event name (e.g. `["PreToolUse(Edit|Write)", "Stop"]`) so an `info` row shows what events the plugin subscribes to and with what matcher. `list.ts` row composition (around line ~835) currently emits `{requires pi-subagents}` / `{requires pi-mcp}` on `installed`/`updated`/`reinstalled` rows; extend the trigger to also fire when the plugin has at least one soft-dep-conditional hook entry (SubagentStart/SubagentStop) AND `pi-subagents` is absent. Reuses the existing `Dependency = "agents"` token; no new closed-set member.

### 6.4 `ctx.ui.notify()` install-time warning — landing site

`orchestrators/plugin/install.ts` already builds a `PluginNotificationMessage` after the cascade. The install-time warning for "hook payload extension X ignored" is a *Reason* on the existing installed-row. Decision deferred to the notify phase: either (a) reuse an existing reason (none fits cleanly today), or (b) add ONE new `Reason` member to the closed set in `shared/notify.ts` -- e.g. `"async rewake unsupported"` -- and pin it in `tests/architecture/catalog-uat.test.ts` lockstep. Recommendation: option (b), one new reason, single new catalog UAT byte form -- minimal grammar disturbance.

### 6.5 Debug log — landing site

No project-wide debug-log helper exists today (verified by `grep -r "console\\.debug\|debugLog" extensions/pi-claude-marketplace/`). Introduce `shared/debug-log.ts`:

```typescript
// shared/debug-log.ts
export function debugLog(template: string, ...args: unknown[]): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG !== "1") return;
  console.debug(`[pi-claude-marketplace] ${template}`, ...args);
}
```

The IL-2 "no direct stdout/stderr from command/bridge code" rule is preserved because (a) `console.debug` writes to stderr only when the env flag is set (operator-opted-in), and (b) the seam is single and centralized so a future tightening (route to a real Pi logger when one exists) is one file change.

---

## 7. Anti-Patterns / Adversarial Review (resolves locked-design Q7)

### Anti-Pattern 1: One `pi.on(...)` per plugin

Already covered in §4 Pattern 1. Restated for the roadmapper: **do not** install N handlers per Pi event type. The lack of `pi.off()` means accumulated stale handlers across reloads is a silent NFR-2 violation. Phase-level test: `tests/architecture/hook-bridge-one-handler-per-event.ts` asserts `bridge.installComposites(pi)` calls `pi.on(...)` exactly K times where K = the count of supported Pi event types.

### Anti-Pattern 2: Hidden coupling to Pi event names without a single source of truth

Pi event names (`tool_call`, `tool_result`, `agent_end`, `session_start`, etc.) are referenced in every payload translator. A Pi rename of `tool_call` to `pre_tool_use` would silently break the bridge -- no compile error because `pi.on(eventName, handler)` takes any string. Mitigation: import event-name constants from `@earendil-works/pi-coding-agent`'s type surface (the peer dep exports typed event names; the `ExtensionAPI` type's `on` overload signature pins them). Concretely: `bridges/hooks/dispatch.ts` should use a const map `PI_EVENT_FOR_CLAUDE_EVENT: Record<ClaudeEventName, PiEventName>` typed against the peer-dep types so a Pi rename in a future peer-dep version is a compile error here.

### Anti-Pattern 3: Letting hook spawn failures throw past the composite handler

The Pi event chain expects the handler to return; a thrown error from a hook child-process spawn (timeout, EACCES, ENOENT on the command) must NOT propagate to Pi. Treat as "block" per Claude Code's exit-2 semantics, log via `debugLog`, continue. Phase-level test: a payload-translator test that injects a throwing spawn and asserts the composite handler returns a `{ block: true }` result with a captured reason.

### Anti-Pattern 4: Bucket-D synthesizers presented as bucket-A behavior

The `docs/research/...md` "Synthesis caveats" section calls out that `Stop`, `CwdChanged`, `PostToolBatch`, `UserPromptExpansion`, `StopFailure` are "approximation, document the loss." A future contributor reading only the dispatch file would not know which translators are lossy. Mitigation: per-file comment block lifted verbatim from `docs/research/...md` table, plus one regression test per bucket-D event named for the loss mode (e.g. `tests/bridges/hooks/payloads/cwd-changed.test.ts::"misses non-bash cwd changes (documented loss; pinned)"`).

### Anti-Pattern 5: State-schema bump as a breaking validator change

If `schemaVersion: Type.Literal(2)` replaces (rather than widens) `Literal(1)`, the first v1.13 load of an existing v1.12 state.json fails validation BEFORE the migration step runs (because today's order is: parse -> migrate -> validate, per `loadState` lines 174-200). The widen-then-migrate-then-validate order makes the migration window safe. Phase-level test: a fixture v1.12 state.json checked into `tests/persistence/fixtures/` that `loadState` accepts and migrates without warning.

### Anti-Pattern 6: Symlinked hook configs trusted as file copies

A malicious plugin author could ship `hooks/hooks.json` as a symlink pointing outside the plugin root. The resolver currently uses `readFile` (`domain/resolver.ts:19`), which follows symlinks silently. Mitigation: the bridge's `stage.ts` MUST `fs.realpath(hooks.json)` and then `assertPathInside(<pluginRoot>, realpath)` BEFORE copy. PI-14 already enforces `PathContainmentError` for path escapes; this extends the check to symlink targets.

### Anti-Pattern 7: Plugin names with path-separator chars escaping the per-plugin subdir

Handled by `assertSafeName(plugin)` which already rejects "/" and "\\" (verified in `locations.ts:184`). Reuse that exact helper for the hooks subdir construction.

### Anti-Pattern 8: Routing-table rebuild assumed concurrent-safe with dispatch

The routing-table singleton lives in `shared/event-router.ts`. Rebuild is mutation; dispatch is read. Node is single-threaded for JS execution, so the dispatch handler's `router.lookup(...)` call cannot interleave with the rebuild's `router.set(...)` -- but if we were to make rebuild async (e.g. await a per-plugin reload), the window opens. Lock the rebuild as fully synchronous and document the invariant in `event-router.ts` header. Phase-level test: assert `rebuildRoutingTables` is synchronous (`expect(typeof bridge.rebuildRoutingTables(state, loc)).toBe("undefined")` -- no Promise).

### Anti-Pattern 9: Mid-/reload event delivery race

Addressed in §5.3. The current safety argument relies on Pi's call ordering (resources_discover runs in setup-phase, not interleaved with agent-loop events). If Pi changes this, the bridge breaks silently. Document the assumption explicitly in `lifecycle.ts`; consider adding a lightweight invariant: route the rebuild through a Promise the dispatch handler awaits (`bridge.routingReady`) — set to `Promise.resolve()` initially, reset to a deferred promise at rebuild start, resolved at rebuild end. Adds dispatch latency only during the active rebuild window (microseconds).

---

## 8. Suggested Build Order (rationale: not just "logical order"; says WHY phase N must precede N+1; resolves locked-design Q4)

| Phase order proposed | Phase | Why this position |
|---|---|---|
| **1** | **State schema bump + migration** (`state-io.ts`, `migrate.ts`) | LEAF dependency. The schema shape is consumed by every later phase's state mutations. Migrating IN PLACE means a v1.13 install with no other phases shipping at least loads cleanly. |
| **2** | **Hook parser + matcher + domain primitive** (`domain/components/hooks.ts`, `bridges/hooks/matcher.ts`, resolver patch to surface `hooks?`) | Pure / leaf-pure code. Depends on (1) for state shape; independent of dispatch. Tests are byte-form unit tests; no I/O. |
| **3** | **Hooks bridge plan/stage/unstage** (`bridges/hooks/plan.ts`, `stage.ts`, `unstage.ts`, `discover.ts`) | Depends on (2). Atomic-write + path-containment is identical to existing 4 bridges; mechanical extension. |
| **4** | **Install cascade extension** (`orchestrators/plugin/install.ts` + `uninstall.ts` + `update.ts` + `reinstall.ts`) | Depends on (3). Adds the 5th cascade phase. Each modified orchestrator gets one test for the new phase + rollback. |
| **5** | **Dispatch core** (`shared/event-router.ts`, `bridges/hooks/dispatch.ts`, `bridges/hooks/lifecycle.ts`, `bridges/hooks/spawn.ts`, `index.ts` one-line wiring) | Depends on (2) for matcher; independent of (3,4). Can land in parallel with (3,4) if the two streams agree on the `Routing` shape from (1). The locked design Q4 question "is dispatch core (2) really independent of any bucket?" — yes: dispatch is the composite shape + spawn + routing; the payload-translator content lives in phase (6). The matcher choice (literal + pipe-OR) is fully determined by `docs/research/...md` and does not depend on any specific event's payload. |
| **6a** | **Bucket A payload translators (8 events)** | Field rename only; ~30-50 LoC each. Can land in one phase because zero per-event synthesis risk. |
| **6b** | **Bucket B: FileChanged** | One event; uses `node:fs.watch` (or its replacement). Standalone risk profile (watch semantics on Linux vs macOS); own phase. |
| **6c** | **Bucket D, but with `Stop` as its own phase BEFORE the rest** | YES — answering locked-design Q4 directly: `Stop` is load-bearing (`ralph-wiggum` canary; 3 of 5 first-party hook-using plugins depend on block-to-continue). Pin its synthesizer + regression test in a dedicated phase so the milestone has a working answer to "does the bridge correctly round-trip Claude Code's most-used block contract" before bucket D's lower-risk events ship. The remaining D events (`CwdChanged`, `PostToolBatch`, `UserPromptExpansion`, `StopFailure`) can ship together in one follow-on phase. |
| **7** | **Soft-dep wiring: SubagentStart/Stop** | Depends on (5) for composite handlers; depends on `softDepStatus(pi)` probe (existing). Conditional code path; soft-dep absent must degrade silently to "routing table has no entries for these events." |
| **8** | **Lifecycle integration with reconcile** (`apply.ts` one-line rebuild call) | Depends on (5,6,7). Lands after the dispatch fabric is in place; one-line code change + an integration test that mutates state inside reconcile and asserts the routing table reflects it. |
| **9** | **Info / list rendering + install-time notify warning + bucket-H drop policy + payload-extension tolerance** | The roadmapper asked whether (8) tolerance and (9) bucket-H drop should be one phase — YES. Both are parser-level concerns (`bridges/hooks/plan.ts`), both surface (or suppress) at install time via `ctx.ui.notify`, both share catalog-UAT byte-form work. Folding `info.ts`/`list.ts` rendering into the same phase keeps the entire "what the user SEES" surface in one merge. |

**Two notes that diverge from the locked-design proposed order:**

1. **`Stop` deserves its own phase between (5) and (6) — yes, hoist it.** The user's locked-design listed "(5) bucket D synthesizers (parallel: CwdChanged, PostToolBatch, UserPromptExpansion, Stop, StopFailure)." This research recommends splitting `Stop` into its own phase **6c-stop** that ships before the remaining four (**6c-rest**). Rationale: the canary plugin's correctness gates the whole milestone's "does the bridge work" answer; coupling its risk with four lower-risk synthesizers would mean a `Stop`-regression delays the entire phase.
2. **Dispatch core (5) is independent of bucket A's payload shape, but only because the `Routing` interface in `shared/event-router.ts` carries `{ event: ClaudeEventName, matcher: string, plugin: string, scope: Scope, payloadModule: () => Promise<...> | ...}` -- the dispatcher does not look INSIDE the payload, only routes to it.** The bucket-A translators are therefore strictly downstream consumers. Confirm this contract in the (5)-phase tests so a later contributor doesn't accidentally bind dispatch to a bucket A field.

---

## 9. Scalability / Concurrency

| Concern | At 1 plugin with hooks | At 10 plugins | At 100 plugins |
|---|---|---|---|
| Composite handler registrations | K (= supported event count, ~16) | K | K |
| Routing-table rebuild cost | < 0.1 ms | ~1 ms | ~10 ms |
| Per-dispatch lookup | O(1) Map.get | O(1) Map.get | O(1) Map.get |
| Per-dispatch fan-out | 1 spawn | up to N (sequential) | up to N (sequential) |
| Memory | hundreds of bytes | KB | tens of KB |

The dispatch chain is sequential within an event; cross-plugin parallelism is NOT used (matches Claude Code; required for the block-to-continue contract). At 100 plugins each subscribing to `PreToolUse`, a single tool call could trigger up to 100 sequential child-process spawns -- this is the same cost Claude Code itself pays. Operators concerned about latency should hold the per-marketplace `autoupdate` flag off and curate the installed plugin set; the bridge intentionally does no de-duplication beyond the routing-key Map lookup.

---

## 10. Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Dispatch model (composite + mutable table) | HIGH | Pi `pi.off()` absence verified by reading `@earendil-works/pi-coding-agent` exports; no `unsubscribe` surface. The composite shape is forced. |
| State schema bump (v1 -> v2 with widen-then-migrate) | HIGH | Mirrors the v1.12 autoupdate-scrub pattern already in `migrate.ts`; tests pinning the pattern already exist as the template. |
| Routing-table rebuild on reconcile | HIGH | The reconcile pass is the only post-factory state mutator; the seam is one-line. |
| Bucket-D synthesizer correctness | MEDIUM | The `docs/research/...md` itself calls these "lossy or future-fragile." Phase-level regression tests pin the loss modes but cannot guarantee they catch every Pi runtime evolution. Recommend per-bucket-D event a runtime UAT against the canary plugin (`ralph-wiggum` for `Stop`). |
| Soft-dep wiring for SubagentStart/Stop | HIGH | Reuses `softDepStatus(pi)` + `pi.events.on(...)`; the bus is documented (`docs/research/...md` §"Soft-dep extension event surfaces"). |
| Info / list rendering | HIGH | Existing component-rendering surface already lists agents/commands/mcp/skills; adding `hooks` is a mechanical extension. |
| Mid-/reload event safety | MEDIUM | Argument relies on Pi's `resources_discover` being in setup-phase (not interleaved with agent events). True today but undocumented as a Pi invariant; the lifecycle.ts comment recording the assumption is mandatory. |
| Hook-payload-extension tolerance | HIGH | Parser-level (preserve unknown fields, install-time warning on known set). Identical pattern to the v1.12 forward-compat parser for `marketplace.json`. |

---

## 11. Open Questions for the Roadmapper

1. **Phase merge: should (6a) bucket A's 8 events be ONE phase or split (e.g. observation-only events vs. block-capable events)?** Recommendation: ONE phase. Per-event payload code is ~30-50 LoC; one phase keeps the regression-test surface dense.

2. **`Stop`'s standalone phase — does it ship the regression test against `ralph-wiggum` as part of the same phase or as a follow-on UAT?** Recommendation: same phase, as a `tests/integration/ralph-wiggum.test.ts` that spins up a fake Pi event sequence and asserts the block-to-continue round-trip via `pi.sendUserMessage`. The runtime UAT against the real Pi process is a milestone-close gate, not a phase gate (matches the v1.12 milestone-close UAT pattern).

3. **New `Reason` member for "async rewake unsupported" — should it be added in the parser phase or deferred to the install-notify phase?** Recommendation: deferred. Closed-set bumps in `shared/notify.ts` need catalog-UAT byte-form changes in lockstep (per the v1.10/v1.11 discipline in MEMORY: "any new token requires catalog-UAT byte forms in lockstep"). Folding it into the dedicated notify phase keeps the catalog disturbance in one merge.

4. **Should `FileChanged` use `node:fs.watch` or `chokidar`?** Out of architecture scope; flag for stack research. The architectural shape (one watcher per matcher pattern under `bridges/hooks/payloads/file-changed.ts`, watcher lifecycle owned by the routing-table rebuild) is identical either way.

5. **The Pi event-name constants — are they exported as a string union or as runtime const?** Need to verify against the peer dep's type surface at parser-phase kickoff. If a runtime const is exported, use it; otherwise pin the bridge's `PI_EVENT_FOR_CLAUDE_EVENT` map against the typed `pi.on(event: "...", ...)` overload signatures and assert via `tests/architecture/pi-event-name-binding.test.ts` that the keys are valid.

---

## 12. Sources

- **Real codebase, `extensions/pi-claude-marketplace/` (HIGH — primary authority):**
  - `index.ts` (lines 1-68: `pi.on("resources_discover")` handler, reconcile-then-discover ordering, error boundary preserving NFR-2)
  - `persistence/state-io.ts` (lines 39-92: STATE_SCHEMA shape, JIT validator, `schemaVersion: Literal(1)`)
  - `persistence/locations.ts` (lines 38-104, 118-229: ScopedLocations branded shape, scopeRoot vs extensionRoot, `assertSafeName` reuse for new hooks subdir)
  - `persistence/migrate.ts` (referenced shape; migrate-then-validate ordering; `persistMigratedState` fire-and-forget)
  - `orchestrators/reconcile/apply.ts` (lines 1-150: per-scope read-pass under withLockedStateTransaction, per-scope apply-pass with NO outer lock, single notify at end)
  - `orchestrators/reconcile/plan.ts` (lines 1-200: pure planner shape; reuse template for hook routing-table builder if needed)
  - `orchestrators/plugin/list.ts` (lines 168-200: `Dependency = "agents" | "mcp"` reuse for `{requires pi-subagents}` marker; cascade-extension landing site)
  - `orchestrators/plugin/info.ts` (lines 200-220: `composePluginInfoComponents` shape with agents/commands/mcp/skills)
  - `domain/resolver.ts` (lines 41-78: NFR-7 discriminated `installable: true | false`; lines 153-162: standalone-file unsupported set including `hooks` today)
  - `shared/notify.ts` (lines 1-30, 424, 469, 489: existing closed-set types `Dependency`/`Reason`/`Status`; soft-dep status probe; per-row marker mechanism)
  - `bridges/{skills,commands,agents,mcp}/` (template shape for the new `bridges/hooks/`)
- **`docs/research/claude-hooks-vs-pi-events.md` (HIGH — authority on bucket assignments, synthesis caveats, soft-dep audit, canary plugin):** Sections "Perfect-fidelity feasibility", "How each bucket B/C/D synthesizes", "Synthesis caveats", "Soft-dep extension event surfaces" (pi-subagents v0.24.3 publishes `subagent:async-started`/`-complete` on the shared `pi.events` bus).
- **`@earendil-works/pi-coding-agent` peer dep (HIGH — Pi API surface):** Local install at `/home/acolomba/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent/`. Confirmed exports include `ExtensionAPI`, `EventBus`, `createEventBus`. No `pi.off()` / `unsubscribe` surface in the public API. `pi.sendUserMessage(...)` documented in `examples/extensions/send-user-message.ts` (used by `Stop` bucket-D synthesizer for block-to-continue round-trip).
- **`.planning/PROJECT.md` (HIGH — locked v1.13 scope and decisions; 16 supported events, 9 upstream-fixable out, 5 H-bucket silently dropped, `pi-subagents` soft-dep, full regex deferred).**
- **`docs/prd/pi-claude-marketplace-prd.md` (HIGH — NFR-1/-2/-3/-5/-7/-10, IL-2/-3/-4 constraints):** Hooks join the supported component set in v1.13 (PROJECT.md "Out of Scope" amendment).
- **`.planning/milestones/v1.12-research/ARCHITECTURE.md` (HIGH — template for v1.13's brownfield-integration shape; reconcile planner/executor split, withLockedStateTransaction pattern, per-scope lock discipline reused verbatim).**
- **MEMORY (HIGH — operator preferences):** "Output row grammar subject-first" (hook surface row format must conform), "Source comment cleanup policy" / `.claude/rules/typescript-comments.md` (preserve decision IDs, not planning artifacts).
- **NOT FETCHED (intentional):** Web ecosystem search. The brownfield integration question has zero ecosystem-survey value; every architecture decision is constrained by the v1.12 surface and the locked v1.13 design context.

---
*Architecture research for: pi-claude-marketplace v1.13 Claude Hook Bridge*
*Researched: 2026-06-13*

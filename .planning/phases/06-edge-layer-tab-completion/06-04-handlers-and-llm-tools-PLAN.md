---
phase: 06-edge-layer-tab-completion
plan: 04
type: execute
wave: 2
depends_on:
  - 06-02
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/tools.test.ts
autonomous: true
requirements:
  - AP-2
  - AP-3
  - AP-4
must_haves:
  truths:
    - "Each handler shim parses args via parseCommandArgs, early-returns on undefined (Usage already emitted), and delegates to the corresponding orchestrator"
    - "No handler imports from persistence/, domain/, bridges/, transaction/, platform/ (BLOCK C)"
    - "No handler calls ctx.ui.notify directly -- all user-visible messages go through shared/notify.ts wrappers (BLOCK A)"
    - "pi_claude_marketplace_list registered with empty params schema; returns one line per marketplace plus details.marketplaces"
    - "pi_claude_marketplace_plugin_list registered with D-02 extended params schema; PL-1 union semantics for installed/available/unavailable filters"
    - "All handler shim tests + LLM tool tests unskipped and green"
  artifacts:
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
      provides: "makeInstallHandler(pi) factory; thin shim over orchestrators/plugin/install"
      exports: ["makeInstallHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
      provides: "makeUninstallHandler(pi) factory"
      exports: ["makeUninstallHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
      provides: "makeUpdateHandler(pi) factory (handles bare, single, marketplace-only forms)"
      exports: ["makeUpdateHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
      provides: "makeListHandler() factory"
      exports: ["makeListHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
      provides: "makeAddHandler(deps) factory"
      exports: ["makeAddHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
      provides: "makeRemoveHandler() factory"
      exports: ["makeRemoveHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
      provides: "handleMarketplaceList function"
      exports: ["handleMarketplaceList"]
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
      provides: "makeMarketplaceUpdateHandler(deps) factory"
      exports: ["makeMarketplaceUpdateHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
      provides: "makeAutoupdateHandler(enabled) factory (dual-form)"
      exports: ["makeAutoupdateHandler"]
    - path: extensions/pi-claude-marketplace/edge/handlers/tools.ts
      provides: "registerListMarketplacesTool + registerListPluginsTool (D-02 LLM tools)"
      exports: ["registerListMarketplacesTool", "registerListPluginsTool"]
  key_links:
    - from: extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
      to: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
      via: "installPlugin call from the shim"
      pattern: "installPlugin"
    - from: extensions/pi-claude-marketplace/edge/handlers/tools.ts
      to: extensions/pi-claude-marketplace/persistence/state-io.ts
      via: "Tool execute bodies read state.json via loadState (replicating V1 inline pattern adapted for new schema)"
      pattern: "loadState"
---

<objective>
Land the 9 thin-shim subcommand handlers and the 2 LLM tools (pi_claude_marketplace_list, pi_claude_marketplace_plugin_list). All handlers are thin shims that parse args via parseCommandArgs and delegate to their orchestrator. The LLM tools register read-only tools per D-02.

Purpose: After this plan, every subcommand and LLM tool can be invoked through the router. Plan 05 wires the registration (register.ts) and adds the cache-invalidation call-sites in orchestrators.

Tactical decisions (planner adopts researcher V1-parity defaults):
- LLM tool param schemas: inline at top of handlers/tools.ts (no separate tools-schemas.ts).
- LLM tool execute bodies: replicate V1 inline loop adapted for the new state schema. Do NOT refactor orchestrators/plugin/list.ts to return a payload. Rationale: V1 parity, minimum disruption.
- session_start wrapper installation: deferred to Plan 05 (this plan ships handlers + tools; Plan 05 ships register.ts).

Output:
- 10 new files under edge/handlers/
- 10 unskipped + green test files

This plan can run in parallel with Plan 03 (both depend only on Plan 02; no file overlap with Plan 03).
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md
@.planning/phases/06-edge-layer-tab-completion/06-RESEARCH.md
@.planning/phases/06-edge-layer-tab-completion/06-PATTERNS.md
@.planning/phases/06-edge-layer-tab-completion/06-02-SUMMARY.md

<!-- Orchestrator contracts that handlers delegate to -->
@extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts

<!-- Edge primitives produced in Plan 02 -->
@extensions/pi-claude-marketplace/edge/args-schema.ts
@extensions/pi-claude-marketplace/edge/types.ts
@extensions/pi-claude-marketplace/shared/notify.ts

<!-- V1 LLM tool source -->
<!-- Run: git show features/initial:extensions/pi-claude-marketplace/commands/list-marketplaces.ts -->

Orchestrator option shapes (verified -- read the actual files for current signatures):

- InstallPluginOptions: ctx, pi, scope, cwd, marketplace, plugin
- UninstallPluginOptions: same shape as InstallPluginOptions
- updatePlugins: accepts a target discriminator { kind: "all" } | { kind: "marketplace"; marketplace } | { kind: "single"; marketplace; plugin } (verify the actual export shape in update.ts; adapt if Phase 5 used different field names)
- ListPluginsOptions: ctx, cwd, scope?, marketplace?, installed?, available?, unavailable?
- AddMarketplaceOptions: ctx, scope, cwd, rawSource, gitOps?
- removeMarketplace: ctx, scope?, cwd, name
- listMarketplaces: ctx, scope?, cwd
- updateMarketplace / updateAllMarketplaces: deps.pluginUpdate passed as pluginUpdate field
- setMarketplaceAutoupdate: ctx, cwd, scope, name?, enabled

Shim pattern (Pattern 1 in 06-PATTERNS.md):
- Factory returning an async handler
- parseCommandArgs with positional spec + USAGE string
- Early return on undefined (parseCommandArgs already emitted via notifyError)
- Construct orchestrator options bag and delegate

LLM tool parameter schemas (06-RESEARCH.md):
- LIST_MARKETPLACES_PARAMS = Type.Object({})
- LIST_PLUGINS_PARAMS = Type.Object({ marketplace?, scope?, installed?, available?, unavailable? }) with TypeBox Type.Optional + Type.Union for scope literal pair

Tool execute return shape: { content: [{ type: "text", text }], details: { marketplaces | plugins } }. V1 verbatim.

Status semantics for tools.ts (Phase 2 D-09): state schema has NO plugin.installed boolean. Presence of mp.plugins[name] record === installed. Plugin-count per marketplace = Object.keys(mp.plugins).length.

PL-1 union semantics for pi_claude_marketplace_plugin_list:
- No filters set -> show all three buckets (installed + available + unavailable).
- Any filter set -> show union of selected buckets.
- "available" and "unavailable" require walking the marketplace manifest and running resolveStrict to determine installable.
- "installed" walks state.json marketplaces[].plugins.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement 9 thin-shim subcommand handlers + unskip shim tests</name>
  <files>extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts, extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts, extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts, extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts, extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts, extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts, tests/edge/handlers/plugin/install.test.ts, tests/edge/handlers/plugin/uninstall.test.ts, tests/edge/handlers/plugin/update.test.ts, tests/edge/handlers/plugin/list.test.ts, tests/edge/handlers/marketplace/add.test.ts, tests/edge/handlers/marketplace/remove.test.ts, tests/edge/handlers/marketplace/list.test.ts, tests/edge/handlers/marketplace/update.test.ts, tests/edge/handlers/marketplace/autoupdate.test.ts</files>
  <behavior>
- Each handler shim follows Pattern 1 (parse + early-return + delegate).
- Each handler is a factory if it needs pi or deps; a plain function otherwise (handleMarketplaceList).
- All Usage strings live as `const USAGE` at the top of each file.
- All notify calls go through notifyError (BLOCK A).
- Plugin update handler accepts three forms: bare (no positional -> kind:all), name-at-marketplace (split into plugin/marketplace -> kind:single), @-prefixed marketplace (-> kind:marketplace).
- Plugin list handler implements its own post-parseArgs scan for the three boolean filter flags (V1 parseArgs only handles --scope).
- Marketplace autoupdate is dual-form via makeAutoupdateHandler(enabled).
  </behavior>
  <action>
1. Verify orchestrator option shapes by reading each orchestrator's exported `*Options` interface. The summaries in `<context>` are derived from 06-PATTERNS.md; the source is authoritative.

2. Create the 9 handler files following Pattern 1:

   `edge/handlers/plugin/install.ts` -- factory `makeInstallHandler(pi: ExtensionAPI)`. Single positional `ref`. Split on `@` into plugin/marketplace. Reject if `@` is missing, leading, or trailing. Delegate to `installPlugin({ ctx, pi, scope: parsed.scope ?? "user", cwd: ctx.cwd, marketplace, plugin })`.

   `edge/handlers/plugin/uninstall.ts` -- identical pattern, delegating to `uninstallPlugin`. USAGE: `Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]`.

   `edge/handlers/plugin/update.ts` -- factory `makeUpdateHandler(pi: ExtensionAPI)`. Single OPTIONAL positional. Logic:
   - `ref === undefined` -> `target = { kind: "all" }`.
   - `ref.startsWith("@") && ref.length > 1` -> `target = { kind: "marketplace", marketplace: ref.slice(1) }`.
   - else parse `<plugin>@<marketplace>` (reject if `@` missing/leading/trailing).
   - Delegate to `updatePlugins({ ctx, pi, scope, cwd, target })` (verify exact orchestrator signature; if it accepts separate `marketplace`/`plugin` params instead of a `target` discriminator, adapt accordingly -- read update.ts before coding).

   `edge/handlers/plugin/list.ts` -- factory or plain function (planner picks; factory keeps register.ts uniform). Optional positional `marketplace`. Post-parseArgs scan: after calling `parseArgs(args)`, walk the tokens to extract `--installed`/`--available`/`--unavailable` flags; ALSO call parseCommandArgs with the remaining positional after stripping the boolean flags. Simpler approach: extend the shim to call `parseArgs` first, scan for booleans + drop them + reconstruct the raw arg string for parseCommandArgs (positional spec `[{ name: "marketplace", required: false }]`). OR: do all parsing manually using `parseArgs` only -- parseCommandArgs is optional for handlers that need richer flag parsing. Pick the path that keeps the shim shortest.

   `edge/handlers/marketplace/add.ts` -- factory `makeAddHandler(deps: EdgeDeps)`. Single positional `source`. Delegate to `addMarketplace({ ctx, scope, cwd, rawSource, gitOps: deps.gitOps })`.

   `edge/handlers/marketplace/remove.ts` -- factory `makeRemoveHandler()`. Single positional `name`. Delegate to `removeMarketplace({ ctx, scope: parsed.scope, cwd, name })`. Scope is optional -- orchestrator resolves via resolveScopeFromState.

   `edge/handlers/marketplace/list.ts` -- plain `handleMarketplaceList(args, ctx)`. Empty positional spec. Delegate to `listMarketplaces({ ctx, scope: parsed.scope, cwd: ctx.cwd })`.

   `edge/handlers/marketplace/update.ts` -- factory `makeMarketplaceUpdateHandler(deps: EdgeDeps)`. Optional positional `name`. Bare -> `updateAllMarketplaces({ ctx, scope, cwd, pluginUpdate: deps.pluginUpdate })`. Named -> `updateMarketplace({ ctx, scope, cwd, name, pluginUpdate: deps.pluginUpdate })`. Verify orchestrator exports.

   `edge/handlers/marketplace/autoupdate.ts` -- dual-form factory `makeAutoupdateHandler(enabled: boolean)`. Optional positional `name`. Delegate to `setMarketplaceAutoupdate({ ctx, cwd, scope, name, enabled })`. Two distinct USAGE strings.

3. Unskip every test in all 9 shim test files (created in Plan 01). Per-shim pattern:
   - Use withHermeticHome + makeCtx helpers from `tests/orchestrators/plugin/install.test.ts` (lift verbatim -- copy/paste at top of each shim test file).
   - For shim error cases: use a no-op pi mock; assert notifications contains an error with USAGE; assert no FS state change.
   - For valid-args cases: invoke handler with hermetic FS pre-seeded (state.json, marketplace.json), assert orchestrator side effects (e.g., plugin install -> assert state.json post-condition).
   - Marketplace update tests need `deps: EdgeDeps` with stubbed `gitOps` (use the `makeMockGitOps` helper from `tests/helpers/git-mock.ts`).

4. Notify-discipline gate: zero direct ctx.ui.notify calls in edge/handlers (excluding comments). Use the shell command in `<verify>` to check.

5. Import-boundary gate: zero imports from persistence/domain/bridges/transaction/platform in edge/handlers (excluding comments).
  </action>
  <verify>
    <automated>node --test "tests/edge/handlers/plugin/install.test.ts" "tests/edge/handlers/plugin/uninstall.test.ts" "tests/edge/handlers/plugin/update.test.ts" "tests/edge/handlers/plugin/list.test.ts" "tests/edge/handlers/marketplace/add.test.ts" "tests/edge/handlers/marketplace/remove.test.ts" "tests/edge/handlers/marketplace/list.test.ts" "tests/edge/handlers/marketplace/update.test.ts" "tests/edge/handlers/marketplace/autoupdate.test.ts" &amp;&amp; bash scripts/check-edge-discipline.sh || node -e 'const {execSync}=require("child_process"); const out=execSync("find extensions/pi-claude-marketplace/edge/handlers -name \"*.ts\" -print0 | xargs -0 grep -nE \"ctx\\\\.ui\\\\.notify|from \\\".*(persistence|domain|bridges|transaction|platform)/\" || true").toString(); const nonComment=out.split(\"\\n\").filter(l=>l.trim()&&!/:\\s*\\/\\//.test(l)); if(nonComment.length){console.error(\"discipline violations\\n\"+nonComment.join(\"\\n\"));process.exit(1)}'</automated>
  </verify>
  <done>All 9 handler files exist; all 9 shim test files unskipped and green; the discipline check shows zero direct notify calls and zero forbidden imports in edge/handlers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement edge/handlers/tools.ts (two LLM tools) + unskip tools.test.ts</name>
  <files>extensions/pi-claude-marketplace/edge/handlers/tools.ts, tests/edge/handlers/tools.test.ts</files>
  <behavior>
- registerListMarketplacesTool(pi) registers tool name "pi_claude_marketplace_list" with empty params.
- pi_claude_marketplace_list execute body: load state for both scopes, render one line per marketplace as `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`, return `{ content: [{ type: "text", text }], details: { marketplaces } }`. Empty -> text "No marketplaces configured." + details.marketplaces = [].
- registerListPluginsTool(pi) registers tool name "pi_claude_marketplace_plugin_list" with D-02 params.
- pi_claude_marketplace_plugin_list execute body: apply marketplace filter (if set), scope filter (if set), bucket-union filter (PL-1 semantics), return one line per plugin + details.plugins.
- Plugin count for pi_claude_marketplace_list per marketplace = Object.keys(mp.plugins).length.
- Marketplace-not-found case (pi_claude_marketplace_plugin_list with bad marketplace name) -> text `Marketplace "<name>" not found.` + details.plugins = []. NOT isError: true (V1 returns it as text content, not error). Verify V1 behavior with `git show features/initial:extensions/pi-claude-marketplace/commands/list-marketplaces.ts`.
  </behavior>
  <action>
1. Run `git show features/initial:extensions/pi-claude-marketplace/commands/list-marketplaces.ts` to recover the V1 source. Port the file structure verbatim to `extensions/pi-claude-marketplace/edge/handlers/tools.ts` with three refinements:
   - Import path adjustments (V1 imports from `../types.ts` -> new imports from `../../shared/types.ts`, etc.).
   - Adapt to new state schema (Phase 2 D-09): no `plugin.installed` boolean; presence in `mp.plugins[name]` === installed.
   - Extend `pi_claude_marketplace_plugin_list` parameters with the four new filters (marketplace, scope, installed, available, unavailable) per D-02.

2. Define the two TypeBox parameter schemas inline at the top of the file:
   - `LIST_MARKETPLACES_PARAMS = Type.Object({})`.
   - `LIST_PLUGINS_PARAMS = Type.Object({ marketplace: Type.Optional(...), scope: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("project")])), installed: Type.Optional(Type.Boolean()), available: Type.Optional(Type.Boolean()), unavailable: Type.Optional(Type.Boolean()) })`.

3. Implement execute bodies:

   For `pi_claude_marketplace_list`:
   - Load state for user + project scope.
   - For each scope, iterate `state.marketplaces`. Emit `[<scope>] <name> -- ${Object.keys(mp.plugins).length} plugin(s) -- <mp.source.logical>`. Source.logical comes from Phase 2 source rendering (verify the actual field name).
   - Empty union -> text "No marketplaces configured." + details.marketplaces = [].

   For `pi_claude_marketplace_plugin_list` (V1 inline loop adapted):
   - Resolve scope set: if params.scope is set, only that scope; else both user + project.
   - Resolve marketplace set: if params.marketplace is set, only that marketplace name across the resolved scopes (if not found in any, return marketplace-not-found text + empty details); else iterate all marketplaces in the resolved scopes.
   - Compute PL-1 filter set: const anyFilter = params.installed || params.available || params.unavailable; const buckets = anyFilter ? { i: !!params.installed, a: !!params.available, u: !!params.unavailable } : { i: true, a: true, u: true }.
   - For each (scope, mp): for each plugin name in mp.plugins -> bucket = "installed". For each plugin in mp's manifest (loaded via loadMarketplaceManifest) NOT in mp.plugins -> run resolveStrict to determine installable; bucket = installable ? "available" : "unavailable".
   - Filter rows by `buckets`; render one line each; collect into details.plugins.
   - Manifest load failure: per TC-8 spirit, the tool surface SHOULD soft-fail. Use a try/catch around `loadMarketplaceManifest` and emit a per-marketplace warning line in the text output but continue to the next marketplace. (V1 may not have this behavior; the tool surface is read-only and a single failing marketplace shouldn't poison the whole list -- adopt the cache layer's TC-8 stance.)

4. The two tools' `description`, `label`, `promptSnippet`, `promptGuidelines` carry forward from V1 verbatim. Verify text via `git show features/initial:extensions/pi-claude-marketplace/commands/list-marketplaces.ts`.

5. Unskip every test in `tests/edge/handlers/tools.test.ts` (~14 cases from Plan 01). Test pattern:
   - Use the `makeMockPi` helper that records `registerTool` calls and exposes the registered tool's `execute`:
     - `function makeMockPi(): { pi, registered: Map<string, ToolDefinition> } { ... pi.registerTool = tool => registered.set(tool.name, tool); ... }`
   - For populated state, use `withHermeticHome` + seed state.json + marketplace manifest files on disk.
   - Invoke `registered.get("pi_claude_marketplace_list")!.execute("call-1", {}, undefined, undefined, ctx)`.
   - Assert return.content[0].text matches the expected lines; assert details.marketplaces array.

6. Notify-discipline gate: tools.ts MUST NOT call ctx.ui.notify directly. (LLM tools don't emit user notifications anyway; they return text in the AgentToolResult.)

7. Import-boundary gate: tools.ts MAY import from persistence (it needs `loadState`) -- WAIT, edge/ cannot import persistence/ per BLOCK C. The tool execute body needs state.json contents -- the cleanest resolution is to make the tool a thin shim that delegates to an orchestrator-side reader, OR -- since `orchestrators/marketplace/list.ts` already does the heavy lifting for `pi_claude_marketplace_list` and `orchestrators/plugin/list.ts` for `pi_claude_marketplace_plugin_list` -- the tool delegates to those orchestrators and captures their output.

   **DECISION:** Tool execute bodies delegate to the corresponding orchestrators when possible. Specifically:
   - pi_claude_marketplace_list: call `listMarketplaces({ ctx, scope: undefined, cwd: ctx.cwd })` -- BUT listMarketplaces calls `notifySuccess` rather than returning text. Two options:
     (a) Refactor listMarketplaces to also return its rendered text + details, and have it emit via notify only when invoked via the slash command.
     (b) Tool execute body re-renders by calling `loadVisibleMarketplaces` (orchestrator helper if exposed) or by calling `presentation/marketplace-list.renderMarketplaceList` directly.

   **PLANNER PICKS option (b):** import `presentation/marketplace-list.renderMarketplaceList` (a pure renderer that returns string) and the orchestrator-side helper that loads the marketplace list across scopes (likely exported from `orchestrators/marketplace/list.ts` or its `shared.ts`). The tool body becomes: load marketplaces -> renderMarketplaceList -> wrap in AgentToolResult.

   - pi_claude_marketplace_plugin_list: same approach. Use `presentation/plugin-list.renderPluginList` + the orchestrator's loader.

   This honors BLOCK C: edge/handlers/tools.ts imports from orchestrators/, presentation/, shared/ ONLY. Verify those exports exist; if a needed loader is not exported, refactor that orchestrator to export it (a small backward-compatible change).

   If the orchestrators do NOT expose a clean loader function, the alternative is to delegate to the orchestrators and capture their notifications -- but that's brittle. The clean fix is to export a `loadVisibleMarketplaces(ctx, cwd, scope?)` helper from `orchestrators/marketplace/shared.ts` and a `loadPluginListPayload(opts)` from `orchestrators/plugin/list.ts` if they don't already exist. Implementers MAY add these exports in this plan since they're small, additive, and orchestrator-internal.
  </action>
  <verify>
    <automated>node --test tests/edge/handlers/tools.test.ts &amp;&amp; node -e 'const {execSync}=require("child_process"); const out=execSync("grep -nE \"from \\\".*(persistence|domain|bridges|transaction|platform)/\" extensions/pi-claude-marketplace/edge/handlers/tools.ts || true").toString(); const nonComment=out.split(\"\\n\").filter(l=>l.trim()&&!/^\\s*\\/\\//.test(l.split(\":\").slice(2).join(\":\"))); if(nonComment.length){console.error(\"forbidden imports in tools.ts:\\n\"+nonComment.join(\"\\n\"));process.exit(1)} const out2=execSync("grep -nE \"ctx\\\\.ui\\\\.notify\" extensions/pi-claude-marketplace/edge/handlers/tools.ts || true").toString(); if(out2.trim()){console.error(\"direct notify in tools.ts:\\n\"+out2);process.exit(2)} console.log(\"ok\")' &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/pi-claude-marketplace/edge/handlers/tools.ts tests/edge/handlers/tools.test.ts</automated>
  </verify>
  <done>tools.ts exists with both registerListMarketplacesTool and registerListPluginsTool; LLM-tool tests fully unskipped and green; PL-1 union filter semantics verified; the tool execute bodies import only from orchestrators/presentation/shared (BLOCK C honored); zero direct notify calls.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User-provided slash command arguments -> handler parseCommandArgs | Untrusted input crosses here; mitigated by AP-2 --scope validation, AP-1 tokenizer (no shell injection), and per-handler positional spec |
| LLM-provided tool parameters -> tool execute body | LLM may invoke tools with arbitrary string params; mitigated by TypeBox parameter validation (Pi validates against the schema before invoking execute) and by the fact that marketplace name params are only used as map-key lookups, never as paths |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-EDGE-5 | Tampering | LLM tool param coercion -- hostile LLM could call pi_claude_marketplace_plugin_list with marketplace path traversal | mitigate | The `marketplace` param is used solely as an object key lookup in `state.marketplaces[name]`. It is NEVER joined into a path inside the tool execute body. If a marketplace name in state.json was malicious, the existing assertSafeName guard at marketplace-add time (Phase 4) would have rejected it. The tool itself does no path composition with the parameter. |
| T-EDGE-7 | Information Disclosure | Tool returns marketplace + plugin names | accept | This is the intended behavior of a read-only inspection tool. Names are not sensitive. No file contents or secrets are exposed. |
| T-EDGE-8 | Denial-of-Service | Hostile LLM rapid-fires the tool | accept | Pi controls invocation rate; per-call cost is bounded by the marketplace + plugin cardinality. No amplification vector. |

All threats LOW; no blockers (security_block_on default high).
</threat_model>

<verification>
- 10 new handler files exist under edge/handlers/.
- 10 test files have all stubs unskipped and passing (>= 55 newly-green tests).
- Notify-discipline check: zero direct `ctx.ui.notify` calls in edge/handlers (excluding comments).
- Import-boundary check: zero imports from persistence/domain/bridges/transaction/platform in edge/handlers (excluding comments).
- `npm run check` exits 0.
- Both LLM tools registered with the correct names (pi_claude_marketplace_list, pi_claude_marketplace_plugin_list).
- PL-1 union semantics verified: no filters -> all three buckets; one or more filters -> union of those.
</verification>

<success_criteria>
- Slash-command handlers are functionally complete (just need register.ts to wire them into Pi -- Plan 05).
- LLM tools are functionally complete (registered via Plan 05's registerClaudeMarketplaceTools).
- Status semantics (Phase 2 D-09: presence == installed) reflected throughout.
- D-02 exhaustively realized: two read-only tools, no mutating tool surface.
</success_criteria>

<output>
After completion, create `.planning/phases/06-edge-layer-tab-completion/06-04-SUMMARY.md` noting:
- Each shim file with its USAGE string and orchestrator-option construction.
- Tactical decisions adopted: inline param schemas, V1-parity execute bodies, no orchestrator refactor for list-plugins.
- Any orchestrator-internal helpers added/exported to enable tool execute bodies (loadVisibleMarketplaces, etc., if needed).
- The notify-discipline and import-boundary self-invariant grep gates and their passing state.
</output>

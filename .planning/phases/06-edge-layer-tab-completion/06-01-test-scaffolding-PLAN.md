---
phase: 06-edge-layer-tab-completion
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - tests/edge/args.test.ts
  - tests/edge/args-schema.test.ts
  - tests/edge/router.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/completions/data.test.ts
  - tests/edge/completions/normalize.test.ts
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
  - tests/edge/register.test.ts
  - tests/shared/completion-cache.test.ts
autonomous: true
requirements:
  - AP-1
  - AP-2
  - AP-3
  - AP-4
  - TC-1
  - TC-2
  - TC-3
  - TC-4
  - TC-5
  - TC-6
  - TC-7
  - TC-8
  - TC-9
must_haves:
  truths:
    - "Every REQ-ID in this phase has at least one test file with a skipped stub naming the behavior"
    - "`node --test tests/edge/**/*.test.ts tests/shared/completion-cache.test.ts` exits 0 (skipped tests count as pass)"
    - "`npm run check` exits 0 (current 592-test baseline plus new skipped suites)"
    - "Each new test file imports the target module as `// @ts-expect-error -- created in Wave 1+` (TypeScript strict surface stays green)"
  artifacts:
    - path: tests/edge/args.test.ts
      provides: "AP-1, AP-2, AP-4 skipped test stubs"
    - path: tests/edge/args-schema.test.ts
      provides: "schema-driven validation skipped stubs"
    - path: tests/edge/router.test.ts
      provides: "AP-3 + dispatch (including rm alias) skipped stubs"
    - path: tests/edge/completions/provider.test.ts
      provides: "TC-1..TC-6 skipped stubs"
    - path: tests/edge/completions/normalize.test.ts
      provides: "TC-7 + isClaudePluginCommandLine regex skipped stubs"
    - path: tests/edge/completions/data.test.ts
      provides: "Cache-backed accessor skipped stubs"
    - path: tests/shared/completion-cache.test.ts
      provides: "Cache primitives, TC-8, TC-9, 10-min TTL with clock injection skipped stubs"
    - path: tests/edge/handlers/plugin/install.test.ts
      provides: "Install shim parse+delegate skipped stubs"
    - path: tests/edge/handlers/plugin/uninstall.test.ts
      provides: "Uninstall shim stubs"
    - path: tests/edge/handlers/plugin/update.test.ts
      provides: "Update shim stubs (incl. bare @<marketplace>)"
    - path: tests/edge/handlers/plugin/list.test.ts
      provides: "Plugin list shim stubs"
    - path: tests/edge/handlers/marketplace/add.test.ts
      provides: "Marketplace add shim stubs"
    - path: tests/edge/handlers/marketplace/remove.test.ts
      provides: "Marketplace remove shim stubs"
    - path: tests/edge/handlers/marketplace/list.test.ts
      provides: "Marketplace list shim stubs"
    - path: tests/edge/handlers/marketplace/update.test.ts
      provides: "Marketplace update shim stubs"
    - path: tests/edge/handlers/marketplace/autoupdate.test.ts
      provides: "Autoupdate/noautoupdate dual-form shim stubs"
    - path: tests/edge/handlers/tools.test.ts
      provides: "LLM tool execute + PL-1 union filter skipped stubs (D-02)"
    - path: tests/edge/register.test.ts
      provides: "registerClaudePluginCommand + registerClaudeMarketplaceTools wiring stubs (D-04)"
  key_links:
    - from: tests/edge/args.test.ts
      to: extensions/pi-claude-marketplace/edge/args.ts
      via: "import { parseArgs } from \"../../extensions/pi-claude-marketplace/edge/args.ts\""
      pattern: "import.*edge/args"
    - from: tests/shared/completion-cache.test.ts
      to: extensions/pi-claude-marketplace/shared/completion-cache.ts
      via: "import * as cache from \"../../extensions/pi-claude-marketplace/shared/completion-cache.ts\""
      pattern: "import.*shared/completion-cache"
---

<objective>
Create skipped test stubs for every Phase 6 REQ-ID and decision (AP-1..4, TC-1..9, D-02, D-03 TTL/invalidation, D-04). Each new test file lists the behaviors it will exercise via `test.skip(...)` so the Nyquist sampler can confirm one automated verification command per requirement BEFORE the production modules exist.

Purpose: Wave 0 gate per `workflow.nyquist_validation`. Subsequent waves (1, 2, 3, 4) unskip stubs as the corresponding modules land -- a green `npm test` at every wave boundary.

Output: 18 new test files under `tests/edge/**` and `tests/shared/completion-cache.test.ts`, all skipped, all importing the (not-yet-existing) target modules under `// @ts-expect-error` so TypeScript stays green.
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md
@.planning/phases/06-edge-layer-tab-completion/06-VALIDATION.md
@.planning/phases/06-edge-layer-tab-completion/06-PATTERNS.md
@.planning/REQUIREMENTS.md

<!-- Phase 5 scaffolding to mirror -->
@tests/orchestrators/plugin/install.test.ts
@tests/orchestrators/marketplace/list.test.ts

<interfaces>
<!-- Test header pattern that EVERY new Phase 6 test file must use to stay TypeScript-strict-clean before the production module exists. -->

```typescript
import { test } from "node:test";

// @ts-expect-error -- module created in a later Phase 6 wave.
import * as _target from "../../extensions/pi-claude-marketplace/edge/args.ts";

void _target;  // silence "imported but unused" lint

test.skip("AP-1 :: tokenizer accepts single-quoted spaced argument", () => {});
test.skip("AP-1 :: tokenizer accepts double-quoted spaced argument", () => {});
test.skip("AP-2 :: --scope rejects missing value with clear error", () => {});
// ... etc
```

Key invariants:
- Use `test.skip(name, () => {})` -- not `test.todo` (which doesn't surface in skipped-count).
- The body MUST be `() => {}` (no assertions) so the skip is unconditional and never throws.
- The `// @ts-expect-error` directive is required because the target file does not yet exist; once the module lands in Wave 1+, executors REMOVE the directive and unskip the relevant test.
- One test per leaf behavior (don't bundle several behaviors per `test.skip`). The verifier counts tests, not files.

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create pure-unit test stubs for parser layer (args, args-schema, router, normalize)</name>
  <files>tests/edge/args.test.ts, tests/edge/args-schema.test.ts, tests/edge/router.test.ts, tests/edge/completions/normalize.test.ts</files>
  <action>
Create FOUR test files. Each file:

1. Imports the not-yet-existing target module with `// @ts-expect-error -- module created in Wave 1 (06-02-PLAN).`
2. Includes `void _target;` to satisfy the no-unused-import rule
3. Uses `test.skip(name, () => {})` for every behavior

**tests/edge/args.test.ts** -- target `extensions/pi-claude-marketplace/edge/args.ts`. One `test.skip` per case (use these exact names):
- "AP-1 :: tokenize bare string"
- "AP-1 :: tokenize single-quoted spaced argument"
- "AP-1 :: tokenize double-quoted spaced argument"
- "AP-1 :: tokenize mixed quotes in same input"
- "AP-1 :: tokenize unicode/non-ASCII positionals"
- "AP-2 :: --scope user is valid"
- "AP-2 :: --scope project is valid"
- "AP-2 :: --scope missing value throws clear error"
- "AP-2 :: --scope invalid value (foo) throws clear error"
- "AP-4 :: --scope accepted at position 0"
- "AP-4 :: --scope accepted at middle position"
- "AP-4 :: --scope accepted at end position"
- "AP-4 :: positionals extracted in order regardless of --scope position"

**tests/edge/args-schema.test.ts** -- target `extensions/pi-claude-marketplace/edge/args-schema.ts`. Cases:
- "parseCommandArgs :: required positional missing emits usage via notifyError and returns undefined"
- "parseCommandArgs :: optional positional missing returns parsed with property undefined"
- "parseCommandArgs :: tokenizer throw routes through notifyError + returns undefined"
- "parseCommandArgs :: typed return shape (compile-time check)"

**tests/edge/router.test.ts** -- target `extensions/pi-claude-marketplace/edge/router.ts`. Cases:
- "AP-3 :: empty input emits TOP_LEVEL_USAGE at error severity"
- "AP-3 :: unknown subcommand emits Unknown subcommand: + TOP_LEVEL_USAGE at error severity"
- "AP-3 :: marketplace with empty rest emits MARKETPLACE_USAGE at error severity"
- "AP-3 :: marketplace with unknown verb emits Unknown subcommand: + MARKETPLACE_USAGE"
- "routeClaudePlugin :: dispatches install to handlers.install"
- "routeClaudePlugin :: dispatches uninstall to handlers.uninstall"
- "routeClaudePlugin :: dispatches update to handlers.update"
- "routeClaudePlugin :: dispatches list to handlers.list"
- "routeMarketplace :: dispatches add to handlers.marketplaceAdd"
- "routeMarketplace :: dispatches remove to handlers.marketplaceRemove"
- "routeMarketplace :: dispatches rm alias to handlers.marketplaceRemove (TC-2 surface, alias accepted)"
- "routeMarketplace :: dispatches list to handlers.marketplaceList"
- "routeMarketplace :: dispatches update to handlers.marketplaceUpdate"
- "routeMarketplace :: dispatches autoupdate to handlers.marketplaceAutoupdate"
- "routeMarketplace :: dispatches noautoupdate to handlers.marketplaceNoautoupdate"

**tests/edge/completions/normalize.test.ts** -- target `extensions/pi-claude-marketplace/edge/completions/normalize.ts`. Cases:
- "TC-7 :: normalize collapses two spaces at cursor to one"
- "TC-7 :: normalize is a no-op when no doubled space at cursor"
- "TC-7 :: normalize is a no-op at end-of-line trailing space"
- "TC-7 :: normalize is idempotent (stacked wrapper safe)"
- "isClaudePluginCommandLine :: matches /claude:plugin"
- "isClaudePluginCommandLine :: matches /claude:plugin install"
- "isClaudePluginCommandLine :: matches /claude:plugin:42 install (collision suffix)"
- "isClaudePluginCommandLine :: does not match /other-extension"
- "isClaudePluginCommandLine :: does not match claude:plugin (no leading slash)"
- "isClaudePluginCommandLine :: does not match /claude:plugin-extra"

Create parent directories as needed via `mkdir -p tests/edge/completions`.
  </action>
  <verify>
    <automated>node --test tests/edge/args.test.ts tests/edge/args-schema.test.ts tests/edge/router.test.ts tests/edge/completions/normalize.test.ts 2>&amp;1 | grep -E "# (tests|pass|fail|skipped)"</automated>
  </verify>
  <done>All four files exist; `node --test` reports the expected number of skipped tests (sum across files >= 36); zero failures; TypeScript compile clean (`tsc --noEmit` would pass because of `@ts-expect-error`).</done>
</task>

<task type="auto">
  <name>Task 2: Create integration test stubs for completions provider, data accessor, and cache</name>
  <files>tests/edge/completions/provider.test.ts, tests/edge/completions/data.test.ts, tests/shared/completion-cache.test.ts</files>
  <action>
Create THREE test files with skipped stubs.

**tests/edge/completions/provider.test.ts** -- target `extensions/pi-claude-marketplace/edge/completions/provider.ts`. One `test.skip` per case:
- "TC-1 :: first positional surfaces top-level keywords (install/uninstall/update/list/marketplace)"
- "TC-1 :: top-level keyword filtering by prefix (\"ins\" -> install only)"
- "TC-2 :: after marketplace surfaces nested keywords (add/remove/list/update/autoupdate/noautoupdate)"
- "TC-2 :: nested keyword set excludes rm (surfaced only via router alias)"
- "TC-3 :: - prefix surfaces --scope"
- "TC-3 :: - prefix on list head also surfaces --installed/--available/--unavailable"
- "TC-3 :: -- and - prefixes behave identically"
- "TC-4 :: token after --scope surfaces user and project only"
- "TC-5 :: list <here> completes with union of marketplace names from both scopes"
- "TC-5 :: marketplace remove <here> completes with marketplace names"
- "TC-5 :: marketplace update <here> completes with marketplace names"
- "TC-5 :: marketplace autoupdate <here> completes with marketplace names"
- "TC-5 :: marketplace noautoupdate <here> completes with marketplace names"
- "TC-6 :: install <here> -- status filter excludes installed plugins"
- "TC-6 :: install <here> -- status filter INCLUDES unavailable plugins (D-03 corollary, future --force)"
- "TC-6 :: uninstall <here> -- status filter shows only installed plugins"
- "TC-6 :: update <here> -- status filter shows only installed plugins"
- "TC-6 :: update accepts bare @<marketplace> form"
- "TC-6 :: unique plugin yields name@mp with trailing space"
- "TC-6 :: multi-marketplace plugin yields name@ without trailing space"
- "TC-7 :: all terminal completions include trailing space (TC-1 case)"
- "TC-8 :: per-marketplace manifest load failure soft-fails to empty list (no throw)"
- "TC-9 :: state.json error propagates (throw escapes getArgumentCompletions)"
- "no-match position returns null (Pi-tui sentinel; not [])"

**tests/edge/completions/data.test.ts** -- target `extensions/pi-claude-marketplace/edge/completions/data.ts`. Cases:
- "getMarketplaceNamesAcrossScopes :: dedupes overlapping names from user and project"
- "getPluginToMarketplacesMap :: install mode filters status === installed out, keeps available + unavailable"
- "getPluginToMarketplacesMap :: uninstall mode keeps only installed"
- "getPluginToMarketplacesMap :: update mode keeps only installed"
- "getPluginToMarketplacesMap :: cross-marketplace plugin appears with both marketplace names"
- "buildItem :: reconstructs argumentText prefix + chosen text + trailing space"
- "splitCompletionInput :: trailing space yields empty current and full tokens"
- "splitCompletionInput :: no trailing space yields last token as current"
- "extractPositionals :: skips --scope <value> pairs"

**tests/shared/completion-cache.test.ts** -- target `extensions/pi-claude-marketplace/shared/completion-cache.ts`. Cases:
- "schemaVersion snapshot :: MARKETPLACE_NAMES_CACHE_SCHEMA.schemaVersion === 1"
- "schemaVersion snapshot :: PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion === 1"
- "getMarketplaceNames :: lazy load on first call; cache hit on second (no rebuild call)"
- "getMarketplaceNames :: in-memory hit serves without file read"
- "getMarketplaceNames :: file hit on memory miss; no rebuild"
- "getMarketplaceNames :: ENOENT triggers rebuild + atomic write"
- "getMarketplaceNames :: schemaVersion mismatch drops + rebuilds"
- "getMarketplaceNames :: corrupt JSON drops + rebuilds"
- "getPluginIndex :: lazy load + cache hit (same as marketplace-names)"
- "D-03-TTL :: getPluginIndex re-reads file after 10-min TTL via injected clock"
- "D-03-TTL :: getPluginIndex serves in-memory before TTL expiry"
- "invalidateMarketplaceNames :: next read rebuilds from authoritative source"
- "invalidateMarketplaceCache :: next read rebuilds (memory dropped, file kept)"
- "dropMarketplaceCache :: removes cache file + memory entry"
- "dropMarketplaceCache :: ENOENT on cache file is silent (file already absent is OK)"
- "TC-8 :: rebuild that throws manifest error caches { plugins: [], _loadError }"
- "TC-8 :: subsequent reads of TC-8-poisoned cache return [] (no throw)"
- "TC-9 :: rebuild that throws state.json error propagates from getMarketplaceNames"
- "TC-9 :: rebuild that throws state.json error propagates from getPluginIndex"

Create `tests/shared/` parent if needed (it already exists per the codebase scan).
  </action>
  <verify>
    <automated>node --test tests/edge/completions/provider.test.ts tests/edge/completions/data.test.ts tests/shared/completion-cache.test.ts 2>&amp;1 | grep -E "# (tests|pass|fail|skipped)"</automated>
  </verify>
  <done>All three files exist; total skipped tests >= 50; zero failures; imports use `@ts-expect-error` for the not-yet-existing modules.</done>
</task>

<task type="auto">
  <name>Task 3: Create handler shim test stubs (9 files), tools test stub, and register test stub</name>
  <files>tests/edge/handlers/plugin/install.test.ts, tests/edge/handlers/plugin/uninstall.test.ts, tests/edge/handlers/plugin/update.test.ts, tests/edge/handlers/plugin/list.test.ts, tests/edge/handlers/marketplace/add.test.ts, tests/edge/handlers/marketplace/remove.test.ts, tests/edge/handlers/marketplace/list.test.ts, tests/edge/handlers/marketplace/update.test.ts, tests/edge/handlers/marketplace/autoupdate.test.ts, tests/edge/handlers/tools.test.ts, tests/edge/register.test.ts</files>
  <action>
Create ELEVEN test files. Standard shim test cases for each handler (use these exact names per handler):

**tests/edge/handlers/plugin/install.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts`. Cases:
- "shim :: missing positional emits USAGE via notifyError; no orchestrator call"
- "shim :: invalid ref (no @) emits USAGE + format error; no orchestrator call"
- "shim :: invalid ref (leading @) emits USAGE + format error"
- "shim :: invalid ref (trailing @) emits USAGE + format error"
- "shim :: valid args call installPlugin with { ctx, pi, scope: \"user\", cwd, marketplace, plugin }"
- "shim :: --scope project calls installPlugin with scope: \"project\""

**tests/edge/handlers/plugin/uninstall.test.ts** -- same six cases s/install/uninstall/ s/installPlugin/uninstallPlugin/.

**tests/edge/handlers/plugin/update.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts`. Cases:
- "shim :: bare /update with no positional calls updatePlugins with target = all-plugins-all-marketplaces"
- "shim :: <plugin>@<marketplace> form calls updatePlugins with single-plugin target"
- "shim :: bare @<marketplace> form calls updatePlugins with all-plugins-one-marketplace target"
- "shim :: --scope user/project propagated to updatePlugins"
- "shim :: invalid ref (no @, not bare) emits USAGE"

**tests/edge/handlers/plugin/list.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`. Cases:
- "shim :: bare /list calls listPlugins with no marketplace, no scope, no filter flags"
- "shim :: list <marketplace> calls listPlugins with marketplace argument"
- "shim :: --installed flag calls listPlugins with installed: true"
- "shim :: --available flag calls listPlugins with available: true"
- "shim :: --unavailable flag calls listPlugins with unavailable: true"
- "shim :: --installed --available union flags both propagated"

**tests/edge/handlers/marketplace/add.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts`. Cases:
- "shim :: missing source positional emits USAGE; no orchestrator call"
- "shim :: valid source calls addMarketplace with { ctx, scope: \"user\", cwd, rawSource, gitOps: deps.gitOps }"
- "shim :: --scope project propagated to addMarketplace"
- "shim :: deps.gitOps is passed through from EdgeDeps"

**tests/edge/handlers/marketplace/remove.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts`. Cases:
- "shim :: missing name positional emits USAGE"
- "shim :: valid name calls removeMarketplace with { ctx, scope?, cwd, name }"
- "shim :: --scope user/project propagated"

**tests/edge/handlers/marketplace/list.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts`. Cases:
- "shim :: no positional calls listMarketplaces with scope: undefined"
- "shim :: --scope user calls listMarketplaces with scope: \"user\""
- "shim :: --scope project calls listMarketplaces with scope: \"project\""

**tests/edge/handlers/marketplace/update.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts`. Cases:
- "shim :: bare /marketplace update calls updateAllMarketplaces"
- "shim :: named /marketplace update <name> calls updateMarketplace with name"
- "shim :: --scope user/project propagated"
- "shim :: deps.pluginUpdate passed through to orchestrator for cascade"

**tests/edge/handlers/marketplace/autoupdate.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts`. Cases:
- "dual-form :: makeAutoupdateHandler(true) calls setMarketplaceAutoupdate with enabled: true"
- "dual-form :: makeAutoupdateHandler(false) calls setMarketplaceAutoupdate with enabled: false"
- "shim :: bare form (no name) propagates name: undefined"
- "shim :: named form propagates name"
- "shim :: --scope user/project propagated"

**tests/edge/handlers/tools.test.ts** -- target `extensions/pi-claude-marketplace/edge/handlers/tools.ts`. Cases:
- "D-02 :: registerListMarketplacesTool registers tool name pi_claude_marketplace_list with empty params schema"
- "D-02 :: registerListPluginsTool registers tool name pi_claude_marketplace_plugin_list with extended params"
- "pi_claude_marketplace_list :: empty state returns content text \"No marketplaces configured.\" + details.marketplaces == []"
- "pi_claude_marketplace_list :: populated state returns one line per marketplace formatted [<scope>] <name> -- <N> plugin(s) -- <source.logical>"
- "pi_claude_marketplace_plugin_list :: marketplace set, marketplace exists -> plugins from that marketplace"
- "pi_claude_marketplace_plugin_list :: marketplace set, marketplace not found -> error text + details.plugins == []"
- "pi_claude_marketplace_plugin_list :: marketplace omitted -> enumerate across all marketplaces"
- "pi_claude_marketplace_plugin_list :: installed: true filter -> only installed bucket"
- "pi_claude_marketplace_plugin_list :: available: true filter -> only available bucket"
- "pi_claude_marketplace_plugin_list :: unavailable: true filter -> only unavailable bucket"
- "pi_claude_marketplace_plugin_list :: available: true + unavailable: true -> union of both (PL-1)"
- "pi_claude_marketplace_plugin_list :: no filters -> all three buckets (PL-1 default)"
- "pi_claude_marketplace_plugin_list :: scope: \"user\" filters to user scope only"
- "pi_claude_marketplace_plugin_list :: scope: \"project\" filters to project scope only"

**tests/edge/register.test.ts** -- target `extensions/pi-claude-marketplace/edge/register.ts`. Cases:
- "D-04 :: registerClaudePluginCommand registers claude:plugin command on pi"
- "D-04 :: registered command has a handler that routes through routeClaudePlugin"
- "D-04 :: registered command has getArgumentCompletions returning AutocompleteItem[] | null"
- "D-04 :: registerClaudePluginCommand also calls pi.on(\"session_start\", ...) exactly once"
- "D-04 :: firing the session_start handler installs an autocomplete provider via ctx.ui.addAutocompleteProvider"
- "D-04 :: the installed wrapper applies normalizeCompletionWhitespace only to lines matching isClaudePluginCommandLine"
- "D-04 :: the installed wrapper is a no-op for non-/claude:plugin lines"
- "D-04 :: registerClaudeMarketplaceTools calls pi.registerTool exactly twice"
- "D-04 :: registerClaudeMarketplaceTools registers pi_claude_marketplace_list"
- "D-04 :: registerClaudeMarketplaceTools registers pi_claude_marketplace_plugin_list"

Create parent directories as needed.
  </action>
  <verify>
    <automated>node --test tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/list.test.ts tests/edge/handlers/marketplace/add.test.ts tests/edge/handlers/marketplace/remove.test.ts tests/edge/handlers/marketplace/list.test.ts tests/edge/handlers/marketplace/update.test.ts tests/edge/handlers/marketplace/autoupdate.test.ts tests/edge/handlers/tools.test.ts tests/edge/register.test.ts 2>&amp;1 | grep -E "# (tests|pass|fail|skipped)"</automated>
  </verify>
  <done>All 11 files exist; total skipped tests >= 55; zero failures; `npm run check` still exits 0 (baseline maintained because `@ts-expect-error` covers the missing imports).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| n/a | Wave 0 produces only skipped test stubs. No production code, no untrusted input crosses any boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-EDGE-W0-01 | Tampering | Test stub files | accept | Stubs are inert (`() => {}` body) and skipped; no execution path can be tampered to affect production state |

No new threats. Inherited Phase 6 threats (T-EDGE-1..5) all apply to Wave 1-4 production modules, not Wave 0 test stubs.
</threat_model>

<verification>
- All 18 test files exist under the listed paths.
- `node --test tests/edge/**/*.test.ts tests/shared/completion-cache.test.ts` exits 0, reports >= 141 skipped tests (sum across the three tasks), zero failures.
- `npm run check` exits 0 (typecheck + lint + format + tests). The `@ts-expect-error` directives MUST cover the not-yet-existing imports -- if `tsc` reports an "unused @ts-expect-error" error, the lint passes because the import is genuinely failing; if it reports a real type error, fix the import path.
- Every REQ-ID in the phase frontmatter has at least one `test.skip` line naming it (greppable via `grep -r 'AP-1 ::' tests/edge/`).
</verification>

<success_criteria>
- 18 new test files created.
- >=141 skipped tests across the new files.
- Zero test failures.
- `npm run check` green.
- Every Phase 6 REQ-ID (AP-1, AP-2, AP-3, AP-4, TC-1..9) is named in at least one `test.skip` title.
</success_criteria>

<output>
After completion, create `.planning/phases/06-edge-layer-tab-completion/06-01-SUMMARY.md` per the standard template, noting:
- Files created (full list)
- Total skipped test count per file
- REQ-ID coverage matrix (each ID -> file name(s))
- Any deviations from the planned test names (if any)
</output>

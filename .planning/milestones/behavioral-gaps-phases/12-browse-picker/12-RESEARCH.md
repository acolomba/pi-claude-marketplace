# Phase 12: Browse Picker - Research

**Researched:** 2026-11-08
**Domain:** Pi extension edge layer (`/claude:plugin browse` picker), cucumber terminal scenarios
**Confidence:** HIGH (every scenario mechanic below was run in a terminal Pi during this research)

## Summary

The count fix is small and stays in the two owned product files. `edge/handlers/plugin/browse.ts::loadMarketplaceEntries` reads each record's catalog through the read-only, memoized, network-free `domain/manifest.ts::loadMarketplaceManifest(recordedManifestPath(record))`, the same loader `orchestrators/plugin/list-flow.ts` uses, and counts `manifest.plugins.length`. A read that throws leaves the count `undefined`. `edge/browser/plugin-browser.ts::showMarketplaces` formats the row as `{n} available`, then ` • {m} installed` when `m > 0`, then ` -- {source}`. The edge layer may import `domain/` and `orchestrators/`, and both fallow and ESLint allow it.

Every behavior the scenarios need already works and can be driven with frozen steps only. I ran two scratch feature files in a terminal Pi. They live in the scratchpad, outside `features/`, so no repo file changed. The results: a bare `/claude:plugin` typed in Pi's terminal opens the picker. `browse` with no marketplace shows `(no marketplaces)`. The plugins screen shows `[installed]`, `[unavailable]`, and `[available]` rows with their versions as descriptions. Choosing `Project` or `Project local (Recommended)` declares the plugin in the right config file, and `list --installed` then shows it. Remembering the scope bytes before the terminal Pi starts and cancelling leaves them unchanged. The phase needs no new step, so it does not create `features/step_definitions/plugin/browse.steps.ts`.

Each terminal scenario costs about 5 s serially, and 5 s more when it ends with the picker still open: Pi's two-Ctrl-C quit does not close the picker, so the harness waits for its 5 s stop limit and kills Pi. Seven terminal scenarios (down from eight, by folding the first-screen seed into the counts walk) cover every CONTEXT decision.

**Primary recommendation:** Two sequential plans. Plan 01 makes the count fix with its unit tests and rewrites the first-screen seed into the counts walk. Plan 02 adds the install, cancel, and empty-list scenarios. Both plans use frozen steps only, and every new scenario gets a product-mutation red proof.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upstream evidence records

- **Marketplace row count.** Claude Code's `/plugin` "Manage marketplaces" list renders each marketplace as its name, its source, then `{pluginCount} available`, then ` • {n} installed` only when `n > 0`, then ` • Updated {date}` when it has one. `pluginCount` is `F?.plugins.length`, the number of entries in the marketplace's catalog (`marketplace.json`), installed or not; `installedPlugins` are the installed plugins whose id ends in `@<marketplace>`. When the catalog cannot be read, `pluginCount` is undefined and the count is left out. The marketplace's own menu offers `Browse plugins (${pluginCount ?? 0})`. Evidence: the 2.1.319 binary (functions building the `Manage marketplaces` rows and `hd(...)`, which sets `pluginCount:F?.plugins.length`). Confidence: high. Pi's row (`{n} plugin(s) -- {source}`, with `n = Object.keys(record.plugins).length`) counts the installed plugins, so a marketplace that offers plugins and has none installed reads `0 plugin(s)`.
- **Where a chosen plugin installs.** Claude Code asks the user: `Install for you (user scope)`, `Install for all collaborators on this repository (project scope)`, `Install for you, in this repo only (local scope)`, in that order, then extra links and `Back to plugin list` (function `xu` in 2.1.319). Marketplaces are not scoped upstream. Confidence: high. Pi's picker already asks the scope on its fourth screen: `Project local (Recommended)` (project scope, `claude-plugins.local.json`), `Project`, `User (global)`. SC-1 removes Claude Code's `local` scope; the Pi `--local` layer stands in for it. BROWSE-02's draft "installs it in its marketplace's scope" is refined by this research: the plugin installs in the scope the user picks.
- **Installed plugins in a marketplace's plugin list.** Claude Code's browse list of a marketplace shows installed plugins too, marked with a tick in the success color, and Enter on an installed plugin opens its management view (`isInstalled` → `manage-plugins` with `targetPlugin`), not an install. Its Discover tab hides installed plugins (`All available plugins are already installed.`). Confidence: high for the browse list. Pi's plugins screen tags an installed plugin `[installed]` with its version and offers `Uninstall`, `Disable`, and `Info`, which matches the upstream shape (a management choice instead of an install).
- **Unavailable plugins.** No upstream position was found for how the browse list shows a catalog entry that cannot be installed (low confidence; the binary was not probed). Pi tags it `[unavailable]`, describes it `not installable`, and offers only `Info`.

#### Marketplace row (BROWSE-01)

- **D-BG-1201 — the row counts the catalog's plugins, as Claude Code does.** The first screen's description for each marketplace becomes `{offered} available`, then ` • {installed} installed` when at least one of its plugins is installed in that marketplace's scope, then ` -- {source}`. `offered` is the number of plugin entries in the marketplace's `marketplace.json`; `installed` is the number of plugins its installation record holds. When the manifest cannot be read, the `available` part is left out, as upstream leaves out the count (the row then starts with the installed part, or with the source alone). The `-- {source}` tail and the `•` separator are Pi's existing picker grammar (the hint rows already use `•`); Pi records no last-updated date for the row, so upstream's `Updated` part is not added. The Phase 1 seed's rows change from `0 plugin(s)` to `1 available` and `2 available`, and a new scenario pins a marketplace with an installed plugin (`2 available • 1 installed`). Alternative rejected: keep `{n} plugin(s)` and only change what `n` counts (keeps the ambiguous word that let the bug read as correct, and loses upstream's installed count).
- The manifest is read through the existing read-only manifest loader (`loadMarketplaceManifest` on the record's manifest path, or the helper the list flow already uses), so `browse` stays network-free (NFR-5) and writes nothing.

#### Scenarios (BROWSE-01, BROWSE-02)

- **Opening.** `/claude:plugin browse` and a bare `/claude:plugin` in the terminal both open the picker on `Browse Claude Plugin Marketplaces` with the marketplaces of both scopes, project first (MSG-GR-3). The rpc refusals stay as they are.
- **Plugins screen.** One scenario pins a marketplace's plugin screen with an available, an installed, and an unavailable plugin (a catalog entry whose directory is missing, as `list.feature` builds one), with their tags and descriptions.
- **Actions screen.** The scenarios pin the actions an available plugin offers (`Install`, `Info`) and those an installed plugin offers (`Uninstall`, `Disable`, `Info`), through the screen rows.
- **Installing in each scope.** Choosing `User (global)` installs in the user scope (the seed), choosing `Project` installs in the project scope and declares the plugin in the project's `claude-plugins.json`, and choosing `Project local (Recommended)` installs in the project scope and declares it in `claude-plugins.local.json`. After an install, `/claude:plugin list` (rpc) shows the plugin installed in that scope (BROWSE-02 criterion 2).
- **Cancelling.** Cancelling at the install-scope screen and at the first screen installs nothing and leaves both scopes' config and installation record bytes unchanged (the existing `remembered` and `unchanged` steps), with a plugin already installed in one scope so "as they were" is not just "empty".
- **No marketplaces.** `browse` in the terminal with no marketplace added shows the `(no marketplaces)` result, Pi's existing empty-list grammar (upstream shows `No plugins available.` in its Discover tab; Pi has no tabs, so the list grammar stands).
- Every scenario runs once under the `adapter` profile, with no implementation tag: none has an MCP surface (D-BG-04).
- The terminal scenarios start a terminal Pi each, near the 15 s ready limit under load (P1-DC-65), so the phase keeps their number small and prefers one scenario that pins several screens of one walk over several scenarios that each open the picker.

#### Install-scope screen (pre-existing divergence)

- **D-BG-1202 — the install-scope screen keeps its rows and order.** Pi lists `Project local (Recommended)`, `Project`, `User (global)`; Claude Code lists user, project, local, and marks none recommended. No scenario of this phase exposes a bug there, and reordering it is a picker feature change, which the milestone rules put out of scope. The scenarios pin today's rows, the phase logs the divergence as a dubious choice, and the last plan's SUMMARY lists a BACKLOG parent line for a parity change.

#### Steps

- The phase uses the frozen picker steps (`plugin/picker.steps.ts`) and the shared command, config, and installation steps. It creates `features/step_definitions/plugin/browse.steps.ts` only for a step none of those provide, and keeps every seed step in use.

### Claude's Discretion

- How the count fix is split between `browse.ts` (loading the counts) and `plugin-browser.ts` (formatting the row), and the field names of `MarketplaceEntry`, as long as `demos/browse-demo.ts` (not type-checked, outside the ownership table) still runs or is left untouched with a note.
- Plan count and waves (both plans would edit `browse.feature`, so they cannot share a wave).
- Scenario titles and which walk pins which screen.

### Deferred Ideas (OUT OF SCOPE)

- Reordering and relabeling the install-scope screen to Claude Code's order (user, project, local) without a recommended row (D-BG-1202; BACKLOG parent line).
- Upstream's `Updated {date}` part of the marketplace row (Pi records no such date for the picker).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BROWSE-01 | In the terminal UI, `browse` and a bare `/claude:plugin` open the plugin picker, which lists the marketplaces and plugins of both scopes. | Count fix design (Architecture Patterns, Code Examples); bare command verified in a terminal Pi (Pitfall 1); scenario B (first screen, plugins screen, installed actions); scenario H (empty list) |
| BROWSE-02 | Choosing a plugin in the picker installs it in the scope the user picks (refined by P12-DC-03); cancelling installs nothing. | Scenarios C, D, E (User (global), Project, Project local) with `list --installed` result rows verified; scenarios F, G (cancel at the scope screen and at the first screen) with the byte steps verified |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read a file before editing it, and trace a function's callers before changing it.
- Never commit to `main`. This phase commits only to `features/behavioral-gaps-phase-12`, pushes nothing, opens no PR (child brief section 7).
- Commit titles follow `.agents/skills/committing/SKILL.md`, with no milestone, phase, plan, wave, or task identifier. Never `--no-verify`, `--amend`, rebase, or force push. Before each commit, run `SKIP=npm-check pre-commit run --files <changed files>` and restage what the fixers changed.
- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap (D-BG-1201 and D-BG-1202 here).
- A user-visible `/claude:plugin` change ships with a cucumber scenario under `features/` that fails without the change.
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, boundaries, health with cognitive 15 / cyclomatic 20, dupes), Prettier, pairing, unit, integration, both cucumber profiles, and 100% direct line, function, and branch coverage for each source-test pair.
- Every disk mutation is atomic (NFR-1). `browse` writes nothing itself, and the fix must keep it read-only and network-free (NFR-5).
- Output goes only through `shared/notification-dispatch.ts` (IL-2). The fix adds no notify call.
- Two complexity gates (ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15`) must both pass. Exported functions need explicit return types.
- Comments cite durable IDs (D-BG-1201), never phase or plan numbers. No comments on trivial code.
- Every plan SUMMARY.md has a `## Threat Flags` section and a `## Dubious Choices` section. WINDOWS descriptions start with `[behavioral-gaps]`.
- Frozen files (child brief section 8, ROADMAP "File ownership"): every existing step module, `features/support/**`, `features/lib/**`, `.agents/skills/cucumber/**`, build and CI files, `platform/pi-api.ts`. Owned here: `features/plugin/browse.feature`, the reserved `features/step_definitions/plugin/browse.steps.ts`, `edge/browser/plugin-browser.ts`, `edge/handlers/plugin/browse.ts`, the browse arms of `edge/router.ts`, and their unit pairs.
- Never edited by a stream: `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `.planning/BACKLOG.md`, the root dubious-choices log. Parent lines go in the last plan's SUMMARY.
- Hermetic home: every test or command that could touch `~/.pi/agent` runs with a temporary Pi home. The npm test scripts and the cucumber harness already provide one.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Opening the picker (`browse`, bare command) | Edge (`edge/router.ts`, `edge/handlers/plugin/browse.ts`) | Pi host (`ctx.ui.custom`) | The router maps the bare command to the browse handler; no change is needed |
| Counting a marketplace's offered and installed plugins | Edge handler (`browse.ts::loadMarketplaceEntries`) | Domain (`domain/manifest.ts`), Orchestrators (`marketplace/shared.ts`) | The handler builds the first screen's data. It reads through the domain manifest seam (NFR-8), never with its own `readFile` |
| Rendering the marketplace row text | Edge UI (`edge/browser/plugin-browser.ts::showMarketplaces`) | — | `PluginBrowser` is pure UI with injected data |
| Listing a marketplace's plugins | Orchestrators (`list-flow.ts::loadPluginListPayload`) | Edge UI | Already lazy-loaded through `makePluginLoader`; unchanged |
| Installing the chosen plugin | Orchestrators (install flow, reached through the typed `install` handler) | Edge handler dispatch | `browse.ts::dispatch` builds `<plugin>@<mp> --scope <s> [--local]`; unchanged |

## Standard Stack

No new library. The phase uses what the repo already has.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-tui` | 1.5.0 | `SelectList`, `Container`, `Text` for the picker | Already the picker's UI layer [VERIFIED: node_modules/@earendil-works/pi-tui/package.json] |
| `@earendil-works/pi-coding-agent` | 1.5.0 | Host, `ctx.ui.custom`, editor | Project peer dependency [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json] |
| `@cucumber/cucumber` | 13.3.0 | Behavioral scenarios | Project test runner [VERIFIED: node_modules/@cucumber/cucumber/package.json] |
| `node:test` + `strong-mock` | Node 26.13.0 locally | Unit pairs | Project unit stack (typescript-unit-tests skill) |

**Installation:** none.

## Package Legitimacy Audit

This phase installs no external package. The audit is not applicable. `node scripts/install-test-peers.mjs` (run by `npm run test:cucumber:profile`) installed the existing optional test peers into `node_modules/.cache/optional-peers` during research: `pi-mcp-adapter@7.0.0 pi-subagents@0.84.0 @quintinshaw/pi-dynamic-workflows@3.15.0`. That is the repo's existing harness step, not a new dependency.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
user types "/claude:plugin" or "/claude:plugin browse" in Pi's terminal editor
        │  (Enter submits; an open slash autocomplete applies "/claude:plugin" and falls through to submit)
        ▼
edge/router.ts  selectClaudePluginRoute: "" or "browse" ──► browse handler (commandId "plugin browse")
        │
        ▼
browse.ts makeBrowseHandler
   ├─ args? ──► usage error (rpc/json/print refusals stay as they are)
   ├─ mode !== "tui" ──► "Browse is unavailable in <mode> mode..." usage error
   ├─ loadMarketplaceEntries(cwd)
   │     loadVisibleMarketplaces (project state, then user state; read-only)
   │     for each record:  offered  = loadMarketplaceManifest(recordedManifestPath(record)).plugins.length
   │                                  (+ assertRecordedMarketplaceName; any throw ──► undefined)
   │                       installed = Object.keys(record.plugins).length
   │     throw (corrupt state.json) ──► "(browse)" failed notice
   ├─ zero marketplaces ──► notify {marketplaces: []} ──► "(no marketplaces)"
   └─ ctx.ui.custom(PluginBrowser)
          screen 1 marketplaces: "<name> [<scope>]"  "{n} available[ • {m} installed] -- {source}"
          screen 2 plugins (lazy pluginLoader ──► list-flow loadPluginListPayload)
          screen 3 actions (by status)            screen 4 install scope (3 fixed rows)
          Esc walks back; Esc on screen 1 ──► null ──► nothing dispatched
        │ PickerResult
        ▼
dispatch ──► typed install/uninstall/info/enable/disable handler with "<p>@<mp> --scope <s>[ --local]"
```

### Recommended file changes

```text
extensions/pi-claude-marketplace/
├── edge/handlers/plugin/browse.ts      # loadMarketplaceEntries: offered + installed counts
└── edge/browser/plugin-browser.ts      # MarketplaceEntry shape; row description helper
test/edge/handlers/plugin/browse.test.ts       # new cases: first-screen rows; unreadable manifest
test/edge/browser/plugin-browser.test.ts       # MarketplaceEntry literals + row-text table case
features/plugin/browse.feature                 # seed rewrites + new scenarios
demos/browse-demo.ts                           # leave untouched (see Pattern 2)
```

### Pattern 1: Count through the domain manifest seam

**What:** `browse.ts` reads the record's catalog with `loadMarketplaceManifest`, the NFR-8 seam, and checks the recorded name exactly as `list-flow.ts` does.

Source of truth, `orchestrators/plugin/list-flow.ts:474-491` [VERIFIED: read this session]:

```ts
async function loadMarketplaceManifestSoftly(
  mpRecord: ExtensionState["marketplaces"][string],
): Promise<ScopedManifest> {
  try {
    const manifest = await loadManifestSoftly(mpRecord.manifestPath);
    // D-PL5-28: a marketplace Claude Code refuses reads as a failed one.
    assertRecordedMarketplaceName(mpRecord.name, mpRecord.source as ParsedSource, manifest.name);
    return { ok: true, manifest };
  } catch (err) {
    ...
    hookDebugLog(`list: manifest load failed for ${mpRecord.manifestPath}: ${errorMessage(err)}`);
    return { ok: false };
  }
}
```

`domain/manifest.ts:163-165` [VERIFIED: read this session]:

```ts
export async function loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  return (await loadMarketplaceManifestDocument(manifestPath)).manifest;
}
```

It is memoized by `(mtimeMs, size)` and negative-caches parse failures until the file changes (doc comment at `domain/manifest.ts:153-162`). It returns the parse by reference, so read `plugins.length` only and never mutate it.

`orchestrators/marketplace/shared.ts:1033-1035` [VERIFIED: read this session]:

```ts
export function recordedManifestPath(record: ExtensionState["marketplaces"][string]): string {
  return record.manifestPath;
}
```

`loadVisibleMarketplaces` (`orchestrators/marketplace/shared.ts:815-834`) already returns project records first, then user records (`const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];`) [VERIFIED: read this session].

**Allowed imports for `edge/`** [VERIFIED: .fallowrc.json boundaries rule `{"from": "edge", "allow": ["orchestrators", "domain", "shared", "platform"]}`; eslint.config.js:192 message `"edge/ may only import from orchestrators/, domain/, shared/, platform/."`]: `domain/manifest.ts`, `domain/name.ts`, `domain/source.ts` (type `ParsedSource`), `orchestrators/marketplace/shared.ts`, `shared/debug-log.ts`, `shared/errors.ts`. Not `persistence/` (so do not import `ExtensionState`; let the record type flow from `loadVisibleMarketplaces`). No edge module reads a manifest today (`rg loadMarketplaceManifest extensions/pi-claude-marketplace/edge` finds nothing), and no architecture gate restricts who calls `loadMarketplaceManifest`. `test/architecture/manifest-read-seam.test.ts` only forbids a direct `readFile(...marketplace.json)` outside `domain/manifest.ts`. `test/architecture/manifest-lookup-drift.test.ts` matches `.plugins.find(... .name ===)`, not `.plugins.length`.

**Unreadable or invalid manifest:** `loadMarketplaceManifest` throws on a missing, unreadable, malformed, or schema-invalid file, and `assertRecordedMarketplaceName` throws `ReservedMarketplaceNameError` for a marketplace Claude Code refuses. Catch both, debug-log like list-flow, and return `undefined`. The row then leaves the `available` part out (D-BG-1201). Including the name check keeps the row consistent with the plugins screen: for a refused marketplace list-flow returns `{ ok: false }`, so the plugins screen shows `(no plugins)`, and the row must not claim `N available`.

### Pattern 2: `MarketplaceEntry` shape that keeps the demo running untouched

Today, `edge/browser/plugin-browser.ts:54-59` [VERIFIED: read this session]:

```ts
export interface MarketplaceEntry {
  readonly name: string;
  readonly scope: Scope;
  readonly pluginCount: number;
  readonly source: string;
}
```

and the row at `plugin-browser.ts:296`: `description: \`${m.pluginCount.toString()} plugin(s) -- ${m.source}\`,`.

Recommended shape: keep the name `pluginCount` (upstream's own field name) with the meaning "catalog entries, or `undefined` when the catalog cannot be read", and add `installedCount`:

```ts
export interface MarketplaceEntry {
  readonly name: string;
  readonly scope: Scope;
  /** D-BG-1201: the catalog's plugin entries; undefined when the catalog cannot be read. */
  readonly pluginCount: number | undefined;
  /** D-BG-1201: the plugins this marketplace's installation record holds in its scope. */
  readonly installedCount: number;
  readonly source: string;
}
```

Use a required `number | undefined` key, not `pluginCount?: number`. Under `exactOptionalPropertyTypes` the optional form forces a conditional spread in `browse.ts`. `demos/browse-demo.ts` is not type-checked (`tsconfig.json` `"include": ["extensions/**/*.ts", "test/**/*.ts", "features/**/*.ts"]`, verified), is outside ESLint's paths, and is only Prettier-checked. It passes `pluginCount: 5 | 2 | 0` and no `installedCount`. At runtime `undefined > 0` is false, so its rows read `5 available -- github:...`. The demo keeps running unchanged, and the plan leaves it untouched with a note in the SUMMARY.

### Pattern 3: Row text helper (module-private)

Keep the helper unexported. A new export used only by its own test trips fallow's dead-code run and `test/architecture/no-test-only-production-surface.test.ts`. Test it through `PluginBrowser`'s rendered first screen. Sketch (planner adapts):

```ts
// D-BG-1201: Claude Code's "{n} available • {m} installed", then Pi's "-- {source}" tail.
function marketplaceDescription(m: MarketplaceEntry): string {
  const counts: string[] = [];
  if (m.pluginCount !== undefined) {
    counts.push(`${m.pluginCount.toString()} available`);
  }

  if (m.installedCount > 0) {
    counts.push(`${m.installedCount.toString()} installed`);
  }

  return counts.length === 0 ? m.source : `${counts.join(" • ")} -- ${m.source}`;
}
```

Four branch outcomes for 100% branch coverage: count and no installed, count and installed, no count and installed, neither. The `•` is U+2022, the same character as the existing hint rows (`"↑↓ navigate • enter open • esc cancel"`, `plugin-browser.ts:311`) and upstream's `" • "`.

Upstream evidence, re-read this session from the 2.1.319 strings dump [VERIFIED: claude-strings.txt]: `le.pluginCount!==void 0&&r(ne,{children:[le.pluginCount," available"]}) ... le.installedPlugins.length>0&&r(ne,{children:[" • ",le.installedPlugins.length," installed"]})`. So a readable empty catalog shows `0 available`, and an undefined count is left out.

### Anti-Patterns to Avoid

- **Counting through `loadPluginListPayload`:** its rows include installed plugins that the catalog no longer lists and fold cross-scope orphans, so the count would not be "catalog entries". It also builds whole notification rows for each marketplace on the first screen.
- **Reading `marketplace.json` with `readFile` in `browse.ts`:** this fails `test/architecture/manifest-read-seam.test.ts` (NFR-8).
- **Exporting the row helper or a count helper for tests:** this fails fallow dead-code and `no-test-only-production-surface`.
- **A `for ... await` loop over marketplaces:** `no-await-in-loop` is an error in `extensions/**`. Use `Promise.all(visible.map(async ...))`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read and validate a catalog | `readFile` + `JSON.parse` | `domain/manifest.ts::loadMarketplaceManifest` | NFR-8 seam, typebox validation, memoized with negative caching, gate-enforced |
| Locate a record's catalog | path join on `marketplaceRoot` | `recordedManifestPath(record)` | File sources and hosted catalogs record the exact manifest file (WR-02) |
| Refused-marketplace rule | own name checks | `domain/name.ts::assertRecordedMarketplaceName` | Same verdict list-flow renders (D-PL5-28) |
| Go back one picker screen in a scenario | a new step with raw ESC bytes | not needed; pin each walk in its own scenario | Frozen driver exports only open, choose, read, cancel |
| Scope-file bytes before/after | new byte steps | `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged` | Frozen, verified this session |

**Key insight:** every behavior the phase pins already exists except the count. The work is the data change plus a set of scenarios that use frozen steps only.

## Scenario Mechanics (verified in a terminal Pi this session)

Two scratch feature files under the scratchpad (`p12/probe.feature`, `p12/probe2.feature`) ran with `npx cucumber-js --profile adapter --parallel 2 <file>` against the current head. No product, test, or feature file was edited. The real `~/.pi` had no file newer than a marker touched before the first run.

| Question | Answer | Evidence |
|----------|--------|----------|
| Does a bare `/claude:plugin` typed in Pi's terminal reach the command? | Yes. `the user opens the plugin picker with "/claude:plugin" in pi's terminal` opened `Browse Claude Plugin Marketplaces`. | probe "Probe bare command opens the picker" passed. Pi 1.5.0 `editor.js:633-646`: with a slash autocomplete open, Enter applies the completion and, because the prefix starts with `/`, falls through to submit. `sendLine` writes `"/claude:plugin\r"` in one chunk, and the autocomplete request is async, so Enter usually submits directly. Either path runs the command. |
| `(no marketplaces)` in the terminal? | Yes, exactly that one row. `When the user runs "/claude:plugin browse" in pi's terminal` + `Then pi's terminal shows this result of the command:` with doc string `(no marketplaces)` passed. | probe "Probe no marketplaces in the terminal" |
| Plugins screen with available, installed, unavailable | Rows `[installed] fmt` `1.0.0`, `[unavailable] ghost` `3.0.0`, `[available] lint` `2.0.0`, in that order. The description is the version (`p.version ?? described`, `plugin-browser.ts:376`), so `not installable` shows only for a catalog entry with no version. | probe diff for "Plugins in extras [project]" |
| Unavailable plugin without a JSON blob | `offers these plugins:` (with `ghost`), add the marketplace, then `the marketplace "extras" no longer holds the files of the plugin "ghost"` (frozen `marketplace/publishing.steps.ts`). A dir source's record reads the published directory live. | probe; `features/plugin/reconcile.feature:165` uses the same step |
| Combine `publishes this manifest:` with `offers these plugins:`? | Yes: offers first (writes the dirs and manifest), then `publishes this manifest:` rewrites only the manifest text (`list.feature:227-238` does this). Only needed to show `not installable` (an entry without `version`). | `features/plugin/list.feature:226-260` |
| Installed actions | `Uninstall` `uninstall fmt@extras --scope project`, `Disable` `disable fmt@extras --scope project`, `Info` `info fmt@extras --scope project` | probe passed |
| Available actions | `Install` `install app@tools (choose scope next)`, `Info` `info app@tools --scope user` | probe2 passed |
| Unavailable actions | one row: `Info` `info ghost@extras --scope project` | probe2 diff |
| Scope screen rows (D-BG-1202) | The 120-column pty truncates the descriptions to 84 characters with no ellipsis (see Pitfall 3) | probe2 diff |
| `Project` install | `the "claude-plugins.json" file of the project scope declares these plugins:` `lint@extras`; `the "claude-plugins.local.json" file of the project scope does not exist`; `list --installed` one row | probe2 passed |
| `Project local` install | `the "claude-plugins.local.json" file of the project scope declares these plugins:` `lint@extras`; `list --installed` one row `extras \| project \| lint@extras \| lint \| installed \| \| project \| 2.0.0` | probe passed |
| Remember bytes, open, cancel, unchanged | Passed for both scopes, with an installed plugin. Starting the terminal Pi (its load) wrote neither `claude-plugins.json` nor `state.json`. | probe and probe2 |
| Install from the picker, then `list` | `When the user runs "/claude:plugin list --installed"` runs in the rpc profile Pi and reads the disk the terminal Pi wrote. A marketplace with nothing installed still prints a row with empty plugin cells, such as `\| extras \| project \| \| \| \| \| \| \|`. | probe2 diff |
| Close detection after Install (P1-DC-50) | `choosePickerRow` waits for a notice row `<glyph> <plugin> ... (<status>)` written after the choice, matched by the plugin name from the closing screen's title (`Install <plugin> @ <mp>: Select Scope`). Disk `Then` steps after the choice are therefore safe. | `features/lib/plugin-picker.ts:196-251` [VERIFIED: read] |

**Step ordering constraint:** `scripts/check-features.mjs:474-475` reports `"a Given step follows a When or Then step"`. So the `remembered` step must come before `the user opens the plugin picker ...`. This is safe: the terminal Pi's load writes nothing (verified above).

**`remembered` needs both files:** `config.steps.ts:55-61` reads `claude-plugins.json` and `pi-claude-marketplace/state.json` of the scope with `readFile` (ENOENT fails the step) [VERIFIED: read]. A `marketplace add` to a scope creates both, so each scope whose bytes a scenario remembers must have a marketplace added. The step does not read `claude-plugins.local.json`.

**New steps:** none. Every step comes from the frozen modules `plugin/picker.steps.ts`, `command.steps.ts`, `config.steps.ts`, `plugin/installation.steps.ts`, and `marketplace/publishing.steps.ts`. Do not create `features/step_definitions/plugin/browse.steps.ts`.

**Seed steps stay in use:** the four picker steps are used by the recommended scenarios. `the installation record of the {word} scope holds these plugins:` stays in scenario C. `the {word} scope has no installed plugins` is used by 62 feature lines elsewhere, so dropping it from the cancel seed is safe.

## Recommended Scenario Set

Seven terminal scenarios plus the three rpc scenarios that stay as they are. Cost: about 5 s each serially, plus 5 s for a scenario that ends with the picker open. All are untagged (adapter only).

| # | Title (suggested) | Opens with | Pins | Ends | Decision covered |
|---|------------------|-----------|------|------|------------------|
| B | The terminal picker lists the marketplaces of both scopes with the plugins each offers and has installed (rewrites seed "The terminal picker lists the marketplaces of both scopes") | bare `/claude:plugin` | screen 1: `extras [project]` `3 available • 1 installed -- {home}/marketplaces/extras`, `tools [user]` `1 available -- {home}/marketplaces/tools`, `broken [user]` `{home}/marketplaces/broken`; choose extras → screen 2: fmt/ghost/lint rows; choose `[installed] fmt` → screen 3: Uninstall/Disable/Info | open (+5 s) | Opening (bare), both scopes, project first, D-BG-1201 (all three row forms), plugins screen, installed actions |
| C | Choosing User (global) in the terminal picker installs the plugin in the user scope (rewrites seed "Choosing a plugin...") | `browse` | screen 3 for `[available] app`: Install/Info; screen 4 rows (D-BG-1202, truncated text); record holds `app@tools`; `list --installed` row | closed | Opening (`browse`), available actions, scope screen rows, BROWSE-02 user |
| D | Choosing Project in the terminal picker installs the plugin and declares it in the project's base config | `browse` | `claude-plugins.json` declares `lint@extras`; `claude-plugins.local.json` does not exist; `list --installed` | closed | BROWSE-02 project base |
| E | Choosing Project local in the terminal picker installs the plugin and declares it in the project's local config | `browse` | `claude-plugins.local.json` declares `lint@extras`; `claude-plugins.json` declares no plugins; `list --installed` | closed | BROWSE-02 project local |
| F | Cancelling the terminal picker at the install scope leaves both scopes as they were (rewrites seed "Cancelling ... installs nothing") | `browse` | setup installs `app@tools --scope user`; remember both; walk extras → lint → Install → cancel; both unchanged | closed | Cancel at scope screen |
| G | Cancelling the terminal picker on its first screen leaves both scopes as they were | `browse` | same setup; remember both; open; cancel; both unchanged | closed | Cancel at first screen |
| H | Browsing in the terminal with no marketplace added shows an empty marketplace list | `the user runs "/claude:plugin browse" in pi's terminal` | `(no marketplaces)` | no picker | No marketplaces |

Notes for the planner:

- Folding the first-screen seed into B saves one terminal start. `browse` itself stays covered, because `openPicker` in C to G asserts the title `Browse Claude Plugin Marketplaces` before it returns. The planner may instead keep the seed separate (8 terminal scenarios, about +8 s) if it judges B to carry too much. CONTEXT prefers fewer, longer walks.
- B's `broken` marketplace: publish it as a dir source, add it to the user scope (the add needs a valid catalog), then `Given the manifest of the marketplace "broken" is no longer valid json` (frozen `marketplace/publishing.steps.ts:247-252`). probe2 opened the picker with a broken user-scope catalog.
- Use the project-scope marketplace `extras` for D and E. Choosing `Project` for the user-only `tools` would also run the D-MF-04 add of `tools` into the project scope and pull a second behavior into the scenario.
- Keep marketplace names at six characters or fewer (Pitfall 3).
- Unavailable-plugin actions (`Info` only) are pinned by the existing unit table (`plugin-browser.test.ts:301-327`). No terminal scenario needs them: CONTEXT's Actions decision names only the available and installed sets.

## Common Pitfalls

### Pitfall 1: Assuming the bare command needs special keystrokes
**What goes wrong:** a new step for "type, wait, Enter" gets written.
**Why it happens:** Pi's slash autocomplete looks like it would intercept Enter.
**How to avoid:** it does not block. `editor.js:641-645` applies the completion and falls through to submit for a `/` prefix. The frozen open step works with `"/claude:plugin"` (verified).
**Warning signs:** none observed.

### Pitfall 2: A scenario that ends with the picker open costs 5 s more
**What goes wrong:** suite time grows. A scenario ending on a picker screen spent 5.02 s in its `After` hook, against about 0.12 s for one that ended closed.
**Why it happens:** `PiTuiSession.stop()` sends two Ctrl-C, which the open picker swallows, then waits `DEFAULT_STOP_MS = 5_000` (`features/lib/pi-tui.ts:27`) before it kills Pi.
**How to avoid:** only B (and an optional separate first-screen scenario) should end open. Do not add a cancel step only to save time, because a trailing `When` with no `Then` proves nothing.

### Pitfall 3: Row descriptions truncate at 84 characters
**What goes wrong:** a row the scenario pins is cut, and `{home}` projection fails on the cut path.
**Why it happens:** the pty is 120 columns (`PTY_COLUMNS = 120`, `pi-tui.ts:37`). pi-tui's `SelectList` uses `DEFAULT_PRIMARY_COLUMN_WIDTH = 32` (`select-list.js:3`) and a safety margin of 2, so 84 characters remain for the description. The scope screen already shows `Install in the local config (.pi/claude-plugins.local.json, gitignored, this repo on` (84 characters). The sandbox `{home}` is `/tmp/pi-cm-features-XXXXXX/home` (31 characters, `features/support/pi-process.ts:135,140`). So `3 available • 1 installed -- {home}/marketplaces/extras` is 80 characters, 4 under the limit.
**How to avoid:** keep marketplace names at six characters or fewer and counts at one digit in the first-screen scenario. Pin the scope screen's truncated descriptions verbatim (that is what the user sees in a 120-column terminal), and note in the SUMMARY why they end mid-word.
**Warning signs:** a first-screen row whose description ends without the marketplace name.

### Pitfall 4: `list --installed` shows empty marketplaces
**What goes wrong:** a `the result lists these plugins:` table with only the installed row fails.
**Why it happens:** a marketplace with no installed plugin still yields one row with empty plugin cells.
**How to avoid:** in D and E only `extras` exists. In C only `tools` exists. If a scenario has two marketplaces, include the row `| <mp> | <scope> | | | | | | |`.

### Pitfall 5: Unit fixtures render `undefined` as the source
**What goes wrong:** a new row-text assertion in `browse.test.ts` reads `... -- undefined`.
**Why it happens:** `marketplaceRecordIn` (`test/edge/handlers/plugin/browse.test.ts:66-82`) seeds `source: { kind: "path", raw: marketplaceRoot }` with no `logical`, and `sourceLogical` returns `source.logical` for a path source (`domain/source.ts:851-854`).
**How to avoid:** seed with `pathSource(marketplaceRoot)` from `domain/source.ts:750-756` (returns `{ kind: "path", raw, logical: raw }`), or give the new tests their own record.

### Pitfall 6: Width-80 renders in `plugin-browser.test.ts`
**What goes wrong:** a row-text case fails on truncation, not on the behavior.
**Why it happens:** `rendered(browser, width = 80)` leaves 44 description characters.
**How to avoid:** render the first screen at 120 columns, or use short sources (`github:a/b`) in the row-text case.

### Pitfall 7: The red proof must not use `git stash`
**What goes wrong:** the stash stack is shared with sibling sessions.
**How to avoid:** make the product mutation with Edit, run the scenario, restore with Edit (or `git checkout -- <file>` on that one file), and confirm `git diff --stat` is empty for product files before committing.

### Pitfall 8: Fallow dupes on new unit cases
**What goes wrong:** each `browse.test.ts` case repeats a roughly 20-line `customFactory` / `factory(tui, theme, ...)` block. More copies can form a clone group that `fallow dupes --fail-on-issues` reports.
**How to avoid:** factor a private helper inside `browse.test.ts` for the new cases (capture the factory, build the component, return its first-screen render), then run `npx fallow dupes`.

## Code Examples

### `browse.ts` loader (sketch)

```ts
// Source: pattern of orchestrators/plugin/list-flow.ts:474-491 (read this session)
import { loadMarketplaceManifest } from "../../../domain/manifest.ts";
import { assertRecordedMarketplaceName } from "../../../domain/name.ts";
import { sourceLogical, type ParsedSource } from "../../../domain/source.ts";
import {
  loadVisibleMarketplaces,
  recordedManifestPath,
} from "../../../orchestrators/marketplace/shared.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";

type VisibleRecord = Awaited<ReturnType<typeof loadVisibleMarketplaces>>[number]["record"];

// D-BG-1201: the catalog's entry count, or undefined when the catalog cannot be read.
async function offeredPluginCount(record: VisibleRecord): Promise<number | undefined> {
  try {
    const manifest = await loadMarketplaceManifest(recordedManifestPath(record));
    assertRecordedMarketplaceName(record.name, record.source as ParsedSource, manifest.name);
    return manifest.plugins.length;
  } catch (err) {
    hookDebugLog(`browse: manifest load failed for ${record.manifestPath}: ${errorMessage(err)}`, "browser");
    return undefined;
  }
}

async function loadMarketplaceEntries(cwd: string): Promise<readonly MarketplaceEntry[]> {
  const visible = await loadVisibleMarketplaces({ cwd });
  return Promise.all(
    visible.map(async ({ scope, record }) => ({
      name: record.name,
      scope,
      pluginCount: await offeredPluginCount(record),
      installedCount: Object.keys(record.plugins).length,
      source: sourceLogical(record.source as ParsedSource),
    })),
  );
}
```

The import paths above are relative to `edge/handlers/plugin/`, and the existing imports in `browse.ts:20-23` confirm the `../../../` depth. `hookDebugLog(detail, tag)` signature: `shared/debug-log.ts:22` [VERIFIED: read]. `ParsedSource` is exported from `domain/source.ts:80` (`export type ParsedSource =`) [VERIFIED: grep of the definition line], and list-flow imports it the same way (`list-flow.ts:100`). Keeping the existing `as Parameters<typeof sourceLogical>[0]` cast is equally valid.

### Feature skeleton for scenario B (expected values verified, except the post-fix row text)

```gherkin
  Scenario: The terminal picker lists the marketplaces of both scopes with the plugins each offers and has installed
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name  | version |
      | lint  | 2.0.0   |
      | fmt   | 1.0.0   |
      | ghost | 3.0.0   |
    Given the marketplace "extras" is added to the project scope
    Given the marketplace "extras" no longer holds the files of the plugin "ghost"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "broken" is published as a dir source
    Given the marketplace "broken" is added to the user scope
    Given the manifest of the marketplace "broken" is no longer valid json
    Given the user has run "/claude:plugin install fmt@extras --scope project"
    When the user opens the plugin picker with "/claude:plugin" in pi's terminal
    Then the plugin picker shows the screen "Browse Claude Plugin Marketplaces" with these rows:
      | label            | description                                             |
      | extras [project] | 3 available • 1 installed -- {home}/marketplaces/extras |
      | tools [user]     | 1 available -- {home}/marketplaces/tools                |
      | broken [user]    | {home}/marketplaces/broken                              |
    When the user chooses "extras [project]" in the plugin picker
    Then the plugin picker shows the screen "Plugins in extras [project]" with these rows:
      | label               | description |
      | [installed] fmt     | 1.0.0       |
      | [unavailable] ghost | 3.0.0       |
      | [available] lint    | 2.0.0       |
    When the user chooses "[installed] fmt" in the plugin picker
    Then the plugin picker shows the screen "Action: fmt @ extras" with these rows:
      | label     | description                          |
      | Uninstall | uninstall fmt@extras --scope project |
      | Disable   | disable fmt@extras --scope project   |
      | Info      | info fmt@extras --scope project      |
```

The `broken` marketplace without `offers these plugins:` publishes an empty catalog. That is valid at add time, and its catalog is then broken. The order of the `broken` steps against the `install` setup is [ASSUMED] harmless: probe2 broke the user marketplace's catalog after the add and the picker still opened. The install runs against `extras`, not `broken`.

### Scope screen rows for scenario C (verified verbatim, truncated by the terminal)

```gherkin
    Then the plugin picker shows the screen "Install app @ tools: Select Scope" with these rows:
      | label                       | description                                                                          |
      | Project local (Recommended) | Install in the local config (.pi/claude-plugins.local.json, gitignored, this repo on |
      | Project                     | Install in the base config (.pi/claude-plugins.json, for all collaborators on this r |
      | User (global)               | Install in the user scope's base config (~/.pi/agent/claude-plugins.json, all projec |
```

Source labels and full texts: `plugin-browser.ts:441-460` [VERIFIED: read]. The truncated forms come from the probe2 diff.

### Unit cases to add or change

`test/edge/browser/plugin-browser.test.ts` (no existing case pins `plugin(s)` or the row text; `rg` found none):
- Add `installedCount` to every `MarketplaceEntry` literal: the module-level `marketplaces` (lines 50-61), `official` (112-117), `crowd` (349-355), and `sameNameMarketplaces` (680-692). `pluginCount` keeps its numbers.
- New table-driven case(s) over the first screen's row description: `{ pluginCount: 2, installedCount: 0 }` → `2 available -- <src>`, `{ 3, 1 }` → `3 available • 1 installed -- <src>`, `{ undefined, 1 }` → `1 installed -- <src>`, `{ undefined, 0 }` → `<src>`, and optionally `{ 0, 0 }` → `0 available -- <src>` (upstream shows `0 available`). Render at width 120 or use a short source. Assert the whole row line.

`test/edge/handlers/plugin/browse.test.ts` (no existing case pins `pluginCount` or the first-screen text; `comp.render(80)` at line 571 checks only `Array.isArray`):
- New case: a marketplace whose catalog offers two plugins and whose record holds one installed plugin renders `2 available • 1 installed -- <root>` on the first screen. This covers the success path and `installedCount`.
- New case: a marketplace whose catalog is missing or malformed (write `"not json"` to `manifestPath`, or remove it, after seeding) renders the source alone or the installed part. This covers the catch branch, which needs direct coverage.
- Fix `marketplaceRecordIn` to use `pathSource(...)` (Pitfall 5), or build the new records with `logical`.
- No existing case needs a new expected value.

Run each pair alone for coverage: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts` and `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts`. Both exited 0 at the current head.

## Runtime State Inventory

Not a rename or migration phase. The fix changes only rendered text, and no stored data carries `plugin(s)`.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. `state.json` and the configs hold no picker text; verified by reading the record schema at `persistence/state-io.ts:347-365` | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | The terminal Pi compiles the extension into `/tmp/jiti` (child brief section 9). jiti recompiles on change; no action | none |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `{installed} plugin(s) -- {source}` | `{offered} available[ • {installed} installed] -- {source}` | this phase (D-BG-1201) | The first screen matches Claude Code's count. One feature file (`browse.feature`) changes. No unowned feature file pins the picker row. |

**Related but out of scope:** `edge/handlers/tools.ts:152-156` (Phase 10's file) prints `[<scope>] <name> -- <N> plugin(s) -- <source>` with `N = Object.keys(record.plugins).length`, the same installed-count wording, and `features/plugin/model-tools.feature:26` pins it. Phase 12 must not touch it. Report it to the parent as a cross-phase note.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CI's `os.tmpdir()` is `/tmp`, so `{home}` is 31 characters and the first-screen rows fit in 84 columns | Pitfall 3 | A longer TMPDIR truncates B's rows on CI only. Mitigation: short names. Check the first CI run. |
| A2 | Breaking the `broken` catalog after its add does not disturb the `fmt@extras` install or the picker | Code Examples (scenario B) | B fails at setup; move the break step last among the Givens (already last but one) or drop the third marketplace and keep the unreadable case unit-only |
| A3 | A user can expect `1 installed -- {source}` (no leading `•`) when the catalog is unreadable but a plugin is installed | Pattern 3 | Cosmetic; recorded as a dubious choice |

## Open Questions

1. **Should the unreadable-catalog row form be pinned in a terminal scenario?**
   - What we know: D-BG-1201 and P12-DC-02 decide it. Frozen steps can build it (`the manifest of the marketplace "<x>" is no longer valid json`), and the picker opens with a broken user-scope catalog (probe2).
   - What's unclear: whether a reviewer wants scenario B to carry a third marketplace.
   - Recommendation: include it in B, since it costs no extra terminal start. The `{ undefined, n }` row forms are also unit-tested.
2. **One plan or two?**
   - Recommendation: two sequential plans (wave 1: fix + unit tests + scenario B; wave 2: scenarios C to H + parent lines), because both edit `browse.feature`. A single plan is equally valid. The fix is small, and the gate (`npm run check`, about 6 to 8 minutes) runs once per wave.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.13.0 | — |
| Python 3 | `features/lib/pi-tui-pty.py` (terminal scenarios) | ✓ | 3.15.2 | — |
| Pi coding agent | terminal and rpc Pi | ✓ | 1.5.0 | — |
| Optional test peers cache | `npm run test:cucumber*` | ✓ (installed during research by `scripts/install-test-peers.mjs`) | pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, pi-dynamic-workflows 3.15.0 | — |
| Network | none for this phase's scenarios (dir sources only) | — | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` 13.3.0 (behavioral); `node:test` + `strong-mock` (unit) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`); `package.json` scripts |
| Quick run command | `npx cucumber-js --profile adapter --parallel 3 features/plugin/browse.feature` (about 30 s for the 6 current scenarios; peers must be installed once with `node scripts/install-test-peers.mjs`) |
| Full suite command | `npm run check` (run in the background with its exit code written to a file); phase gate adds `npm run test:modules` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | Row counts offered and installed plugins; unreadable catalog leaves the count out | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/browser/plugin-browser.test.ts test/edge/handlers/plugin/browse.test.ts` | ✅ (cases to add) |
| BROWSE-01 | 100% direct coverage of both sources | coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts`; same for `edge/browser/plugin-browser.ts` | ✅ |
| BROWSE-01 | Bare command opens the picker; both scopes; row forms; plugins screen; installed actions (B) | behavioral (terminal) | `npx cucumber-js --profile adapter --name 'The terminal picker lists the marketplaces' features/plugin/browse.feature` | ✅ file; scenario rewritten |
| BROWSE-01 | Empty list in the terminal (H) | behavioral (terminal) | `npx cucumber-js --profile adapter --name 'no marketplace added' features/plugin/browse.feature` | ❌ new scenario |
| BROWSE-01 | rpc refusals (3 existing) | behavioral (rpc) | `npx cucumber-js --profile adapter features/plugin/browse.feature` | ✅ unchanged |
| BROWSE-02 | User (global), Project, Project local installs plus `list` (C, D, E) | behavioral (terminal) | `npx cucumber-js --profile adapter --name 'Choosing' features/plugin/browse.feature` | C rewritten; D, E new |
| BROWSE-02 | Cancel at scope screen and first screen leaves bytes unchanged (F, G) | behavioral (terminal) | `npx cucumber-js --profile adapter --name 'Cancelling' features/plugin/browse.feature` | F rewritten; G new |
| all | Steps used, layout and Gherkin rules | static | `npm run check:features` | ✅ |

### Sampling Rate
- **Per task commit:** the owner unit tests above, `npm run test:coverage:direct -- <source>`, `npx cucumber-js --profile adapter --parallel 3 features/plugin/browse.feature`, `npm run check:features`. The commit hook runs `check:commit`.
- **Per wave merge:** `npm run check` on the combined tree (both cucumber profiles). Browse scenarios carry no tag, so the builtin profile runs none of them, but the gate still runs it whole.
- **Phase gate:** `npm run check` plus `npm run test:modules`, green before `/gsd-verify-work`. Rerun a failing cucumber case once before calling the gate red, and record both runs.

### Red-proof method (Milestone rules: "Every scenario fails without the behavior it names, with the red proof recorded in the plan SUMMARY")

Phase 1 recorded both forms: product mutations (01-07: the cancel loop typing Enter; 01-02: a product age set to 0) and literal mutations of the expected table (01-07: `tools [user]` changed to `tools [project]`). The literal form proves only that the step compares the whole screen. The milestone rule asks that a scenario fail **without the behavior**, so use a temporary product mutation for each new or rewritten scenario. Restore it with Edit or `git checkout -- <that file>`, never `git stash`. Optionally add a literal mutation as a second proof.

| Scenario | Red proof (temporary edit, then restore) | Expected failure |
|----------|-------------------------------------------|------------------|
| B | Revert the count: `pluginCount: Object.keys(record.plugins).length` and the old `plugin(s)` row text, which is the pre-fix code | first-screen `Then` diff (`1 plugin(s)` / `0 plugin(s)`) |
| B (bare arm, optional second proof) | In `edge/router.ts:271-273`, route the bare command to `help` | `openPicker` times out waiting for the title |
| C | In `plugin-browser.ts::showInstallScope`, make the `user` choice return `scope: "project"` | `the installation record of the user scope holds these plugins:` fails |
| D | Make the `project` choice set `local: true` | `claude-plugins.json ... declares these plugins:` fails (no plugins object) |
| E | Drop `local: true` from the `project-local` choice | `claude-plugins.local.json ... declares these plugins:` fails |
| F | Make the scope screen's `list.onCancel` call `this.onSelect({ action: "install", plugin: plugin.name, marketplace: mp.name, scope: mp.scope })` | `... project scope are unchanged` fails |
| G | In `browse.ts`, replace the `result === null` early return with an install dispatch of a fixed `lint@extras --scope project` | `... project scope are unchanged` fails |
| H | Replace `notify(ctx, run, { marketplaces: [] })` with a bare `return` | `pi's terminal shows this result of the command:` times out on the anchor |

A rewritten seed whose expectation changed with the fix (B) is proven red by reverting the fix itself. That is also the fix's own proof that the bug was real.

### Wave 0 Gaps
- [ ] New unit cases in `test/edge/browser/plugin-browser.test.ts` (row text, four branches) and `test/edge/handlers/plugin/browse.test.ts` (success counts, unreadable catalog)
- [ ] No framework install and no new step module needed

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so the section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | `browse` uses no credential and no network |
| V3 Session Management | no | — |
| V4 Access Control | no | Local single-user tool; scopes are the user's own files |
| V5 Input Validation | yes | The catalog is parsed and schema-validated by `loadMarketplaceManifest` (typebox); only `plugins.length` is read. A parse failure is caught and leaves the count out |
| V6 Cryptography | no | — |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hostile or huge `marketplace.json` at a recorded path | Denial of service | Same read list and `marketplace info` already do. Memoized and negative-cached by `(mtime, size)`. Read-only. No new surface |
| `manifestPath` pointing outside the marketplace root (edited `state.json`) | Information disclosure | Read-only, and only a count is shown. State-io's T-02-16 note leaves containment to the read sites, and list-flow reads the same path without a containment check. No write, so NFR-10 (write containment) is untouched |
| Network use from the picker's first screen | Tampering / policy (NFR-5) | `loadMarketplaceManifest` reads disk only, and `edge/` is outside BLOCK F but imports no git or fetch module |
| Terminal control characters in names or sources | Tampering (display) | Pre-existing behavior; the fix adds only digits and fixed words |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `edge/handlers/plugin/browse.ts`, `edge/browser/plugin-browser.ts`, `orchestrators/plugin/list-flow.ts` (lines 270-500), `domain/manifest.ts` (151-173), `orchestrators/marketplace/shared.ts` (805-834, 1023-1035), `persistence/state-io.ts` (10-30, 340-380), `domain/name.ts` (356-396), `domain/source.ts` (24-28, 750-756, 851-854), `.fallowrc.json` boundaries, `eslint.config.js` (180-200), `features/lib/plugin-picker.ts`, `features/lib/pi-tui.ts` (20-40, 405-551), `features/step_definitions/{plugin/picker,command,config,marketplace/publishing}.steps.ts`, `features/support/world.ts` (195-225, 380-420, 515-545, 860-945, 1150-1200), `scripts/check-features.mjs`, `cucumber.json`, `package.json` scripts, both unit test files, `demos/browse-demo.ts`, `tsconfig.json`.
- Pi 1.5.0 `node_modules/@earendil-works/pi-tui/dist/components/editor.js` (600-660, 1920-2040) and `select-list.js` (constants and `renderItem`).
- Terminal probes: scratchpad `p12/probe.feature`, `p12/probe2.feature`, with logs and json reports beside them.
- Claude Code 2.1.319 strings dump: the `Manage marketplaces` row expression quoted in Pattern 3.

### Secondary (MEDIUM confidence)
- `.planning/phases/01-foundation/01-07-SUMMARY.md` (seed red proofs), `.planning/phases/01-foundation/DUBIOUS-CHOICES.md` (P1-DC-48, P1-DC-50, P1-DC-65).

### Tertiary (LOW confidence)
- None.

The `research-plan` and `research-store` seams were not used: the phase needs no library or ecosystem lookup, and CONTEXT already carries the upstream evidence, which this session re-checked directly against the binary strings.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependency; versions read from `node_modules`.
- Architecture: HIGH. Boundaries read from config; loader and pattern copied from list-flow.
- Scenario mechanics: HIGH. Each one was run in a terminal Pi at the current head, except the post-fix first-screen text, which is computed from the decided grammar and the measured column width.
- Pitfalls: HIGH. Measured: stop timeout, truncation width, empty-marketplace list rows.

**Baseline timing (current head, Node 26.13.0, 28 cores shared with 14 sibling phases, load average 8 to 31):** `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/plugin/browse.feature` took 31.4 s wall (6 scenarios, 3 terminal, including the one-time peer install; 44 s total with npm). A serial run (`--parallel 1`) took 26.6 s: the terminal scenarios took 7.9 s (ends open), 6.5 s, and 5.3 s; the rpc scenarios took 0.1 to 0.2 s. The open step took 2.4 to 2.8 s at load 8 and 3.5 to 5.3 s at load 31, well under the 15 s ready limit. Estimate for the recommended set: about 50 s serial for the seven terminal scenarios, and about 15 to 20 s wall at `--parallel 3`.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08 (stable; recheck if Pi or pi-tui leaves 1.5.0)

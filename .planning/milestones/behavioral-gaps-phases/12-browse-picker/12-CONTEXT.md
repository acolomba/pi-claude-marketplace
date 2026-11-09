# Phase 12: Browse Picker - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted. Upstream evidence comes from the Claude Code 2.1.319 binary at `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`, read with `strings` on 2026-11-08.

<domain>
## Phase Boundary

Phase 12 covers the `/claude:plugin browse` picker in Pi's terminal with cucumber scenarios in `features/plugin/browse.feature`: `browse` and a bare `/claude:plugin` open it, it lists the marketplaces of both scopes and each marketplace's plugins, choosing a plugin installs it in the scope the user picks, and cancelling changes nothing (BROWSE-01, BROWSE-02). It fixes the bug the Phase 1 seed pinned (the marketplace row counts installed plugins, not offered ones, P1-DC-48) in its own product files: `edge/handlers/plugin/browse.ts` and `edge/browser/plugin-browser.ts`, with their unit pairs. It adds no picker feature beyond that fix.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence records

- **Marketplace row count.** Claude Code's `/plugin` "Manage marketplaces" list renders each marketplace as its name, its source, then `{pluginCount} available`, then ` • {n} installed` only when `n > 0`, then ` • Updated {date}` when it has one. `pluginCount` is `F?.plugins.length`, the number of entries in the marketplace's catalog (`marketplace.json`), installed or not; `installedPlugins` are the installed plugins whose id ends in `@<marketplace>`. When the catalog cannot be read, `pluginCount` is undefined and the count is left out. The marketplace's own menu offers `Browse plugins (${pluginCount ?? 0})`. Evidence: the 2.1.319 binary (functions building the `Manage marketplaces` rows and `hd(...)`, which sets `pluginCount:F?.plugins.length`). Confidence: high. Pi's row (`{n} plugin(s) -- {source}`, with `n = Object.keys(record.plugins).length`) counts the installed plugins, so a marketplace that offers plugins and has none installed reads `0 plugin(s)`.
- **Where a chosen plugin installs.** Claude Code asks the user: `Install for you (user scope)`, `Install for all collaborators on this repository (project scope)`, `Install for you, in this repo only (local scope)`, in that order, then extra links and `Back to plugin list` (function `xu` in 2.1.319). Marketplaces are not scoped upstream. Confidence: high. Pi's picker already asks the scope on its fourth screen: `Project local (Recommended)` (project scope, `claude-plugins.local.json`), `Project`, `User (global)`. SC-1 removes Claude Code's `local` scope; the Pi `--local` layer stands in for it. BROWSE-02's draft "installs it in its marketplace's scope" is refined by this research: the plugin installs in the scope the user picks.
- **Installed plugins in a marketplace's plugin list.** Claude Code's browse list of a marketplace shows installed plugins too, marked with a tick in the success color, and Enter on an installed plugin opens its management view (`isInstalled` → `manage-plugins` with `targetPlugin`), not an install. Its Discover tab hides installed plugins (`All available plugins are already installed.`). Confidence: high for the browse list. Pi's plugins screen tags an installed plugin `[installed]` with its version and offers `Uninstall`, `Disable`, and `Info`, which matches the upstream shape (a management choice instead of an install).
- **Unavailable plugins.** No upstream position was found for how the browse list shows a catalog entry that cannot be installed (low confidence; the binary was not probed). Pi tags it `[unavailable]`, describes it `not installable`, and offers only `Info`.

### Marketplace row (BROWSE-01)

- **D-BG-1201 — the row counts the catalog's plugins, as Claude Code does.** The first screen's description for each marketplace becomes `{offered} available`, then ` • {installed} installed` when at least one of its plugins is installed in that marketplace's scope, then ` -- {source}`. `offered` is the number of plugin entries in the marketplace's `marketplace.json`; `installed` is the number of plugins its installation record holds. When the manifest cannot be read, the `available` part is left out, as upstream leaves out the count (the row then starts with the installed part, or with the source alone). The `-- {source}` tail and the `•` separator are Pi's existing picker grammar (the hint rows already use `•`); Pi records no last-updated date for the row, so upstream's `Updated` part is not added. The Phase 1 seed's rows change from `0 plugin(s)` to `1 available` and `2 available`, and a new scenario pins a marketplace with an installed plugin (`2 available • 1 installed`). Alternative rejected: keep `{n} plugin(s)` and only change what `n` counts (keeps the ambiguous word that let the bug read as correct, and loses upstream's installed count).
- The manifest is read through the existing read-only manifest loader (`loadMarketplaceManifest` on the record's manifest path, or the helper the list flow already uses), so `browse` stays network-free (NFR-5) and writes nothing.

### Scenarios (BROWSE-01, BROWSE-02)

- **Opening.** `/claude:plugin browse` and a bare `/claude:plugin` in the terminal both open the picker on `Browse Claude Plugin Marketplaces` with the marketplaces of both scopes, project first (MSG-GR-3). The rpc refusals stay as they are.
- **Plugins screen.** One scenario pins a marketplace's plugin screen with an available, an installed, and an unavailable plugin (a catalog entry whose directory is missing, as `list.feature` builds one), with their tags and descriptions.
- **Actions screen.** The scenarios pin the actions an available plugin offers (`Install`, `Info`) and those an installed plugin offers (`Uninstall`, `Disable`, `Info`), through the screen rows.
- **Installing in each scope.** Choosing `User (global)` installs in the user scope (the seed), choosing `Project` installs in the project scope and declares the plugin in the project's `claude-plugins.json`, and choosing `Project local (Recommended)` installs in the project scope and declares it in `claude-plugins.local.json`. After an install, `/claude:plugin list` (rpc) shows the plugin installed in that scope (BROWSE-02 criterion 2).
- **Cancelling.** Cancelling at the install-scope screen and at the first screen installs nothing and leaves both scopes' config and installation record bytes unchanged (the existing `remembered` and `unchanged` steps), with a plugin already installed in one scope so "as they were" is not just "empty".
- **No marketplaces.** `browse` in the terminal with no marketplace added shows the `(no marketplaces)` result, Pi's existing empty-list grammar (upstream shows `No plugins available.` in its Discover tab; Pi has no tabs, so the list grammar stands).
- Every scenario runs once under the `adapter` profile, with no implementation tag: none has an MCP surface (D-BG-04).
- The terminal scenarios start a terminal Pi each, near the 15 s ready limit under load (P1-DC-65), so the phase keeps their number small and prefers one scenario that pins several screens of one walk over several scenarios that each open the picker.

### Install-scope screen (pre-existing divergence)

- **D-BG-1202 — the install-scope screen keeps its rows and order.** Pi lists `Project local (Recommended)`, `Project`, `User (global)`; Claude Code lists user, project, local, and marks none recommended. No scenario of this phase exposes a bug there, and reordering it is a picker feature change, which the milestone rules put out of scope. The scenarios pin today's rows, the phase logs the divergence as a dubious choice, and the last plan's SUMMARY lists a BACKLOG parent line for a parity change.

### Steps

- The phase uses the frozen picker steps (`plugin/picker.steps.ts`) and the shared command, config, and installation steps. It creates `features/step_definitions/plugin/browse.steps.ts` only for a step none of those provide, and keeps every seed step in use.

### Claude's Discretion

- How the count fix is split between `browse.ts` (loading the counts) and `plugin-browser.ts` (formatting the row), and the field names of `MarketplaceEntry`, as long as `demos/browse-demo.ts` (not type-checked, outside the ownership table) still runs or is left untouched with a note.
- Plan count and waves (both plans would edit `browse.feature`, so they cannot share a wave).
- Scenario titles and which walk pins which screen.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/plugin-picker.ts` (frozen): opens the picker, reads the frame's title and rows, chooses a row by label, and cancels with Escape once per screen. After the picker closes on an action, it waits for a notice row naming the plugin from the last screen's title (P1-DC-50).
- `features/step_definitions/plugin/picker.steps.ts` (frozen): `the user opens the plugin picker with {string} in pi's terminal`, `the plugin picker shows the screen {string} with these rows:`, `the user chooses {string} in the plugin picker`, `the user cancels the plugin picker`.
- `command.steps.ts`: `the user runs {string}` (rpc), `the result lists these plugins:`, `the user runs {string} in pi's terminal`, `pi's terminal shows this result of the command:`.
- `config.steps.ts`: `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged`, `the {string} file of the {word} scope declares these plugins:`.
- `plugin/installation.steps.ts`: `the installation record of the {word} scope holds these plugins:`, `the {word} scope has no installed plugins`.
- `marketplace/publishing.steps.ts`: `the marketplace {string} publishes this manifest:` builds a catalog entry whose directory is missing (`list.feature`, "source missing").

### Established Patterns
- `loadVisibleMarketplaces` returns project-scope records first, then user-scope ones.
- `PluginBrowser` is pure UI with an injected `pluginLoader`; `browse.ts` builds the first screen's `MarketplaceEntry` rows eagerly and loads plugins lazily.
- Unit tests: `test/edge/handlers/plugin/browse.test.ts` and `test/edge/browser/plugin-browser.test.ts` need 100% direct coverage of their source.

### Integration Points
- `edge/handlers/plugin/browse.ts::loadMarketplaceEntries` (the count source) and `edge/browser/plugin-browser.ts::showMarketplaces` (the row text).
- `edge/router.ts` maps bare `/claude:plugin` to the browse handler; no change is expected there.

</code_context>

<specifics>
## Specific Ideas

- Row text after the fix, for the seed: `extras [project]` → `2 available -- {home}/marketplaces/extras`, `tools [user]` → `1 available -- {home}/marketplaces/tools`.
- A marketplace offering two plugins with one installed: `2 available • 1 installed -- {source}`.

</specifics>

<deferred>
## Deferred Ideas

- Reordering and relabeling the install-scope screen to Claude Code's order (user, project, local) without a recommended row (D-BG-1202; BACKLOG parent line).
- Upstream's `Updated {date}` part of the marketplace row (Pi records no such date for the picker).

</deferred>

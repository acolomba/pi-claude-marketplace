# Phase 10: Model-Facing Tools - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted. Every decision a reviewer may reverse is also logged in `DUBIOUS-CHOICES.md` of this directory.

<domain>
## Phase Boundary

Phase 10 covers the two model-facing tools that `edge/handlers/tools.ts` registers, `pi_claude_marketplace_list` and `pi_claude_marketplace_plugin_list`, with cucumber scenarios in `features/plugin/model-tools.feature` that drive them through the scripted model and read the result the model receives on its next request (TOOL-01, TOOL-02, TOOL-03). It fixes, in `edge/handlers/tools.ts` and its unit pair `test/edge/handlers/tools.test.ts`, the product bugs those scenarios expose. It owns no other product file. The tools are this extension's own surface (D-02); Claude Code has no counterpart, so there is no upstream contract to research beyond the decisions recorded here.

</domain>

<decisions>
## Implementation Decisions

### Error results and the carried D-03 choice (D-BG-1001, D-BG-1003)

- **D-BG-1001 — both tools keep returning an `isError: true` result; neither throws.** json-output D-03 kept the TC-9 return shape and left "throw a redacted Error instead" to the user, because Pi 0.87.1 ignored a returned `isError`. Pi 1.5.0 honors it: `executePreparedToolCall` returns `isError: result.isError === true` (`node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:588`), so a returned error result reaches the model as a failed tool result, with the redacted text (PMOD-04). Throwing would add nothing and would hand Pi an unredacted message path again. TOOL-03's scenarios pin the result the model receives under Pi 1.5.0 (a `failed:` row in the call log). The D-03 question closes with this answer, logged as a dubious choice for the user's review (P10-DC-01).
- **D-BG-1003 — an unknown marketplace is an error result.** Today `pi_claude_marketplace_plugin_list` with a `marketplace` that no visible scope records returns `Marketplace "<name>" not found.` as a SUCCESS result. TOOL-03 requires an error result, so the not-found result gains `isError: true`. The text stays `Marketplace "<name>" not found.` and `details.marketplaces` stays `[]`. The same applies when the marketplace exists only in the scope the call did not ask for (the existing `marketplaceExists` check already narrows by scope). The credential redaction of the name stays (PMOD-04).
- An unknown scope is refused by Pi's own argument validation before `execute` runs, against the TypeBox union `"user" | "project"`; the model receives Pi's validation failure as a failed result, which the scenarios read through Phase 1's projection `invalid arguments: <paths>` (P1-DC-11, P1-DC-62). The product adds no scope check of its own.

### Marketplace list scope (D-BG-1002, D-BG-1005)

- **D-BG-1002 — `pi_claude_marketplace_list` gains an optional `scope` parameter.** Today its parameters are `{}`, so it cannot return "the scope it asks for" (TOOL-01). It takes the same optional `scope` union the plugin tool takes (`"user" | "project"`, same description wording adapted to marketplaces), and forwards it to `loadMarketplaceListEntries`, which already accepts `scope`. With no scope it returns both scopes, project first, as today. A scope with no marketplaces returns `No marketplaces configured.` (unchanged text, not an error: the scope is valid and simply empty). Content line shape is unchanged: `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`.
- **D-BG-1005 — the list tool's `<N> plugin(s)` keeps counting the plugins installed from the marketplace (D-09).** The scenarios pin it with a marketplace that offers more plugins than are installed, so a counter of offered plugins and a counter of installed ones print different numbers. Phase 12 re-checks the picker's similar count (BROWSE-01, P1-DC-48), which is a separate surface; whether the two should agree is left to the user (P10-DC-03).

### Plugin list statuses and filters (D-BG-1004)

- Each content line keeps the three-bucket projection (`[installed]`, `[available]`, `[unavailable]`, then the version, then the reasons in parentheses), with the existing folds: `upgradable`, `partially-installed`, and `partially-upgradable` read `[installed]`; `remote` reads `[available]` (RSTA-01); `partially-available` and `disabled` read `[unavailable]` (USTAT-02, D-54-01). The scenarios pin whole content texts, so a wrong fold fails them.
- **D-BG-1004 — each filter returns every plugin its tag names, and only those.** Today an installed-but-disabled plugin reads `[unavailable]` with no filter, but no single filter returns it: `installed: true` loads it and the tool's bucket re-filter drops it (it projects to the unavailable bucket), and `unavailable: true` never loads it (the loader's `--unavailable` admits the structural `unavailable` bucket only). Fix in `loadToolPluginPayload`: when the unavailable bucket is requested, also forward `installed: true` to the payload loader, so the disabled rows reach the tool's bucket re-filter, which keeps them under `unavailable` and still drops the installed-bucket rows the call did not ask for. The D-54-01 projection itself is kept (P10-DC-02 asks the user whether a disabled plugin should read `[installed]` instead). The `installed` and `unavailable` parameter descriptions are reworded so the model reads the same contract the tool applies: `installed` covers installed and enabled plugins; `unavailable` covers plugins this system cannot install and installed plugins that are disabled.
- **D-BG-1008 — every block that keeps no rows prints `  (no plugins)`.** The D-BG-1004 fix loads installed rows that the tool's bucket re-filter then drops, so a block could otherwise print a bare `Marketplace <name> (<scope>)` header; research found the existing output already prints `(no plugins)` for blocks the loader's filter empties. One shape for "this block lists nothing" replaces the WR-05 distinction (P10-DC-05).
- **D-BG-1009 — the "changes nothing" scenario combines parameters in 3 or 4 calls.** The call table compares every message of every call, (N+1)² rows for N calls, so the scenario makes a few calls that together use every parameter (scope, marketplace, each filter) rather than one call per form (P10-DC-06).
- The filters keep PL-1 union semantics: two filters return the plugins of either; no filter returns every plugin. The `marketplace` and `scope` parameters narrow the blocks as the slash command's `--marketplace` and `--scope` do.

### Observation and scenario shape (D-BG-1006, D-BG-1007)

- **D-BG-1006 — "changes nothing" is observed on the files the user reads.** A scenario remembers the config and installation record bytes of both scopes (`claude-plugins.json`, `pi-claude-marketplace/state.json`, through the shared `config.steps.ts` steps), lets the model call both tools with each parameter form in one prompt, then checks both scopes' bytes are unchanged and the staged skills and prompts are those of the installed plugins. Its red proof plants a write in a tool body (for example a `saveState` of the loaded state) and shows the scenario fails; the SUMMARY records it.
- **D-BG-1007 — no implementation tag.** The tools have no MCP surface, and the fixtures declare no MCP server, so every scenario carries no `@mcp`/`@adapter-only`/`@builtin-only` tag and runs once, under the `adapter` profile (D-BG-04).
- Every expected value is a whole literal in the feature file: the whole call table of `the model receives these calls:`, with each tool result's whole text. The seeds may be rewritten (they use common steps only), but every step they use stays in use.
- The verb step module `features/step_definitions/plugin/model-tools.steps.ts` is created only if a scenario needs a step that the shared and topic modules lack. The expected scenarios need none (publishing, adding, installing, disabling, the scripted model, the call log, and the remembered bytes all have shared steps).

### Claude's Discretion

- The fixture marketplaces, plugin names, and how many statuses each scenario shows, as long as each of the three buckets, each of its folds the fixture can produce cheaply (installed, upgradable, partially-installed, disabled, available, remote, unavailable, partially-available), and both scopes are covered, and every scenario fails without the behavior its title names.
- Scenario Outline versus separate scenarios, and the plan and wave split (plans in one wave own disjoint files; this phase has one product file and one feature file, so a single wave or two sequential waves are both fine).
- The exact wording of the reworded parameter descriptions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/step_definitions/model.steps.ts`: `pi runs with the scripted model`, `the scripted model plays these steps:` (columns `reply`, `tool`, `arguments`), and `the model receives these calls:` (columns `call`, `role`, `text`; a tool result reads `<tool> returned: <text>` or `<tool> failed: <text>` from the message's `isError`, `features/lib/scripted-model/script.ts:359-363`).
- `features/lib/upstream/pi.ts`: `projectArgumentValidationFailure` turns Pi 1.5.0's `Validation failed for tool "<tool>":` text into `invalid arguments: <sorted paths>`.
- `features/step_definitions/config.steps.ts`: `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged` (reads `claude-plugins.json` and `state.json`).
- `features/step_definitions/plugin/installation.steps.ts`: `the {word} scope stages these skills and prompts:`.
- `features/plugin/list-filters.feature` Background: a fixture that produces every list status (installed, upgradable, partially-installed via an output style and `--partial`, disabled, available, remote via the loopback git host, unavailable via an npm source, partially-available) across a project and a user marketplace; the tool scenarios can follow its shape.
- `features/plugin/model-tools.feature`: two seeds ("The model reads the marketplaces the list tool returns", "A plugin list call with a scope the tool does not accept reaches the model as invalid arguments").

### Established Patterns

- `edge/handlers/tools.ts` builds each result with `textContent` (credential redaction, PMOD-04) and catches every body failure into `loadFailure` (TC-9). The plugin tool forwards PL-1 filters only when the caller narrowed (`ToolFilterBuckets.narrowed`), folds `remote` into `available` and `partial` into `unavailable`, then re-filters the loaded rows by tool bucket in `renderPluginPayload`.
- `test/edge/handlers/tools.test.ts` (about 1900 lines) is the unit pair and pins the not-found text and the `isError` shapes; it must keep 100% direct coverage of `tools.ts`.
- `orchestrators/plugin/list-flow.ts::shouldShow`: `installed` admits installed, upgradable, disabled, partially-installed, partially-upgradable; `unavailable` admits only the structural `unavailable` bucket; `partial` the not-installed partially-available bucket; `remote` the cold git-source bucket.

### Integration Points

- `orchestrators/marketplace/list.ts::loadMarketplaceListEntries({ cwd, scope })` already narrows by scope; the list tool only has to forward it.
- `edge/register.ts` registers both tools; `features/mcp-server/{listing,builtin-direct,agent-grants}.feature` and `features/plugin/project-trust.feature` list the tool names only, so a parameter change does not touch them.

</code_context>

<specifics>
## Specific Ideas

- Seed 1 keeps its title and shape but shows both scopes: one marketplace per scope, so "no scope returns both scopes" is pinned, with an installed count different from the offered count (D-BG-1005).
- The plugin list scenarios read the whole content text, including the `Marketplace <name> (<scope>)` headers and the `  (no plugins)` line of a block the filter empties or the manifest leaves empty.

</specifics>

<deferred>
## Deferred Ideas

- A load failure (an unreadable `state.json`) reaching the model as `Failed to load <subject>: ...`, and a credential in a source URL redacted in the list tool's text (PMOD-04, TC-9). Both are existing, unit-tested behavior that TOOL-01..03 do not name; a later coverage pass may add them.
- Whether a disabled plugin should read `[installed]` in the tool (P10-DC-02) and whether the list tool and the picker should count the same plugins (P10-DC-03) wait for the user.

</deferred>

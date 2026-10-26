# Phase 10: Plugin Info - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is non-interactive, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Cucumber scenarios for `/claude:plugin info` in `features/plugin/info.feature`:
an installed plugin, an available plugin, a partially available plugin, an
unavailable plugin, `--fetch` against the git host, and a plugin the marketplace
does not offer (INF-01..INF-05). Test plugins carry skills only. The phase owns
`features/plugin/info.feature` and, if needed, `features/step_definitions/plugin/info.steps.ts`.
A product bug a scenario exposes is fixed here, with Claude Code as the reference.

</domain>

<upstream>
## Upstream evidence (claude-code-compat-research)

The phase touches the command surface, so it was researched.

- **Scope order when a plugin is installed in several scopes.** Claude Code 2.1.308
  (binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.308/claude`,
  grepped 2026-10-23) walks scopes most specific first: `["local","project","user"].find(...)`
  picks the effective installation, and `enabledPlugins` lookups loop over
  `["local","project","user"]`. Confidence: high for the precedence order; no
  upstream multi-scope info listing exists to copy literally.
- **`info --fetch`.** Claude Code has no fetch flag on `claude plugin details`
  (`claude plugin details --help`, 2.1.308: no options). `--fetch` is a Pi-side
  flag (FTCH-03, D-81-04): fetch, then resolve and list components. No upstream
  position on what it reports.
- **Version of a git plugin with no declared version.** The plugin manifest
  reference (https://code.claude.com/docs/en/plugins-reference, read 2026-10-23)
  says a declared `version` pins the plugin, and the manifest's version beats the
  entry's. With none declared, the commit identifies the version. The project
  records `sha-<12hex>` for a git-source install (D-77-01). Confidence: medium.

</upstream>

<decisions>
## Implementation Decisions

- **D-01:** `info` lists project before user when a plugin is installed in both scopes. This matches Claude Code's most-specific-first scope precedence; not a bug. The existing seed scenario pins it.
- **D-02:** INF-01's "source" is the marketplace the plugin was read from (`marketplace name` and `marketplace scope`). The plugin-info row carries no source field, and adding one is a feature, not a parity fix. The scenario title names the marketplace.
- **D-03:** Product bug, fixed in this phase: `info` on a not-installed git-source plugin with a warm clone or mirror showed no version when the marketplace entry declared none, so `info --fetch` could not report a new revision. The row now shows `sha-<12hex>` of the warm tree, the version an install of that tree records (D-77-01). A version the entry declares still wins, as the existing unit contract expects.
- **D-04:** `info --fetch` on an installed plugin keeps showing the installed revision. Info describes the installation; the newer revision is what `update` brings. INF-04 is proven on a not-installed plugin: fetch, the repository moves, `info --fetch` reports `{ghp revision 2}` with its requests. A bare `info` after that shows the revision fetched last and makes no request.
- **D-05:** The unavailable case uses an npm-source entry (Claude Code supports npm sources, Pi does not), reported `unavailable` with `unsupported source`. A path source whose directory is missing also reports `unsupported source` in info, install, and list alike; that wording is shared resolver classification, outside this phase, and is recorded as a follow-up rather than enshrined in a scenario.
- **D-06:** The partially available case uses the Phase 1 output-style fixture: `partially-available` with `unsupported component` and the skills an install would keep.
- **D-07:** A single `plugin-info` result is stated whole with `the result has these fields:` (that step compares every field of a non-cascade result); the two-scope `plugin-info-cascade` keeps its rows table. No phase-local step module is needed.
- **D-08:** Request-log steps appear only in the git-source scenarios (cucumber `rules/steps.md`).
- **D-09:** A remote plugin that was never fetched is covered too: `remote`, components not resolved, no request (the NFR-5 half of INF-04).

### Claude's Discretion
Scenario titles and the exact table layout.

</decisions>

<deferred>
## Deferred Ideas

- A missing path-source directory reads `unsupported source` instead of `source missing` across info, install, and list (`shared/probe-classifiers.ts` catch-all). Shared with Phases 3 and 9; needs its own change.
- `list` may show no version for a fetched git plugin whose entry declares none, as info did before D-03 (Phase 9's surface).

</deferred>

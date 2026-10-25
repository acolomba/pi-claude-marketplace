# Phase 9: Plugin List - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

Phase 9 adds cucumber coverage for `/claude:plugin list` (LST-01..LST-05) in
`features/plugin/list.feature`, plus `features/step_definitions/plugin/list.steps.ts`
only if a list-specific step is needed. It fixes the product bugs the
scenarios expose. It edits no Phase 1 file and no file another phase owns.

</domain>

<upstream>
## Claude Code evidence (claude-code-compat-research)

The phase touches the command surface, so it was researched first.

- **Question:** What does Claude Code's plugin list show, and does it have a
  `--remote` flag or a per-marketplace or per-scope filter?
  **Behavior:** `claude plugin list` (Claude Code 2.1.308, `claude plugin list --help`,
  observed 2026-10-23) lists installed plugins, with `--available` (adds the
  plugins marketplaces offer, needs `--json`), `--json`, and `--data-size`. It
  has no `--remote`, no `--installed`/`--unavailable`/`--partial` filter, no
  marketplace positional, and no `--scope` filter. It does not check git hosts
  for newer revisions.
  **Confidence:** high for the flag set (the binary's own help); the in-session
  `/plugin` TUI is not a list command.
  **Consequence:** pi-claude-marketplace's filter family (PRD PL-1, PL-8,
  RSTA-07), the marketplace positional (PL-3), and `--scope` (SC-6) are
  Pi-side surface with no upstream contract to match. The PRD and the output
  catalog are the reference for them.
- **Question:** How does an unknown marketplace fail?
  **Behavior:** no upstream position (no marketplace positional upstream). The
  PRD flowchart under 5.3.1 says a named marketplace that is not found is an
  error, and every other verb that names a marketplace (`marketplace info`,
  `marketplace remove`, `autoupdate`, `plugin info`) emits the
  `marketplace-not-added` result with `{marketplace not added}`, or
  `{marketplace not added to <scope> scope}` when a single scope was asked and
  the other holds it.
- **Question:** Which installations does `--scope` keep?
  **Behavior:** upstream records marketplaces without a scope and scopes only
  installations, and its `plugin list` prints each installation's scope. So a
  scope filter on installations is the upstream reading of LST-05.

</upstream>

<decisions>
## Implementation Decisions

### What the phase observed (probe runs, 2026-10-23)
- `list` already shows every row status with the right scope: `installed`,
  `upgradable`, `disabled`, `partially-installed`, `available`,
  `partially-available` (`unsupported component`), `unavailable`
  (`unsupported source`, an npm source), and `remote` (a git source not yet
  cloned). The filters keep their buckets and union when combined.
- `list <unknown marketplace>` emits an empty info `cascade`, not a failure.
- `list --scope project` drops a project-scope installation whose marketplace
  only the user scope added (the fold rule groups it under the user block),
  and `list --scope user` shows that project installation.
- `list --remote` keeps only `remote` rows; a marketplace with none keeps its
  empty header.

### Product fixes
- **D-01:** `list <marketplace>` for a marketplace that no consulted scope
  records fails with the `marketplace-not-added` result, the same result
  `marketplace info` and `plugin info` emit: `scope` is set only under
  `--scope`, and the cross-scope flag is computed through `crossScopeFlag`, so
  `--scope user` on a project-only marketplace reads
  `marketplace not added to user scope`. A marketplace "is added" to a scope
  when that scope's `state.json` holds its record, as
  `collectMarketplaceRecordsByScope` decides for info. The check lives in
  `listPlugins` (the command path); the LLM tool and the browser loader keep
  the payload builder unchanged.
- **D-02:** `--scope <s>` keeps the installations of scope `<s>` only. The
  cross-scope fold (a project record cloned from a user marketplace, grouped
  under the user header) serves the both-scopes view only. Under `--scope`,
  each block lists one scope's own records and candidates: a project clone
  shows under its own `[project]` header, and under `--scope user` a plugin
  installed only in the project scope is an `available` row. A clone whose
  manifest cannot be read keeps its `(failed)` header. Without `--scope`,
  output is unchanged. (Amended after code review CR-01..CR-03: the first
  design filtered rows after the fold and lost rows and failed headers.)

### Not bugs (recorded so verification does not reopen them)
- **D-03:** `--remote` is the RSTA-07 / D-80-07 filter for the `remote`
  bucket: a git-source plugin that is not installed and whose clone is not
  materialized. It never contacts the git host, and neither does `list`:
  NFR-5 says `list` MUST NOT touch the network, and Claude Code has no flag
  that checks hosts for newer revisions. ROADMAP success criterion 4 ("reports
  a git-source plugin whose source has a newer revision on the git host") is
  read as: `list --remote` reports the not-yet-cloned git-source plugin, and
  neither `list` nor `list --remote` sends a request to the git host. The
  scenario proves both with the request-log step.
- **D-04:** The "empty block" that Phase 1 research noted for `list --remote`
  is a marketplace header kept with no rows when a filter matches none of its
  plugins. The output catalog (`docs/output-catalog.md`, plugin list intro)
  documents an empty marketplace header as grouping context, so it stays. The
  scenarios state it as a row with only marketplace fields.

### Scenarios
- **D-05:** One whole-table scenario covers every list row status with its
  scope: an installed plugin in the user scope under its own marketplace, and
  in the project scope `upgradable`, `disabled`, `partially-installed`,
  `available`, `partially-available`, `unavailable`, and `remote` rows (LST-01).
  The upgradable row comes from a manifest rewrite that raises the version.
  The unavailable row comes from an npm source entry.
- **D-06:** Each filter (`--installed`, `--available`, `--unavailable`,
  `--partial`, `--remote`) has a scenario over the same fixture whose table
  lists every row kept, and one scenario combines two filters for the union
  (LST-02). A `Scenario Outline` over the four single filters would hide the
  per-filter row sets in `Examples`, so each filter is its own scenario.
- **D-07:** `list <marketplace>` keeps only that marketplace's rows; an
  unknown marketplace fails as not added, with and without `--scope`, and a
  marketplace the other scope holds fails as not added to the asked scope
  (LST-03).
- **D-08:** `--scope user` and `--scope project` each keep only that scope's
  installations, including a project installation from a marketplace only the
  user scope added (LST-05).
- **D-09:** `--remote` scenarios live in `list.feature` and use the git host
  request log (allowed in feature files whose scenarios use git sources).
- **D-10:** Steps: the phase reuses the Phase 1 steps. A list-specific step
  goes in `features/step_definitions/plugin/list.steps.ts` only if needed;
  none is expected.

### Claude's Discretion
- Plugin and marketplace names in the fixtures, and how the setup is shared
  between scenarios (no `Background:` unless every scenario needs all of it).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 9"
- `.agents/skills/cucumber/` (SKILL.md and rules/)
- `docs/prd/pi-claude-marketplace-prd.md` 5.3.1 (PL-1..PL-9) and SC-6
- `docs/output-catalog.md` plugin list section
- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` (`buildNotAddedMessage`)
- `extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts`

</canonical_refs>

<deferred>
## Deferred Ideas

None.

</deferred>

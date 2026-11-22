---
phase: 05-mcp-install-legacy-move-and-overrides
fixed_at: 2026-11-22T08:08:46Z
review_path: .planning/phases/05-mcp-install-legacy-move-and-overrides/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-22T08:08:46Z
**Source review:** .planning/phases/05-mcp-install-legacy-move-and-overrides/05-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, IN-01, IN-03, as the
  orchestrator set the scope; IN-02 stays open)
- Fixed: 8
- Skipped: 0

The work ran in the main checkout on `claude/stoic-shannon-la9q7o`, as the orchestrator said
(no worktree). All checks below ran there, so they reproduce from this tree.

## Fixed Issues

### CR-01: The project update over a kept disable stub republishes the same server

**Files modified:** `features/mcp-server/lifecycle.feature`
**Commit:** 7ec7e16
**Applied fix:** The update scenario (LC4, now `lifecycle.feature:1315`) publishes
`.mcp.json` with `"args": ["v2"]` together with version 1.1.0. It expects the whole project
`mcp-adapter.json` to hold `"args": ["v2"]` next to `"disabled": true` and the `keptOverride`
marker. The title now says that the update writes the new server definition. Red proofs, on the
`mcp-adapter.json` holds-this-text step, under both profiles:

| Break | Change | adapter | builtin |
| --- | --- | --- | --- |
| O8a | `bridges/mcp/stage.ts`: the overlays drop out of the kept overrides | `1) ... # features/mcp-server/lifecycle.feature:1315` | same |
| O8b | `bridges/mcp/adapter-doc.ts`: no kept override is read from the selected entry | same | same |
| K1 | `bridges/mcp/adapter-entry.ts` `stampServers`: an entry whose previous entry has a `keptOverride` keeps the previous entry | same | same |

### CR-02: No scenario shows a load moving a git plugin's legacy entries once its clone is cached

**Files modified:** `features/mcp-server/legacy-move.feature`
**Commit:** bae58b4
**Applied fix:** A new `@mcp` scenario, "A load moves a git plugin's servers out of a release
0.19.2 mcp.json while its clone is cached (AMIG-01)" (`legacy-move.feature:785`). It installs
`ghp@gits` and keeps the clone cache. It writes the 0.19.2 `mcp.json` and starts a new
session. It then compares the `moved` row, the whole `mcp-adapter.json` with `CLAUDE_PLUGIN_ROOT`
at `{project dir}/.pi/pi-claude-marketplace/plugin-clones/66356916cc08-{ghp revision 2}`, and the
whole `mcp.json`, which holds only `mine`. LM10 (`:721`, reinstall) now also compares the whole
project `mcp-adapter.json`. Red proofs, both profiles:

| Break | Change | Fails | Step |
| --- | --- | --- | --- |
| C2a | `orchestrators/reconcile/mcp-migration.ts` `offlineCloneRead`: every clone read is `not-cached` | only `:785` of `:721`, `:785`, `:1087` (LM10 and LM16 pass, which shows the gap the review named) | `Then the session reports these results:` |
| C2b | `bridges/mcp/substitute.ts`: a clone-rooted `CLAUDE_PLUGIN_ROOT` loses its last segment | `:721` | `Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:` |
| C2c | same as C2b | `:785` | same |

### WR-01: The check that no legacy mcp.json is created through the override lifecycle was dropped

**Files modified:** `features/step_definitions/mcp-configuration.steps.ts`,
`features/mcp-server/lifecycle.feature`,
`.planning/phases/05-mcp-install-legacy-move-and-overrides/05-03-SUMMARY.md`
**Commit:** 2c5c68d
**Applied fix:** A new step, `the mcp configuration file {string} of the {word} scope does not
exist`. It accepts only the names in `MCP_CONFIG_FILES` and asserts `ENOENT`. LC1 (`:1149`) and
LC2 (`:1213`) check `mcp.json` in both scopes. LC3 to LC6 (`:1256`, `:1315`, `:1377`, `:1436`)
check the project scope, next to the user scope that the scenario remembers. The 05-03-SUMMARY
sentence now says which scope the old reason held for, and says that the check is back. Red
proofs, both profiles, each failing on the new absence step:

| Break | Change | Scenarios |
| --- | --- | --- |
| W1a | `bridges/mcp/stage.ts` `removeLegacy`: writes an empty project `mcp.json` when there is nothing to sweep | `:1149`, `:1256` (project step) |
| W1b | `bridges/mcp/unstage.ts`: the uninstall always writes the project `mcp.json` | `:1213`, `:1436` (project step) |
| W1c | `bridges/mcp/legacy.ts` `removeLegacyMcpEntries`: writes the file when it removes nothing | `:1315`, `:1377` (project step) |
| W1d | `bridges/mcp/stage.ts` `removeLegacy`: writes `<agent dir>/mcp.json` | `:1149` (user step) |
| W1e | `bridges/mcp/unstage.ts`: writes `<agent dir>/mcp.json` | `:1213` (user step) |

The first W1c attempt broke the `config === undefined` branch, which the update path never
reaches because a missing file reads as an empty document. Both scenarios passed under that
break, so W1c above is the second attempt.

### WR-02: The "as release 0.19.2 wrote it" step claims a provenance it neither builds nor checks

**Files modified:** `features/lib/mcp-configuration.ts`,
`features/step_definitions/mcp-server/legacy-move.steps.ts`,
`features/mcp-server/legacy-move.feature`
**Commit:** 5643754
**Applied fix:** This uses the real release shape and keeps the step name. A new function,
`legacyMcpServers({ scopeRoot, pluginId, pluginRoot })`, builds the entries 0.19.2 wrote. It
takes them from the plugin's declared servers through `legacyEntry`. `writeLegacyMcpConfig` now
calls it. The step now requires the two-space form that release wrote. It groups the marked
entries by the plugin their marker names, and it requires each group to match
`legacyMcpServers` for the `CLAUDE_PLUGIN_ROOT` the entries name, key order included. All seven
doc strings (LM1 to LM4 and LM7 to LM9) now hold the injected env. The red proof is a precondition
check, not a product break: a copy of LM1 (`:305`) with the env removed fails in the `Given`, with
`demo@fixtures names no one plugin root`, under both profiles. The file was restored from a saved
copy.

### WR-03: The cold-cache scenario's title says the warning names the reinstall

**Files modified:** `features/mcp-server/legacy-move.feature`
**Commit:** 0ddc607
**Applied fix:** The scenario is renamed to "A load leaves a git plugin's entries in mcp.json
while its clone is not cached, and warns that its source is unreadable (AMIG-01)". The title
now claims only the `source-unreadable` row that the table compares. No check changed, so no
red proof applies. The L8 break of plan 05-02 still covers the row.

### WR-04: `MCP_INVENTORY` and `listText` keep an implementation parameter that has one value

**Files modified:** `test/integration/mcp-verdict-migration.test.ts`
**Commit:** b35272b
**Applied fix:** The built-in tools and commands are now inline in `listText(cwd)`. The map
and the parameter are gone. The three cases pass.

### IN-01: The kept-case headers say the cases check only fields no user sees

**Files modified:** `test/integration/mcp-verdict-migration.test.ts`
**Commit:** 673fdfa
**Applied fix:** The header now says that the first two cases pin the rendered move notice. It
says that the third pins the `list` row "partially-upgradable {unsupported mcp}" of a record
whose catalog moved, and that no scenario shows that text yet.

### IN-03: Removing the launch file at release is already defended elsewhere

**Files modified:** `features/step_definitions/mcp-implementation.steps.ts`
**Commit:** 07b2678
**Applied fix:** The `onRelease` removal and the unused `rm` import are gone. The step comment
says why no release is needed: `Before()` empties the sandbox home. The writer also opens the
file with `wx`, so a second launch in one scenario fails either way. The five
`configuration.feature` scenarios that use the step (`:789`, `:848`, `:894`, `:920`, `:943`)
pass under both profiles.

## Open

- IN-02 (three near-identical launch-environment steps) stays open, as the orchestrator
  scoped it.

## Verification

All checks ran in the main checkout, with
`npm_config_script_shell=<scratch>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.

- `npm run check:static`: every member passed (typecheck, lint, lint:workflows, fallow,
  format:check, test:corresponding, check:features).
- `features/mcp-server/legacy-move.feature`: 23/23 under adapter and builtin.
- `features/mcp-server/lifecycle.feature` and `features/mcp-server/configuration.feature`:
  71/71 adapter, 57/57 builtin.
- `features/mcp-server/verdict-list.feature` and `features/plugin/subagent-child.feature`
  (other users of the changed legacy writer): 31/31 adapter, 24/24 builtin.
- `test/integration/mcp-verdict-migration.test.ts`: 3/3 pass.
- Each break ran through `break.sh`, which restores `extensions/` on exit. Every log shows
  `restored=clean`, and `git status --porcelain -- extensions/` is empty. No break was committed.
- No hook was skipped. One commit attempt failed gitlint (title of 73 characters) and was
  retried with a shorter title.

---

_Fixed: 2026-11-22T08:08:46Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

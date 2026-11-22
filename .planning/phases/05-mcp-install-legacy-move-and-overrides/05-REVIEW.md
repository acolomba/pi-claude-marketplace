---
phase: 05-mcp-install-legacy-move-and-overrides
reviewed: 2026-11-22T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - features/step_definitions/mcp-implementation.steps.ts
  - features/step_definitions/session.steps.ts
  - features/step_definitions/mcp-server/legacy-move.steps.ts
  - features/step_definitions/mcp-server/lifecycle.steps.ts
  - features/mcp-server/configuration.feature
  - features/mcp-server/options.feature
  - features/mcp-server/legacy-move.feature
  - features/mcp-server/verdict-list.feature
  - features/mcp-server/lifecycle.feature
  - test/integration/mcp-migration.test.ts
  - test/integration/mcp-verdict-migration.test.ts
  - test/integration/mcp-verdict-list.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
  necessity: 2
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Scope: the diff since `356f8bb` of the four step modules, the five feature files, and the three
trimmed integration files. I compared each deleted or trimmed integration case
(`git show 356f8bb:test/integration/{mcp-home-path-partial,mcp-tool-rules,mcp-variable-expansion,mcp-legacy-sweep,mcp-migration,mcp-verdict-migration,mcp-verdict-list,mcp-override-lifecycle}.test.ts`)
with the scenario that the 05-02 and 05-03 SUMMARY case maps say replaces it.

Most replacements check at least as much as the deleted cases. The `mcp-adapter.json` and
`mcp.json` claims compare whole files. "Leaves alone" uses the whole-scope remembered/unchanged
steps. `the command reports these results:` and `the session reports these results:` compare the
whole envelope of every payload (`namesLike` in `features/lib/field-rows.ts` appends every column
the table leaves out), so a leaked sentinel or an extra notice fails them. The tags follow CONTEXT
[Tags, after research]: every new legacy-move, override, and variable scenario is `@mcp`, and the
only licensed pair is the MREC-03 pair (`verdict-list.feature:304`/`:333`).
`npm run check:features` passes on this tree, and Prettier passes on the changed TypeScript files.

Two replacements do not fail on the bug their deleted case caught:

- The project update in the cross-scope override flow republishes the same server definition.
- The warm-cache half of the git-plugin load move now goes through `reinstall`, a different code
  path.

Both are BLOCKERs under the cucumber skill's review rule: a plausible wrong implementation passes
the scenario. The other findings are a dropped absence check, a step name that claims a provenance
it does not enforce, a title that claims more than the scenario checks, and some test-code
leftovers.

## Critical Issues

### CR-01: The project update over a kept disable stub republishes the same server, so an update that never restages the entry still passes

**File:** `features/mcp-server/lifecycle.feature:1310`
**Issue:** The deleted case `mcp-override-lifecycle.test.ts:117` republished `hello` at 1.1.0 with
a changed server (`args: ["v2.js"]`). It then asserted that the updated entry held the new args
and also kept `disabled: true` and the `keptOverride` marker. That proves the update restages the
entry and keeps the user's stub. The replacement (LC4) changes only the version, with
`Given the marketplace "fixtures" offers these plugins: | demo | 1.1.0 |`, and leaves `.mcp.json`
as it was. Its expected `mcp-adapter.json` text is therefore the same as the text before the
update. An update that skips the MCP restage when an entry carries a `keptOverride` would pass,
and so would an update that keeps the old entry in place of the new definition. The deleted case
failed on both. The older `@adapter-only` scenario `lifecycle.feature:317` changes the server, but
it covers a disable the user makes after the install, which has no `keptOverride`. It does not
cover the kept-override path either.
**Fix:** Publish a changed server with the new version, and expect the new definition with the
stub still applied:

```gherkin
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": ["v2"]}}}
      """
    ...
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      ...
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [
              "v2"
            ],
            ...
            "disabled": true,
            ...
              "keptOverride": { "disabled": true, "env": { "STUB_TOKEN": "stub-secret" } }
      """
```

Then re-run the O8a/O8b breaks, plus a break that makes the update keep the old entry when a
`keptOverride` exists. Record both in the SUMMARY.

### CR-02: No scenario shows a load moving a git plugin's legacy entries once its clone is cached, and the reinstall stand-in checks only mcp.json

**File:** `features/mcp-server/legacy-move.feature:721` (and `:999`)
**Issue:** The deleted case `mcp-migration.test.ts:448` had two halves. On a cold cache the load
leaves the entry and warns. Once the recorded clone exists, the next load moves the entry, writes
`plugin_hello_srv_` with `CLAUDE_PLUGIN_ROOT` set to the recorded clone directory, and empties
`mcp.json`. The 05-02 case map gives the cold half to LM16 (`:999`) and the warm half to LM10
(`:721`, "through the reinstall that the notice names"). `reinstall` runs the install-time sweep
(AMIG-02), not the load's move (AMIG-01). A load that cannot resolve a git plugin's recorded clone
when the clone is present, and so reports `source-unreadable` for every git plugin, passes both
scenarios:

- LM16 expects `source-unreadable`.
- LM10 never runs a load.

No other scenario moves a git plugin at load. Both 0.19.2-move scenarios for `ghp@gits` delete the
clone cache first (`grep "as release 0.19.2 wrote them" features` shows only `:735` and `:1013`).
LM10 also checks only `mcp.json`. The written `mcp-adapter.json` entry, including the clone-rooted
`CLAUDE_PLUGIN_ROOT`, goes unchecked.
**Fix:** Add a scenario with the cache kept warm:

```gherkin
  @mcp
  Scenario: A load moves a git plugin's servers out of a release 0.19.2 mcp.json while its clone is cached (AMIG-01)
    Given the git repository "ghp" holds these plugins: ...
    Given the git repository "ghp" adds this .mcp.json to the plugin "ghp": ...
    Given the marketplace "gits" ... is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "ghp@gits" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"project","plugin":"ghp","marketplace":"gits","from":"srv","to":"plugin_ghp_srv_"}] |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text: ... (CLAUDE_PLUGIN_ROOT under the plugin clone)
    Then the mcp configuration file "mcp.json" of the project scope holds this text: ... (only "mine")
```

In LM10, also compare the whole `mcp-adapter.json` of the project scope.

## Warnings

### WR-01: The check that no legacy mcp.json is created through the override lifecycle was dropped, and the SUMMARY's reason is wrong for the project scope

**File:** `features/mcp-server/lifecycle.feature:1149-1465`
**Issue:** The deleted cases `mcp-override-lifecycle.test.ts:46` and `:117` asserted that neither
`<project>/.pi/mcp.json` nor `<agent dir>/mcp.json` exists after install, update, reinstall, and
uninstall (`legacyMcpJsonExists`). 05-03-SUMMARY says this check is left out because "the
whole-scope steps and the `mcp-adapter.json` texts already cover the user's files". That holds for
the user scope only: LC3 to LC6 remember and compare the user scope. No new lifecycle scenario
remembers the project scope. The `mcp-adapter.json` text steps do not read `mcp.json`. So a
regression that writes the project's legacy `mcp.json` during a project install or uninstall
passes every replacement. Under Pi's built-in MCP, `<scope>/mcp.json` is a file the user owns
(BLT-04/05). The project's "never in the file" claim is now narrower than the deleted check.
**Fix:** Add an absence step for the MCP configuration files, for example
`Then the mcp configuration file "mcp.json" of the project scope does not exist`. Use
`MCP_CONFIG_FILES` the way the config step at `config.steps.ts:286` uses `CONFIG_FILES`. Add it to
LC1, LC2, and LC6, and correct the SUMMARY sentence.

### WR-02: The new "as release 0.19.2 wrote it" step claims a provenance that it neither builds nor checks

**File:** `features/step_definitions/mcp-server/legacy-move.steps.ts:71-82` (used at
`legacy-move.feature:312, :379, :446, :511, :629, :650, :673`)
**Issue:** The step writes any doc string that has at least one marked entry, and its name says the
text is "as release 0.19.2 wrote it". The doc strings that use it are compact one-line JSON of
stdio entries with no `env`. Release 0.19.2 injected `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`
into every stdio entry it wrote (`features/lib/mcp-configuration.ts:117-135`, `legacyEntry`). So
the step text tells the reader something that is not true. CONTEXT [Earlier records] says
scenarios use real released-build shapes, "no hand-made record that no release wrote". Today the
mismatch hides no behavior, because the sweep keys on the marker. But the next scenario that
depends on the legacy body will pass against a shape no release produced.
**Fix:** Name the step for what it checks, for example
`the mcp.json file of the {word} scope holds this text, with marked entries of a plugin the scope does not record:`.
Or build each marked entry through `legacyEntry` from a declared server and a plugin id, as
`writeLegacyMcpConfig` does.

### WR-03: The cold-cache scenario's title says the warning names the reinstall, but nothing checks it

**File:** `features/mcp-server/legacy-move.feature:999`
**Issue:** The title is "... and names the reinstall that moves them". The deleted case checked the
rendered text "Run /claude:plugin reinstall hello@mp to move it." The scenario compares only the
JSON row `{"kind":"source-unreadable",...}`, which holds no command. A notice that drops or
misnames the reinstall hint passes. A reader sees from the title alone that the hint was proved,
which is the "point lives only in a step's code" finding of the cucumber review rules.
**Fix:** Drop the claim from the title, for example "A load leaves a git plugin's entries in
mcp.json while its clone is not cached, and warns". Or add a terminal step
(`pi's terminal shows this result of the command:`) that shows the rendered hint.

### WR-04: Generality without instantiation: `MCP_INVENTORY` and `listText` keep an implementation parameter that has one value

**File:** `test/integration/mcp-verdict-migration.test.ts:183-206`
**Category:** necessity
**Issue:** The trim removed the `adapter` key. `MCP_INVENTORY` now holds only `builtin`, and the
only call site of `listText` passes `"builtin"` (`:233`). The `implementation:
keyof typeof MCP_INVENTORY` parameter and the lookup table select among a single option. The
`adapterCommand` and `adapterProxyTool` imports were removed with it, which proves that no other
value remains.
**Fix:** Inline the built-in inventory into `listText(cwd)` and drop the map and the parameter.

## Info

### IN-01: The kept-case headers say the cases check only fields no user sees, but they assert user-visible text

**File:** `test/integration/mcp-verdict-migration.test.ts:3-12`
**Issue:** The header says that each of the three kept cases "checks the record fields that the
move writes, which no user sees". But `:134-145` and `:164-176` also assert the whole rendered move
notice, and `:250` asserts the rendered `list` row "partially-upgradable {unsupported mcp}". That
row is user-visible, and no feature file shows it for a 0.19.2 record whose catalog moved. Phase 8
triage will read this header to decide what stays internal.
**Fix:** Say that the cases also pin the move notice and the list row, and that those parts have no
scenario yet.

### IN-02: Three near-identical launch-environment steps

**File:** `features/step_definitions/mcp-implementation.steps.ts:63-80`
**Issue:** The new step has the same body as
`mcp-server/configuration.steps.ts:247-262` (built-in) and `mcp-server/listing.steps.ts:125-141`
(adapter): write the launch file, register its removal, start the profile Pi with
`PI_LAUNCH_ENVIRONMENT_EXTENSION`, and check the applied variables. Only the profile differs. The
new step's own "enabled" sibling in `lifecycle.steps.ts:77-93` also repeats the read-modify-write
and `isRecord` logic of `writeMcpAdapterOverride`.
**Fix:** Move a `startPiWithLaunchEnvironment(world, profile, variables)` helper into
`features/lib/pi-launch-environment.ts` and call it from all three steps.

### IN-03: Already defended elsewhere: removing the launch file at release

**File:** `features/step_definitions/mcp-implementation.steps.ts:73`
**Category:** necessity
**Issue:** `this.onRelease(() => rm(file, { force: true }))` removes
`<home>/pi-launch-environment.json`. The `Before()` hook already empties every sandbox directory
for the next scenario (`features/support/pi-process.ts:8`, `features/support/isolated-pi-home.ts:66`),
and the module comment of `features/lib/pi-launch-environment.ts` says so. The copied pattern
guards against nothing. This is a judgment call, because the two older steps do the same.
**Fix:** Drop the release, or keep it and say why, for example to allow a second launch in one
scenario.

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

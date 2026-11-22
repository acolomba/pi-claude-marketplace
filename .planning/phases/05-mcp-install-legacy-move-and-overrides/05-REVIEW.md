---
phase: 05-mcp-install-legacy-move-and-overrides
reviewed: 2026-11-22T12:00:00Z
depth: standard
iteration: 2
files_reviewed: 14
files_reviewed_list:
  - features/step_definitions/mcp-implementation.steps.ts
  - features/step_definitions/session.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/mcp-server/legacy-move.steps.ts
  - features/step_definitions/mcp-server/lifecycle.steps.ts
  - features/lib/mcp-configuration.ts
  - features/mcp-server/configuration.feature
  - features/mcp-server/options.feature
  - features/mcp-server/legacy-move.feature
  - features/mcp-server/verdict-list.feature
  - features/mcp-server/lifecycle.feature
  - test/integration/mcp-migration.test.ts
  - test/integration/mcp-verdict-migration.test.ts
  - test/integration/mcp-verdict-list.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
  necessity: 0
status: issues_found
---

# Phase 5: Code Review Report (iteration 2)

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Scope: the fix commits `b35272b..5643754`, read against the iteration-1 findings and the red
proofs in `05-REVIEW-FIX.md`. I also re-read the phase diff since `356f8bb` for the files listed
above. Two files are new to the scope: `features/lib/mcp-configuration.ts` and
`features/step_definitions/mcp-configuration.steps.ts`. The fixes changed both. I did not re-run
cucumber, because `npm run check` is running on this tree. Each red proof below was checked by
tracing the changed step or scenario against the break that REVIEW-FIX names.

Status of the iteration-1 findings in scope:

| ID | Status | Evidence |
| --- | --- | --- |
| CR-01 | Fixed | LC4 (`lifecycle.feature:1315`) now publishes `"args": ["v2"]` with 1.1.0 and compares the whole project `mcp-adapter.json`: `"args": ["v2"]`, `"disabled": true`, and the `keptOverride` marker. An update that skips the restage, or that keeps the previous entry, leaves `args: []`, so the text step fails. K1 (`stampServers` keeps the previous entry) is the break the review asked for. O8a and O8b still fail LC4. |
| CR-02 | Fixed | New `@mcp` scenario at `legacy-move.feature:897`. It installs `ghp@gits`, keeps the clone, writes the 0.19.2 `mcp.json`, and starts a session. It compares the `moved` row, the whole `mcp-adapter.json` (with `CLAUDE_PLUGIN_ROOT` set to the clone directory), and the whole `mcp.json`. C2a (`offlineCloneRead` returns `not-cached`) fails only this scenario, so LM10 and LM16 do not catch that break. This confirms the gap. LM10 (`:833`) now compares the whole `mcp-adapter.json` too (C2b). |
| WR-01 | Fixed | New step `the mcp configuration file {string} of the {word} scope does not exist` (`mcp-configuration.steps.ts:146-153`). It takes only names in `MCP_CONFIG_FILES` and asserts `ENOENT`. Its text cannot match the `the {string} file of the {word} scope does not exist` config step, because that step needs a quote right after "the". LC1 and LC2 check both scopes. LC3 to LC6 check the project scope, and the remembered user scope covers the user side. Breaks W1a to W1e cover each verb. |
| WR-02 | Fixed (one gap, see WR-01 below) | The doc-string step now requires the two-space form. It groups the marked entries by marker and requires each group to equal `legacyMcpServers(...)`, key order included. All seven doc strings now carry the injected `env`. The red proof is a failing `Given` on a copy with the env removed. That is the right kind of proof for a precondition step. |
| WR-03 | Fixed | `:1199` now claims only the `source-unreadable` warning, which the table compares. |
| WR-04 | Fixed | `listText(cwd)` inlines the built-in inventory (`mcp-verdict-migration.test.ts:185-200`). The map and the parameter are gone. |
| IN-01 | Fixed | The header (`:11-15`) now says that the first two cases pin the rendered move notice and the third pins the `list` row. The assertions at `:134-145`, `:164-176`, and `:249-254` match that claim. |
| IN-03 | Fixed | The release and the `rm` import are gone. `features/support/pi-process.ts:228-236` empties every sandbox directory, home included, before each scenario. So the launch file cannot outlive its scenario. `writeLaunchEnvironment` opens with `wx` (`pi-launch-environment.ts:55`). |
| IN-02 | Open by decision | Carried below as IN-01. |

Regression check on the shared legacy writer: `writeLegacyMcpConfig` keeps its behavior. The
entry building moved into `legacyMcpServers` unchanged. `Object.fromEntries` builds the same
key order, and `...legacy` spreads the same members that `...Object.fromEntries(legacy)` did.
`plugin` and `marketplace` are still used by the `isMarkedFor` filter. So the other callers
(`verdict-list.feature`, `plugin/subagent-child.feature`, and the writer-step scenarios in
`legacy-move.feature`) see the same files. The fixer's runs of those features under both
profiles agree with this.

The remaining findings come from the new 0.19.2 doc-string validation and from the shared library
module that the fixes touched. None of them lets a wrong product implementation pass.

Out-of-scope note (planning artifacts, not reviewed as source): the case map in
`05-02-SUMMARY.md:126` still gives the warm half of `mcp-migration.test.ts:448` to LM10. C2a shows
that LM10 does not catch it; the new scenario at `legacy-move.feature:897` does. The iteration-1
CR-01 fix asked for its breaks to be recorded in the SUMMARY. `05-03-SUMMARY.md` has no K1 entry,
and only `05-REVIEW-FIX.md` records it. Phase 8 triage reads those case maps, so point both at the
new scenario and the K1 break.

## Warnings

### WR-01: The 0.19.2 doc-string step refuses a real release shape: a plugin that has a remote server

**File:** `features/step_definitions/mcp-server/legacy-move.steps.ts:61-75` (called at `:130`)
**Issue:** The comment says `pluginRootOf` returns "the one `CLAUDE_PLUGIN_ROOT` that the stdio
entries of `pluginId` name". The code collects a root from every marked entry of the group. In
release 0.19.2, `legacyEntry` (`features/lib/mcp-configuration.ts:130-136`) puts `env` only on a
stdio entry (`typeof declared.command === "string"`). So a remote entry adds `undefined` to the
set. Two shapes that release wrote are refused, with the wrong message
`<plugin> names no one plugin root`:

- A plugin with one stdio server and one http/sse server gives `{root, undefined}`.
- A plugin with only remote servers gives `{undefined}`.

The writer step can produce both shapes: `legacy-move.feature:647` uses it for an http-only
plugin. So the two "as release 0.19.2 wrote" steps now disagree on what that release wrote. No
current scenario hits this, because all seven doc strings are stdio-only. But the next AMIG-04
scenario with a remote server fails in its `Given` for a reason that the step's own comment says
cannot happen.
**Fix:** Read the root only from stdio entries. When the group has no stdio entry, fail and say so
plainly:

```ts
// The one `CLAUDE_PLUGIN_ROOT` that the stdio entries of `pluginId` name. A
// remote entry carries no env in release 0.19.2, so it names no root.
function pluginRootOf(entries: Readonly<Record<string, unknown>>, pluginId: string): string {
  const roots = new Set(
    Object.values(entries)
      .filter((entry) => isPlainObject(entry) && typeof Reflect.get(entry, "command") === "string")
      .map((entry): unknown => {
        const env: unknown = Reflect.get(entry as object, "env");
        return isPlainObject(env) ? Reflect.get(env, "CLAUDE_PLUGIN_ROOT") : undefined;
      }),
  );
  const [root, ...others]: unknown[] = [...roots];
  assert.ok(
    typeof root === "string" && others.length === 0,
    `the stdio entries of ${pluginId} name no one plugin root (a remote-only plugin needs the writer step)`,
  );
  return root;
}
```

## Info

### IN-01: Three near-identical launch-environment steps (carried from iteration 1, IN-02, open by decision)

**File:** `features/step_definitions/mcp-implementation.steps.ts:67-80`
**Issue:** These three steps still repeat the same body: this step,
`mcp-server/configuration.steps.ts:247-262`, and `mcp-server/listing.steps.ts:125-141`. The
iteration-1 IN-03 fix made the copies differ. This step no longer registers a release for the
launch file. The two siblings still do: `this.onRelease(() => rm(file, { force: true }))` at
`configuration.steps.ts:257` and `listing.steps.ts:130`. The reason in the new comment, that
`Before()` empties the sandbox home, applies to all three just as much. So the suite now has two
conventions for the same file.
**Fix:** If IN-02 is reopened, a `startPiWithLaunchEnvironment(world, profile, variables)` helper
in `features/lib/pi-launch-environment.ts` settles both the duplication and the release rule. Until
then, drop the release in the two siblings too, or restore it here, so that all three match.

### IN-02: The module overview of `mcp-configuration.ts` no longer describes its functions

**File:** `features/lib/mcp-configuration.ts:9-12`
**Issue:** The overview says "Each function but the legacy writer writes one file it creates and
refuses to replace a file it did not create". The new export `legacyMcpServers` (`:150-174`) writes
no file. It reads the plugin's `.mcp.json` and returns entries. The first paragraph also does not
say that the module now builds the 0.19.2 entries for the doc-string step in
`legacy-move.steps.ts`.
**Fix:** Name the reader, for example: "`legacyMcpServers` builds, without writing, the entries
release 0.19.2 wrote for a plugin; each other function but the legacy writer writes one file it
creates ...".

### IN-03: The `<plugin>@<marketplace>` split is written twice in one module

**File:** `features/lib/mcp-configuration.ts:156-158` and `:198-200`
**Issue:** `legacyMcpServers` and `writeLegacyMcpConfig` each repeat the same
`lastIndexOf("@")` / `slice` lines. The writer now passes `pluginId` to `legacyMcpServers` and
parses it again only for `isMarkedFor`. If one copy changes, for example to refuse an id with no
`@`, the other copy keeps the old rule.
**Fix:** Add one private `splitPluginId(pluginId): { plugin; marketplace }` and call it from both
functions.

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

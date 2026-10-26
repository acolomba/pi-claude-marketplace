---
phase: 09-plugin-list
reviewed: 2026-10-23T09:11:16Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - test/orchestrators/plugin/list-flow.test.ts
  - features/plugin/list.feature
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
fixed_in: 09-REVIEW-FIX.md
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-23T09:11:16Z
**Depth:** deep
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Scope: `git diff fefcab93..HEAD -- extensions test features` (commits 2ac49f2c, 88006295,
29e51370). The review followed both fixes into their callers and helpers:
`list-orphan-fold.ts`, `scope-fanout.ts`, `marketplace/shared.ts::crossScopeFlag`, the LLM tool
(`edge/handlers/tools.ts`), and the browser loader (`edge/handlers/plugin/browse.ts`).

All 14 `features/plugin/list.feature` scenarios pass, and so do `npm run check:features` and all 99
cases in `test/orchestrators/plugin/list-flow.test.ts`. A scratch probe drove `listPlugins` and
`loadPluginListPayload` against hermetic state. It found three wrong outputs in the `--scope`
narrowing (fix 2), and they all come from one cause. `narrowToScope` runs after the orphan fold
has run, but the fold was built for the cross-scope view:

- the fold drops the folded plugin from the user block's candidate rows, and `--scope user` then
  drops the folded installed row too, so the plugin is gone from the output entirely;
- under `--scope project`, a folded block is kept only when it still has a project row. A
  `(failed)` header and a project clone with no installs both have none, so the block disappears
  and the command prints `(no marketplaces)`.

The not-added check (fix 1) is correct. But no test or scenario names a project-only marketplace
without `--scope`, so a check that looks only in the user scope would also pass. The browser loader
passes no scope, so this diff does not change it.

## Critical Issues

### CR-01: `--scope user` hides a plugin installed only in the project scope of a folded marketplace

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:694-697, 738-740`
**Issue:** For a user marketplace whose project record is a clone, `computeOrphanFold` always runs.
Its `foldedNames` go to the user block as `excludeFromAvailable`, so the user block drops the
plugin's `(available)` row. `narrowToScope` then drops the folded `[project]` installed row,
because its scope is the other scope. The plugin appears neither installed nor available in the
user view, but `install <plugin>@<mp> --scope user` is valid. Adding a filter also adds the row
back: under `--available`, the fold enumeration keeps no installed rows, so `foldedNames` is empty
and the plugin comes back. Probe (user `beta` installed, project `alpha` folded, `gamma` offered):

```
list --scope user              -> ● mp1 [user] / ● beta (installed) / ○ gamma (available)
list --scope user --available  -> ● mp1 [user] / ○ alpha (available) / ○ gamma (available)
```

A filter must narrow the output, never add to it. Under D-02, a candidate row stays with the block
of its marketplace's scope, so `alpha` is an `(available)` row of the user block. Two tests now pin
the wrong output: the unit case `test/orchestrators/plugin/list-flow.test.ts:2289` expects
`beta`+`gamma` only, and the scenario `features/plugin/list.feature:639-661` expects
`lima`+`mike` with a tally of 2 and leaves out `kilo`.
**Fix:** Do not fold when the user scope is the only scope asked. The user block then lists the
plugin as a candidate, and the own-scope arm of `narrowToScope` has no other-scope rows to drop:

```ts
const { folded, foldedNames } =
  opts.scope !== "user" && isOrphanMarketplaceClone(projectMp, mpRecord)
    ? // eslint-disable-next-line no-await-in-loop -- bounded by the user marketplaces, one orphan fold each
      await computeOrphanFold(opts, mpName, projectMp, projectMerged)
    : EMPTY_ORPHAN_FOLD;
```

Then update the unit case to expect `alpha (available)`, `beta (installed)`, `gamma (available)`.
Update the scenario to expect `kilo available`, `lima installed`, `mike available`, with
`tally success count | 3`.

### CR-02: `--scope project` hides a `(failed)` manifest that the project's installations depend on

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:582-594, 737-743`
**Issue:** When the user marketplace's manifest cannot be read, `buildMarketplaceMessage` returns
the bare `(failed)` header with `plugins: []`, as BOUND-01 / PL-6 require, and the folded project
rows are hidden. Under `--scope project` that block is not of the asked scope and has no rows of
it, so `narrowToScope` drops it. The project's installations and the read failure both disappear,
and the severity drops from error to info. Probe (shared manifest unreadable, project `alpha`
installed through the clone):

```
list                  -> [error] ... ⊘ mp1 [user] (failed)
list --scope project  -> [info]  (no marketplaces)
```

PRD PL-6 says hiding a read failure is "the failure mode BOUND-01 forbids". It also goes against
the fail-closed rule for corrupt data. The old block filter had the same gap, but the new function
is the one that claims to handle folded project installations, and it still drops them.
**Fix:** Record on `BuiltMarketplace` the scope whose clone the user block absorbed, and keep the
block for that scope even when no rows of it remain. This keeps the `failed` status and severity:

```ts
interface BuiltMarketplace {
  readonly mp: MarketplaceRows<PayloadListMsg>;
  readonly emitScope: Scope;
  /** The other scope whose clone record this block absorbed by the orphan fold. */
  readonly absorbs?: Scope;
}
// loop 2:
blocks.push(isOrphanMarketplaceClone(projectMp, mpRecord) ? { ...built, absorbs: "project" } : built);
// narrowToScope:
return emitScope === scope || absorbs === scope || plugins.length > 0 ? [{ ...mp, plugins }] : [];
```

Add a unit case: a broken shared manifest plus a project clone with an installed plugin, under
`scope: "project"`, expects the error-severity `⊘ mp1 [user] (failed)` notification.

### CR-03: `list <mp> --scope project` passes the not-added check, then prints `(no marketplaces)`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:668-670, 742, 811-823`
**Issue:** This comes from the same drop as CR-02, here on a manifest that loads. Take a project
record with the same `marketplaceRoot` as the user record but no project installation. That
happens when one dir-source marketplace is added to both scopes (`add.ts:1256-1263` records the
user's own directory as the root), or when the last project install of a cloned marketplace is
removed. The project block is skipped as an orphan clone. Under `--scope project`, the user block
has no project rows and is dropped. `marketplaceAdded` finds the project record, so D-01 lets the
command through, and the payload is empty. Probe: `list mp1 --scope project` returns
`[info] (no marketplaces)`. That is the empty-result symptom D-01 was meant to remove, and it
contradicts `marketplace list --scope project`, which lists `mp1`. The LLM tool has the same
problem: `marketplaceExists` returns true, and the tool then answers
`No marketplaces configured.` (`edge/handlers/tools.ts:483-511`).
**Fix:** The `absorbs` flag from CR-02 also fixes this. A header with no rows is the documented
grouping context (D-04). If the project's candidate rows should appear too, decide that with the
user, because D-02 does not cover a marketplace recorded in both scopes. Add a unit case: a
same-root marketplace in both scopes with no project installs, under
`scope: "project", marketplace: "mp1"`, expects the `● mp1 [user]` header.

### CR-04: A not-added check that looks only in the user scope passes every test and scenario

**File:** `features/plugin/list.feature:417-471`, `test/orchestrators/plugin/list-flow.test.ts:2406-2456`
**Issue:** No test runs `listPlugins` or `/claude:plugin list <mp>` without `--scope` for a
marketplace that only the project scope records. A plausible wrong `marketplaceAdded` passes
`scope: opts.scope ?? "user"` to `collectMarketplaceRecordsByScope`; the same defaulting shape
appears in this file at line 877. It would pass every case:

- "Naming a marketplace keeps only its plugins" names `extras`, which is in the user scope;
- the unknown-marketplace scenario and unit case get not-added either way;
- the cross-scope scenario and unit case pass `--scope`.

The same scenario also misses a dropped marketplace filter in the user-record loop (lines 686-689),
because its fixture has only one user marketplace. Under the cucumber skill, a scenario that a
plausible wrong implementation passes is a BLOCKER.
**Fix:** Make the positional scenario name the project-only marketplace:
`When the user runs "/claude:plugin list tools"`, and expect the seven `tools` rows (tally 7). That
one change catches both wrong implementations. Also add a unit case:
`listPlugins({ ..., marketplace: "official" })` with `official` seeded only in the project scope,
asserting the full rendered block.

## Warnings

### WR-01: D-07's "unknown marketplace with `--scope`" case has no scenario and no unit case

**File:** `features/plugin/list.feature:591-614`
**Issue:** D-07 asks for an unknown marketplace to fail as not added "with and without `--scope`".
Only the case without a scope and the cross-scope case are covered. A wrong implementation that
always sets `presentInOtherScope` when `--scope` is given passes both, and renders
`{marketplace not added to user scope}` for a marketplace that exists nowhere.
**Fix:** Add a scenario: `tools` in the project scope, `When the user runs "/claude:plugin list extras --scope user"`,
expecting `scope | user` and `reasons | marketplace not added`.

### WR-02: Under `scope: "project"`, the LLM tool lists project installations under a `(user)` heading

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:430-458` (behavior change from `list-flow.ts:733-744`)
**Issue:** D-01 says the tool keeps the payload builder unchanged, but `narrowToScope` sits inside
`loadPluginListPayload`, so the tool's output changed. Before, `scope: "project"` returned nothing
for a folded marketplace. Now it returns the user block, and the tool's text is
`Marketplace extras (user)` followed by `installed kilo`. `renderPluginRow` prints no row scope, so
an agent that asked for the project scope is told these are installations of a user marketplace,
with nothing saying they are project-scope. No tool test covers the folded case under a scope.
**Fix:** In `renderPluginPayload`, add the row's scope when it differs from the block's, using
`pluginScopeOrFallback(p, mp.scope)` (for example `installed kilo [project]`). Add a
`test/edge/handlers/tools.test.ts` case for `scope: "project"` over a folded installation.

### WR-03: The same 42-line fixture is copied into eight scenarios

**File:** `features/plugin/list.feature:8-49, 72-113, 131-172, 188-229, 245-286, 302-343, 360-401, 418-459, 474-515, 530-571`
**Issue:** Every filter, positional, and scope scenario repeats the same git repository, two
marketplaces, five installs and disables, the manifest rewrite, and the git-source offer, which
is about 400 lines of identical `Given` steps. A change to the fixture must be made in every copy,
and a reader has to diff the blocks to confirm they match. The phase avoided a `Background:`
because the four not-added and fold scenarios do not need the fixture, but the layout rules allow
a second feature in the same function directory.
**Fix:** Move the scenarios that use the shared fixture to `features/plugin/list-filters.feature`
(`Feature: Plugin list filters`), with the fixture as its `Background:`. Keep the not-added and fold
scenarios in `list.feature`.

### WR-04: The whole-table scenario title claims "every plugin status" but leaves one out

**File:** `features/plugin/list.feature:7`
**Issue:** `partially-upgradable` (PL-9 / FSTAT-04) is a list status, and the scenario has no row
with it. The title says more than the scenario proves.
**Fix:** Add a `partially-upgradable` row (a clean install whose cached newer candidate gains an
unsupported component), or retitle the scenario, for example "The list shows each installed and
candidate status with its scope".

### WR-05: Doc comments no longer match the code

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:145-149, 634-639, 800-807`
**Issue:** The `scope` option's doc says the builder "constrains which blocks are emitted at the
end", but narrowing now filters rows by each row's install scope and can keep an other-scope block.
The `listPlugins` doc says each orchestration arm makes "a single `notifyWithContext(...)` call",
but there is now a third arm that calls `notify()` with a `marketplace-not-added` message. The
style rules require comments to describe the code as it is.
**Fix:** Point the `scope` doc to `narrowToScope` ("keeps that scope's installations, judged per
row; see narrowToScope"), and add the PL-3 not-added arm to the `listPlugins` doc.

## Info

### IN-01: The not-added message is now built in three places

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:812-821`
**Issue:** The same `{ kind: "marketplace-not-added", name, ...(scope && { scope }), ...crossScopeFlag }`
literal appears in `marketplace/info.ts:135-149` (`buildNotAddedMessage`), in
`plugin/info.ts:3103-3112`, and here.
**Fix:** Move `buildNotAddedMessage(cwd, name, scope)` to `orchestrators/marketplace/shared.ts`,
next to `crossScopeFlag`, and call it from all three places.

### IN-02: `rowScope` / `otherScope` duplicate `pluginScopeOrFallback` and reuse a name with a different meaning

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:746-752`
**Issue:** `list-orphan-fold.ts:47` already has a private `rowScope` that falls back to the block's
scope. This one returns `undefined`, so the same name means different things in sibling modules.
`shared/notification-types.ts:735` exports `pluginScopeOrFallback`, which makes both branches of
`narrowToScope` the same predicate.
**Fix:** `const plugins = mp.plugins.filter((row) => pluginScopeOrFallback(row, emitScope) === scope);`
then delete `rowScope` and `otherScope`.

### IN-03: The user-facing docs do not describe the new list behavior

**File:** `docs/output-catalog.md:790-831`, `docs/prd/pi-claude-marketplace-prd.md:355`
**Issue:** The catalog's "marketplace not added" section names only `install` as a trigger, PL-3
does not say that an unknown marketplace now fails, and nothing documents the per-row `--scope`
rule from D-02. The CHANGELOG has no entry yet; AGENTS.md asks for one before the PR.
**Fix:** Add `list <marketplace>` to the not-added triggers, extend PL-3 with the failure, describe
the `--scope` rule in the plugin-list catalog intro, and add a CHANGELOG bullet before the PR.

---

_Reviewed: 2026-10-23T09:11:16Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

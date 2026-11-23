---
phase: 05-mcp-install-legacy-move-and-overrides
reviewed: 2026-11-22T13:00:00Z
depth: standard
iteration: 3
files_reviewed: 6
files_reviewed_list:
  - features/step_definitions/mcp-server/legacy-move.steps.ts
  - features/lib/mcp-configuration.ts
  - features/lib/installation-record.ts
  - features/mcp-server/legacy-move.feature
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/mcp-implementation.steps.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 5: Code Review Report (iteration 3)

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (info only)

## Summary

Scope: the iteration-2 fix commits `d4f87c6`, `2cb9e3d`, and `c74269f`, read against the
iteration-2 findings and against every caller of the changed functions in `features/`. I did not
re-run cucumber or `npm run check`, because `npm run check` is running on this tree. ESLint and
Prettier pass on the three changed `.ts` files. The working tree is clean at `80cced2`.

Status of the iteration-2 findings:

| ID | Status | Evidence |
| --- | --- | --- |
| WR-01 | Fixed | `pluginRootOf` (`legacy-move.steps.ts:64-82`) now reads `CLAUDE_PLUGIN_ROOT` only from entries whose `command` is a string. That is the same stdio test `legacyEntry` uses to decide whether to inject env (`mcp-configuration.ts:134`), so the two sides cannot disagree on which entries carry a root. The AMIG-04 scenario at `legacy-move.feature:686` now publishes `srv` (stdio) and `web` (http). Its doc string holds both entries in the release shape: `web` has no `env` and keeps the declared key order `type`, `url`, then the marker, which is what `legacyMcpServers` builds for a non-stdio entry. Under the old step, the set was `{root, undefined}`, so the `Given` failed with `demo@fixtures names no one plugin root`. That matches the red proof in REVIEW-FIX. The `unowned` rows now list `["srv","web"]`. So the product must also report a remote entry as unowned, and an implementation that skipped non-stdio entries would fail the table. |
| IN-02 | Fixed | The overview (`mcp-configuration.ts:9-15`) names `legacyMcpServers` as a builder that writes nothing. The write rule now covers "each other function but the legacy writer". I checked that rule against each writer: `declarePublishedMcpServer`, `writeCommentedMcpConfig` (`wx`), and `allowProjectServersForUser` (`wx`). It holds. |
| IN-03 | Fixed | `splitPluginId` is exported from `installation-record.ts:52-59` with a doc comment. `legacyMcpServers` (`:159`) and `writeLegacyMcpConfig` (`:199`) call it. No `lastIndexOf("@")` copy remains in `mcp-configuration.ts`. |
| IN-01 | Open by decision | Carried below as IN-01. |

Regression check on `splitPluginId`, which now throws for every caller of
`legacyMcpServers` and `writeLegacyMcpConfig`:

- `writeLegacyMcpConfig` has one caller: the writer step at `mcp-configuration.steps.ts:115-134`.
  Its 20 uses pass valid ids: `demo@fixtures` or `ghp@gits` in `legacy-move.feature`, `demo@fixtures`
  in `verdict-list.feature:316` and `:345`, and `demo@fixtures` in `plugin/subagent-child.feature:77`.
  The writer called `readPluginRecord` before this change too, and `locateRecord`
  (`installation-record.ts:85`) already split the id with the same throwing helper. So an invalid id
  failed before as well. Only the order changed: the throw now comes before the `state.json` read,
  with the same message. That changes no behavior.
- `legacyMcpServers` has two callers: the writer, which reaches it only after the record read, and
  the doc-string step (`legacy-move.steps.ts:134`). The step builds the id from the marker as
  `${String(marker.plugin)}@${String(marker.marketplace)}` (`:52`). A marker with an empty name
  now throws `@fixtures is not a <plugin>@<marketplace> id` in the `Given`. Before, it failed later
  in the `deepStrictEqual`. Either way the precondition fails, and the new message is the clearer
  one. A missing name gives `undefined@...`, which still splits and still fails the comparison, as
  before. Every doc string in `legacy-move.feature` (`:312`, `:395`, `:478`, `:559`, `:696`,
  `:741`, `:780`) has a `demo`/`fixtures` marker.
- Nothing under `test/` or `scripts/` imports `features/lib/installation-record.ts` or
  `features/lib/mcp-configuration.ts`. The other importers of `installation-record.ts`
  (`implementation-switch.steps.ts`, `mcp-implementation.steps.ts`, `plugin/installation.steps.ts`,
  `mcp-builtin-earlier-record.ts`, `mcp-server-files.ts`) do not call `splitPluginId`. The new
  export adds a public name and changes no caller.

The fixes introduce no regression. One new item remains: the error hint that the WR-01 fix added
(from the iteration-2 suggested fix) points the author at a step that cannot serve any use of the
doc-string step. It does not let a wrong product implementation pass.

## Info

### IN-01: Three near-identical launch-environment steps (carried from iteration 1, IN-02, open by decision)

**File:** `features/step_definitions/mcp-implementation.steps.ts:67-80`
**Issue:** Three steps still repeat one body: this step,
`mcp-server/configuration.steps.ts:247-262`, and `mcp-server/listing.steps.ts:125-141`. They also
follow two release rules for the same launch file. This step registers no release. The two
siblings still do, with `this.onRelease(() => rm(file, { force: true }))` at
`configuration.steps.ts:257` and `listing.steps.ts:130`.
**Fix:** If this is reopened, add a `startPiWithLaunchEnvironment(world, profile, variables)`
helper in `features/lib/pi-launch-environment.ts` and drop the per-step release. Until then, make
the three steps match on the release.

### IN-02: The "remote-only plugin needs the writer step" hint names a step that cannot stand in

**File:** `features/step_definitions/mcp-server/legacy-move.steps.ts:62-63` and `:79`
**Issue:** The comment says "a plugin with only remote entries takes the writer step instead", and
the assertion message says the same. The writer step
(`mcp-configuration.steps.ts:115-134`, through `writeLegacyMcpConfig`) reads the plugin's
installation record and throws `the record of <id> names no plugin root` when the plugin is not
installed. Every scenario that uses the doc-string step writes `mcp.json` for a plugin that the
scope does not record yet: before an install (`:312`, `:395`, `:478`, `:559`, `:780`), or as an
unowned entry (`:696`, `:741`). So for a remote-only plugin in any of those setups, neither step
can write the 0.19.2 file, and the hint sends the author to a step that fails in its own way. No
current scenario hits this. The iteration-2 suggested fix carried the same wording, so this review
introduced the hint.
**Fix:** State the limit plainly. For example, change the message to `the stdio entries of
${pluginId} name no one plugin root; no step writes a 0.19.2 mcp.json for a plugin with only remote
servers that the scope does not record`, and change the comment to match. Or, if such a scenario
is planned, let the step fall back to the published plugin's directory
(`path.join(this.requirePublished(marketplace).root, "plugins", plugin)`) when the group has no
stdio entry. `legacyMcpServers` uses the root only to read `.mcp.json` and to inject env, and a
remote entry gets no env.

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 06-hook-inputs-and-events
plan: "12"
subsystem: hooks
status: complete
tags: [hooks, UserPromptExpansion, skill-aliases, typed-line, cucumber]
requires: ["06-08", "06-10"]
provides:
  - "orchestrators/typed-expansion.ts: createTypedExpansionResolver"
  - "orchestrators/skill-alias-state.ts: PluginNames, loadPluginNames, PluginNamesCache, createPluginNamesCache"
  - "features/hook/prompt-expansion.feature (7 scenarios, 10 with Outline rows)"
affects:
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
tech-stack:
  added: []
  patterns: ["one shared session cache of the plugin name table, injected into the alias handler and the resolver"]
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts
    - test/orchestrators/typed-expansion.test.ts
    - features/hook/prompt-expansion.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
    - test/orchestrators/skill-alias-state.test.ts
    - extensions/pi-claude-marketplace/edge/skill-aliases.ts
    - test/edge/skill-aliases.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - extensions/pi-claude-marketplace/index.ts
    - features/step_definitions/hook/prompt-commands.steps.ts
decisions:
  - "createPluginNamesCache takes its loader as a required parameter (production passes loadPluginNames), so loadPluginNames has a production importer and fallow dead-code stays green"
  - "A bridged skill is told from the user's own through the name table (skills entry or alias target); a /skill:<name> whose staged file gives no name is reported as the user's own"
  - "When the name table load rejects, a listed template or skill resolves with Pi's name and no command_source; an alias resolves to nothing (T-06-28)"
metrics:
  duration: "~75 min"
  completed: 2026-11-15
actuals:
  tokens: 16000
  tasks: 3
  commits: 3
plan_head_before: 7d119d7b072755329af4ff064430c3a1f102734f
plan_head_after: 0f4d9835
---

# Phase 6 Plan 12: Typed-line resolver and UserPromptExpansion scenarios Summary

A typed plugin command, `/skill:<name>`, skill alias, or the user's own template now runs the routed `UserPromptExpansion` hooks with Claude Code's `expansion_type`, `command_name`, `command_args`, `command_source`, and `prompt`, through a resolver that reads one shared plugin name cache with the alias handler.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 06-12-01 | 0a813ac0 | refactor(hooks): share one plugin name cache for typed lines |
| 06-12-02 | ab540629 | feat(hooks): run UserPromptExpansion hooks for typed commands |
| 06-12-03 | 0f4d9835 | test(hooks): prove expansion hook order, stop, context, and source |

`actuals.commits` measured: `git rev-list --count 7d119d7b..HEAD` = 3. `actuals.tokens` is chars/4 over the plan diff (`git diff 7d119d7b HEAD | wc -c` = 63,942).

## Exported names as built

`extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts`:

```typescript
export interface PluginNames {
  readonly aliases: ReadonlyMap<string, PluginAliasTarget>;
  readonly skills: ReadonlyMap<string, string>; // generated name -> Claude-form name
  readonly commands: ReadonlySet<string>; // Pi names of loaded bridged commands
}
export async function loadPluginNames(pi: ExtensionAPI, cwd: string, projectTrusted: boolean, dependencies?: Partial<SkillAliasDependencies>): Promise<PluginNames>;
export interface PluginNamesCache { readonly get: (cwd: string, projectTrusted: boolean) => Promise<PluginNames>; readonly clear: () => void }
export function createPluginNamesCache(pi: ExtensionAPI, load: (pi: ExtensionAPI, cwd: string, projectTrusted: boolean) => Promise<PluginNames>): PluginNamesCache;
```

`loadPluginAliases` is gone; `loadPluginNames` takes its place.

`extensions/pi-claude-marketplace/edge/skill-aliases.ts`: `registerSkillAliases(pi, names: PluginNamesCache = createPluginNamesCache(pi, loadPluginNames), invokeSkill?, createInvocationId?)`.

`extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts`: `createTypedExpansionResolver(pi: ExtensionAPI, names: PluginNamesCache): TypedExpansionResolver`.

`extensions/pi-claude-marketplace/bridges/hooks/index.ts`: `export type { HooksRouting, TypedExpansion, TypedExpansionResolver } from "./event-router.ts";`.

`extensions/pi-claude-marketplace/index.ts`: `const pluginNames = createPluginNamesCache(pi, loadPluginNames);` before `registerHooksBridge(pi, { cwd: homedir(), resolveTypedExpansion: createTypedExpansionResolver(pi, pluginNames) })`, and `registerSkillAliases(pi, pluginNames)`. The two comments now say "14 pi.on call sites". `test/index.test.ts` needed no change (48/48, direct coverage of index.ts at 100%).

## Test case counts (task 06-12-01)

| Owner test | Before (HEAD 7d119d7b) | After |
| --- | --- | --- |
| test/orchestrators/skill-alias-state.test.ts | 24 cases (19 declarations) | 29 cases (5 new: skills names, own name kept, commands, cache keying and clear, rejected load) |
| test/edge/skill-aliases.test.ts | 26 cases | 26 cases (every loader stub wrapped by the local `aliasCache` helper) |

The orchestrator test reads `aliases` of each result through one local helper, `loadPluginAliases`, so every existing case is textually unchanged. New paired test `test/orchestrators/typed-expansion.test.ts`: 21 cases.

## Verification evidence

- Task 1: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/skill-alias-state.test.ts test/edge/skill-aliases.test.ts test/index.test.ts`: 103 pass, 0 fail. `npm run test:coverage:direct -- …skill-alias-state.ts …edge/skill-aliases.ts`: exit 0. Adapter `features/skill/aliases.feature features/skill/project-trust.feature features/slash-command/aliases.feature`: 23 scenarios, 314 steps passed. `git diff --quiet HEAD -- features`: exit 0. eslint, `tsc --noEmit`, `fallow dead-code`, `fallow health`, `fallow dupes`: exit 0.
- Task 2: the six owner tests of the verify list: 388 pass, 0 fail. `npm run test:coverage:direct -- …typed-expansion.ts …index.ts …bridges/hooks/index.ts`: exit 0. Adapter `prompt-expansion prompt-commands skill/aliases slash-command/aliases slash-command/invocation`: 47 scenarios, 647 steps passed. `npm run check:features`: exit 0. `npm run fallow`: exit 0.
- Task 3: `git diff --quiet HEAD -- extensions test` after both red changes were undone: exit 0. Adapter `prompt-expansion prompt-commands additional-context messages`: 37 scenarios, 542 steps passed. `npm run check:features`: exit 0.
- Wider runs (executor rules): `test/architecture/**`: 856 pass. `test/integration/hooks-*.test.ts`: 16 pass. `features/hook features/skill features/slash-command` on the final tree (0f4d9835): adapter profile exit 0, 463 scenarios and 6158 steps passed; builtin profile exit 0, 15 scenarios and 237 steps passed (the builtin profile selects its tagged subset; the new scenarios are untagged, D-BG-208).

## Self-Check: PASSED

Created files and the three commits are present in HEAD; no commit deletes a file.

## Red and green runs

Task 06-12-02 (two scenarios, five rows), red on the working tree with the `resolveTypedExpansion` member of the factory's options commented out (equivalent to the tree before the resolver): exit 1, `5 scenarios (5 failed)`, `84 steps (72 passed, 7 skipped, 5 failed)`. The block scenario failed with `the model was called past the end of its script` (the blocked line reached the model in call 2), each Outline row with a runs table that held no `UserPromptExpansion` run. Green after the wiring: `5 scenarios (5 passed)`, `84 steps (84 passed)`.

Task 06-12-03, each red change made in the working tree only and undone by hand:

| Scenario | Working-tree change | Red result |
| --- | --- | --- |
| 1. A typed plugin command runs the prompt hook before the expansion hook | `resolveTypedExpansion` member commented out in `index.ts` | failed: no expansion run recorded |
| 2. A prompt hook that blocks a typed plugin command runs no expansion hook | the `UserPromptExpansion` `input` registration moved before the `UserPromptSubmit` one in `event-router.ts` | failed: the runs table held an extra `UserPromptExpansion` row (`15 steps (12 passed, 2 skipped, 1 failed)`) |
| 3. An expansion hook that stops the command shows its stop reason | resolver removed, as for 1 | failed |
| 4. An expansion hook's context reaches the model after the expanded command | resolver removed, as for 1 | failed |
| 5. An expansion hook with no matcher sees the user's own template | resolver removed, as for 1 | failed |

The resolver-removed run of the whole feature: exit 1, `10 scenarios (1 passed, 9 failed)`: every scenario failed except scenario 2, which holds a negative statement and was seen red through the reorder above. Green: `10 scenarios (10 passed)`, `159 steps (159 passed)`.

No step definition was added. The file overview of `features/step_definitions/hook/prompt-commands.steps.ts` now names UserPromptExpansion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `createPluginNamesCache`'s loader is a required parameter, not defaulted**
- **Found during:** Task 06-12-01
- **Issue:** With `load` defaulted to `loadPluginNames` inside its own module, `fallow dead-code` reported `loadPluginNames` as an unused export and `SkillAliasState` and `SkillAliasDependencies` as unused types (exit 1).
- **Fix:** `load` is required; the edge default and the factory pass `loadPluginNames`. The plan's grep criteria still hold (`createPluginNamesCache` appears twice in each of edge/skill-aliases.ts and index.ts).
- **Commit:** 0a813ac0

**2. [Rule 1 - Bug] The command body of the Outline brackets `$ARGUMENTS`**
- **Found during:** Task 06-12-02
- **Issue:** With `Command body: $ARGUMENTS`, the no-argument row expands to `Command body: ` with a trailing space, which a Gherkin cell cannot state (cells are trimmed).
- **Fix:** The feature's command file reads `Command body: [$ARGUMENTS]`, so the rows state `Command body: [first second]` and `Command body: []`.
- **Commit:** ab540629

**3. Scenario 2 of task 06-12-03 states the columns of a UserPromptSubmit run only.** The runs table compares the columns that the recorded runs have, so a table with the four expansion columns fails when no expansion run exists. The scenario's single row is the `UserPromptSubmit` run.

**4. Table realignment.** Task 3's commit realigns one table of task 2's block scenario (the `text` column of `Other body: one` was one space short); no cell changed.

## Flagged assumptions (from the plan, unchanged)

- A bridged command's Claude-form name is its Pi name (differs for a file name starting `<plugin>-`, PG-CMD-09, and on Windows). Pending maintainer review.
- A command typed by an alias sends the command's own Pi name as `command_name`.
- `prompt` is rebuilt from the Claude-form name (plan 06-08): `/skill:demo-status a` gives `/demo:status a`.
- `command_args` is trimmed.
- `command_source` of an item of no plugin: `userSettings` for Pi's user scope, `projectSettings` for its project scope, none for a temporary one (A4, low confidence). Pending maintainer review.
- A bridged skill whose staged file gives no name sends its generated name; through `/skill:<name>` it is reported as the user's own (no `skills` entry), through an alias with `plugin`.
- A name table that cannot be loaded: Pi's list alone answers (planner's choice, pending maintainer review).
- No scenario for input of the source `extension` (the 06-10 owner case covers it).
- A built-in Pi command and an extension command run no expansion hook.
- Guard scenario 2 of task 06-12-03 was seen red only through the registration-order change shown above.
- The cucumber skill's file list: no rule of `.agents/skills/cucumber` was edited.
- Platform: Linux only.

## Records for the orchestrator

This plan edits no parent-owned file. Lines for the maintainer to apply:

- PROJECT.md Key Decisions: D-PG6-19 with the values of `command_source` (`plugin` for a bridged item, `userSettings` for Pi's user scope, `projectSettings` for its project scope, absent for a temporary item) and the name rules above, pending maintainer review.
- `.planning/codebase/ARCHITECTURE.md` and `STRUCTURE.md`: the new module `orchestrators/typed-expansion.ts` (`createTypedExpansionResolver`, the resolver of a typed line to the template or skill it expands, D-PG6-18); the plugin name table (`PluginNames`, `loadPluginNames`) and its one cache (`createPluginNamesCache`) in `orchestrators/skill-alias-state.ts`; the factory passes one cache to the hooks bridge's resolver and to the alias handler. The hooks bridge has 14 `pi.on` call sites.
- `.planning/codebase/TESTING.md`: the new feature `features/hook/prompt-expansion.feature`.
- BACKLOG.md: "[parity-gaps] A bridged command's `command_name` is its Pi name, which differs from Claude Code's name for a command file named `<plugin>-…` (PG-CMD-09) and on Windows, where Pi joins with `.`." and "[parity-gaps] When the plugin name table cannot be loaded, a typed line is not refused; the expansion resolver answers from Pi's command list alone, so a hook that names a skill by its Claude-form name does not run."

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

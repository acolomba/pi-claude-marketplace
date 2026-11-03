---
phase: 01-harness-and-version-raise
plan: 04
subsystem: testing
tags: [cucumber, pi-rpc, registry-probe, slash-command, profile-pi]

requires:
  - phase: 01-harness-and-version-raise
    provides: "The profile Pi, the scripted model, the companion resolver, and the skill seed (plan 01-03)"
provides:
  - "The registry probe: a Pi extension under features/lib/pi-registry-probe/ that every profile Pi loads, and a validated reader of its report (HAR-01, HAR-04, D-CF1-17)"
  - "The listing When and a Then that compares the whole set of slash commands built from prompt templates"
  - "The slash-command seed: features/slash-command/listing.feature, features/lib/slash-command-files.ts, features/step_definitions/slash-command/listing.steps.ts (HAR-07, D-CF1-08)"
  - "PROFILE_PI_START_TIMEOUT_MS on the two steps that start a profile Pi"
affects: [01-05, 01-06, 01-07, 01-08, 01-09, slash-commands, mcp-servers, agents, workflows]

actuals:
  tokens: 3027     # chars/4 over the added diff lines (12,109 chars)
  tasks: 2
  commits: 2       # MEASURED: git rev-list --count c5a8396..HEAD
plan_head_before: c5a8396c78f5d9c5f11097f31b1b5c02da0f63ef
plan_head_after: 213ecb29401dd076b57fb3a567337e9d11322e7e

tech-stack:
  added: []
  patterns:
    - "Registry probe: run `/<REGISTRY_PROBE_COMMAND>` in a profile Pi, then readRegistrySnapshot(exchange.entries); no step text names the probe command"
    - "A step that starts a profile Pi carries { timeout: PROFILE_PI_START_TIMEOUT_MS }"

key-files:
  created:
    - features/lib/pi-registry-probe/extension.ts
    - features/lib/pi-registry-probe/snapshot.ts
    - features/lib/slash-command-files.ts
    - features/step_definitions/slash-command/listing.steps.ts
    - features/slash-command/listing.feature
  modified:
    - features/support/world.ts
    - features/step_definitions/session.steps.ts
    - features/step_definitions/model.steps.ts
    - features/step_definitions/companion.steps.ts

key-decisions:
  - "The probe loads right after the scripted model and before the companions, in every profile Pi"
  - "Probe records carry the sourceInfo path beside name and source (tools: name, source, path; commands: name, description or null, source, path), so a later phase can tell which package a tool or command came from"
  - "The listing Then reads only commands whose source is `prompt`, renders them as `/<name>` like the skills Then, and renders a missing description as an empty cell"
  - "Profile Pi start steps get a 90-second timeout of their own; the run-wide 30-second default stays"

patterns-established:
  - "The world keeps the last probe report in `registrySnapshot`; a Then fails when no step listed the slash commands"

requirements-completed: [HAR-01, HAR-04, HAR-07]

coverage:
  - id: D1
    description: "Every profile Pi loads the registry probe beside the real extension and the scripted model (HAR-01)"
    requirement: HAR-01
    verification:
      - kind: e2e
        ref: "features/slash-command/listing.feature#A new session offers a bridged command as a prompt command with its description"
        status: pass
      - kind: e2e
        ref: "features/skill/invocation.feature (both scenarios, probe loaded)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The probe reports all tools, active tools, and commands; the reader requires one report and validates all three fields; with the three companions loaded it reports subagent, mcp, workflow, and workflow_control beside Pi's built-ins (HAR-04)"
    requirement: HAR-04
    verification:
      - kind: manual_procedural
        ref: "one-off scenario with the three companions, not committed; report pasted in this SUMMARY"
        status: pass
    human_judgment: false
  - id: D3
    description: "The slash-command seed lists the bridged command /demo:greet with its description, compared whole (HAR-07, T-01-30)"
    requirement: HAR-07
    verification:
      - kind: e2e
        ref: "features/slash-command/listing.feature"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: manual_procedural
        ref: "red proof: an extra expected row fails the Then (temporary edit, reverted)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole cucumber suite passes twice in random order with the probe in every profile Pi"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber twice (1161/1161, seeds 799721 and 379584)"
        status: pass
    human_judgment: false

duration: 35 min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 04: Registry Probe and Slash-Command Seed Summary

**Every profile Pi now loads a registry probe that reports Pi's tools, active tools, and slash commands as one validated custom entry, and the slash-command seed lists a bridged plugin command (`/demo:greet`) through it, compared whole.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-11-01T04:37:09Z
- **Completed:** 2026-11-01T05:12:19Z
- **Tasks:** 2 (Task 2 changed no code; one fix commit)
- **Files modified:** 9

## Accomplishments

- `features/lib/pi-registry-probe/extension.ts`: the probe command appends one `pi-registry-probe` entry with `getAllTools()`, `getActiveTools()`, and `getCommands()` projected to JSON records in Pi's order. It filters nothing.
- `features/lib/pi-registry-probe/snapshot.ts`: the command name, the entry type, the extension path, the `RegistrySnapshot` type, and `readRegistrySnapshot(entries)`. The reader requires exactly one report and validates all three fields with `additionalProperties: false`. A missing field fails, so an empty list is always an empty array.
- `world.usePiWithProfile` loads the probe right after the scripted model. The world keeps `registrySnapshot`.
- The listing `When` runs the probe command. It asserts the `handled` disposition, no extension error, and no dialog, then keeps the validated report.
- The slash-command seed: a fixture writer for `commands/<name>.md`, a `Given` that asserts the file it wrote, and one scenario.

## Task Commits

1. **Task 1: Load the registry probe in every profile Pi and list a bridged command through it**: `2f2ab0d` (test)
2. **Task 2: Prove the probe's tool report and keep the whole suite green**: no code change (the reader already covers every field shape the check showed). The suite fix is `213ecb2` (fix, deviation 1).

## Step texts added

| Keyword | Text | Module |
| --- | --- | --- |
| Given | `the published plugin {string} of the marketplace {string} has the slash command {string} described as {string} with this body:` (doc string) | `features/step_definitions/slash-command/listing.steps.ts` |
| When | `the user lists the slash commands pi offers` | `features/step_definitions/session.steps.ts` |
| Then | `pi offers these slash commands from prompt templates:` (columns `command`, `description`; every command whose source is `prompt`, as `/<name>`, in Pi's order; run tokens projected; an empty description cell is a command with no description) | `features/step_definitions/session.steps.ts` |

## Library and world exports

- `features/lib/pi-registry-probe/snapshot.ts`: `REGISTRY_PROBE_COMMAND`, `REGISTRY_PROBE_ENTRY`, `REGISTRY_PROBE_EXTENSION`, `RegistrySnapshot` (`allTools: {name, source, path}[]`, `activeTools: string[]`, `commands: {name, description: string | null, source, path}[]`), `readRegistrySnapshot(entries)`.
- `features/lib/slash-command-files.ts`: `PluginSlashCommand`, `slashCommandFileText`, `publishSlashCommand`.
- `features/support/world.ts`: `registrySnapshot` (field), `PROFILE_PI_START_TIMEOUT_MS` (exported constant).

## Evidence

### Probe tool report with the three companions loaded (Task 2)

A temporary scenario (`pi runs with the scripted model and these companions:` with all three, a new session, the listing `When`, and a temporary step that dumped the snapshot) ran once and was removed. It was not committed. Paths below are shortened: `<wt>` is the worktree and `<peers>` is `<wt>/node_modules/.cache/optional-peers/node_modules`.

`allTools` (name, source, path):

```text
read                               builtin  builtin:read
bash                               builtin  builtin:bash
powershell                         builtin  builtin:powershell
edit                               builtin  builtin:edit
write                              builtin  builtin:write
grep                               builtin  builtin:grep
find                               builtin  builtin:find
ls                                 builtin  builtin:ls
pi_claude_marketplace_list         cli      <wt>/extensions/pi-claude-marketplace/index.ts
pi_claude_marketplace_plugin_list  cli      <wt>/extensions/pi-claude-marketplace/index.ts
subagent                           cli      <peers>/pi-subagents/bundle/index.js
contact_supervisor                 cli      <peers>/pi-subagents/bundle/index.js
bg_wait                            cli      <peers>/pi-subagents/bundle/index.js
subagents_enable                   cli      <peers>/pi-subagents/bundle/index.js
subagent_supervisor                cli      <peers>/pi-subagents/bundle/index.js
mcp                                cli      <peers>/pi-mcp-adapter/index.ts
workflow                           cli      <peers>/@quintinshaw/pi-dynamic-workflows/extensions/workflow.ts
workflow_control                   cli      <peers>/@quintinshaw/pi-dynamic-workflows/extensions/workflow.ts
codemode                           builtin  builtin:codemode
tool_search                        builtin  builtin:tool-search
```

`activeTools`:

```json
["read","bash","edit","write","pi_claude_marketplace_list","pi_claude_marketplace_plugin_list","subagent","contact_supervisor","bg_wait","mcp","subagent_supervisor","workflow","workflow_control"]
```

`commands` held 38 entries, all `extension`: `claude:plugin`, the probe's own command, 19 from pi-subagents, `mcp-adapter`, `mcp`, `mcp-auth`, and 13 from pi-dynamic-workflows (`workflows` and others, plus `llama`). The session had no plugin installed, so no `prompt` or `skill` command. Every description was a string, so the `null` arm of `description` was not exercised.

### Red proof (Task 1; temporary edit, reverted)

An extra expected row `| /demo:extra | Extra. |` in the seed's `Then` failed with a whole-table diff (`- [ '/demo:extra', 'Extra.' ]`). After the revert, the feature file matched the committed text.

### Suite runs

- Task 1: `npx cucumber-js features/slash-command features/skill` 3/3. `npm run check:features`: pass. `npx fallow dead-code --fail-on-issues`: pass. `tsc --noEmit` and ESLint on the changed files: pass.
- Task 2, first two runs (before the fix): 1160/1161 (seed 301236) and 1158/1161 (seed unknown). Every failure was a profile-start `Given` timing out at 30 s. Load average was 31 on 4 CPUs.
- After the fix: `npm run test:cucumber` twice, 1161/1161 each (seeds 799721 and 379584).
- The commit hook's `npm run check:commit` passed on both commits.

## Files Created/Modified

- `features/lib/pi-registry-probe/extension.ts`: the probe Pi extension (fallow marker on the default export).
- `features/lib/pi-registry-probe/snapshot.ts`: the probe's names, path, type, and validated reader.
- `features/lib/slash-command-files.ts`: the command file writer for published plugins.
- `features/support/world.ts`: the probe in every profile, `registrySnapshot`, `PROFILE_PI_START_TIMEOUT_MS`.
- `features/step_definitions/session.steps.ts`: the listing `When` and the prompt-command `Then`.
- `features/step_definitions/slash-command/listing.steps.ts`: the slash-command `Given`.
- `features/slash-command/listing.feature`: the seed, one scenario.
- `features/step_definitions/model.steps.ts`, `features/step_definitions/companion.steps.ts`: the profile-start timeout (deviation 1).

## Decisions Made

- Step texts: the `When` reads "the user lists the slash commands pi offers", which names what the user sees, not the probe. The `Then` names the kind ("slash commands") and the source ("from prompt templates"). It sits beside `the session offers these skills:` with no ambiguity.
- The `Then` compares only `source === "prompt"` commands, because extension commands (the companions, `claude:plugin`, the probe) depend on the profile and are not this kind's behavior. The comparison of that subset is whole.
- Probe records add `path` (Pi's `sourceInfo.path`) beyond the plan's "name and source". `pi-registry-probe/` is frozen after Phase 1, and phases 3 and 6 need to tell which package a tool or command came from. The 01-03 companion check already does this through `get_commands`.
- `description` is `string | null` in the record, because `SlashCommandInfo.description` is optional. A JSON `undefined` would drop the key and fail validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Profile Pi starts timed out under parallel load**

- **Found during:** Task 2 (the two full runs)
- **Issue:** Each cucumber worker has its own run root, so its jiti cache is cold for its first profile Pi. Almost every profile scenario is the first in its worker. Plan 01-03 measured a cold start at 13-20 s on an idle machine. With the parallel agents of this wave on a 4-CPU box (load average 20-31), a profile `Given` took 27.1-27.7 s with no companion and over 30 s with three, so it hit the 30-second default step timeout. The probe adds one small TypeScript file. typebox, which it imports, is already compiled for the scripted model.
- **Fix:** `PROFILE_PI_START_TIMEOUT_MS = 90_000` is exported from `world.ts`, beside the run-wide default, with the reason. The two profile-start steps use it. The run-wide 30 s default is unchanged.
- **Files modified:** `features/support/world.ts`, `features/step_definitions/model.steps.ts`, `features/step_definitions/companion.steps.ts`. The last two are outside this plan's `files_modified`. No other wave-3 plan edits them.
- **Verification:** two full runs, 1161/1161 each.
- **Committed in:** `213ecb2`

---

**Total deviations:** 1 auto-fixed (blocking).
**Impact on plan:** It keeps the suite reliable on a loaded runner. No scope creep.

## Issues Encountered

- The worktree guard refused compound shell commands that named git or ran computed programs. They ran as separate plain calls.
- Task 2 committed no code, because the reader already validates every field the report holds. The plan lists `snapshot.ts` only for an optional tightening.

## Known Stubs

None.

## Dubious Choices

1. **Profile-start timeout of 90 s (deviation 1).** The fix touches two frozen shared step modules outside `files_modified`. The other way was to raise the run-wide default, which would let every hung step take longer to fail. A shared cross-worker jiti cache would make starts warm, but concurrent writers could produce a partly written cache file. I did not confirm by a base-tree run that the failures happen without the probe. The timings point to load and cold caches, and the probe adds little compile work.
2. **`path` added to probe records** beyond the plan's "name and source" (see Decisions).
3. **Prompt-only filter in the `Then`.** It states the whole `prompt` subset, not the whole command list. Extension commands vary with the companions, so a whole-list `Then` would tie the seed to companion versions.
4. **Empty cell for a missing description.** Pi gives prompt templates a description, so the case has not occurred. An empty cell cannot tell a missing description from an empty one.
5. **The `null` description arm and an empty `activeTools` were not exercised live.** The schema covers them by design.
6. **The `When` reaches the probe through a `prompt` request.** This adds the probe's command to every profile Pi's command list. A later scenario that compares all extension commands must expect `pi-registry-probe`.
7. **Feature description wording.** It says a registry probe stands in for the user's view of the command list. That names a test mechanism in prose (not in a step), as the skill seed names its scripted model.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phases 3 and 6 can read Pi's commands and tools through the listing `When` and `world.registrySnapshot`. A new `Then` over tools or extension commands belongs to its kind's step module and reads the same field.
- Plan 01-09 should add `PROFILE_PI_START_TIMEOUT_MS` and the probe step texts to `.agents/skills/cucumber/rules/world-and-stand-ins.md`.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: all five created files.
- FOUND on HEAD: `2f2ab0d`, `213ecb2` (`git rev-list --count c5a8396..HEAD` = 2).
- Acceptance criteria re-run: the three seed files exist; `grep -c 'pi-registry-probe' features/support/world.ts` = 2; `features/skill` passes with the probe; both full runs passed after the fix.

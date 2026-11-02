---
phase: 04-agents
plan: 01
subsystem: agents-bridge
tags: [agents, pi-subagents, cucumber, discovery, naming]
status: complete

requires:
  - phase: 01-harness
    provides: profile Pi, scripted model, call log, published-marketplace writers, frozen model and command steps
provides:
  - "features/agent/listing.feature: AGT-01 listing scenarios (a)-(j)"
  - "Shared agent steps in features/step_definitions/agent/listing.steps.ts for plans 04-02..04-05"
  - "Table-driven agent writer (AgentFileRow, readAgentFileRows, agentRowText, publishAgentFiles)"
  - "Claude Code's description fallback (D-CF4-03)"
  - "Recursive agents discovery with namespaced names (D-CF4-01)"
  - "advertise: true on every bridged agent (D-CF4-14)"
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

actuals:
  tokens: 26000
  tasks: 4
  commits: 5
plan_head_before: faa94a2067d4a841175b9990451fdda5cbd53552
plan_head_after: 65f4558f210787b5af772dce787cc56968fe62c4

tech-stack:
  added: []
  patterns:
    - "Async-generator walk (agentFilesIn / agentFilesAt) with yield* recursion, unlike the commands walk"
    - "Settings Givens merge one nested key into {agent dir}/settings.json and restore the old bytes on release"

key-files:
  created:
    - features/agent/listing.feature
    - features/step_definitions/agent/listing.steps.ts
  modified:
    - features/lib/agent-files.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/discover.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/domain/name.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/discover.test.ts
    - test/bridges/agents/frontmatter.test.ts
    - test/bridges/agents/stage.test.ts
    - test/bridges/agents/types.test.ts
    - test/domain/name.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
  deleted:
    - features/step_definitions/agent/runs.steps.ts

key-decisions:
  - "D-CF4-03: a missing or blank description falls back to when_to_use, then when-to-use, then `Agent from <plugin> plugin`, each trimmed; the fallback warning fires whenever `description` itself is missing or blank"
  - "D-CF4-01: discovery walks recursively, finds dotfiles and any-case .md, cuts only a lower-case .md, skips symlinks, stops at 32 namespace segments; a declared regular .md file keeps its bare name"
  - "D-CF4-14: every generated agent file carries the fixed line `advertise: true` after `inheritSkills:`"

requirements-completed: [AGT-01]

metrics:
  started: 2026-11-01T15:14:14Z
  completed: 2026-11-01T15:56:22Z
  duration: 42m
---

# Phase 4 Plan 01: Agent listing Summary

pi-subagents now lists each bridged agent under the name, alias, and description Claude Code 2.1.316 gives a plugin agent. That covers nested folders (`demo:review:security`), dotfiles, `UPPER.MD`, declared files, and Claude Code's `Agent from <plugin> plugin` fallback. Every bridged agent is also advertised in the parent model's system prompt. All of it is proven through pi-subagents' own `list` result and the call log.

## Tasks

| Task | Name | Commit | Kind |
| ---- | ---- | ------ | ---- |
| 1a | Move the seed Given into the shared listing module (D-08) | adf8215 | test |
| 1 | List a description-less agent with Claude Code's fallback (D-CF4-03) | f2e3edc | fix |
| 2 | List nested and declared agent files under Claude Code's names (D-CF4-01) | 1e1d5c3 | feat |
| 3 | Advertise every bridged agent to the parent model (D-CF4-14) | 7e3efc3 | feat |
| 4 | Carry the advertise line into the orchestrator tests' expected texts | 65f4558 | test |

## Red proofs

Each scenario ran before its product change. The failing outputs below are pi-subagents' actual text from the call log (the `- actual` side of the diff).

**Task 1 (D-CF4-03).** "Agents without a description are listed with Claude Code's fallback" failed. The list read:

```text
subagent returned: Executable agents:\nUser agents\n- demo:dashed (user, aliases: pi-claude-marketplace-demo-dashed): Imported Claude Code plugin agent dashed from plugin demo.\n- demo:noted (user, aliases: pi-claude-marketplace-demo-noted): Imported Claude Code plugin agent noted from plugin demo.\n- demo:plain (user, aliases: pi-claude-marketplace-demo-plain): Imported Claude Code plugin agent plain from plugin demo.
```

The bridge ignored `when_to_use` and `when-to-use`. Pins that passed before the change: (a) "A bridged agent is listed under its plugin name with its alias and description", (b) the builtins control "The list keeps pi-subagents' own agents beside a bridged one", and (d) "Agents of the same name in two plugins are listed under their own plugin names".

**Task 2 (D-CF4-01).** Four scenarios failed before the change:

- (e) "Agent files in subfolders are listed under their folder names" listed only `- demo:reviewer (...)`. The nested files were not discovered.
- (f) "Hidden and upper-case agent files are listed as Claude Code lists them" listed `Executable agents:\n- (none)`.
- (h) "A declared agent file is listed under its own name" listed `Executable agents:\n- (none)`. The declared file path hit `readdir` ENOTDIR.
- (i) "An agent whose folder name flattens onto another agent's file name is reported as skipped" reported only the cascade row and no diagnostic.

(g) "A file without the markdown extension is not listed as an agent" passed before the change. It is the negative control.

**Task 3 (D-CF4-14).** "A new session advertises each bridged agent to the parent model" failed with `AssertionError: model call 1 has no advertised_subagents section`.

After each change, `npx cucumber-js features/agent` passed. The final run passed 13 scenarios: the ten listing scenarios plus the three seed scenarios, whose expected text is unchanged.

## Step texts added

In `features/step_definitions/agent/listing.steps.ts`:

- Given `the published plugin {string} of the marketplace {string} has the agent {string} described as {string} with this body:`. Moved unchanged from the deleted `agent/runs.steps.ts`, in its own commit (D-08).
- Given `the published plugin {string} of the marketplace {string} has these agents:`. The table needs `file` and `body` columns, and every other column is a frontmatter key.
- Given `pi-subagents hides its builtin agents`. Merges `subagents.disableBuiltins: true` into `{agent dir}/settings.json`.
- Given `pi-subagents hides the builtin agent {string}`. Merges `subagents.agentOverrides.<name>.disabled: true`.
- Then `the model call {int} advertises these agents:`. Compares the leading system message's `sections.advertised_subagents` whole.

`features/lib/agent-files.ts` adds `AgentFileRow`, `readAgentFileRows`, `agentRowText`, and `publishAgentFiles`. `PluginAgent`, `agentFileText`, and `publishAgentFile` are byte-identical. The diff removes only the old `@fileoverview` line and the import line, which now imports `writePublishedPluginFiles` too.

## Non-owned files changed

- `test/orchestrators/plugin/update-swap.test.ts`: expected values only. Line 698's `description:` became `Agent from hello plugin` (Task 1). Lines 232 and 698 gained `advertise: true\n` (Task 4). Numstat is 2/2.
- `test/orchestrators/plugin/reinstall-flow.test.ts`: expected value only. Line 677 gained `advertise: true\n`. The `oldBytes` fixture on line 560 is unchanged. Numstat is 1/1.
- `test/orchestrators/plugin/install-flow-ledger.test.ts`: expected value only. Line 1286 gained `advertise: true\n`. Numstat is 1/1.
- `extensions/pi-claude-marketplace/domain/name.ts`: only `generatedAgentName` and `declaredAgentName` and their doc comments changed. Each takes `namespace: readonly string[] = []`.
- `test/domain/name.test.ts`: only the `describe("generatedAgentName")` and `describe("declaredAgentName")` blocks changed. Each gained namespace rows and segment-rejection rows.

## Verification

- `node --test` on every touched unit test passed. Direct coverage is 100% for `convert.ts`, `discover.ts`, `frontmatter.ts`, and `domain/name.ts`.
- `npm run test:modules` (the whole unit suite) passed after Task 2 and after Task 4. `npm run test:integration` passed after Task 4.
- `npx cucumber-js features/agent` passed: 13 scenarios, seeds included.
- `npm run check:static` passed before each commit. `npx fallow dupes --fail-on-issues` reports no clone group.
- All acceptance greps of the four tasks hold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An existing discovery case asserted the behavior D-CF4-01 reverses**
- **Found during:** Task 2
- **Issue:** The plan says to keep every existing `discover.test.ts` case passing unchanged. But "discovers flat markdown agents in source order with complete records" asserted that `.hidden.md` and `nested/nested.md` are not discovered, and D-CF4-01 requires both.
- **Fix:** The case keeps its arrange. Its expected value adds the `.hidden.md` record and the `nested/nested.md` record (`namespace: ["nested"]`), in walk order. It is retitled "discovers markdown agents in walk order with complete records".
- **Files modified:** `test/bridges/agents/discover.test.ts`
- **Commit:** 1e1d5c3

**2. [Rule 3 - Blocking] A plan-shaped step formed fallow clone groups**
- **Found during:** Task 3
- **Issue:** The advertised-agents Then, written in the research's shape, cloned the call-lookup block of the frozen `model.steps.ts` and of `skill/frontmatter.steps.ts` (phase 2). `fallow dupes` failed.
- **Fix:** The lookup moved into a module-private helper, `advertisedSection`, with its own flow. No suppression marker was added.
- **Files modified:** `features/step_definitions/agent/listing.steps.ts`
- **Commit:** 7e3efc3

**3. [Rule 3 - Blocking] Lint findings in the first drafts**
- **Found during:** Tasks 1 and 2
- **Issue:** `dot-notation` flagged `raw["when_to_use"]`. `sonarjs/no-nested-conditional` flagged the settings merge. An unneeded `no-await-in-loop` disable sat inside the `for await` body.
- **Fix:** Wrote `raw.when_to_use` (`raw["when-to-use"]` keeps brackets), split the conditional, and removed the unused disable. The outer `for await` keeps its reasoned disable. `isRegularFile` uses the shared `isErrnoException` narrower instead of a cast, so it has no unreachable branch.
- **Commits:** f2e3edc, 1e1d5c3

**Plan ledger note:** the worktree guard refuses writes into the shared `.git` folder, so the plan ledger lives at the scratchpad path `exec-04-01/plan-head-before`. Its value is `faa94a2`. `commits: 5` is measured as `git rev-list --count faa94a2..65f4558`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-01 is mitigated by `assertSafeName` on every namespace segment and on the joined names (unit cases in `test/domain/name.test.ts`). T-04-02 holds because the walk descends only into Dirent folders and reads only Dirent regular files, and a declared file must pass `lstat().isFile()` (symlink cases in `discover.test.ts`). T-04-03 holds through the 32-segment limit (depth case). T-04-04 is accepted: bridged descriptions now enter the parent prompt through pi-subagents' escaped and capped catalog. T-04-05 holds because the settings Givens write only `{agent dir}/settings.json` and restore it on release.

## Parent lines

- `CHANGELOG.md`: one bullet for this plan's user-visible changes. pi-subagents lists bridged agents under Claude Code's names, nested `<plugin>:<folder>:<name>` included. Dotfiles and any-case `.md` agent files are found. A declared agent file keeps its bare name. A description-less agent reads `Agent from <plugin> plugin`, or its `when_to_use` / `when-to-use`. Every bridged agent is advertised to the parent model (D-CF4-01, D-CF4-03, D-CF4-14).
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` (not owned): the `isPlainMarkdownFile` doc comment still says it is "Shared by the agents and commands bridges" and that the agents bridge "depends on the `lstat`". The agents bridge no longer calls it, so the comment should name the commands bridge only.
- `docs/prd/pi-claude-marketplace-prd.md:471` (not owned): still states the old fallback `Imported Claude Code plugin agent <agent> from plugin <plugin>.`. It should read `Agent from <plugin> plugin`, after `when_to_use` and `when-to-use` (D-CF4-03).
- `orchestrators/plugin/info.ts` still lists agents flat and case-sensitively, as the plan's flagged assumptions record. That parent line belongs to plan 04-06.

## Self-Check: PASSED

- FOUND: features/agent/listing.feature, features/step_definitions/agent/listing.steps.ts, .planning/phases/04-agents/04-01-SUMMARY.md
- MISSING as intended: features/step_definitions/agent/runs.steps.ts
- FOUND commits: adf8215, f2e3edc, 1e1d5c3, 7e3efc3, 65f4558 (all ancestors of HEAD)

## Dubious Choices

- **The fallback warning fires when only `description` is missing.** An agent that sets `when_to_use` but no `description` still records `source description was missing or empty -- using fallback`, as the plan's behavior rows require, even though its listed description is the author's own text.
- **A present description is now trimmed.** Claude Code's `zie` trims, so `"  Reviews code.  "` lists as `Reviews code.`. The bridge used to emit the value untrimmed, so a re-stage changes such a file's bytes.
- **The flat discovery case was rewritten** (Deviation 1), against the plan's instruction to keep every existing case unchanged. The old expectation contradicts D-CF4-01.
- **`listing.steps.ts` holds a module-private settings merge** (`withSetting`, `mergeUserSetting`) instead of a `features/lib/` module. No other module needs it yet. It writes two-space JSON with a final newline, not Pi's own key order.
- **Builtin descriptions are pinned as literals** in the control scenario (b). These are the 12 pi-subagents 0.84.0 builtin lines after `researcher` is hidden. A pi-subagents upgrade that rewords a builtin breaks this scenario, which is the intended observation of D-CF4-13.
- **The listing order is pi-subagents' own name sort.** The expected tables follow it (for example `demo:review:deep:nested-x` before `demo:review:security` before `demo:reviewer`). They were measured, not derived from the bridge's walk order.
- **Scenario (h) writes the declared agent with the frozen generic file Given**, not with `has these agents:`, because the declared file lives outside `agents/`.

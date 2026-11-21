---
phase: 01-duplicate-integration-files
fixed_at: 2026-11-21T15:57:30Z
review_path: .planning/phases/01-duplicate-integration-files/01-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-21T15:57:30Z
**Source review:** .planning/phases/01-duplicate-integration-files/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 4 (WR-01 to WR-04; scope `critical_warning`, so IN-01 and IN-02 stay open in REVIEW.md)
- Fixed: 3
- Skipped: 1 (WR-04, user decision)

## Fixed Issues

### WR-01: Foreground-child claim cites the deleted tests, and the scenario it was mapped to does not prove it

**Files modified:** `features/lib/real-subagent-child.ts`, `features/step_definitions/plugin/subagent-hooks.steps.ts`, `features/plugin/subagent-child.feature`, `docs/hooks-compatibility.md`
**Commit:** 32b41e5
**Status:** fixed: requires human verification (the new Then is new logic, so a person should confirm it)
**Applied fix:**

- New scenario in `features/plugin/subagent-child.feature`, tagged `@mcp`: "A real foreground child of an ordinary agent runs no plugin hook for its tool calls". It uses `plain` with `Bash, Read`, the calls `bash, failing read`, and async-by-default `false`, the same setup as the deleted foreground test.
- New Then `the plugin's hooks record these runs in order:`, with the columns `session | event | tool name | child identity`. It compares every hook run of the fixture, in the order the hooks appended them. The table lists the startup session's `SessionEnd`, then all 11 main-session runs: the 6 control runs, then `UserPromptSubmit`, `PreToolUse subagent`, `PostToolUse subagent`, `Stop`, `Stop`. A run in any other session prints as its raw id and fails the table. This restores both checks of the deleted test: the full main-session run list, and "the only other run is the install's `SessionEnd`".
- The driver records the startup session id (from `get_state` before the install's `startSession`) as `startupSessionId`. It asserts that the install started a new session.
- New driver guard `assertCallsAnswered`: a `runRealSubagentChild` run fails unless each child sent the provider the results of all its tool calls. The provider now records `toolResults` for each request. Without this guard, a foreground child that never called `bash` would pass, because no hook could show it. The guard covers every real-child launch, background ones included.
- `docs/hooks-compatibility.md:79` now cites the new scenario by title in place of "the real-child tests". The evidence paragraph at `:77` lists it with the other real-child scenarios.

**Red proofs** (each break reverted right after the run and never committed):

| Break | Where | Result |
| --- | --- | --- |
| R1: the launch prompt's script makes an extra `bash` call in the main session before `subagent`, standing in for a foreground child's tool call that runs a main-session hook | `features/lib/real-subagent-child.ts` `providerScript` | `:592` FAILED at `Then the plugin's hooks record these runs in order:` (extra `main PreToolUse Bash` and `PostToolUse Bash` rows) |
| R2: `childIdentityFor` returns a known `demo:plain` identity for a main-session run | `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts` | `:592` FAILED at the same Then (`child identity` reads `named`) |
| R3: the child's task script is empty, so the child makes no tool call | `features/lib/real-subagent-child.ts` `providerScript` | `:592` FAILED in the When: `the child of demo:plain sent the results of its 2 tool calls` |
| Not counted: pi-subagents' `child-launch.js` given `ambientExtensions` for a `parent` host | `node_modules/.cache/optional-peers/.../child-launch.js` (restored, `cmp` identical) | `:592` passed. The in-process foreground child did not run plugin hooks this way, so this break does not reach the claim. |

### WR-02: The forked concurrent child lost its only real run, and `forkCacheKey` is now dead

**Files modified:** `features/lib/real-subagent-child.ts`, `features/plugin/subagent-child.feature`, `docs/hooks-compatibility.md`
**Commit:** 6ad14de
**Status:** fixed
**Applied fix:** `parseConcurrentLaunches` reads an optional `fork cache key` column between `body` and `tool calls`. It detects the column from the header, the way `parseRealChildAgents` reads `body`, and any other header still throws. An empty cell leaves `forkCacheKey` out. The `demo:beta` row of "Concurrent companion children keep separate hook identities" sets `pg3-fork`, as the deleted test did. So `ConcurrentChildLaunch.forkCacheKey` and the runner's spread have a setter again. The hooks doc now says that one of the two concurrent sessions is launched as a fork.

**Proof:** No Then changed. A temporary diagnostic run printed `built.session.runtime.forkCacheKey` from inside the runner (diagnostic reverted). The result was `demo:alpha` → `null` and `demo:beta` → `"pg3-fork"`, in both generations. So the key reaches pi-subagents' launch config only for the forked row. The bridge reads the identity from `systemPromptOptions.customPrompt` and `appendSystemPrompt`, and the fork does not change those. pi-subagents only skips its `before_agent_start` boundary handler for a fork. So no fork-specific break exists in our code to aim a red proof at. The row now guards the forked prompt shape against a future change.

### WR-03: `versions`, `providerModels`, and `providerPrompts` have no reader, and the scripted-model check and version record are gone

**Files modified:** `features/lib/real-subagent-child.ts`
**Commit:** e014f87
**Status:** fixed
**Applied fix:**

- I restored the scripted-model check in the driver's `observeMain`: `assert.deepStrictEqual([...new Set(models)], ["scripted"], "every provider request named the scripted model")`. It runs for every real-child run, concurrent runs included.
- I removed `RealChildVersions`, `MainObservation.versions`, `MainRun.versions`, the `versions` build in `withMainRun`, `providerPrompts`, and `providerModels`.
- The version claim (`docs/hooks-compatibility.md:77`, "pi-subagents 0.88.1") stays backed. The driver gets pi-subagents and pi-mcp-adapter through `resolveCompanion`, which refuses a peer cache that does not hold the suite version from `test/integration/optional-peer-suite-versions.json`. The file overview now says so. No step reads a version, so none was kept.

**Red proof:** I registered a second model `other`, had the provider answer it, and had the main Pi select it after the install (reverted). `:592` FAILED in the When: `every provider request named the scripted model`, actual `['other']`.

## Skipped Issues

### WR-04: The PR's `fallow-audit` job will fail on the `weakened-tests` warning from the two deletions

**File:** `.github/workflows/lint.yml:80-86`
**Reason:** skipped: user decision ("won't fix", recorded in REVIEW.md on 2026-11-21). An `overrides` entry would itself raise a `rule-severity` warning, so the user accepts the PR's `fallow-audit` failure once at review (STATE.md Blockers/Concerns). I did not edit `.fallowrc.json` or `.github/workflows/*`.
**Original issue:** `fallow audit --base f67fe6c9` returns verdict `warn`, with `weakened-tests` (`removed-tests`) on both deleted integration files, and the step "Fail on a Fallow warning" fails on `verdict == 'warn'`.

## Verification

All gates ran in the **main checkout** on branch `claude/stoic-shannon-la9q7o`. No worktree was created: the orchestrator required the main checkout, and it has the `node_modules` and the optional-peer cache that the cucumber runs need. A reader can reproduce the numbers from this tree.

- Each commit's pre-commit hook passed, `npm run check:commit` included.
- `npm run check:static` passed after the last commit: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features.
- `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/agent/frontmatter.feature features/plugin/subagent-child.feature`: 61 scenarios, 843 steps, all passed.
- The same command with `--profile builtin`: 18 scenarios, 210 steps, all passed. The concurrent scenario has no MCP tag, so it runs under adapter only.
- After each fix, I ran every real-child scenario (`frontmatter.feature:410`, `:423`, `subagent-child.feature:542`, `:569`, `:592`, `:614`) under both profiles. All passed.
- `git status --porcelain -- extensions/` prints nothing. The pi-subagents peer file I changed for the uncounted break is byte-identical to its backup.

---

_Fixed: 2026-11-21T15:57:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

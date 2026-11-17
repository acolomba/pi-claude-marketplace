---
phase: 06-hook-inputs-and-events
plan: "07"
subsystem: hooks
tags: [hooks, pi-subagents, child-identity, root-session, cucumber]
status: complete
requires: ["06-03", "06-05", "06-06"]
provides:
  - "`subagentParentSessionId(env: SubagentChildEnv): string | undefined` (platform/subagent-child.ts)"
  - "`ChildRootSession { sessionId: string; transcriptPath: string }` and `resolveChildRootSession(source, readHeaderId?)` (bridges/hooks/child-root-session.ts)"
  - "`KnownChildIdentity.root?: ChildRootSession`, `HooksRuntime.recordChildRoot(sessionId, root)`, `HooksRuntime.childRootResolved(sessionId)` (bridges/hooks/runtime.ts)"
  - "`CHILD_ROOT_DIAGNOSTIC` debug line (bridges/hooks/event-router.ts, module-private)"
  - "Real-child harness: saved main session, `mainSessionFile`, each child's `sessionFile`, and the `transcript path` / `CLAUDE_CODE_SESSION_ID` columns of the real-children runs step, which tells a child run by `agent_id`"
affects: ["06-09 (puts the root into session_id, transcript_path, CLAUDE_CODE_SESSION_ID of a child hook and changes the control reading)"]
tech-stack:
  added: []
  patterns:
    - "bounded first-line read of another session file: absolute path, O_NONBLOCK open, fstat regular file, 65,536 bytes, JSON.parse in try"
    - "per-session runtime cell beside the child identity, dropped by reset or a capture for another session"
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts
    - test/bridges/hooks/child-root-session.test.ts
  modified:
    - features/lib/real-subagent-child.ts
    - features/step_definitions/plugin/subagent-hooks.steps.ts
    - features/plugin/subagent-child.feature
    - extensions/pi-claude-marketplace/platform/subagent-child.ts
    - test/platform/subagent-child.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - test/bridges/hooks/runtime.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - test/bridges/hooks/event-router.test.ts
decisions:
  - "D-PG6-02 as built: the id from PI_SUBAGENT_PARENT_SESSION (no id when unset, empty, or holding / or \\), the file from the child header's parentSession; a readable file's header id must equal the variable; one hop; nothing written to process.env."
  - "A registration that goes stale while the root is read returns undefined and leaves the context buffers and the run-start mark untouched."
metrics:
  duration: "29 min"
  completed: 2026-11-15
actuals:
  tokens: 10600
  tasks: 2
  commits: 2
plan_head_before: 683d17fa34b7e229ee4e160417bff69dab383fde
plan_head_after: 9062931a22766caf89e2c826e9bd94a5af37ba45
---

# Phase 6 Plan 07: Child root session Summary

The real-child harness now states which session a real pi-subagents child's tool hook names, in `session`, `transcript path`, and `CLAUDE_CODE_SESSION_ID`, and tells a child's run by its `agent_id`. The hooks bridge resolves the session that launched a child once, at the child session's first `before_agent_start`, from `PI_SUBAGENT_PARENT_SESSION` and the child header's `parentSession`, and keeps it in the hooks runtime beside the identity. No hook input changed: plan 06-09 puts the root into the fields.

## Commits

| Task | Commit | Title |
|---|---|---|
| 06-07-01 | `a5bd001e` | `test(hooks): state a real child's session fields in its hook runs` |
| 06-07-02 | `9062931a` | `feat(hooks): resolve the session that launched a subagent child` |

`git rev-list --count 683d17fa..HEAD` = 2. Before each commit: `SKIP=npm-check pre-commit run --files <task files>`. For task 1, prettier reformatted `features/lib/real-subagent-child.ts` on the first pass, and the second pass was clean. For task 2, both passes were clean. Each commit was made with `git commit -F - -- <paths>`, and its hook log shows `npm run check:commit ... Passed` in the pre-commit pass. I did not use `--amend`, `--no-verify`, `git stash`, or `git add -A`. Neither commit holds translation-context.ts, hook-env.ts, dispatch-exec.ts, async-rewake/registry.ts, a payload translator, or a file under test/integration/. Neither commit deletes a file.

## Task 06-07-01: the control reading on the unchanged tree

**Fixture.** `withMainRun` starts the main Pi with `session: { kind: "saved" }`. `installPlugin` reads `sessionId` and `sessionFile` from `get_state` after the new session, and asserts that the file lies under the fixture root. `MainObservation.mainSessionFile` holds the file. `DetachedChildObservation.sessionFile?` holds the `steps[0].sessionFile` that pi-subagents records in `status.json`. `ConcurrentSessionObservation.sessionFile?` holds the runner's `session.sessionFile` and is left out for an in-memory session. In the real runs, the main session file was `<fixture>/home/.pi/agent/sessions/--<fixture>-project--/<ts>_<id>.jsonl`. Each detached child's file was `<that folder>/<ts>_<main id>/<run uuid>/run-0/session.jsonl`. Both lie inside the fixture's temporary directory, which the release removes.

**Step.** A run is a child's when `stdin.agent_id` is the session id of a launched child. The columns are `session`, `event`, `tool name`, `agent type`, `agent id`, `transcript path`, `CLAUDE_CODE_SESSION_ID` (the last one from `run.environment`). Each cell is mapped as follows: a child id becomes its ordinal, the main id becomes `main`, a child's file becomes `session file of <ordinal>`, the main file becomes `session file of main`, an empty value stays an empty cell, and any other value stays as written. The control step takes the runs with the main session's id and no `agent_id`. The step text did not change.

**Control reading (production tree at 683d17fa, no file under extensions/ changed):**

| Scenario | `session` | `transcript path` | `CLAUDE_CODE_SESSION_ID` |
|---|---|---|---|
| A real background child runs its plugin tool hooks and completes | the child's own ordinal (`first`, `second`) | `session file of first` / `session file of second` (the child's own file) | the child's own ordinal |
| Concurrent companion children keep separate hook identities | the child's own ordinal (`first`..`fourth`) | empty (in-memory sessions) | the child's own ordinal |

**Root sources each runner gives** (read with a temporary probe that was never committed and was removed before the green runs: the hook recorder also kept `PI_SUBAGENT_PARENT_SESSION`, and the driver printed each child header's first line):

- Detached children of `runRealSubagentChild`: both sources. The child's header has `parentSession` set to the main session's file, which is exactly `mainSessionFile`. The hook environment holds `PI_SUBAGENT_PARENT_SESSION=<main session id>`. So the header did name the main session's file.
- Children of the concurrent runner (`runConcurrentRealSubagentChildren`): neither source. Its environment is `rpcChildEnvironment` plus `PI_SUBAGENT_CHILD=1`, with no launch variable. It builds sessions with `sessionEnabled: false` and no `parentSessionFile`, so pi-subagents makes in-memory sessions without a `parentSession` header (`child-session.js:529-536`, 0.88.1). After plan 06-09, these children have no root and keep their own session, with one debug line.

**Commands (final tree of the commit, files outside extensions/ only):**

- `git diff --quiet HEAD -- extensions`: exit 0 before and after the runs, at HEAD 683d17fa.
- `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature`: exit 0, `19 scenarios (19 passed)`, `259 steps (259 passed)`.
- `npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature`: exit 0, `14 scenarios (14 passed)`, `185 steps (185 passed)`.
- `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts`: exit 0, 6 tests, 6 pass.
- `npm run check:features`: exit 0.
- Acceptance greps: `transcript path` in the steps file: 2. `session file of` in the feature: 6.

## Task 06-07-02: the root as built

**Exports and operations (plan 06-09 reads these):**

```typescript
// platform/subagent-child.ts
export function subagentParentSessionId(env: SubagentChildEnv): string | undefined;
// bridges/hooks/child-root-session.ts
export interface ChildRootSession { readonly sessionId: string; readonly transcriptPath: string }
export async function resolveChildRootSession(
  source: { readonly sessionId: string | undefined; readonly sessionFile: string | undefined },
  readHeaderId: (file: string) => Promise<string | undefined> = readSessionHeaderId,
): Promise<ChildRootSession | undefined>;
// bridges/hooks/runtime.ts
export interface KnownChildIdentity { kind: "known"; agentType: string; childId: string; root?: ChildRootSession }
// HooksRuntime
recordChildRoot: (sessionId: string, root: ChildRootSession | undefined) => void;
childRootResolved: (sessionId: string) => boolean;
```

- Resolver rules: no file (undefined or `""`) means the variable's id with transcript path `""`, or no root. A file whose header id reads gives that id and the file when the variable is absent or equal, and no root when they differ. A file that cannot be read gives the variable's id with that file as the path, or no root. The reader is called at most once, and the file's own `parentSession` is never followed.
- The header reader (`readSessionHeaderId`, module-private) requires an absolute path. It opens with `O_RDONLY | O_NONBLOCK`, requires `fstat().isFile()`, reads at most 65,536 bytes from offset 0, and parses the text before the first `\n`. The header must have `type === "session"` and a string `id`. Any failure gives `undefined`.
- Runtime: the root lives in a closure cell `{ sessionId, root }` beside the identity. `childIdentityFor(s)` adds `root` only to a known identity of the captured session, when a root was recorded. `recordChildRoot` for any session but the captured one does nothing. `resetChildIdentity` and a capture for another session drop the cell. A later capture for the same session keeps it.
- Router: `createBeforeAgentStartHandler(runtime, capturedGeneration)` now registers as `bindWithMode((generation) => createBeforeAgentStartHandler(runtime, generation))` and is `async`. The handler runs only when the identity is `known` and `childRootResolved(sessionId)` is false. It awaits `childRootSession(ctx)`, which passes `subagentParentSessionId(process.env)` and `ctx.sessionManager.getHeader()?.parentSession` to the resolver inside a `try`. A throw logs `before_agent_start root session read failed: <error>` and gives no root. After the wait, a stale generation returns `undefined`. Otherwise the handler records the root, and when there is none it logs `CHILD_ROOT_DIAGNOSTIC` = `Child hook root session unavailable: neither the companion's launch variable nor the child's session header names its launching session`. The run start and the context drain moved into `startRun` and run on every path except the stale one. The new line does not contain `Child hook identity unavailable`, so the identity-diagnostics step of the stand-in scenarios does not see it.

**Red/green.** I put HEAD's runtime.ts and event-router.ts back in place and kept the new tests. `node --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts` then gave 16 fail and 292 pass: the 14 new D-PG6-02 runtime and router cases, plus the two existing router cases whose expected debug lines now include the root line. With the change restored (checked with `cmp` against the saved copies), it gave 308 pass and 0 fail.

**Commands (on the tree committed as 9062931a, run before the commit):**

- Owner tests: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/platform/subagent-child.test.ts test/bridges/hooks/child-root-session.test.ts test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/architecture/hooks-lifecycle.test.ts`: exit 0, 593 tests, 593 pass. dispatch-exec.test.ts and registry.test.ts were not edited.
- `npm run test:coverage:direct -- <the four sources>`: exit 0. With `CI=1`, child-root-session.ts showed branches 34/34, functions 3/3, lines 89/89, and subagent-child.ts showed branches 7/7, functions 2/2, lines 52/52.
- `git diff --quiet HEAD -- features test/integration`: exit 0 before and after the runs below.
- `test/integration/pi-subagents-child-identity.test.ts` (after `install-test-peers`): exit 0, 6/6.
- `test/integration/hooks-*.test.ts`, `pi-subagents-child-launch-conformance.test.ts`, `subagent-hook-ownership.test.ts`: exit 0, 24/24.
- Adapter profile, features/plugin/subagent-child.feature: exit 0, 19 scenarios passed, 259 steps passed. Builtin profile: exit 0, 14 scenarios passed, 185 steps passed. The control reading of task 06-07-01 holds unedited, because nothing reads the root yet.
- `npx tsc --noEmit -p .`, `npx eslint --max-warnings 0 <changed files>`, `npm run fallow`, `npm run test:corresponding`, `prettier --check`: all exit 0.
- Acceptance greps: `export function subagentParentSessionId`: 1. `recordChildRoot` in runtime.ts: 2. `resolveChildRootSession` in event-router.ts: 2. The only `process.env` use the commit adds is a read, `subagentParentSessionId(process.env)`. The commit holds exactly the eight files of the task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The child observation's `sessionFile` broke an integration deep-equal**
- **Found during:** Task 06-07-01, first verification run.
- **Issue:** `test/integration/pi-subagents-child-identity.test.ts:309` deep-equals a foreground child's observation, so a new `sessionFile: undefined` key failed 1 of its 6 cases.
- **Fix:** `DetachedChildObservation.sessionFile` is optional and left out when pi-subagents recorded no file. The integration test is unchanged.
- **Files modified:** features/lib/real-subagent-child.ts
- **Commit:** a5bd001e

**2. [Rule 3 - Process] Task 06-07-01 checks rerun on a strictly unchanged tree**
- **Found during:** Task 06-07-01. I had begun task 06-07-02 files (a new export in subagent-child.ts, and the new child-root-session.ts, which nothing imported) while the first task 06-07-01 run was in progress. Neither changes runtime behavior.
- **Fix:** I moved them out of the tree and reran all four task 06-07-01 checks on a tree where `git diff --quiet HEAD -- extensions` was 0 before and after. Those are the results reported above.

**3. [Rule 1 - Test update] Two existing router cases expect the new debug line**
- "before_agent_start clears invalid child metadata..." now expects `CHILD_ROOT_LINE` first (the valid capture resolves no root), then the two identity lines. "reload resets child identity..." now expects `[CHILD_ROOT_LINE]` from the new generation's first capture. Both now unset `PI_SUBAGENT_PARENT_SESSION` for the case, so an ambient value cannot change them.

**4. [Convention] subagent-child.test.ts holds one `describe()` per entrypoint**, because the module now has two exports (typescript-unit-tests cases rule). The existing cases are unchanged inside `describe("isSubagentChild")`.

**5. [Fallow] The resolver's parameter types are inline.** A source or reader type exported only for tests would be an unused export in production mode, and an unexported one would be a private-type leak.

### Interpretations recorded

- A stale generation after the wait returns `undefined` and runs neither the run-start mark nor the drain. Draining after a reload would take context from the new generation's buffers.
- Only the variable is checked for a path separator (F4). The header's id is taken as written.
- A first line with no `\n` inside the bound gives no id, even when the file is shorter than 65,536 bytes. Pi writes a line end after every entry.

## Flagged assumptions (from the plan, unchanged)

- **A nested child names its launcher, not the root.** This departs from D-PG6-01 for that one case and is pending maintainer review. The bridge reads one hop, follows no `parentSession`, and publishes nothing on `process.env` (D-PG3-06). The owner case "a nested child reads only its launching session's file" proves the one-hop rule. No real nested child runs in any test.
- **A root that nothing reads yet.** Plan 06-09 changes the fields. Until then, the only effect in a child is one debug line when no source gives a root.
- **The variable's fallback can be a path (F4).** A value with `/` or `\` is not an id.
- **An unreadable parent file is kept as text** as the root's `transcriptPath` when the variable gives the id.
- **Foreground children run no plugin hook.** The decision concerns background children only.
- **Platform:** Linux, pi-subagents 0.88.1 run; the 0.87.0 floor was read, not run. Node v26.13.1.
- **F12 stays open.** A child's Bash tool still sees its own `CLAUDE_CODE_SESSION_ID` through `applySessionEnv`.

## Records for the orchestrator (parent-owned lines, not applied)

- PROJECT.md Key Decisions: "D-PG6-02 (pending maintainer review): a child's root session comes from `PI_SUBAGENT_PARENT_SESSION` (the id; a value holding a path separator is no id) and the child session header's `parentSession` (the file, whose first-line header id must equal the variable when readable). The bridge reads one hop and publishes no variable, so a child of a child names the child that launched it. With no source, the child keeps its own session and the bridge writes one debug line." Plan 06-09 carries the lines for D-PG6-01 and D-PG6-03.
- BACKLOG.md: "Root session of a nested pi-subagents child: a child process would publish its resolved root pair in two variables of this extension for its own background children (06-RESEARCH.md Pattern 1). This conflicts with D-PG3-06 ('never process-global child state'), and the maintainer decides."
- `.planning/codebase/ARCHITECTURE.md`, hooks bridge bullets: "`bridges/hooks/child-root-session.ts` reads the first line (at most 65,536 bytes, regular file, absolute path) of the launching session's file that a pi-subagents child's header names, to resolve the child's root session (D-PG6-02). The `before_agent_start` handler resolves it once per child session and keeps it in the hooks runtime beside the child identity." Load-time section, child note: "In a pi-subagents child, the first run of a session whose identity is known also reads `PI_SUBAGENT_PARENT_SESSION` and the launching session's header line; it writes nothing."
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`: "The real-child fixture's main Pi starts with `session: \"saved\"`, so its session file lies in the fixture's agent directory and pi-subagents names it in each detached child's header. The real-children runs step tells a child run by `agent_id` and states `transcript path` and `CLAUDE_CODE_SESSION_ID` after `agent id`: a child's id reads as its ordinal, the main session's as `main`, a session file as `session file of <ordinal>` or `session file of main`, and an empty value as an empty cell."

## Known Stubs

None. The root is kept and read by nothing until plan 06-09, as the plan intends. That is no stub that blocks this plan's goal.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-17: the variable with a path separator gives no id, and a readable file's header id must equal the variable. T-06-18: absolute path, non-blocking open, regular-file check, 65,536-byte bound, first line only, parse in `try`, and the handler's `try` keeps any throw from Pi's event. An owner case covers each arm.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts
- FOUND: test/bridges/hooks/child-root-session.test.ts
- FOUND: a5bd001e (ancestor of HEAD)
- FOUND: 9062931a (HEAD)

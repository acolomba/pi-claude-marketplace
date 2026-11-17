---
phase: 06-hook-inputs-and-events
plan: "09"
subsystem: hooks
tags: [hooks, pi-subagents, child-identity, root-session, session-id, cucumber]
status: complete
requires: ["06-05", "06-06", "06-07", "06-08"]
provides:
  - "`ChildHookIdentity.root?: ChildRootSession` (bridges/hooks/translation-context.ts)"
  - "`HookDispatchContext extends TranslationContext { ownSessionId: string }`, the return type of `buildTranslationContext` (bridges/hooks/translation-context.ts)"
  - "`childHookIdentityOf(identity: ChildIdentity): ChildHookIdentity | undefined` (bridges/hooks/translation-context.ts), called by both dispatch lanes"
  - "`HookEnvContext.ownSessionId` (bridges/hooks/hook-env.ts)"
affects: ["06-11 (extends the context)", "06-13 (compatibility page, Child identity passage)"]
tech-stack:
  added: []
  patterns:
    - "two session sides in one dispatch context: hook-facing `sessionId`/`transcriptPath`, own `ownSessionId` for internal keys"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - test/bridges/hooks/translation-context.test.ts
    - test/bridges/hooks/hook-env.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/payloads/post-tool-use.test.ts
    - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
    - test/integration/pi-subagents-child-identity.test.ts
    - features/plugin/subagent-child.feature
    - features/agent/frontmatter.feature
decisions:
  - "D-PG6-01 as built: a known child identity with a root gives the root's id and file as sessionId/transcriptPath; agent_id stays the child's own id."
  - "D-PG6-03 as built: ownSessionId keys the CLAUDE_ENV_FILE name, the child journal owner, and the identity guard; translators receive TranslationContext, which has no ownSessionId."
  - "The root is applied only with a kept known identity, so a payload that names the launching session always carries agent_id."
metrics:
  duration: "55 min"
  completed: 2026-11-15
actuals:
  tokens: 21000
  tasks: 1
  commits: 1
plan_head_before: addac2b4d4e3fd67346120553fbdaeacc066387b
plan_head_after: f3250f3b
---

# Phase 6 Plan 09: Child tool hooks name the launching session Summary

A pi-subagents background child whose identity is known and whose launching session plan 06-07 resolved now sends that session in a tool hook's `session_id`, `transcript_path`, `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_SESSION_ID`. `agent_id` stays the child's own Pi session id. Every internal key (the `CLAUDE_ENV_FILE` name, the child journal owner, the identity guard) stays on the child's own id through `HookDispatchContext.ownSessionId`.

## Commit

| Task | Commit | Title |
|---|---|---|
| 06-09-01 | `f3250f3b` | `feat(hooks): name the launching session in a child's tool hooks` |

`git rev-list --count addac2b4..HEAD` = 1. Before the commit: `SKIP=npm-check pre-commit run --files <15 files>`, clean on the first pass (no fixer changed a file). Then `git add <15 explicit paths>` and `git commit -F <msg> -- <paths>`. The hook log shows `npm run check:commit ... Passed`. No `--amend`, `--no-verify`, stash, or `git add -A`. The commit deletes no file. It does not contain shared/session-env.ts, index.ts, runtime.ts, event-router.ts, child-root-session.ts, platform/subagent-child.ts, or any file under features/lib/ or features/step_definitions/. No file in the commit assigns to `process.env` in production code (tests set and restore `PI_SUBAGENT_CHILD` as before).

## Names as built (plan 06-11 extends the context)

```typescript
// bridges/hooks/translation-context.ts
export interface ChildHookIdentity { agentType: string; sessionId: string; root?: ChildRootSession }
export interface TranslationContext { ...; childIdentity?: Omit<ChildHookIdentity, "root">; model?; sessionTitle? }
export interface HookDispatchContext extends TranslationContext { readonly ownSessionId: string }
export function childHookIdentityOf(identity: ChildIdentity): ChildHookIdentity | undefined;
export function buildTranslationContext(ctx: ExtensionContext, childIdentity?: ChildHookIdentity): HookDispatchContext;
// bridges/hooks/hook-env.ts
export interface HookEnvContext { cwd: string; sessionId: string; ownSessionId: string }
```

`buildTranslationContext`: `ownSessionId` is `ctx.sessionManager.getSessionId()`. The identity is kept only when `childIdentity.sessionId === ownSessionId`. `sessionId` is `kept?.root?.sessionId ?? ownSessionId`. `transcriptPath` is `kept?.root?.transcriptPath ?? getSessionFile() ?? ""`, so a root with no file gives `""`. The kept identity is copied with its two members only. Both lanes call `buildTranslationContext(ctx, childHookIdentityOf(identity))`.

## Control reading and red run

Control reading (from 06-07-SUMMARY.md, production tree at 683d17fa and unchanged through addac2b4): in both real-child scenarios, `session`, `transcript path`, and `CLAUDE_CODE_SESSION_ID` named the child's own session (`first`/`second`, `session file of first`/`second`). Detached children of `runRealSubagentChild` have both root sources. Children of the concurrent runner have neither.

**Red (test and feature edits only, `git diff --quiet HEAD -- extensions` exit 0 before and after):**

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts`: exit 1, 6 tests, 2 pass, 4 fail. The four detached cases (background+MCP adapter/builtin, ordinary adapter/builtin) failed with the child's own session id as `session` where the main session's id was expected (for example actual `01a1dd56-9502-...` (runner child), expected `01a1dd56-7642-...` (mainSessionId)). The foreground case and the concurrent case passed, as expected: the first runs no child hook, and the second has no root source.
- `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature features/agent/frontmatter.feature`: exit 1, `31 scenarios (28 passed, 3 failed)`, `429 steps (425 passed, 1 skipped, 3 failed)`. The failures were subagent-child.feature:540 "A real background child runs its plugin tool hooks and completes" and frontmatter.feature:333 and :346. Each diff shows `+ 'first'` / `- 'main'` and `+ 'session file of first'` / `- 'session file of main'`.

The new unit cases import `childHookIdentityOf` and pass `ownSessionId`, so on HEAD they fail to load or type-check. I did not run them separately against HEAD.

## Green runs (final tree, committed as f3250f3b)

- Unit: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/translation-context.test.ts test/bridges/hooks/hook-env.test.ts test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/payloads/pre-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts test/bridges/hooks/payloads/user-prompt-expansion.test.ts test/architecture/hooks-translators.test.ts`: exit 0, 328/328.
- All hooks owner tests: `node --import ... --test 'test/bridges/hooks/**/*.test.ts' test/architecture/hooks-*.test.ts` (every payload test, runtime, event-router, settle, dispatch): exit 0, 1976/1976.
- `npm run test:coverage:direct -- <the six sources>`: exit 0 (100% direct line, branch, and function coverage).
- `node scripts/install-test-peers.mjs && node --import ... --test test/integration/pi-subagents-child-identity.test.ts test/integration/pi-subagents-child-launch-conformance.test.ts test/integration/subagent-hook-ownership.test.ts test/integration/hooks-*.test.ts`: exit 0, 30/30.
- `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature features/agent/frontmatter.feature features/hook/session.feature features/hook/async.feature`: exit 0, `81 scenarios (81 passed)`, `1129 steps (1129 passed)`.
- `npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature features/agent/frontmatter.feature`: exit 0, `16 scenarios (16 passed)`, `197 steps (197 passed)`.
- `npm run check:features`: exit 0. `npx tsc --noEmit -p .`: exit 0. `npx eslint --max-warnings 0 <15 files>`: exit 0. `npm run fallow`: exit 0. `npm run test:corresponding`: exit 0.
- Node v26.13.1, pi-subagents 0.88.1, pi-mcp-adapter 7.0.1, Linux.
- Acceptance greps: `ownSessionId` in translation-context.ts 8, in hook-env.ts 2, in registry.ts 1; `session file of main` in subagent-child.feature 6.

## Readers of the context's session id, and the side each reads

CodeGraph (`npx --no codegraph explore "buildTranslationContext HookDispatchContext prepareHookEnv persistenceOwner callers"`) finds `buildTranslationContext` called only by `dispatchHookExec` (dispatch-exec.ts) and `spawnAndRegister` (async-rewake/registry.ts), and `prepareHookEnv` only by those two lanes (registry through `prepareAsyncEnv`).

| Reader | Site | Side after the change |
|---|---|---|
| stdin `session_id`, `transcript_path` | all `bridges/hooks/payloads/*.ts` translators (`ctx.sessionId`, `ctx.transcriptPath`) | Hook-facing: the root in a child with a known identity and a root, otherwise the own session |
| `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID` | hook-env.ts `claudeSessionEnvFor(transCtx.sessionId)` | Hook-facing |
| `CLAUDE_ENV_FILE` name | hook-env.ts `claude-env-${transCtx.ownSessionId}.env` | Own (D-60-06) |
| Child journal owner | registry.ts `runtime.persistenceOwner(loc, transCtx.ownSessionId, dispatchId)` | Own (D-PG3-05) |
| Identity guard | translation-context.ts `childIdentity?.sessionId === ownSessionId` | Own |
| `agent_id` | pre-tool-use.ts, post-tool-use.ts, post-tool-use-failure.ts (`ctx.childIdentity.sessionId`) | Own |
| `agent_type`/`agent_id` guard on the result events | post-tool-use.ts, post-tool-use-failure.ts | Now the presence test of pre-tool-use.ts, which reads no session id |
| Identity lookup | dispatch-exec.ts, registry.ts, event-router.ts (`ctx.sessionManager.getSessionId()` directly) | Own, untouched |
| `hookPathVars` | hook-env.ts | Reads `cwd` only |
| Bash-tool environment | index.ts `applySessionEnv` | Own, untouched (F12) |
| `${CLAUDE_SESSION_ID}` in skill and command bodies | edge/ modules | Own, not a hook field, untouched |

## Owner cases added

- translation-context.test.ts: the existing cases now sit in `describe("buildTranslationContext")` with `ownSessionId` in each expectation. The new cases cover a known child with a root, a root with no file (`transcriptPath: ""` over a saved own session), a known child with no root (its own file kept), and an identity captured for another session whose root is ignored. A new `describe("childHookIdentityOf")` covers main, unavailable, known, and known with a root.
- hook-env.test.ts: two own sessions with one hook-facing session give `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` = the root and two `CLAUDE_ENV_FILE` names (T-06-19).
- dispatch-exec.test.ts: for PreToolUse, PostToolUse, and PostToolUseFailure, a known child with a recorded root sends the launching session's id and file and `agent_id` = the child, and both session variables = the root. A child whose capture had no agent tag (unavailable) keeps its own `session_id` and both variables, with no `agent_id`, although a root was recorded for its session (T-06-20, the plan's prohibition).
- registry.test.ts: two child sessions of one root give two journal owners, `["first-child", "second-child"]`, while both stdin payloads read `session_id: "launching-session"` with their own `agent_id`.
- post-tool-use(-failure).test.ts: the parametrized identity case now covers own session, absent, and launching session. The old "other-session" arm, which expected the translator to drop a mismatched identity, moved to the factory, because a translator no longer compares session ids.

## The concurrent runner's table and the stand-in scenarios

The table of "Concurrent companion children keep separate hook identities" did not change. 06-07-SUMMARY.md says its children have no launch variable and no `parentSession` header, so they are the real-runner case of a child with no root source. They passed with their own session in all three columns. The integration test's concurrent case likewise keeps each child's own session id and now picks runs by `agent_id`. The stand-in child scenarios of subagent-child.feature passed with their tables unedited.

`test/integration/hooks-dispatch-end-to-end.test.ts` was not edited. Its child case ("a registered child records complete successful and failed tool result payloads") hand-builds a session manager with no `getHeader` and runs with no `PI_SUBAGENT_PARENT_SESSION`. The router's root read therefore throws inside its `try` and records no root. The case now covers the arm of a known identity with no root: own `session_id` and `transcript_path`, with `agent_type`/`agent_id`. It passed with its expected payload unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] features/agent/frontmatter.feature states the real-children rows too**
- **Found during:** Step 1. The real-children runs step is shared by features/plugin/subagent-child.feature and features/agent/frontmatter.feature ("A call with no launch override..." :333 and "Explicit background and MCP grants..." :346). Both have detached children with a root, so they change with D-PG6-01.
- **Fix:** Their rows now read `main` in `session` and `CLAUDE_CODE_SESSION_ID` and `session file of main` in `transcript path`, and keep the child's ordinal in `agent id`. They were red with the subagent-child row before the change and green after it, under both profiles. The file is not in the plan's `files_modified`.
- **Commit:** f3250f3b

**2. [Plan wording] The integration test also checks that no run names an unlaunched child**
- With runs picked by `agent_id`, the old "main runs carry no identity" check would be trivially true. Each detached and concurrent case also asserts that no run carries an `agent_id` outside the launched children (`strayRuns`). The main-session control picks the runs with no `agent_id`, as the plan says.

**3. [Scope] pre-tool-use.test.ts unchanged.** Its translator already uses the presence test. The root case for PreToolUse is proved through the synchronous lane in dispatch-exec.test.ts, which loops over the three tool events.

## Flagged assumptions (from the plan, unchanged)

- **A child with no identity keeps its own session fields** (planner's rule, pending maintainer review). The root is applied only with a known identity, so a payload with the launching session's id always carries `agent_id`. This is the plan's one kept prohibition, proved by the dispatch-exec untagged case.
- **A nested child names its launcher, not the root** (departs from D-PG6-01 for that one case, pending maintainer review). Plan 06-07 resolves one hop and publishes nothing on `process.env`. No real nested child runs in any test.
- **F12: a child's Bash tool keeps the child's own `CLAUDE_CODE_SESSION_ID`.** `applySessionEnv` is unchanged, so a hook and a Bash command in one child disagree on the variable. Plan 06-13 records it, and the maintainer decides.
- **An unreadable parent file is passed on as text** as `transcript_path`.
- **Foreground children run no plugin hook**, so the decision concerns background children only.
- **Platform:** Linux, pi-subagents 0.88.1 run. The 0.87.0 floor was read, not run.

## Records for the orchestrator (parent-owned lines, not applied)

- PROJECT.md Key Decisions: "D-PG6-01 (pending maintainer review): in a pi-subagents background child whose identity is known, a tool hook's `session_id`, `transcript_path`, `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_SESSION_ID` name the session that launched the child, and `agent_id` names the child (Claude Code 2.1.323 docs and binary; pi-subagents 0.87.0 and 0.88.1). A child with no root source, or whose identity is unavailable, keeps its own fields, so a payload with the launching session's id always carries `agent_id`. A nested child names the child that launched it (one hop)." "D-PG6-02 (pending maintainer review): the root comes from `PI_SUBAGENT_PARENT_SESSION` and the child header's `parentSession`, one hop, with the child's own session as the fallback (built by plan 06-07)." "D-PG6-03: only the fields a hook reads change; the `CLAUDE_ENV_FILE` name, a child's journal owner, and the identity guard stay on the child's own session id."
- BACKLOG.md: close CHILDSESSIONID-01 once the phase verifies. Add: "A child's Bash-tool `CLAUDE_CODE_SESSION_ID`: `applySessionEnv` sets the child's own id, while the child's hooks read the launching session's id (finding F12). The maintainer decides whether the root id should also reach the child's `process.env`."
- `.planning/phases/03-background-subagents/03-VERIFICATION.md`: the unclassified PG-HOOK-07a row (a child's `session_id` equal to its `agent_id`) is closed by decision 26 (D-PG6-01).
- `.planning/codebase/ARCHITECTURE.md`, hooks bridge bullets: "`bridges/hooks/translation-context.ts` builds a `HookDispatchContext`: the hook-facing `sessionId` and `transcriptPath`, which in a pi-subagents child with a known identity and a resolved root name the launching session (D-PG6-01), beside `ownSessionId`, Pi's own session id, which keys the `CLAUDE_ENV_FILE` name, a child's journal owner, and the identity guard (D-PG6-03). Translators take `TranslationContext`, which has no `ownSessionId`; both dispatch lanes build the identity with `childHookIdentityOf`."

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-19: `ownSessionId` keys the env file name, the journal owner, and the guard; owner cases prove two env file names and two journal owners for one hook-facing session. T-06-20: the root is applied only with a kept known identity; the dispatch-exec untagged case and the real-children step (which fails a non-child run that carries an identity) cover it. T-06-21 (accepted): the main session's id and transcript path reach a child's hook stdin, as in Claude Code.

## Self-Check: PASSED

- FOUND: f3250f3b (HEAD, ancestor check passed)
- FOUND: all 15 modified files in the commit
- `git status --short` after the commit: clean except this SUMMARY

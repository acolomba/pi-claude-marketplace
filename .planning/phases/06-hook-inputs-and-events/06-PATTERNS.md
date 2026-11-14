# Phase 06: Hook Inputs and Events - Pattern Map

**Mapped:** 2026-11-14
**Scope:** D-PG6-01..24 (PG-HOOK-04, PG-HOOK-06, PG-HOOK-11, decision 26), with RESEARCH findings F1 to F12 applied where they override CONTEXT. Current tracked source on `features/gaps` at `7e0159fc`, not the saved codebase maps.
**Files classified:** 70 distinct candidate files (a file that two groups touch is counted once; several are conditional). Names marked "(proposed)" do not exist yet and are the planner's to rename.
**Analogs found:** 66 / 70. Most changes land in an existing owner, which is its own analog. Four behaviors have no code to copy (see "No Analog Found").

Every decision this map serves is pending maintainer review (CONTEXT "Pending maintainer review"); the map records where code would land, not that the decisions are accepted.

## File Classification

Paths abbreviated: `S` = `extensions/pi-claude-marketplace`, `H` = `S/bridges/hooks`. A paired owner test replaces `S/` with `test/` and `.ts` with `.test.ts`; every source row implies its owner test, listed once per group.

### Group 1: hook-facing session fields in a child (decision 26, D-PG6-01..03)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/translation-context.ts` | model + factory | transform | existing owner: `TranslationContext`, `buildTranslationContext` (`:40-78`) | exact |
| `H/hook-env.ts` | utility (env builder) | transform | existing owner: `HookEnvContext` (`:22-25`), `prepareHookEnv` (`:75-104`) | exact |
| `H/runtime.ts` (root pair kept with the child identity) | store | event-driven | existing owner: `captureChildIdentity`, `childIdentityFor`, `resetChildIdentity` (`:451-487`) | exact |
| `S/platform/subagent-child.ts` (reads `PI_SUBAGENT_PARENT_SESSION`, and the two published variables if Pattern 1 is accepted) | utility (env reader) | transform | existing owner: `isSubagentChild` (`:19-30`) | exact |
| `H/payloads/post-tool-use.ts`, `post-tool-use-failure.ts` (the two identity guards) | utility (translator) | transform | `H/payloads/pre-tool-use.ts:44-46` (presence test) | exact |
| `H/async-rewake/registry.ts` (`persistenceOwner` key) | service | event-driven | existing owner (`:357-367`) | exact |
| `H/dispatch-exec.ts` (context build) | service | request-response | existing owner (`:222-232`) | exact |
| `test/bridges/hooks/{translation-context,hook-env,runtime}.test.ts`, `payloads/{post-tool-use,post-tool-use-failure}.test.ts`, `async-rewake/registry.test.ts`, `test/platform/subagent-child.test.ts` | test | transform | existing owners | exact |

### Group 2: new stdin fields (PG-HOOK-04)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/payloads/pre-tool-use.ts`, `post-tool-use.ts`, `post-tool-use-failure.ts` (`tool_use_id`, `mcp_server`, `effort`; `duration_ms` on the two result events) | utility (translator) | transform | their own conditional spread (`pre-tool-use.ts:44-46`) | exact |
| `H/payloads/pre-compact.ts` (`custom_instructions`) | utility (translator) | transform | existing owner (`:24-35`) | exact |
| `H/payloads/session-start.ts` (`model`, `session_title`) | utility (translator) | transform | existing owner (`:50-61`) | exact |
| `H/payloads/user-prompt-submit.ts` (`session_title`) | utility (translator) | transform | existing owner (`:21-32`) | exact |
| `H/payloads/stop.ts`, `stop-failure.ts` (`effort`, F1) | utility (translator) | transform | `stop.ts:33-42` | exact |
| `H/translation-context.ts` (`model`, `sessionTitle`, `effort`, `ownSessionId`) | model + factory | transform | existing owner | exact |
| `S/domain/argument-substitution.ts` (hook effort mapping beside `claudeEffort`) | utility | transform | `claudeEffort` (`:280-288`) | role-match (the hook rule omits `off`/`minimal`; `claudeEffort` maps them to `low`) |
| `H/dispatch.ts` (edit-pair ids; duration read at `tool_result`) | service | event-driven | existing owner: `runEditPreflight` (`:1082-1085`), `runEditResultPairs` (`:1300`), `toolResultCompositeHandler` (`:1218-1271`) | exact |
| `H/runtime.ts` (duration marks) | store | event-driven | `shownStartFailures` set and its reset (`:287`, `:296-304`, `:430-436`) | role-match (a per-call `Map` with a clear on `agent_end` does not exist) |
| `H/event-router.ts` (`tool_call` wrapper sets the mark; server table hydrate) | route | event-driven | existing owner: `tool_call` registration (`:1291-1296`); `hydrateScopeFromState` (`:648-663`) | exact |
| `H/settle.ts` (`agentEndCacheHandler` clears the marks) | handler | event-driven | existing owner (`:142-157`) | exact |
| `H/routing-state.ts` (server table type and operations) | store (leaf) | transform | existing owner: `CacheEntry`, `RoutingStateOperations` (`:90-110`, `:176-195`) | role-match |
| `H/mcp-tool-view.ts` (only if the lookup is exposed on the view) | utility | request-response | `HookToolView.identify` (`:17-27`, `:124-140`) | role-match |
| `test/bridges/hooks/payloads/*.test.ts` (seven), `test/bridges/hooks/{dispatch,runtime,event-router,routing-state,settle,translation-context,tool-batch}.test.ts`, `test/domain/argument-substitution.test.ts` | test | transform | `test/bridges/hooks/payloads/pre-tool-use.test.ts:11-48` | exact |

### Group 3: `UserPromptExpansion` (PG-HOOK-06)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `S/shared/concerns/hooks.ts` (`ClaudeHookEvent`) | model (closed union) | transform | existing owner (`:57-67`) | exact |
| `S/domain/components/hook-events.ts` (`ADMITTED_EVENT_NAMES`, `NON_TOOL_EVENT_FIELDS`) | model (closed sets) | transform | existing owner (`:49-60`, `:189-197`) | exact |
| `S/domain/components/hooks/partition.ts` (third non-tool matcher kind) | utility | transform | `toolMatcherCondition` (`:35-46`) | role-match |
| `S/domain/components/hooks/matcher.ts` (name-list parse) | utility (parser) | transform | `parseMatcher` (`:56-99`) | role-match |
| `H/payloads/user-prompt-expansion.ts` (proposed) | utility (translator) | transform | `H/payloads/user-prompt-submit.ts` (whole file) | exact |
| `test/bridges/hooks/payloads/user-prompt-expansion.test.ts` (proposed) | test | transform | `test/bridges/hooks/payloads/pre-tool-use.test.ts` | exact |
| `H/dispatch-exec.ts` (`TRANSLATORS`, `REQUIRED_EVENT_FIELDS`) | service | request-response | existing tables (`:139-150`, `:326-337`) | exact |
| `H/async-rewake/registry.ts` (`TRANSLATORS`), `rewake-text.ts` (`MATCH_FIELDS`) | service | event-driven | existing tables (`registry.ts:146-159`, `rewake-text.ts:17-28`) | exact |
| `H/timeout.ts` (`BLOCKING_EVENT_DEFAULT_SECONDS`) | utility | transform | existing table (`:68-79`) | exact |
| `H/wire-protocol.ts` (`PLAIN_CONTEXT_EVENTS`) | utility | transform | existing set (`:48-52`) | exact |
| `H/event-router.ts` (`CHILD_EVENT_POLICY`, `pushGroupHandlers`, third `input` registration) | route | event-driven | the `UserPromptSubmit` `input` registration (`:1267-1280`); policy (`:140-151`) | exact |
| `H/dispatch.ts` (`CompositeDispatchEvent`, `matchValue`, `entryFires`, `noticeLabel`, `adaptForEvent`, the notice sets) | service | event-driven | the `UserPromptSubmit` arms (`:912-915`, `:1323-1347`, `:1396-1411`, `:1500-1527`) | exact |
| `H/event-adapters.ts` (expansion adapter) | service (adapter) | request-response | `adaptInputResult` (`:670-701`) | exact |
| `H/hook-labels.ts` (block text) | utility (pure text) | transform | `promptBlockedText` (`:129-141`) | exact |
| Typed-line resolver (proposed, beside `S/orchestrators/skill-alias-state.ts`) | service | request-response | `loadPluginAliases` and `PluginAliasTarget` in `S/orchestrators/skill-alias-state.ts`; the line parses in `S/edge/skill-aliases.ts:207-245` and `S/edge/command-invocation.ts:121-135` | role-match |
| `S/index.ts` (injects the resolver into the bridge) | config (entry) | event-driven | the bridge registration (`:153`) and the edge registrations (`:324-327`) | exact |
| `test/architecture/hooks-lifecycle.test.ts`, `hooks-translators.test.ts`, `hooks-foundation.test.ts`, `closed-set-enrollment.test.ts` | test (gate) | transform | existing gates | exact |
| `test/domain/components/hooks/{partition,matcher}.test.ts`, the `hook-events` owner test, `test/bridges/hooks/{dispatch,event-adapters,event-router,hook-labels,wire-protocol,timeout}.test.ts`, `async-rewake/{registry,rewake-text}.test.ts`, the resolver's paired test (proposed) | test | transform | existing owners | exact |

### Group 4: `SessionStart` `resume` and `fork` (PG-HOOK-11)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/payloads/session-start.ts` (`claudeSessionStartSource`) | utility (mapping) | transform | existing owner (`:34-47`) | exact |
| `H/event-router.ts` (`session_start` handler passes the two facts) | route | event-driven | existing owner (`:1165-1236`) | exact |
| `test/bridges/hooks/payloads/session-start.test.ts`, `test/bridges/hooks/event-router.test.ts` | test | transform | existing owners | exact |
| Spike S7 record (a plan SUMMARY, no source) | documentation | batch | RESEARCH "Spike S7" | no code analog |

### Group 5: cucumber harness

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/step_definitions/hook/runs.steps.ts` (placeholders) | test (step module) | transform | its own `sessionOrdinals`, `cell`, `runRecord` (`:46`, `:63-114`) | exact |
| `test/e2e/_rpc.ts` (`piArguments`, `PiArgumentOptions`, `RpcProfile`, `startRpcPi`) | utility (launcher) | request-response | the `noMcp` option (`:93-112`, `:284-298`, `:517-535`) | exact |
| `features/lib/pi-process.ts` (`PiProcess.start` forwards the profile) | utility (driver) | streaming | existing owner (`:173-179`) | exact (likely no edit: it forwards `RpcProfile` whole) |
| `features/support/world.ts` (`PiProfile`, `ProfileLaunch`, `startProfilePi`) | provider (world) | request-response | the `noMcp` and `subagentChild` fields (`:142-169`, `:191-193`, `:1093-1125`) | exact |
| `features/step_definitions/hook/session-end.steps.ts` (saved session with message entries) | test (step module) | file-I/O | its own header-only `Given` (`:60-80`) | exact |
| `features/step_definitions/hook/session.steps.ts` (`/compact` with text, session name, thinking level) | test (step module) | request-response | `compactSession` and `recordSessionAction` (`:123-137`, `:226-229`, `:342-347`) | exact |
| `features/lib/scripted-model/extension.ts` (reasoning-capable model) | utility (harness extension) | streaming | its own `registerProvider` call (`:271-303`) | exact |
| `features/lib/real-subagent-child.ts` (main Pi with a saved session) | utility (fixture) | event-driven | `withMainRun` (`:691-694`), `sessionIdOf` (`:761-765`) | exact |
| `features/step_definitions/plugin/subagent-hooks.steps.ts` (child rows keyed by `agent_id`) | test (step module) | event-driven | the real-children `Then` (`:551-578`), `childOrdinals` (`:246-263`) | exact |
| `features/step_definitions/hook/prompt-commands.steps.ts` or a new topic module (expansion scenarios) | test (step module) | request-response | existing prompt-command steps | role-match (not opened) |

### Group 6: feature files whose literals grow

| New/Modified File | Whole-payload tables | Change |
|---|---|---|
| `features/hook/tool-use.feature` | 54 | `tool use id`; `duration ms` on result rows; the criterion-1 and `effort` scenarios |
| `features/hook/tool-failure.feature` | 12 | `tool use id`, `duration ms` |
| `features/hook/session.feature` | 14 | `model` on `SessionStart` rows; `resume` / `fork` scenarios; named session |
| `features/hook/async.feature` | 13 | tool-event rows |
| `features/hook/messages.feature` | 11 | tool-event and `SessionStart` rows |
| `features/plugin/subagent-child.feature` | 10 | `session`, `transcript path`, both session variables (`:525-528`, `:544-550`) |
| `features/hook/session-end.feature` | 9 | `SessionStart` rows of resumed sessions |
| `features/hook/failures.feature`, `stop-failure.feature` | 8 each | tool-event rows; `effort` only under a reasoning model |
| `features/hook/mcp-tool-names.feature` | 7 | `mcp server` under both profiles |
| `features/hook/matchers.feature` | 6 | tool-event rows |
| `features/hook/compaction.feature`, `configuration.feature`, `prompt-and-stop.feature` | 4 each | `custom instructions` on `PreCompact`; `session title` where a session is named |
| `features/hook/process.feature` (3), `lifecycle.feature` (2), `prompt-commands.feature` (2), `features/plugin/project-locality.feature`, `project-trust.feature`, `features/skill/model-reads.feature` (1 each) | 10 | rows that hold a tool event or a `SessionStart` |
| `features/hook/prompt-expansion.feature` (proposed), or new scenarios in `prompt-commands.feature` | new | criteria 3 and 4 |

Counts are `grep -c "the hooks record these runs"` on this tree; 174 tables in 20 files. A table that leaves a column out still fails: `recordTable` appends every unstated column (`features/lib/field-rows.ts:93-99`).

### Group 7: records

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/hooks-compatibility.md` | documentation | transform | existing passages (`:9`, `:54-63`, `:96`, `:124`, `:174`, `:334-335`) | exact |
| `docs/output-catalog.md` (prose at `:5423` only) | documentation | transform | existing `hook-notice` section (`:5415-5423`) | exact |
| `docs/env-vars.md` (only if Pattern 1's two variables land) | documentation | transform | existing file | exact |
| `CHANGELOG.md` | documentation | transform | `## [Unreleased]` (`:3-5`); `.agents/skills/changelog/` | exact |

Not edited: `S/shared/notification-dispatch.ts` (`notifyHookNotice` serves the new notice as it is), `S/shared/session-env.ts` (`applySessionEnv` stays on the own session, F12), `H/context-cap.ts` and `H/hook-output-files.ts` (the expansion context passes through the existing cap in `dispatch-exec.ts`), `rule-packs/architecture.json`, `S/persistence/*` (no state schema change).

## Pattern Assignments

### Decision 26: `H/translation-context.ts`

**Analog:** the file itself. The whole factory today (`:65-78`):

```typescript
export function buildTranslationContext(
  ctx: ExtensionContext,
  childIdentity?: ChildHookIdentity,
): TranslationContext {
  const sessionId = ctx.sessionManager.getSessionId();
  return {
    sessionId,
    transcriptPath: ctx.sessionManager.getSessionFile() ?? "",
    cwd: ctx.cwd,
    ...(childIdentity?.sessionId === sessionId
      ? { childIdentity: { agentType: childIdentity.agentType, sessionId } }
      : {}),
  };
}
```

The guard at `:74` compares the child identity with the **own** session id and must keep doing so (D-PG6-03). RESEARCH recommends keeping `sessionId` and `transcriptPath` as the hook-facing names, so the ten translators do not change for decision 26, and adding `ownSessionId` for the internal keys (RESEARCH "Code Examples: Hook-facing and own session in the context"). Copy the conditional-spread form for every new optional member: `exactOptionalPropertyTypes` is on, so a member is spread in or left out, never assigned `undefined`.

The header comment (`:11-19`) says the env layer and the translator layer share one session id, and that `permission_mode`, `effort` "is a v1.14+ scope expansion"; both statements go stale and are rewritten with D-PG6-01, D-PG6-03, D-PG6-10.

**The two call sites build the context the same way**, and both read the identity by the own session id directly from Pi. Keep that read untouched (`dispatch-exec.ts:222-228`, `async-rewake/registry.ts:357-363`):

```typescript
    const identity = runtime.childIdentityFor(ctx.sessionManager.getSessionId());
    const transCtx = buildTranslationContext(
      ctx,
      identity.kind === "known"
        ? { agentType: identity.agentType, sessionId: identity.childId }
        : undefined,
    );
```

The factory gains inputs (the root pair, `ctx.model`, the session name, the mapped effort level). Pass them as arguments or an options object from these two sites; `dispatchHookExec` has `pi` (optional), so the effort read happens there and the translators stay pure.

**Owner test analog:** `test/bridges/hooks/translation-context.test.ts:25-60`. It builds a real `SessionManager.inMemory(cwd, { id })` and a context whose every unrelated member throws when read:

```typescript
function inMemoryContext(sessionId: string, cwd: string): ExtensionContext {
  const sessionManager = SessionManager.inMemory(cwd, { id: sessionId });
  return {
    get ui(): ExtensionContext["ui"] {
      throw new Error("buildTranslationContext must not read ui");
    },
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager,
```

`model: undefined` is a plain member there (`:38`); the "no model" arm of D-PG6-24 is that default, and the "model present" arm sets it.

---

### Decision 26: the three own-session consumers

**`H/hook-env.ts`** (`:22-25`, `:94-99`). `HookEnvContext` holds one `sessionId` that feeds both the session variables and the env-file name:

```typescript
export interface HookEnvContext {
  readonly cwd: string;
  readonly sessionId: string;
}
```

```typescript
    ...claudeSessionEnvFor(transCtx.sessionId),
  };

  if (entry.claudeEvent === "SessionStart") {
    const envFile = path.join(loc.dataRoot, "_shared", `claude-env-${transCtx.sessionId}.env`);
    await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE");
    env.CLAUDE_ENV_FILE = envFile;
  }
```

Split them: `claudeSessionEnvFor` takes the hook-facing id (root in a child, D-PG6-01), the env-file name takes `ownSessionId` (D-60-06). `claudeSessionEnvFor` (`S/shared/session-env.ts`) is the one producer of `CLAUDE_CODE_SESSION_ID` and `CLAUDE_SESSION_ID`, shared with `applySessionEnv`; do not add a second builder. Both lanes call `prepareHookEnv` (`registry.ts:950` through `prepareAsyncEnv`), so one edit covers both.

**`H/async-rewake/registry.ts:364-366`.** The journal owner key:

```typescript
    const persistenceOwner = isSubagentChild(process.env)
      ? runtime.persistenceOwner(loc, transCtx.sessionId, dispatchId)
      : undefined;
```

This becomes `transCtx.ownSessionId`. Left on `sessionId`, two children of one parent share a journal owner (RESEARCH Anti-Patterns).

**The two result-event guards** (`payloads/post-tool-use.ts:67-69`, `post-tool-use-failure.ts:64-66`; RESEARCH cites `:115` and `:183`, which are not these files' lines):

```typescript
    ...(ctx.childIdentity?.sessionId === ctx.sessionId
      ? { agent_type: ctx.childIdentity.agentType, agent_id: ctx.childIdentity.sessionId }
      : {}),
```

Once `ctx.sessionId` is the root, this drops `agent_type` and `agent_id`. Replace both with the presence test of `pre-tool-use.ts:44-46`:

```typescript
    ...(ctx.childIdentity === undefined
      ? {}
      : { agent_type: ctx.childIdentity.agentType, agent_id: ctx.childIdentity.sessionId }),
```

---

### Decision 26: resolving the root (`H/runtime.ts`, `S/platform/subagent-child.ts`)

**Analog for the env read:** `isSubagentChild` (`S/platform/subagent-child.ts`). Copy four things: the header that says pi-subagents is never imported, the variable name as a string-literal constant with a doc comment that cites the pi-subagents source line, the `SubagentChildEnv` parameter type, and a pure function over an environment the caller passes in.

```typescript
const SUBAGENT_CHILD_VARIABLE = "PI_SUBAGENT_CHILD";

/** The environment a caller reads the marker from. */
export type SubagentChildEnv = Readonly<Record<string, string | undefined>>;

export function isSubagentChild(env: SubagentChildEnv): boolean {
  return env[SUBAGENT_CHILD_VARIABLE] === "1";
}
```

The new reader returns the id or `undefined`, and treats a value that holds a path separator as no id (F4). Cite `src/runs/shared/child-runtime-config.js:13-14` and `src/runs/background/async-execution.js:543-555`, with the version read (0.87.0 and 0.88.1).

**Analog for where the pair lives:** the child identity cells of the runtime (`runtime.ts:288-289`, `:451-487`): closure state, captured per session, guarded by the session id it was captured for, reset by `resetChildIdentity`.

```typescript
    childIdentityFor(sessionId: string): ChildIdentity {
      if (!isSubagentChild(process.env)) {
        return { kind: "main" };
      }

      return childIdentitySessionId === sessionId ? childIdentity : { kind: "unavailable" };
    },
```

Resolve once when the identity is captured (RESEARCH "Pattern 1"), keep the pair beside it, and return it by the same own-session guard. `KnownChildIdentity` (`:38-42`) is the place for a `root` member if the pair travels with the identity. The debug line for "no root source" follows `CHILD_IDENTITY_DIAGNOSTIC` (`event-router.ts:153-154`, logged at `:281-283`): one constant, one `hookDebugLog`.

The header read of the parent file is the only new I/O: first line only, bounded, `JSON.parse` in a try/catch, never a throw past the Pi event (RESEARCH Security Domain). The harness has the shape (`features/lib/real-subagent-child.ts:761-765`), which production code may copy in form but not import:

```typescript
async function sessionIdOf(file: string): Promise<string | undefined> {
  const [header = "{}"] = (await readFile(file, "utf8")).split("\n");
  const parsed = JSON.parse(header) as { readonly type?: unknown; readonly id?: unknown };
  return parsed.type === "session" && typeof parsed.id === "string" ? parsed.id : undefined;
}
```

That harness helper reads the whole file; the production read must stop at a bounded prefix. `captureChildIdentity` is synchronous and runs inside `createBeforeAgentStartHandler` (`event-router.ts:272-299`), which already returns a promise, so an awaited read fits there without a signature change upstream.

**D-PG3-06 tension.** Pattern 1 publishes two variables on `process.env` for a grandchild. The runtime's rule is "never process-global child state"; RESEARCH A5 argues a runner serves one launch. This is a maintainer question (RESEARCH Open Question 3), not a pattern the tree already has. The nearest precedent for durable `process.env` state owned by this extension is `PATH_LEDGER_ENV` in `S/shared/session-env.ts` (a named constant with a doc comment that says why it lives on `process.env`).

---

### PG-HOOK-04: the tool translators

**Analog:** `H/payloads/pre-tool-use.ts` (whole file, 48 lines). Each stdin interface lists its members `readonly`, optional ones with `?`, and the function returns one object literal with conditional spreads:

```typescript
export interface PreToolUseStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreToolUse";
  readonly tool_name: string;
  readonly tool_input: unknown;
  readonly agent_type?: string;
  readonly agent_id?: string;
}
```

`tool_use_id` is required on all three (`event.toolCallId`; both Pi events carry it). `mcp_server`, `effort`, and `duration_ms` are optional and spread in. `duration_ms` and `mcp_server` are not on the Pi event; they reach the translator through `TranslationContext` or through the event copy the dispatcher builds. The translators are shape-only and take `(event, ctx)`; `test/architecture/hooks-translators.test.ts:150-152` calls every tool translator as `translate(toolEventFor(event, input), context)`, so a third parameter breaks the gate.

The header of `post-tool-use-failure.ts:16` says "`tool_use_id` and `duration_ms` are not sent (D-CF5-28, D-BG-403)"; rewrite it with D-PG6-04.

**Owner test analog:** `test/bridges/hooks/payloads/pre-tool-use.test.ts:11-48`. Events are built with `satisfies ToolCallEvent` and already carry `toolCallId: "tool-call-built-in"`; the context with `satisfies TranslationContext`; the assertion is one whole-value `deepStrictEqual` plus `Object.hasOwn(payload, "<field>") === false` for each absent optional field:

```typescript
  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(Object.hasOwn(payload, "agent_type"), false);
  assert.strictEqual(Object.hasOwn(payload, "agent_id"), false);
```

Use the `hasOwn` form for "no `effort` under `off`", "no `mcp_server` for a non-MCP tool", and "no `duration_ms` with no mark". Every `satisfies TranslationContext` literal in the payload tests fails to compile once the context gains a required member; that is the lockstep the context header describes.

---

### PG-HOOK-04: edit-pair ids (`H/dispatch.ts`)

**Analog:** the two pair copies. Both keep the native `toolCallId` today.

```typescript
// runEditPreflight, :1081-1088
    batch.pairs.map(async (pair) => {
      const pairEvent: ToolCallEvent = {
        ...(view.event as ToolCallEvent),
        input: pair.input,
      };
      const outcomes = await runHooks(runtime, hooks, (entry) =>
        executor(entry, pairEvent, ctx, pi, runtime),
      );
```

```typescript
// runEditResultPairs, :1294-1302
    pairs.map(({ input }) => {
      if (capturedGeneration !== runtime.currentGeneration()) {
        return Promise.resolve(undefined);
      }

      const pairEvent: ToolResultEvent = { ...event, input };
      return runHooks(runtime, hooks, (entry) => executor(entry, pairEvent, ctx, pi, runtime));
    }),
```

The pair copy carries the suffixed id, so the translators read `event.toolCallId` and need no pair knowledge. Both sites use `Array.prototype.map`, whose index is the pair number; a batch of one pair keeps the bare id (D-PG6-05). One small function builds the id for both sites (`fallow dupes`). `runEditPreflight` returns `pairEvent` in its result (`:1089-1091`) and later code reads it; check that no reader relies on the native id (RESEARCH says nothing else in the extension reads `toolCallId`).

`H/tool-batch.ts` (`editPairViews`, `:71`) is the pure pair model; the id suffix can be a pure helper there, with its case in `test/bridges/hooks/tool-batch.test.ts`.

---

### PG-HOOK-04: duration marks (`H/runtime.ts`, `H/event-router.ts`, `H/dispatch.ts`, `H/settle.ts`)

**Analog for the state:** the keyed once-only set added in Phase 5: a closure collection, operations that take a key and return a value, and a clear in the registration reset (`runtime.ts:287`, `:296-304`, `:430-436`):

```typescript
  const shownStartFailures = new Set<string>();
```

```typescript
  function prepareSettleForRegistration(): void {
    ...
    shownStartFailures.clear();
    finishStopSequence();
  }
```

The marks are a `Map<string, number>` plus one "last top-level" number. Expose operations, not the map (interface doc, `runtime.ts:106-112`): one that records a mark for `(toolCallId, parentToolCallId)`, one that takes and deletes it and returns the duration or `undefined`, one that clears. Clear in the registration reset too, or a `/reload` leaks marks. The clock is a parameter or an injected `now`, per CONVENTIONS "Dependency injection over test-only seams"; `sweepHookOutput(loc, Date.now(), FILE_SYSTEM_SWEEP_OPS)` (`event-router.ts:1146`) is the house form of passing the time in.

**Where the mark is set.** Not inside `compositeHandlerFor`: it returns early for an empty bucket (`dispatch.ts:988-991`) and for a stale generation. Set it in the registration wrapper, in a `finally` (RESEARCH Pitfall 2). The registration today (`event-router.ts:1291-1296`):

```typescript
  pi.on(
    "tool_call",
    bindWithMode((generation) =>
      compositeHandlerFor(runtime, "PreToolUse", generation, pi, opts.executor, tools),
    ),
  );
```

The wrapper form to copy is the `session_before_compact` registration (`:1246-1253`), which builds the handler once per generation and returns a closure around it:

```typescript
    bindWithMode((generation) => {
      const handler = compositeHandlerFor(runtime, "PreCompact", generation, pi, opts.executor);
      return (event, ctx) =>
        dispatchesInCurrentSession("PreCompact") ? handler(event, ctx) : undefined;
    }),
```

**Where it is read.** At the top of the `tool_result` handler, before the empty-bucket return, so the entry is always deleted (`dispatch.ts:1225-1236`):

```typescript
  return async (piEvent, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return undefined;
    }

    const event = routedToolResult(piEvent, tools);
    const claudeEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined;
    }
```

Edit pairs of one call share the call's value (RESEARCH "Pattern 2"), so take the duration once per `tool_result` and attach it to the event or the context every pair run reads.

**Where it is cleared.** `agentEndCacheHandler` (`settle.ts:142-157`) is the existing `agent_end` handler and already has the runtime and the generation guard.

---

### PG-HOOK-04: the `mcp_server` table (`H/routing-state.ts`, `H/event-router.ts`)

**Analog for the names:** `S/domain/name.ts`. All three strings exist; build nothing new (RESEARCH "Don't Hand-Roll"):

```typescript
export function mcpServerDisplayName(plugin: string, server: string): string {
  return `plugin:${plugin}:${server}`;
}
```

`builtinMcpServerName(plugin, server)` (`:658-660`) is the key under Pi's built-in MCP (`McpToolIdentity.builtinServer`), and `generatedMcpServerKey(plugin, server)` (`:646-648`) the key under pi-mcp-adapter. The value is `{ name: mcpServerDisplayName(plugin, server), source: "plugin" }` (F6).

**Analog for the build:** the per-scope hydrate, which already holds each scope's `ExtensionState` (`event-router.ts:648-663`):

```typescript
async function hydrateScopeFromState(
  state: ExtensionState,
  loc: ScopedLocations,
  cwd: string,
  reader: HooksFileReader,
  routingState: EventRouterRoutingState,
  generationIsCurrent: GenerationGuard,
): Promise<void> {
  for (const target of hydrateTargets(state, loc, cwd)) {
    // eslint-disable-next-line no-await-in-loop -- each plugin's hydrate writes the shared routing table
    await tryHydrateOnePlugin(reader, routingState, generationIsCurrent, target);
```

`hydrateTargets` (`:666-705`) filters to enabled plugins **with recorded hooks**; the server table needs every enabled record with `mcpServerConfigs`, hooks or not, so it is a second walk over `state`, not a field on the hydrate target. `EventRouterRoutingState` (`:127-136`) is a `Pick` of runtime operations; a new operation joins that list and `RoutingStateOperations` (`routing-state.ts:176-195`).

**Zone check.** `bridges-hooks` may import `domain` and `persistence`, not `orchestrators`. The one reader of a record's `mcpServerConfigs` is `S/orchestrators/mcp/recorded-servers.ts` (ARCHITECTURE "MCP session steps"), which the bridge cannot import. The table must read the field from the `ExtensionState` type directly and give no entry for a record without it (RESEARCH code map). The planner should confirm the field name on the persisted record type before fixing the task.

**The lookup key at dispatch.** `toolEventView` (`dispatch.ts:1469-1482`) returns `{ event, tool }` with `tool: McpToolIdentity`. Under the built-in MCP the key is `tool.builtinServer`; under the adapter the Pi tool name starts with `mcp__` plus the generated key. The view is already computed once per event in both tool handlers, so the lookup belongs beside it, not in a translator.

---

### PG-HOOK-04: `custom_instructions`, `model`, `session_title`, `effort`

**`H/payloads/pre-compact.ts`** (`:24-35`). The translator already reads `event.reason` through `compactTrigger`; add one member. `custom_instructions` is required and nullable (U8), the one field sent as `null`:

```typescript
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreCompact",
    trigger: compactTrigger(event.reason),
  };
```

`null` for a non-manual trigger even if Pi carries text (D-PG6-08): branch on the mapped trigger, not on `event.reason`.

**`H/payloads/session-start.ts`** (`:50-61`) and **`user-prompt-submit.ts`** (`:21-32`): optional members by conditional spread from the context. `model` is `ctx.model?.id` (bare, D-PG1-04) and `session_title` is `ctx.sessionManager.getSessionName()`; both are read in `buildTranslationContext`, which has `ctx`.

**`effort`.** The level table to sit beside (`S/domain/argument-substitution.ts:280-288`):

```typescript
export function claudeEffort(thinkingLevel: string | undefined): ClaudeEffort {
  return EFFORT_BY_THINKING_LEVEL.get(thinkingLevel ?? "") ?? "high";
}
```

`claudeEffort` maps `off` and `minimal` to `low` and an unknown level to `high` (D-CF1-01); the hook field omits all three and passes `max` (F2). So the hook rule is a second small function over the same level list, not a call to `claudeEffort`. Event set per F1: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `StopFailure`. `Stop` and `StopFailure` are dispatched from `settle.ts` through `collectBucketOutcomes` and the same `dispatchHookExec`, so the context carries the level there too; the five translators spread it and the other six ignore it.

How the thinking level is read elsewhere (`S/edge/command-invocation.ts:60`, `S/edge/skill-aliases.ts:196`): `pi.getThinkingLevel()` at the moment of use, never cached.

---

### PG-HOOK-06: admission (`S/shared/concerns/hooks.ts`, `S/domain/components/*`)

**Analog:** the `Stop` / `StopFailure` admission (ADMIT-01). Two edits start the compile-forced chain:

```typescript
// shared/concerns/hooks.ts:57-67
export type ClaudeHookEvent =
  | "SessionStart"
  | "UserPromptSubmit"
  ...
  | "Stop"
  | "StopFailure";
```

```typescript
// domain/components/hook-events.ts:49-60
const ADMITTED_EVENT_NAMES = [
  "SessionStart",
  "UserPromptSubmit",
  ...
  "Stop",
  "StopFailure",
] as const satisfies readonly ClaudeHookEvent[];
```

`_BucketAEventsCoverageProof` (`:70-72`) fails the build if only one of the two is edited. The doc comment at `:31-48` and the table comment at `:148-188` enumerate every event; extend both.

**Every table that then fails to compile** (each is `Record<BucketAEvent | DispatchableEvent | NonToolEvent, …>`; the value for the new event is given):

| Table | Site | Value |
|---|---|---|
| `NON_TOOL_EVENT_FIELDS` | `hook-events.ts:189-197` | `"command_name"` (but see the matcher kind below) |
| `CHILD_EVENT_POLICY` | `H/event-router.ts:140-151` | `"suppress"` (D-PG6-18) |
| `TRANSLATORS` | `H/dispatch-exec.ts:139-150` | `translateUserPromptExpansion` |
| `REQUIRED_EVENT_FIELDS` | `H/dispatch-exec.ts:326-337` | the fields of the synthetic event the handler builds |
| `TRANSLATORS` | `H/async-rewake/registry.ts:146-159` | the same translator |
| `MATCH_FIELDS` | `H/async-rewake/rewake-text.ts:17-28` | `"command_name"` |
| `BLOCKING_EVENT_DEFAULT_SECONDS` | `H/timeout.ts:68-79` | `undefined` (upstream 600 s, U6) |
| `EVENT_TO_KEBAB`, `EVENT_TO_TRANSLATOR_EXPORT`, `LOCAL_DISPATCHABLE` | `test/architecture/hooks-translators.test.ts:12-56` | `"user-prompt-expansion"`, `"translateUserPromptExpansion"` |

Not compile-forced, so easy to miss: `PLAIN_CONTEXT_EVENTS` (`H/wire-protocol.ts:48-52`; RESEARCH calls it `PLAIN_STDOUT_CONTEXT_EVENTS`), `showsSystemMessages` and `showsFailures` (`H/dispatch.ts:500`, `:644`), and the `switch` statements over `CompositeDispatchEvent`, which are exhaustive with no `default` and so do fail under `noImplicitReturns`.

**The matcher kind has no existing arm.** `nonToolMatcherCondition` (`partition.ts:48-61`) knows two kinds:

```typescript
  if (NON_TOOL_EVENT_FIELDS[event] === null) {
    return null;
  }

  // D-BG-302, CLOSEDLIST-01: a list is kept when one listed value is in the set.
  const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event as keyof typeof NON_TOOL_EVENT_CLOSED_SETS];
  return closedSetMatcherValues(event, rawMatcher).some((value) => closedSet.has(value))
    ? null
    : "closed-set";
```

A field with no closed set would index `NON_TOOL_EVENT_CLOSED_SETS` with a missing key. The nearest shape is the tool arm, which drops only an invalid regular expression (`:35-46`):

```typescript
function toolMatcherCondition(rawMatcher: string): MatcherCondition | null {
  const matcher = parseMatcher(rawMatcher);
  if (matcher.kind === "invalid-pattern") {
    return "regex";
  }
```

And `parseMatcher` (`matcher.ts:56-99`) supplies the split rule to reuse: `SAFE_MATCHER_CHARS` decides exact list or regular expression, the list splits on `/[|,]/` and trims, an invalid pattern is its own state. Its exact-list branch maps members to Pi tool names and returns `unmapped` otherwise, which is wrong for a command name, so the name-list parse is a sibling function in the same file that returns a name set with no tool map (a new `ParsedMatcher` kind, or a separate type).

**Route-time parse** (`event-router.ts:429-432`):

```typescript
  const matcher = parseMatcher(
    claudeEvent === "UserPromptSubmit" || claudeEvent === "Stop" ? "" : rawMatcher,
  );
```

The new event takes the name-list parse here. `RoutingEntry.matcher` is `ParsedMatcher` (`routing-state.ts:72`); `matcherFiresOnToolEvent` (`dispatch.ts:155-168`) is an exhaustive `switch` over its kinds, so a new kind forces an arm there.

---

### PG-HOOK-06: the translator (proposed `H/payloads/user-prompt-expansion.ts`)

**Analog:** `H/payloads/user-prompt-submit.ts` (whole file): a three-line header that names the requirement, one `readonly` stdin interface, one exported function, two type-only imports.

```typescript
import type { InputEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface UserPromptSubmitStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "UserPromptSubmit";
  readonly prompt: string;
}

export function translateUserPromptSubmit(
  event: InputEvent,
  ctx: TranslationContext,
): UserPromptSubmitStdin {
```

The event argument is not Pi's `InputEvent` but a synthetic event the handler assembles from the resolver's answer. The precedents for a synthetic event type exported from the translator module are `StopEvent` (`payloads/stop.ts:28-31`) and `ClaudeSessionStartEvent` (`payloads/session-start.ts:20-22`):

```typescript
export interface StopEvent {
  readonly last_assistant_message: string;
  readonly stop_hook_active: boolean;
}
```

Fields per U8 and F10: `expansion_type: "slash_command"`, `command_name`, `command_args` (required, `""` with none), `command_source?`, `prompt` (`/<name>` with no trailing space when there are no arguments). No `effort` (F1), no `permission_mode`. The file name is fixed by the gate: `hooks-translators.test.ts:60-64` loads `payloads/<kebab>.ts` and reads the export by name.

---

### PG-HOOK-06: the `input` registration and dispatch (`H/event-router.ts`, `H/dispatch.ts`)

**Analog:** the `UserPromptSubmit` registration (`event-router.ts:1267-1280`):

```typescript
  pi.on(
    "input",
    bindWithMode((generation) => {
      const handler = compositeHandlerFor(
        runtime,
        "UserPromptSubmit",
        generation,
        pi,
        opts.executor,
      );
      return (event, ctx) =>
        dispatchesInCurrentSession("UserPromptSubmit") ? handler(event, ctx) : undefined;
    }),
  );
```

Place the new `pi.on("input", …)` directly after it (F9): Pi runs one extension's handlers in registration order and stops at the first `handled`, so a blocked `UserPromptSubmit` runs no expansion hook, and `index.ts` registers the bridge (`:153`) before `registerSkillAliases` and `registerCommandInvocation` (`:324-327`), so the expansion hooks see the typed line before any rewrite.

The closure does more than the analog: return `undefined` for `event.source === "extension"` first, then call the injected resolver, then build the synthetic event and hand it to the composite handler. The two edge handlers show the guard order to copy (`S/edge/command-invocation.ts:121-135`):

```typescript
  pi.on("input", (event, ctx) => {
    if (event.source === "extension") {
      return PASS_THROUGH;
    }

    const line = splitSlashLine(event.text);
    if (line === undefined) {
      return PASS_THROUGH;
    }

    const commands = pi.getCommands();
    if (!commands.some((command) => command.source === "prompt" && command.name === line.name)) {
      return PASS_THROUGH;
    }
```

**Injection.** `bridges-hooks` cannot import `edge` or `orchestrators`, so the resolver arrives through `RegisterHooksBridgeOptions` (`event-router.ts:555-559`), which already carries the optional `executor`. `index.ts:153` passes `{ cwd: homedir() }` today and gains the resolver there.

**`compositeHandlerFor` side effects to mind** (`dispatch.ts:965-1027`). Two event-specific lines run before the bucket check:

```typescript
    if (claudeEvent === "UserPromptSubmit") {
      dropStalePromptContext(runtime, event as InputEvent);
    }
```

The expansion handler runs after `UserPromptSubmit` on the same line and shares its context buffer (D-PG6-20). It must **not** call `dropStalePromptContext`: that would drop the context `UserPromptSubmit` just buffered for this prompt.

**The four per-event switches** all need an arm. `matchValue` (`:1396-1411`) returns `command_name`; `entryFires` (`:1500-1511`) falls to `matcherFiresOnClosedSetValue` for a non-tool event, which calls `closedSetMatcherValues` and so is wrong for a regular expression; the new event needs its own predicate over the parsed name matcher. `noticeLabel` (`:1518-1527`) would produce `UserPromptExpansion:<name>` through `hookMatchLabel`; check upstream's label before accepting that. `adaptForEvent` (`:1323-1347`):

```typescript
    case "UserPromptSubmit":
      return adaptInputResult(result, event as InputEvent, context);
```

`CompositeEventFor` and `CompositeReturnFor` (`:1358-1394`) are conditional types keyed by event; each gains a branch (the synthetic event in, `InputEventResult | undefined` out).

**Gate.** `test/architecture/hooks-lifecycle.test.ts:385-401` pins thirteen registrations and their order:

```typescript
  const staleRegistrations = registrations.slice(0, 13);
  const liveRegistrations = registrations.slice(13);
  const registrationOrder = [
    "session_start",
    "session_shutdown",
    "session_before_compact",
    "session_compact",
    "input",
    "tool_call",
    ...
    "agent_settled",
    "input",
  ];
```

It becomes fourteen with a second `"input"` after the first. The comment in `index.ts` ("the 12 pi.on calls", near `:151`) is already stale and moves again; the registration header comment in `event-router.ts` holds the count too.

---

### PG-HOOK-06: the adapter and the block text (`H/event-adapters.ts`, `H/hook-labels.ts`)

**Analog:** `adaptInputResult` (`event-adapters.ts:670-701`), whole:

```typescript
export function adaptInputResult(
  result: HookExecResult,
  event: InputEvent,
  context: HookAdapterContext,
): InputEventResult | undefined {
  switch (result.kind) {
    case "block":
      return { action: "handled" };

    case "mutate":
      if (result.additionalContext === undefined) {
        return undefined;
      }

      queuePromptContext(result.additionalContext, event, context);
      return undefined;

    case "stop":
      // D-CF5-11 / D-PG5-13: a UserPromptSubmit `continue: false` stops the
      // prompt and shows the user why.
      showAdapterNotice(
        context,
        promptStoppedText(result.stopReason),
        "adaptInput: stop notice failed",
      );
      return { action: "handled" };

    case "noop":
      return undefined;
  }
}
```

The expansion's four arms are the same: `handled` on a block, `queuePromptContext` for context (the same buffer, `:639-656`, which needs the Pi `InputEvent` for `streamingBehavior` and `text`), `promptStoppedText` for a stop (upstream's text is the same on both prompt events, RESEARCH "Don't Hand-Roll"), nothing on a noop. If the bodies are identical, call `adaptInputResult` from the new `adaptForEvent` arm rather than copy it (`fallow dupes`, `sonarjs/no-identical-functions`).

**Where the block notice comes from.** Not the adapter: `blockNotices` (`dispatch.ts:544-580`) builds the text per event from the folded result, and `hookNotices` (`:768-785`) joins it with the system-message and failure notices. The `UserPromptSubmit` block text (`hook-labels.ts:129-141`):

```typescript
/**
 * D-CF5-11 / D-CF5-24: the notice a blocked prompt shows the user,
 * `UserPromptSubmit operation blocked by hook:\n<message>`, the message as
 * `hookErrorText` writes it. Claude Code adds a third line,
 * `Original prompt: <prompt>`, which this notice leaves out (D-CF5-24).
 */
export function promptBlockedText(
  reason: string | undefined,
  command: string,
  fromStderr: boolean,
): string {
  return `UserPromptSubmit operation blocked by hook:\n${blockMessage(reason, command, fromStderr)}`;
}
```

The new text differs only in the event name (U6, F11). Parameterize this function by event or add a sibling that calls the same `blockMessage`; do not write the sentence twice. The doc comment cites the decision and quotes the text; cite D-PG6-20 and `Claude Code 2.1.323`.

---

### PG-HOOK-06: the typed-line resolver (proposed)

**Analog:** `S/orchestrators/skill-alias-state.ts` (`loadPluginAliases`, `:273`; `PluginAliasTarget`, `:62-71`; `installedForms`, `:129`), which maps a typed alias to a Pi name. The resolver needs that table plus the reverse lookup (Pi generated name to the `<plugin>:<name>` form) for a line typed as `/skill:<generated>` or `/<generated command>` (RESEARCH code map).

The line parse and the Pi command test already exist twice; the resolver mirrors them and adds nothing to either handler (`S/edge/skill-aliases.ts:207-245`):

```typescript
    const token = /^\/(\S+)(?=\s|$)/.exec(event.text)?.[1];
    if (token === undefined) {
      return { action: "continue" };
    }

    const commands = pi.getCommands();
    if (commands.some((command) => command.source !== "skill" && command.name === token)) {
      return { action: "continue" };
    }

    if (token.startsWith("skill:")) {
      return invoke(token.slice("skill:".length), token, commands, event, ctx);
    }
    ...
    return getQualifiedAliases(ctx.cwd, ctx.isProjectTrusted()).then(
      (aliases) => {
        const target = aliases.get(token);
```

Three constraints from the tree:

- **One alias cache.** `getQualifiedAliases` is a per-session cache in `registerSkillAliases`' closure (`skill-aliases.ts:170-172`); the resolver must await the same load, not hold a second cache (RESEARCH Pitfall 8). That means the cache moves to where both `index.ts` wiring and `registerSkillAliases` can share it, or `registerSkillAliases` exposes the getter.
- **The second branch above** (`command.source !== "skill" && command.name === token` returns `continue`) means a template named like the token wins over an alias; the resolver must answer in the same precedence, or the hook reports a name Pi does not expand.
- **`command_source`** comes from `pi.getCommands()[n].sourceInfo.scope`: `user` is `"userSettings"`, `project` is `"projectSettings"`, `temporary` leaves the field out, a bridged item is `"plugin"` (F10).

The resolver is an `orchestrators/` module, so BLOCK F (network-free) applies from its first commit; it names no git surface. Its paired test follows `test/orchestrators/skill-alias-state.test.ts`.

**Do not run the hooks inside the two edge handlers.** A command alias passes both, so the hooks would run twice for one line (RESEARCH Anti-Patterns).

---

### PG-HOOK-11: `claudeSessionStartSource` (`H/payloads/session-start.ts`, `H/event-router.ts`)

**Analog:** the mapping itself (`session-start.ts:34-47`), the bridge's one SessionStart mapping site (D-CF5-01):

```typescript
export function claudeSessionStartSource(
  reason: Exclude<SessionStartEvent["reason"], "reload">,
): SessionStartSource {
  switch (reason) {
    case "startup":
      return "startup";
    case "new":
      return "clear";
    case "resume":
      return "resume";
    case "fork":
      return "fork";
  }
}
```

Only the `startup` arm changes: it takes two more facts and returns `fork`, `resume`, or `startup` (F7, F8). Keep the function pure: the facts are parameters (a "holds a message entry" boolean and a "header's `parentSession` was written by this launch" boolean), computed by the caller.

**The call site** (`event-router.ts:1218-1221`), inside the `session_start` handler's try:

```typescript
          requireNotificationMode(ctx.mode);
          if (dispatchesInCurrentSession("SessionStart")) {
            await sessionStartHandler({ source: claudeSessionStartSource(event.reason) }, ctx);
          }
```

`ctx.sessionManager.getEntries()` and `getHeader()` are read here (no file read, no `process.argv`). "Holds a message" means an entry of type `message`, never `getEntries().length > 0`: a new session already holds `model_change` and `thinking_level_change` (F7). The fork test compares the header `timestamp` with `performance.timeOrigin` (F8); pass the process start in as a value so the owner test controls it.

The dedupe key above it (`:1188-1193`) keeps Pi's raw reason and is not edited. `event.reason === "reload"` returns before the mapping (`:1213-1215`), which is why the parameter type excludes it.

**This group waits for spike S7** (D-PG6-13). The predictions in RESEARCH "Spike S7" come from source reads, not a run; if the spike contradicts F7 or F8, the facts above change.

---

### Cucumber: features, steps, harness

Read `.agents/skills/cucumber/SKILL.md` and its `rules/{layout,features,steps,world-and-stand-ins}.md` before writing. `layout.md` gives each file under `features/lib/`, `features/support/`, and each topic step module one owner, so the plans that touch them run in sequence. The step conventions listed in the Phase 5 pattern map ("Step module conventions") apply unchanged.

**Placeholders (`features/step_definitions/hook/runs.steps.ts`).** The whole projection today (`:46`, `:63-96`):

```typescript
const SESSION_ORDINALS: readonly string[] = ["first", "second", "third", "fourth"];
```

```typescript
function sessionOrdinals(runs: readonly HookRun[]): Map<string, string> {
  const ordinals = new Map<string, string>();
  for (const run of runs) {
    const session = run.stdin.session_id;
    if (typeof session === "string" && !ordinals.has(session)) {
      const ordinal = SESSION_ORDINALS[ordinals.size];
      assert.ok(ordinal !== undefined, `more sessions than ${SESSION_ORDINALS.length}`);
      ordinals.set(session, ordinal);
    }
  }

  return ordinals;
}
```

```typescript
function cell(value: unknown, tokens: RunTokens, ordinals: ReadonlyMap<string, string>): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const whole = ordinals.get(text);
  if (whole !== undefined) {
    return whole;
  }

  let embedded = text;
  for (const [session, ordinal] of ordinals) {
    embedded = embedded.replaceAll(session, ordinal);
  }

  return projectTokens("text", embedded, tokens);
}
```

Copy `sessionOrdinals` for `tool_use_id`: a second map over `run.stdin.tool_use_id`, by first appearance, with a token list that does not collide with `first`…`fourth` (D-PG6-12). Three details the copy must handle:

- An edit-pair id is `<toolCallId><suffix>`; project the call's token and keep the suffix, so the table shows pairs of one call apart and tied to it (RESEARCH Wave 0). A nested id `<parent>/<n>` contains the parent's id; the embedded `replaceAll` loop above is the form that handles it.
- `runRecord` (`:98-114`) maps **every** stdin key through `cell`; the new projections are per-column, so they branch on the key (`tool_use_id`, `duration_ms`) before the generic path. `STDIN_COLUMNS` (`:57-60`) renames two columns; the new columns read as their words (`tool use id`, `duration ms`, `mcp server`, `custom instructions`, `session title`).
- `duration_ms` becomes one token only when the value is a non-negative integer; any other value prints as its JSON, so a wrong type fails the table.
- A saved session's `transcript path` holds a timestamp and the id, so it needs a projection too (RESEARCH Wave 0); the id already becomes its ordinal through the embedded loop, the timestamp does not.

The `@fileoverview` (`:1-23`) explains the session-ordinal rule and cites D-CF5-26; extend it with the new tokens and D-PG6-12.

**A second projection exists.** `features/step_definitions/plugin/subagent-hooks.steps.ts` projects real-child rows on its own (`childOrdinals`, `stdinCell`, `:246-263`), and separates child runs from main runs by session id (`:560-561`):

```typescript
    const ordinals = childOrdinals(realChildSessions(this));
    const isChild = (run: HookRun): boolean => ordinals.has(String(run.stdin.session_id));
```

After D-PG6-01 a child's `session_id` is the main session's, so this predicate classifies every child run as a main run. It must key on `agent_id`, and the fixed header at `:578` (`["session", "event", "tool name", "agent type", "agent id"]`) and the literal at `features/plugin/subagent-child.feature:544-550` change with it. RESEARCH does not name this predicate.

**The launcher option (`test/e2e/_rpc.ts`, `features/support/world.ts`).** `--no-session` is unconditional (`_rpc.ts:284-298`):

```typescript
  return [
    resolvePiRuntime(REPO_ROOT).cliPath,
    ...(mode === "tui" ? [] : ["--mode", mode]),
    "--offline",
    "--no-session",
    ...(options.noMcp === true ? ["--no-mcp"] : []),
    ...extensions.flatMap((extension) => ["--extension", extension]),
  ];
```

The analog is `noMcp`, which threads through four places; copy each:

```typescript
// _rpc.ts:107-112
export interface PiArgumentOptions {
  /** Adds `--no-mcp`, which turns Pi's built-in MCP off and keeps every other extension. */
  readonly noMcp?: boolean;
```

```typescript
// _rpc.ts:93-104 (RpcProfile)
  /** Starts Pi with `--no-mcp`, which turns its built-in MCP off for this run. */
  readonly noMcp?: true;
```

```typescript
// _rpc.ts:526-534 (startRpcPi)
    {
      noMcp: profile?.noMcp === true,
      ...(profile?.leadingExtensions === undefined
        ? {}
        : { leadingExtensions: profile.leadingExtensions }),
    },
```

```typescript
// world.ts:1125 (startProfilePi)
      ...(launch.noMcp === true ? { noMcp: true } : {}),
```

The new option replaces `--no-session` with one of `--continue`, `--session <file>`, `--fork <file>` (and `--session-dir` if the spike needs it, RESEARCH Pitfall 4), so it is a discriminated value, not a boolean. `PiProcess.start` (`features/lib/pi-process.ts:173-179`) forwards `RpcProfile` whole and likely needs no edit. `piArguments` is also called by `features/lib/pi-json-mode.ts` and `features/lib/pi-tui.ts`; a defaulted option leaves them alone. `test/e2e/_rpc.ts` has no owner test of its own (only `test/architecture/hermetic-git-environment.test.ts` imports it), and it is shared with the e2e suite, so the default must stay `--no-session`.

**The saved-session `Given` (`features/step_definitions/hook/session-end.steps.ts:60-80`):**

```typescript
Given(
  "the user has a saved pi session {string} in the project",
  async function (this: ScenarioWorld, name: string) {
    const file = savedSessionFile(this, name);
    const header = {
      type: "session",
      version: 3,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      cwd: this.tokens.projectDir,
    };
    const text = `${JSON.stringify(header)}\n`;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
```

Copy the form: `wx` flag, release hook, read-back assertion, a plain-name check (`savedSessionFile`, `:35-38`). Two gaps for `resume` (RESEARCH Pitfall 4): the file holds a header only, so it has no `message` entry; and it lies directly under `sessions/`, where `--continue` does not look by default. Whether a hand-written message entry is accepted, or a first hermetic Pi must write the session, is the spike's answer (RESEARCH Open Question 4, assumption A8). A new step is a new text (`…with a user and an assistant message`), not a change to this one, which `session-end.feature` uses.

**Session actions (`features/step_definitions/hook/session.steps.ts`).** `recordSessionAction` (`:123-137`) is the wrapper for every RPC action that is not a prompt; `compactSession` (`:226-229`) shows the request form:

```typescript
async function compactSession(world: ScenarioWorld): Promise<void> {
  const { response } = await world.pi.request({ type: "compact" });
```

```typescript
When(
  "the user compacts the session with the hooks recording",
  async function (this: ScenarioWorld) {
    await recordSessionAction(this, "compact", () => compactSession(this));
  },
);
```

`compact` with `customInstructions`, `set_session_name`, and `set_thinking_level` are RPC requests of the same form (P8). Each is a new step with its own text; `npm run check:features` fails on a step text with two definitions or none.

**The reasoning-capable model (`features/lib/scripted-model/extension.ts:287-302`).** The provider registration copies each faux model's `reasoning`, which is `false` (P7):

```typescript
    models: faux.models.map((model) => ({
      id: model.id,
      name: model.name,
      input: model.input,
      reasoning: model.reasoning,
      cost: model.cost,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    })),
```

The extension takes no option today: it reads everything from files in the harness directory of `$HOME` (`:6-10`). Follow that: a file the `Given` writes, read at registration, turns `reasoning` on. Existing scenarios must keep `reasoning: false`, so they gain no `effort` column (RESEARCH Pitfall 11). This file is one of the nine harness extensions with a `fallow-ignore-next-line unused-export` marker on its default export; do not move the marker.

**The real-child fixture (`features/lib/real-subagent-child.ts:691-694`).** Its main Pi starts through `PiProcess.start`, so with `--no-session`:

```typescript
    pi = await PiProcess.start(fixture.sandbox, fixture.git, {
      extensions: [subagents.entry, ...(adapter === undefined ? [] : [adapter.entry])],
      environment: { TMPDIR: fixture.temporaryDirectory },
    });
```

With no parent file, pi-subagents writes no `parentSession` and the criterion-6 scenario proves only the id (RESEARCH Pitfall 12). Give this launch the new saved-session option. `MainObservation` (`:238-249`) already carries `mainSessionId`, which the `Then` compares the child's `session` with; add the main session file for `transcript path`.

**Profile shape for a new `Given`** (`features/step_definitions/hook/tool-use.steps.ts:90-99`):

```typescript
Given(
  "pi runs with the scripted model and a downstream file result observer",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [HOOK_RESULT_OBSERVER_EXTENSION],
    });
  },
);
```

`PiProfile` (`world.ts:142-169`) is where the launch option and the reasoning option become profile fields, each with a doc comment that cites its decision, as `subagentChild` does.

**Fixture rows.** The hooks table of every new scenario is the existing recording-hooks `Given` (`runs.steps.ts:116-123`); a blocking expansion hook is a row with `exit code` 2 and a `stderr`, as `features/hook/failures.feature:33-55` shows for `UserPromptSubmit`. Notice assertions reuse `the hooks show the user these messages:` (`features/step_definitions/hook/messages.steps.ts`); no new notice step.

**Profiles.** Only the `mcp_server` scenario is `@mcp` and runs under both profiles; every other new scenario has no implementation tag (D-BG-208).

---

### Records

**`docs/hooks-compatibility.md`.** The passages as they read now; find each by heading or row text, since mdformat re-pads tables:

```markdown
## Current tool contract (Phase 2, 2026-11-13)                                   (:9)
In a child, `session_id`, `transcript_path`, and `CLAUDE_CODE_SESSION_ID` name the child's own Pi session, so `session_id` equals `agent_id`. Claude Code appears to name the main session there instead. This difference is not decided yet.   (:63)
| `UserPromptExpansion` | ✓ | ✗ | Pi slash-command expansion follows a different pipeline |   (:96)
| launch with `--continue`, `--resume`, `--fork` | -- | `startup` | Pi reports `startup` for these launches. ... Not changed (D-CF5-06, ...) |   (:124)
- `UserPromptExpansion` -- slash-command expansion under Pi follows a different pipeline.   (:174)
| `tool_use_id`, `mcp_server` (tool stdin) | ✓ | ✗ | not sent (D-CF5-28) |   (:334)
| `error` (PostToolUseFailure stdin) | ... `duration_ms` is not sent (D-CF5-28, D-BG-403) |   (:335)
```

New rows end with the decision ID, as the existing ones do. Items the page must state that are not in D-PG6-23's list but follow from RESEARCH: `permission_mode` not sent with its reason (D-PG6-11); the `duration_ms` value also holds other extensions' handler time (F5); the edit-pair index follows the input each event carries (Pitfall 3); `mcp_server` is left out for a non-plugin MCP tool; a child's Bash tool still sees its own `CLAUDE_CODE_SESSION_ID` (F12); `${CLAUDE_EFFORT}` maps `off`/`minimal` to `low` while the hook field is left out (F2); `expansion_type` is never `mcp_prompt` (D-PG6-22).

**`docs/output-catalog.md`.** Only the prose paragraph at `:5423` gains the new notice text. The fenced block under `<!-- catalog-state: hook-notice -->` (`:5417-5421`) is byte-locked by `test/architecture/hooks-notice-notify.test.ts`, and a second `catalog-state` block moves the pinned counts in `test/architecture/catalog-uat/catalog-contract.test.ts`.

**`CHANGELOG.md`.** `## [Unreleased]` (`:3`) holds one aggregate bullet with indented sub-bullets (`:5-`); add reader-facing sub-bullets there per `.agents/skills/changelog/`. What changed for a user, not how.

## Shared Patterns

### A Pi event handler never throws (NFR-2)

**Sources:** `H/event-router.ts:1183-1234` (whole handler body in try/catch, an inner try for the hydrate); `H/dispatch-exec.ts:221-247` (the exec layer resolves to a noop).
**Apply to:** the root resolution, the mark set and read, the expansion handler and its resolver call, the two `session_start` fact reads.

```typescript
        } catch (err) {
          hookDebugLog(`session_start skipped: ${errorMessage(err)}`);
        }
```

Failures go to `hookDebugLog(message)` with a `<module>: <what> (<plugin>/<event>): <error>` text and `errorMessage(err)` from `shared/errors.ts`.

### Generation guard and the child gate

**Sources:** `bind` / `bindWithMode` (`H/event-router.ts:1085-1105`); `dispatchesInCurrentSession` (`:156-158`).
**Apply to:** the new `input` registration and the `tool_call` wrapper.

```typescript
function dispatchesInCurrentSession(event: BucketAEvent): boolean {
  return !isSubagentChild(process.env) || CHILD_EVENT_POLICY[event] === "dispatch";
}
```

A handler that awaits (the resolver, the header read) re-checks the generation after the await, as `runStopBucket` does.

### Optional fields are spread, never `undefined`

**Sources:** `H/translation-context.ts:74-76`; `H/payloads/pre-tool-use.ts:44-46`; `test/e2e/_rpc.ts:528-531`.
**Apply to:** every new optional stdin member, context member, and launcher option. `exactOptionalPropertyTypes` rejects an assigned `undefined`, and `JSON.stringify` would drop it anyway; the owner tests assert absence with `Object.hasOwn`.

### One output channel (IL-2)

**Source:** `notifyHookNotice` through `openNotificationRun(pi, { kind: "hook" })`; `showHookNotices` (`H/dispatch.ts:787-`) and `showAdapterNotice` (`H/event-adapters.ts:348-360`).
**Apply to:** the expansion block and stop notices. No `ctx.ui.notify`, no `console.*`, no stdio.

### State lives in the runtime, dependencies are parameters

**Sources:** `H/runtime.ts:106-112` (interface contract), `:296-304` (registration reset); `executor` and `tools` defaulted parameters (`H/dispatch.ts:965-972`); `RegisterHooksBridgeOptions` (`H/event-router.ts:555-559`).
**Apply to:** the duration marks, the root pair, the server table, the resolver, the clock. No module-level mutable state and no `_setXForTest` seam.

### Closed sets are compile-forced

**Sources:** `_BucketAEventsCoverageProof` (`S/domain/components/hook-events.ts:70-72`); `as const satisfies Record<BucketAEvent, …>` (`H/event-router.ts:140-151`).
**Apply to:** the event admission. Add the union member and the tuple member first, then answer each compile error; a missing `switch` arm fails under `noImplicitReturns`. The three sets that are **not** compile-forced are listed under "admission" above.

### Gates that constrain every new or changed file

| Gate | What it requires here |
|---|---|
| Source-test pairing (`npm run test:corresponding`) | `H/payloads/user-prompt-expansion.ts` and the resolver each ship their owner test at the mirrored path in the same commit. |
| Direct coverage (`npm run test:coverage:direct -- <path>`) | 100% per pair, the new arms included: `off`/`minimal`, no model, no session name, no root source, a path-shaped variable, a nested child, a multi-pair edit, a nested tool id, a non-plugin MCP tool (D-PG6-24). |
| Boundary zones (`.fallowrc.json`) | `bridges-hooks` imports `domain`, `persistence`, `shared`, `platform` only. The resolver (orchestrators) reaches the bridge by injection from `index.ts`. `recorded-servers.ts` (orchestrators) is not importable from the bridge. |
| ESLint BLOCK F | The resolver is a new `orchestrators/` module: gated from its first commit, names no git surface. |
| `pi-peer-chokepoint` | Pi types come from `S/platform/pi-api.ts`; a newly needed peer type (`ThinkingLevel`, a session header type) is re-exported there. |
| Complexity (ESLint 15; fallow 15 / 20, computed separately) | `compositeHandlerFor`, `toolResultCompositeHandler`, `registerHooksBridgeWith`, `dispatchHookExec`, and `spawnAndRegister` are large; each new rule is its own small function. |
| `fallow dupes` | One id-suffix helper for both pair sites; one block text builder; the adapter not copied. Check `$?`, not the glyph. |
| `test/architecture/hooks-lifecycle.test.ts` | Fourteen registrations, the second `input` after the first. |
| `test/architecture/hooks-translators.test.ts` | One `payloads/<kebab>.ts` per dispatchable event, exported as `translate<Event>`, called as `(event, ctx)`. |
| `test/architecture/hooks-foundation.test.ts`, `closed-set-enrollment.test.ts`, `lint:type-members` | Pin the old event set and type members; run Prettier before repinning, and shift the line only. Not opened here. |
| `hooks-notice-notify.test.ts`, `catalog-uat/catalog-contract.test.ts` | The catalog block bytes and counts do not move. |
| `npm run check:features` | Every new step text has exactly one definition and every definition is used. |

### Imports, comments, tests

- Import order (`import-x/order`): `node:` builtins, externals, internal values, then `import type` last; groups separated by a blank line and alphabetized. Tests import production modules by relative path with the `.ts` extension.
- Comments and test titles cite `D-PG6-NN`, `PG-HOOK-NN`, and the version read (`Claude Code 2.1.323`, `pi-subagents 0.87.0`); never a phase, plan, or wave number. No comment on trivial code.
- `node:test` with `node:assert/strict`; `// arrange`, `// act`, `// assert`; whole-value `deepStrictEqual`.
- Owner test command: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>`. Filesystem cases use real temp dirs with `t.after` cleanup. Never the real `~/.pi/agent`; the spike sets a temp `HOME` and `PI_CODING_AGENT_DIR`.

## No Analog Found

| Behavior / proposed file | Role | Data Flow | Reason |
|---|---|---|---|
| A per-call mark map with `max(own, last top-level)` and a clear on `agent_end` | store | event-driven | The runtime holds latches, a keyed set, and context buffers, none keyed by tool call or cleared per run. Use RESEARCH "Pattern 2" and the `shownStartFailures` operation shape. |
| A non-tool matcher that is an exact name list or a regular expression | utility | transform | Non-tool events are `null` or closed-set; tool matchers map to Pi tool names. Compose from `parseMatcher`'s split rule and `toolMatcherCondition`'s drop rule. |
| Reading another session file's header in production code | utility | file-I/O | Only harness code does it (`sessionIdOf`), and it reads the whole file. Use RESEARCH "Pattern 1" and the bounded-read rule of its Security Domain. |
| Publishing child state on `process.env` for a grandchild | store | event-driven | D-PG3-06 forbids process-global child state; nothing in the bridge does it. A maintainer decision (RESEARCH A5, Open Question 3), with `PATH_LEDGER_ENV` as the only `process.env` precedent. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges/hooks,bridges/hooks/payloads,bridges/hooks/async-rewake,domain,domain/components,domain/components/hooks,shared,shared/concerns,platform,edge,orchestrators}`, `extensions/pi-claude-marketplace/index.ts`, their `test/` pairs, `test/architecture/`, `test/e2e/_rpc.ts`, `features/{hook,plugin,skill}`, `features/step_definitions/{hook,plugin}`, `features/lib/`, `features/support/world.ts`, `docs/`, `CHANGELOG.md`.
**Files scanned:** about 40 (targeted line ranges; `translation-context.ts`, `hook-env.ts`, `subagent-child.ts`, `session-env.ts`, and the four small translators were read whole).
**Tracked-source gate:** every analog path named above that exists on disk was passed through `git ls-files --error-unmatch` from the worktree root and is tracked (two loops, none missing). The Pi and pi-subagents sources under `node_modules/` are evidence only, never an analog or an edit target.
**Line numbers:** read from the working tree on 2026-11-14 at commit `7e0159fc`. `event-router.ts`, `dispatch.ts`, and `registry.ts` are large; re-locate by symbol before editing.
**Corrections to RESEARCH line cites:** the result-event identity guards are at `payloads/post-tool-use.ts:67-69` and `post-tool-use-failure.ts:64-66` (RESEARCH: `:115`, `:183`); the plain-stdout set is named `PLAIN_CONTEXT_EVENTS`.
**Not verified here:** the field name and shape of `mcpServerConfigs` on the persisted record type; `hydrateTargets`' body; `blockNotices`, `showsSystemMessages`, and `showsFailures` bodies in `dispatch.ts`; `hooks-foundation.test.ts` and `closed-set-enrollment.test.ts`; `features/step_definitions/hook/prompt-commands.steps.ts` and `messages.steps.ts`; the feature files other than `subagent-child.feature:520-560`; the cucumber rules files; `domain/components/hooks.ts` (the `info` reporting of a dropped event); upstream's notice label for `UserPromptExpansion`. No upstream binary read, no check, and no spike was run; no source was changed and nothing was committed. No file under the real `~/.pi` was touched.
**Pattern extraction date:** 2026-11-14

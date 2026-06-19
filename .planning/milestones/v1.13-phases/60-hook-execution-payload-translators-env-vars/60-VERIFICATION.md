---
phase: 60-hook-execution-payload-translators-env-vars
verified: 2026-06-15T00:00:00Z
status: passed
score: 41/41 must-haves verified
overrides_applied: 0
requirements_satisfied:
  - EXEC-01
  - EXEC-02
  - EXEC-03
  - EXEC-04
  - PAYL-01
  - HOOK-05
decisions_closed:
  - D-60-01
  - D-60-02
  - D-60-03
  - D-60-04
  - D-60-05
  - D-60-06
carry_forward_review_closed:
  - WR-01 (phantom project-arm cache)
  - WR-03 (orchestrators rebuild gap)
  - CR-01 (event-adapters mutation whitelist)
  - CR-02 (UTF-8 byte caps)
info_findings_deferred:
  - IN-01 (stderr ledger formatting)
  - IN-02 (compositeHandlerFor cast doc)
  - IN-03 (magic-string type literals in event-adapters)
  - IN-04 (serializeWithTruncation cap re-check doc)
---

# Phase 60: Hook Execution + Payload Translators + Env Vars Verification

**Phase Goal:** A dispatched hook spawns a child process with the right cwd / env / args / timeout, receives a faithfully translated bucket-A stdin payload (with Pi → Claude tool-name translation), and surfaces its stderr only to the debug log.

**Verified:** 2026-06-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The four plans (60-01..60-04) deliver the entire bucket-A hook execution pipeline. Code review fix pass landed all 9 critical+warning findings; 4 info findings remain documented and informational. `npm run check` is green end-to-end (2100 unit tests + 10 integration tests, 0 failures).

### Observable Truths

#### Plan 60-01 (Translators + TOOL-01 helper + TranslationContext)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `mapPiToClaudeToolName(name)` helper at `domain/components/hook-tool-names.ts` returns Claude-form for 7 Pi tool names; passthrough for any other string | VERIFIED | `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts:143-145`; helper is `(PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[name] ?? name`; unit-tested via `tests/architecture/hooks-tool-name-map.test.ts` (block 4) |
| 2 | 8 `translate(event, ctx): ClaudeStdin` functions exist at `bridges/hooks/payloads/<event>.ts`, exporting a single `translate` symbol each | VERIFIED | `ls payloads/*.ts \| wc -l == 8`; `grep -lE "^export function translate" payloads/*.ts \| wc -l == 8` |
| 3 | PreToolUse / PostToolUse / PostToolUseFailure translators call `mapPiToClaudeToolName(event.toolName)` | VERIFIED | `grep -c mapPiToClaudeToolName payloads/{pre,post}-tool-use*.ts` returns 3+3+3 (each tool translator imports + calls + maps) |
| 4 | `TranslationContext` type + `buildTranslationContext` factory exist with empty-string transcriptPath fallback | VERIFIED | `bridges/hooks/translation-context.ts:34` interface + `:54` factory; transcriptPath uses `ctx.sessionManager.getSessionFile() ?? ""` |
| 5 | `tests/architecture/hooks-translators.test.ts` round-trips one fixture per event; per-event unit tests under `tests/bridges/hooks/payloads/` | VERIFIED | 8 unit tests + 1 architecture test; all green |

#### Plan 60-02 (HookExecResult + parser + ladder + spawn body + _shared mkdir)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | `HookExecResult` 4-arm discriminated union + `assertNever` helper at `bridges/hooks/exec-result.ts` | VERIFIED | `exec-result.ts:39-50` (4 arms: noop, block, mutate, stop with documented field shapes per D-60-01); `:58` assertNever |
| 7 | `parseHookStdout(exitCode, stdout, stderr): HookExecResult` at `bridges/hooks/wire-protocol.ts` maps exit-2 → block; exit-0+empty → noop; exit-0+JSON → mapped; other non-zero/null → noop+debug-log | VERIFIED | `wire-protocol.ts:32` `export function parseHookStdout`; 11-fixture unit test green in `tests/bridges/hooks/wire-protocol.test.ts` |
| 8 | `installTimerLadder(child, timeoutMs)` arms SIGTERM at timeoutMs, SIGKILL at +5s; `.unref()`'d; `cancel()` clears both | VERIFIED | `exec-timer.ts:54`; uses structural `ChildLike` type (no `node:child_process` import per whitelist constraint); 4-behavior unit test green |
| 9 | `dispatchHookExec` returns `Promise<HookExecResult>` and implements (1) translate, (2) prepareEnv with 4 CLAUDE_* vars + CLAUDE_CODE_REMOTE unset, (3) exec/shell-form spawn, (4) 256KB stdin truncation with `_truncated:true`, (5) 1MB/64KB stdout/stderr caps, (6) timer ladder, (7) EPIPE defense, (8) close→parse, never throws | VERIFIED | `dispatch-exec.ts:146-161` (outer body) + `:189-224` buildPayload + `:249-269` serializeWithTruncation + `:275-303` prepareEnv + `:322-336` planSpawn + `:338-461` spawnAndCollect; uses `Buffer.byteLength(..., "utf8")` for cap accounting (CR-02 fix); `grep "throw" dispatch-exec.ts` returns 0 hits |
| 10 | `registerHooksBridge` mkdir-p's `<scopeRoot>/pi-claude-marketplace/data/_shared/` per scope (D-60-06), guarded by `assertPathInside`; idempotent | VERIFIED | `event-router.ts:498-516` `ensureSharedDataDir`; called inside factory loop at `:542-549` (gated on at least one SessionStart entry per WR-05 collision fix noted in phase_context) |
| 11 | `no-shell-out.test.ts` whitelist widened to 2 (git-credential + dispatch-exec); sibling test asserts exactly two files | VERIFIED | `tests/architecture/no-shell-out.test.ts:57-60` Set has both entries; `:112` test name is `"whitelist: exactly two files may import node:child_process"`; `:113-114` asserts 2-element sorted array |
| 12 | `hooks-exec.test.ts` Blocks A-F (EXEC-01..04 + HOOK-05 + D-60-06) GREEN | VERIFIED | Architecture test green in npm run check; all 6 blocks pass via the spawn spy + `t.mock.timers` infrastructure |

#### Plan 60-03 (Reducer + per-Pi-event adapters)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 13 | `event-adapters.ts` exports 4 adapters per D-60-03: `adaptToolCallResult`, `adaptToolResultResult`, `adaptInputResult`, `adaptObservationResult` | VERIFIED | `event-adapters.ts:140` `adaptToolCallResult`, `:183` `adaptToolResultResult`, `:229` `adaptInputResult`, `:271` `adaptObservationResult`; 4 exported functions total |
| 14 | `adaptToolCallResult`: block→`{block:true,reason}`; mutate→applyMutationInPlace+undefined; stop→debug-log+undefined; noop→undefined; assertNever default | VERIFIED | `event-adapters.ts:140-164`; switch covers all 4 kinds + `default: return assertNever(result)` |
| 15 | `adaptToolResultResult`: block→`{isError:true,content:[...]}`; mutate→applyMutationInPlace+undefined; stop→debug-log+undefined; noop→undefined; assertNever default | VERIFIED | `event-adapters.ts:183-216`; block maps to `isError:true` synthetic envelope (documented in JSDoc as bridge convention since Pi `tool_result` has no `block` field) |
| 16 | `adaptInputResult`: block→`{action:"handled"}`; mutate.additionalContext→`{action:"transform",text}`; stop→debug-log+undefined; noop→undefined; assertNever default | VERIFIED | `event-adapters.ts:229-265`; covers all arms |
| 17 | `adaptObservationResult`: block→debug-log+undefined; mutate→undefined; stop→debug-log+undefined; noop→undefined; assertNever default | VERIFIED | `event-adapters.ts:271+`; observation event return type is `undefined` (no Pi return slot) |
| 18 | `dispatch.ts::compositeHandlerFor` rewrites the per-entry loop into a D-60-02 reducer: break on block, break on stop, applyMutationInPlace, assertNever default | VERIFIED | `dispatch.ts:168-244` shows the reducer pattern; `grep -cE "break\b" dispatch.ts` returns multiple matches across 2 reducers |
| 19 | `toolResultCompositeHandler` rewrites with the same reducer; `event.isError` PostToolUse/PostToolUseFailure split happens BEFORE the reducer loop (DISP-01 preserved) | VERIFIED | `dispatch.ts:266` `const claudeEvent: BucketAEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";` precedes the reducer loop |
| 20 | `applyMutationInPlace(event, result)` applies `updatedInput` to `event.input` for tool_call and `updatedToolOutput` to `event.output` for tool_result; observation events no-op | VERIFIED | `event-adapters.ts:77-126`; CR-01 whitelist enforces only `content`/`isError` for tool_result and rejects non-object patches for tool_call |
| 21 | `_setExecutorForTest` / `_resetExecutorForTest` seam preserved; `HookExecutor` widened to `Promise<HookExecResult>` | VERIFIED | `dispatch.ts:86` `=> Promise<HookExecResult>` widens the alias; `:94+` `_setExecutorForTest` seam preserved |
| 22 | `hooks-dispatch.test.ts` Phase 59 invariants preserved: DISP-01..04 + OBS-01 still GREEN with spy return type widened to `Promise.resolve({kind:"noop"})` | VERIFIED | Architecture-test green in npm run check |
| 23 | `hooks-reducer.test.ts` GREEN: first-block-wins, mutate composition, terminal stop, full noop chain, isError split, adapter return shapes | VERIFIED | Architecture-test green in npm run check (Blocks A-F) |
| 24 | `hooks-adapters.test.ts` GREEN: 4 adapters × 4 result arms = 16+ cells, including exhaustiveness gate | VERIFIED | Architecture-test green; CR-01 whitelist regression tests included |

#### Plan 60-04 (REQ amendment + WR-01 + WR-03 + lifecycle pin)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 25 | REQUIREMENTS.md HOOK-05 wording amended per D-60-06: per-session `_shared/claude-env-<sessionId>.env` cross-plugin shared file; bridge sets path only | VERIFIED | `REQUIREMENTS.md:27` contains `per-session scratch file under `<scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env``; `(amended 2026-06-14 per D-60-06)` audit trailer present; `grep "per-hook scratch file"` returns 0 hits |
| 26 | `hydrateProjectScopeForCwd` clears phantom project-arm cache entries before re-hydrate (WR-01) | VERIFIED | `event-router.ts:458-481`; iterates `parsedConfigCache.keys()` with `Array.from()` snapshot (WR-04 hygiene fix), deletes keys starting with `"project\x00"` prefix before the existing re-hydrate logic |
| 27 | `install.ts` calls `rebuildRoutingTables(state, locations)` after `addPluginConfigToCache` inside per-plugin lock | VERIFIED | `install.ts:80` import; `:353` cache add; `:1020` rebuild call (note: SUMMARY notes the line position shifted past the plan-stated 353+ due to the `state.resources.hooks` slug population added in Plan 60-04 to make the state-walk gate find hooks-bearing plugins) |
| 28 | `uninstall.ts` calls `rebuildRoutingTables` after `removePluginConfigFromCache` inside `withLockedStateTransaction` before save | VERIFIED | `uninstall.ts:47` import; `:456` cache remove; `:464` rebuild call (immediately after, before tx.save()) |
| 29 | `reinstall.ts::reinstallPlugin` wires explicit cache remove + add + rebuild inside per-plugin lock (D-60-05 audit closure) | VERIFIED | `reinstall.ts:42-44` imports; `:1114` `removePluginConfigFromCache`; `:1124` `rebuildRoutingTables(tx.state, locations)`; `:1174` `addPluginConfigToCache(...parsed.value)` |
| 30 | `update.ts::updateSinglePlugin` wires explicit cache remove + add + rebuild inside per-plugin lock | VERIFIED | `update.ts:67-69` imports; `:1118` cache remove; `:1128` rebuild; `:1165` cache add |
| 31 | `hooks-lifecycle.test.ts` Wave 0 architecture pin GREEN: WR-01 clear-cache prefix + WR-03 install/uninstall/reinstall/update sites + negative pin Block F | VERIFIED | Architecture test green in npm run check |
| 32 | `event-router.test.ts` WR-01 fixtures GREEN | VERIFIED | Unit test green; fixtures pin clear-cache-on-cwd-change, user-scope untouched |
| 33 | Orchestrator tests (install/uninstall/reinstall/update) extended with WR-03 routing-table fixtures | VERIFIED | All 4 orchestrator tests green; verified via `npm run check` (2100/2100 unit tests pass) |

#### Cross-cutting

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 34 | EXEC-03: zero `ctx.ui.notify` references in `dispatch-exec.ts` and `event-adapters.ts` (stderr → debug-log sole sink) | VERIFIED | `grep "ctx\.ui\.notify"` returns only comment lines documenting the absence: `dispatch-exec.ts:35,442`; no live calls in either file or in `event-adapters.ts` |
| 35 | Never-throws contract: no `throw` statements on runtime paths in `dispatch-exec.ts` | VERIFIED | `grep -nE "throw\b" dispatch-exec.ts` returns 0 hits; the outer try/catch wraps the whole body and resolves `{kind:"noop"}` on any caught error |
| 36 | CLAUDE_CODE_REMOTE intentionally unset (HOOK-05 contract) | VERIFIED | `dispatch-exec.ts:300-302` comment-only; no assignment to `env.CLAUDE_CODE_REMOTE` anywhere in the file |
| 37 | CR-01 mutation whitelist correctly scopes only `content`/`isError` for tool_result and only object-shaped `input` patch for tool_call | VERIFIED | `event-adapters.ts:77-126`; explicit field-by-field whitelist with type guards; non-object patches dropped; primitives/arrays rejected |
| 38 | CR-02 caps measured in UTF-8 bytes via `Buffer.byteLength` at all three sites (stdin truncation, stdout cap, stderr cap) | VERIFIED | `dispatch-exec.ts:251` (stdin), `:493` (stream accumulator covering stdout+stderr); CJK regression test added per `60-REVIEW-FIX.md:64` |
| 39 | `platform/pi-api.ts` re-exports `InputEventResult`, `ToolCallEventResult`, and structural `ToolResultEventResult` + `PiTextContentBlock` (peer-dep export gap workaround) | VERIFIED | `pi-api.ts:22,28` direct re-exports; `:42` `PiTextContentBlock`; `:59` structural `ToolResultEventResult` interface |
| 40 | All Phase 57/58/59 architecture pins remain GREEN (no regression) | VERIFIED | `tests/architecture/hooks-{foundation,supportability,dispatch,tool-name-map}.test.ts` green inside the full 2100-test run |
| 41 | `npm run check` GREEN end-to-end | VERIFIED | 2100 unit-test passes + 10 integration-test passes; 0 failures |

**Score:** 41/41 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` | `mapPiToClaudeToolName` helper added | VERIFIED | Helper at line 143-145; const map unchanged |
| `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` | NEW: TranslationContext type + factory | VERIFIED | 34/54 export interface + factory; empty-string transcriptPath fallback |
| `extensions/pi-claude-marketplace/bridges/hooks/payloads/*.ts` | NEW: 8 translators | VERIFIED | 8 files, each exporting `translate`; 3 tool translators import `mapPiToClaudeToolName` |
| `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts` | NEW: HookExecResult union + assertNever | VERIFIED | 4-arm union; assertNever throws-as-never helper |
| `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts` | NEW: parseHookStdout | VERIFIED | Function exported; 11-fixture unit test |
| `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` | NEW: installTimerLadder | VERIFIED | Structural ChildLike type avoids whitelist breach; SIGTERM→5s→SIGKILL ladder |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` | MODIFIED: body filled, returns Promise<HookExecResult> | VERIFIED | Signature evolved; 508 lines covering translate + env + spawn + ladder + parse |
| `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` | NEW: 4 adapters + applyMutationInPlace | VERIFIED | 4 adapters with CR-01 whitelist; applyMutationInPlace exported |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` | MODIFIED: reducer + adapter wiring | VERIFIED | HookExecutor type widened; per-entry break-on-block/stop; per-event adapter dispatch |
| `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | MODIFIED: WR-01 clear-cache prefix + _shared mkdir | VERIFIED | WR-01 at line 458-481; ensureSharedDataDir at line 506-516 (gated on SessionStart entries) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/{install,uninstall,reinstall,update}.ts` | MODIFIED: rebuildRoutingTables wiring | VERIFIED | All 4 files import + call rebuildRoutingTables inside per-plugin lock |
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | MODIFIED: re-export Pi handler result types | VERIFIED | InputEventResult/ToolCallEventResult direct re-exports + structural ToolResultEventResult |
| `tests/architecture/hooks-{translators,exec,reducer,adapters,lifecycle}.test.ts` | NEW: 5 architecture pins | VERIFIED | All 5 files exist and green |
| `tests/architecture/no-shell-out.test.ts` | MODIFIED: whitelist widened to 2 | VERIFIED | Test renamed to "exactly two files"; ALLOWED_CHILD_PROCESS_FILES has 2 entries |
| `tests/architecture/hooks-dispatch.test.ts` | MODIFIED: spy returns Promise<HookExecResult> | VERIFIED | Phase 59 invariants preserved; spy return widened |
| `tests/architecture/hooks-tool-name-map.test.ts` | MODIFIED: Block 4 helper tests added | VERIFIED | Helper exercise added to Phase 58 baseline |
| `tests/bridges/hooks/{wire-protocol,exec-timer,translation-context}.test.ts` | NEW: 3 unit-test files | VERIFIED | All exist and green |
| `tests/bridges/hooks/payloads/*.test.ts` | NEW: 8 per-event tests | VERIFIED | 8 files exist and green |
| `tests/bridges/hooks/dispatch-exec.test.ts` | MODIFIED: 14 behavior tests added | VERIFIED | Extended from Phase 59 stub; all 14 behaviors covered |
| `tests/bridges/hooks/event-router.test.ts` | MODIFIED: WR-01 fixtures added | VERIFIED | 3 WR-01 fixtures green |
| `tests/orchestrators/plugin/*.test.ts` | MODIFIED: WR-03 routing-table fixtures | VERIFIED | All 4 extended; routing-table introspection asserts pre/post orchestrator state |
| `.planning/REQUIREMENTS.md` | MODIFIED: HOOK-05 amended per D-60-06 | VERIFIED | New wording present; audit-trail trailer present; HOOK row count preserved (6) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bridges/hooks/dispatch.ts` | `bridges/hooks/event-adapters.ts` | per-event adapter invocation at composite-handler exit | WIRED | 5 import lines (4 adapter functions + applyMutationInPlace) |
| `bridges/hooks/dispatch.ts` | `bridges/hooks/exec-result.ts` | HookExecResult + assertNever | WIRED | Import at dispatch.ts:51; used in reducer + adapter dispatch |
| `bridges/hooks/dispatch-exec.ts` | `bridges/hooks/payloads/*.ts` | 8-event TRANSLATORS dispatch table | WIRED | All 8 translators imported and routed by `entry.claudeEvent` |
| `bridges/hooks/dispatch-exec.ts` | `bridges/hooks/wire-protocol.ts` | parseHookStdout call on close | WIRED | Called at dispatch-exec.ts:447 |
| `bridges/hooks/dispatch-exec.ts` | `bridges/hooks/exec-timer.ts` | installTimerLadder | WIRED | Called at dispatch-exec.ts:360 and re-armed on overflow at :404 |
| `bridges/hooks/dispatch-exec.ts` | `shared/debug-log.ts` | hookDebugLog (sole runtime diagnostic seam) | WIRED | Multiple call sites (stderr, overflow, EPIPE, error, spawn failure) |
| `bridges/hooks/dispatch-exec.ts` | `shared/path-safety.ts` | assertPathInside for CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA / CLAUDE_ENV_FILE | WIRED | 3 calls in prepareEnv (lines 282, 285, 296) |
| `bridges/hooks/event-router.ts::registerHooksBridge` | `shared/path-safety.ts` | assertPathInside for _shared dir | WIRED | ensureSharedDataDir at line 509 |
| `bridges/hooks/event-adapters.ts` | `bridges/hooks/exec-result.ts` | switch over result.kind | WIRED | All 4 adapters switch on `result.kind` with assertNever default |
| `bridges/hooks/event-adapters.ts` | `shared/debug-log.ts` | hookDebugLog for ignored stop/block | WIRED | 4+ call sites across the adapters |
| `orchestrators/plugin/install.ts` | `bridges/hooks/index.ts::rebuildRoutingTables` | call inside per-plugin lock after addPluginConfigToCache | WIRED | install.ts:80 import; :1020 call |
| `orchestrators/plugin/uninstall.ts` | `bridges/hooks/index.ts::rebuildRoutingTables` | call inside withLockedStateTransaction after removePluginConfigFromCache | WIRED | uninstall.ts:47 import; :464 call (before tx.save) |
| `orchestrators/plugin/reinstall.ts` | `bridges/hooks/index.ts::rebuildRoutingTables` | explicit cache remove+add+rebuild | WIRED | reinstall.ts:43 import; :1114 remove + :1124 rebuild + :1174 add |
| `orchestrators/plugin/update.ts` | `bridges/hooks/index.ts::rebuildRoutingTables` | explicit cache remove+add+rebuild | WIRED | update.ts:68 import; :1118 remove + :1128 rebuild + :1165 add |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `dispatchHookExec` | `child` (ChildProcess) | `activeSpawn(command, args, opts)` with real env + cwd + shell | YES — spawns a real OS process | FLOWING |
| `dispatchHookExec` | `stdout` / `stderr` accumulators | `StringDecoder` over `child.stdout/stderr` `"data"` events | YES — UTF-8 byte-accurate accumulation with caps | FLOWING |
| `dispatchHookExec` | `parseHookStdout(code, stdout, stderr)` | maps wire protocol per docs/research/claude-hook-config-syntax.md §4 | YES — handles 11 result shapes (exit 2, JSON variants, signal kill) | FLOWING |
| `compositeHandlerFor` | `finalResult: HookExecResult` | folded from per-entry `await activeExecutor(entry, event, ctx)` | YES — reducer folds across bucket with break-on-block/stop | FLOWING |
| `adaptToolCallResult` | `event.input` mutation | `applyMutationInPlace` writes hook-supplied patch (whitelisted) | YES — visible to next entry in left-to-right composition | FLOWING |
| `prepareEnv` | `env.CLAUDE_ENV_FILE` (SessionStart only) | `<dataRoot>/_shared/claude-env-<sessionId>.env` from TranslationContext | YES — sessionId from `ctx.sessionManager.getSessionId()` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full check passes (typecheck + lint + format + 2100 unit + 10 integration) | `npm run check` | All green; 0 failures | PASS |
| 8 payload translator files exist | `ls payloads/*.ts \| wc -l` | 8 | PASS |
| 8 translators export `translate` symbol | `grep -lE "^export function translate" payloads/*.ts \| wc -l` | 8 | PASS |
| Architecture pins green (translators, exec, reducer, adapters, lifecycle, no-shell-out) | `node --test tests/architecture/hooks-*.test.ts tests/architecture/no-shell-out.test.ts` | 79 tests pass | PASS |
| `node:child_process` whitelist contains exactly 2 entries | `grep -c "extensions/pi-claude-marketplace" no-shell-out.test.ts \| wc` | Set has 2 entries + assertion pins 2 | PASS |
| HOOK-05 row count preserved | `grep -c "^- \[.\] \*\*HOOK-" REQUIREMENTS.md` | 6 (unchanged) | PASS |
| No debt markers (TBD/FIXME/XXX) in modified files | `grep -nE "TBD\|FIXME\|XXX" <modified-files>` | 0 hits | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXEC-01 | 60-02 | Spawn with cwd snapshot + env merge (process.env + CLAUDE_* + PI_*) | SATISFIED | dispatch-exec.ts:275-303 prepareEnv + :347 spawn invocation; REQUIREMENTS.md line 55 marked [x] |
| EXEC-02 | 60-02 | SIGTERM→5s→SIGKILL ladder; 1MB stdout cap; 256KB stdin truncation with `_truncated:true` marker | SATISFIED | exec-timer.ts ladder + dispatch-exec.ts:249-269 serializeWithTruncation + accumulateStream byte caps; REQUIREMENTS.md line 56 marked [x] |
| EXEC-03 | 60-02 | Hook stderr is debug-logged only — never routed through `ctx.ui.notify` at runtime | SATISFIED | dispatch-exec.ts:442 stderr→hookDebugLog; 0 `ctx.ui.notify` live references in dispatch-exec.ts and event-adapters.ts; REQUIREMENTS.md line 57 marked [x] |
| EXEC-04 | 60-02 | `args !== undefined` → exec-form; default shell-form; `shell` field selects binary | SATISFIED | dispatch-exec.ts:322-336 planSpawn discriminates on `Array.isArray(argsField)`; `args: []` is exec-form; REQUIREMENTS.md line 58 marked [x] |
| PAYL-01 | 60-01 | 8 bucket-A translators round-trip with TOOL-01 mapping on the 3 tool events | SATISFIED | 8 files under payloads/; 3 tool translators import + call mapPiToClaudeToolName; per-event + architecture round-trip tests green; REQUIREMENTS.md line 63 marked [x] |
| HOOK-05 | 60-02 (impl) + 60-04 (REQ wording) | 4 CLAUDE_* env vars including `CLAUDE_ENV_FILE` from `_shared/`; CLAUDE_CODE_REMOTE unset; bridge sets path only | SATISFIED | dispatch-exec.ts:287-302 prepareEnv; event-router.ts:506-516 mkdir-p `_shared`; REQUIREMENTS.md line 27 amended with D-60-06 wording + audit trailer; marked [x] |

All 6 plan-declared requirements are SATISFIED. No orphaned requirements.

### Anti-Patterns Found

None. Specifically:
- 0 debt markers (TBD/FIXME/XXX) in the 14 modified-source-file fingerprint
- 0 `ctx.ui.notify` references on runtime paths in dispatch-exec.ts or event-adapters.ts (EXEC-03)
- 0 `throw` statements on runtime paths in dispatch-exec.ts (never-throws contract)
- 0 `CLAUDE_CODE_REMOTE` assignments (HOOK-05 unset contract)
- 0 silent whitelist additions for `node:child_process` (architecture pin enforces exactly two files)

### Carry-Forward Items (Informational)

These are documented in `60-REVIEW-FIX.md` as "Out-of-Scope Info Findings" (fix_scope was `critical_warning`). They do not affect the phase goal.

| ID | Description | Disposition |
|----|-------------|-------------|
| IN-01 | stderr ledger formatting (debug log truncation suggestion) | Polish; phase 61+ if at all |
| IN-02 | `compositeHandlerFor` early-exit `as CompositeReturnFor<E>` cast documentation | Type-narrowing comment polish |
| IN-03 | magic-string `"tool_call"` / `"tool_result"` literals in event-adapters | Could lift to named constants; not load-bearing |
| IN-04 | `serializeWithTruncation` re-check-against-cap doc note | Marker overshoot already documented in JSDoc; finding is informational |

### Human Verification Required

None. The phase goal is verifiable from the codebase + architecture pins + the 2100-test unit suite + the 10-test integration suite. No UI flows, real-time behaviors, or external services are involved — the hook child process integration is exercised via spawn-spy + `t.mock.timers` infrastructure that covers EXEC-01..04 + HOOK-05 + PAYL-01 + D-60-01..06 invariants.

### Gaps Summary

No gaps. All 41 truths verified; all 6 requirements satisfied; all 6 D-60 decisions closed; both Phase 59 carry-forward review findings (WR-01, WR-03) closed; all 9 critical+warning code-review findings fixed; the 4 remaining info findings (IN-01..04) are documented as informational polish out of the critical_warning fix scope. `npm run check` is green end-to-end.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_

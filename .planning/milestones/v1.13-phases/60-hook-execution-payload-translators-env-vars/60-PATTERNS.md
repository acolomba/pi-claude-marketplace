# Phase 60: Hook Execution, Payload Translators & Env Vars - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 16 new/modified
**Analogs found:** 14 / 16 (2 greenfield with no direct analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bridges/hooks/dispatch-exec.ts` | bridge | request-response (spawn) | `platform/git-credential.ts` (spawn pattern) | exact-shape |
| `bridges/hooks/wire-protocol.ts` (NEW, optional) | utility | transform | `domain/components/hooks.ts` (discriminated parser result) | role-match |
| `bridges/hooks/exec-result.ts` (NEW) | type module | — | `domain/components/hooks.ts` `ParsedMatcher` discriminated union | role-match |
| `bridges/hooks/exec-timer.ts` (NEW, optional) | utility | event-driven | `platform/git-credential.ts:101-105` (setTimeout/unref/SIGTERM) | partial-match |
| `bridges/hooks/translation-context.ts` (NEW, optional) | utility | — | inline type in `bridges/hooks/event-router.ts` (`HydratedScope`) | partial-match |
| `bridges/hooks/payloads/{8 files}.ts` (NEW) | bridge | transform | (no direct analog — closest: `domain/components/hooks.ts::parseMatcher` pure-data leaf) | greenfield |
| `bridges/hooks/event-adapters.ts` (NEW) | bridge | transform | `bridges/hooks/dispatch.ts::entryFires` (switch over discriminator) | role-match |
| `bridges/hooks/dispatch.ts` (MODIFIED) | bridge | event-driven | self (Phase 59 baseline) | exact |
| `bridges/hooks/event-router.ts` (MODIFIED) | bridge | event-driven | self (Phase 59 baseline) | exact |
| `bridges/hooks/index.ts` (MAYBE MODIFIED) | barrel | — | self | exact |
| `orchestrators/plugin/install.ts` (MODIFIED, WR-03) | orchestrator | CRUD | self — line 353 cache add | exact |
| `orchestrators/plugin/uninstall.ts` (MODIFIED, WR-03) | orchestrator | CRUD | self — line 456 cache remove | exact |
| `orchestrators/plugin/reinstall.ts` (AUDIT) | orchestrator | CRUD | self / install.ts | exact |
| `orchestrators/plugin/update.ts` (AUDIT) | orchestrator | CRUD | self / install.ts | exact |
| `domain/components/hook-tool-names.ts` (MAYBE ADD helper) | domain | — | self — existing `PI_TO_CLAUDE_TOOL_NAMES` const | exact |
| `tests/architecture/hooks-exec*.test.ts` (NEW, 5 files or 1) | test | — | `tests/architecture/hooks-dispatch.test.ts` (per-block layout) | exact |
| `tests/bridges/hooks/wire-protocol.test.ts` (NEW) | test | — | `tests/bridges/hooks/dispatch-exec.test.ts` (unit shape) | role-match |

## Pattern Assignments

### `bridges/hooks/dispatch-exec.ts` (MODIFIED — body filled)

**Analog A (spawn shape):** `extensions/pi-claude-marketplace/platform/git-credential.ts`

**Imports pattern** (lines 36):
```typescript
import { spawn } from "node:child_process";
```
NOTE per CR-comment at git-credential.ts:9 — that file is the **whitelisted** `child_process` site under tests/architecture/no-shell-out.test.ts. Phase 60 adds `bridges/hooks/dispatch-exec.ts` as a second whitelisted site; the architecture test must be amended in lockstep.

**Spawn + env merge pattern** (git-credential.ts:83-90):
```typescript
const child = spawn("git", ["credential", subcommand], {
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
  },
  stdio: ["pipe", "pipe", "pipe"],
});
```
Phase 60 substitutes `entry.handlerDecl.command + entry.handlerDecl.args` (or `shell: true` if `args === undefined` per EXEC-04) and merges `{...process.env, CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, ...(SessionStart ? {CLAUDE_ENV_FILE} : {})}`.

**Manual buffer accumulation pattern** (git-credential.ts:92-99):
```typescript
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk: Buffer) => {
  stdout += chunk.toString("utf8");
});
child.stderr.on("data", (chunk: Buffer) => {
  stderr += chunk.toString("utf8");
});
```
Phase 60 extends with a size-cap arm per RESEARCH Pitfall 4 (1MB stdout / 64KB stderr; on overflow set `overflowed=true`, call `child.kill("SIGTERM")`, hookDebugLog).

**Timer + unref pattern** (git-credential.ts:101-105):
```typescript
const timer = setTimeout(() => {
  child.kill("SIGTERM");
  reject(new Error(`git credential ${subcommand} timed out after ${timeoutMs}ms`));
}, timeoutMs);
timer.unref();
```
Phase 60 extends to **two** timers (SIGTERM at `timeoutMs`, SIGKILL at `timeoutMs + 5000`); both `.unref()`; both cleared on `close`/`error` per RESEARCH Pattern 3 and Pitfall 2 (cancel immediately on `exit` to avoid TOCTOU race against fast natural exit).

**Close/error wiring + stdin discipline** (git-credential.ts:107-122):
```typescript
child.on("error", (err) => {
  clearTimeout(timer);
  reject(err);
});
child.on("close", (code) => {
  clearTimeout(timer);
  resolve({ stdout, stderr, code: code ?? -1 });
});
// Swallow EPIPE: ...
child.stdin.on("error", () => {});
child.stdin.write(input);
child.stdin.end();
```
Phase 60 substitutes: NEVER `reject` — always resolve to `HookExecResult` (never-throws contract per RESEARCH anti-pattern "Throwing from inside the composite handler"). Stdin write uses `child.stdin.end(payload)` (one call per RESEARCH Pitfall 3 to avoid split-write EPIPE).

**Never-throws contract** — divergence from analog:
git-credential.ts rejects on error/timeout. Phase 60's `dispatchHookExec` MUST resolve `{ kind: "noop" }` on every failure path (spawn ENOENT, timeout, EPIPE, buffer overflow, JSON parse failure) and route the detail through `hookDebugLog` (D-59-05). Reference: CONTEXT.md `<code_context>` line 469 "debug-log seam" and RESEARCH § Anti-Patterns.

---

### `bridges/hooks/exec-result.ts` (NEW)

**Analog:** `domain/components/hooks.ts::ParsedMatcher` (discriminated union by `kind` over `match-all | tool-set | mcp-literal | regex | unmapped`)

Pattern: same shape as `ParsedMatcher` — flat discriminated union with `kind: "noop" | "block" | "mutate" | "stop"` per CONTEXT.md D-60-01 exact-quoted union. `assertNever` helper mirrors NFR-7 (the `installable: true | false` exhaustiveness pattern). Pure leaf module — no imports, no module state.

---

### `bridges/hooks/payloads/<event>.ts` (NEW × 8) — translators

**Analog:** none direct. Closest is `domain/components/hooks.ts::parseMatcher` (pure-data leaf). RESEARCH § Pattern 4 provides the canonical shape (lines 370-401 of RESEARCH.md).

**Imports pattern (per RESEARCH § Pattern 4):**
```typescript
import { PI_TO_CLAUDE_TOOL_NAMES } from "../../../domain/components/hook-tool-names.ts";
import type { ToolCallEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";
```

**Translator function shape:**
```typescript
export function translate(
  event: ToolCallEvent,
  ctx: TranslationContext,
): PreToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreToolUse",
    tool_name: (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[event.toolName] ?? event.toolName,
    tool_input: event.input,
  };
}
```

**Tool-name lookup (RESEARCH § "Pi → Claude tool-name lookup", lines 752-774):**
- For PreToolUse / PostToolUse / PostToolUseFailure only.
- RESEARCH recommends adding a thin helper `mapPiToClaudeToolName(name: string): string` colocated with `PI_TO_CLAUDE_TOOL_NAMES` so all three tool translators share one test surface. Add to `domain/components/hook-tool-names.ts`:
```typescript
export function mapPiToClaudeToolName(name: string): string {
  return (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[name] ?? name;
}
```
Pitfall 1 (RESEARCH lines 498-516): `event.toolName` is `string` for `CustomToolCallEvent` arm — the `??` fallback is load-bearing.

**Per-translator field maps:** read from `docs/research/claude-hook-config-syntax.md § 3` (named in CONTEXT.md canonical_refs).

---

### `bridges/hooks/event-adapters.ts` (NEW)

**Analog:** `bridges/hooks/dispatch.ts::entryFires` (lines 207-229)

**Switch-over-discriminator pattern** (dispatch.ts:212-228):
```typescript
function entryFires(
  claudeEvent: Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">,
  entry: RoutingEntry,
  event: unknown,
): boolean {
  switch (claudeEvent) {
    case "SessionStart": { ... }
    case "PreToolUse": { ... }
    case "SessionEnd":
    case "PreCompact":
    case "PostCompact":
    case "UserPromptSubmit":
      return true;
  }
}
```

Phase 60 adapter shape (RESEARCH § Pattern 5, lines 411-433):
```typescript
export function adaptToolCallResult(
  result: HookExecResult,
  event: ToolCallEvent,
): { block: true; reason?: string } | undefined {
  switch (result.kind) {
    case "block": return { block: true, reason: result.reason };
    case "stop":
      hookDebugLog(`adapter: PreToolUse stop ignored; reason=${result.stopReason}`);
      return undefined;
    case "mutate":
      if (result.updatedInput !== undefined) {
        Object.assign(event.input as Record<string, unknown>, result.updatedInput);
      }
      return undefined;
    case "noop": return undefined;
    default: return assertNever(result);
  }
}
```
Per-Pi-event adapter table per CONTEXT.md D-60-03.

---

### `bridges/hooks/dispatch.ts` (MODIFIED — reducer loop)

**Analog:** self — Phase 59 baseline at lines 125-143 (composite handler factory).

**Existing pattern to preserve** (dispatch.ts:125-143):
```typescript
return async (event, ctx) => {
  if (capturedEpoch !== currentEpoch()) return;
  const bucket = getRoutingBucket(claudeEvent);
  if (bucket.length === 0) return;
  for (const entry of bucket) {
    if (!entryFires(claudeEvent, entry, event)) continue;
    await activeExecutor(entry, event, ctx);
  }
};
```

**Phase 60 reducer rewrite (CONTEXT.md D-60-02 + RESEARCH § "Sequential-await reducer template" lines 779-801):**
```typescript
let finalResult: HookExecResult = { kind: "noop" };
for (const entry of bucket) {
  if (!entryFires(claudeEvent, entry, event)) continue;
  const r = await activeExecutor(entry, event, ctx);
  if (r.kind === "block") { finalResult = r; break; }
  if (r.kind === "stop") { finalResult = r; break; }
  if (r.kind === "mutate") { applyMutationInPlace(event, r); }
}
return adapter(finalResult, event);
```

The `_setExecutorForTest` / `_resetExecutorForTest` indirection seam (dispatch.ts:48-66) is preserved — Phase 60 just changes the executor's return type from `Promise<void>` to `Promise<HookExecResult>`. Per CONTEXT.md `<canonical_refs>` line 360 (D-59-04 signature evolution).

---

### `bridges/hooks/event-router.ts` (MODIFIED — WR-01 + `_shared` mkdir)

**Analog:** self — Phase 59 baseline.

**WR-01 fix site:** `hydrateProjectScopeForCwd` (event-router.ts:449-463). Add ~5 LOC clear-cache prefix that removes any project-scope cache entries hydrated under the wrong (homedir-based) cwd at factory time, BEFORE re-hydrating.

**`_shared` mkdir-p site:** `registerHooksBridge` (event-router.ts:481-500). Pattern to follow — same `assertPathInside` containment guard pattern as `tryHydrateOnePlugin` (event-router.ts:387-394):
```typescript
try {
  await assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path");
} catch (err) {
  hookDebugLog(`hydrate: containment violation ...`);
  return;
}
```
For `_shared`: compute `path.join(loc.dataRoot, "_shared")`, `assertPathInside(loc.dataRoot, sharedDir, "_shared data dir")`, then `mkdir(sharedDir, { recursive: true })`. Idempotent — safe across `/reload`. Per CONTEXT.md D-60-06 + RESEARCH Pitfall 8.

---

### `orchestrators/plugin/install.ts` (MODIFIED — WR-03 rebuild call)

**Analog:** self at install.ts:353 (existing `addPluginConfigToCache` call site inside the ledger).

**Existing cache-add site** (install.ts:353):
```typescript
addPluginConfigToCache(scope, marketplace, plugin, parsed.value);
```

**Phase 60 addition (WR-03):** import `rebuildRoutingTables` from `bridges/hooks/index.ts` (it's already exported per index.ts:13-19), and call **immediately after** `addPluginConfigToCache(...)` inside the same per-plugin lock's stage commit, passing `(state, locations)`. The reconcile-driven call site at `orchestrators/reconcile/apply.ts:895` is the existing precedent — same call shape, same lock context.

---

### `orchestrators/plugin/uninstall.ts` (MODIFIED — WR-03 rebuild call)

**Analog:** self at uninstall.ts:456 (existing `removePluginConfigFromCache` call site inside `withLockedStateTransaction`).

**Existing cache-remove site** (uninstall.ts:444-456):
```typescript
delete mp.plugins[plugin];
// ... comment ...
removePluginConfigFromCache(scope, marketplace, plugin);
```

**Phase 60 addition:** import `rebuildRoutingTables` and call **immediately after** `removePluginConfigFromCache(...)` with `(tx.state, locations)`. Inside the same lock's commit block, BEFORE `tx.save()`.

---

### `orchestrators/plugin/reinstall.ts` (AUDIT) / `update.ts` (AUDIT)

**Analog:** install.ts:353 + uninstall.ts:456.

Per RESEARCH Pitfall 10 (lines 676-694): these orchestrators do NOT delegate to `installPlugin` / `uninstallPlugin`. Their own `withLockedStateTransaction` flows (reinstall.ts:229, update.ts at `updateSinglePlugin`) need **explicit** wiring: `addPluginConfigToCache` + `rebuildRoutingTables` (or `removePluginConfigFromCache` + `rebuildRoutingTables`) inside the per-plugin lock, mirroring the install/uninstall add/remove sequence. Estimated <30 LoC each per RESEARCH.

---

### `domain/components/hook-tool-names.ts` (MAYBE — add helper)

**Analog:** self at lines 77-88 (existing const map).

Add `mapPiToClaudeToolName` helper colocated with the const so all three tool translators (PreToolUse / PostToolUse / PostToolUseFailure) share one tested call site:
```typescript
export function mapPiToClaudeToolName(name: string): string {
  return (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[name] ?? name;
}
```
Planner discretion — Researcher confirmed this helper does NOT currently exist; CONTEXT.md D-60-04 inline example assumed it.

---

### `tests/architecture/hooks-exec*.test.ts` (NEW)

**Analog:** `tests/architecture/hooks-dispatch.test.ts` (Phase 59 baseline; per-block layout).

**Per-block heading pattern** (hooks-dispatch.test.ts:64-67, 195-198, 263-266, 293-296, 378-381, 416-419, 487-490, 583-586):
```typescript
// ──────────────────────────────────────────────────────────────────────────
// Block N: REQ-ID / D-NN-NN — short description
// ──────────────────────────────────────────────────────────────────────────
```

**Mock Pi factory** (hooks-dispatch.test.ts:73-88 — `makePiMock`).

**Hermetic env wrapper** (hooks-dispatch.test.ts:205-260 — WR-04 HOME/PI_CODING_AGENT_DIR isolation; required when invoking `registerHooksBridge`).

**Executor spy injection via `_setExecutorForTest` / `_resetExecutorForTest`** (hooks-dispatch.test.ts:386-392):
```typescript
const fired: string[] = [];
_setExecutorForTest((entry) => {
  fired.push(entry.pluginId);
  return Promise.resolve();
});
t.after(() => { _resetExecutorForTest(); });
```
Phase 60 evolves the spy return type to `Promise<HookExecResult>` (returns `{ kind: "noop" }` or whatever the test pins).

**Synthetic routing-bucket injection** (hooks-dispatch.test.ts:394, 435-436): `_setRoutingBucketForTest("PreToolUse", [makeEntry({pluginId: "p1"})])` — Phase 60 reducer tests follow this exact pattern for first-block-wins / mutate-composition / per-event adapter invariants per CONTEXT.md `<decisions>` D-60-02 + D-60-03.

Planner discretion (CONTEXT.md `<decisions>` Claude's Discretion bullet 6): one file vs split across 5 (`hooks-exec.test.ts`, `hooks-translators.test.ts`, `hooks-reducer.test.ts`, `hooks-adapters.test.ts`, `hooks-lifecycle.test.ts`). Per-block layout in either case.

---

### `tests/bridges/hooks/wire-protocol.test.ts` (NEW unit test)

**Analog:** `tests/bridges/hooks/dispatch-exec.test.ts` (Phase 59 unit-test shape).

Same import layout, same minimal stubs. The wire-protocol parser is a pure function `(exitCode, stdout, stderr) → HookExecResult` so the tests are table-driven `for (const fixture of fixtures)` — pattern follows `dispatch-exec.test.ts:35-40`.

---

## Shared Patterns

### Debug-log seam (OBS-01 / D-59-05)

**Source:** `extensions/pi-claude-marketplace/shared/debug-log.ts`
**Apply to:** ALL Phase 60 code paths (dispatch-exec, wire-protocol, exec-timer, event-adapters, payload translators, lifecycle hardening). Every error/failure/diagnostic path resolves silently AND emits one `hookDebugLog(detail)` call. NEVER `console.error` directly, NEVER `ctx.ui.notify` for runtime hook diagnostics (IL-2 / EXEC-03).

```typescript
import { hookDebugLog } from "../../shared/debug-log.ts";
// ...
hookDebugLog(`wire-protocol: non-zero exit ${exitCode}; treating as noop. stderr=${stderr.slice(0, 200)}`);
```

### Containment guard (NFR-10)

**Source:** `extensions/pi-claude-marketplace/shared/path-safety.ts::assertPathInside`
**Apply to:** `_shared` data-dir creation in `registerHooksBridge`, `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` path construction in `dispatch-exec.ts` env-prep step.

Pattern (lifted from event-router.ts:388):
```typescript
await assertPathInside(loc.dataRoot, sharedDir, "_shared data dir");
```

### Discriminated-union exhaustiveness (NFR-7)

**Source:** `domain/components/hooks.ts::ParsedMatcher` and `dispatch.ts:79-91` (`matcherFiresOnToolEvent` switch over `matcher.kind`).
**Apply to:** `HookExecResult` consumers (wire-protocol parser, reducer loop, per-event adapters). `switch (result.kind)` + `default: assertNever(result)`.

### Sequential awaited fan-out (DISP-04)

**Source:** `bridges/hooks/dispatch.ts:135-141` (existing `for (const entry of bucket) { await activeExecutor(...) }`).
**Apply to:** Phase 60 reducer loop preserves the same `for...of`/`await` shape. NO `Promise.all`. Architecture-test invariant carries forward.

### `withLockedStateTransaction` (WR-03 wiring)

**Source:** `transaction/with-state-guard.ts` and the existing call sites at `install.ts` (PI-15 ledger) and `uninstall.ts:444-456`.
**Apply to:** `rebuildRoutingTables` calls inside install.ts / uninstall.ts / reinstall.ts / update.ts must sit **inside** the existing per-plugin lock, AFTER the cache add/remove but BEFORE `tx.save()` (uninstall pattern at uninstall.ts:447-456 is the model).

### Comment policy (`.claude/rules/typescript-comments.md`)

Source comments and test titles use REQ-IDs (`EXEC-01`, `PAYL-01`, `HOOK-05`, `OBS-01`), decision IDs (`D-60-01..06`, `D-59-04`), and warning IDs (`WR-01`, `WR-03`). NEVER `Phase 60`, `Plan N`, `Pitfall N`, `Pattern N` in source — those tokens are planning-artifact metadata. CONTEXT.md `<code_context>` line 516 is the explicit reminder.

### Architecture-test whitelist amendment (no-shell-out)

**Source:** `tests/architecture/no-shell-out.test.ts` (referenced at `platform/git-credential.ts:9-11`).
**Apply to:** the test currently whitelists `platform/git-credential.ts` as the SOLE `node:child_process` import site. Phase 60 adds `bridges/hooks/dispatch-exec.ts` as the second sanctioned site — the test's expected-set must be amended in the same plan that fills the exec body, or the architecture test red-fails CI.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `bridges/hooks/payloads/*.ts` (8 translators) | bridge | transform | First per-event payload-transform layer in the codebase. No prior `(event, ctx) → wire-payload` pattern exists. RESEARCH § Pattern 4 is the authoritative shape; no codebase analog. |
| `bridges/hooks/exec-timer.ts` (optional helper) | utility | event-driven | The closest is git-credential.ts's single-timer pattern; the two-stage SIGTERM→SIGKILL ladder is novel. RESEARCH § Pattern 3 is canonical. |

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/bridges/hooks/` (Phase 59 baseline)
- `extensions/pi-claude-marketplace/platform/` (spawn analog)
- `extensions/pi-claude-marketplace/domain/components/` (parser + tool-name + discriminated union shapes)
- `extensions/pi-claude-marketplace/orchestrators/plugin/` (WR-03 fix sites)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (rebuildRoutingTables precedent call)
- `extensions/pi-claude-marketplace/shared/{debug-log,path-safety,errors,notify}.ts` (cross-cutting reuse)
- `tests/architecture/hooks-dispatch.test.ts` (per-block test layout)
- `tests/bridges/hooks/{dispatch-exec,event-router}.test.ts` (unit test shape)

**Files scanned:** ~25
**Pattern extraction date:** 2026-06-14

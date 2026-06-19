---
phase: 60-hook-execution-payload-translators-env-vars
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
  - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - tests/architecture/hooks-exec.test.ts
  - tests/architecture/no-shell-out.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
  - tests/bridges/hooks/exec-timer.test.ts
  - tests/bridges/hooks/wire-protocol.test.ts
  - tests/bridges/hooks/payloads/pre-tool-use.test.ts
  - tests/bridges/hooks/payloads/post-tool-use.test.ts
  - tests/bridges/hooks/payloads/session-start.test.ts
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 60 wires the hook execution layer, the eight per-event payload translators, the HOOK-05 env-var contract, the `_shared` session-env-file plumbing, the D-60-01 discriminated outcome union, the D-60-02 reducer, the per-Pi-event adapters, and the WR-01 / WR-03 cache+routing-table refresh hooks in the four plugin orchestrators. The architectural invariants are exercised by a broad architecture-test sweep (`tests/architecture/hooks-*.test.ts`) and a per-payload + dispatch-exec + wire-protocol unit suite.

The implementation is mostly correct against its contract. Two BLOCKERS sit in the wire-protocol → mutate-apply path: (CR-01) the `tool_result` mutation arm spreads arbitrary hook-supplied JSON over the whole Pi event object (not the documented `content` / `tool_response` slot), letting a hook silently rewrite `event.type`, `event.toolName`, `event.isError`, etc. Concrete impact: a subsequent same-bucket entry's translator and the downstream Pi `tool_result` adapter both consume the corrupted event. (CR-02) The stream cap accounting uses `text.length` (UTF-16 code units) against limits named `_BYTES`, so a hook emitting multi-byte UTF-8 can either bypass the cap up to a 3-4× factor (Latin / CJK code points) or over-fire it for surrogate pairs; the named "1 MB / 64 KB" guarantee is not what the code measures.

Seven WARNINGs sit in resource-management adjacencies (stream listeners stay attached after overflow; the overflow kill path skips the SIGKILL escalation ladder; chunk-boundary UTF-8 decoding can produce replacement chars; the truncation marker can be silently overridden by a payload field named `_truncated`; a stale-event-shape cast can drop required Claude fields silently; `Map` mutation during iteration in `hydrateProjectScopeForCwd`; and rebuild ordering in the install closure can race a closure-throw between cache add and `tx.save`). Five INFO items cover doc / comment / consistency polish.

## Critical Issues

### CR-01: `applyMutationInPlace` for `tool_result` spreads arbitrary hook JSON over the whole Pi event

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:91-99`
**Issue:** The wire-protocol parser converts an arbitrary `hookSpecificOutput.updatedToolOutput` (`unknown` typed) into `mutate.updatedToolOutput` and the mutation applier does:

```ts
if (tagged.type === "tool_result" && result.updatedToolOutput !== undefined) {
  const target = event as ToolResultEvent;
  const patch = result.updatedToolOutput as Record<string, unknown>;
  Object.assign(target as unknown as Record<string, unknown>, patch);
}
```

`Object.assign` writes every own enumerable key from `patch` onto `event` itself. The hook's JSON can therefore overwrite `event.type` (the discriminator the bridge keys on), `event.toolName` (used by the `matcherFiresOnToolEvent` predicate in the next iteration), `event.isError` (the discriminator the `tool_result` composite handler routed against; downstream this can flip the bucket for any LATER fan-out that re-reads it), and arbitrary unrelated fields. The matching tool_call arm at lines 84-88 only assigns into `event.input`, which is bounded, but the tool_result arm assigns over the *whole* event.

The PRD contract for `updatedToolOutput` is "update the Claude-side `tool_response` JSON shape" — not "mutate the whole Pi event surface". The downstream `adaptToolResultResult` consumes this same `event` to compose the `tool_result` return shape (`content` / `details` / `isError`), so the corruption flows through to the Pi-side handler return as well.

The mutate arm carrying through to the next reducer iteration (`finalResult = r` for `mutate`) means a single malicious or buggy hook can permanently re-route every later same-bucket entry's translator and matcher.

**Fix:**
```ts
if (tagged.type === "tool_result" && result.updatedToolOutput !== undefined) {
  // Only the documented mutation surface: the content array (Pi-side) +
  // optional isError flag. Reject non-object patches early.
  if (result.updatedToolOutput === null || typeof result.updatedToolOutput !== "object") {
    return;
  }

  const target = event as ToolResultEvent;
  const patch = result.updatedToolOutput as { content?: unknown; isError?: unknown };
  // Whitelist the two documented fields; ignore everything else so a
  // hook cannot rewrite `type`, `toolName`, etc.
  if (Array.isArray(patch.content)) {
    (target as { content: unknown }).content = patch.content;
  }

  if (typeof patch.isError === "boolean") {
    (target as { isError: boolean }).isError = patch.isError;
  }
}
```

(Same defensive shape ought to be considered for the tool_call arm: `result.updatedInput` should be required `typeof === "object" && !Array.isArray` before `Object.assign` into `event.input`, otherwise `event.input` can be mutated to surprising shapes — e.g. a hook that returns `updatedInput: { __proto__: ... }` triggers prototype pollution on the input record. The current code does `Object.assign(target, patch)` with no guard.)

### CR-02: Stream cap measured in UTF-16 code units (`text.length`) but named `_BYTES`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:83-87,395-405`
**Issue:** The three caps are declared with `_BYTES` names:

```ts
const STDIN_TRUNCATION_BYTES = 256 * 1024;
const STDOUT_MAX_BYTES = 1024 * 1024;
const STDERR_MAX_BYTES = 64 * 1024;
```

`accumulateStream` then measures:

```ts
const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
accumulated += text.length;
if (accumulated > cap) { onOverflow(); return; }
```

`text.length` is the count of UTF-16 code units, not bytes. The mapping between code units and UTF-8 bytes is not 1:1:

- A code point in U+0080..U+07FF (e.g. Latin-1 supplement, common Western European accented chars) is 1 code unit but 2 UTF-8 bytes.
- A code point in U+0800..U+FFFF (e.g. CJK, most non-Latin scripts) is 1 code unit but 3 UTF-8 bytes.
- A code point ≥ U+10000 (e.g. emoji, supplementary planes) is 2 code units (surrogate pair) but 4 UTF-8 bytes.

`stdinJson` is JSON.stringify'd UTF-16 text whose byte length on disk / on the wire is 1×-3× the code-unit count for typical input. Likewise stdout/stderr decoded back to UTF-16 understates by the same ratio.

Concrete impact:

1. A CJK-emitting hook stdout can push ~3 MB of bytes through the "1 MB" cap before overflow fires. The named guarantee EXEC-02 pins to "stdout 1 MB / stderr 64 KB chunk accumulation" is not the guarantee the code provides.
2. A surrogate-pair-heavy stdout overshoots in the other direction by ~2×.
3. The 256 KB stdin truncation is silently relaxed for non-ASCII payloads (the `_truncated` marker fires later than promised).

The architecture tests in `tests/architecture/hooks-exec.test.ts` use ASCII fixtures (`"x".repeat(300 * 1024)` etc.) so the gap is not caught.

**Fix:** measure bytes, not code units:
```ts
const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
accumulated += Buffer.byteLength(text, "utf8");
if (accumulated > cap) { onOverflow(); return; }
onChunk(text);
```

For `serializeWithTruncation`, replace `raw.length <= STDIN_TRUNCATION_BYTES` with `Buffer.byteLength(raw, "utf8") <= STDIN_TRUNCATION_BYTES`. Either rename the constants to `_CODE_UNITS` and amend EXEC-02 to match, or fix the comparison.

## Warnings

### WR-01: Stream `data` listeners stay attached after overflow → unbounded memory growth on a child that keeps writing

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:313-349,385-406`
**Issue:** When overflow fires, `tryKill(child)` is called and `overflowed = true` is set. The `data` listeners on `child.stdout` / `child.stderr` are NOT removed, and `accumulated` keeps incrementing on every subsequent chunk. If the child ignores `SIGTERM` (or the OS is slow to deliver it), it can continue writing megabytes/second through the listener, all of which is still pulled off the pipe by Node, decoded to UTF-8 strings, and discarded. The TC heap grows unbounded until the SIGKILL escalation ladder fires (which can be `timeoutMs + 5s` away, default 605 s).

Also: the overflow path uses `tryKill` (one SIGTERM only), bypassing the EXEC-02 `installTimerLadder` escalation. There's no fast-track SIGKILL on overflow even though the child has demonstrated misbehavior.

**Fix:**
```ts
// Inside the overflow callback, detach the data listener and start a fresh
// short escalation ladder. Both stdout and stderr share the same overflow
// arm so only one ladder is needed.
const overflow = (which: "stdout" | "stderr") => {
  if (overflowed) return;
  overflowed = true;
  hookDebugLog(`exec: ${which} overflow (${entry.pluginId}/${entry.claudeEvent}); killing child`);
  child.stdout?.removeAllListeners("data");
  child.stderr?.removeAllListeners("data");
  // Use a tight escalation -- the child has already over-spent its budget.
  ladder.cancel();
  const overflowLadder = installTimerLadder(child, 0); // SIGTERM immediately, SIGKILL +5s
  child.once("close", overflowLadder.cancel);
  child.once("error", overflowLadder.cancel);
};
```

### WR-02: `_truncated: true` marker can be silently overridden when payload contains a `_truncated` key

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:192-210`
**Issue:**

```ts
const marked = { _truncated: true, ...(payload as Record<string, unknown>) };
```

Object spread later-wins: if the payload itself contains `_truncated`, it overrides the marker. None of the v1.13 translators emit a `_truncated` field today, but the comment in `serializeWithTruncation` claims "the contract is honored". Defense-in-depth: put the spread first so the marker wins.

**Fix:**
```ts
const marked = { ...(payload as Record<string, unknown>), _truncated: true };
```

### WR-03: `buildPayload` casts the runtime `event` to `never`; mismatched event shape silently emits incomplete envelopes

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:166-178`
**Issue:** The runtime `event: unknown` is fan-out to the per-translator signature via `event as never`. None of the translators validate that the required fields are present; they all read `event.toolName`, `event.input`, `event.reason`, etc. unguarded. If the dispatcher's routing ever lands a wrong-shaped event in the wrong translator (e.g. a routing bug, a Pi peer-dep shape change), JSON.stringify silently elides the missing fields and the child process receives a partial envelope with no diagnostic.

A defensive check at the dispatch seam — e.g. "if `event.toolName === undefined` on a tool-event arm, hookDebugLog + noop" — would convert a silent envelope corruption into an observable signal. This is in line with the never-throws contract (no escape to the user) but improves debuggability.

**Fix:** Add per-arm runtime field probes inside `buildPayload`, route failures through `hookDebugLog`:
```ts
function buildPayload(claudeEvent, event, transCtx) {
  // ...validate required field set per claudeEvent before calling translator
  if (claudeEvent === "PreToolUse" || claudeEvent.startsWith("PostToolUse")) {
    if (event === null || typeof event !== "object" || !("toolName" in event)) {
      hookDebugLog(`buildPayload: missing toolName on ${claudeEvent}; skipping`);
      // Return a minimal envelope so downstream serialization still works.
    }
  }
  // ...
}
```

### WR-04: `Map.delete` during forward iteration in `hydrateProjectScopeForCwd`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:470-475`
**Issue:**

```ts
for (const key of parsedConfigCache.keys()) {
  if (key.startsWith(projectKeyPrefix)) {
    parsedConfigCache.delete(key);
  }
}
```

`Map` iteration during deletion is **well-defined** in the ECMAScript spec (deleted entries are skipped; the iterator never visits them), so this is not a correctness bug today. It IS a footgun for the next contributor: a casual reader may reach for `Array.from(parsedConfigCache.keys())` thinking they need a snapshot. Pre-snapshot the keys to make the intent explicit and remove the cognitive friction:

**Fix:**
```ts
const projectKeyPrefix = "project\x00";
for (const key of Array.from(parsedConfigCache.keys())) {
  if (key.startsWith(projectKeyPrefix)) {
    parsedConfigCache.delete(key);
  }
}
```

### WR-05: `chunk.toString("utf8")` on chunk boundaries can produce replacement characters

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:396-397`
**Issue:** `chunk.toString("utf8")` decodes each Buffer independently. A multi-byte UTF-8 sequence that straddles a chunk boundary (Node's default highWaterMark is 64 KiB but `data` events do not respect code-point boundaries) is decoded as `�` for the truncated head of the second chunk and the orphan tail of the first. Hook stdout JSON containing non-ASCII is then incorrectly parsed (or parses but with corrupt fields).

The wire-protocol parser at `wire-protocol.ts:54-62` `JSON.parse(trimmed)`s the accumulated stdout; replacement chars in a JSON string value would not fail JSON.parse — they would silently corrupt the parsed string. The downstream `block.reason`, `mutate.additionalContext`, etc. then carry corrupted text into the user-visible surface.

**Fix:** Use `node:string_decoder` for streaming decode:
```ts
import { StringDecoder } from "node:string_decoder";
function accumulateStream(stream, cap, onChunk, onOverflow) {
  if (stream === null) return;
  const decoder = new StringDecoder("utf8");
  let accumulated = 0;
  stream.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
    accumulated += Buffer.byteLength(text, "utf8");
    if (accumulated > cap) { onOverflow(); return; }
    onChunk(text);
  });
  stream.on("end", () => {
    const tail = decoder.end();
    if (tail !== "") onChunk(tail);
  });
}
```

### WR-06: Install closure can leak a cache entry on a throw between `addInstalledPluginHooksToCache` and `tx.save()`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:946-1013`
**Issue:** Inside `installPlugin`'s transaction closure:

```ts
if (installCtx.resolved.hooksConfigPath !== undefined) {
  await addInstalledPluginHooksToCache(scope, marketplace, plugin, ...);
  rebuildRoutingTables(state, locations);
}
// ... config write-back ...
await tx.save();
```

If `writeBatchedConfigEntries` (the config-write-back) throws, the transaction discards the in-memory state mutation but the `parsedConfigCache` Map and the in-memory `routingTable` Map ALREADY hold the entry for a plugin whose state.json never recorded the install. The next dispatch event will route to a plugin that, as far as `state.json` is concerned, does not exist. Comments at install.ts:937-944 acknowledge a "bounded leak" but the bound — "next `/reload` resets the cache" — is correct only if the user reloads; in-session, the bridge will keep dispatching to a phantom plugin.

The same shape exists at `reinstall.ts:1080-1117` (cache mutated then `maybeWritePluginConfigBack` then `tx.save`) and `update.ts:1090-1123` (same ordering).

**Fix:** Move the cache mutation + `rebuildRoutingTables` to AFTER `tx.save()` so a write-back throw cannot strand a phantom routing entry:
```ts
// ... config write-back ...
await tx.save();
// SAVE-CRITICAL POINT: state.json now matches in-memory state.
// Hooks cache update is safe here because state.json is the source of truth
// the next `/reload` rehydrates from.
if (installCtx.resolved.hooksConfigPath !== undefined) {
  await addInstalledPluginHooksToCache(...);
  rebuildRoutingTables(state, locations);
}
```

(This is a slight semantic reorder vs. the current "mutate cache inside the lock" pattern. Confirm with the planner that doing the cache mutation post-save is acceptable; the alternative is to wrap the cache mutation in a deferred rollback that fires on transaction throw.)

### WR-07: `tryKill` only sends SIGTERM; overflowed children that ignore SIGTERM block on the original timeout ladder

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:408-412`
**Issue:** When stdout/stderr overflow fires, `tryKill(child)` sends a single SIGTERM. The dispatcher then waits on `child.once("close")` to settle. The original `installTimerLadder` is still on its `timeoutMs` / `timeoutMs+5000` clock — for a default 600 s timeout, an overflowing child that ignores SIGTERM holds the dispatcher's promise open for up to 605 s (and its stream listeners keep churning bytes; see WR-01).

**Fix:** On overflow, cancel the original ladder and arm a tight escalation ladder (SIGTERM immediately, SIGKILL +5 s) — see WR-01 patch.

## Info

### IN-01: `stderr` ledger formatting silently drops byte budgets on debug line composition

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:365-367`
**Issue:** The on-close debug log composes:
```ts
hookDebugLog(`exec: stderr (${entry.pluginId}/${entry.claudeEvent}): ${stderr.trim()}`);
```

If a hook emits 64 KB of stderr (the cap), the full 64 KB is dumped as a single `console.error` line. Useful in debug mode; noisy as a single line. Consider truncating to e.g. 4 KB with a `…(N more bytes elided)` suffix when `PI_CLAUDE_MARKETPLACE_DEBUG=1` is not set, full when it is.

### IN-02: `compositeHandlerFor` returns `undefined as CompositeReturnFor<E>` for the early-exit arms

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:232,238`
**Issue:** The `epoch !== currentEpoch()` and empty-bucket arms use `return undefined as CompositeReturnFor<E>;`. This works for the four observation arms (whose return is `undefined`) but for `PreToolUse` (`ToolCallEventResult | undefined`) and `UserPromptSubmit` (`InputEventResult | undefined`), this is a type assertion that the cast is safe — fine, but the discriminant `CompositeReturnFor<E>` has not been narrowed at runtime, so the assertion is a forward-compat hazard if a future arm gets a non-undefined return slot. Comment why this cast is sound rather than relying on the reader to derive it.

### IN-03: `tagged.type === "tool_call"` / `"tool_result"` is a magic string compared at runtime

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:84,91`
**Issue:** Pi event `type` literals are hard-coded strings here. Centralise them in a constant set adjacent to the Pi-API import boundary so a peer-dep type change is grep-able. (Pi already publishes these as part of `InputEvent.type` etc. — pulling them via a `satisfies` constant array prevents drift.)

### IN-04: `serializeWithTruncation` returns the marked JSON without re-checking against the cap

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:201-204`
**Issue:** The comment at line 188-191 acknowledges the marker can push the payload "a few bytes" over cap. In practice the marker `_truncated:true,` is ~18 bytes; harmless. The doc notes the trade-off — keep it but add a one-liner inline comment ("marker overshoot ≤ 20 bytes by construction") so the comparison `raw.length <= STDIN_TRUNCATION_BYTES` (against `_BYTES`-named const, see CR-02) reads as intentional.

### IN-05: Architecture-test stdin truncation assertion only checks ASCII

**File:** `tests/architecture/hooks-exec.test.ts:268-284`
**Issue:** The Block B / EXEC-02 truncation test uses `"x".repeat(300 * 1024)` — all ASCII, so `.length` == byte length. This is why CR-02's UTF-8 vs UTF-16 gap is not caught. Add a CJK / emoji fixture that exercises the byte-vs-code-unit boundary so a future regression is observable:

```ts
const cjk = "中".repeat(120 * 1024); // 120 K code units = 360 K UTF-8 bytes
// Should ALSO trigger truncation under a byte-accurate measurement.
```

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

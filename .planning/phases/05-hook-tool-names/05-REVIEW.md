---
phase: 05-hook-tool-names
reviewed: 2026-11-04T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
  - extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - features/lib/hook-mcp-calls.ts
  - features/lib/hook-mcp-tool-server.ts
  - features/step_definitions/hook/tool-use.steps.ts
  - features/hook/mcp-tool-names.feature
  - features/hook/tool-use.feature
  - docs/hooks-compatibility.md
  - test/domain/components/hooks/builtin-mcp-tool-names.test.ts
  - test/bridges/hooks/mcp-tool-view.test.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/hooks/event-router.test.ts
  - test/bridges/hooks/if-field/index.test.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
  necessity: 1
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-04
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

I reviewed the changes between `640419724c48a60c7bb469acf0fde6f3a6ea7852` and HEAD in the 16 scoped files. I checked them against Pi 1.5.0's `createMcpToolName` and `registerTools` (`dist/extensions/mcp/tools.js:45-51`, `dist/extensions/mcp/index.js:283-345`), `mcpNamespace` (`dist/core/mcp-servers.js:60`), `SERVER_NAME` (`dist/core/mcp-servers.js:58`, `[A-Za-z0-9_-]+`), `getAllTools` (`dist/core/agent-session.js:1110`), and the `tool_call`/`tool_result` emission (`agent-session.js:339-390`).

What I verified:

- **Name mapping.** I wrote a fuzz harness with a verbatim copy of Pi's `createMcpToolName`. It ran 200,000 random server/tool pairs (lone surrogates, non-ASCII, collision `isTaken`, and names over 64 characters included). The Claude-form full literal `mcp__<server>__<tool>` always fired. Every Claude-form name that `claudeFormToolName` rewrites also fires when used as a literal, because the `-` to `_` fold keeps the length the same. `/\W/g` without the `u` flag does equal Pi's `[^A-Za-z0-9_]` per UTF-16 code unit.
- **Collisions.** When two servers share a namespace (`a-b` and `a_b`), the tools stay apart, because the hash is keyed on the alias.
- **Exceptions.** No exception escapes a Pi tool handler on the new paths. `identify` wraps both the tool read and `hookToolFor` in try/catch. `proxyRuleApplies` goes through `softDepStatus`, which guards each arm. This matters because a throwing `tool_call` handler blocks the call in Pi 1.5.0.
- **Input rewrites.** An input rewrite still reaches Pi: the shallow event copy shares `input`, and Pi passes `args` by reference.
- **Generations.** Each `registerHooksBridgeWith` call has one view and one `capturedGeneration`, so a stale handler cannot reuse a later generation's proxy answer.
- **Security.** No plugin text becomes a `RegExp`. Every comparison uses string operations.

The paired unit files pass locally.

The one Warning is a documented behavior that does not happen. The docs, and the domain function's own contract, say a matcher with the tool segment folded fires too. That is false whenever Pi hashed the name, so such a hook silently never fires. The Info items are robustness, parity-edge, and maintainability notes.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A folded tool-segment literal does not fire on a hashed name, but the docs and the contract say it does

**File:** `docs/hooks-compatibility.md:119`, `docs/hooks-compatibility.md:148`, `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:67-74`
**Issue:** The MCP-literal row says: "Claude Code's full name fires, and the name with each `-` of the tool segment changed to `_` fires too." The `toolLiteralNames` doc comment says the same. This holds only when Pi kept the plain folded name. For a hashed name, `piToolNames` hashes `sha256("<server>\0<literal's tool segment>")`. A folded literal therefore hashes a different string from the one Pi hashed (the original tool name), and the hook never fires. There is no notice or debug line. I reproduced it:

```text
server "echo-server", tool "summarize-the-current-repository-state-and-history-now"
Pi name:  mcp__echo_server__summarize_the_current_repository_stat_03a79582
mcp__echo-server__summarize-the-current-repository-state-and-history-now  -> fires
mcp__echo-server__summarize_the_current_repository_state_and_history_now  -> does NOT fire
```

The docs also leave out the second hashed case, which D-P5-04 covers: two tools that sanitize to one name, such as `a-b` and `a_b` on one server. Neither tool is over 64 characters, yet the hook sees `mcp__echo-server__a_b_df6a4d34`. The docs mention a hash only for names "longer than 64 characters". No unit row pins a folded literal against a cut name, which is why the overclaim went unnoticed. The domain test at `test/domain/components/hooks/builtin-mcp-tool-names.test.ts:121-130` checks only the full name against a cut name.
**Fix:** Correct the docs and the comment instead of the behavior: the hash really cannot be recovered from a folded segment. For example, in `docs/hooks-compatibility.md:119`:

```markdown
... So Claude Code's full name fires. When Pi kept the tool's name whole, the name with each `-` of the tool segment changed to `_` fires too; when Pi ended the name with a hash (a name over 64 characters, or two tools whose names differ only in `-` and `_`), only Claude Code's full name fires.
```

At line 148, change "When a tool name is longer than 64 characters, Pi cuts it and ends it with a hash" so that it also names the collision case. Make the same change in the `toolLiteralNames` JSDoc. Add a domain row that pins it:

```ts
test("does not fire the folded tool segment on a name Pi cut (D-P5-04)", () => {
  const tool = { piName: "mcp__echo_server__summarize_the_current_repository_stat_03a79582", builtinServer: "echo-server" };
  assert.strictEqual(
    toolLiteralNames("mcp__echo-server__summarize_the_current_repository_state_and_history_now", tool),
    false,
  );
});
```

## Info

### IN-01: The proxy-rule answer is cached for the whole generation, even when it came from a degraded read

**File:** `extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts:206-210`
**Issue:** `proxyRule ??= ...` keeps the first answer for the whole generation (D-P5-07). `softDepStatus` turns a throwing `getCommands`/`getAllTools` arm into "not loaded" (`platform/pi-api.ts:276-293`). So if the first proxy-shaped call meets a read failure under pi-mcp-adapter, the view caches `false`. Every later proxy call then runs its hooks twice, once on the outer `mcp` call and once on the nested call, until `/reload`. Before this phase the rule did not depend on a read, so this failure could not happen. At `tool_call` time the session is bound and these reads should not throw, so I rate this Info.
**Fix:** Optional hardening: cache only an answer that the reads confirmed. Alternatively, accept the risk and record it next to D-P5-07.

### IN-02: Under built-in MCP, a server prefix must equal the server name, unlike the adapter path and Claude Code when the server name contains `__`

**File:** `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:94-98`
**Issue:** Pi's `SERVER_NAME` (`/^[A-Za-z0-9_-]+$/`) allows a server named `a__b`. Claude Code's `mcp__a__.*` is an unanchored regex, so it fires on `mcp__a__b__x`, and so does the adapter path (`startsWith`). The built-in path requires `prefix === "mcp__a__b__"`, so the same matcher fires under one implementation and not under the other. This is an edge case, close to P5-DC-16, but it is a difference between the two implementations that no doc row mentions.
**Fix:** Either use `claudeFormToolName(...).startsWith(prefix)` for the built-in prefix check, or record the difference in `docs/hooks-compatibility.md` and DUBIOUS-CHOICES.

### IN-03: The `matchValue` doc comment still says "the PreToolUse Pi tool name"

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:897-903`
**Issue:** `entryFires` no longer calls `matchValue` for PreToolUse. Its only PreToolUse caller is now `noticeLabel`, which passes `view.event`, so the value is the hook-facing name (Claude's form for a built-in MCP tool), not Pi's name.
**Fix:** Change it to "the PreToolUse tool name as the hooks see it (D-P5-03)".

### IN-04: The `"mcp__"` prefix constant is defined three times in the hooks code

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:632`, `extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts:29`, `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:28`
**Issue:** The phase adds two more copies of `MCP_TOOL_PREFIX`/`MCP_PREFIX`. `matcher.ts` and `if-field/index.ts` hard-code the literal as well. A future rename would have to touch every copy.
**Fix:** Export one constant from `domain/components/hooks/builtin-mcp-tool-names.ts`, which both bridge modules already import, and use it in the two new bridge sites.

### IN-05: Impossible-state guard: the empty tool segment check in `toolLiteralNames`

**File:** `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:81`
**Category:** necessity
**Issue:** `literal.length === prefix.length` rejects a literal that ends right after `mcp__<server>__`. Both producers of MCP literals already reject that shape before dispatch: `isMcpLiteral` (`domain/components/hooks/matcher.ts:48-50`, `separatorIndex >= body.length - 2`) and `matchMcpLiteral` (`bridges/hooks/if-field/index.ts:214-216`). Neither production caller can reach the branch. Only the direct unit rows (`builtin-mcp-tool-names.test.ts:25,43`) do. The function is exported, so a human may still want to keep the check as a contract on the domain function; I rate it Info.
**Fix:** Keep the check and note why it exists, or drop it together with its two unit rows.

---

_Reviewed: 2026-11-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

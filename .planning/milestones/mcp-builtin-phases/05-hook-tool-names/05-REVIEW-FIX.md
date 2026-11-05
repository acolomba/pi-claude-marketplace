---
phase: 05-hook-tool-names
fixed_at: 2026-11-04T00:00:00Z
review_path: .planning/phases/05-hook-tool-names/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-04
**Source review:** .planning/phases/05-hook-tool-names/05-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (fix scope: all, Info included)
- Fixed: 6
- Skipped: 0

All edits and commits ran in the main checkout on `features/mcp-builtin-phase-5`, with no worktree. Verification also ran there.

## Fixed Issues

### WR-01: A folded tool-segment literal does not fire on a hashed name, but the docs and the contract say it does

**Outcome:** fixed
**Files modified:** `docs/hooks-compatibility.md`, `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts`, `test/domain/components/hooks/builtin-mcp-tool-names.test.ts`
**Commit:** 043b98e
**Applied fix:** The behavior is unchanged. The fix corrects the docs and the contract only. The MCP literal row now says that Claude Code's full name always fires. It says that the name with the tool segment folded fires only when Pi did not end the name with a hash. The Tool name mapping paragraph now names both cases in which Pi adds a hash: a name over 64 characters, and a name that another tool of the same server already holds (`a-b` beside `a_b`). It also explains that Pi hashes the original name, so only Claude Code's full name fires on a hashed name. The `toolLiteralNames` JSDoc says the same. Two new unit rows pin the cut name `mcp__echo_server__summarize_the_current_repository_stat_03a79582`: the Claude-form literal fires, and the folded literal does not.

### IN-01: The proxy-rule answer is cached for the whole generation, even when it came from a degraded read

**Outcome:** fixed (documentation only, no behavior change)
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts`, `docs/hooks-compatibility.md`
**Commit:** b6c6eb4
**Applied fix:** The `createHookToolView` JSDoc now says that the view keeps the first answer even after a failed read. In that case the answer stays `false` until `/reload`, so under pi-mcp-adapter each proxy call runs its hooks twice. The proxy-rule paragraph of the docs says the same. The view gets no behavior change: `softDepStatus` reports a read that throws as "not loaded", so the view cannot tell a confirmed answer from a degraded one without a wider change.

### IN-02: Under built-in MCP, a server prefix must equal the server name, unlike the adapter path and Claude Code when the server name contains `__`

**Outcome:** fixed (documentation only)
**Files modified:** `docs/hooks-compatibility.md`
**Commit:** 83478de
**Applied fix:** The MCP server prefix row now says that under Pi's built-in MCP the server must equal the registered name. Claude Code and pi-mcp-adapter test only the start of the tool name. The row gives an example: for a server named `a__b`, `mcp__a__.*` fires there and not under Pi's built-in MCP. The matching behavior is unchanged. The `if` field's prefix row refers to this row, so it needs no edit. DUBIOUS-CHOICES.md was not edited (see the fixer's report).

### IN-03: The `matchValue` doc comment still says "the PreToolUse Pi tool name"

**Outcome:** fixed
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`
**Commit:** 9fec686
**Applied fix:** The comment now describes the value that the notice label names and that a closed-set matcher selects on. For PreToolUse, that value is the tool name as the hooks see it (D-P5-03).

### IN-04: The `"mcp__"` prefix constant is defined three times in the hooks code

**Outcome:** fixed
**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts`, `extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`
**Commit:** 2326f73
**Applied fix:** The domain module now exports `MCP_TOOL_PREFIX` (renamed from its private `MCP_PREFIX`). Both bridge modules import it in place of their own copies. The bridge-to-domain edge is allowed, and both bridge modules already imported this module. Two other copies remain, as the review scoped: the `"mcp__"` literals in `domain/components/hooks/matcher.ts` and `bridges/hooks/if-field/index.ts`.

### IN-05: Impossible-state guard: the empty tool segment check in `toolLiteralNames` (necessity)

**Outcome:** fixed: requires human verification (necessity finding, code removed)
**Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts`
**Commit:** 657afba
**Applied fix:** The fix removes `|| literal.length === prefix.length`. Removing it does not weaken safety. With the check gone, a bare `mcp__<server>__` reaches `piToolNames(server, "")`, which returns only Pi's names for an empty tool name. Such a literal therefore names a tool only if Pi gave the tool exactly that name. Both production parsers (`isMcpLiteral`, `matchMcpLiteral`) reject that literal before dispatch anyway. The two unit rows for a bare prefix were kept, because they still pass and pin that a bare prefix names no ordinary tool. Direct coverage of the module stays at 100% line, branch, and function.

## Verification

All checks ran in the main checkout (`/home/user/pi-claude-marketplace`, branch `features/mcp-builtin-phase-5`).

- Each commit passed the pre-commit fixers, and its hook ran `npm run check:commit` when it staged a build input.
- `npm run check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `node --test test/domain/components/hooks/builtin-mcp-tool-names.test.ts test/bridges/hooks/*.test.ts`: 804 tests, 804 pass, 0 fail.
- Direct coverage of `builtin-mcp-tool-names.ts` after IN-05: 100% line, branch, and function.

---

_Fixed: 2026-11-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

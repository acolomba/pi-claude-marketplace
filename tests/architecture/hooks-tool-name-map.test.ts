// Architecture-level invariant pins for the TOOL-01 bidirectional
// Claude <-> Pi tool-name map (D-58-04 / D-58-05).
//
// Each test in this file pins one load-bearing decision that is a
// single textual diff away from regression:
//
//   - The forward and reverse maps are inverses of each other (catches
//     asymmetric edits like renaming one direction only).
//   - Every Pi tool literal exported by the peer-dep `ToolCallEvent`
//     union has a TOOL-01 entry, with a count-lock of seven entries
//     (catches a peer-dep bump that adds an eighth tool even if a
//     contributor forgets the local const-tuple update). This is the
//     runtime supplementary gate that complements the load-bearing
//     compile-time `satisfies Record<PiToolName, string>` check on the
//     map declaration itself.
//   - The D-58-05 `find <-> Glob` LOW-confidence mapping is locked in
//     both directions (catches a future contributor silently reverting
//     the accepted semantic mismatch).
//
// If any of the three tests below red-fails CI, a future contributor
// inadvertently reverted a locked invariant.

import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAUDE_TO_PI_TOOL_NAMES,
  PI_TO_CLAUDE_TOOL_NAMES,
  mapPiToClaudeToolName,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts";

// ──────────────────────────────────────────────────────────────────────────
// Block 1: TOOL-01 inverse invariant (D-58-04)
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-01: PI_TO_CLAUDE_TOOL_NAMES and CLAUDE_TO_PI_TOOL_NAMES are inverses", () => {
  // Forward direction: every Pi key round-trips through the reverse map
  // back to itself. Catches an asymmetric edit such as renaming
  // `Edit -> Edit2` on only one side.
  for (const [piName, claudeName] of Object.entries(PI_TO_CLAUDE_TOOL_NAMES)) {
    const reverseLookup = (CLAUDE_TO_PI_TOOL_NAMES as Record<string, string>)[claudeName];
    assert.equal(
      reverseLookup,
      piName,
      `PI_TO_CLAUDE_TOOL_NAMES["${piName}"] -> "${claudeName}" but CLAUDE_TO_PI_TOOL_NAMES["${claudeName}"] -> "${String(reverseLookup)}"`,
    );
  }

  // Reverse direction: every Claude key round-trips through the forward
  // map back to itself.
  for (const [claudeName, piName] of Object.entries(CLAUDE_TO_PI_TOOL_NAMES)) {
    const forwardLookup = (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[piName];
    assert.equal(
      forwardLookup,
      claudeName,
      `CLAUDE_TO_PI_TOOL_NAMES["${claudeName}"] -> "${piName}" but PI_TO_CLAUDE_TOOL_NAMES["${piName}"] -> "${String(forwardLookup)}"`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 2: TOOL-01 peer-dep completeness (D-58-04)
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-01: every Pi tool literal in peer-dep has a TOOL-01 entry", () => {
  // The seven Pi tool literals from the peer-dep `ToolCallEvent`
  // discriminated union (see `node_modules/@earendil-works/pi-coding-agent/
  // dist/core/extensions/types.d.ts`, the `*ToolCallEvent.toolName`
  // literal arms, excluding the open-ended `CustomToolCallEvent` arm).
  //
  // The load-bearing compile-time gate lives on the
  // `PI_TO_CLAUDE_TOOL_NAMES satisfies Record<PiToolName, string>`
  // declaration; this runtime tuple is the supplementary gate that
  // also red-fails CI if a peer-dep version bump adds an eighth tool
  // literal even when a contributor forgets to update the const tuple
  // here.
  const piTools = ["bash", "read", "edit", "write", "grep", "find", "ls"] as const;

  for (const tool of piTools) {
    assert.ok(
      tool in PI_TO_CLAUDE_TOOL_NAMES,
      `peer-dep Pi tool literal "${tool}" is missing a TOOL-01 mapping entry`,
    );
  }

  // Count-lock: a peer-dep that adds an eighth Pi tool fails this
  // assertion before any consumer regression appears.
  assert.equal(
    Object.keys(PI_TO_CLAUDE_TOOL_NAMES).length,
    7,
    "PI_TO_CLAUDE_TOOL_NAMES must have exactly 7 entries (one per Pi tool literal)",
  );
  assert.equal(
    Object.keys(CLAUDE_TO_PI_TOOL_NAMES).length,
    7,
    "CLAUDE_TO_PI_TOOL_NAMES must have exactly 7 entries (one per Claude tool name)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 3: TOOL-01 find <-> Glob lock (D-58-05)
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-01: find <-> Glob mapping is locked in both directions", () => {
  // D-58-05: the LOW-confidence semantic mismatch (Pi `find` is
  // Unix-find-style; Claude `Glob` is a glob-pattern file-finder) is
  // accepted for v1.13. A future contributor who silently reverts this
  // mapping -- e.g. by removing the `find` entry on the rationale that
  // the semantics diverge -- would drop Glob matchers at parse time
  // and flip Glob-targeting plugins silently unavailable.
  assert.equal(
    PI_TO_CLAUDE_TOOL_NAMES.find,
    "Glob",
    'PI_TO_CLAUDE_TOOL_NAMES.find must map to "Glob" (D-58-05)',
  );
  assert.equal(
    CLAUDE_TO_PI_TOOL_NAMES.Glob,
    "find",
    'CLAUDE_TO_PI_TOOL_NAMES.Glob must map to "find" (D-58-05)',
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 4: TOOL-01 mapPiToClaudeToolName helper (PAYL-01 / D-60-04)
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-01: mapPiToClaudeToolName returns the Claude-form for every Pi tool literal", () => {
  // The seven Pi-form tool names must round-trip to their locked
  // Claude-form spellings. This is the single tested call site the
  // three tool translators (PreToolUse / PostToolUse /
  // PostToolUseFailure) share -- a drift here propagates to every
  // tool-event payload at dispatch time.
  assert.equal(mapPiToClaudeToolName("bash"), "Bash");
  assert.equal(mapPiToClaudeToolName("read"), "Read");
  assert.equal(mapPiToClaudeToolName("edit"), "Edit");
  assert.equal(mapPiToClaudeToolName("write"), "Write");
  assert.equal(mapPiToClaudeToolName("grep"), "Grep");
  // D-58-05: LOW-confidence find -> Glob mismatch propagates here.
  assert.equal(mapPiToClaudeToolName("find"), "Glob");
  assert.equal(mapPiToClaudeToolName("ls"), "LS");
});

test("TOOL-01: mapPiToClaudeToolName passes CustomToolCallEvent tool-names through unchanged", () => {
  // D-60-04 / PAYL-01: the `CustomToolCallEvent` arm of Pi's
  // `ToolCallEvent` union has an open-ended `toolName: string` -- e.g.
  // `mcp__server__tool` from `pi-mcp-adapter`. The helper's `??`
  // fallback emits the supplied name verbatim so MCP-form tool calls
  // flow through Claude's `tool_name` field unchanged.
  assert.equal(mapPiToClaudeToolName("mcp__server__tool"), "mcp__server__tool");
  assert.equal(mapPiToClaudeToolName("subagent"), "subagent");
  assert.equal(mapPiToClaudeToolName("some_custom_tool"), "some_custom_tool");
  assert.equal(mapPiToClaudeToolName(""), "");
});

test("TOOL-01: mapPiToClaudeToolName is one-directional (Claude-form inputs are NOT remapped)", () => {
  // The helper is Pi -> Claude only; an already-capitalized input
  // (`"Bash"`) is not a Pi tool literal so it falls through the
  // passthrough arm unchanged rather than reverse-translating back to
  // `"bash"`. The reverse direction lives at `CLAUDE_TO_PI_TOOL_NAMES`
  // for the matcher parser; the two seams must not be conflated.
  assert.equal(mapPiToClaudeToolName("Bash"), "Bash");
  assert.equal(mapPiToClaudeToolName("Read"), "Read");
  assert.equal(mapPiToClaudeToolName("Glob"), "Glob");
});

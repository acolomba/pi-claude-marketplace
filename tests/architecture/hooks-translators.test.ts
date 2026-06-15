// Architecture-level invariant pins for the bucket-A payload translators
// (PAYL-01 / TOOL-01 / D-60-04).
//
// Each block in this file pins one load-bearing decision that is a
// single textual diff away from regression. If any test red-fails CI,
// a future contributor inadvertently reverted a locked invariant.
//
// Technique:
//   - Block A: per-event translator-presence sweep -- the closed-set
//     bucket-A 8-tuple from `domain/components/hook-events.ts` drives a
//     dynamic-import of every `bridges/hooks/payloads/<kebab>.ts`
//     sibling file; each module must export a `translate` function.
//     Adding a ninth bucket-A event to the upstream tuple without
//     shipping a matching translator file red-fails this block.
//   - Block B: per-event round-trip fixtures -- one hand-authored
//     `(piEvent, translationContext, expectedJson)` triple per event;
//     `JSON.stringify(translate(piEvent, ctx))` must equal the locked
//     expected string. Catches a field drop, rename, or reordering.
//   - Block C: TOOL-01 application gate -- the three tool-event
//     translators (PreToolUse / PostToolUse / PostToolUseFailure) MUST
//     route `event.toolName = "bash"` through `mapPiToClaudeToolName`
//     so the output JSON contains `"tool_name":"Bash"`. A translator
//     that bypassed the helper would emit `"tool_name":"bash"` and
//     red-fail here.
//   - Block D: CustomToolCallEvent passthrough -- the three tool-event
//     translators MUST emit `event.toolName = "mcp__server__tool"`
//     verbatim into the `tool_name` field; the `??` fallback arm in
//     the helper is exercised. A translator that crashed or emitted
//     `undefined` would red-fail.

import assert from "node:assert/strict";
import test from "node:test";

import { BUCKET_A_EVENTS } from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

import type { TranslationContext } from "../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type {
  BucketAEvent,
  ToolEvent,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

// ──────────────────────────────────────────────────────────────────────────
// Shared fixtures + helpers
// ──────────────────────────────────────────────────────────────────────────

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

// Closed-set redeclaration of the bucket-A event names alongside the
// upstream `BUCKET_A_EVENTS` import. The architecture test compares the
// two tuples in Block A; if a future contributor adds an event upstream
// without updating this local mirror (and the kebab map below + fixture
// + expected JSON), the count-equality gate red-fails before any
// translator-presence check runs.
const LOCAL_BUCKET_A: readonly BucketAEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
] as const;

const EVENT_TO_KEBAB: Readonly<Record<BucketAEvent, string>> = {
  SessionStart: "session-start",
  UserPromptSubmit: "user-prompt-submit",
  PreToolUse: "pre-tool-use",
  PostToolUse: "post-tool-use",
  PostToolUseFailure: "post-tool-use-failure",
  PreCompact: "pre-compact",
  PostCompact: "post-compact",
  SessionEnd: "session-end",
};

// The three tool events the TOOL-01 helper must apply to (Block C/D
// closed-set gate). Subset of BUCKET_A_EVENTS.
const TOOL_EVENTS: readonly ToolEvent[] = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
] as const;

interface TranslatorModule {
  translate: (event: unknown, ctx: TranslationContext) => unknown;
}

async function loadTranslator(name: BucketAEvent): Promise<TranslatorModule> {
  const kebab = EVENT_TO_KEBAB[name];
  const mod = (await import(
    `../../extensions/pi-claude-marketplace/bridges/hooks/payloads/${kebab}.ts`
  )) as TranslatorModule;
  return mod;
}

// Per-event Pi-event fixtures: each entry is the minimal event payload
// the translator reads. Cast through `unknown` because the synthetic
// fixtures only populate the fields under test, not the full peer-dep
// shape.
const EVENT_FIXTURES: Readonly<Record<BucketAEvent, unknown>> = {
  SessionStart: { type: "session_start", reason: "startup" },
  UserPromptSubmit: {
    type: "input",
    text: "hello world",
    source: "interactive",
  },
  PreToolUse: {
    type: "tool_call",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "echo hi" },
  },
  PostToolUse: {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "echo hi" },
    content: [{ type: "text", text: "hi\n" }],
    isError: false,
  },
  PostToolUseFailure: {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "false" },
    content: [{ type: "text", text: "exit 1" }],
    isError: true,
  },
  PreCompact: {
    type: "session_before_compact",
    preparation: {},
    branchEntries: [],
  },
  PostCompact: {
    type: "session_compact",
    compactionEntry: {},
    fromExtension: false,
  },
  SessionEnd: { type: "session_shutdown", reason: "quit" },
};

const EXPECTED_JSON: Readonly<Record<BucketAEvent, string>> = {
  SessionStart:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"SessionStart","source":"startup"}',
  UserPromptSubmit:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"UserPromptSubmit","prompt":"hello world"}',
  PreToolUse:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo hi"}}',
  PostToolUse:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"echo hi"},"tool_response":[{"type":"text","text":"hi\\n"}]}',
  PostToolUseFailure:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PostToolUseFailure","tool_name":"Bash","tool_input":{"command":"false"},"tool_response":[{"type":"text","text":"exit 1"}]}',
  PreCompact:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PreCompact","trigger":"auto"}',
  PostCompact:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PostCompact","trigger":"auto"}',
  SessionEnd:
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"SessionEnd","reason":"quit"}',
};

// ──────────────────────────────────────────────────────────────────────────
// Block A: PAYL-01 / D-60-04 -- per-event translator presence
// ──────────────────────────────────────────────────────────────────────────

test("PAYL-01: every bucket-A event has a translator module exporting `translate`", async () => {
  // Iterates the BUCKET_A_EVENTS closed-set tuple from the domain layer
  // (source of truth) and asserts that the corresponding
  // bridges/hooks/payloads/<kebab>.ts file exists and exports a
  // `translate` function. Adding a ninth event to BUCKET_A_EVENTS
  // without a matching translator file fails this block before any
  // dispatch-path bug appears.
  assert.equal(BUCKET_A_EVENTS.length, 8, "v1.13 ships exactly 8 bucket-A events");

  // Local-mirror equality: catch a drift between the upstream tuple and
  // the kebab map maintained in this file.
  assert.deepEqual(
    [...BUCKET_A_EVENTS].sort(),
    [...LOCAL_BUCKET_A].sort(),
    "LOCAL_BUCKET_A must match BUCKET_A_EVENTS exactly",
  );

  for (const event of BUCKET_A_EVENTS) {
    const mod = await loadTranslator(event);
    assert.equal(
      typeof mod.translate,
      "function",
      `translator for ${event} must export a \`translate\` function`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: PAYL-01 -- per-event round-trip fixture
// ──────────────────────────────────────────────────────────────────────────

test("PAYL-01: each translator emits byte-equal JSON for its round-trip fixture", async () => {
  // Per-event hand-authored fixture: a representative Pi payload + the
  // shared TranslationContext + a locked expected JSON string. Catches
  // a field drop / rename / reordering at the architecture-test level
  // (not just per-translator unit level).
  for (const event of BUCKET_A_EVENTS) {
    const mod = await loadTranslator(event);
    const piEvent = EVENT_FIXTURES[event];
    const actual = mod.translate(piEvent, ctx);
    const expected = EXPECTED_JSON[event];
    assert.equal(
      JSON.stringify(actual),
      expected,
      `round-trip JSON for ${event} drifted from the locked fixture`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: TOOL-01 / PAYL-01 -- tool-event capitalization gate
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-01: the three tool translators route event.toolName through mapPiToClaudeToolName", async () => {
  // PreToolUse / PostToolUse / PostToolUseFailure translators MUST
  // capitalize Pi's `bash` to Claude's `Bash` via the shared helper. A
  // translator that bypassed the helper (read PI_TO_CLAUDE_TOOL_NAMES
  // directly with no fallback, or hard-coded the value) would still
  // pass for the seven literal Pi names but red-fail Block D.
  for (const event of TOOL_EVENTS) {
    const mod = await loadTranslator(event);
    const piEvent =
      event === "PreToolUse"
        ? {
            type: "tool_call",
            toolCallId: "tc",
            toolName: "bash",
            input: {},
          }
        : {
            type: "tool_result",
            toolCallId: "tc",
            toolName: "bash",
            input: {},
            content: [],
            isError: event === "PostToolUseFailure",
          };
    const actual = mod.translate(piEvent, ctx);
    const json = JSON.stringify(actual);
    assert.match(
      json,
      /"tool_name":"Bash"/,
      `${event} did not capitalize \`bash\` -> \`Bash\` via TOOL-01`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: TOOL-01 / D-60-04 -- CustomToolCallEvent passthrough
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-01: the three tool translators pass CustomToolCallEvent toolName through unchanged", async () => {
  // For the `mcp__server__tool` form (from pi-mcp-adapter and other
  // plugin-defined tool names), the helper's `??` fallback arm emits
  // the supplied name verbatim into Claude's `tool_name` field. A
  // translator that read PI_TO_CLAUDE_TOOL_NAMES directly without a
  // fallback would emit `"tool_name":undefined` (or crash) here.
  for (const event of TOOL_EVENTS) {
    const mod = await loadTranslator(event);
    const piEvent =
      event === "PreToolUse"
        ? {
            type: "tool_call",
            toolCallId: "tc",
            toolName: "mcp__server__tool",
            input: {},
          }
        : {
            type: "tool_result",
            toolCallId: "tc",
            toolName: "mcp__server__tool",
            input: {},
            content: [],
            isError: event === "PostToolUseFailure",
          };
    const actual = mod.translate(piEvent, ctx);
    const json = JSON.stringify(actual);
    assert.match(
      json,
      /"tool_name":"mcp__server__tool"/,
      `${event} did not pass CustomToolCallEvent toolName through unchanged`,
    );
  }
});

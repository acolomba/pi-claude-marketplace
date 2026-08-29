import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appendHooksBlock,
  type ClaudeHookEvent,
  type HookSummaryEntry,
  type ToolEvent,
} from "../../../extensions/pi-claude-marketplace/shared/concerns/hooks.ts";

void ([
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Stop",
  "StopFailure",
] as const satisfies readonly ClaudeHookEvent[]);
void (["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const satisfies readonly ToolEvent[]);
void ([
  { event: "PreToolUse", matcher: "Bash" },
  { event: "SessionStart" },
  { kind: "lenient", event: "Notification", supported: false },
] as const satisfies readonly HookSummaryEntry[]);

// @ts-expect-error Notification is not a closed Claude hook event
void ("Notification" satisfies ClaudeHookEvent);

// @ts-expect-error SessionStart is not a tool event
void ("SessionStart" satisfies ToolEvent);

// @ts-expect-error PreToolUse requires a matcher
void ({ event: "PreToolUse" } satisfies HookSummaryEntry);

// @ts-expect-error PostToolUse requires a matcher
void ({ event: "PostToolUse" } satisfies HookSummaryEntry);

// @ts-expect-error PostToolUseFailure requires a matcher
void ({ event: "PostToolUseFailure" } satisfies HookSummaryEntry);

// @ts-expect-error an unknown strict event requires the lenient discriminator
void ({ event: "Notification" } satisfies HookSummaryEntry);

// @ts-expect-error a lenient entry requires its supportability flag
void ({ kind: "lenient", event: "Notification" } satisfies HookSummaryEntry);

test("leaves existing lines unchanged when entries are undefined", () => {
  // arrange
  const lines = ["  ● alpha v1.0.0 (installed)"];
  const expectedLines = ["  ● alpha v1.0.0 (installed)"];

  // act
  appendHooksBlock(lines, undefined);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("leaves existing lines unchanged when entries are empty", () => {
  // arrange
  const lines = ["  ● alpha v1.0.0 (installed)"];
  const expectedLines = ["  ● alpha v1.0.0 (installed)"];

  // act
  appendHooksBlock(lines, []);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("appends a strict tool event with its matcher", () => {
  // arrange
  const lines = ["  ● alpha v1.0.0 (installed)"];
  const entries = [{ event: "PreToolUse", matcher: "Bash" }] satisfies HookSummaryEntry[];
  const expectedLines = ["  ● alpha v1.0.0 (installed)", "    hooks:", "      PreToolUse(Bash)"];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("appends a strict non-tool event without a matcher", () => {
  // arrange
  const lines = ["  ● alpha v1.0.0 (installed)"];
  const entries = [{ event: "SessionStart" }] satisfies HookSummaryEntry[];
  const expectedLines = ["  ● alpha v1.0.0 (installed)", "    hooks:", "      SessionStart"];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("appends a supported lenient event without a suffix", () => {
  // arrange
  const lines: string[] = [];
  const entries = [
    { kind: "lenient", event: "PostToolUse", supported: true },
  ] satisfies HookSummaryEntry[];
  const expectedLines = ["    hooks:", "      PostToolUse"];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("appends an unsupported lenient event with its suffix", () => {
  // arrange
  const lines: string[] = [];
  const entries = [
    { kind: "lenient", event: "Notification", supported: false },
  ] satisfies HookSummaryEntry[];
  const expectedLines = ["    hooks:", "      Notification (unsupported)"];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("appends mixed entries in caller order with exact indentation", () => {
  // arrange
  const lines = ["prefix"];
  const entries = [
    { event: "PostToolUseFailure", matcher: "Edit|Write" },
    { event: "StopFailure" },
    {
      kind: "lenient",
      event: "PermissionRequest",
      supported: false,
      matcher: "Bash",
    },
  ] satisfies HookSummaryEntry[];
  const expectedLines = [
    "prefix",
    "    hooks:",
    "      PostToolUseFailure(Edit|Write)",
    "      StopFailure",
    "      PermissionRequest(Bash) (unsupported)",
  ];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("distinguishes an absent lenient matcher from an empty matcher", () => {
  // arrange
  const lines: string[] = [];
  const entries = [
    { kind: "lenient", event: "PostToolUse", supported: true },
    { kind: "lenient", event: "PostToolUse", supported: true, matcher: "" },
  ] satisfies HookSummaryEntry[];
  const expectedLines = ["    hooks:", "      PostToolUse", "      PostToolUse()"];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

test("preserves order and duplicate values for entries that share an event", () => {
  // arrange
  const lines: string[] = [];
  const entries = [
    { event: "PreToolUse", matcher: "Write" },
    { event: "PreToolUse", matcher: "Bash" },
    { event: "PreToolUse", matcher: "Bash" },
    { event: "PreToolUse", matcher: "Edit" },
  ] satisfies HookSummaryEntry[];
  const expectedLines = [
    "    hooks:",
    "      PreToolUse(Write)",
    "      PreToolUse(Bash)",
    "      PreToolUse(Bash)",
    "      PreToolUse(Edit)",
  ];

  // act
  appendHooksBlock(lines, entries);

  // assert
  assert.deepStrictEqual(lines, expectedLines);
});

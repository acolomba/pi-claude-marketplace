import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  rewakeBody,
  rewakeLabel,
  rewakeSummaryText,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts";

import type { DispatchableEvent } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

describe("rewakeLabel", () => {
  const cases: ReadonlyArray<readonly [DispatchableEvent, unknown, string]> = [
    ["PreToolUse", { tool_name: "Bash" }, "PreToolUse:Bash"],
    ["PostToolUse", { tool_name: "Edit" }, "PostToolUse:Edit"],
    ["PostToolUseFailure", { tool_name: "Bash" }, "PostToolUseFailure:Bash"],
    ["SessionStart", { source: "startup" }, "SessionStart:startup"],
    ["SessionEnd", { reason: "clear" }, "SessionEnd:clear"],
    ["PreCompact", { trigger: "manual" }, "PreCompact:manual"],
    ["PostCompact", { trigger: "auto" }, "PostCompact:auto"],
    ["StopFailure", { error: "rate_limit" }, "StopFailure:rate_limit"],
    ["UserPromptSubmit", { prompt: "hi" }, "UserPromptSubmit"],
    ["Stop", { stop_hook_active: false }, "Stop"],
    ["PreToolUse", { tool_name: 7 }, "PreToolUse"],
    ["SessionStart", {}, "SessionStart"],
    ["SessionStart", null, "SessionStart"],
    ["SessionStart", "startup", "SessionStart"],
  ];

  for (const [event, payload, label] of cases) {
    test(`names ${event} with ${JSON.stringify(payload)} as ${label}`, () => {
      assert.strictEqual(rewakeLabel(event, payload), label);
    });
  }
});

describe("rewakeBody", () => {
  const cases: ReadonlyArray<readonly [string, string | undefined, string, string, string]> = [
    ["the declared message and the stderr", "Woke.", "err", "out", "Woke. err"],
    [
      "the default prefix with the label",
      undefined,
      "err",
      "out",
      'Stop hook blocking error from command "UserPromptSubmit": err',
    ],
    ["the stdout when the stderr is empty", "Woke.", "", "out", "Woke. out"],
    [
      "the prefix and one space when there is no output",
      undefined,
      "",
      "",
      'Stop hook blocking error from command "UserPromptSubmit": ',
    ],
    ["a leading space for a declared empty message", "", "err", "", " err"],
    ["a whitespace-only stderr as the output", "Woke.", " ", "out", "Woke.  "],
  ];

  for (const [name, message, stderr, stdout, body] of cases) {
    test(`builds ${name}`, () => {
      assert.strictEqual(rewakeBody(message, "UserPromptSubmit", stderr, stdout), body);
    });
  }
});

describe("rewakeSummaryText", () => {
  test("keeps a declared summary", () => {
    assert.strictEqual(rewakeSummaryText("wake finished"), "wake finished");
  });

  test("keeps a declared empty summary", () => {
    assert.strictEqual(rewakeSummaryText(""), "");
  });

  test("defaults to Claude Code's summary", () => {
    assert.strictEqual(rewakeSummaryText(undefined), "Stop hook feedback");
  });
});

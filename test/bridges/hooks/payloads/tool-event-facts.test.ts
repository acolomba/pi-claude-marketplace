import assert from "node:assert/strict";
import test from "node:test";

import {
  toolFactFields,
  withToolFacts,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts";

import type { ToolResultEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function resultEvent(): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "facts-call",
    toolName: "bash",
    input: { command: "printf facts" },
    content: [{ type: "text", text: "facts" }],
    isError: false,
    details: undefined,
  };
}

test("gives a duration fact as the duration_ms member (D-PG6-06)", () => {
  // act
  const fields = toolFactFields({ hookDurationMs: 12 });

  // assert
  assert.deepStrictEqual(fields, { duration_ms: 12 });
});

test("gives no member for an event with no fact (D-PG6-04)", () => {
  // act
  const fields = toolFactFields({});

  // assert
  assert.deepStrictEqual(fields, {});
});

test("adds a fact to a copy that shares the event's input and content (D-PG6-06)", () => {
  // arrange
  const event = resultEvent();

  // act
  const withFacts = withToolFacts(event, { hookDurationMs: 12 });

  // assert
  assert.notStrictEqual(withFacts, event);
  assert.deepStrictEqual(withFacts, { ...resultEvent(), hookDurationMs: 12 });
  assert.strictEqual(withFacts.input, event.input);
  assert.strictEqual(withFacts.content, event.content);
  assert.deepStrictEqual(event, resultEvent());
});

test("returns the event itself when no fact is set", () => {
  // arrange
  const event = resultEvent();

  // act
  const withFacts = withToolFacts(event, {});

  // assert
  assert.strictEqual(withFacts, event);
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
  isDispatchableEvent,
  type BucketAEvent,
  type DispatchableEvent,
  type StopFailureErrorType,
  type ToolEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

void ("SessionStart" satisfies BucketAEvent);
// @ts-expect-error Events outside bucket A are not admitted.
void ("Notification" satisfies BucketAEvent);
void ("PreToolUse" satisfies ToolEvent);
// @ts-expect-error A non-tool event is not a ToolEvent.
void ("SessionStart" satisfies ToolEvent);
void ("StopFailure" satisfies DispatchableEvent);
// @ts-expect-error Events outside bucket A are not dispatchable.
void ("Notification" satisfies DispatchableEvent);
void ("rate_limit" satisfies StopFailureErrorType);
// @ts-expect-error Error types use the closed vocabulary.
void ("timeout" satisfies StopFailureErrorType);

describe("BUCKET_A_EVENTS", () => {
  test("publishes every admitted event in registration order", () => {
    // arrange
    const expectedEvents = [
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
    ] as const;

    // act
    const events = BUCKET_A_EVENTS;

    // assert
    assert.deepStrictEqual(events, expectedEvents);
  });
});

describe("TOOL_EVENTS", () => {
  test("publishes the complete tool-event subset", () => {
    // arrange
    const expectedEvents = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;

    // act
    const events = TOOL_EVENTS;

    // assert
    assert.deepStrictEqual(events, expectedEvents);
  });
});

describe("isDispatchableEvent", () => {
  for (const eventName of [
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
  ] as const) {
    test(`accepts ${eventName}`, () => {
      // arrange
      const event: BucketAEvent = eventName;

      // act
      const isDispatchable = isDispatchableEvent(event);

      // assert
      assert.strictEqual(isDispatchable, true);
    });
  }

  test("rejects an event outside the dispatchable set", () => {
    // arrange
    const event = "Notification" as BucketAEvent;

    // act
    const isDispatchable = isDispatchableEvent(event);

    // assert
    assert.strictEqual(isDispatchable, false);
  });
});

describe("NON_TOOL_EVENT_FIELDS", () => {
  test("publishes every non-tool matcher field", () => {
    // arrange
    const expectedFields = {
      SessionStart: "source",
      SessionEnd: "reason",
      PreCompact: "trigger",
      PostCompact: "trigger",
      UserPromptSubmit: null,
      Stop: null,
      StopFailure: "error",
    } as const;

    // act
    const fields = NON_TOOL_EVENT_FIELDS;

    // assert
    assert.deepStrictEqual(fields, expectedFields);
  });
});

describe("NON_TOOL_EVENT_CLOSED_SETS", () => {
  test("publishes every closed matcher vocabulary", () => {
    // arrange
    const expectedClosedSets = {
      SessionStart: new Set(["startup", "resume"]),
      SessionEnd: new Set(),
      PreCompact: new Set(),
      PostCompact: new Set(),
      StopFailure: new Set([
        "rate_limit",
        "overloaded",
        "authentication_failed",
        "oauth_org_not_allowed",
        "billing_error",
        "invalid_request",
        "model_not_found",
        "server_error",
        "max_output_tokens",
        "unknown",
      ]),
    };

    // act
    const closedSets = NON_TOOL_EVENT_CLOSED_SETS;

    // assert
    assert.deepStrictEqual(closedSets, expectedClosedSets);
  });
});

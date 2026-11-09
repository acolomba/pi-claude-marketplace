import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BUCKET_A_EVENTS,
  closedSetMatcherValues,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
  type BucketAEvent,
  type DispatchableEvent,
  type StopFailureErrorType,
  type ToolEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

import type { ClaudeHookEvent } from "../../../extensions/pi-claude-marketplace/shared/concerns/hooks.ts";

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

// Both directions are checked against the public event contract.
type BucketAEventsCoverageProofIsExact = [Exclude<ClaudeHookEvent, BucketAEvent>] extends [never]
  ? [Exclude<BucketAEvent, ClaudeHookEvent>] extends [never]
    ? true
    : false
  : false;
void (true satisfies BucketAEventsCoverageProofIsExact);

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

  test("retains tool events in their admitted-event relative order", () => {
    // arrange
    const expectedEvents = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;
    const toolEventMembers: ReadonlySet<string> = new Set(TOOL_EVENTS);

    // act
    const events = BUCKET_A_EVENTS.filter((event) => toolEventMembers.has(event));

    // assert
    assert.deepStrictEqual(events, expectedEvents);
  });
});

describe("DispatchableEvent", () => {
  test("matches the admitted event set exactly", () => {
    // arrange
    const dispatchableEvents: readonly DispatchableEvent[] = BUCKET_A_EVENTS;

    // act
    const events = dispatchableEvents;

    // assert
    assert.deepStrictEqual(events, BUCKET_A_EVENTS);
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
      SessionStart: new Set(["startup", "resume", "clear", "compact", "fork"]),
      SessionEnd: new Set(["clear", "resume", "logout", "prompt_input_exit", "other"]),
      PreCompact: new Set(["manual", "auto"]),
      PostCompact: new Set(["manual", "auto"]),
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
        "account_on_hold",
        "verification_required",
        "cloud_credential_error",
      ]),
    };

    // act
    const closedSets = NON_TOOL_EVENT_CLOSED_SETS;

    // assert
    assert.deepStrictEqual(closedSets, expectedClosedSets);
  });
});

describe("closedSetMatcherValues", () => {
  for (const { event, matcher, expectedValues } of [
    { event: "StopFailure", matcher: "rate_limit", expectedValues: ["rate_limit"] },
    {
      event: "StopFailure",
      matcher: "rate_limit|overloaded",
      expectedValues: ["rate_limit", "overloaded"],
    },
    {
      event: "StopFailure",
      matcher: "|rate_limit||overloaded|",
      expectedValues: ["rate_limit", "overloaded"],
    },
    {
      event: "StopFailure",
      matcher: "network_error|timeout",
      expectedValues: ["network_error", "timeout"],
    },
    { event: "StopFailure", matcher: "|", expectedValues: [] },
    { event: "StopFailure", matcher: "", expectedValues: [] },
    { event: "StopFailure", matcher: "*", expectedValues: [] },
    { event: "StopFailure", matcher: "rate_limit|server-error", expectedValues: [] },
    { event: "StopFailure", matcher: "rate limit", expectedValues: [] },
    { event: "StopFailure", matcher: "rate_limit,overloaded", expectedValues: [] },
    { event: "SessionStart", matcher: "startup|clear", expectedValues: ["startup", "clear"] },
    { event: "SessionStart", matcher: "reload, clear", expectedValues: ["reload", "clear"] },
    {
      event: "SessionEnd",
      matcher: " clear , resume |other ",
      expectedValues: ["clear", "resume", "other"],
    },
    { event: "SessionEnd", matcher: "clear||,resume", expectedValues: ["clear", "resume"] },
    { event: "PreCompact", matcher: "manual-auto", expectedValues: ["manual-auto"] },
    { event: "PreCompact", matcher: ", |", expectedValues: [] },
    { event: "PostCompact", matcher: "manual.*", expectedValues: [] },
    { event: "PostCompact", matcher: "manual\tauto", expectedValues: [] },
    { event: "SessionStart", matcher: "", expectedValues: [] },
    { event: "SessionStart", matcher: "*", expectedValues: [] },
  ] as const) {
    test(`reads the ${event} matcher ${JSON.stringify(matcher)} as the list ${JSON.stringify(expectedValues)} (D-BG-302, CLOSEDLIST-01)`, () => {
      // arrange
      const rawMatcher = matcher;

      // act
      const values = closedSetMatcherValues(event, rawMatcher);

      // assert
      assert.deepStrictEqual(values, expectedValues);
    });
  }
});

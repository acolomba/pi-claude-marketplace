import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
  type BucketAEvent,
  type DispatchableEvent,
  type StopFailureErrorType,
  type ToolEvent,
  type _BucketAEventsCoverageProof,
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

// The proof resolves to `never` exactly when `BUCKET_A_EVENTS` registers every
// `ClaudeHookEvent`. The tuple wrappers stop the naked-`never` conditional from
// distributing, so both directions are compared as written.
type BucketAEventsCoverageProofIsExact = [_BucketAEventsCoverageProof] extends [never]
  ? [never] extends [_BucketAEventsCoverageProof]
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
      SessionStart: new Set(["startup", "resume"]),
      SessionEnd: new Set(),
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
      ]),
    };

    // act
    const closedSets = NON_TOOL_EVENT_CLOSED_SETS;

    // assert
    assert.deepStrictEqual(closedSets, expectedClosedSets);
  });
});

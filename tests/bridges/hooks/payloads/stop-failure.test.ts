// Unit test for the StopFailure payload translator + errorMessage classifier
// (SFAIL-02, SFAIL-03, D-88-02).

import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyStopFailure,
  translate,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts";
import { NON_TOOL_EVENT_CLOSED_SETS } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

import type {
  StopFailureEvent,
  StopFailureStdin,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

void ({
  error: "rate_limit",
  error_details: "429 from provider",
  last_assistant_message: "Request failed",
} satisfies StopFailureEvent);
void ({
  session_id: "session-type",
  transcript_path: "/tmp/session-type.jsonl",
  cwd: "/project-type",
  hook_event_name: "StopFailure",
  error: "unknown",
  last_assistant_message: "Unclassified failure",
} satisfies StopFailureStdin);

void ({
  // @ts-expect-error a StopFailure event has a closed error vocabulary
  error: "network_error",
  last_assistant_message: "Request failed",
} satisfies StopFailureEvent);
void ({
  session_id: "session-type",
  transcript_path: "/tmp/session-type.jsonl",
  cwd: "/project-type",
  hook_event_name: "StopFailure",
  error: "rate_limit",
  // @ts-expect-error error_details is text when it is present
  error_details: 429,
  last_assistant_message: "Request failed",
} satisfies StopFailureStdin);

const stopFailureVocab = NON_TOOL_EVENT_CLOSED_SETS.StopFailure;
if (stopFailureVocab === undefined) {
  throw new Error("StopFailure closed vocab must be defined");
}

const CLOSED_VOCAB = stopFailureVocab;

// ---------------------------------------------------------------------------
// SFAIL-02: envelope shape
// ---------------------------------------------------------------------------

test("emits the complete StopFailure envelope with error details", () => {
  // arrange
  const event = {
    error: "rate_limit",
    error_details: "429 from provider",
    last_assistant_message: "Request failed",
  } satisfies StopFailureEvent;
  const context = {
    sessionId: "session-present",
    transcriptPath: "/tmp/session-present.jsonl",
    cwd: "/project-present",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-present",
    transcript_path: "/tmp/session-present.jsonl",
    cwd: "/project-present",
    hook_event_name: "StopFailure",
    error: "rate_limit",
    error_details: "429 from provider",
    last_assistant_message: "Request failed",
  } satisfies StopFailureStdin;

  // act
  const stopFailurePayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopFailurePayload, expectedPayload);
  assert.strictEqual(Object.hasOwn(stopFailurePayload, "error_details"), true);
});

test("omits error_details from the complete envelope when the event omits it", () => {
  // arrange
  const event = {
    error: "unknown",
    last_assistant_message: "",
  } satisfies StopFailureEvent;
  const context = {
    sessionId: "session-absent",
    transcriptPath: "/tmp/session-absent.jsonl",
    cwd: "/project-absent",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-absent",
    transcript_path: "/tmp/session-absent.jsonl",
    cwd: "/project-absent",
    hook_event_name: "StopFailure",
    error: "unknown",
    last_assistant_message: "",
  } satisfies StopFailureStdin;

  // act
  const stopFailurePayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopFailurePayload, expectedPayload);
  assert.strictEqual(Object.hasOwn(stopFailurePayload, "error_details"), false);
});

test("preserves an empty transcript path in the complete envelope", () => {
  // arrange
  const event = {
    error: "server_error",
    last_assistant_message: "Service unavailable",
  } satisfies StopFailureEvent;
  const context = {
    sessionId: "session-lazy",
    transcriptPath: "",
    cwd: "/project-lazy",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-lazy",
    transcript_path: "",
    cwd: "/project-lazy",
    hook_event_name: "StopFailure",
    error: "server_error",
    last_assistant_message: "Service unavailable",
  } satisfies StopFailureStdin;

  // act
  const stopFailurePayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopFailurePayload, expectedPayload);
  assert.strictEqual(Object.hasOwn(stopFailurePayload, "error_details"), false);
});

// ---------------------------------------------------------------------------
// SFAIL-03: errorMessage-only classifier into the closed 10-value vocab
// ---------------------------------------------------------------------------

test("classifies billing before every later error indicator", () => {
  // arrange
  const errorMessage =
    "OUT OF BUDGET; RATE LIMIT; OVERLOADED; AUTHENTICATION FAILED; SERVER ERROR; " +
    "MODEL_NOT_FOUND; INVALID REQUEST";
  const stopReason = "error";
  const expectedError = "billing_error";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies rate limiting before every later error indicator", () => {
  // arrange
  const errorMessage =
    "TOO MANY REQUESTS; OVERLOADED; AUTHENTICATION FAILED; SERVER ERROR; MODEL_NOT_FOUND; " +
    "INVALID REQUEST";
  const stopReason = "error";
  const expectedError = "rate_limit";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies overload before every later error indicator", () => {
  // arrange
  const errorMessage =
    "OVERLOADED; AUTHENTICATION FAILED; SERVER ERROR; MODEL_NOT_FOUND; INVALID REQUEST";
  const stopReason = "error";
  const expectedError = "overloaded";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies authentication before every later error indicator", () => {
  // arrange
  const errorMessage = "AUTHENTICATION FAILED; SERVER ERROR; MODEL_NOT_FOUND; INVALID REQUEST";
  const stopReason = "error";
  const expectedError = "authentication_failed";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies server failures before model and request indicators", () => {
  // arrange
  const errorMessage = "SERVICE UNAVAILABLE; MODEL_NOT_FOUND; INVALID REQUEST";
  const stopReason = "error";
  const expectedError = "server_error";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies a missing model before an invalid request indicator", () => {
  // arrange
  const errorMessage = "MODEL_NOT_FOUND; INVALID REQUEST";
  const stopReason = "error";
  const expectedError = "model_not_found";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies an invalid request indicator", () => {
  // arrange
  const errorMessage = "INVALID REQUEST: BAD PARAMETERS";
  const stopReason = "error";
  const expectedError = "invalid_request";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("maps a length ending before inspecting error indicators", () => {
  // arrange
  const errorMessage =
    "OUT OF BUDGET; RATE LIMIT; OVERLOADED; AUTHENTICATION FAILED; SERVER ERROR; " +
    "MODEL_NOT_FOUND; INVALID REQUEST";
  const stopReason = "length";
  const expectedError = "max_output_tokens";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("falls back to unknown for an empty error message", () => {
  // arrange
  const errorMessage = "";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("falls back to unknown for an organization policy failure", () => {
  // arrange
  const errorMessage = "Organization is not allowed to use this model by policy";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies the lowest recognized status code as an invalid request", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 400.";
  const stopReason = "error";
  const expectedError = "invalid_request";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies status 401 as an authentication failure", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 401.";
  const stopReason = "error";
  const expectedError = "authentication_failed";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies status 403 as an authentication failure", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 403.";
  const stopReason = "error";
  const expectedError = "authentication_failed";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies status 429 as rate limiting", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 429.";
  const stopReason = "error";
  const expectedError = "rate_limit";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies the lowest recognized server status as a server failure", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 500.";
  const stopReason = "error";
  const expectedError = "server_error";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies status 502 as a server failure", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 502.";
  const stopReason = "error";
  const expectedError = "server_error";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies status 503 as a server failure", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 503.";
  const stopReason = "error";
  const expectedError = "server_error";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies the highest recognized server status as a server failure", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 504.";
  const stopReason = "error";
  const expectedError = "server_error";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("classifies the highest recognized status code as overload", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 529.";
  const stopReason = "error";
  const expectedError = "overloaded";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately below the recognized range", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 399.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the gap between authentication statuses", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 402.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately above authentication", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 404.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately below rate limiting", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 428.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately above rate limiting", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 430.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately below server failures", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 499.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the gap between server statuses", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 501.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately above server failures", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 505.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately below overload", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 528.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not classify the status immediately above the recognized range", () => {
  // arrange
  const errorMessage = "Provider returned HTTP 530.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not match recognized statuses at the end of longer numbers", () => {
  // arrange
  const errorMessage = "Provider returned 1400, 1401, 1403, 1429, 1500, 1502, 1503, 1504, or 1529.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

test("does not match recognized statuses at the start of longer numbers", () => {
  // arrange
  const errorMessage = "Provider returned 4000, 4010, 4030, 4290, 5000, 5020, 5030, 5040, or 5290.";
  const stopReason = "error";
  const expectedError = "unknown";

  // act
  const stopFailureError = classifyStopFailure(errorMessage, stopReason);

  // assert
  assert.strictEqual(stopFailureError, expectedError);
  assert.strictEqual(CLOSED_VOCAB.has(stopFailureError), true);
});

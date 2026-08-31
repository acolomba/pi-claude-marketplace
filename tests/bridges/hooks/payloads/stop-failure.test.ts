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

// @ts-expect-error a StopFailure event has a closed error vocabulary
void ({ error: "network_error", last_assistant_message: "Request failed" } satisfies StopFailureEvent);
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

// Each fixture is [errorMessage, stopReason, expected classified type].
const CLASSIFIER_FIXTURES: ReadonlyArray<readonly [string, "error" | "length", string]> = [
  // length is deterministic and ignores errorMessage entirely.
  ["", "length", "max_output_tokens"],
  ["Rate limit exceeded (429)", "length", "max_output_tokens"],
  // empty / unmatched errorMessage falls back to the in-vocabulary unknown.
  ["", "error", "unknown"],
  ["something entirely unclassifiable", "error", "unknown"],
  // bare 3-digit runs inside a longer number must NOT alias an HTTP-status code
  // (bounded numeric matches): 5000 != 500, 4290 != 429, 4013 != 401.
  ["retry after 5000ms", "error", "unknown"],
  ["request 4290 failed", "error", "unknown"],
  ["consumed 4013 tokens", "error", "unknown"],
  // org-policy has no observed Pi substring -> unknown.
  ["Organization is not allowed to use this model by policy", "error", "unknown"],
  // rate_limit
  ["Rate limit exceeded (429)", "error", "rate_limit"],
  ["Too many requests, slow down", "error", "rate_limit"],
  // overloaded
  ["Overloaded", "error", "overloaded"],
  ["Provider returned 529", "error", "overloaded"],
  // authentication_failed
  ['Authentication failed for "anthropic".', "error", "authentication_failed"],
  ["Received 401 Unauthorized", "error", "authentication_failed"],
  // billing_error
  ["billing issue on your account", "error", "billing_error"],
  ["quota exceeded", "error", "billing_error"],
  ["insufficient_quota", "error", "billing_error"],
  ["Monthly usage limit reached", "error", "billing_error"],
  // server_error
  ["503 service unavailable", "error", "server_error"],
  ["internal error occurred", "error", "server_error"],
  // model_not_found
  ["model not found", "error", "model_not_found"],
  // invalid_request
  ["invalid request: bad params", "error", "invalid_request"],
  ["HTTP 400 Bad Request", "error", "invalid_request"],
];

for (const [errorMessage, stopReason, expected] of CLASSIFIER_FIXTURES) {
  test(`SFAIL-03: classify(${JSON.stringify(errorMessage)}, ${stopReason}) -> ${expected}`, () => {
    const actual = classifyStopFailure(errorMessage, stopReason);

    assert.equal(actual, expected);
    assert.ok(
      CLOSED_VOCAB.has(actual),
      `classifier output ${JSON.stringify(actual)} must be a member of the closed vocab`,
    );
  });
}

test("SFAIL-03: substring matching is case-insensitive", () => {
  assert.equal(classifyStopFailure("RATE LIMIT EXCEEDED", "error"), "rate_limit");
  assert.equal(classifyStopFailure("oVeRlOaDeD", "error"), "overloaded");
  assert.equal(classifyStopFailure("Authentication Failed", "error"), "authentication_failed");
});

test("SFAIL-03: every classifier output is a member of the closed vocabulary", () => {
  const probes: ReadonlyArray<readonly [string, "error" | "length"]> = [
    ["", "error"],
    ["", "length"],
    ["rate limit", "error"],
    ["overloaded", "error"],
    ["401", "error"],
    ["billing", "error"],
    ["500", "error"],
    ["model not found", "error"],
    ["400", "error"],
    ["gibberish", "error"],
  ];

  for (const [msg, reason] of probes) {
    assert.ok(
      CLOSED_VOCAB.has(classifyStopFailure(msg, reason)),
      `classify(${JSON.stringify(msg)}, ${reason}) escaped the closed vocab`,
    );
  }
});

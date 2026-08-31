// Unit test for the Stop payload translator (STOP-02).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";

import type {
  StopEvent,
  StopStdin,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

void ({
  last_assistant_message: "Type-only assistant message",
  stop_hook_active: true,
} satisfies StopEvent);
void ({
  session_id: "session-type",
  transcript_path: "/tmp/session-type.jsonl",
  cwd: "/project-type",
  hook_event_name: "Stop",
  last_assistant_message: "Type-only assistant message",
  stop_hook_active: true,
} satisfies StopStdin);
void ({
  last_assistant_message: "Invalid active state",
  // @ts-expect-error a Stop event active state is boolean
  stop_hook_active: "true",
} satisfies StopEvent);

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("emits the complete active Stop envelope", () => {
  // arrange
  const event = {
    last_assistant_message: "Assistant response complete",
    stop_hook_active: true,
  } satisfies StopEvent;
  const context = {
    sessionId: "session-active",
    transcriptPath: "/tmp/session-active.jsonl",
    cwd: "/project-active",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-active",
    transcript_path: "/tmp/session-active.jsonl",
    cwd: "/project-active",
    hook_event_name: "Stop",
    last_assistant_message: "Assistant response complete",
    stop_hook_active: true,
  } satisfies StopStdin;

  // act
  const stopPayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopPayload, expectedPayload);
});

test("stop: stop_hook_active false round-trips verbatim (not omitted)", () => {
  const actual = translate({ last_assistant_message: "", stop_hook_active: false }, ctx);

  assert.equal(actual.stop_hook_active, false);
  assert.ok("stop_hook_active" in actual, "stop_hook_active:false must be carried, not omitted");
});

test("stop: background_tasks and session_crons are absent (not just falsy)", () => {
  const actual: StopStdin = translate(
    { last_assistant_message: "x", stop_hook_active: false },
    ctx,
  );
  const out = actual as unknown as Record<string, unknown>;

  assert.ok(!("background_tasks" in out), "background_tasks must be absent from the envelope");
  assert.ok(!("session_crons" in out), "session_crons must be absent from the envelope");
});

test("stop: transcript_path is empty when the session file is lazy", () => {
  const lazyCtx: TranslationContext = { sessionId: "sess-2", transcriptPath: "", cwd: "/proj" };

  const actual = translate({ last_assistant_message: "hi", stop_hook_active: false }, lazyCtx);

  assert.equal(actual.transcript_path, "");
});

// Unit test for the Stop payload translator (STOP-02).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";

import type {
  StopEvent,
  StopStdin,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("stop: emits the Stop envelope with the cached message + loop flag", () => {
  const event: StopEvent = { last_assistant_message: "done", stop_hook_active: true };

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"Stop","last_assistant_message":"done","stop_hook_active":true}',
  );
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

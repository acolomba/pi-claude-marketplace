// Unit test for the SessionEnd payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionShutdownEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("session-end: emits the SessionEnd envelope with reason propagation", () => {
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "quit",
  };

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"SessionEnd","reason":"quit"}',
  );
});

test("session-end: propagates all Pi shutdown reasons verbatim", () => {
  for (const reason of ["quit", "reload", "new", "resume", "fork"] as const) {
    const actual = translate({ type: "session_shutdown", reason }, ctx);
    assert.equal(actual.hook_event_name, "SessionEnd");
    assert.equal(actual.reason, reason);
  }
});

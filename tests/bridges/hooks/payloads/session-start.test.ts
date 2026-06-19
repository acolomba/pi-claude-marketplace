// Unit test for the SessionStart payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionStartEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("session-start: emits the SessionStart envelope with reason -> source propagation", () => {
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "startup",
  };

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"SessionStart","source":"startup"}',
  );
});

test("session-start: propagates non-startup reasons (resume) verbatim into source", () => {
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "resume",
  };

  const actual = translate(event, ctx);

  assert.equal(actual.hook_event_name, "SessionStart");
  assert.equal(actual.source, "resume");
});

test("session-start: propagates Pi-only reasons (reload / new / fork) verbatim", () => {
  // Pi exposes reasons that have no Claude equivalent; the translator
  // does not synthesize a fake `clear`/`compact` -- it passes the Pi
  // value through as-is (D-60-04 hand-authored expressivity).
  for (const reason of ["reload", "new", "fork"] as const) {
    const actual = translate({ type: "session_start", reason }, ctx);
    assert.equal(actual.source, reason);
  }
});

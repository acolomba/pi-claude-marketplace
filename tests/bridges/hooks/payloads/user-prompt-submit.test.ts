// Unit test for the UserPromptSubmit payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { InputEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("user-prompt-submit: emits the UserPromptSubmit envelope with text -> prompt propagation", () => {
  const event: InputEvent = {
    type: "input",
    text: "hello world",
    source: "interactive",
  };

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"UserPromptSubmit","prompt":"hello world"}',
  );
});

test("user-prompt-submit: propagates multi-line prompts verbatim", () => {
  const event: InputEvent = {
    type: "input",
    text: "line 1\nline 2\nline 3",
    source: "interactive",
  };

  const actual = translate(event, ctx);

  assert.equal(actual.prompt, "line 1\nline 2\nline 3");
  assert.equal(actual.hook_event_name, "UserPromptSubmit");
});

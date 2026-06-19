// Unit test for the PostCompact payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionCompactEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("post-compact: emits the PostCompact envelope with trigger=auto", () => {
  const event = {
    type: "session_compact",
    compactionEntry: {} as unknown,
    fromExtension: false,
  } as unknown as SessionCompactEvent;

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PostCompact","trigger":"auto"}',
  );
});

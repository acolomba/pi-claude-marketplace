// Unit test for the PreCompact payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionBeforeCompactEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("pre-compact: emits the PreCompact envelope with trigger=auto", () => {
  // Pi's SessionBeforeCompactEvent does not expose a trigger source;
  // the translator synthesizes `"auto"` matching Claude's documented
  // default for context-pressure-driven compaction.
  const event = {
    type: "session_before_compact",
    preparation: {} as unknown,
    branchEntries: [] as unknown[],
    signal: new AbortController().signal,
  } as unknown as SessionBeforeCompactEvent;

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PreCompact","trigger":"auto"}',
  );
});

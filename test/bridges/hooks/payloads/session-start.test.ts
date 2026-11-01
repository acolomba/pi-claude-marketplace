// Unit test for the SessionStart payload translator (PAYL-01) and its one
// mapping site (D-CF5-01, D-CF1-10..12).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  claudeSessionStartSource,
  translateSessionStart,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionStartSource } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { SessionStartEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("claudeSessionStartSource", () => {
  for (const { reason, source } of [
    { reason: "startup", source: "startup" },
    { reason: "new", source: "clear" },
    { reason: "resume", source: "resume" },
    { reason: "fork", source: "fork" },
  ] satisfies ReadonlyArray<{
    readonly reason: Exclude<SessionStartEvent["reason"], "reload">;
    readonly source: SessionStartSource;
  }>) {
    test(`maps the Pi reason ${reason} to the source ${source} (D-CF5-01)`, () => {
      // arrange
      const expectedSource = source;

      // act
      const mappedSource = claudeSessionStartSource(reason);

      // assert
      assert.strictEqual(mappedSource, expectedSource);
    });
  }
});

describe("translateSessionStart", () => {
  test("emits the complete SessionStart envelope with the startup source", () => {
    // arrange
    const context = {
      sessionId: "session-start-startup",
      transcriptPath: "/sessions/session-start-startup.jsonl",
      cwd: "/workspaces/session-start-startup",
    } satisfies TranslationContext;

    // act
    const payload = translateSessionStart({ source: "startup" }, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "session-start-startup",
      transcript_path: "/sessions/session-start-startup.jsonl",
      cwd: "/workspaces/session-start-startup",
      hook_event_name: "SessionStart",
      source: "startup",
    });
  });

  for (const source of ["resume", "clear", "compact", "fork"] satisfies SessionStartSource[]) {
    test(`writes the Claude-side source ${source} to the SessionStart envelope`, () => {
      // arrange
      const context = {
        sessionId: `session-start-${source}`,
        transcriptPath: `/sessions/session-start-${source}.jsonl`,
        cwd: `/workspaces/session-start-${source}`,
      } satisfies TranslationContext;

      // act
      const payload = translateSessionStart({ source }, context);

      // assert
      assert.deepStrictEqual(payload, {
        session_id: `session-start-${source}`,
        transcript_path: `/sessions/session-start-${source}.jsonl`,
        cwd: `/workspaces/session-start-${source}`,
        hook_event_name: "SessionStart",
        source,
      });
    });
  }

  test("accepts empty session, transcript, and working-directory values", () => {
    // arrange
    const context = {
      sessionId: "",
      transcriptPath: "",
      cwd: "",
    } satisfies TranslationContext;

    // act
    const payload = translateSessionStart({ source: "startup" }, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "",
      transcript_path: "",
      cwd: "",
      hook_event_name: "SessionStart",
      source: "startup",
    });
  });
});

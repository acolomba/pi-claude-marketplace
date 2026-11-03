// Unit test for the SessionEnd payload translator (PAYL-01) and its one
// mapping site (D-CF5-02, D-CF1-10).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  claudeSessionEndReason,
  translateSessionEnd,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionEndReason } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionMode,
  SessionShutdownEvent,
} from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type MappedShutdownReason = Exclude<SessionShutdownEvent["reason"], "reload">;

const MODES = ["tui", "print", "json", "rpc"] as const satisfies readonly ExtensionMode[];

describe("claudeSessionEndReason", () => {
  for (const mode of MODES) {
    for (const { reason, expected } of [
      { reason: "new", expected: "clear" },
      { reason: "resume", expected: "resume" },
      { reason: "fork", expected: "resume" },
    ] satisfies ReadonlyArray<{
      readonly reason: MappedShutdownReason;
      readonly expected: SessionEndReason;
    }>) {
      test(`maps the Pi reason ${reason} to ${expected} in ${mode} mode (D-CF5-02)`, () => {
        // arrange
        const expectedReason = expected;

        // act
        const mappedReason = claudeSessionEndReason(reason, mode);

        // assert
        assert.strictEqual(mappedReason, expectedReason);
      });
    }
  }

  test("maps a terminal quit to prompt_input_exit (D-CF5-02)", () => {
    // arrange
    const expectedReason: SessionEndReason = "prompt_input_exit";

    // act
    const mappedReason = claudeSessionEndReason("quit", "tui");

    // assert
    assert.strictEqual(mappedReason, expectedReason);
  });

  for (const mode of ["print", "json", "rpc"] as const satisfies readonly ExtensionMode[]) {
    test(`maps a quit in ${mode} mode to other (D-CF5-02)`, () => {
      // arrange
      const expectedReason: SessionEndReason = "other";

      // act
      const mappedReason = claudeSessionEndReason("quit", mode);

      // assert
      assert.strictEqual(mappedReason, expectedReason);
    });
  }
});

describe("translateSessionEnd", () => {
  for (const reason of [
    "clear",
    "resume",
    "logout",
    "prompt_input_exit",
    "other",
  ] satisfies SessionEndReason[]) {
    test(`writes the Claude-side reason ${reason} to the SessionEnd envelope`, () => {
      // arrange
      const context = {
        sessionId: `session-end-${reason}`,
        transcriptPath: `/sessions/session-end-${reason}.jsonl`,
        cwd: `/workspaces/session-end-${reason}`,
      } satisfies TranslationContext;

      // act
      const payload = translateSessionEnd({ reason }, context);

      // assert
      assert.deepStrictEqual(payload, {
        session_id: `session-end-${reason}`,
        transcript_path: `/sessions/session-end-${reason}.jsonl`,
        cwd: `/workspaces/session-end-${reason}`,
        hook_event_name: "SessionEnd",
        reason,
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
    const payload = translateSessionEnd({ reason: "other" }, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "",
      transcript_path: "",
      cwd: "",
      hook_event_name: "SessionEnd",
      reason: "other",
    });
  });
});

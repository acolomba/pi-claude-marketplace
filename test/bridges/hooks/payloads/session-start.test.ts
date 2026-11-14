// Unit test for the SessionStart payload translator (PAYL-01) and its one
// mapping site (D-CF5-01, D-CF1-10..12, D-PG6-14, D-PG6-15).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  claudeSessionStartSource,
  translateSessionStart,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";

import type { SessionLaunchFacts } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionStartSource } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { SessionStartEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("claudeSessionStartSource", () => {
  const launches = [
    { holdsMessages: false, forkedByThisLaunch: false },
    { holdsMessages: true, forkedByThisLaunch: false },
    { holdsMessages: false, forkedByThisLaunch: true },
    { holdsMessages: true, forkedByThisLaunch: true },
  ] as const satisfies readonly SessionLaunchFacts[];

  for (const { reason, source } of [
    { reason: "new", source: "clear" },
    { reason: "resume", source: "resume" },
    { reason: "fork", source: "fork" },
  ] satisfies ReadonlyArray<{
    readonly reason: Exclude<SessionStartEvent["reason"], "reload" | "startup">;
    readonly source: SessionStartSource;
  }>) {
    for (const launch of launches) {
      test(`maps the Pi reason ${reason} to the source ${source} whatever the launch ${JSON.stringify(launch)} shows (D-CF5-01)`, () => {
        // arrange
        const expectedSource = source;

        // act
        const mappedSource = claudeSessionStartSource(reason, launch);

        // assert
        assert.strictEqual(mappedSource, expectedSource);
      });
    }
  }

  for (const { launch, source, shows } of [
    {
      launch: { holdsMessages: false, forkedByThisLaunch: false },
      source: "startup",
      shows: "no message and no fork",
    },
    {
      launch: { holdsMessages: true, forkedByThisLaunch: false },
      source: "resume",
      shows: "a message and no fork",
    },
    {
      launch: { holdsMessages: false, forkedByThisLaunch: true },
      source: "fork",
      shows: "a fork and no message",
    },
    {
      launch: { holdsMessages: true, forkedByThisLaunch: true },
      source: "fork",
      shows: "a fork and its copied messages",
    },
  ] satisfies ReadonlyArray<{
    readonly launch: SessionLaunchFacts;
    readonly source: SessionStartSource;
    readonly shows: string;
  }>) {
    test(`maps the Pi reason startup to the source ${source} when the launch shows ${shows} (D-PG6-14, D-PG6-15)`, () => {
      // arrange
      const expectedSource = source;

      // act
      const mappedSource = claudeSessionStartSource("startup", launch);

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
